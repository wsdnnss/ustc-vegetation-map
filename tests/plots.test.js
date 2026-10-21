import { describe, expect, it } from 'vitest'
import {
  analyzeSelection,
  boundsOfRing,
  distanceToRingM,
  expandRectRing,
  expandRingToInclude,
  formatArea,
  guessLanduse,
  mergePlots,
  nextPlotId,
  normalizePlot,
  pointInRing,
  ringAreaM2,
  ringCenter,
  ringFromBounds,
  ringShape,
  suggestPlotName
} from '../src/utils/plots.js'

const square = [
  { lat: 31.84, lng: 117.26 },
  { lat: 31.84, lng: 117.261 },
  { lat: 31.841, lng: 117.261 },
  { lat: 31.841, lng: 117.26 }
]

function point(lat, lng, id, nameCn, family, habit, location) {
  return {
    lat,
    lng,
    location,
    pointIndex: 0,
    species: { id, nameCn, family, habit, bloomText: '4–5 月' }
  }
}

describe('框选几何', () => {
  it('面积与中心点：约 94 m × 111 m 的矩形', () => {
    const area = ringAreaM2(square)
    expect(area).toBeGreaterThan(10000)
    expect(area).toBeLessThan(11000)

    const c = ringCenter(square)
    expect(c.lat).toBeCloseTo(31.8405, 5)
    expect(c.lng).toBeCloseTo(117.2605, 5)
  })

  it('点在多边形内 / 边界距离', () => {
    expect(pointInRing(31.8405, 117.2605, square)).toBe(true)
    expect(pointInRing(31.842, 117.2605, square)).toBe(false)

    // 边界偏南 11 m
    const outside = { lat: 31.8399, lng: 117.2605 }
    expect(pointInRing(outside.lat, outside.lng, square)).toBe(false)
    expect(distanceToRingM(outside.lat, outside.lng, square)).toBeGreaterThan(9)
    expect(distanceToRingM(outside.lat, outside.lng, square)).toBeLessThan(13)
  })

  it('外接矩形尺寸与狭长度', () => {
    const shape = ringShape(square)
    expect(shape.width).toBeGreaterThan(90)
    expect(shape.height).toBeGreaterThan(105)
    expect(shape.ratio).toBeGreaterThan(1)
    expect(shape.ratio).toBeLessThan(1.3)
  })

  it('矩形边界与四点顺序', () => {
    const ring = ringFromBounds({ south: 31.84, west: 117.26, north: 31.841, east: 117.261 })
    expect(ring).toHaveLength(4)
    expect(ring[0]).toEqual({ lat: 31.84, lng: 117.26 })
    expect(ring[2]).toEqual({ lat: 31.841, lng: 117.261 })
    expect(boundsOfRing(ring)).toEqual({ south: 31.84, west: 117.26, north: 31.841, east: 117.261 })
  })
})

describe('框选分析', () => {
  const points = [
    point(31.8405, 117.2605, 'sp001', '香樟', '樟科', '常绿乔木', '中区北门主干道'),
    point(31.8406, 117.2606, 'sp002', '悬铃木', '悬铃木科', '落叶乔木', '中区北门主干道'),
    point(31.8405, 117.2604, 'sp001', '香樟', '樟科', '常绿乔木', '中区北门主干道'),
    // 边界外约 11 m
    point(31.8399, 117.2605, 'sp003', '紫薇', '千屈菜科', '落叶灌木或小乔木', '中区北门主干道')
  ]

  it('区分范围内、边界外近旁的点', () => {
    const result = analyzeSelection(square, points, new Set(['sp001']))
    expect(result.count).toBe(3)
    expect(result.speciesCount).toBe(2)
    expect(result.nearbyCount).toBe(1)
    expect(result.matchedSpeciesCount).toBe(1)
    expect(result.species[0].nameCn).toBe('香樟')
    expect(result.species[0].matched).toBe(true)
    expect(result.species[0].count).toBe(2)
  })

  it('近旁点位可一键纳入矩形与多边形', () => {
    const target = { lat: 31.8399, lng: 117.2605 }
    const rect = expandRectRing(square, [target])
    expect(pointInRing(target.lat, target.lng, rect)).toBe(true)

    const poly = expandRingToInclude(square, [target])
    expect(pointInRing(target.lat, target.lng, poly)).toBe(true)
  })
})

