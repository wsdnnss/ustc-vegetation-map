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
        <span v-if="plots.length" class="stat"><b>{{ plots.length }}</b> 个地块</span>
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

      <div class="f grow">
        <span>搜索</span>
        <SearchSuggest v-model="keyword" @select="onSelectSpecies" />
      </div>

      <label class="check">
        <input v-model="showSubmissions" type="checkbox" />
        <span>显示我的投稿</span>
      </label>

      <label v-if="plots.length" class="check">
        <input v-model="showPlots" type="checkbox" />
        <span>显示地块</span>
      </label>

      <button
        class="btn draw-entry"
        :class="{ active: selectMode }"
        type="button"
        :aria-pressed="Boolean(selectMode)"
        @click="startSelection('rect')"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        框选地块
      </button>

      <button v-if="plots.length" class="btn btn-ghost" type="button" @click="openPlotManager">
        地块 {{ plots.length }}
      </button>

      <button class="btn btn-ghost" @click="reset">重置</button>
    </div>

    <div class="map-layout" :class="{ 'with-panel': panelOpen }">
      <div class="map-shell card">
      <div ref="mapEl" class="map"></div>

      <div class="map-tools card glass" role="toolbar" aria-label="手动框选工具">
        <button
          type="button"
          class="tool"
          :class="{ active: selectMode === 'rect' }"
          :aria-pressed="selectMode === 'rect'"
          @click="startSelection('rect')"
        >
          矩形框选
        </button>
        <button
          type="button"
          class="tool"
          :class="{ active: selectMode === 'poly' }"
          :aria-pressed="selectMode === 'poly'"
          @click="startSelection('poly')"
        >
          多边形框选
        </button>
        <button
          v-if="selectMode"
          type="button"
          class="tool close"
          aria-label="退出框选"
          @click="stopSelection"
        >
          ✕
        </button>
        <button
          v-else-if="selection && !panelOpen"
          type="button"
          class="tool result"
          @click="openPlotManager"
        >
          <span class="wide-only">查看框选结果</span>
          <span class="narrow-only">结果</span>
        </button>
      </div>

      <p v-if="selectMode" class="select-hint">{{ selectHint }}</p>

      <div
        v-if="liveBadge"
        class="live-badge"
        :style="{ left: `${liveBadge.x}px`, top: `${liveBadge.y}px` }"
      >
        {{ liveBadge.text }}
      </div>

      <transition name="fade">
        <div v-if="toast" class="map-toast" :class="toast.tone">{{ toast.text }}</div>
      </transition>

      <transition name="fade">
        <div v-if="mapLoading" class="map-loading" aria-hidden="true">
          <div class="map-skeleton skeleton"></div>
          <span class="loading-pill"><i></i>地图加载中…</span>
        </div>
      </transition>
      <p v-if="tileError" class="tile-error">
        底图瓦片加载失败，请检查网络；点位与筛选仍可正常使用。
      </p>

      <transition name="location">
        <section v-if="activeGroup" class="location-card card" aria-live="polite">
          <div class="location-head">
            <div>
              <h4>该位置有 {{ activeGroup.points.length }} 种植物</h4>
              <p>
                {{ groupLocations(activeGroup) }} ·
                {{ pointAccuracyText(activeGroup.points[0]) }}
                <template
                  v-if="activeGroup.matched && activeGroup.matched < activeGroup.points.length"
                >
                  · 当前筛选命中 {{ activeGroup.matched }} 种
                </template>
              </p>
            </div>
            <button
              class="location-close"
              type="button"
              aria-label="关闭位置清单"
              @click="activeGroup = null"
            >
              ×
            </button>
          </div>
          <ul class="location-list">
            <li v-for="p in activeGroup.points" :key="`${p.species.id}-${p.pointIndex}`">
              <router-link class="location-name" :to="`/species/${p.species.id}`">
                {{ p.species.nameCn }}
              </router-link>
              <span class="location-sub">
                {{ p.species.family }} · 花期 {{ p.species.bloomText }}
              </span>
              <router-link
                class="location-chat"
                :to="`/community?species=${p.species.id}&point=${p.pointIndex}`"
              >
                讨论
              </router-link>
            </li>
          </ul>
        </section>
      </transition>
      </div>

      <PlotPanel
        v-if="panelOpen"
        ref="plotPanelRef"
        :analysis="analysis"
        :form="plotForm"
        :editing-plot-id="editingPlotId"
        :suggestion="suggestion"
        :plots="plots"
        :active-plot-id="editingPlotId"
        :filtering="filtering"
        @close="closePanel"
        @save="savePlot"
        @delete="deleteEditingPlot"
        @clear="clearSelection"
        @reselect="startSelection"
        @expand="expandSelection"
        @copy="copySelection"
        @export="exportPlots"
        @import="importPlots"
        @focus="openSavedPlot"
        @touch="formTouched = true"
        @apply-suggestion="applySuggestions(true)"
        @remove="removePlot"
      />
    </div>

    <p class="hint muted">
      提示：<template v-if="tiandituEnabled"
        >已接入天地图（CGCS2000 / WGS-84）与高德底图（标准 / 卫星），切换底图时会自动换算点位坐标；</template
      ><template v-else
        >天地图图层未启用（配置 VITE_TIANDITU_TK 后自动出现在图层控件中），右上角可切换高德标准地图 / 高德卫星图；</template
      >
      在线瓦片原生最高 <b>18 级</b>，地图同样限制在 18 级，避免继续放大的拉伸模糊。
      放大到 <b>18 级</b>起显示物种名称。地图仅显示<b>已记录</b>（有分布点）的物种，其余为待核实的候选清单。
      相近点位会自动聚合为数字标记，点击即可放大展开；同一位置记录到多种植物时会合并为一个数字点，
      点击可查看该位置的全部物种（不受当前筛选影响）。
      需要统计一片区域时，可以用<b>矩形框选</b>直接拖出范围，或切换到<b>多边形框选</b>沿边界逐点描绘，
      框选后能拖动圆点微调边界，并保存为可导出的地块；也可以去
      <router-link class="hint-link" to="/season">季节专题</router-link> 按月份查看花期。
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import SearchSuggest from '@/components/SearchSuggest.vue'
import PlotPanel from '@/components/PlotPanel.vue'
import {
  campus,
  speciesList,
  allFamilies,
  allMonths,
  speciesImage,
  bloomsIn,
  searchText,
  pointAccuracyText,
  groupPointsByLocation
} from '@/utils/species'
import { loadSubmissions } from '@/utils/storage'
import { gcj02ToWgs84, wgs84ToGcj02 } from '@/utils/coord'
import {
  analyzeSelection,
  boundsOfRing,
  expandRectRing,
  expandRingToInclude,
  formatArea,
  loadPlots,
  mergePlots,
  nextPlotId,
  persistPlots,
  ringAreaM2,
  ringCenter,
  ringFromBounds,
  suggestPlotMeta
} from '@/utils/plots'

const route = useRoute()
const router = useRouter()

const mapEl = ref(null)
const plotPanelRef = ref(null)
let map = null
let speciesLayer = null
let submissionLayer = null
let plotsLayer = null
let drawLayer = null
// 供搜索联想定位使用：`物种id:点位序号` → marker
const speciesMarkers = new Map()

const families = allFamilies()
const months = allMonths()

