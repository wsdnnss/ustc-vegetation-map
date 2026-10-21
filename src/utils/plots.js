import { categoryOf } from './species'

/**
 * 地块（框选区域）工具：
 * - 几何：面积 / 中心点 / 点在多边形内 / 到边界距离
 * - 框选分析：范围内的分布点、物种、当前筛命中数、边界外近旁点位
 * - 智能建议：地块名称、用地类型、颜色、优势物种
 * - 存储：浏览器 localStorage + 与 plots.json 兼容的导入/导出
 *
 * 坐标约定：本模块内部的 ring 使用 { lat, lng }，经纬度均为 GCJ-02（与全站数据一致）；
 * 导出 plots.json 时 polygon/center 使用 [lng, lat]（与既有 plots.json、绘制工具一致）。
 */

export const PLOT_STORAGE_KEY = 'ustc-veg-plots'

export const LANDUSE_OPTIONS = [
  { value: '密林', color: '#2E7D32', tone: '深绿' },
  { value: '疏林', color: '#7CB342', tone: '中绿' },
  { value: '草坪', color: '#AED581', tone: '浅绿' },
  { value: '花坛', color: '#F9A825', tone: '橙黄' },
  { value: '行道树', color: '#00897B', tone: '青绿' }
]

const NEARBY_METERS = 25
const BOUNDARY_TOLERANCE_METERS = 0.6

function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6
}

/** 球面多边形面积（㎡），校园尺度误差远小于 1% */
export function ringAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  const R = 6378137
  const rad = Math.PI / 180
  let sum = 0
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    sum += (p2.lng - p1.lng) * rad * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad))
  }
  return Math.abs((sum * R * R) / 2)
}

/** 多边形面积中心（退化时回退到顶点平均值） */
export function ringCenter(ring) {
  if (!Array.isArray(ring) || !ring.length) return { lat: 0, lng: 0 }
  // 以首顶点为局部原点，避免经纬度量级过大导致小范围地块的中心点精度损失
  const ox = ring[0].lng
  const oy = ring[0].lat
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const ax = a.lng - ox
    const ay = a.lat - oy
    const bx = b.lng - ox
    const by = b.lat - oy
    const cross = ax * by - bx * ay
    twiceArea += cross
    cx += (ax + bx) * cross
    cy += (ay + by) * cross
  }
  if (Math.abs(twiceArea) < 1e-16) {
    const lng = ring.reduce((s, p) => s + p.lng, 0) / ring.length
    const lat = ring.reduce((s, p) => s + p.lat, 0) / ring.length
    return { lat: round6(lat), lng: round6(lng) }
  }
  return {
    lat: round6(oy + cy / (3 * twiceArea)),
    lng: round6(ox + cx / (3 * twiceArea))
  }
}

/** 点是否落在多边形内（射线法） */
export function pointInRing(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].lng
    const yi = ring[i].lat
    const xj = ring[j].lng
    const yj = ring[j].lat
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

function meterProjector(ring) {
  const lat0 = ring.reduce((s, p) => s + p.lat, 0) / Math.max(1, ring.length)
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 111320
  return (p) => [p.lng * kx, p.lat * ky]
}

/** 点到多边形边界的最近距离（米） */
export function distanceToRingM(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 2) return Infinity
  const project = meterProjector(ring)
  const p = project({ lat, lng })
  let best = Infinity
  for (let i = 0; i < ring.length; i += 1) {
    const a = project(ring[i])
    const b = project(ring[(i + 1) % ring.length])
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = dx * dx + dy * dy
    let t = len ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len : 0
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
    if (d < best) best = d
  }
  return best
}

/** 外接矩形尺寸与狭长度（长边 / 短边） */
export function ringShape(ring) {
  if (!Array.isArray(ring) || !ring.length) {
    return { width: 0, height: 0, ratio: 1 }
  }
  const lats = ring.map((p) => p.lat)
  const lngs = ring.map((p) => p.lng)
  const lat0 = lats.reduce((s, v) => s + v, 0) / lats.length
  const width = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * Math.cos((lat0 * Math.PI) / 180)
  const height = (Math.max(...lats) - Math.min(...lats)) * 111320
  const short = Math.min(width, height)
  return { width, height, ratio: Math.max(width, height) / Math.max(1, short) }
}

/** 矩形四点（西南 → 东南 → 东北 → 西北） */
export function ringFromBounds(bounds) {
  return [
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west }
  ]
}

export function boundsOfRing(ring) {
  const lats = ring.map((p) => p.lat)
  const lngs = ring.map((p) => p.lng)
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs)
  }
}

