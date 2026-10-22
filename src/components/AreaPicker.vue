<template>
  <div class="area-picker">
    <div ref="mapEl" class="area-map" :style="{ height }"></div>

    <div v-if="mode === 'area'" class="picker-tools" role="toolbar" aria-label="地块框选工具">
      <button
        type="button"
        class="ptool"
        :class="{ active: drawMode === 'rect' }"
        :aria-pressed="drawMode === 'rect'"
        @click="toggleDraw('rect')"
      >
        矩形框选
      </button>
      <button
        type="button"
        class="ptool"
        :class="{ active: drawMode === 'poly' }"
        :aria-pressed="drawMode === 'poly'"
        @click="toggleDraw('poly')"
      >
        多边形框选
      </button>
      <button v-if="drawMode" type="button" class="ptool close" aria-label="退出框选" @click="cancelDraw">
        ✕
      </button>
      <button v-else-if="hasPolygon" type="button" class="ptool clear" @click="clearPolygon">清除</button>
    </div>

    <p v-if="mode === 'area' && drawMode" class="picker-hint">{{ hint }}</p>
    <p v-else-if="mode === 'area' && hasPolygon" class="picker-area">
      已框选 <b>{{ areaText }}</b
      ><template v-if="centerText"> · 中心 {{ centerText }}</template>
    </p>

    <div
      v-if="live"
      class="picker-live"
      :style="{ left: `${live.x}px`, top: `${live.y}px` }"
    >
      {{ live.text }}
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import { campus } from '@/utils/species'
import { formatArea, ringAreaM2, ringCenter } from '@/utils/plots'

const props = defineProps({
  // point：单点位置；area：地块范围
  mode: { type: String, default: 'point' },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  // [[lng, lat], ...]，GCJ-02
  polygon: { type: Array, default: () => [] },
  height: { type: String, default: '280px' }
})

const emit = defineEmits(['change'])

const mapEl = ref(null)
const drawMode = ref('')
const live = ref(null)
const notice = ref('')
const draft = shallowRef([])
const shapeKind = shallowRef('poly')

let map = null
let pointMarker = null
let polygonLayer = null
let handleMarkers = []
let draggingIndex = -1
let previewRect = null
let draftShape = null
let draftMarkers = []
let draftCursor = null
let rectDrag = null
let noticeTimer = null

const polygonRing = computed(() => pairsToRing(props.polygon))
const hasPolygon = computed(() => polygonRing.value.length >= 3)
const areaText = computed(() =>
  hasPolygon.value ? formatArea(ringAreaM2(polygonRing.value)) : ''
)
const centerText = computed(() => {
  if (!hasPolygon.value) return ''
  const c = ringCenter(polygonRing.value)
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
})

const hint = computed(() => {
  if (notice.value) return notice.value
  if (drawMode.value === 'rect') return '按住鼠标拖动，框出地块范围'
  if (drawMode.value === 'poly') {
    return draft.value.length
      ? '继续点击添加顶点 · 双击/回车完成 · 点回起点闭合 · Backspace 撤销'
      : '沿地块边界依次点击 · 双击或回车完成'
  }
  return ''
})

function round5(n) {
  return Math.round(Number(n) * 1e5) / 1e5
}

function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6
}

function pairsToRing(polygon) {
  if (!Array.isArray(polygon)) return []
  const ring = []
  for (const item of polygon) {
    if (!Array.isArray(item) || item.length < 2) continue
    const lng = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    ring.push({ lat, lng })
  }
  return ring
}

function setNotice(text) {
  notice.value = text
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 2200)
}

function emitRing(ring) {
  if (!ring || ring.length < 3) return
  const pairs = ring.map((p) => [round6(p.lng), round6(p.lat)])
  // 用落库的 6 位小数坐标重算，保证面板、地图标签与存储里的面积一致
  const rounded = pairs.map(([lng, lat]) => ({ lat, lng }))
  const c = ringCenter(rounded)
  emit('change', {
    polygon: pairs,
    areaSize: Math.round(ringAreaM2(rounded)),
    lat: round5(c.lat),
    lng: round5(c.lng)
  })
}

function clampLatLng(latlng) {
  const b = campus.bounds
  return L.latLng(
    Math.min(b.north, Math.max(b.south, latlng.lat)),
    Math.min(b.east, Math.max(b.west, latlng.lng))
  )
}

function orangeDotIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="pin-dot" style="background:#e08e0b"></div>',
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5]
  })
}

function handleIcon() {
  return L.divIcon({
    className: 'area-handle-wrap',
    html: '<span class="area-handle"></span>',
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5]
  })
}

/* ── 点位标记 ─────────────────────────────────────────────── */

function syncPointMarker() {
  if (!map) return
  const show =
    props.mode === 'point' && Number.isFinite(props.lat) && Number.isFinite(props.lng)
  if (!show) {
    if (pointMarker) {
      map.removeLayer(pointMarker)
      pointMarker = null
    }
    return
  }
  const ll = [props.lat, props.lng]
  if (!pointMarker) {
    pointMarker = L.marker(ll, { icon: orangeDotIcon() }).addTo(map)
  } else {
    pointMarker.setLatLng(ll)
  }
  const b = campus.bounds
  if (
    b &&
    ll[0] >= b.south &&
    ll[0] <= b.north &&
    ll[1] >= b.west &&
    ll[1] <= b.east
  ) {
    map.panTo(ll)
  }
}

/* ── 地块多边形与顶点手柄 ─────────────────────────────────── */

function syncPolygon() {
  if (!map) return
  if (polygonLayer) {
    map.removeLayer(polygonLayer)
    polygonLayer = null
  }
  for (const m of handleMarkers) map.removeLayer(m)
  handleMarkers = []

  if (props.mode !== 'area' || !hasPolygon.value) return

  polygonLayer = L.polygon(
    polygonRing.value.map((p) => [p.lat, p.lng]),
    {
      color: '#b06f0c',
      weight: 2,
      opacity: 0.95,
      fillColor: '#e08e0b',
      fillOpacity: 0.22,
      dashArray: '6 4',
      interactive: false
    }
  ).addTo(map)

  if (drawMode.value) return
  polygonRing.value.forEach((p, i) => {
    const marker = L.marker([p.lat, p.lng], {
      draggable: true,
      icon: handleIcon(),
      keyboard: false,
      zIndexOffset: 1200,
      title: '拖动圆点调整边界'
    })
    marker.on('dragstart', () => {
      draggingIndex = i
    })
    marker.on('drag', () => onHandleDrag(i, marker.getLatLng()))
    marker.on('dragend', () => {
      draggingIndex = -1
      syncPolygonGeometry(-1)
    })
    marker.addTo(map)
    handleMarkers.push(marker)
  })
}

function syncPolygonGeometry(skipIndex) {
  const ring = polygonRing.value
  if (!ring.length) return
  polygonLayer?.setLatLngs(ring.map((p) => [p.lat, p.lng]))
  handleMarkers.forEach((m, i) => {
    if (i === skipIndex) return
    m.setLatLng([ring[i].lat, ring[i].lng])
  })
}

function onHandleDrag(index, latlng) {
  const ring = polygonRing.value
  if (ring.length < 3) return
  const ll = clampLatLng(latlng)
  let next

  if (shapeKind.value === 'rect' && ring.length === 4) {
    const opposite = ring[(index + 2) % 4]
    if (Math.abs(ll.lat - opposite.lat) * 111320 < 2) return
    if (Math.abs(ll.lng - opposite.lng) * 95700 < 2) return
    next = [
      { lat: Math.min(ll.lat, opposite.lat), lng: Math.min(ll.lng, opposite.lng) },
      { lat: Math.min(ll.lat, opposite.lat), lng: Math.max(ll.lng, opposite.lng) },
      { lat: Math.max(ll.lat, opposite.lat), lng: Math.max(ll.lng, opposite.lng) },
      { lat: Math.max(ll.lat, opposite.lat), lng: Math.min(ll.lng, opposite.lng) }
    ]
  } else {
    next = ring.map((p, i) => (i === index ? { lat: ll.lat, lng: ll.lng } : p))
  }
  emitRing(next)
}

/* ── 进入 / 退出绘制 ─────────────────────────────────────── */

function toggleDraw(mode) {
  if (!map) return
  if (drawMode.value === mode) {
    cancelDraw()
    return
  }
  cancelDraw()
  drawMode.value = mode
  if (mode === 'rect') map.dragging.disable()
  if (mode === 'poly') map.doubleClickZoom.disable()
  mapEl.value?.classList.add('is-drawing')
  syncPolygon()
  setNotice(mode === 'rect' ? '按住鼠标拖动，框出地块范围' : '沿地块边界依次点击')
}

