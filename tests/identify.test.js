import { describe, expect, it } from 'vitest'
import {
  buildLibraryIndex,
  confidenceLabel,
  GENUS_DISCOUNT,
  matchLibrary,
  normalizeBinomial,
  rankLibraryCandidates
} from '../src/utils/identify.js'

/** 测试用的小型物种库，避免依赖完整数据 */
const LIB = [
  { id: 'a', nameCn: '香樟', nameLatin: 'Cinnamomum camphora', family: '樟科', habit: '常绿乔木' },
  { id: 'b', nameCn: '广玉兰', nameLatin: 'Magnolia grandiflora', family: '木兰科', habit: '常绿乔木' },
  { id: 'c', nameCn: '白玉兰', nameLatin: 'Magnolia denudata', family: '木兰科', habit: '落叶乔木' },
  {
    id: 'd',
    nameCn: '日本晚樱',
    nameLatin: 'Cerasus serrulata var. lannesiana',
    family: '蔷薇科',
    habit: '落叶乔木'
  },
  { id: 'e', nameCn: '银杏', nameLatin: 'Ginkgo biloba', family: '银杏科', habit: '落叶乔木' }
]

const CLASSES = [
  { i: 0, g: 'Cinnamomum', s: 'camphora', f: 'Lauraceae' },
  { i: 1, g: 'Magnolia', s: 'grandiflora', f: 'Magnoliaceae' },
  { i: 2, g: 'Magnolia', s: 'virginiana', f: 'Magnoliaceae' },
  { i: 3, g: 'Prunus', s: 'serrulata', f: 'Rosaceae' },
  { i: 4, g: 'Quercus', s: 'robur', f: 'Fagaceae' }
]

describe('学名归一化', () => {
  it('压缩命名人、变种与园艺品种', () => {
    expect(normalizeBinomial('Cerasus serrulata var. lannesiana')).toBe('cerasus serrulata')
    expect(normalizeBinomial('Ginkgo biloba L.')).toBe('ginkgo biloba')
    expect(normalizeBinomial('Photinia × fraseri')).toBe('photinia fraseri')
    expect(normalizeBinomial("Prunus persica 'Duplex'")).toBe('prunus persica')
  })

  it('空值与单名不报错', () => {
    expect(normalizeBinomial('')).toBe('')
    expect(normalizeBinomial('Rosa')).toBe('rosa')
  })
})

describe('模型类别与物种库匹配', () => {
  const index = buildLibraryIndex(LIB)

  it('精确匹配拉丁名', () => {
    const hit = matchLibrary({ genus: 'Cinnamomum', species: 'camphora' }, index)
    expect(hit?.species.nameCn).toBe('香樟')
    expect(hit?.matchedBy).toBe('name')
  })

  it('通过属名同物异名匹配', () => {
    const hit = matchLibrary({ genus: 'Prunus', species: 'serrulata' }, index)
    expect(hit?.species.nameCn).toBe('日本晚樱')
    expect(hit?.matchedBy).toBe('synonym')
  })

  it('物种库未收录时返回 null', () => {
    expect(matchLibrary({ genus: 'Quercus', species: 'robur' }, index)).toBeNull()
  })
})

describe('只在物种库内排序候选', () => {
  const index = buildLibraryIndex(LIB)

  it('直匹配优先，同属物种按库外同属类别折扣得到参考分', () => {
    const logits = new Float32Array([5, 3, 1, 2, 0])
    const out = rankLibraryCandidates(logits, CLASSES, index, { topK: 5 })

    expect(out.map((x) => x.nameCn)).toEqual(['香樟', '广玉兰', '日本晚樱', '白玉兰'])
    expect(out[0].match).toBe('name')
    expect(out[2].match).toBe('synonym')
    expect(out[3].match).toBe('genus')
    // 白玉兰的参考分来自库外的 Magnolia virginiana，而不是广玉兰的概率
    expect(out[3].confidence).toBeLessThan(out[1].confidence * GENUS_DISCOUNT)
  })

  it('不会返回物种库之外的植物', () => {
    const logits = new Float32Array([5, 3, 1, 2, 0])
    const out = rankLibraryCandidates(logits, CLASSES, index, { topK: 5 })
    const ids = new Set(LIB.map((s) => s.id))
    expect(out.every((x) => ids.has(x.speciesId))).toBe(true)
    expect(out.some((x) => x.nameCn === '银杏')).toBe(false)
  })

  it('模型类别全都对不上物种库时返回空', () => {
    const logits = new Float32Array([2, 1])
    const out = rankLibraryCandidates(
      logits,
      [
        { i: 0, g: 'Quercus', s: 'robur', f: 'Fagaceae' },
        { i: 1, g: 'Picea', s: 'abies', f: 'Pinaceae' }
      ],
      index
    )
    expect(out).toEqual([])
  })

  it('遵循 topK 截断', () => {
    const out = rankLibraryCandidates(new Float32Array([5, 3, 1, 2, 0]), CLASSES, index, { topK: 2 })
    expect(out).toHaveLength(2)
  })
})

describe('置信度文案', () => {
  it('按阈值给出不同措辞', () => {
    expect(confidenceLabel(0.8)).toBe('较有把握')
    expect(confidenceLabel(0.3)).toBe('可能')
    expect(confidenceLabel(0.05)).toBe('仅供参考')
  })
})
