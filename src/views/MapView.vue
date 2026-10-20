<template>
  <div class="map-page">
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Campus Map</p>
        <h2 class="page-title">植被分布地图</h2>
        <p class="page-sub">地图已锁定在科大中校区范围；点击标记查看物种，右上角可切换底图。</p>
      </div>
      <div class="stats">
        <span class="stat"><b>{{ visiblePoints.length }}</b> 个分布点</span>
        <span class="stat"><b>{{ mappedSpeciesCount }}</b> 个已定位物种</span>
        <span v-if="submissions.length" class="stat amber">
          <b>{{ submissions.length }}</b> 条我的投稿
        </span>
      </div>
    </div>

    <div class="toolbar card glass">
      <label class="f">
        <span>科</span>
        <select v-model="family">
          <option value="">全部科</option>
          <option v-for="f in families" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>

      <label class="f">
        <span>花期</span>
        <select v-model="month">
          <option value="">不限</option>
          <option v-for="m in months" :key="m" :value="m">{{ m }} 月</option>
        </select>
      </label>

      <label class="f grow">
        <span>搜索</span>
        <input v-model.trim="keyword" type="text" placeholder="输入中文名 / 学名 / 别名 / 关键词" />
      </label>

      <label class="check">
        <input v-model="showSubmissions" type="checkbox" />
        <span>显示我的投稿</span>
      </label>

      <button class="btn btn-ghost" @click="reset">重置</button>
    </div>

    <div class="map-shell card">
      <div ref="mapEl" class="map"></div>
      <transition name="fade">
        <div v-if="mapLoading" class="map-loading" aria-hidden="true">
          <div class="map-skeleton skeleton"></div>
          <span class="loading-pill"><i></i>地图加载中…</span>
        </div>
      </transition>
      <p v-if="tileError" class="tile-error">
        底图瓦片加载失败，请检查网络；点位与筛选仍可正常使用。
      </p>
    </div>

    <p class="hint muted">
      提示：<template v-if="tiandituEnabled"
        >已接入天地图（CGCS2000 / WGS-84），切换底图时会自动换算点位坐标；</template
      ><template v-else>天地图图层未启用，配置 VITE_TIANDITU_TK 后自动出现在图层控件中；</template>
      在线瓦片原生最高 <b>18 级</b>，地图同样限制在 18 级，避免继续放大的拉伸模糊。
      放大到 <b>18 级</b>起显示物种名称。地图仅显示<b>已记录</b>（有分布点）的物种，其余为待核实的候选清单。
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import {
  campus,
  speciesList,
  allFamilies,
  allMonths,
  speciesImage,
  bloomsIn,
  searchText,
  pointAccuracyText
} from '@/utils/species'
import { loadSubmissions } from '@/utils/storage'
import { gcj02ToWgs84 } from '@/utils/coord'

const mapEl = ref(null)
let map = null
let speciesLayer = null
let submissionLayer = null

const families = allFamilies()
const months = allMonths()

const family = ref('')
const month = ref('')
const keyword = ref('')
const showSubmissions = ref(true)
const submissions = ref(loadSubmissions())
const mapLoading = ref(true)
const tileError = ref(false)
let mapLoadTimer = null

function hideMapSkeleton() {
  mapLoading.value = false
  if (mapLoadTimer) {
    window.clearTimeout(mapLoadTimer)
    mapLoadTimer = null
  }
}

const SPECIES_COLOR = '#2e7d32'
const SUB_COLOR = '#e08e0b'

// 天地图 Key：在项目根目录 .env.local 写入 VITE_TIANDITU_TK=你的key 后重启 dev / 重新 build
const TIANDITU_TK = (import.meta.env.VITE_TIANDITU_TK || '').trim()
const tiandituEnabled = Boolean(TIANDITU_TK)

// 数据统一存 GCJ-02；天地图为 WGS-84（CGCS2000），切换底图时按当前模式换算显示坐标
let coordMode = tiandituEnabled ? 'wgs84' : 'gcj02'
const wgs84Layers = new WeakSet()

