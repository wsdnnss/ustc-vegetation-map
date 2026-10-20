import { apiRequest, deletePhoto, getCached, isDiskMode, setCached } from './diskStore'

const POSTS_KEY = 'ustc-veg-community-posts'
const AUTHOR_KEY = 'ustc-veg-community-author'

/** 读取社区帖子（数据服务缓存优先，localStorage 为回退） */
export function loadPosts() {
  const cached = getCached(POSTS_KEY)
  if (Array.isArray(cached)) return cached
  try {
    const raw = localStorage.getItem(POSTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('读取社区帖子失败', e)
    return []
  }
}

function saveLocal(list) {
  setCached(POSTS_KEY, list)
  return true
}

function toRecord(item) {
  return {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    author: (item.author || '').trim() || '匿名访客',
    content: (item.content || '').trim(),
    images: Array.isArray(item.images) ? item.images.filter(Boolean).slice(0, 3) : [],
    speciesId: item.speciesId || null,
    pointIndex: Number.isInteger(item.pointIndex) ? item.pointIndex : null,
    speciesName: item.speciesName || null,
    location: item.location || null
  }
}

/**
 * 新增帖子。
 * speciesId + pointIndex 同时存在表示针对某个植物分布点发帖，否则为社区广场帖子。
 * 服务不可用时退回浏览器本地存储。
 */
export async function addPost(item) {
  const record = toRecord(item)
  if (!isDiskMode()) {
    const list = loadPosts()
    list.push(record)
    saveLocal(list)
    return record
  }
  try {
    const data = await apiRequest('/posts', { method: 'POST', body: record })
    if (Array.isArray(data?.items)) setCached(POSTS_KEY, data.items)
    return data?.item || record
  } catch (e) {
    console.warn('保存帖子失败', e)
    return null
  }
}

export async function removePost(id) {
  const target = loadPosts().find((x) => x.id === id)

  if (!isDiskMode()) {
    const list = loadPosts().filter((x) => x.id !== id)
    saveLocal(list)
    for (const image of target?.images || []) deletePhoto(image)
    return list
  }

  try {
    const data = await apiRequest(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const list = Array.isArray(data?.items) ? data.items : loadPosts().filter((x) => x.id !== id)
    setCached(POSTS_KEY, list)
    return list
  } catch (e) {
    console.warn('删除帖子失败', e)
    return loadPosts()
  }
}

/** 记住昵称，下次发帖自动带出 */
export function loadAuthor() {
  const cached = getCached(AUTHOR_KEY)
  if (cached !== undefined) return String(cached || '')
  try {
    return localStorage.getItem(AUTHOR_KEY) || ''
  } catch (e) {
    return ''
  }
}

export async function saveAuthor(name) {
  const value = (name || '').trim()
  setCached(AUTHOR_KEY, value)
  if (!isDiskMode()) return
  try {
    await apiRequest('/author', { method: 'PUT', body: { name: value } })
  } catch (e) {
    console.warn('保存昵称失败', e)
  }
}

/** 统计每个分布点的帖子数，key 为 `${speciesId}:${pointIndex}` */
export function pointPostCounts(posts) {
  const map = {}
  for (const p of posts) {
    if (!p.speciesId || p.pointIndex === null || p.pointIndex === undefined) continue
    const key = `${p.speciesId}:${p.pointIndex}`
    map[key] = (map[key] || 0) + 1
  }
  return map
}
