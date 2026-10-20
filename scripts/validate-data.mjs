/**
 * 数据校验：检查物种库的结构、坐标范围、重复点位等问题。
 * 用法：pnpm run validate:data [--strict]
 * --strict 时警告也视为失败。
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const file = path.join(root, 'src/data/species.json')
const strict = process.argv.includes('--strict')

const errors = []
const warnings = []

function error(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
}

function haversine(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const raw = await fsp.readFile(file, 'utf8')
const data = JSON.parse(raw.replace(/^\uFEFF/, ''))
const meta = data.meta || {}
const species = Array.isArray(data.species) ? data.species : []

if (!species.length) error('species 为空或不是数组')
if (!meta.bounds) error('meta.bounds 缺失，无法校验点位范围')

const bounds = meta.bounds || {}
const inside = (p) =>
  p.lat >= bounds.south &&
  p.lat <= bounds.north &&
  p.lng >= bounds.west &&
  p.lng <= bounds.east

const ids = new Set()
let pointCount = 0
let recorded = 0
let candidate = 0

for (const s of species) {
  const id = s.id || '(无 id)'
  if (!s.id) error(`${s.nameCn || '(无中文名)'} 缺少 id`)
  if (s.id && ids.has(s.id)) error(`重复的物种 id：${s.id}`)
  if (s.id) ids.add(s.id)

  if (!s.nameCn) error(`${id} 缺少 nameCn`)
  if (!s.nameLatin) error(`${id} 缺少 nameLatin`)
  if (!s.family) error(`${id} 缺少 family`)
  if (!s.habit) error(`${id} 缺少 habit`)

  if (!['已记录', '待核实'].includes(s.status)) {
    error(`${id} 的 status 非法：${s.status}`)
  }

  if (!Array.isArray(s.bloomMonths)) {
    error(`${id} 的 bloomMonths 不是数组`)
  } else {
    for (const m of s.bloomMonths) {
      if (!Number.isInteger(m) || m < 0 || m > 12) {
        error(`${id} 的花期月份非法：${m}`)
      }
    }
  }

  const points = Array.isArray(s.points) ? s.points : []
  if (points.length) recorded += 1
  else candidate += 1

  if (s.status === '已记录' && !points.length) {
    error(`${id}（${s.nameCn}）status=已记录 但没有 points`)
  }
  if (s.status === '待核实' && points.length) {
    warn(`${id}（${s.nameCn}）status=待核实 但已有 ${points.length} 个点位，建议改为已记录`)
  }

  points.forEach((p, i) => {
    pointCount += 1
    const label = `${id}（${s.nameCn}）第 ${i + 1} 个点位`
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      error(`${label} 经纬度无效`)
      return
    }
    if (!p.location) warn(`${label} 缺少 location 描述`)
    if (meta.bounds && !inside(p)) {
      error(`${label} 超出校园范围：${p.lat}, ${p.lng}`)
    }
    if (p.source && !['实地调查', '示例坐标', '公开资料整理'].includes(p.source)) {
      warn(`${label} 的 source 未识别：${p.source}`)
    }
  })

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (!Number.isFinite(points[i].lat) || !Number.isFinite(points[j].lat)) continue
      const distance = haversine(points[i], points[j])
      if (distance < 50) {
        warn(
          `${id}（${s.nameCn}）第 ${i + 1} 与第 ${j + 1} 个点位相距仅 ${distance.toFixed(
            1
          )} m，可能重复`
        )
      }
    }
  }
}

console.log(`数据文件：${file}`)
console.log(
  `物种 ${species.length} 种（已记录 ${recorded} / 待核实 ${candidate}），分布点 ${pointCount} 个`
)

if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条：`)
  warnings.forEach((w) => console.log(`  ! ${w}`))
}
if (errors.length) {
  console.log(`\n错误 ${errors.length} 条：`)
  errors.forEach((e) => console.log(`  x ${e}`))
}

if (errors.length || (strict && warnings.length)) {
  console.log('\n校验未通过')
  process.exit(1)
}

console.log('\n校验通过')
