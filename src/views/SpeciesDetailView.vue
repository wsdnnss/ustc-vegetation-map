<template>
  <div v-if="species">
    <router-link to="/species" class="back btn btn-ghost">← 返回物种库</router-link>

    <div class="detail card">
      <div class="cover">
        <div v-if="!coverLoaded" class="cover-skeleton skeleton" aria-hidden="true"></div>
        <img
          ref="coverEl"
          :src="cover"
          :alt="species.nameCn"
          :class="{ 'is-loaded': coverLoaded }"
          @load="coverLoaded = true"
          @error="onCoverError"
        />
        <span class="habit">{{ species.habit }}</span>
      </div>

      <div class="info">
        <p class="eyebrow">Species Profile</p>
        <div class="name-row">
          <h2 class="name">{{ species.nameCn }}</h2>
          <span class="status" :class="species.status === '待核实' ? 'todo' : 'done'">
            {{ species.status }}
          </span>
        </div>
        <p class="latin">{{ species.nameLatin }}</p>
        <p v-if="aliases.length" class="alias">
          <span class="alias-label">别名</span>{{ aliases.join('、') }}
        </p>

        <div class="facts">
          <div class="fact"><span>科</span><b>{{ species.family }}</b></div>
          <div class="fact"><span>属</span><b>{{ species.genus }}</b></div>
          <div class="fact"><span>花期</span><b>{{ species.bloomText }}</b></div>
          <div class="fact"><span>果期</span><b>{{ species.fruitText }}</b></div>
        </div>

        <div class="tags">
          <span v-for="t in species.tags" :key="t" class="tag">{{ t }}</span>
        </div>

        <p class="desc">{{ species.description }}</p>
      </div>
    </div>

    <section v-if="species.identify" class="block">
      <h3 class="block-title">识别特征</h3>
      <div class="card prose">{{ species.identify }}</div>
    </section>

    <section v-if="species.nameOrigin" class="block">
      <h3 class="block-title">学名来源</h3>
      <div class="card prose">{{ species.nameOrigin }}</div>
    </section>

    <section v-if="points.length" class="block">
      <h3 class="block-title">分布位置（{{ points.length }} 处）</h3>
      <div class="split">
        <ul class="point-list card">
          <li v-for="(p, i) in points" :key="i">
            <span class="idx">{{ i + 1 }}</span>
            <span class="loc">{{ p.location }}</span>
            <span class="coord muted">{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</span>
            <router-link class="point-chat" :to="`/community?species=${species.id}&point=${i}`">
              讨论<template v-if="postCountOf(i)"> {{ postCountOf(i) }}</template>
            </router-link>
          </li>
        </ul>
        <div ref="miniMapEl" class="mini-map card"></div>
      </div>
    </section>

    <section v-else class="block">
      <h3 class="block-title">分布位置</h3>
      <div class="card notice notice-empty">
        <span class="notice-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28" fill="none">
            <path
              d="M24 8c-5.5 3.3-8.6 7.4-8.6 12.2A8.6 8.6 0 0 0 24 28.8a8.6 8.6 0 0 0 8.6-8.6C32.6 15.4 29.5 11.3 24 8z"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.65"
            />
            <path d="M24 12v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55" />
            <path
              d="M24 38c0-4 0-7 0-9M24 33c-3.4 0-6-1.4-7.8-4M24 36c3.2 0 5.8-1.3 7.5-3.8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              opacity="0.5"
            />
          </svg>
        </span>
        <div>
          <b>尚未在校园内定位</b><br />
          该物种按合肥（华东）地区常见种列入候选库，暂未在中区实地记录分布点。
          实地确认后，可在「上传投稿」或「批量导入」中补充分布位置。
        </div>
      </div>
    </section>

    <section v-if="relatedSubs.length" class="block">
      <h3 class="block-title">我的投稿照片（{{ relatedSubs.length }} 张）</h3>
      <div class="gallery">
        <figure v-for="sub in relatedSubs" :key="sub.id" class="shot card">
          <img v-if="sub.image" :src="sub.image" :alt="sub.name" />
          <figcaption>
            <span>{{ sub.name }}</span>
            <small class="muted">{{ sub.note || '无备注' }}</small>
          </figcaption>
        </figure>
      </div>
    </section>

    <p v-if="reference" class="ref muted">
      参考书目：《{{ reference.title }}》，{{ reference.authors }}，{{ reference.publisher }}。
    </p>
  </div>

  <div v-else class="empty card">
    未找到该物种，可能链接有误。<router-link to="/species">返回物种库</router-link>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import L from 'leaflet'
import { getSpeciesById, speciesImage, campus, aliasesOf, reference } from '@/utils/species'
import { loadSubmissions } from '@/utils/storage'
import { loadPosts, pointPostCounts } from '@/utils/community'

const route = useRoute()
const species = getSpeciesById(route.params.id)

const points = computed(() => species?.points || [])
const aliases = computed(() => aliasesOf(species))
const postCounts = pointPostCounts(loadPosts())

function postCountOf(index) {
  return postCounts[`${species.id}:${index}`] || 0
}

const miniMapEl = ref(null)
let miniMap = null

const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='480'%3E%3Crect width='800' height='480' fill='%23eef7ee'/%3E%3Cpath d='M400 140c-58 34-96 82-96 140a96 96 0 0 0 192 0c0-58-38-106-96-140z' fill='%23a5d6a7'/%3E%3Cpath d='M400 180v180' stroke='%232e7d32' stroke-width='4'/%3E%3Ctext x='400' y='392' font-size='22' fill='%235b6b62' text-anchor='middle' font-family='sans-serif'%3E暂无图片%3C/text%3E%3C/svg%3E"

const cover = ref(species ? speciesImage(species) : '')
const coverLoaded = ref(false)
const coverEl = ref(null)
function onCoverError(e) {
  if (e.target.src.startsWith('data:')) return
  e.target.src = FALLBACK
}

onMounted(() => {
  if (coverEl.value?.complete) coverLoaded.value = true
})

const relatedSubs = computed(() => {
  if (!species) return []
  return loadSubmissions().filter(
    (s) => s.speciesId === species.id || s.name === species.nameCn
  )
})

onMounted(() => {
  if (!species || !miniMapEl.value) return
  const pts = species.points || []
  if (!pts.length) return

  const maxZoom = campus.maxZoom || 19
  miniMap = L.map(miniMapEl.value, {
    zoomControl: false,
    attributionControl: false,
    minZoom: campus.minZoom || 16,
    maxZoom
  })
  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom, maxNativeZoom: 18 }
  ).addTo(miniMap)

  const icon = L.divIcon({
    className: '',
    html: `<div class="pin-dot" style="background:#2e7d32"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5]
  })

  const latlngs = pts.map((p) => [p.lat, p.lng])
  latlngs.forEach((ll, i) => {
    L.marker(ll, { icon })
      .bindPopup(pts[i].location || '分布点')
      .addTo(miniMap)
  })

  if (latlngs.length === 1) {
    miniMap.setView(latlngs[0], 18)
  } else {
    miniMap.fitBounds(latlngs, { padding: [40, 40], maxZoom: 18 })
  }
})

onBeforeUnmount(() => {
  if (miniMap) {
    miniMap.remove()
    miniMap = null
  }
})
</script>

<style scoped>
.back {
  display: inline-flex;
  margin-bottom: 16px;
  padding: 8px 0;
}

.detail {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  margin-bottom: 32px;
}

.cover {
  position: relative;
  min-height: 300px;
  background: var(--green-050);
}

.cover::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  height: 34%;
  background: linear-gradient(to top, rgba(10, 30, 20, 0.38), transparent);
  pointer-events: none;
}

.cover-skeleton {
  position: absolute;
  inset: 0;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.35s ease;
}

.cover img.is-loaded {
  opacity: 1;
}

.habit {
  position: absolute;
  z-index: 2;
  left: 14px;
  bottom: 14px;
  padding: 4px 11px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(15, 35, 25, 0.42);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 12px;
}

.info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 32px 36px;
}

.info .eyebrow {
  margin-bottom: 10px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.name {
  margin: 0;
  color: var(--ink-strong);
  font-size: clamp(26px, 3vw, 32px);
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.status {
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
}

.status.done {
  border: 1px solid var(--green-200);
  background: var(--green-050);
  color: var(--green-700);
}

.status.todo {
  border: 1px solid #f0dfbe;
  background: var(--amber-050);
  color: var(--amber);
}

.notice {
  padding: 22px 24px;
  border-color: #f0dfbe;
  background: var(--amber-050);
  color: #5d4a24;
  font-size: 14px;
  line-height: 1.85;
}

.notice-empty {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.notice-icon {
  display: grid;
  place-items: center;
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 0 0 1px rgba(240, 223, 190, 0.9);
  color: var(--amber);
}

.latin {
  margin: 5px 0 10px;
  color: var(--ink-soft);
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 14px;
}

.alias {
  margin: 0 0 16px;
  color: #47584e;
  font-size: 13.5px;
}

.alias-label {
  display: inline-block;
  margin-right: 7px;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 12px;
}

.prose {
  padding: 22px 24px;
  color: #33463c;
  font-size: 14.5px;
  line-height: 1.95;
}

.ref {
  margin: 20px 2px 0;
  font-size: 12.5px;
  line-height: 1.7;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fafcf8;
}

.fact span {
  color: var(--ink-soft);
  font-size: 11.5px;
}

.fact b {
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 650;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.desc {
  margin: 0;
  color: #33463c;
  font-size: 14.5px;
  line-height: 1.8;
}

.block {
  margin-bottom: 32px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 12px;
  color: var(--ink-strong);
  font-size: 16.5px;
  font-weight: 700;
}

.block-title::before {
  content: '';
  width: 4px;
  height: 16px;
  border-radius: 4px;
  background: var(--green-500);
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 20px;
}

.point-list {
  margin: 0;
  padding: 6px;
  list-style: none;
  max-height: 340px;
  overflow: auto;
}

.point-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  transition: background 0.16s ease;
}

.point-list li:hover {
  background: var(--green-050);
}

.point-list li + li {
  border-top: 1px solid #f0f4ef;
}

.idx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 12px;
  font-weight: 700;
}

.loc {
  flex: 1;
  font-size: 14px;
}

.coord {
  color: var(--ink-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.point-chat {
  flex: 0 0 auto;
  padding: 4px 11px;
  border: 1px solid var(--green-200);
  border-radius: 999px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 12px;
  font-weight: 600;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.point-chat:hover {
  border-color: var(--green-500);
  background: var(--green-100);
}

.mini-map {
  height: 340px;
  overflow: hidden;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 18px;
}

.shot {
  margin: 0;
  overflow: hidden;
}

.shot img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: var(--green-050);
}

.shot figcaption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 11px;
  font-size: 13px;
}

.shot small {
  font-size: 12px;
}

@media (max-width: 760px) {
  .detail,
  .split {
    grid-template-columns: 1fr;
  }
  .info {
    padding: 26px 24px;
  }
  .mini-map {
    height: 240px;
  }
}
</style>