// 底图（天地图 / 高德）原生最高 18 级，地图也限制在 18 级，避免放大后拉伸发虚
const LABEL_ZOOM = 18

const visibleSpecies = computed(() => {
  const kw = keyword.value.toLowerCase()
  return speciesList.filter((s) => {
    if (family.value && s.family !== family.value) return false
    if (month.value && !bloomsIn(s, month.value)) return false
    if (kw && !searchText(s).includes(kw)) return false
    return true
  })
})

const visiblePoints = computed(() => {
  const out = []
  for (const s of visibleSpecies.value) {
    const points = s.points || []
    points.forEach((p, pointIndex) => {
      out.push({ ...p, pointIndex, species: s })
    })
  }
  return out
})

/** 实际有分布点的物种数（待核实物种不计入） */
const mappedSpeciesCount = computed(
  () => new Set(visiblePoints.value.map((p) => p.species.id)).size
)

function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

/** 数据坐标（GCJ-02）→ 当前底图坐标；天地图模式下转为 WGS-84 */
function toDisplayLatLng(lat, lng) {
  if (coordMode !== 'wgs84') return [lat, lng]
  const [wl, wa] = gcj02ToWgs84(lng, lat)
  return [wa, wl]
}

function displayBounds(b) {
  if (!b) return null
  return L.latLngBounds(
    toDisplayLatLng(b.south, b.west),
    toDisplayLatLng(b.north, b.east)
  )
}

function dotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="pin-dot" style="background:${color}"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
    popupAnchor: [0, -8]
  })
}

function popupHtml(s, p) {
  return `
    <div>
      <img class="popup-img" src="${speciesImage(s)}" alt="${escapeHtml(s.nameCn)}"
           onerror="this.style.display='none'" />
      <div class="popup-title">${escapeHtml(s.nameCn)}</div>
      <div class="popup-meta">${escapeHtml(s.family)} · 花期 ${escapeHtml(s.bloomText)}</div>
      <div class="popup-meta">位置：${escapeHtml(p.location)}</div>
      <div class="popup-meta">坐标：${escapeHtml(pointAccuracyText(p))}</div>
      <div class="popup-actions">
        <a class="popup-link" href="#/species/${s.id}">查看详情 →</a>
        <a class="popup-link" href="#/community?species=${encodeURIComponent(
          s.id
        )}&point=${p.pointIndex}">评论此分布点 →</a>
      </div>
    </div>`
}

function subPopupHtml(sub) {
  const img = sub.image ? `<img class="popup-img" src="${sub.image}" alt="投稿图片" />` : ''
  const note = sub.note ? ` · ${escapeHtml(sub.note)}` : ''
  return `
    <div>
      ${img}
      <div class="popup-title">${escapeHtml(sub.name)}</div>
      <div class="popup-meta">我的投稿${note}</div>
    </div>`
}

function updateLabelVisibility() {
  if (!map || !mapEl.value) return
  mapEl.value.classList.toggle('show-labels', map.getZoom() >= LABEL_ZOOM)
}

/** 随缩放级别显示物种名称标签 */
function syncZoomMode() {
  updateLabelVisibility()
}

function renderMarkers() {
  if (!map) return
  speciesLayer.clearLayers()
  submissionLayer.clearLayers()

  for (const p of visiblePoints.value) {
    const marker = L.marker(toDisplayLatLng(p.lat, p.lng), {
      icon: dotIcon(SPECIES_COLOR),
      title: p.species.nameCn
    })
    marker.bindPopup(popupHtml(p.species, p))
    // 放大到 18 级起显示物种名称（显隐由地图容器上的 .show-labels 控制）
    marker.bindTooltip(p.species.nameCn, {
      permanent: true,
      direction: 'right',
      offset: [7, 0],
      className: 'marker-label',
      opacity: 1
    })
    marker.addTo(speciesLayer)
  }

  if (showSubmissions.value) {
    for (const sub of submissions.value) {
      if (typeof sub.lat !== 'number' || typeof sub.lng !== 'number') continue
      L.marker(toDisplayLatLng(sub.lat, sub.lng), {
        icon: dotIcon(SUB_COLOR),
        title: sub.name
      })
        .bindPopup(subPopupHtml(sub))
        .addTo(submissionLayer)
    }
  }

  updateLabelVisibility()
}

