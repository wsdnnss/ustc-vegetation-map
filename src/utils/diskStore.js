/**
 * 云盘持久化：数据以 JSON 文件形式保存在科大云盘同步目录，
 * localStorage 仅作为本地缓存 / 服务未启动时的回退。
 */
const API = '/api/store'

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
    console.warn('写入浏览器缓存失败（不影响云盘保存）', e)
  }
}

async function push(items) {
  try {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    return res.ok
  } catch (e) {
    console.warn('同步到科大云盘失败', e)
    return false
  }
}

/** 启动时从云盘文件读取数据，并把尚未同步的本地数据迁移上去 */
export async function initDiskStore() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(API, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return false
    const data = await res.json()
    if (!data?.available) return false

    status = { available: true, dir: data.dir || '', file: data.file || '' }
    const items = data.items || {}
    const pending = {}

    for (const key of KEYS) {
      const diskValue = items[key]
      const hasDiskValue = diskValue !== undefined && diskValue !== null
      if (hasDiskValue) {
        cache.set(key, diskValue)
        writeLocal(key, diskValue)
        continue
      }
      // 云盘文件里还没有这个键：把浏览器里的旧数据迁移过去
      const localValue = readLocal(key)
      const worthSaving = Array.isArray(localValue) ? localValue.length > 0 : Boolean(localValue)
      if (worthSaving) pending[key] = localValue
    }

    if (Object.keys(pending).length) await push(pending)
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

/** 读取内存缓存（云盘已加载或本次会话已写入的数据） */
export function getCached(key) {
  return cache.has(key) ? clone(cache.get(key)) : undefined
}

/** 数据变更后写入云盘 JSON 文件 */
export function persist(key, value) {
  if (!KEYS.includes(key)) return
  cache.set(key, clone(value))
  if (!status.available) return
  push({ [key]: value })
}

/**
 * 保存照片为云盘独立文件，返回可直接用于 img src 的 URL。
 * 服务不可用时回退为 base64 data URL，保证功能仍可用。
 */
export async function uploadPhoto(dataUrl) {
  if (!status.available || typeof dataUrl !== 'string') return dataUrl
  if (!dataUrl.startsWith('data:image/')) return dataUrl
  try {
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl })
    })
    if (!res.ok) return dataUrl
    const data = await res.json()
    return data?.ok && data.url ? data.url : dataUrl
  } catch (e) {
    console.warn('照片写入云盘失败，已回退为本地图片数据', e)
    return dataUrl
  }
}

/** 删除云盘中的照片文件（仅处理 /api/images/ 地址） */
export function deletePhoto(url) {
  if (!status.available || typeof url !== 'string' || !url.startsWith('/api/images/')) return
  fetch(url, { method: 'DELETE' }).catch(() => {})
}
