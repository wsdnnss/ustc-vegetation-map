/**
 * 合并多人导出的投稿 JSON，并按 id / 物种+坐标去重。
 * 用法：node scripts/merge-exports.mjs a.json b.json c.json
 * 输出：submissions-merged-YYYYMMDD.json（当前目录）
 */
import fsp from 'node:fs/promises'
import path from 'node:path'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法：node scripts/merge-exports.mjs 文件1.json 文件2.json ...')
  process.exit(1)
}

const all = []
for (const file of files) {
  const raw = await fsp.readFile(file, 'utf8')
  const data = JSON.parse(raw.replace(/^\uFEFF/, ''))
  if (!Array.isArray(data)) {
    console.error(`跳过 ${file}：内容不是投稿数组`)
    continue
  }
  all.push(...data)
  console.log(`${file}: ${data.length} 条`)
}

function geoKeyOf(item) {
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return [
    (item.name || '').trim(),
    Number.isFinite(lat) ? lat.toFixed(5) : '',
    Number.isFinite(lng) ? lng.toFixed(5) : '',
    (item.note || '').trim()
  ].join('|')
}

const merged = []
const byId = new Map()
const byGeo = new Map()
let duplicate = 0

for (const item of all) {
  const idKey = item.id ? `id:${item.id}` : ''
  const geoKey = geoKeyOf(item)
  const existing = (idKey && byId.get(idKey)) || byGeo.get(geoKey) || null

  if (!existing) {
    merged.push(item)
    byGeo.set(geoKey, item)
    if (idKey) byId.set(idKey, item)
    continue
  }

  duplicate += 1
  // 重复项里优先保留带照片的那条
  if (!existing.image && item.image) existing.image = item.image
  // 让后续的同 id / 同坐标记录都能命中同一条
  byGeo.set(geoKey, existing)
  if (idKey) byId.set(idKey, existing)
}

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const outFile = path.resolve(`submissions-merged-${stamp}.json`)
await fsp.writeFile(outFile, JSON.stringify(merged, null, 2), 'utf8')

console.log(`\n合并完成：输入 ${all.length} 条，去重 ${duplicate} 条，输出 ${merged.length} 条`)
console.log(`已写入：${outFile}`)