function reset() {
  family.value = ''
  month.value = ''
  keyword.value = ''
  showSubmissions.value = true
}

/** 切换底图坐标系：重设视野范围，并按新坐标系重绘标记 */
function applyCoordMode(mode) {
  if (!map || mode === coordMode) return
  coordMode = mode
  map.setMaxBounds(displayBounds(campus.bounds))
  map.setView(
    toDisplayLatLng(campus.center.lat, campus.center.lng),
    map.getZoom(),
    { animate: false }
  )
  renderMarkers()
}

onMounted(() => {
  const NATIVE_MAX = 18
  const MAP_MAX = Math.min(campus.maxZoom || 18, NATIVE_MAX)

  map = L.map(mapEl.value, {
    center: toDisplayLatLng(campus.center.lat, campus.center.lng),
    zoom: campus.zoom || 17,
    minZoom: campus.minZoom || 17,
    maxZoom: MAP_MAX,
    maxBounds: displayBounds(campus.bounds),
    maxBoundsViscosity: 1.0,
    zoomControl: true
  })

  // ── 天地图底图（CGCS2000/WGS-84，需 VITE_TIANDITU_TK）────────────
  // 官方 WMTS：img/cia=影像+注记，vec/cva=矢量+注记
  const tdtTile = (layer, attr, extra = {}) =>
    L.tileLayer(
      `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles` +
        `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodeURIComponent(TIANDITU_TK)}`,
      {
        subdomains: '01234567',
        maxZoom: MAP_MAX,
        maxNativeZoom: NATIVE_MAX,
        attribution: attr,
        ...extra
      }
    )
  const tdtGroup = (base, anno, extra = {}) =>
    L.layerGroup([tdtTile(base, '© 天地图', extra.base), tdtTile(anno, '', extra.anno)])

  const tdtImagery = tiandituEnabled ? tdtGroup('img', 'cia') : null
  // 矢量底图加强地块色差与对比度；注记层保持原样，避免文字发虚、发彩
  const tdtVector = tiandituEnabled
    ? tdtGroup('vec', 'cva', { base: { className: 'tile-vec-contrast' } })
    : null

  // ── 高德标准地图（GCJ-02，无需 key）────────────────────────────
  const gaodeStandard = L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: '1234',
      maxZoom: MAP_MAX,
      maxNativeZoom: NATIVE_MAX,
      attribution: '© 高德地图',
      className: 'tile-amap-contrast'
    }
  )

  const baseLayers = {}
  if (tiandituEnabled) {
    baseLayers['天地图影像（含影像注记）'] = tdtImagery
    baseLayers['天地图矢量（含矢量注记）'] = tdtVector
    wgs84Layers.add(tdtImagery)
    wgs84Layers.add(tdtVector)
  }
  baseLayers['高德标准地图'] = gaodeStandard

  const defaultBase = tiandituEnabled ? tdtImagery : gaodeStandard
  defaultBase.addTo(map)

  // 瓦片加载失败提示（断网/被墙/配额用尽时给出明确反馈，而不是静默白屏）
  const watchTiles = (layer) => {
    const targets = layer instanceof L.TileLayer ? [layer] : layer?.getLayers?.() || []
    for (const tile of targets) {
      tile.on?.('tileerror', () => {
        tileError.value = true
      })
      tile.on?.('load', () => {
        tileError.value = false
      })
    }
  }
  Object.values(baseLayers).forEach(watchTiles)

  // 首屏底图瓦片加载完成后隐藏骨架屏（天地图是图层组，取其中第一层监听）
  const tileBase =
    defaultBase instanceof L.TileLayer ? defaultBase : defaultBase.getLayers?.()[0]
  if (tileBase) {
    tileBase.once('load', hideMapSkeleton)
  } else {
    map.whenReady(() => window.setTimeout(hideMapSkeleton, 400))
  }
  mapLoadTimer = window.setTimeout(hideMapSkeleton, 6000)

  L.control.layers(baseLayers, {}, { position: 'topright' }).addTo(map)
  L.control.scale({ imperial: false }).addTo(map)

  speciesLayer = L.layerGroup().addTo(map)
  submissionLayer = L.layerGroup().addTo(map)

  renderMarkers()
  map.on('zoomend', syncZoomMode)
  map.on('baselayerchange', (e) => {
    tileError.value = false
    applyCoordMode(wgs84Layers.has(e.layer) ? 'wgs84' : 'gcj02')
  })
  syncZoomMode()
})

