import { describe, expect, it } from 'vitest'
import {
  speciesList,
  allPoints,
  bloomsIn,
  categoryOf,
  dataLevelOf,
  pointAccuracyText,
  recordedCount,
  searchText,
  fruitMonthsOf,
  fruitsIn,
  seasonOf,
  SEASONS,
  metersBetween,
  groupPointsByLocation,
  samePlaceName
} from '../src/utils/species.js'

describe('物种数据与筛选', () => {
  it('物种库非空且 id 唯一', () => {
    expect(speciesList.length).toBeGreaterThan(0)
    const ids = speciesList.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('已记录物种都有点位，待核实物种都没有点位', () => {
    for (const s of speciesList) {
      const count = (s.points || []).length
      if (s.status === '已记录') expect(count).toBeGreaterThan(0)
      if (s.status === '待核实') expect(count).toBe(0)
    }
  })

  it('allPoints 拉平的点位数与原始数据一致', () => {
    const expected = speciesList.reduce((sum, s) => sum + (s.points || []).length, 0)
    expect(allPoints()).toHaveLength(expected)
    expect(recordedCount()).toBe(speciesList.filter((s) => (s.points || []).length).length)
  })

  it('类别由 habit 推导，顺序敏感', () => {
    expect(categoryOf({ habit: '常绿乔木' })).toBe('乔木')
    expect(categoryOf({ habit: '落叶灌木或小乔木' })).toBe('灌木')
    expect(categoryOf({ habit: '水生草本' })).toBe('水生')
    expect(categoryOf({ habit: '竹类' })).toBe('竹类')
    expect(categoryOf({ habit: '蕨类植物' })).toBe('蕨类')
    expect(categoryOf({ habit: '木质藤本' })).toBe('藤本')
    expect(categoryOf({ habit: '未知' })).toBe('其他')
  })

  it('花期筛选：0 表示不开花，不命中任何月份', () => {
    expect(bloomsIn({ bloomMonths: [4, 5] }, 4)).toBe(true)
    expect(bloomsIn({ bloomMonths: [4, 5] }, 6)).toBe(false)
    expect(bloomsIn({ bloomMonths: [4, 5] }, '')).toBe(true)
    expect(bloomsIn({ bloomMonths: [0] }, 1)).toBe(false)
  })

  it('检索文本包含中文名、学名、别名与识别特征', () => {
    const sp = {
      nameCn: '香樟',
      nameLatin: 'Cinnamomum camphora',
      alias: ['樟树'],
      identify: '叶片揉碎有樟脑香',
      family: '樟科',
      genus: '樟属',
      tags: ['常绿'],
      description: '常见行道树',
      nameOrigin: ''
    }
    const text = searchText(sp)
    expect(text).toContain('香樟')
    expect(text).toContain('cinnamomum camphora')
    expect(text).toContain('樟树')
    expect(text).toContain('樟脑香')
  })

  it('数据分级：无点为公开资料，有点为示例坐标，带实测标记为实地调查', () => {
    expect(dataLevelOf({ points: [] }).key).toBe('candidate')
    expect(dataLevelOf({ points: [{ lat: 31.8, lng: 117.2 }] }).key).toBe('example')
    expect(
      dataLevelOf({ points: [{ lat: 31.8, lng: 117.2, source: '实地调查' }] }).key
    ).toBe('measured')
    expect(
      dataLevelOf({ points: [{ lat: 31.8, lng: 117.2, measured: true }] }).key
    ).toBe('measured')
  })

  it('点位精度文案：默认提示示例坐标', () => {
    expect(pointAccuracyText({ lat: 31.8, lng: 117.2 })).toContain('示例坐标')
    expect(pointAccuracyText({ source: '实地调查', coordAccuracy: '±3 m' })).toBe('±3 m')
  })

  it('果期解析：区间展开，无具体月份的文案返回空数组', () => {
    expect(fruitMonthsOf({ fruitText: '8–11 月' })).toEqual([8, 9, 10, 11])
    expect(fruitMonthsOf({ fruitText: '次年 3–4 月' })).toEqual([3, 4])
    expect(fruitMonthsOf({ fruitText: '10 月' })).toEqual([10])
    expect(fruitMonthsOf({ fruitText: '次年成熟' })).toEqual([])
    expect(fruitMonthsOf({ fruitText: '少见结果' })).toEqual([])
    expect(fruitsIn({ fruitText: '8–11 月' }, 9)).toBe(true)
    expect(fruitsIn({ fruitText: '8–11 月' }, 5)).toBe(false)
    expect(fruitsIn({ fruitText: '8–11 月' }, '')).toBe(true)
  })

  it('季节划分覆盖 12 个月', () => {
    expect(SEASONS).toHaveLength(4)
    expect(seasonOf(4).key).toBe('spring')
    expect(seasonOf(7).key).toBe('summer')
    expect(seasonOf(10).key).toBe('autumn')
    expect(seasonOf(1).key).toBe('winter')
    expect(seasonOf(12).key).toBe('winter')
  })

  it('同位置点位合并：8 m 内归为一组，超出则分开', () => {
    const pts = [
      { lat: 31.8418, lng: 117.2624, name: '香樟' },
      { lat: 31.8418, lng: 117.2624, name: '悬铃木' },
      { lat: 31.839, lng: 117.2626, name: '广玉兰' },
      { lat: 31.8418, lng: 117.263, name: '银杏' }
    ]
    const groups = groupPointsByLocation(pts)
    expect(groups).toHaveLength(3)
    expect(groups[0].points.map((p) => p.name)).toEqual(['香樟', '悬铃木'])
    expect(groups[1].points.map((p) => p.name)).toEqual(['广玉兰'])
    expect(groups[2].points.map((p) => p.name)).toEqual(['银杏'])
    expect(groups.reduce((sum, g) => sum + g.points.length, 0)).toBe(pts.length)
  })

  it('距离计算：同点为 0，纬度 0.001° 约 111 m', () => {
    const a = { lat: 31.84, lng: 117.26 }
    expect(metersBetween(a, a)).toBe(0)
    const d = metersBetween(a, { lat: 31.841, lng: 117.26 })
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(115)
  })

  it('同一地名的不同写法（含括注细分）也算同一位置', () => {
    const pts = [
      { lat: 31.8388, lng: 117.2602, location: '中区景观水池畔', name: '荷花' },
      { lat: 31.8388, lng: 117.2602, location: '中区景观水池', name: '垂柳' },
      { lat: 31.8388, lng: 117.2608, location: '中区景观水池（西岸）', name: '睡莲' },
      { lat: 31.8418, lng: 117.2624, location: '中区北门主干道', name: '香樟' }
    ]
    const groups = groupPointsByLocation(pts)
    expect(groups).toHaveLength(2)
    expect(groups[0].points.map((p) => p.name)).toEqual(['荷花', '垂柳', '睡莲'])
    expect(groups[1].points.map((p) => p.name)).toEqual(['香樟'])
    expect(samePlaceName('中区景观水池（西岸）', '中区景观水池')).toBe(true)
    expect(samePlaceName('中区中心广场', '中区中心花园')).toBe(false)
  })
})
