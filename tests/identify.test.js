import { describe, expect, it } from 'vitest'
import {
  buildLibraryIndex,
  confidenceLabel,
  decorateCandidates,
  matchLibrary,
  normalizeBinomial,
  topPlantCandidates
} from '../src/utils/identify.js'

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
  const index = buildLibraryIndex()

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

describe('候选提取', () => {
  it('只返回概率最高的若干植物类别，且按置信度降序', () => {
    const logits = new Float32Array([1, 5, 3, 0])
    const classes = [
      { i: 0, g: 'Cinnamomum', s: 'camphora', f: 'Lauraceae' },
      { i: 1, g: 'Magnolia', s: 'grandiflora', f: 'Magnoliaceae' },
      { i: 2, g: 'Lagerstroemia', s: 'indica', f: 'Lythraceae' },
      { i: 3, g: 'Ginkgo', s: 'biloba', f: 'Ginkgoaceae' }
    ]
    const top = topPlantCandidates(logits, classes, 2)
    expect(top).toHaveLength(2)
    expect(top[0].s).toBe('grandiflora')
    expect(top[1].s).toBe('indica')
    expect(top[0].confidence).toBeGreaterThan(top[1].confidence)
    expect(top[0].confidence).toBeLessThanOrEqual(1)
  })

  it('忽略越界类别', () => {
    const top = topPlantCandidates(new Float32Array([2, 1]), [{ i: 9, g: 'A', s: 'b', f: 'C' }], 3)
    expect(top).toEqual([])
  })
})

describe('候选与物种库合并', () => {
  const index = buildLibraryIndex()

  it('补上中文名并按物种去重，保留较高置信度', () => {
    const list = decorateCandidates(
      [
        { g: 'Ilex', s: 'cornuta', f: 'Aquifoliaceae', confidence: 0.2 },
        { g: 'Ilex', s: 'cornuta', f: 'Aquifoliaceae', confidence: 0.35 },
        { g: 'Quercus', s: 'robur', f: 'Fagaceae', confidence: 0.3 }
      ],
      index
    )
    expect(list).toHaveLength(2)
    expect(list[0].nameCn).toBe('枸骨')
    expect(list[0].confidence).toBeCloseTo(0.35, 6)
    expect(list[0].inLibrary).toBe(true)
    expect(list.find((x) => x.latin === 'Quercus robur')?.inLibrary).toBe(false)
  })
})

describe('置信度文案', () => {
  it('按阈值给出不同措辞', () => {
    expect(confidenceLabel(0.8)).toBe('较有把握')
    expect(confidenceLabel(0.3)).toBe('可能')
    expect(confidenceLabel(0.05)).toBe('仅供参考')
  })
})
