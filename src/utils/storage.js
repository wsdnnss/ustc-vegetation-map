import { apiRequest, deletePhoto, getCached, isDiskMode, setCached } from './diskStore'

const KEY = 'ustc-veg-submissions'

/** 读取投稿（数据服务缓存优先，localStorage 为回退） */
export function loadSubmissions() {
  const cached = getCached(KEY)
  if (Array.isArray(cached)) return cached
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('读取本地投稿失败', e)
    return []
  }
}

function saveLocal(list) {
  setCached(KEY, list)
  return true
}

function toRecord(item) {
  return {
    id: item.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    speciesId: item.speciesId || '',
    name: item.name || '',
    lat: Number(item.lat),
    lng: Number(item.lng),
    note: item.note || '',
    collector: item.collector || '',
    image: item.image || ''
  }
}

/** 新增单条投稿 */
export async function addSubmission(item) {
  const record = toRecord(item)
  if (!isDiskMode()) {
    const list = loadSubmissions()
    list.push(record)
    saveLocal(list)
    return record
  }
  try {
    const data = await apiRequest('/submissions', { method: 'POST', body: record })
    if (Array.isArray(data?.items)) setCached(KEY, data.items)
    return data?.item || record
  } catch (e) {
    console.warn('保存投稿失败', e)
    return null
  }
}

/** 批量追加投稿（批量导入 / 导入 JSON 用），返回实际新增条数 */
export async function addSubmissions(items) {
  const list = (Array.isArray(items) ? items : [])
    .map(toRecord)
    .filter((x) => x.name && Number.isFinite(x.lat) && Number.isFinite(x.lng))
  if (!list.length) return 0

  if (!isDiskMode()) {
    const existing = loadSubmissions()
    const seen = new Set(existing.map((x) => x.id))
    const next = existing.slice()
    for (const item of list) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      next.push(item)
    }
    saveLocal(next)
    return next.length - existing.length
  }

  try {
    const data = await apiRequest('/submissions/batch', {
      method: 'POST',
      body: { items: list }
    })
    if (Array.isArray(data?.items)) setCached(KEY, data.items)
    return Number(data?.added) || 0
  } catch (e) {
    console.warn('批量保存投稿失败', e)
    return 0
  }
}

export async function removeSubmission(id) {
  const target = loadSubmissions().find((x) => x.id === id)

  if (!isDiskMode()) {
    const next = loadSubmissions().filter((x) => x.id !== id)
    saveLocal(next)
    if (target?.image) deletePhoto(target.image)
    return next
  }

  try {
    const data = await apiRequest(`/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const next = Array.isArray(data?.items) ? data.items : loadSubmissions().filter((x) => x.id !== id)
    setCached(KEY, next)
    return next
  } catch (e) {
    console.warn('删除投稿失败', e)
    return loadSubmissions()
  }
}

export async function clearSubmissions() {
  const list = loadSubmissions()

  if (!isDiskMode()) {
    saveLocal([])
    for (const item of list) {
      if (item.image) deletePhoto(item.image)
    }
    return
  }

  try {
    const data = await apiRequest('/submissions', { method: 'DELETE' })
    setCached(KEY, Array.isArray(data?.items) ? data.items : [])
  } catch (e) {
    console.warn('清空投稿失败', e)
  }
}