/** 以中心点为基准缩放多边形（多边形一键纳入近旁点位用） */
export function scaleRing(ring, factor) {
  const c = ringCenter(ring)
  return ring.map((p) => ({
    lat: c.lat + (p.lat - c.lat) * factor,
    lng: c.lng + (p.lng - c.lng) * factor
  }))
}

/** 矩形：扩到刚好包住所有目标点位（留少量余量） */
export function expandRectRing(ring, targets, padMeters = 3) {
  if (!Array.isArray(targets) || !targets.length) return ring
  const b = boundsOfRing(ring)
  let { south, west, north, east } = b
  for (const p of targets) {
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
    west = Math.min(west, p.lng)
    east = Math.max(east, p.lng)
  }
  const padLat = padMeters / 111320
  const padLng = padMeters / (111320 * Math.cos((((south + north) / 2) * Math.PI) / 180))
  return ringFromBounds({
    south: south - padLat,
    north: north + padLat,
    west: west - padLng,
    east: east + padLng
  })
}

/** 多边形：逐步外扩，直到包含所有目标点位 */
export function expandRingToInclude(ring, targets, maxFactor = 2.5) {
  if (!Array.isArray(targets) || !targets.length) return ring
  for (let f = 1.05; f <= maxFactor; f += 0.05) {
    const scaled = scaleRing(ring, f)
    if (targets.every((p) => pointInRing(p.lat, p.lng, scaled))) return scaled
  }
  return scaleRing(ring, maxFactor)
}

/** 框选范围内的点位/物种分析 */
export function analyzeSelection(ring, points, visibleIds = new Set()) {
  const area = ring.length >= 3 ? ringAreaM2(ring) : 0
  const inside = []
  const nearby = []

  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const d = distanceToRingM(p.lat, p.lng, ring)
    if (d <= BOUNDARY_TOLERANCE_METERS || pointInRing(p.lat, p.lng, ring)) {
      inside.push(p)
    } else if (d <= NEARBY_METERS) {
      nearby.push(p)
    }
  }

  const bySpecies = new Map()
  for (const p of inside) {
    const s = p.species
    if (!s) continue
    let item = bySpecies.get(s.id)
    if (!item) {
      item = {
        id: s.id,
        nameCn: s.nameCn,
        family: s.family,
        bloomText: s.bloomText,
        habit: s.habit,
        count: 0,
        matched: visibleIds.has(s.id),
        points: []
      }
      bySpecies.set(s.id, item)
    }
    item.count += 1
    item.points.push(p)
  }

  const species = [...bySpecies.values()].sort((a, b) => {
    if (a.matched !== b.matched) return Number(b.matched) - Number(a.matched)
    if (a.count !== b.count) return b.count - a.count
    return a.nameCn.localeCompare(b.nameCn, 'zh')
  })

  return {
    area,
    shape: ringShape(ring),
    inside,
    nearby,
    count: inside.length,
    species,
    speciesCount: species.length,
    matchedCount: inside.filter((p) => visibleIds.has(p.species?.id)).length,
    matchedSpeciesCount: species.filter((s) => s.matched).length,
    nearbyCount: nearby.length,
    nearbySpeciesCount: new Set(nearby.map((p) => p.species?.id)).size,
    families: new Set(species.map((s) => s.family)).size
  }
}

/** 根据范围形态与植物构成推荐用地类型 */
export function guessLanduse(analysis, ring) {
  const area = analysis.area
  const count = analysis.count
  const shape = ringShape(ring)
  const treeCount = analysis.inside.filter((p) => categoryOf(p.species) === '乔木').length
  const treeShare = count ? treeCount / count : 0

  if (!count) {
    if (area >= 2500) return { value: '草坪', reason: '范围内暂无记录，按面积推荐草坪' }
    return { value: '花坛', reason: '范围内暂无记录，按面积推荐花坛' }
  }
  if (area > 0 && area < 180) {
    return { value: '花坛', reason: '面积较小，建议按花坛记录' }
  }
  if (shape.ratio >= 3.2 && treeShare >= 0.35) {
    return { value: '行道树', reason: '范围狭长且以乔木为主，建议行道树' }
  }
  if (treeShare >= 0.55) {
    const perPoint = count ? area / count : Infinity
    if (count >= 4 && perPoint <= 800) {
      return { value: '密林', reason: '乔木占比高、点位较密，建议密林' }
    }
    return { value: '疏林', reason: '以乔木为主但点位较疏，建议疏林' }
  }
  if (treeShare >= 0.25) {
    return { value: '疏林', reason: '范围内有部分乔木，建议疏林' }
  }
  return { value: '草坪', reason: '以草本或灌木为主，建议草坪' }
}

export function colorOfLanduse(landuse) {
  return LANDUSE_OPTIONS.find((o) => o.value === landuse)?.color || LANDUSE_OPTIONS[2].color
}

