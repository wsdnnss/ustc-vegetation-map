/**
 * 数据服务客户端：业务数据按条写入本地 Node 服务，
 * localStorage 仅作为缓存 / 服务未启动时的回退。
 */
const API = '/api'
const AUTHOR_KEY = 'ustc-veg-community-author'
const KEYS = ['ustc-veg-community-posts', AUTHOR_KEY, 'ustc-veg-submissions']

let status = { available: false, dir: '', file: '' }

/** 内存缓存：即使 localStorage 写满或写入失败，页面仍能读到最新数据 */
const cache = new Map()

function clone(value) {
  return Array.isArray(value) ? value.slice() : value
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return key === AUTHOR_KEY ? raw : JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function writeLocal(key, value) {
  try {
    if (key === AUTHOR_KEY) {
      localStorage.setItem(key, String(value ?? ''))
    } else if (Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (e) {
    console.warn('写入浏览器缓存失败（不影响数据服务）', e)
  }
}

/** 统一请求封装：非 2xx 或 ok:false 时抛出错误 */
export async function apiRequest(path, { method = 'GET', body, headers } = {}) {
  const init = { method, cache: 'no-store', headers: { ...(headers || {}) } }
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${API}${path}`, init)
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = null
  }
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `接口 ${path} 返回 ${res.status}`)
  }
  return data
}

/** 把一组旧数据迁移到数据服务（本地调试时浏览器里可能已有历史数据） */
async function migrate(key, path) {
  const local = readLocal(key)
  if (!Array.isArray(local) || !local.length) return
  try {
    const data = await apiRequest(path, { method: 'POST', body: { items: local } })
    if (Array.isArray(data?.items)) {
      cache.set(key, data.items)
      writeLocal(key, data.items)
    }
  } catch (e) {
    console.warn('历史数据迁移失败，暂存于浏览器缓存', e)
  }
}

/** 启动时从数据服务读取数据，并把尚未同步的本地数据迁移上去 */
export async function initDiskStore() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${API}/store`, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return false
    const data = await res.json()
    if (!data?.available) return false

    status = { available: true, dir: data.dir || '', file: data.file || '' }
    const items = data.items || {}
    const missing = []

    for (const key of KEYS) {
      const value = items[key]
      if (value !== undefined && value !== null) {
        cache.set(key, clone(value))
        writeLocal(key, value)
      } else {
        missing.push(key)
      }
    }

    // 服务端还没有该键：把浏览器里的旧数据迁上去，避免下次写入后覆盖丢失
    if (missing.includes('ustc-veg-community-posts')) await migrate('ustc-veg-community-posts', '/posts/batch')
    if (missing.includes('ustc-veg-submissions')) await migrate('ustc-veg-submissions', '/submissions/batch')
    if (missing.includes(AUTHOR_KEY)) {
      const name = readLocal(AUTHOR_KEY)
      if (name) {
        apiRequest('/author', { method: 'PUT', body: { name } }).catch(() => {})
        cache.set(AUTHOR_KEY, name)
      }
    }

    return true
  } catch (e) {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function isDiskMode() {
  return status.available
}

export function getDiskStatus() {
  return status
}

/** 读取内存缓存（数据服务已加载或本次会话已写入的数据） */
export function getCached(key) {
  return cache.has(key) ? clone(cache.get(key)) : undefined
}

/** 写入内存缓存与浏览器缓存（以数据服务返回的列表为准） */
export function setCached(key, value) {
  if (!KEYS.includes(key)) return
  cache.set(key, clone(value))
  writeLocal(key, value)
}

/**
 * 保存照片为独立文件，返回可直接用于 img src 的 URL。
 * 服务不可用时回退为 base64 data URL，保证功能仍可用。
 */
export async function uploadPhoto(dataUrl) {
  if (!status.available || typeof dataUrl !== 'string') return dataUrl
  if (!dataUrl.startsWith('data:image/')) return dataUrl
  try {
    const data = await apiRequest('/images', { method: 'POST', body: { dataUrl } })
    return data?.ok && data.url ? data.url : dataUrl
  } catch (e) {
    console.warn('照片写入数据服务失败，已回退为本地图片数据', e)
    return dataUrl
  }
}

/** 删除照片文件（仅处理 /api/images/ 地址） */
export function deletePhoto(url) {
  if (!status.available || typeof url !== 'string' || !url.startsWith('/api/images/')) return
  fetch(url, { method: 'DELETE' }).catch(() => {})
}
