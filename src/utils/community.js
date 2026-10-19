import { deletePhoto, getCached, isDiskMode, persist } from './diskStore'

const POSTS_KEY = 'ustc-veg-community-posts'
const AUTHOR_KEY = 'ustc-veg-community-author'

/** 读取社区帖子（云盘内存缓存优先，localStorage 为回退） */
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

export function savePosts(list) {
  let localOk = true
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(list))
  } catch (e) {
    // 浏览器缓存写满不影响云盘保存
    localOk = false
    console.warn('浏览器缓存空间不足，帖子仍会保存到科大云盘', e)
  }
  persist(POSTS_KEY, list)
  return localOk || isDiskMode()
}

/**
 * 新增帖子。
 * speciesId + pointIndex 同时存在表示针对某个植物分布点发帖，否则为社区广场帖子。
 */
export function addPost(item) {
  const record = {
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
  const list = loadPosts()
  list.push(record)
  return savePosts(list) ? record : null
}

export function removePost(id) {
  const target = loadPosts().find((x) => x.id === id)
  const list = loadPosts().filter((x) => x.id !== id)
  if (savePosts(list) && target) {
    for (const image of target.images || []) deletePhoto(image)
  }
  return list
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

export function saveAuthor(name) {
  const value = (name || '').trim()
  try {
    localStorage.setItem(AUTHOR_KEY, value)
  } catch (e) {
    console.warn('浏览器缓存写入失败，昵称仍会保存到科大云盘', e)
  }
  persist(AUTHOR_KEY, value)
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