watch([family, month, keyword, showSubmissions], renderMarkers)

onBeforeUnmount(() => {
  if (mapLoadTimer) {
    window.clearTimeout(mapLoadTimer)
    mapLoadTimer = null
  }
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 20px;
}

.f {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.f > span {
  color: var(--ink-soft);
  font-weight: 600;
}

.f.grow {
  flex: 1;
  min-width: 200px;
}

.f select,
.f input {
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: #fff;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.f select:focus,
.f input:focus {
  border-color: var(--green-500);
  box-shadow: var(--ring);
}

.f input::placeholder {
  color: #9aa9a0;
}

.check {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 10px;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}

.check input {
  width: 15px;
  height: 15px;
  accent-color: var(--green-700);
  cursor: pointer;
}

.map-shell {
  position: relative;
  overflow: hidden;
}

.map {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 66vh;
  min-height: 460px;
  overflow: hidden;
}

.map-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tile-error {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  margin: 0;
  padding: 8px 16px;
  border: 1px solid #f0dfbe;
  border-radius: 999px;
  background: rgba(253, 246, 231, 0.95);
  color: #8a5a10;
  font-size: 12.5px;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}

.map-skeleton {
  position: absolute;
  inset: 0;
}

.loading-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 18px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 30px -18px rgba(18, 69, 50, 0.4);
  backdrop-filter: blur(12px);
  color: var(--ink-soft);
  font-size: 12.5px;
}

.loading-pill i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green-500);
  animation: loading-pulse 1.2s ease-in-out infinite;
}

@keyframes loading-pulse {
  50% {
    transform: scale(0.7);
    opacity: 0.3;
  }
}

.fade-leave-active {
  transition: opacity 0.35s ease;
}

.fade-leave-to {
  opacity: 0;
}

/* 瓦片不做平滑插值，文字注记在缩放临界处更锐利 */
:deep(.leaflet-tile) {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

/* 天地图矢量 / 高德标准：拉大不同地块的配色差异并提高对比度
   className 由 Leaflet 加在图层容器上，只作用于底图容器，注记层保持原样 */
:deep(.leaflet-layer.tile-vec-contrast) {
  filter: saturate(1.55) contrast(1.12);
}

:deep(.leaflet-layer.tile-amap-contrast) {
  filter: saturate(1.45) contrast(1.1);
}

:deep(.leaflet-control-zoom) {
  border: none !important;
  border-radius: 10px;
  box-shadow: 0 6px 18px -8px rgba(15, 40, 28, 0.35);
  overflow: hidden;
}

:deep(.leaflet-control-zoom a) {
  color: var(--green-900);
  background: rgba(255, 255, 255, 0.95);
}

:deep(.leaflet-control-layers) {
  border: 1px solid var(--line) !important;
  border-radius: 10px !important;
  box-shadow: 0 6px 18px -10px rgba(15, 40, 28, 0.3) !important;
}

.hint {
  margin: 12px 4px 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.8;
}

/* 18 级起显示的物种名称标签（Leaflet tooltip 由 JS 生成，需 :deep 穿透） */
:deep(.marker-label) {
  display: none;
  padding: 1px 6px;
  border: 1px solid rgba(46, 125, 50, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: #1b4d24;
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.map.show-labels :deep(.marker-label) {
  display: block;
}

:deep(.leaflet-tooltip-right::before) {
  display: none;
}
</style>