describe('智能建议', () => {
  it('狭长且乔木为主推荐行道树', () => {
    const line = [
      { lat: 31.84, lng: 117.26 },
      { lat: 31.84, lng: 117.262 },
      { lat: 31.8402, lng: 117.262 },
      { lat: 31.8402, lng: 117.26 }
    ]
    const pts = [
      point(31.84005, 117.2605, 'a', '香樟', '樟科', '常绿乔木', ''),
      point(31.8401, 117.261, 'b', '悬铃木', '悬铃木科', '落叶乔木', '')
    ]
    const analysis = analyzeSelection(line, pts)
    expect(guessLanduse(analysis, line).value).toBe('行道树')
  })

  it('乔木密集推荐密林，草本为主推荐草坪', () => {
    const dense = [
      { lat: 31.84, lng: 117.26 },
      { lat: 31.84, lng: 117.2605 },
      { lat: 31.84045, lng: 117.2605 },
      { lat: 31.84045, lng: 117.26 }
    ]
    const trees = [
      point(31.8401, 117.2601, 'a', '香樟', '樟科', '常绿乔木', ''),
      point(31.8402, 117.2602, 'b', '银杏', '银杏科', '落叶乔木', ''),
      point(31.8403, 117.2603, 'c', '水杉', '柏科', '落叶乔木', ''),
      point(31.84035, 117.26015, 'd', '桂花', '木犀科', '常绿乔木', '')
    ]
    const denseResult = analyzeSelection(dense, trees)
    expect(guessLanduse(denseResult, dense).value).toBe('密林')

    const grass = {
      lat: 31.8402,
      lng: 117.2602,
      location: '',
      pointIndex: 0,
      species: { id: 'g', nameCn: '二月兰', family: '十字花科', habit: '草本', bloomText: '3–5 月' }
    }
    const grassResult = analyzeSelection(dense, [grass])
    expect(guessLanduse(grassResult, dense).value).toBe('草坪')
  })

  it('用地名生成地块名称', () => {
    const pts = [
      point(31.8405, 117.2605, 'a', '香樟', '樟科', '常绿乔木', '中区北门主干道'),
      point(31.8406, 117.2606, 'b', '紫薇', '千屈菜科', '落叶灌木', '中区北门主干道'),
      point(31.8404, 117.2604, 'c', '桂花', '木犀科', '常绿乔木', '中区中心花园')
    ]
    const result = analyzeSelection(square, pts)
    expect(suggestPlotName(result, [])).toBe('中区北门主干道地块')
  })

  it('面积文案', () => {
    expect(formatArea(0)).toBe('—')
    expect(formatArea(860)).toBe('860 ㎡')
    expect(formatArea(23500)).toBe('2.35 万㎡')
  })
})

describe('地块存储与导入', () => {
  const sample = {
    plotId: 'Z-01',
    name: '绿化带01',
    landuse: '行道树',
    color: '#2E7D32',
    polygon: [
      [117.261847, 31.838283],
      [117.26218, 31.838629],
      [117.262319, 31.838639],
      [117.262298, 31.838256],
      [117.261847, 31.838292]
    ],
    center: [117.262098, 31.83842],
    dominantSpecies: [],
    areaSize: 1126
  }

  it('兼容 plots.json 结构并重算面积', () => {
    const plot = normalizePlot(sample)
    expect(plot.plotId).toBe('Z-01')
    expect(plot.polygon).toHaveLength(5)
    expect(plot.areaSize).toBeGreaterThan(1000)
    expect(plot.areaSize).toBeLessThan(1300)
    expect(plot.color).toBe('#2E7D32')
  })

  it('编号自动递增', () => {
    expect(nextPlotId([])).toBe('Z-01')
    expect(nextPlotId([{ plotId: 'Z-03' }, { plotId: 'Z-07' }])).toBe('Z-08')
  })

  it('导入合并：同编号覆盖、新编号追加、非法记录跳过', () => {
    const existing = [{ ...sample, name: '旧名称' }]
    const incoming = [
      { ...sample, name: '新名称' },
      { ...sample, plotId: 'Z-02', name: '新增' },
      { plotId: 'bad', polygon: [[1, 2]] }
    ]
    const result = mergePlots(existing, incoming)
    expect(result.list).toHaveLength(2)
    expect(result.added).toBe(1)
    expect(result.replaced).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.list.find((p) => p.plotId === 'Z-01').name).toBe('新名称')
  })
})
