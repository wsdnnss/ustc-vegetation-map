import { describe, expect, it } from 'vitest'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../src/utils/coord.js'

function distance(a, b) {
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

describe('坐标转换', () => {
  it('GCJ-02 与 WGS-84 往返误差小于 1 米', () => {
    const gcj = { lng: 117.2623, lat: 31.839 }
    const [wl, wa] = gcj02ToWgs84(gcj.lng, gcj.lat)
    const [gl, ga] = wgs84ToGcj02(wl, wa)
    const delta = distance(gcj, { lng: gl, lat: ga })
    expect(delta).toBeLessThan(1)
  })

  it('合肥附近偏移量在 300–900 米之间', () => {
    const gcj = { lng: 117.2623, lat: 31.839 }
    const [wl, wa] = gcj02ToWgs84(gcj.lng, gcj.lat)
    const delta = distance(gcj, { lng: wl, lat: wa })
    expect(delta).toBeGreaterThan(300)
    expect(delta).toBeLessThan(900)
  })

  it('境外坐标原样返回', () => {
    expect(gcj02ToWgs84(2.3522, 48.8566)).toEqual([2.3522, 48.8566])
    expect(wgs84ToGcj02(2.3522, 48.8566)).toEqual([2.3522, 48.8566])
  })

  it('转换结果保持经度在前、纬度在后', () => {
    const [lng, lat] = gcj02ToWgs84(117.2623, 31.839)
    expect(lng).toBeGreaterThan(117)
    expect(lat).toBeLessThan(32)
  })
})
