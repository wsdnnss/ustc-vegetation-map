<template>
  <div class="season-page" :class="`season-${season.key}`">
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Seasonal Guide</p>
        <h2 class="page-title">季节专题</h2>
        <p class="page-sub">
          按月份查看校园植物的花期与果期。切换月份即可看到当月正在开花或结果的物种，并可一键回到地图查看分布点。
        </p>
      </div>
      <div class="stats">
        <span class="stat"><b>{{ bloom.length }}</b> 种本月开花</span>
        <span class="stat"><b>{{ fruit.length }}</b> 种本月结果</span>
        <span class="stat amber"><b>{{ recordedInMonth }}</b> 种已定位</span>
      </div>
    </div>

    <div class="month-rail card glass" role="tablist" aria-label="选择月份">
      <button
        v-for="m in 12"
        :key="m"
        type="button"
        role="tab"
        :aria-selected="m === month"
        :aria-current="m === currentMonth ? 'date' : undefined"
        :class="{ active: m === month, now: m === currentMonth }"
        @click="month = m"
      >
        <b>{{ m }}</b>
        <small>{{ monthCount(m) }}</small>
        <span class="sr-only">月</span>
      </button>
    </div>

    <section class="hero card">
      <div class="hero-main">
        <p class="hero-season">{{ season.label }}季 · {{ month }} 月</p>
        <h3>{{ month }} 月的{{ mode === 'bloom' ? '花' : '果' }}</h3>
        <p class="hero-text">{{ summary }}</p>
        <p class="hero-note">{{ season.note }}</p>
        <div class="hero-actions">
          <router-link class="btn btn-primary" :to="{ path: '/', query: { month } }">
            在地图上查看本月{{ modeLabel }}
          </router-link>
          <router-link class="btn" to="/species">去物种库</router-link>
        </div>
      </div>
      <div class="hero-num" aria-hidden="true">
        <span>{{ month }}</span>
        <small>月</small>
      </div>
    </section>

    <div class="toolbar">
      <div class="segmented" role="tablist" aria-label="查看类型">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'bloom'"
          :class="{ active: mode === 'bloom' }"
          @click="mode = 'bloom'"
        >
          观花 · {{ bloom.length }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'fruit'"
          :class="{ active: mode === 'fruit' }"
          @click="mode = 'fruit'"
        >
          观果 · {{ fruit.length }}
        </button>
      </div>
      <label class="check">
        <input v-model="onlyRecorded" type="checkbox" />
        <span>只看已记录（有校园分布点）</span>
      </label>
    </div>

    <p class="count muted">
      {{ month }} 月{{ modeLabel }}共 <b>{{ list.length }}</b> 种<template v-if="onlyRecorded">
        （已剔除未定位物种）</template
      >
    </p>

    <div v-if="shown.length" class="grid">
      <SpeciesCard v-for="s in shown" :key="s.id" :species="s" />
    </div>
    <div v-else class="card empty-state">
      <div class="empty-art" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
          <circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2" opacity="0.35" />
          <path
            d="M32 15c-6.6 3.9-10.3 8.8-10.3 14.6a10.3 10.3 0 0 0 20.6 0C42.3 23.8 38.6 18.9 32 15z"
            stroke="currentColor"
            stroke-width="2.2"
            opacity="0.55"
          />
          <path d="M32 52V32" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.55" />
        </svg>
      </div>
      <h4>这个筛选下暂时没有物种</h4>
      <p>可以取消「只看已记录」，或换一个月份看看。</p>
      <button class="btn" type="button" @click="onlyRecorded = false">查看全部物种</button>
    </div>

    <div v-if="shown.length < list.length" class="more-row">
      <button class="btn" type="button" @click="visibleCount += 18">
        显示更多（还有 {{ list.length - shown.length }} 种）
      </button>
    </div>

    <p class="footnote muted">
      说明：花期取自物种数据的开花月份；果期由「果期」文字自动解析，跨年结果按月份对应。花期记为
      0 的物种（竹类罕见开花、蕨类孢子繁殖）不参与月度统计。分布点仍为演示用示例坐标。
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import SpeciesCard from '@/components/SpeciesCard.vue'
import {
  speciesList,
  bloomsIn,
  fruitsIn,
  hasPoints,
  seasonOf
} from '@/utils/species'

const currentMonth = new Date().getMonth() + 1
const month = ref(currentMonth)
const mode = ref('bloom')
const onlyRecorded = ref(false)
const visibleCount = ref(18)

const modeLabel = computed(() => (mode.value === 'bloom' ? '开花' : '结果'))
const season = computed(() => seasonOf(month.value))

const bloom = computed(() => speciesList.filter((s) => bloomsIn(s, month.value)))
const fruit = computed(() => speciesList.filter((s) => fruitsIn(s, month.value)))
const recordedInMonth = computed(
  () => new Set([...bloom.value, ...fruit.value].filter(hasPoints).map((s) => s.id)).size
)

/** 月份切换条上的数字：跟随当前「观花 / 观果」模式 */
function monthCount(m) {
  return speciesList.filter((s) => (mode.value === 'bloom' ? bloomsIn(s, m) : fruitsIn(s, m))).length
}

const list = computed(() => {
  const source = mode.value === 'bloom' ? bloom.value : fruit.value
  const filtered = onlyRecorded.value ? source.filter(hasPoints) : source
  return [...filtered].sort(
    (a, b) =>
      Number(hasPoints(b)) - Number(hasPoints(a)) ||
      a.nameCn.localeCompare(b.nameCn, 'zh-Hans-CN')
  )
})

const shown = computed(() => list.value.slice(0, visibleCount.value))

const summary = computed(() => {
  const total = mode.value === 'bloom' ? bloom.value.length : fruit.value.length
  const recorded = (mode.value === 'bloom' ? bloom.value : fruit.value).filter(hasPoints).length
  const action = mode.value === 'bloom' ? '处于花期' : '处于果期'
  const names = list.value
    .filter(hasPoints)
    .slice(0, 3)
    .map((s) => s.nameCn)
  const tip = names.length
    ? `可以重点观察：${names.join('、')}。`
    : '这些物种尚未在校园内定位，可先读图鉴再实地寻找。'
  return `${month.value} 月共有 ${total} 种植物${action}，其中 ${recorded} 种已在校园内记录分布点。${tip}`
})

watch([month, mode, onlyRecorded], () => {
  visibleCount.value = 18
})
</script>

<style scoped>
.season-page {
  --season: var(--green-600);
  --season-soft: #eef8ef;
  --season-line: rgba(61, 157, 115, 0.28);
}

.season-summer {
  --season: #1f6b4a;
  --season-soft: #e6f2ea;
  --season-line: rgba(31, 107, 74, 0.28);
}

.season-autumn {
  --season: #9a6416;
  --season-soft: #fdf6e7;
  --season-line: rgba(154, 100, 22, 0.3);
}

.season-winter {
  --season: #4b6c7a;
  --season-soft: #eef3f5;
  --season-line: rgba(75, 108, 122, 0.3);
}

/* ---------- 月份切换 ---------- */
.month-rail {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
  padding: 8px;
  margin-bottom: 20px;
}

.month-rail button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 2px 7px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: var(--ink-soft);
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.month-rail button b {
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.month-rail button small {
  color: #8b9a90;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.month-rail button:hover {
  background: var(--season-soft);
}

.month-rail button.now {
  border-color: var(--season-line);
}

.month-rail button.active {
  border-color: transparent;
  background: var(--season);
  box-shadow: 0 8px 18px -12px rgba(18, 69, 50, 0.9);
}

.month-rail button.active b,
.month-rail button.active small {
  color: #fff;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---------- 季节横幅 ---------- */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  padding: 26px 30px;
  margin-bottom: 20px;
  border-color: var(--season-line);
  background:
    radial-gradient(120% 140% at 100% 0%, var(--season-soft), transparent 62%),
    linear-gradient(140deg, #fff, var(--season-soft));
}

.hero::after {
  content: '';
  position: absolute;
  right: -60px;
  bottom: -90px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: var(--season);
  opacity: 0.08;
  pointer-events: none;
}

.hero-main {
  position: relative;
  z-index: 1;
  max-width: 620px;
}

.hero-season {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 8px;
  padding: 4px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--season);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hero-season::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--season);
}

.hero h3 {
  margin: 0 0 8px;
  color: var(--ink-strong);
  font-size: clamp(21px, 2.4vw, 26px);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.hero-text {
  margin: 0 0 8px;
  color: #33463c;
  font-size: 14px;
  line-height: 1.8;
  text-wrap: pretty;
}

.hero-note {
  margin: 0 0 16px;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-actions .btn-primary {
  border-color: var(--season);
  background: var(--season);
}

.hero-actions .btn-primary:hover {
  filter: brightness(1.06);
}

.hero-num {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  color: var(--season);
  opacity: 0.24;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.hero-num span {
  font-size: clamp(64px, 9vw, 96px);
  font-weight: 800;
  letter-spacing: -0.06em;
}

.hero-num small {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 700;
}

/* ---------- 工具条 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 12px;
}

.segmented {
  display: inline-flex;
  padding: 4px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--green-050);
}

.segmented button {
  padding: 8px 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.segmented button:hover {
  color: var(--green-700);
}

.segmented button.active {
  background: #fff;
  box-shadow: 0 4px 12px -8px rgba(18, 69, 50, 0.6);
  color: var(--green-700);
}

.check {
  display: flex;
  align-items: center;
  gap: 7px;
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

.count {
  margin: 0 2px 20px;
  font-size: 13px;
}

.count b {
  color: var(--green-700);
  font-size: 15px;
}

/* ---------- 列表 ---------- */
.grid {
  columns: 4 230px;
  column-gap: var(--gap-grid);
}

.grid > * {
  display: block;
  break-inside: avoid;
  margin-bottom: var(--gap-grid);
}

.more-row {
  display: flex;
  justify-content: center;
  margin: 8px 0 4px;
}

.footnote {
  margin: 22px 2px 0;
  font-size: 12px;
  line-height: 1.8;
}

@media (max-width: 1100px) {
  .grid {
    columns: 3 220px;
  }
}

@media (max-width: 820px) {
  .month-rail {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .grid {
    columns: 2 210px;
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 22px 20px;
  }

  .hero-num {
    display: none;
  }

  .segmented {
    width: 100%;
  }

  .segmented button {
    flex: 1;
    padding: 8px 10px;
  }

  .grid {
    columns: 2 150px;
    column-gap: 14px;
  }

  .grid > * {
    margin-bottom: 14px;
  }
}
</style>
