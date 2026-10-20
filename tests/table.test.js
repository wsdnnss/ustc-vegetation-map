import { describe, expect, it } from 'vitest'
import { mapRows, normKey, parseTable } from '../src/utils/table.js'

describe('表格解析', () => {
  it('识别表头并映射字段（TAB 分隔）', () => {
    const text = [
      '物种\t纬度\t经度\t备注\t照片文件名\t采集人',
      '香樟\t31.8395\t117.262\t东门\tIMG_0001.jpg\t张三'
    ].join('\n')
    const parsed = parseTable(text)
    expect(parsed.headers).toHaveLength(6)

    const rows = mapRows(parsed)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: '香樟',
      lat: 31.8395,
      lng: 117.262,
      note: '东门',
      photo: 'IMG_0001.jpg',
      collector: '张三'
    })
  })

  it('支持表头别名（中文名 / lat / lng / 调查人）', () => {
    const text = ['中文名,lat,lng,说明,图片,调查人', '银杏,31.8394,117.2632,中心花园,a.jpg,李四'].join(
      '\n'
    )
    const rows = mapRows(parseTable(text))
    expect(rows[0]).toMatchObject({
      name: '银杏',
      lat: 31.8394,
      lng: 117.2632,
      note: '中心花园',
      collector: '李四'
    })
  })

  it('无表头时按固定列顺序解析', () => {
    const rows = mapRows(parseTable('水杉,31.8384,117.2588,西侧绿地,c.jpg,王五'))
    expect(rows[0]).toMatchObject({
      name: '水杉',
      lat: 31.8384,
      lng: 117.2588,
      photo: 'c.jpg'
    })
  })

  it('支持引号包裹的逗号与转义引号', () => {
    const text = '物种,纬度,经度,备注,照片,采集人\n香樟,31.8,117.2,"东门, 北侧",a.jpg,张三'
    const rows = mapRows(parseTable(text))
    expect(rows[0].note).toBe('东门, 北侧')

    const escaped = '物种,纬度,经度,备注\n香樟,31.8,117.2,"他说""很高"""'
    expect(mapRows(parseTable(escaped))[0].note).toBe('他说"很高"')
  })

  it('非法数字返回 NaN，由预览层拦截', () => {
    const rows = mapRows(parseTable('物种,纬度,经度\n香樟,abc,117.2'))
    expect(Number.isNaN(rows[0].lat)).toBe(true)
  })

  it('文件名归一化：去扩展名、转小写、去空格', () => {
    expect(normKey(' IMG_0001.JPG ')).toBe('img_0001')
    expect(normKey('a.b.png')).toBe('a.b')
    expect(normKey('')).toBe('')
  })
})
