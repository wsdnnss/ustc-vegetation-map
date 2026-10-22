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

function normalizePolygon(value) {
  if (!Array.isArray(value)) return []
  const ring = []
  for (const item of value.slice(0, 200)) {
    if (!Array.isArray(item) || item.length < 2) continue
    const lng = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    ring.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))])
  }
  return ring.length >= 3 ? ring : []
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN
  return Number(value)
}

function toRecord(item) {
  const polygon = normalizePolygon(item.polygon)
  let lat = toNumber(item.lat)
  let lng = toNumber(item.lng)
  // 只有地块、没有中心坐标时，用顶点平均值作为中心，兼容只传 polygon 的导入文件
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && polygon.length) {
    lat = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length
    lng = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length
  }
  return {
    id: item.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    speciesId: item.speciesId || '',
    name: item.name || '',
    lat,
    lng,
    polygon,
    areaSize: polygon.length ? Math.max(0, Math.round(Number(item.areaSize) || 0)) : 0,
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
