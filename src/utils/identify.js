import { speciesList } from '@/utils/species'

/**
 * 识别结果与本地物种库的匹配逻辑（纯函数，便于单元测试）。
 *
 * 模型输出为 iNaturalist 2021 数据集的 10000 个类别，
 * 这里只使用其中的植物类别（约 4271 个），并把拉丁名映射回物种库。
 */

/**
 * 属名同物异名：键为模型使用的属名，值为物种库中可能对应的属名。
 * 例：物种库写 Cerasus serrulata，模型输出 Prunus serrulata。
 */
const GENUS_SYNONYMS = {
  prunus: ['cerasus', 'amygdalus'],
  magnolia: ['michelia'],
  styphnolobium: ['sophora']
}

/** 把带命名人、变种、园艺品种的学名压成「属 种」两个词 */
export function normalizeBinomial(name) {
  const words = String(name || '')
    .replace(/×/g, ' ')
    .replace(/['’][^'’]*['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (words.length < 2) return words.join(' ').toLowerCase()
  return `${words[0]} ${words[1]}`.toLowerCase()
}

/** 物种库索引：学名 → 物种；同物异名 → 物种 */
export function buildLibraryIndex(list = speciesList) {
  const byBinom = new Map()
  const bySynonym = new Map()

  for (const s of list) {
    const key = normalizeBinomial(s.nameLatin)
    if (!key) continue
    if (!byBinom.has(key)) byBinom.set(key, s)

    const [genus, epithet] = key.split(' ')
    if (!epithet) continue
    for (const [modelGenus, aliases] of Object.entries(GENUS_SYNONYMS)) {
      if (!aliases.includes(genus)) continue
      const alt = `${modelGenus} ${epithet}`
      if (!bySynonym.has(alt)) bySynonym.set(alt, s)
    }
  }

  return { byBinom, bySynonym }
}

/**
 * 把一个模型类别匹配到物种库。
 * 先按「属 种」精确匹配，再尝试属名同物异名；都不中则返回 null。
 */
export function matchLibrary(cls, index) {
  const key = normalizeBinomial(`${cls.genus} ${cls.species}`)
  const direct = index.byBinom.get(key)
  if (direct) return { species: direct, matchedBy: 'name' }

  const synonym = index.bySynonym.get(key)
  if (synonym) return { species: synonym, matchedBy: 'synonym' }
  return null
}

/**
 * 从模型 logits 中取出概率最高的若干植物类别。
 * @param {Float32Array|number[]} logits 长度 10000 的原始输出
 * @param {Array<{i:number,g:string,s:string,f:string}>} classes 植物类别表
 * @param {number} topK
 */
export function topPlantCandidates(logits, classes, topK = 5) {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i]
  if (!Number.isFinite(max)) return []

  let sum = 0
  for (let i = 0; i < logits.length; i++) sum += Math.exp(logits[i] - max)
  if (!(sum > 0)) return []

  const picked = []
  for (const c of classes) {
    if (c.i < 0 || c.i >= logits.length) continue
    const p = Math.exp(logits[c.i] - max) / sum
    if (!(p > 0)) continue
    if (picked.length < topK) {
      picked.push({ ...c, confidence: p })
      picked.sort((a, b) => b.confidence - a.confidence)
    } else if (p > picked[picked.length - 1].confidence) {
      picked[picked.length - 1] = { ...c, confidence: p }
      picked.sort((a, b) => b.confidence - a.confidence)
    }
  }
  return picked
}

/**
 * 给候选补上拉丁名、物种库信息，并按物种去重。
 * 同一物种在模型里可能有多个类别（如不同亚种），只保留置信度最高的一个。
 */
export function decorateCandidates(candidates, index) {
  const byKey = new Map()

  for (const c of candidates) {
    const latin = `${c.g} ${c.s}`
    const hit = matchLibrary({ genus: c.g, species: c.s }, index)
    const item = {
      latin,
      family: c.f,
      confidence: c.confidence,
      speciesId: hit?.species.id || '',
      nameCn: hit?.species.nameCn || '',
      familyCn: hit?.species.family || '',
      habit: hit?.species.habit || '',
      inLibrary: Boolean(hit),
      matchedBy: hit?.matchedBy || ''
    }
    const key = item.speciesId || latin.toLowerCase()
    const prev = byKey.get(key)
    if (!prev || item.confidence > prev.confidence) byKey.set(key, item)
  }

  return [...byKey.values()].sort((a, b) => b.confidence - a.confidence)
}

/** 置信度分级文案，避免把模型概率说成确定结论 */
export function confidenceLabel(p) {
  if (p >= 0.5) return '较有把握'
  if (p >= 0.2) return '可能'
  return '仅供参考'
}

/** 最高植物类别概率过低时，提示可能不是植物或照片不够清晰 */
export const PLANT_CONFIDENCE_FLOOR = 0.08
