import fsp from 'node:fs/promises'
import path from 'node:path'

/** 科大云盘同步目录，数据文件会放在这里，从而自动同步到云端 */
export const DEFAULT_DATA_DIR = 'E:/科大云盘/云盘文件/科大植物地图'
export const FILE_NAME = '植物地图数据.json'
const PHOTO_DIR_NAME = '图片'
const MAX_BODY = 60 * 1024 * 1024
const MAX_IMAGE = 12 * 1024 * 1024
const MAX_TEXT = 2000

export const POSTS_KEY = 'ustc-veg-community-posts'
export const SUBMISSIONS_KEY = 'ustc-veg-submissions'
export const AUTHOR_KEY = 'ustc-veg-community-author'

const EXT_BY_MIME = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp' }
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function text(value, max = MAX_TEXT) {
  return String(value ?? '').trim().slice(0, max)
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function imageList(value) {
  return Array.isArray(value) ? value.map((v) => text(v, 500)).filter(Boolean).slice(0, 3) : []
}

function normalizePost(input) {
  const src = input && typeof input === 'object' ? input : {}
  return {
    id: src.id ? text(src.id, 80) : makeId('post'),
    createdAt: src.createdAt ? text(src.createdAt, 40) : new Date().toISOString(),
    author: text(src.author, 40) || '匿名访客',
    content: text(src.content),
    images: imageList(src.images),
    speciesId: src.speciesId ? text(src.speciesId, 40) : null,
    pointIndex: Number.isInteger(src.pointIndex) ? src.pointIndex : null,
    speciesName: src.speciesName ? text(src.speciesName, 80) : null,
    location: src.location ? text(src.location, 120) : null
  }
}

function normalizeSubmission(input) {
  const src = input && typeof input === 'object' ? input : {}
  const lat = Number(src.lat)
  const lng = Number(src.lng)
  return {
    id: src.id ? text(src.id, 80) : makeId('sub'),
    createdAt: src.createdAt ? text(src.createdAt, 40) : new Date().toISOString(),
    speciesId: text(src.speciesId, 40),
    name: text(src.name, 80),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    note: text(src.note),
    collector: text(src.collector, 60),
    image: text(src.image, 500)
  }
}

function validCoordinate(item) {
  return (
    typeof item.lat === 'number' &&
    typeof item.lng === 'number' &&
    item.lat >= -90 &&
    item.lat <= 90 &&
    item.lng >= -180 &&
    item.lng <= 180
  )
}

function imagesOf(record) {
  const list = []
  if (record?.image) list.push(record.image)
  if (Array.isArray(record?.images)) list.push(...record.images)
  return list
}

/**
 * 数据服务：图片仍保存为独立文件，业务数据按“单条”追加/删除/清空，
 * 避免多个浏览器各自持有整表快照后互相覆盖。
 */
export function createStore(options = {}) {
  const dir = path.resolve(options.dir || process.env.VEG_DATA_DIR || DEFAULT_DATA_DIR)
  const file = path.join(dir, FILE_NAME)
  const photoDir = path.join(dir, PHOTO_DIR_NAME)
  let writeChain = Promise.resolve()

  async function readAll() {
    await fsp.mkdir(dir, { recursive: true })
    let raw
    try {
      raw = await fsp.readFile(file, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return { exists: false, items: {} }
      throw err
    }
    try {
      const data = JSON.parse(raw.replace(/^\uFEFF/, ''))
      return { exists: true, items: data && typeof data === 'object' ? data : {} }
    } catch (err) {
      // 文件损坏时停止写入，避免用空对象覆盖掉原数据
      throw new Error(`数据文件无法解析，已停止写入：${file}`)
    }
  }

  async function writeAll(items) {
    await fsp.mkdir(dir, { recursive: true })
    const json = JSON.stringify(items, null, 2)
    const tmp = `${file}.tmp`
    try {
      await fsp.writeFile(tmp, json, 'utf8')
      await fsp.rename(tmp, file)
    } catch (err) {
      // 云盘客户端可能短暂占用文件，退化为直接覆盖
      await fsp.writeFile(file, json, 'utf8')
      await fsp.rm(tmp, { force: true }).catch(() => {})
    }
  }

  /** 串行化写入：同一进程内的读-改-写不会交叉 */
  function enqueue(task) {
    const next = writeChain.then(task, task)
    writeChain = next.catch(() => {})
    return next
  }

  /** 在锁内读取当前列表、执行变更、写回，返回最新列表 */
  function updateList(key, mutate) {
    return enqueue(async () => {
      const { items } = await readAll()
      const list = Array.isArray(items[key]) ? items[key].slice() : []
      const result = mutate(list)
      items[key] = list
      await writeAll(items)
      return { items: list, result }
    })
  }

  /** 删除记录关联的照片文件（失败不影响业务数据） */
  async function deleteImagesOf(records) {
    const urls = (Array.isArray(records) ? records : [records]).flatMap(imagesOf)
    await Promise.all(
      urls.map(async (url) => {
        if (typeof url !== 'string' || !url.startsWith('/api/images/')) return
        const name = url.slice('/api/images/'.length)
        if (!/^[A-Za-z0-9._-]+$/.test(name)) return
        await fsp.rm(path.join(photoDir, name), { force: true }).catch(() => {})
      })
    )
  }

  /** 保存单张照片为独立文件，返回可访问的 URL */
  async function saveImage(req, res) {
    const body = JSON.parse(await readBody(req))
    const dataUrl = body?.dataUrl || body?.data
    const matched =
      typeof dataUrl === 'string'
        ? /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl)
        : null
    if (!matched) {
      sendJSON(res, 400, { ok: false, error: '仅支持 PNG / JPEG / WebP 图片' })
      return
    }

    const buffer = Buffer.from(matched[2], 'base64')
    if (!buffer.length || buffer.length > MAX_IMAGE) {
      sendJSON(res, 400, { ok: false, error: '图片为空或超过 12MB' })
      return
    }

    const ext = EXT_BY_MIME[matched[1].toLowerCase()] || 'jpg'
    const name = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await fsp.mkdir(photoDir, { recursive: true })
    await fsp.writeFile(path.join(photoDir, name), buffer)
    sendJSON(res, 200, { ok: true, name, url: `/api/images/${name}`, size: buffer.length })
  }

  /** 读取或删除照片文件 */
  async function handleImageFile(req, res, name) {
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      sendJSON(res, 404, { ok: false, error: '文件不存在' })
      return
    }
    const target = path.join(photoDir, name)
    if (!target.startsWith(photoDir + path.sep)) {
      sendJSON(res, 404, { ok: false, error: '文件不存在' })
      return
    }

    if (req.method === 'DELETE') {
      await fsp.rm(target, { force: true })
      sendJSON(res, 200, { ok: true })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJSON(res, 405, { ok: false, error: '仅支持 GET / DELETE' })
      return
    }

    try {
      const data = await fsp.readFile(target)
      res.statusCode = 200
      res.setHeader('Content-Type', MIME_BY_EXT[path.extname(name).slice(1)] || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch (err) {
      sendJSON(res, 404, { ok: false, error: '文件不存在' })
    }
  }

  async function handlePosts(req, res, pathname) {
    if (pathname === '/api/posts' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      const record = normalizePost(body?.post || body)
      const { items, result } = await updateList(POSTS_KEY, (list) => {
        list.push(record)
        return record
      })
      sendJSON(res, 200, { ok: true, item: result, items })
      return
    }

    if (pathname === '/api/posts/batch' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      const incoming = Array.isArray(body?.items) ? body.items : []
      const { items, result } = await updateList(POSTS_KEY, (list) => {
        const seen = new Set(list.map((x) => x.id))
        const added = []
        for (const raw of incoming) {
          const record = normalizePost(raw)
          if (seen.has(record.id)) continue
          seen.add(record.id)
          list.push(record)
          added.push(record)
        }
        return added
      })
      sendJSON(res, 200, { ok: true, added: result.length, items })
      return
    }

    if (pathname.startsWith('/api/posts/') && req.method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/posts/'.length))
      const { items, result } = await updateList(POSTS_KEY, (list) => {
        const index = list.findIndex((x) => x.id === id)
        if (index < 0) return null
        return list.splice(index, 1)[0]
      })
      if (!result) {
        sendJSON(res, 404, { ok: false, error: '帖子不存在' })
        return
      }
      await deleteImagesOf(result)
      sendJSON(res, 200, { ok: true, items })
      return
    }

    sendJSON(res, 405, { ok: false, error: '仅支持 POST / DELETE' })
  }

  async function handleSubmissions(req, res, pathname) {
    if (pathname === '/api/submissions' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      const record = normalizeSubmission(body?.submission || body)
      if (!record.name || !validCoordinate(record)) {
        sendJSON(res, 400, { ok: false, error: '缺少物种名或经纬度无效' })
        return
      }
      const { items, result } = await updateList(SUBMISSIONS_KEY, (list) => {
        list.push(record)
        return record
      })
      sendJSON(res, 200, { ok: true, item: result, items })
      return
    }

    if (pathname === '/api/submissions/batch' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      const incoming = Array.isArray(body?.items) ? body.items : []
      const { items, result } = await updateList(SUBMISSIONS_KEY, (list) => {
        const seen = new Set(list.map((x) => x.id))
        const added = []
        for (const raw of incoming) {
          const record = normalizeSubmission(raw)
          if (!record.name || !validCoordinate(record)) continue
          if (seen.has(record.id)) continue
          seen.add(record.id)
          list.push(record)
          added.push(record)
        }
        return added
      })
      sendJSON(res, 200, { ok: true, added: result.length, items })
      return
    }

    if (pathname === '/api/submissions' && req.method === 'DELETE') {
      const { items, result } = await updateList(SUBMISSIONS_KEY, (list) => {
        const old = list.slice()
        list.length = 0
        return old
      })
      await deleteImagesOf(result)
      sendJSON(res, 200, { ok: true, items })
      return
    }

    if (pathname.startsWith('/api/submissions/') && req.method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/submissions/'.length))
      const { items, result } = await updateList(SUBMISSIONS_KEY, (list) => {
        const index = list.findIndex((x) => x.id === id)
        if (index < 0) return null
        return list.splice(index, 1)[0]
      })
      if (!result) {
        sendJSON(res, 404, { ok: false, error: '投稿不存在' })
        return
      }
      await deleteImagesOf(result)
      sendJSON(res, 200, { ok: true, items })
      return
    }

    sendJSON(res, 405, { ok: false, error: '仅支持 POST / DELETE' })
  }

  async function handleAuthor(req, res) {
    if (req.method !== 'PUT' && req.method !== 'POST') {
      sendJSON(res, 405, { ok: false, error: '仅支持 PUT' })
      return
    }
    const body = JSON.parse(await readBody(req))
    const name = text(body?.name, 40)
    await enqueue(async () => {
      const { items } = await readAll()
      items[AUTHOR_KEY] = name
      await writeAll(items)
    })
    sendJSON(res, 200, { ok: true, value: name })
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const { pathname } = url

    if (pathname === '/api/images') {
      if (req.method !== 'POST') {
        sendJSON(res, 405, { ok: false, error: '仅支持 POST' })
        return true
      }
      try {
        await saveImage(req, res)
      } catch (err) {
        sendJSON(res, 500, { ok: false, error: err.message })
      }
      return true
    }

    if (pathname.startsWith('/api/images/')) {
      try {
        await handleImageFile(req, res, pathname.slice('/api/images/'.length))
      } catch (err) {
        if (!res.headersSent) sendJSON(res, 500, { ok: false, error: err.message })
      }
      return true
    }

    if (pathname === '/api/store') {
      if (req.method !== 'GET') {
        sendJSON(res, 405, { ok: false, error: '整表写入已停用，请使用按条接口' })
        return true
      }
      try {
        const { exists, items } = await readAll()
        sendJSON(res, 200, { available: true, dir, file, exists, items })
      } catch (err) {
        sendJSON(res, 200, { available: false, dir, file, error: err.message })
      }
      return true
    }

    try {
      if (pathname === '/api/posts' || pathname === '/api/posts/batch' || pathname.startsWith('/api/posts/')) {
        await handlePosts(req, res, pathname)
        return true
      }
      if (
        pathname === '/api/submissions' ||
        pathname === '/api/submissions/batch' ||
        pathname.startsWith('/api/submissions/')
      ) {
        await handleSubmissions(req, res, pathname)
        return true
      }
      if (pathname === '/api/author') {
        await handleAuthor(req, res)
        return true
      }
    } catch (err) {
      sendJSON(res, 500, { ok: false, error: err.message })
      return true
    }

    return false
  }

  return { handle, dir, file, photoDir }
}

/** Connect / Vite 中间件：命中 /api 时处理，否则交给下一个中间件 */
export function storeMiddleware(options) {
  const store = createStore(options)
  return function dataStoreMiddleware(req, res, next) {
    Promise.resolve(store.handle(req, res))
      .then((handled) => {
        if (!handled && typeof next === 'function') next()
      })
      .catch((err) => {
        if (!res.headersSent) sendJSON(res, 500, { ok: false, error: err.message })
      })
  }
}
