import fsp from 'node:fs/promises'
import path from 'node:path'

/** 科大云盘同步目录，数据文件会放在这里，从而自动同步到云端 */
export const DEFAULT_DATA_DIR = 'E:/科大云盘/云盘文件/科大植物地图'
const FILE_NAME = '植物地图数据.json'
const PHOTO_DIR_NAME = '图片'
const MAX_BODY = 60 * 1024 * 1024
const MAX_IMAGE = 12 * 1024 * 1024
const KEY_PREFIX = 'ustc-veg-'

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

/**
 * 提供 GET /api/store（读取）与 PUT /api/store（写入）两个接口，
 * 把数据保存为云盘目录下的一个 JSON 文件。
 */
export function createStore(options = {}) {
  const dir = path.resolve(options.dir || process.env.VEG_DATA_DIR || DEFAULT_DATA_DIR)
  const file = path.join(dir, FILE_NAME)
  const photoDir = path.join(dir, PHOTO_DIR_NAME)
  let writeChain = Promise.resolve()

  async function readAll() {
    await fsp.mkdir(dir, { recursive: true })
    try {
      const raw = await fsp.readFile(file, 'utf8')
      const data = JSON.parse(raw)
      return { exists: true, items: data && typeof data === 'object' ? data : {} }
    } catch (err) {
      if (err.code === 'ENOENT') return { exists: false, items: {} }
      // 文件损坏或正在被云盘客户端占用时，不阻断读取
      return { exists: false, items: {} }
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

  /** 串行化写入，避免多个请求同时覆盖 */
  function enqueue(task) {
    const next = writeChain.then(task, task)
    writeChain = next.catch(() => {})
    return next
  }

  /** 保存单张照片为独立文件，返回可访问的 URL */
  async function saveImage(req, res) {
    const body = JSON.parse(await readBody(req))
    const dataUrl = body?.dataUrl || body?.data
    const matched = typeof dataUrl === 'string'
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

    if (pathname !== '/api/store') return false

    if (req.method === 'GET') {
      try {
        const { exists, items } = await readAll()
        sendJSON(res, 200, { available: true, dir, file, exists, items })
      } catch (err) {
        sendJSON(res, 200, { available: false, dir, file, error: err.message })
      }
      return true
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req))
        const patch = body && body.items && typeof body.items === 'object'
          ? body.items
          : body && body.key
            ? { [body.key]: body.value }
            : null
        if (!patch) {
          sendJSON(res, 400, { ok: false, error: '缺少 items 或 key' })
          return true
        }
        const entries = Object.entries(patch).filter(([key]) =>
          typeof key === 'string' && key.startsWith(KEY_PREFIX)
        )
        const saved = await enqueue(async () => {
          const { items } = await readAll()
          for (const [key, value] of entries) items[key] = value
          await writeAll(items)
          return items
        })
        sendJSON(res, 200, { ok: true, file, keys: entries.map(([key]) => key), items: saved })
      } catch (err) {
        sendJSON(res, 500, { ok: false, error: err.message })
      }
      return true
    }

    sendJSON(res, 405, { ok: false, error: '仅支持 GET / PUT' })
    return true
  }

  return { handle, dir, file, photoDir }
}

/** Connect / Vite 中间件：命中 /api/store 时处理，否则交给下一个中间件 */
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

export { FILE_NAME }
