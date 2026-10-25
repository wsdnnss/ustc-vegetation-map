import { speciesList } from '@/utils/species'

/**
 * 识别结果与本地物种库的匹配逻辑（纯函数，便于单元测试）。
 *
 * 模型输出为 iNaturalist 2021 的 10000 个类别，这里只保留物种库中的 229 种：
 * - 模型有同名/同物异名类别 → 直接使用该类别概率；
 * - 模型没有该物种，但有同属类别 → 用同属概率打折，作为「同属参考」；
 * - 两者都没有 → 该物种不参与排序，也不会出现在结果里。
 */

/** 属名同物异名：键为模型使用的属名，值为物种库中可能对应的属名 */
const GENUS_SYNONYMS = {
  prunus: ['cerasus', 'amygdalus'],
  magnolia: ['michelia'],
  styphnolobium: ['sophora']
}

/** 反向映射：物种库属名 → 模型属名 */
const MODEL_GENUS_OF = {
  cerasus: 'prunus',
  amygdalus: 'prunus',
  michelia: 'magnolia',
  sophora: 'styphnolobium'
}

/** 同属参考的置信度折扣：避免把「同属某种」的概率当成该物种的概率 */
export const GENUS_DISCOUNT = 0.3

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

  return { byBinom, bySynonym, species: list }
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

/** 该物种用于同属近似的模型属名（自身属名，或同物异名后的属名） */
function modelGenusOf(species) {
  const genus = normalizeBinomial(species.nameLatin).split(' ')[0]
  return MODEL_GENUS_OF[genus] || genus
}

/**
 * 仅在物种库 229 种内排序候选。
 *
 * @param {Float32Array|number[]} logits 模型原始输出（长度 10000）
 * @param {Array<{i:number,g:string,s:string,f:string}>} classes 植物类别表
 * @param {{byBinom:Map,bySynonym:Map,species:Array}} index 物种库索引
 * @param {{topK?: number}} options
 * @returns {Array<{speciesId:string,nameCn:string,latin:string,familyCn:string,habit:string,confidence:number,match:'name'|'synonym'|'genus'}>}
 */
export function rankLibraryCandidates(logits, classes, index, { topK = 5 } = {}) {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i]
  if (!Number.isFinite(max)) return []

  let sum = 0
  const exps = new Float32Array(logits.length)
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - max)
    sum += exps[i]
  }
  if (!(sum > 0)) return []

  const direct = new Map() // speciesId → { score, match }
  const genusMax = new Map() // 模型属名 → 最大概率

  for (const c of classes) {
    if (c.i < 0 || c.i >= logits.length) continue
    const p = exps[c.i] / sum
    if (!(p > 0)) continue

    const hit = matchLibrary({ genus: c.g, species: c.s }, index)
    if (hit) {
      const prev = direct.get(hit.species.id)
      if (!prev || p > prev.score) direct.set(hit.species.id, { score: p, match: hit.matchedBy })
      // 该类别已归属库内某个物种，不再拿它的概率去给同属其他物种做参考
      continue
    }

    const genus = c.g.toLowerCase()
    const prevMax = genusMax.get(genus)
    if (prevMax === undefined || p > prevMax) genusMax.set(genus, p)
  }

  const out = []
  for (const s of index.species) {
    const found = direct.get(s.id)
    if (found && found.score > 0) {
      out.push({
        speciesId: s.id,
        nameCn: s.nameCn,
        latin: s.nameLatin,
        familyCn: s.family,
        habit: s.habit || '',
        confidence: found.score,
        match: found.match
      })
      continue
    }

    const genusProb = genusMax.get(modelGenusOf(s))
    if (genusProb > 0) {
      out.push({
        speciesId: s.id,
        nameCn: s.nameCn,
        latin: s.nameLatin,
        familyCn: s.family,
        habit: s.habit || '',
        confidence: genusProb * GENUS_DISCOUNT,
        match: 'genus'
      })
    }
  }

  out.sort((a, b) => b.confidence - a.confidence)
  return out.slice(0, topK)
}

/** 置信度分级文案，避免把模型概率说成确定结论 */
export function confidenceLabel(p) {
  if (p >= 0.5) return '较有把握'
  if (p >= 0.2) return '可能'
  return '仅供参考'
}

/** 最高候选概率过低时，提示可能不是植物或照片不够清晰 */
export const PLANT_CONFIDENCE_FLOOR = 0.08