const family = ref('')
const queryMonth = Number(route.query.month)
const month = ref(months.includes(queryMonth) ? queryMonth : '')
const keyword = ref('')
const showSubmissions = ref(true)
const submissions = ref(loadSubmissions())
const mapLoading = ref(true)
const tileError = ref(false)
// 点击“同位置多物种”标记后在图内底部展示位置清单，避免 Leaflet 弹窗被地图边界裁切
const activeGroup = ref(null)
let mapLoadTimer = null

/* ── 手动框选与地块 ────────────────────────────────────────── */
const plots = ref(loadPlots())
const showPlots = ref(true)
const panelOpen = ref(false)
// '' | 'rect' | 'poly'
const selectMode = ref('')
// { kind: 'rect'|'poly', ring: [[lat,lng],...], rect: {south,west,north,east}|null }
const selection = shallowRef(null)
// 多边形草稿顶点（显示坐标）
const polyDraft = shallowRef([])
const editingPlotId = ref('')
const formTouched = ref(false)
const liveBadge = ref(null)
const toast = ref(null)
const plotForm = reactive({ plotId: '', name: '', landuse: '草坪', color: '#AED581' })

let toastTimer = null
let rectDrag = null
let dragFrame = 0
let dragListenersOn = false
let previewRect = null
/** 触摸移动超过该距离才认为用户在框选，用于过滤握持误触 */
const DRAG_COMMIT_PX = 6
let dragCommitted = false
let selectionPolygon = null
let vertexMarkers = []
let draftShape = null
let draftVertexMarkers = []
let draftCursor = null
let snapHint = null
let snapPoint = null

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
  const kw = keyword.value.trim().toLowerCase()
  return speciesList.filter((s) => {
    if (family.value && s.family !== family.value) return false
    if (month.value && !bloomsIn(s, month.value)) return false
    if (kw && !searchText(s).includes(kw)) return false
    return true
  })
})

/** 全部已记录物种的点位（不受筛选影响），用于按物理位置合并 */
const mapPoints = computed(() => {
  const out = []
  for (const s of speciesList) {
    ;(s.points || []).forEach((p, pointIndex) => {
      out.push({ ...p, pointIndex, species: s })
    })
  }
  return out
})

const visibleIds = computed(() => new Set(visibleSpecies.value.map((s) => s.id)))

const visiblePoints = computed(() =>
  mapPoints.value.filter((p) => visibleIds.value.has(p.species.id))
)

/** 实际有分布点的物种数（待核实物种不计入） */
const mappedSpeciesCount = computed(
  () => new Set(visiblePoints.value.map((p) => p.species.id)).size
)

// 同一位置的多个物种合并为一组；弹窗始终列出该位置的全部物种，不受筛选影响
const markerGroups = computed(() =>
  groupPointsByLocation(mapPoints.value).map((group) => {
    const matched = group.points.filter((p) => visibleIds.value.has(p.species.id)).length
    // 命中的物种排在前面，便于弹窗和标签优先展示当前搜索目标
    const points = [...group.points].sort(
      (a, b) => Number(visibleIds.value.has(b.species.id)) - Number(visibleIds.value.has(a.species.id))
    )
    return { ...group, points, matched }
  })
)

const visibleMarkerGroups = computed(() =>
  markerGroups.value.filter((group) => group.matched > 0)
)

const filtering = computed(
  () => Boolean(family.value || month.value || keyword.value.trim())
)

/** 选区在数据坐标系（GCJ-02）下的顶点，框选分析统一走数据坐标 */
const selectionDataRing = computed(() =>
  selection.value ? selection.value.ring.map(([lat, lng]) => toDataLatLng(lat, lng)) : []
)

const analysis = computed(() =>
  selectionDataRing.value.length >= 3
    ? analyzeSelection(selectionDataRing.value, mapPoints.value, visibleIds.value)
    : null
)

const suggestion = computed(() =>
  analysis.value ? suggestPlotMeta(analysis.value, selectionDataRing.value, plots.value) : null
)

const selectHint = computed(() => {
  if (selectMode.value === 'rect') {
    return '按住鼠标拖动框选区域 · Esc 退出（退出后可拖动地图）'
  }
  if (selectMode.value === 'poly') {
    return polyDraft.value.length
      ? '继续点击添加顶点 · 双击或回车完成 · 点回起点闭合 · Backspace 撤销 · Esc 取消'
      : '沿地块边界依次点击 · 双击或回车完成 · Esc 退出'
  }
  return ''
})

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

/** 当前底图坐标 → 数据坐标（GCJ-02），用于框选分析、地块保存 */
function toDataLatLng(lat, lng) {
  if (coordMode !== 'wgs84') return { lat, lng }
  const [gl, ga] = wgs84ToGcj02(lng, lat)
  return { lat: ga, lng: gl }
}

