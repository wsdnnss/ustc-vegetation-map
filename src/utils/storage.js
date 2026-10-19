import { deletePhoto, getCached, isDiskMode, persist } from './diskStore'

const KEY = 'ustc-veg-submissions'

/** 读取投稿（云盘内存缓存优先，localStorage 为回退） */
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

export function saveSubmissions(list) {
  let localOk = true
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch (e) {
    // 浏览器缓存写满不影响云盘保存
    localOk = false
    console.warn('浏览器缓存空间不足，投稿仍会保存到科大云盘', e)
  }
  persist(KEY, list)
  return localOk || isDiskMode()
}

export function addSubmission(item) {
  const list = loadSubmissions()
  const record = {
    id: `sub-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...item
  }
  list.push(record)
  return saveSubmissions(list) ? record : null
}

export function removeSubmission(id) {
  const list = loadSubmissions()
  const target = list.find((x) => x.id === id)
  const next = list.filter((x) => x.id !== id)
  if (saveSubmissions(next) && target?.image) deletePhoto(target.image)
  return next
}

export function clearSubmissions() {
  const list = loadSubmissions()
  if (!saveSubmissions([])) return
  for (const item of list) {
    if (item.image) deletePhoto(item.image)
  }
}