function cancelDraw() {
  drawMode.value = ''
  rectDrag = null
  removePreviewRect()
  clearDraft()
  live.value = null
  if (map) {
    map.dragging.enable()
    map.doubleClickZoom.enable()
  }
  mapEl.value?.classList.remove('is-drawing')
  syncPolygon()
}

function removePreviewRect() {
  if (previewRect && map) map.removeLayer(previewRect)
  previewRect = null
}

function clearDraft() {
  draft.value = []
  draftCursor = null
  for (const m of draftMarkers) map?.removeLayer(m)
  draftMarkers = []
  if (draftShape && map) {
    map.removeLayer(draftShape)
    draftShape = null
  }
}

function renderDraftVertices() {
  if (!map) return
  for (const m of draftMarkers) map.removeLayer(m)
  draftMarkers = []
  draft.value.forEach((p, i) => {
    const icon = L.divIcon({
      className: '',
      html: `<span class="area-draft-dot${i === 0 ? ' first' : ''}"></span>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    })
    draftMarkers.push(
      L.marker([p.lat, p.lng], {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1100
      }).addTo(map)
    )
  })
}

function updateDraftShape() {
  const pts = draft.value.map((p) => L.latLng(p.lat, p.lng))
  if (!pts.length) {
    if (draftShape && map) {
      map.removeLayer(draftShape)
      draftShape = null
    }
    return
  }
  if (draftCursor) pts.push(draftCursor)
  if (!draftShape) {
    draftShape = L.polygon([], {
      color: '#b06f0c',
      weight: 2,
      dashArray: '5 4',
      fillColor: '#e08e0b',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(map)
  }
  draftShape.setLatLngs(pts)
}

/* ── 地图交互 ─────────────────────────────────────────────── */

function onMapClick(e) {
  if (!map) return
  if (drawMode.value === 'poly') {
    if (e.originalEvent?.detail > 1) return
    const ll = clampLatLng(e.latlng)
    const current = draft.value
    if (current.length >= 3) {
      const first = map.latLngToContainerPoint(L.latLng(current[0].lat, current[0].lng))
      if (first.distanceTo(map.latLngToContainerPoint(ll)) <= 11) {
        finishPolygon()
        return
      }
    }
    if (current.length) {
      const last = map.latLngToContainerPoint(
        L.latLng(current[current.length - 1].lat, current[current.length - 1].lng)
      )
      if (last.distanceTo(map.latLngToContainerPoint(ll)) < 5) return
    }
    draft.value = [...current, { lat: ll.lat, lng: ll.lng }]
    draftCursor = null
    renderDraftVertices()
    updateDraftShape()
    return
  }
  if (drawMode.value) return
  if (props.mode !== 'point') return
  emit('change', {
    lat: round5(e.latlng.lat),
    lng: round5(e.latlng.lng)
  })
}

function onMapDblClick() {
  if (drawMode.value === 'poly') finishPolygon()
}

function onMapMove(e) {
  if (drawMode.value !== 'poly' || !map) return
  draftCursor = clampLatLng(e.latlng)
  if (draft.value.length) updateDraftShape()
}

function finishPolygon() {
  if (draft.value.length < 3) {
    setNotice('至少需要 3 个顶点才能围成地块')
    return
  }
  const ring = draft.value.map((p) => ({ lat: p.lat, lng: p.lng }))
  if (ringAreaM2(ring) < 8) {
    setNotice('框选范围太小，请重新描绘')
    return
  }
  cancelDraw()
  shapeKind.value = 'poly'
  emitRing(ring)
}

function undoDraft() {
  if (!draft.value.length) return
  draft.value = draft.value.slice(0, -1)
  renderDraftVertices()
  updateDraftShape()
}

function onPointerDown(e) {
  if (drawMode.value !== 'rect' || !map) return
  if (e.target?.closest?.('.leaflet-control')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()

  const start = clampLatLng(map.mouseEventToLatLng(e))
  rectDrag = { pointerId: e.pointerId, start, moved: false }
  try {
    mapEl.value?.setPointerCapture?.(e.pointerId)
  } catch (err) {
    /* 忽略 */
  }
  if (!previewRect) {
    previewRect = L.rectangle(L.latLngBounds(start, start), {
      color: '#b06f0c',
      weight: 2,
      dashArray: '6 5',
      fillColor: '#e08e0b',
      fillOpacity: 0.14,
      interactive: false
    }).addTo(map)
  }
}

function onPointerMove(e) {
  if (!rectDrag || drawMode.value !== 'rect' || !map) return
  e.preventDefault()
  e.stopPropagation()

  const startPt = map.latLngToContainerPoint(rectDrag.start)
  const current = clampLatLng(map.mouseEventToLatLng(e))
  const curPt = map.latLngToContainerPoint(current)
  if (Math.abs(startPt.x - curPt.x) < 3 && Math.abs(startPt.y - curPt.y) < 3) return

  rectDrag.moved = true
  const bounds = L.latLngBounds(rectDrag.start, current)
  previewRect?.setBounds(bounds)
  const ring = [
    { lat: bounds.getSouth(), lng: bounds.getWest() },
    { lat: bounds.getSouth(), lng: bounds.getEast() },
    { lat: bounds.getNorth(), lng: bounds.getEast() },
    { lat: bounds.getNorth(), lng: bounds.getWest() }
  ]
  const width = mapEl.value?.clientWidth || 0
  live.value = {
    x: Math.min(Math.max(curPt.x, 80), Math.max(80, width - 80)),
    y: Math.max(22, curPt.y - 12),
    text: `${formatArea(ringAreaM2(ring))} · 松手完成`
  }
}

function onPointerUp(e) {
  if (!rectDrag || !map) return
  e.preventDefault()
  e.stopPropagation()
  const drag = rectDrag
  rectDrag = null
  try {
    mapEl.value?.releasePointerCapture?.(drag.pointerId)
  } catch (err) {
    /* 忽略 */
  }
  live.value = null

  if (!drag.moved || !previewRect) {
    removePreviewRect()
    setNotice('按住并拖动鼠标来框选地块')
    return
  }
  const bounds = previewRect.getBounds()
  removePreviewRect()
  const ring = [
    { lat: bounds.getSouth(), lng: bounds.getWest() },
    { lat: bounds.getSouth(), lng: bounds.getEast() },
    { lat: bounds.getNorth(), lng: bounds.getEast() },
    { lat: bounds.getNorth(), lng: bounds.getWest() }
  ]
  if (ringAreaM2(ring) < 8) {
    setNotice('框选范围太小，请重新拖动')
    return
  }
  cancelDraw()
  shapeKind.value = 'rect'
  emitRing(ring)
}

function onPointerCancel(e) {
  if (!rectDrag) return
  e.preventDefault?.()
  e.stopPropagation?.()
  try {
    mapEl.value?.releasePointerCapture?.(rectDrag.pointerId)
  } catch (err) {
    /* 忽略 */
  }
  rectDrag = null
  removePreviewRect()
  live.value = null
}

function clearPolygon() {
  cancelDraw()
  emit('change', { polygon: [], areaSize: 0, lat: null, lng: null })
}

function onKeydown(e) {
  if (!drawMode.value) return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return

  if (e.key === 'Escape') {
    cancelDraw()
    return
  }
  if (drawMode.value !== 'poly') return
  if (e.key === 'Enter') {
    e.preventDefault()
    finishPolygon()
  } else if (e.key === 'Backspace') {
    e.preventDefault()
    undoDraft()
  }
}

watch(
  () => props.polygon,
  () => {
    if (draggingIndex >= 0) syncPolygonGeometry(draggingIndex)
    else syncPolygon()
  },
  { deep: true }
)

watch(
  () => props.mode,
  () => {
    cancelDraw()
    syncPolygon()
    syncPointMarker()
  }
)

watch(() => [props.lat, props.lng], syncPointMarker)

onMounted(() => {
  const b = campus.bounds
  map = L.map(mapEl.value, {
    center: [campus.center.lat, campus.center.lng],
    zoom: campus.zoom || 17,
    minZoom: campus.minZoom || 17,
    maxZoom: Math.min(campus.maxZoom || 18, 18),
    maxBounds: b ? L.latLngBounds([b.south, b.west], [b.north, b.east]) : null,
    maxBoundsViscosity: 1.0
  })

  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: '1234',
      maxZoom: Math.min(campus.maxZoom || 18, 18),
      maxNativeZoom: 18,
      attribution: '© 高德地图'
    }
  ).addTo(map)

  map.on('click', onMapClick)
  map.on('dblclick', onMapDblClick)
  map.on('mousemove', onMapMove)
  mapEl.value?.addEventListener('pointerdown', onPointerDown, true)
  mapEl.value?.addEventListener('pointermove', onPointerMove, true)
  mapEl.value?.addEventListener('pointerup', onPointerUp, true)
  mapEl.value?.addEventListener('pointercancel', onPointerCancel, true)
  window.addEventListener('keydown', onKeydown)

  syncPolygon()
  syncPointMarker()

  nextTick(() => {
    map?.invalidateSize()
    if (hasPolygon.value) {
      map?.fitBounds(
        L.latLngBounds(polygonRing.value.map((p) => [p.lat, p.lng])),
        { padding: [24, 24], maxZoom: map.getMaxZoom() }
      )
    } else if (Number.isFinite(props.lat) && Number.isFinite(props.lng)) {
      map?.setView([props.lat, props.lng], Math.min(18, map.getMaxZoom()))
    }
  })
})

onBeforeUnmount(() => {
  if (noticeTimer) window.clearTimeout(noticeTimer)
  window.removeEventListener('keydown', onKeydown)
  const el = mapEl.value
  el?.removeEventListener('pointerdown', onPointerDown, true)
  el?.removeEventListener('pointermove', onPointerMove, true)
  el?.removeEventListener('pointerup', onPointerUp, true)
  el?.removeEventListener('pointercancel', onPointerCancel, true)
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.area-picker {
  position: relative;
  margin-bottom: 12px;
}

.area-map {
  position: relative;
  z-index: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.area-map.is-drawing {
  cursor: crosshair;
}

.picker-tools {
  position: absolute;
  z-index: 5;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 20px -12px rgba(18, 69, 50, 0.5);
}

.ptool {
  padding: 6px 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
}

.ptool:hover {
  background: var(--amber-050);
  color: var(--amber);
}

.ptool.active {
  background: #b06f0c;
  color: #fff;
}

.ptool.close {
  padding: 6px 8px;
}

.ptool.clear {
  color: var(--danger);
}

.picker-hint,
.picker-area {
  position: absolute;
  z-index: 5;
  left: 50%;
  bottom: 10px;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 5px 12px;
  border: 1px solid rgba(239, 223, 189, 0.9);
  border-radius: 999px;
  background: rgba(255, 251, 240, 0.94);
  color: #8a5a10;
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.picker-area b {
  color: #8a5a10;
}

.picker-live {
  position: absolute;
  z-index: 6;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(138, 90, 16, 0.92);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  transform: translate(-50%, -115%);
  pointer-events: none;
}

:deep(.area-handle-wrap) {
  border: none;
  background: transparent;
}

:deep(.area-handle) {
  display: block;
  width: 13px;
  height: 13px;
  border: 2.5px solid #b06f0c;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  cursor: grab;
}

:deep(.area-handle:active) {
  cursor: grabbing;
}

:deep(.area-draft-dot) {
  display: block;
  width: 8px;
  height: 8px;
  border: 2px solid #b06f0c;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

:deep(.area-draft-dot.first) {
  background: #fdf6e7;
}

:deep(.leaflet-tile) {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

@media (max-width: 640px) {
  .picker-tools {
    top: 8px;
    right: 8px;
    gap: 1px;
    padding: 3px;
  }

  .ptool {
    min-height: 36px;
    padding: 6px 8px;
    font-size: 11px;
  }

  .picker-hint,
  .picker-area {
    bottom: 8px;
    max-width: calc(100% - 16px);
    padding: 4px 10px;
    font-size: 10.5px;
  }
}

/* 触屏设备：按钮更高、边界圆点更好点中 */
@media (hover: none) and (pointer: coarse) {
  .ptool {
    min-height: 36px;
  }

  :deep(.area-handle-wrap)::after {
    content: '';
    position: absolute;
    inset: -8px;
  }

  :deep(.leaflet-control-zoom a) {
    width: 36px;
    height: 36px;
    line-height: 36px;
    font-size: 19px;
  }
}
</style>