/** 框选范围限制在校园范围内 */
function clampDisplayLatLng(latlng) {
  const d = toDataLatLng(latlng.lat, latlng.lng)
  const b = campus.bounds
  const lat = Math.min(b.north, Math.max(b.south, d.lat))
  const lng = Math.min(b.east, Math.max(b.west, d.lng))
  const [dLat, dLng] = toDisplayLatLng(lat, lng)
  return L.latLng(dLat, dLng)
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

/** 聚合标记：数字为该聚合下全部物种点位数，数字越大圆圈越大 */
function clusterIcon(cluster) {
  const count = cluster
    .getAllChildMarkers()
    .reduce((sum, marker) => sum + (marker._recordCount || 1), 0)
  const size = count < 10 ? 34 : count < 30 ? 40 : 46
  const tone = count < 10 ? 'sm' : count < 30 ? 'md' : 'lg'
  return L.divIcon({
    className: `marker-cluster marker-cluster-${tone}`,
    html: `<span>${count}</span>`,
    iconSize: L.point(size, size)
  })
}

/** 同一位置记录到多种植物时的合并标记 */
function multiIcon(count) {
  return L.divIcon({
    className: 'pin-multi-wrap',
    html: `<div class="pin-multi">${count}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -13]
  })
}

function groupTitle(group) {
  return group.points.length > 1
    ? `${group.points[0].species.nameCn} 等 ${group.points.length} 种`
    : group.points[0].species.nameCn
}

/** 合并后的位置可能包含多个地名写法（如「中区景观水池」「中区景观水池（西岸）」） */
function groupLocations(group) {
  return [...new Set(group.points.map((p) => p.location).filter(Boolean))].join(' / ')
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
  const ring = submissionRing(sub)
  if (ring) {
    const area = ringAreaM2(ring.map(([lat, lng]) => ({ lat, lng })))
    return `
      <div>
        ${img}
        <div class="popup-title">${escapeHtml(sub.name)}</div>
        <div class="popup-meta">我的投稿 · 地块分布${note}</div>
        <div class="popup-meta">分布范围：${escapeHtml(formatArea(area))}</div>
      </div>`
  }
  const coord =
    Number.isFinite(sub.lat) && Number.isFinite(sub.lng)
      ? `${sub.lat.toFixed(5)}, ${sub.lng.toFixed(5)}`
      : '—'
  return `
    <div>
      ${img}
      <div class="popup-title">${escapeHtml(sub.name)}</div>
      <div class="popup-meta">我的投稿${note}</div>
      <div class="popup-meta">坐标：${coord}</div>
    </div>`
}

/** 投稿地块的 [[lng,lat],...] → [[lat,lng],...]；不足 3 个有效顶点返回 null */
function submissionRing(sub) {
  if (!Array.isArray(sub?.polygon) || sub.polygon.length < 3) return null
  const ring = []
  for (const item of sub.polygon) {
    if (!Array.isArray(item) || item.length < 2) continue
    const lng = Number(item[0])
    const lat = Number(item[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    ring.push([lat, lng])
  }
  return ring.length >= 3 ? ring : null
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
  speciesMarkers.clear()
  activeGroup.value = null

  for (const group of visibleMarkerGroups.value) {
    const multi = group.points.length > 1
    const title = groupTitle(group)
    const marker = L.marker(toDisplayLatLng(group.lat, group.lng), {
      icon: multi ? multiIcon(group.points.length) : dotIcon(SPECIES_COLOR),
      title
    })
    marker._group = group
    if (multi) {
      // 同一位置多种植物：用图内清单展示全部物种，不依赖可能被裁切的弹窗
      marker.on('click', () => {
        activeGroup.value = group
      })
    } else {
      marker.bindPopup(popupHtml(group.points[0].species, group.points[0]))
      marker.on('click', () => {
        activeGroup.value = null
      })
    }
    // 放大到 18 级起显示物种名称（显隐由地图容器上的 .show-labels 控制）
    marker.bindTooltip(title, {
      permanent: true,
      direction: 'right',
      offset: multi ? [14, 0] : [7, 0],
      className: 'marker-label',
      opacity: 1
    })
    // 同组内每个物种的每个点位都指向这个合并标记，搜索定位仍可用
    for (const p of group.points) {
      speciesMarkers.set(`${p.species.id}:${p.pointIndex}`, marker)
    }
    // 聚合圆圈统计的是物种点位总数，而非合并后的标记数
    marker._recordCount = group.points.length
    speciesLayer.addLayer(marker)
  }

  if (showSubmissions.value) {
    for (const sub of submissions.value) {
      const ring = submissionRing(sub)
      if (ring) {
        // 投稿的地块范围：画成橙色块，点击查看照片与面积
        const polygon = L.polygon(
          ring.map(([lat, lng]) => toDisplayLatLng(lat, lng)),
          {
            color: SUB_COLOR,
            weight: 2,
            opacity: 0.95,
            fillColor: SUB_COLOR,
            fillOpacity: 0.2,
            dashArray: '5 4'
          }
        )
        polygon.bindPopup(subPopupHtml(sub))
        polygon.bindTooltip(sub.name, {
          permanent: true,
          direction: 'center',
          className: 'sub-label',
          opacity: 1
        })
        polygon.addTo(submissionLayer)
        continue
      }
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

/** 搜索联想选中：清掉会互相排斥的筛选，并定位到该物种的第一个分布点 */
function onSelectSpecies(species) {
  family.value = ''
  month.value = ''
  showSubmissions.value = true

  if (!(species.points || []).length) {
    router.push(`/species/${species.id}`)
    return
  }

  nextTick(() => {
    const marker = speciesMarkers.get(`${species.id}:0`)
    if (!marker) return
    // 聚合状态下先展开到该标记；同位置多物种时打开位置清单
    speciesLayer.zoomToShowLayer(marker, () => {
      if (marker._group && marker._group.points.length > 1) {
        activeGroup.value = marker._group
      } else {
        marker.openPopup()
      }
    })
  })
}

function reset() {
  family.value = ''
  month.value = ''
  keyword.value = ''
  showSubmissions.value = true
}

/* ── 手动框选：矩形 / 多边形 ─────────────────────────────── */

function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6
}

function setToast(text, tone = 'ok') {
  toast.value = { text, tone }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 2600)
}

function handleIcon() {
  return L.divIcon({
    className: 'plot-handle-wrap',
    html: '<span class="plot-handle"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

function startSelection(mode) {
  if (!map) return
  if (selectMode.value === mode) {
    stopSelection()
    return
  }
  // 极旧的内置浏览器没有 Pointer Events，退化为多边形点击（Leaflet 点击仍可用）
  if (mode === 'rect' && !('PointerEvent' in window)) {
    mode = 'poly'
    setToast('当前浏览器不支持拖拽框选，已切换为多边形框选', 'warn')
  }
  cancelDraft()
  removePreviewRect()
  liveBadge.value = null
  selectMode.value = mode
  setToast(
    mode === 'rect' ? '按住鼠标拖动，框出要统计的区域' : '沿地块边界依次点击，双击或回车完成'
  )
}

function stopSelection() {
  selectMode.value = ''
  rectDrag = null
  dragCommitted = false
  cancelDragFrame()
  endDragListeners()
  removePreviewRect()
  liveBadge.value = null
  cancelDraft()
}

function cancelDraft() {
  polyDraft.value = []
  draftCursor = null
  for (const m of draftVertexMarkers) drawLayer?.removeLayer(m)
  draftVertexMarkers = []
  if (draftShape && drawLayer) {
    drawLayer.removeLayer(draftShape)
    draftShape = null
  }
  snapPoint = null
  if (snapHint && drawLayer) {
    drawLayer.removeLayer(snapHint)
    snapHint = null
  }
}

function removePreviewRect() {
  if (previewRect && drawLayer) drawLayer.removeLayer(previewRect)
  previewRect = null
}

function ensureDraftShape() {
  if (!draftShape && drawLayer) {
    draftShape = L.polygon([], {
      color: '#1f6b4a',
      weight: 2,
      dashArray: '5 4',
      fillColor: '#3d9d73',
      fillOpacity: 0.1,
      interactive: false
    }).addTo(drawLayer)
  }
}

function updateDraftShape() {
  const pts = polyDraft.value.map(([lat, lng]) => L.latLng(lat, lng))
  if (!pts.length) {
    if (draftShape && drawLayer) {
      drawLayer.removeLayer(draftShape)
      draftShape = null
    }
    return
  }
  if (draftCursor) pts.push(draftCursor)
  ensureDraftShape()
  draftShape.setLatLngs(pts)
}

function renderDraftVertices() {
  if (!drawLayer) return
  for (const m of draftVertexMarkers) drawLayer.removeLayer(m)
  draftVertexMarkers = []
  polyDraft.value.forEach(([lat, lng], i) => {
    const icon = L.divIcon({
      className: '',
      html: `<span class="draft-dot${i === 0 ? ' first' : ''}"></span>`,
      iconSize: [11, 11],
      iconAnchor: [5.5, 5.5]
    })
    draftVertexMarkers.push(
      L.marker([lat, lng], { icon, interactive: false, keyboard: false, zIndexOffset: 1100 }).addTo(
        drawLayer
      )
    )
  })
}

/** 距离指针最近的分布点（像素吸附）；仅在 18 级单点可见时生效 */
function findSnapPoint(latlng) {
  if (!map || map.getZoom() < LABEL_ZOOM) return null
  const p = map.latLngToContainerPoint(latlng)
  let best = null
  let bestD = 12
  for (const pt of mapPoints.value) {
    if (!visibleIds.value.has(pt.species.id)) continue
    const q = map.latLngToContainerPoint(toDisplayLatLng(pt.lat, pt.lng))
    const d = p.distanceTo(q)
    if (d < bestD) {
      bestD = d
      best = pt
    }
  }
  return best
}

function onPolygonHover(e) {
  if (selectMode.value !== 'poly' || !map) return
  const snap = findSnapPoint(e.latlng)
  snapPoint = snap
  if (snap) {
    const [lat, lng] = toDisplayLatLng(snap.lat, snap.lng)
    if (!snapHint && drawLayer) {
      snapHint = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#9a6416',
        weight: 2,
        fillColor: '#fdf6e7',
        fillOpacity: 0.95,
        interactive: false
      }).addTo(drawLayer)
    } else if (snapHint) {
      snapHint.setLatLng([lat, lng])
    }
    draftCursor = L.latLng(lat, lng)
  } else {
    if (snapHint && drawLayer) {
      drawLayer.removeLayer(snapHint)
      snapHint = null
    }
    draftCursor = clampDisplayLatLng(e.latlng)
  }
  if (polyDraft.value.length) updateDraftShape()
}

function onPolygonClick(e) {
  if (selectMode.value !== 'poly' || !map) return
  if (e.originalEvent?.detail > 1) return

  let latlng = e.latlng
  if (snapPoint) latlng = L.latLng(...toDisplayLatLng(snapPoint.lat, snapPoint.lng))
  latlng = clampDisplayLatLng(latlng)

  const draft = polyDraft.value
  if (draft.length >= 3) {
    const first = map.latLngToContainerPoint(L.latLng(draft[0][0], draft[0][1]))
    if (first.distanceTo(map.latLngToContainerPoint(latlng)) <= 12) {
      finishPolygon()
      return
    }
  }
  if (draft.length) {
    const last = map.latLngToContainerPoint(
      L.latLng(draft[draft.length - 1][0], draft[draft.length - 1][1])
    )
    if (last.distanceTo(map.latLngToContainerPoint(latlng)) < 6) return
  }

  polyDraft.value = [...draft, [latlng.lat, latlng.lng]]
  draftCursor = null
  renderDraftVertices()
  updateDraftShape()
}

function onPolygonDblClick() {
  if (selectMode.value === 'poly') finishPolygon()
}

function undoDraftVertex() {
  if (!polyDraft.value.length) return
  polyDraft.value = polyDraft.value.slice(0, -1)
  renderDraftVertices()
  updateDraftShape()
}

function finishPolygon() {
  const draft = polyDraft.value
  if (draft.length < 3) {
    setToast('至少需要 3 个顶点才能围成区域', 'warn')
    return
  }
  const ring = draft.map(([lat, lng]) => [lat, lng])
  stopSelection()
  setSelection({ kind: 'poly', ring })
  const a = analysis.value
  setToast(a ? `已框选 ${formatArea(a.area)}，可拖动圆点微调` : '框选完成')
}

/* ── 矩形框选：指针拖拽（触摸 + 鼠标） ─────────────────── */

const DRAG_EVENT_OPTS = { capture: false, passive: false }

function beginDragListeners() {
  if (dragListenersOn) return
  dragListenersOn = true
  // 监听 window 而非地图容器：手指滑出地图或页面边缘时仍能收到 move/up
  window.addEventListener('pointermove', onMapPointerMove, DRAG_EVENT_OPTS)
  window.addEventListener('pointerup', onMapPointerUp, DRAG_EVENT_OPTS)
  window.addEventListener('pointercancel', onMapPointerCancel, DRAG_EVENT_OPTS)
}

function endDragListeners() {
  if (!dragListenersOn) return
  dragListenersOn = false
  window.removeEventListener('pointermove', onMapPointerMove, DRAG_EVENT_OPTS)
  window.removeEventListener('pointerup', onMapPointerUp, DRAG_EVENT_OPTS)
  window.removeEventListener('pointercancel', onMapPointerCancel, DRAG_EVENT_OPTS)
}

function cancelDragFrame() {
  if (dragFrame) {
    window.cancelAnimationFrame(dragFrame)
    dragFrame = 0
  }
}

function ensurePreviewRect(start) {
  if (!drawLayer) return
  if (!previewRect) {
    previewRect = L.rectangle(L.latLngBounds(start, start), {
      color: '#1f6b4a',
      weight: 2.5,
      dashArray: '6 5',
      fillColor: '#3d9d73',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(drawLayer)
  } else {
    previewRect.setBounds(L.latLngBounds(start, start))
  }
}

/** 按在已框选的四角圆点上：交给 Leaflet 的 marker 拖动做微调，不当作新框选 */
function isHandleTarget(target) {
  return !!target?.closest?.('.plot-handle-wrap, .area-handle-wrap')
}

/** 地图容器有圆角且被裁剪，手指常压在容器边缘甚至外面；允许外扩这么多像素起框 */
const MAP_EDGE_TOLERANCE = 24

/**
 * 把事件坐标收敛到地图容器内。
 * 返回 null 表示这次按下不在框选范围内，交给页面其他交互处理。
 */
function mapPointFromEvent(e) {
  const el = mapEl.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  if (
    e.clientX < r.left - MAP_EDGE_TOLERANCE ||
    e.clientX > r.right + MAP_EDGE_TOLERANCE ||
    e.clientY < r.top - MAP_EDGE_TOLERANCE ||
    e.clientY > r.bottom + MAP_EDGE_TOLERANCE
  ) {
    return null
  }
  return {
    x: Math.min(r.right - 1, Math.max(r.left + 1, e.clientX)),
    y: Math.min(r.bottom - 1, Math.max(r.top + 1, e.clientY))
  }
}

/** 事件坐标 → 数据坐标（已限制在校园范围内） */
function latLngFromEvent(e) {
  const p = mapPointFromEvent(e)
  if (!p) return null
  return clampDisplayLatLng(map.mouseEventToLatLng({ clientX: p.x, clientY: p.y }))
}

function onMapPointerDown(e) {
  if (selectMode.value !== 'rect' || !map) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (isHandleTarget(e.target)) return
  // 工具栏按钮、面板与地图浮层不参与起框（框选模式下缩放/图层已被 CSS 屏蔽）
  if (
    e.target?.closest?.(
      'button, a, input, select, textarea, .map-tools, .map-toast, .select-hint, .plot-panel, .live-badge'
    )
  ) {
    return
  }

  const hit = latLngFromEvent(e)
  if (!hit) return

  if (rectDrag) {
    // 已有手指按着：若它还没开始移动，说明多半是握持时的误触（拇指根部/掌根），
    // 把起点让给新落下的这根手指；已经开始拖了则忽略后续手指，避免起点被覆盖
    if (dragCommitted || rectDrag.pointerId === e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    rectDrag = { pointerId: e.pointerId, start: hit, current: hit }
    ensurePreviewRect(hit)
    return
  }

  e.preventDefault()
  e.stopPropagation()

  rectDrag = { pointerId: e.pointerId, start: hit, current: hit }
  dragCommitted = false
  beginDragListeners()
  try {
    mapEl.value?.setPointerCapture?.(e.pointerId)
  } catch (err) {
    /* iOS/旧版 WebView 可能拒绝指针捕获，window 监听已兜底 */
  }
  ensurePreviewRect(hit)
}

/** 用 rAF 合并高频 pointermove，低端手机上拖动更顺滑 */
function scheduleDragUpdate() {
  if (dragFrame) return
  dragFrame = window.requestAnimationFrame(() => {
    dragFrame = 0
    if (!rectDrag || !map) return
    const { start, current } = rectDrag
    const startPt = map.latLngToContainerPoint(start)
    const curPt = map.latLngToContainerPoint(current)
    if (Math.abs(startPt.x - curPt.x) < 3 && Math.abs(startPt.y - curPt.y) < 3) return

    const bounds = L.latLngBounds(start, current)
    previewRect?.setBounds(bounds)

    const ring = ringFromBounds({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast()
    })
    const live = analyzeSelection(
      ring.map((p) => toDataLatLng(p.lat, p.lng)),
      mapPoints.value,
      visibleIds.value
    )
    const width = mapEl.value?.clientWidth || 0
    liveBadge.value = {
      x: Math.min(Math.max(curPt.x, 84), Math.max(84, width - 84)),
      y: Math.max(26, curPt.y - 12),
      text: `${formatArea(live.area)} · ${live.count} 个点 · ${live.speciesCount} 种`
    }
  })
}

function onMapPointerMove(e) {
  if (!rectDrag || selectMode.value !== 'rect' || !map) return
  if (e.pointerId != null && e.pointerId !== rectDrag.pointerId) return
  // 手指滑出地图边缘时贴边继续框选，而不是中断
  const hit = latLngFromEvent(e)
  if (!hit) return
  e.preventDefault()
  e.stopPropagation()
  rectDrag.current = hit
  if (!dragCommitted) {
    const a = map.latLngToContainerPoint(rectDrag.start)
    const b = map.latLngToContainerPoint(hit)
    // 轻微抖动不算框选，避免握持误触直接生成一个零点几平米的选区
    if (Math.abs(a.x - b.x) < DRAG_COMMIT_PX && Math.abs(a.y - b.y) < DRAG_COMMIT_PX) return
    dragCommitted = true
  }
  scheduleDragUpdate()
}

/** 以起止两角生成矩形选区；up 与 cancel 共用 */
function commitRectDrag(start, end) {
  removePreviewRect()
  const startPt = map.latLngToContainerPoint(start)
  const endPt = map.latLngToContainerPoint(end)
  if (Math.abs(startPt.x - endPt.x) < 3 && Math.abs(startPt.y - endPt.y) < 3) {
    setToast('按住并拖动来框选区域', 'warn')
    return
  }

  const bounds = L.latLngBounds(start, end)
  const ring = ringFromBounds({
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast()
  })
  const area = ringAreaM2(ring.map((p) => toDataLatLng(p.lat, p.lng)))
  if (area < 8) {
    setToast('框选范围太小，请重新拖动', 'warn')
    return
  }
  stopSelection()
  setSelection({ kind: 'rect', ring: ring.map((p) => [p.lat, p.lng]) })
  setToast(`已框选 ${formatArea(area)}，可拖动四角圆点微调`)
}

function onMapPointerUp(e) {
  if (!rectDrag || !map) return
  if (e.pointerId != null && e.pointerId !== rectDrag.pointerId) return
  e.preventDefault()
  e.stopPropagation()

  const drag = rectDrag
  rectDrag = null
  dragCommitted = false
  cancelDragFrame()
  endDragListeners()
  try {
    mapEl.value?.releasePointerCapture?.(drag.pointerId)
  } catch (err) {
    /* 忽略 */
  }
  liveBadge.value = null

  // 快速滑动时 pointerup 可能早于最后一次 pointermove，直接用抬起点重算
  const end = latLngFromEvent(e) || drag.current
  commitRectDrag(drag.start, end)
}

/** 触屏手势被系统打断时：已拖出有效范围就按最后位置完成，避免整次框选凭空消失 */
function onMapPointerCancel(e) {
  if (!rectDrag) return
  if (e.pointerId != null && e.pointerId !== rectDrag.pointerId) return
  e.preventDefault?.()
  e.stopPropagation?.()
  try {
    mapEl.value?.releasePointerCapture?.(rectDrag.pointerId)
  } catch (err) {
    /* 忽略 */
  }

  const drag = rectDrag
  rectDrag = null
  const committed = dragCommitted
  dragCommitted = false
  cancelDragFrame()
  endDragListeners()
  liveBadge.value = null

  if (committed) commitRectDrag(drag.start, drag.current)
  else removePreviewRect()
}

/** 框选时屏蔽长按菜单，避免触发系统菜单打断拖动 */
function onMapContextMenu(e) {
  if (selectMode.value) e.preventDefault()
}

/* ── 选区：渲染、顶点微调与智能推荐 ─────────────────────── */

function setSelection(sel) {
  selection.value = sel
  panelOpen.value = true
  editingPlotId.value = ''
  formTouched.value = false
  rebuildSelectionLayer()
  applySuggestions(true)
  scrollPanelIntoView()
}

/** 窄屏时结果面板在地图下方，框选完成后自动滚到面板 */
function scrollPanelIntoView() {
  if (!window.matchMedia('(max-width: 999px)').matches) return
  nextTick(() => {
    plotPanelRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function clearSelection() {
  selection.value = null
  editingPlotId.value = ''
  formTouched.value = false
  if (selectionPolygon && drawLayer) drawLayer.removeLayer(selectionPolygon)
  selectionPolygon = null
  for (const m of vertexMarkers) drawLayer?.removeLayer(m)
  vertexMarkers = []
  liveBadge.value = null
  if (!plots.value.length) panelOpen.value = false
}

function rebuildSelectionLayer() {
  if (!drawLayer) return
  if (selectionPolygon) drawLayer.removeLayer(selectionPolygon)
  selectionPolygon = null
  for (const m of vertexMarkers) drawLayer.removeLayer(m)
  vertexMarkers = []

  const sel = selection.value
  if (!sel || sel.ring.length < 3) return
  selectionPolygon = L.polygon(
    sel.ring.map(([lat, lng]) => L.latLng(lat, lng)),
    {
      color: '#1f6b4a',
      weight: 2.5,
      opacity: 0.95,
      fillColor: '#3d9d73',
      fillOpacity: 0.16,
      dashArray: sel.kind === 'rect' ? '7 5' : null,
      interactive: false
    }
  ).addTo(drawLayer)

  sel.ring.forEach(([lat, lng], i) => {
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: handleIcon(),
      keyboard: false,
      zIndexOffset: 1200,
      title: '拖动圆点调整边界'
    })
    marker.on('drag', () => applyVertexDrag(i, marker.getLatLng()))
    marker.on('dragend', () => syncSelectionGeometry(-1))
    marker.addTo(drawLayer)
    vertexMarkers.push(marker)
  })
}

function applyVertexDrag(index, latlng) {
  const sel = selection.value
  if (!sel) return
  const ll = clampDisplayLatLng(latlng)

  if (sel.kind === 'rect') {
    const opposite = sel.ring[(index + 2) % 4]
    // 拖到与对角点同一经/纬度会得到 0 宽/0 高的退化矩形，保留上一次有效形状
    if (Math.abs(ll.lat - opposite[0]) * 111320 < 2) return
    if (Math.abs(ll.lng - opposite[1]) * 95700 < 2) return
    const ring = ringFromBounds({
      south: Math.min(ll.lat, opposite[0]),
      north: Math.max(ll.lat, opposite[0]),
      west: Math.min(ll.lng, opposite[1]),
      east: Math.max(ll.lng, opposite[1])
    }).map((p) => [p.lat, p.lng])
    selection.value = { ...sel, ring }
  } else {
    const ring = sel.ring.slice()
    ring[index] = [ll.lat, ll.lng]
    selection.value = { ...sel, ring }
  }
  syncSelectionGeometry(index)
}

function syncSelectionGeometry(skipIndex) {
  const sel = selection.value
  if (!sel) return
  selectionPolygon?.setLatLngs(sel.ring.map(([lat, lng]) => L.latLng(lat, lng)))
  vertexMarkers.forEach((m, i) => {
    if (i === skipIndex) return
    const [lat, lng] = sel.ring[i]
    m.setLatLng([lat, lng])
  })
}

function applySuggestions(force = false) {
  const s = suggestion.value
  if (!s) return
  if (!force && (formTouched.value || editingPlotId.value)) return
  plotForm.plotId = editingPlotId.value || nextPlotId(plots.value)
  plotForm.name = s.name
  plotForm.landuse = s.landuse
  plotForm.color = s.color
  formTouched.value = false
}

/** 一键纳入边界外 25 m 内的分布点 */
function expandSelection() {
  const sel = selection.value
  const nearby = analysis.value?.nearby || []
  if (!sel || !nearby.length) return
  const current = sel.ring.map(([lat, lng]) => ({ lat, lng }))
  const expanded =
    sel.kind === 'rect' ? expandRectRing(current, nearby) : expandRingToInclude(current, nearby)
  selection.value = {
    ...sel,
    ring: expanded.map((p) => [p.lat, p.lng]),
    rect: sel.kind === 'rect' ? boundsOfRing(expanded) : null
  }
  rebuildSelectionLayer()
  setToast(`已纳入边界外 ${nearby.length} 个分布点`)
}

/* ── 地块：保存 / 删除 / 导入导出 ───────────────────────── */

function buildPlotPayload() {
  if (!analysis.value || !selection.value) return null
  const ring = selectionDataRing.value
  const center = ringCenter(ring)
  const existing = plots.value.find((p) => p.plotId === editingPlotId.value)
  const now = new Date().toISOString()
  return {
    plotId: plotForm.plotId.trim(),
    name: plotForm.name.trim(),
    landuse: plotForm.landuse,
    color: plotForm.color,
    polygon: ring.map((p) => [round6(p.lng), round6(p.lat)]),
    center: [round6(center.lng), round6(center.lat)],
    dominantSpecies: analysis.value.species.slice(0, 3).map((s) => s.nameCn),
    areaSize: Math.round(analysis.value.area),
    note: existing?.note || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
}

function savePlot() {
  const payload = buildPlotPayload()
  if (!payload) {
    setToast('请先框选一个区域', 'warn')
    return
  }
  if (analysis.value && analysis.value.area < 10) {
    setToast('框选范围太小，请拖大一些再保存', 'warn')
    return
  }
  if (!payload.plotId) {
    setToast('请填写地块编号，如 Z-01', 'warn')
    return
  }
  if (!payload.name) {
    setToast('请填写地块名称', 'warn')
    return
  }
  const exists = plots.value.find((p) => p.plotId === payload.plotId)
  if (exists && payload.plotId !== editingPlotId.value) {
    setToast(`编号 ${payload.plotId} 已存在，请更换或从列表打开编辑`, 'warn')
    return
  }
  const previousId = editingPlotId.value
  if (exists) {
    plots.value = plots.value.map((p) => (p.plotId === payload.plotId ? payload : p))
  } else if (previousId && previousId !== payload.plotId) {
    // 编辑时改了编号：替换原记录，避免新旧两份同时存在
    plots.value = [...plots.value.filter((p) => p.plotId !== previousId), payload]
  } else {
    plots.value = [...plots.value, payload]
  }
  if (!persistPlots(plots.value)) {
    setToast('浏览器拒绝了本地保存，请点「导出」保存 JSON', 'warn')
  }
  editingPlotId.value = payload.plotId
  formTouched.value = true
  renderPlots()
  setToast(exists ? `已更新「${payload.name}」` : `已保存「${payload.name}」`)
}

function deleteEditingPlot() {
  const id = editingPlotId.value
  if (!id) return
  if (!window.confirm(`确定删除地块「${plotForm.name || id}」吗？`)) return
  plots.value = plots.value.filter((p) => p.plotId !== id)
  persistPlots(plots.value)
  editingPlotId.value = ''
  clearSelection()
  renderPlots()
  setToast('已删除地块')
}

function removePlot(id) {
  const target = plots.value.find((p) => p.plotId === id)
  if (!target) return
  if (!window.confirm(`确定删除地块「${target.name}」吗？`)) return
  plots.value = plots.value.filter((p) => p.plotId !== id)
  persistPlots(plots.value)
  if (editingPlotId.value === id) {
    editingPlotId.value = ''
    clearSelection()
  }
  renderPlots()
  setToast('已删除地块')
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch (err) {
      ok = false
    }
    ta.remove()
    return ok
  }
}

async function copySelection() {
  const payload = buildPlotPayload()
  if (!payload) return
  if (!payload.plotId) payload.plotId = nextPlotId(plots.value)
  if (!payload.name) payload.name = suggestion.value?.name || '未命名地块'
  const ok = await copyText(JSON.stringify(payload, null, 2))
  setToast(ok ? '已复制地块 JSON' : '复制被浏览器拦截，请改用「导出」', ok ? 'ok' : 'warn')
}

function exportPlots() {
  if (!plots.value.length) {
    setToast('还没有可导出的地块', 'warn')
    return
  }
  const blob = new Blob([JSON.stringify(plots.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'plots.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  setToast('已导出 plots.json')
}

async function importPlots(file) {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const result = mergePlots(plots.value, data)
    plots.value = result.list
    persistPlots(plots.value)
    renderPlots()
    const extra = result.skipped ? `，跳过 ${result.skipped} 条` : ''
    setToast(`导入完成：新增 ${result.added}，覆盖 ${result.replaced}${extra}`)
  } catch (e) {
    setToast('这个文件不是合法的 plots.json', 'warn')
  }
}

function openPlotManager() {
  panelOpen.value = true
  scrollPanelIntoView()
}

function closePanel() {
  panelOpen.value = false
}

/** 打开已保存地块：回填表单并缩放到该范围 */
function openSavedPlot(plot) {
  if (!map) return
  const ring = plot.polygon.map(([lng, lat]) => toDisplayLatLng(lat, lng))
  selection.value = { kind: 'poly', ring }
  editingPlotId.value = plot.plotId
  plotForm.plotId = plot.plotId
  plotForm.name = plot.name
  plotForm.landuse = plot.landuse
  plotForm.color = plot.color
  formTouched.value = true
  panelOpen.value = true
  rebuildSelectionLayer()
  map.flyToBounds(L.latLngBounds(ring), {
    paddingTopLeft: [40, 60],
    paddingBottomRight: [40, 40],
    maxZoom: map.getMaxZoom(),
    duration: 0.45
  })
  setToast(`已打开「${plot.name}」`)
}

/** 已保存地块的彩色面与名称标签 */
function renderPlots() {
  if (!plotsLayer) return
  plotsLayer.clearLayers()
  if (!showPlots.value) return

  for (const p of plots.value) {
    const latlngs = p.polygon.map(([lng, lat]) => toDisplayLatLng(lat, lng))
    if (latlngs.length < 3) continue
    const poly = L.polygon(latlngs, {
      color: p.color,
      weight: 1.8,
      opacity: 0.9,
      fillColor: p.color,
      fillOpacity: 0.15,
      dashArray: '4 3'
    })
    poly.bindTooltip(
      `<span class="plot-tip"><i style="background:${escapeHtml(p.color)}"></i>${escapeHtml(
        p.name
      )}</span>`,
      { permanent: true, direction: 'center', className: 'plot-label', opacity: 1 }
    )
    poly.on('click', (e) => {
      if (selectMode.value) return
      L.DomEvent.stopPropagation(e)
      openSavedPlot(p)
    })
    poly.addTo(plotsLayer)
  }
}

function onKeydown(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return

  if (e.key === 'Escape') {
    if (selectMode.value) {
      stopSelection()
      setToast('已退出框选')
    } else if (panelOpen.value) {
      panelOpen.value = false
    }
    return
  }
  if (selectMode.value !== 'poly') return
  if (e.key === 'Enter') {
    e.preventDefault()
    finishPolygon()
  } else if (e.key === 'Backspace') {
    e.preventDefault()
    undoDraftVertex()
  }
}

/** 切换底图坐标系：重设视野范围，并按新坐标系重绘标记与地块 */
function applyCoordMode(mode) {
  if (!map || mode === coordMode) return
  const prev = selection.value
  const dataRing = prev ? prev.ring.map(([lat, lng]) => toDataLatLng(lat, lng)) : null

  coordMode = mode
  map.setMaxBounds(displayBounds(campus.bounds))
  map.setView(
    toDisplayLatLng(campus.center.lat, campus.center.lng),
    map.getZoom(),
    { animate: false }
  )

  if (prev && dataRing) {
    const ring = dataRing.map((p) => toDisplayLatLng(p.lat, p.lng))
    selection.value = {
      ...prev,
      ring,
      rect:
        prev.kind === 'rect'
          ? boundsOfRing(ring.map(([lat, lng]) => ({ lat, lng })))
          : null
    }
    rebuildSelectionLayer()
  }

  renderMarkers()
  renderPlots()
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

  // 高德卫星图（GCJ-02，无需 key）：style=6 为影像，style=8 为透明路网注记，叠在一起使用
  const amapSatellite = L.layerGroup([
    L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
      subdomains: '1234',
      maxZoom: MAP_MAX,
      maxNativeZoom: NATIVE_MAX,
      attribution: '© 高德地图 卫星影像'
    }),
    L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}', {
      subdomains: '1234',
      maxZoom: MAP_MAX,
      maxNativeZoom: NATIVE_MAX
    })
  ])

  const baseLayers = {}
  if (tiandituEnabled) {
    baseLayers['天地图影像（含影像注记）'] = tdtImagery
    baseLayers['天地图矢量（含矢量注记）'] = tdtVector
    wgs84Layers.add(tdtImagery)
    wgs84Layers.add(tdtVector)
  }
  baseLayers['高德标准地图'] = gaodeStandard
  baseLayers['高德卫星图（含路网注记）'] = amapSatellite

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

  // 地块面在下、框选交互在上，物种标记由 markerCluster 放在最上层
  plotsLayer = L.layerGroup().addTo(map)
  drawLayer = L.layerGroup().addTo(map)

  speciesLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    // 地图只有 17–18 两级，聚合点直接跳到最大缩放展开，不做 spiderfy
    spiderfyOnMaxZoom: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 55,
    // 18 级为地图最大缩放，此级别完全展开，便于查看单个点位与名称
    disableClusteringAtZoom: LABEL_ZOOM,
    iconCreateFunction: clusterIcon
  })
  speciesLayer.on('clusterclick', (e) => {
    map.setView(e.layer.getLatLng(), map.getMaxZoom(), { animate: true })
  })
  speciesLayer.addTo(map)
  submissionLayer = L.layerGroup().addTo(map)

  renderMarkers()
  renderPlots()

  // 矩形框选：pointerdown 挂在 window，容器圆角/边缘之外 24px 也能起框；
  // move/up 在拖拽开始时也挂到 window，手指滑出地图仍能继续
  const el = mapEl.value
  window.addEventListener('pointerdown', onMapPointerDown, { capture: true, passive: false })
  el?.addEventListener('contextmenu', onMapContextMenu)
  window.addEventListener('keydown', onKeydown)

  map.on('zoomend', syncZoomMode)
  map.on('click', () => {
    activeGroup.value = null
  })
  map.on('click', onPolygonClick)
  map.on('dblclick', onPolygonDblClick)
  map.on('mousemove', onPolygonHover)
  map.on('baselayerchange', (e) => {
    tileError.value = false
    // 底图坐标系变化时正在描绘的顶点无法换算，直接结束本次框选
    if (selectMode.value) {
      stopSelection()
      setToast('切换底图，已取消本次框选', 'warn')
    }
    applyCoordMode(wgs84Layers.has(e.layer) ? 'wgs84' : 'gcj02')
  })
  syncZoomMode()
})

watch([family, month, keyword, showSubmissions], renderMarkers)
watch([showPlots, plots], renderPlots)

// 结果面板与地图并排时会改变地图宽度，需要让 Leaflet 重新计算尺寸
watch(panelOpen, () => {
  nextTick(() => map?.invalidateSize())
})

// 框选模式下锁定地图拖动 / 触摸缩放 / 双击缩放，退出后恢复
watch(selectMode, (mode) => {
  if (!map) return
  const el = mapEl.value
  el?.classList.toggle('is-framing', mode === 'rect')
  el?.classList.toggle('is-polygon', mode === 'poly')
  // 圆角裁剪后容器角落的触摸会落到外层，外层也要锁定 touch-action 才不会被页面滚动打断
  el?.closest('.map-layout')?.classList.toggle('is-framing', mode === 'rect')
  if (mode === 'rect') map.dragging.disable()
  else map.dragging.enable()
  if (mode) map.touchZoom?.disable()
  else map.touchZoom?.enable()
  if (mode === 'poly') map.doubleClickZoom.disable()
  else map.doubleClickZoom.enable()
  if (!mode) {
    snapPoint = null
    if (snapHint && drawLayer) {
      drawLayer.removeLayer(snapHint)
      snapHint = null
    }
  }
})

onBeforeUnmount(() => {
  if (mapLoadTimer) {
    window.clearTimeout(mapLoadTimer)
    mapLoadTimer = null
  }
  if (toastTimer) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  cancelDragFrame()
  endDragListeners()
  const el = mapEl.value
  el?.removeEventListener('pointerdown', onMapPointerDown, true)
  window.removeEventListener('pointerdown', onMapPointerDown, true)
  el?.removeEventListener('contextmenu', onMapContextMenu)
  window.removeEventListener('keydown', onKeydown)
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

.map-layout {
  display: grid;
  gap: 20px;
}

/* 宽屏时结果面板与地图并排，避免浮层挡住选区的边界手柄 */
@media (min-width: 1000px) {
  .map-layout.with-panel {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
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

.map.is-framing,
.map.is-polygon {
  cursor: crosshair;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* 框选时缩放/图层/比例尺不参与命中，四角与边缘区域也能正常起框；
   版权信息保留可点击，保持合规 */
.map.is-framing :deep(.leaflet-top),
.map.is-framing :deep(.leaflet-bottom.leaflet-left) {
  pointer-events: none;
}

/* 容器圆角处的触摸会命中外层，外层同样锁定才不会被页面滚动打断 */
.map-layout.is-framing {
  touch-action: none;
}

/* ── 手动框选：入口与地图浮层 ─────────────────────────────── */

.toolbar .draw-entry {
  padding: 10px 15px;
  border: 1px dashed var(--green-300);
  background: var(--green-050);
  color: var(--green-700);
  box-shadow: none;
}

.toolbar .draw-entry:hover {
  border-style: solid;
  background: var(--green-100);
}

.toolbar .draw-entry.active {
  border-style: solid;
  border-color: var(--green-700);
  background: var(--green-700);
  color: #fff;
}

.map-tools {
  position: absolute;
  z-index: 5;
  top: 12px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border-radius: 999px;
  transform: translateX(-50%);
}

.map-tools .tool {
  padding: 7px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}

.map-tools .tool:hover {
  background: var(--green-050);
  color: var(--green-700);
}

.map-tools .tool.active {
  background: var(--green-700);
  box-shadow: 0 6px 14px -8px rgba(18, 69, 50, 0.85);
  color: #fff;
}

.map-tools .tool.close {
  padding: 7px 10px;
  color: var(--ink-soft);
}

.select-hint {
  position: absolute;
  z-index: 5;
  top: 58px;
  left: 50%;
  max-width: calc(100% - 32px);
  margin: 0;
  padding: 6px 14px;
  border: 1px solid rgba(169, 216, 189, 0.85);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-sm);
  color: var(--green-700);
  font-size: 11.5px;
  line-height: 1.5;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.live-badge {
  position: absolute;
  z-index: 7;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(18, 69, 50, 0.9);
  box-shadow: 0 8px 20px -10px rgba(18, 69, 50, 0.75);
  color: #fff;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transform: translate(-50%, -115%);
  pointer-events: none;
}

.map-toast {
  position: absolute;
  z-index: 8;
  left: 50%;
  bottom: 16px;
  max-width: calc(100% - 40px);
  padding: 8px 15px;
  border-radius: 999px;
  background: rgba(18, 69, 50, 0.92);
  box-shadow: 0 12px 28px -14px rgba(18, 69, 50, 0.8);
  color: #fff;
  font-size: 12px;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.map-toast.warn {
  background: rgba(154, 100, 22, 0.94);
}

:deep(.plot-handle-wrap) {
  border: none;
  background: transparent;
}

:deep(.plot-handle) {
  display: block;
  width: 14px;
  height: 14px;
  border: 2.5px solid var(--green-700);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  cursor: grab;
}

:deep(.plot-handle:active) {
  cursor: grabbing;
}

:deep(.draft-dot) {
  display: block;
  width: 9px;
  height: 9px;
  border: 2px solid var(--green-700);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

:deep(.draft-dot.first) {
  border-color: #9a6416;
  background: #fdf6e7;
}

:deep(.plot-label) {
  padding: 1px 6px;
  border: 1px solid rgba(46, 125, 50, 0.35);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  color: #1b4d24;
  font-size: 10.5px;
  white-space: nowrap;
}

:deep(.plot-label::before) {
  display: none;
}

:deep(.plot-tip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.plot-tip i) {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.narrow-only {
  display: none;
}

@media (max-width: 760px) {
  .toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: end;
    gap: 10px 12px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .toolbar .f.grow {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .toolbar .f select,
  .toolbar .f input {
    width: 100%;
  }

  .toolbar .check {
    min-height: 40px;
    padding-bottom: 0;
    align-self: center;
  }

  .toolbar .btn {
    width: 100%;
    min-height: 42px;
  }

  .toolbar > .btn:last-child {
    grid-column: 1 / -1;
  }

  /* 手机上去掉透明按钮样式，保证可点区域清晰可见 */
  .toolbar .btn-ghost {
    border-color: var(--line);
    background: #fff;
  }

  .map {
    height: 58vh;
    min-height: 340px;
  }

  .map-tools {
    top: 8px;
    padding: 3px;
  }

  .map-tools .tool {
    padding: 8px 9px;
    font-size: 11.5px;
  }

  .select-hint {
    top: 52px;
    padding: 5px 10px;
    font-size: 10.8px;
  }

  .location-card {
    right: 8px;
    bottom: 8px;
    left: 8px;
    max-height: 52%;
  }

  .location-close {
    width: 32px;
    height: 32px;
  }
}

@media (max-width: 640px) {
  .wide-only {
    display: none;
  }

  .narrow-only {
    display: inline;
  }

  /* 地图页优先把首屏留给地图，说明文字在下方提示里已有 */
  .map-page .page-sub {
    display: none;
  }

  .map-page .page-head {
    margin-bottom: 16px;
  }

  .toolbar {
    padding: 12px;
    gap: 9px 10px;
  }

  .toolbar .draw-entry {
    padding: 10px 8px;
    font-size: 13px;
  }

  .map-toast {
    bottom: 10px;
    font-size: 11.5px;
  }
}

/* 触屏设备：放大控件与边界圆点的可点击范围 */
@media (hover: none) and (pointer: coarse) {
  .map-tools .tool {
    min-height: 36px;
  }

  .map-tools .tool.close {
    min-width: 38px;
  }

  :deep(.leaflet-control-zoom a) {
    width: 36px;
    height: 36px;
    line-height: 36px;
    font-size: 19px;
  }

  :deep(.plot-handle-wrap)::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
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

/* 同位置多物种：图内底部清单，避免弹窗被地图边界裁切 */
.location-card {
  position: absolute;
  z-index: 5;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  max-height: min(48%, 320px);
  overflow: hidden;
  border-color: rgba(169, 216, 189, 0.85);
  box-shadow: 0 22px 46px -26px rgba(18, 69, 50, 0.6), 0 2px 8px rgba(18, 69, 50, 0.08);
}

.location-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(140deg, #f4faf5, #fff);
}

.location-head h4 {
  margin: 0 0 3px;
  color: var(--ink-strong);
  font-size: 15px;
  font-weight: 700;
}

.location-head p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
}

.location-close {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1;
}

.location-close:hover {
  border-color: var(--green-300);
  background: var(--green-050);
  color: var(--green-700);
}

.location-list {
  flex: 1;
  margin: 0;
  padding: 4px 16px 10px;
  overflow-y: auto;
  list-style: none;
}

.location-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px dashed var(--line);
}

.location-list li:first-child {
  border-top: none;
}

.location-name {
  flex: 0 0 auto;
  color: var(--green-700);
  font-size: 13.5px;
  font-weight: 650;
}

.location-name:hover {
  text-decoration: underline;
}

.location-sub {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.location-chat {
  flex: 0 0 auto;
  color: var(--green-600);
  font-size: 11.5px;
}

.location-chat:hover {
  color: var(--green-700);
  text-decoration: underline;
}

.location-enter-active,
.location-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.location-enter-from,
.location-leave-to {
  opacity: 0;
  transform: translateY(10px);
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

.hint-link {
  color: var(--green-700);
  font-weight: 600;
  border-bottom: 1px dashed rgba(31, 107, 74, 0.4);
}

.hint-link:hover {
  color: var(--green-600);
  border-bottom-style: solid;
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

/* 我的投稿地块的名称标签（橙色系，和物种标签区分） */
:deep(.sub-label) {
  padding: 1px 6px;
  border: 1px solid rgba(224, 142, 11, 0.45);
  border-radius: 6px;
  background: rgba(255, 251, 240, 0.94);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  color: #8a5a10;
  font-size: 10.5px;
  white-space: nowrap;
}

:deep(.sub-label::before) {
  display: none;
}

:deep(.leaflet-tooltip-right::before) {
  display: none;
}
</style>