/** 用范围内最常见的地名生成地块名称 */
export function suggestPlotName(analysis, plots = []) {
  const counts = new Map()
  for (const p of analysis.inside) {
    if (!p.location) continue
    counts.set(p.location, (counts.get(p.location) || 0) + 1)
  }
  let location = ''
  let best = 0
  for (const [name, n] of counts) {
    if (n > best) {
      best = n
      location = name
    }
  }
  if (!location) {
    for (const p of analysis.nearby) {
      if (p.location) {
        location = p.location
        break
      }
    }
  }
  if (!location) return `框选地块 ${plots.length + 1}`
  return location.includes('地块') ? location : `${location}地块`
}

/** 智能推荐：名称 / 类型 / 颜色 / 优势物种 */
export function suggestPlotMeta(analysis, ring, plots = []) {
  const landuse = guessLanduse(analysis, ring)
  const name = suggestPlotName(analysis, plots)
  const dominantSpecies = analysis.species.slice(0, 3).map((s) => s.nameCn)
  return {
    name,
    landuse: landuse.value,
    color: colorOfLanduse(landuse.value),
    reason: landuse.reason,
    dominantSpecies
  }
}

/** 下一个可用编号（Z-01、Z-02…） */
export function nextPlotId(plots = []) {
  let max = 0
  for (const p of plots) {
    const m = /^Z-(\d+)$/i.exec(String(p?.plotId || '').trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `Z-${String(max + 1).padStart(2, '0')}`
}

function isHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

/** 把任意来源的地块数据规范化为内部结构；不合法返回 null */
export function normalizePlot(raw, fallbackId = '') {
  if (!raw || !Array.isArray(raw.polygon)) return null
  const ring = []
  for (const item of raw.polygon) {
    if (!Array.isArray(item) || item.length < 2) continue
    const lng = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    ring.push({ lng: round6(lng), lat: round6(lat) })
  }
  if (ring.length < 3) return null

  const center =
    Array.isArray(raw.center) && raw.center.length >= 2
      ? { lng: round6(Number(raw.center[0])), lat: round6(Number(raw.center[1])) }
      : ringCenter(ring)
  const landuse = LANDUSE_OPTIONS.some((o) => o.value === raw.landuse) ? raw.landuse : '草坪'
  const now = new Date().toISOString()

  return {
    plotId: String(raw.plotId || fallbackId || '').trim() || fallbackId,
    name: String(raw.name || '').trim() || '未命名地块',
    landuse,
    color: isHexColor(raw.color) ? raw.color : colorOfLanduse(landuse),
    polygon: ring.map((p) => [p.lng, p.lat]),
    center: [center.lng, center.lat],
    dominantSpecies: Array.isArray(raw.dominantSpecies)
      ? raw.dominantSpecies.filter((s) => typeof s === 'string' && s.trim()).slice(0, 6)
      : [],
    areaSize: Math.round(ringAreaM2(ring)),
    note: String(raw.note || ''),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  }
}

/** 导入合并：编号相同覆盖，不同追加 */
export function mergePlots(existing, incoming) {
  const list = Array.isArray(existing) ? existing.slice() : []
  const data = Array.isArray(incoming) ? incoming : [incoming]
  let added = 0
  let replaced = 0
  let skipped = 0

  for (const raw of data) {
    const plot = normalizePlot(raw)
    if (!plot) {
      skipped += 1
      continue
    }
    if (!plot.plotId) plot.plotId = nextPlotId(list)
    const idx = list.findIndex((p) => p.plotId === plot.plotId)
    if (idx >= 0) {
      list[idx] = plot
      replaced += 1
    } else {
      list.push(plot)
      added += 1
    }
  }
  return { list, added, replaced, skipped }
}

/** 读取本浏览器保存的地块 */
export function loadPlots() {
  try {
    const raw = localStorage.getItem(PLOT_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.map((item, i) => normalizePlot(item, `Z-${String(i + 1).padStart(2, '0')}`)).filter(Boolean)
  } catch (e) {
    console.warn('读取地块失败', e)
    return []
  }
}

/** 保存地块；返回是否成功 */
export function persistPlots(list) {
  try {
    localStorage.setItem(PLOT_STORAGE_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    console.warn('保存地块失败', e)
    return false
  }
}

/** 面积文案 */
export function formatArea(m2) {
  if (!Number.isFinite(m2) || m2 <= 0) return '—'
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} 万㎡`
  return `${Math.round(m2)} ㎡`
}

/** 尺寸文案：42 × 18 m */
export function formatSize(shape) {
  if (!shape || !shape.width || !shape.height) return ''
  return `${Math.round(shape.width)} × ${Math.round(shape.height)} m`
}
