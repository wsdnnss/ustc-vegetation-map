<template>
  <div class="photo-identify">
    <div v-if="!image" class="idle">
      <p>先选择一张植物照片，就可以在本地识别它。</p>
    </div>

    <template v-else>
      <p class="model-tip">
        照片只在本机识别，不会上传。首次使用需下载约 43 MB 模型，之后可离线使用。
      </p>

      <button
        v-if="status === 'idle' || status === 'error'"
        type="button"
        class="btn btn-primary run"
        @click="run"
      >
        识别这张照片
      </button>

      <div v-if="status === 'loading'" class="progress" role="status" aria-live="polite">
        <p>
          {{ fromCache ? '正在载入本地模型…' : caching ? '正在缓存模型…' : '正在下载识别模型…' }}
          <b v-if="!fromCache">
            {{ percent }}%<template v-if="totalMb"> · {{ loadedMb }} / {{ totalMb }} MB</template>
          </b>
        </p>
        <div class="bar"><i :style="{ width: `${fromCache ? 100 : percent}%` }" /></div>
        <small class="muted">模型约 43 MB，浏览器会缓存，下次无需重新下载。</small>
      </div>

      <p v-if="status === 'running'" class="progress-text" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true" />
        正在识别…
      </p>

      <p v-if="status === 'error'" class="err" role="alert">{{ errorText }}</p>

      <div v-if="status === 'done' && result" class="result">
        <div class="result-head">
          <h4>
            识别结果
            <small>本地模型 · 4271 种植物</small>
          </h4>
          <button type="button" class="again" @click="run">
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <path
                d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5V7h-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            重新识别
          </button>
        </div>

        <p v-if="!result.likelyPlant" class="warn">
          没有识别到明显的植物主体，可能是照片不清晰或主体不是植物。下面是模型给出的最接近候选。
        </p>

        <template v-if="top">
          <article class="hero" :class="`tone-${tone(top.confidence)}`">
            <div class="hero-main">
              <span class="hero-badge">{{ topBadge }}</span>
              <h5 class="hero-name">{{ top.nameCn || top.latin }}</h5>
              <p v-if="top.nameCn" class="hero-latin">{{ top.latin }}</p>
              <p class="hero-meta">
                <span>{{ top.familyCn || top.family }}</span>
                <template v-if="top.habit"><i>·</i><span>{{ top.habit }}</span></template>
                <span class="chip" :class="`tone-${tone(top.confidence)}`">
                  {{ confidenceLabel(top.confidence) }}
                </span>
                <span v-if="!top.inLibrary" class="chip chip-plain">未收录</span>
                <span v-else class="chip chip-plain">已收录</span>
              </p>
              <div class="hero-actions">
                <router-link v-if="top.speciesId" :to="`/species/${top.speciesId}`" class="link">
                  查看物种详情
                  <span aria-hidden="true">→</span>
                </router-link>
                <button type="button" class="btn btn-primary" @click="choose(top)">
                  {{ actionLabel }}
                </button>
              </div>
            </div>
            <div class="hero-score">
              <b>{{ pct(top.confidence) }}</b>
              <small>置信度</small>
            </div>
            <div class="bar hero-bar" role="img" :aria-label="`置信度 ${pct(top.confidence)}`">
              <i :style="{ '--w': `${barWidth(top.confidence)}%` }" />
            </div>
          </article>

          <template v-if="rest.length">
            <p class="others-title">其他可能</p>
            <ul class="cands">
              <li
                v-for="(c, i) in rest"
                :key="`${c.speciesId}-${c.latin}-${i}`"
                class="cand"
                :class="`tone-${tone(c.confidence)}`"
              >
                <div class="cand-head">
                  <span class="rank">{{ i + 2 }}</span>
                  <span class="name">
                    <b>{{ c.nameCn || c.latin }}</b>
                    <em v-if="c.nameCn">{{ c.latin }}</em>
                  </span>
                  <span class="conf">{{ pct(c.confidence) }}</span>
                </div>
                <div class="bar" role="img" :aria-label="`置信度 ${pct(c.confidence)}`">
                  <i :style="{ '--w': `${barWidth(c.confidence)}%` }" />
                </div>
                <div class="cand-foot">
                  <span class="muted">
                    {{ c.familyCn || c.family }}
                    <template v-if="c.habit"> · {{ c.habit }}</template>
                    <template v-if="!c.inLibrary"> · 未收录</template>
                  </span>
                  <span class="links">
                    <router-link v-if="c.speciesId" :to="`/species/${c.speciesId}`" class="link">
                      详情
                    </router-link>
                    <button type="button" class="btn btn-ghost use" @click="choose(c)">
                      {{ compactLabel }}
                    </button>
                  </span>
                </div>
              </li>
            </ul>
          </template>
        </template>

        <p v-else class="warn">模型没有返回可用的植物类别，请换一张更清晰、主体更明确的照片。</p>

        <p class="disclaimer">
          识别模型为 iNaturalist 2021（约 4271 种植物），同科近缘种容易混淆，请结合叶形、花果与现场情况确认。
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { confidenceLabel } from '@/utils/identify'
import { prepareModel, recognizeImage } from '@/utils/recognition'

const props = defineProps({
  image: { type: String, default: '' },
  actionLabel: { type: String, default: '使用这个物种' },
  compactLabel: { type: String, default: '使用' }
})

const emit = defineEmits(['select'])

const status = ref('idle')
const progress = ref(0)
const loadedBytes = ref(0)
const totalBytes = ref(0)
const fromCache = ref(false)
const caching = ref(false)
const errorText = ref('')
const result = ref(null)

const percent = computed(() => Math.min(100, Math.round(progress.value * 100)))
const loadedMb = computed(() => (loadedBytes.value / 1048576).toFixed(1))
const totalMb = computed(() => (totalBytes.value ? (totalBytes.value / 1048576).toFixed(1) : ''))

const top = computed(() => result.value?.candidates?.[0] || null)
const rest = computed(() => result.value?.candidates?.slice(1) || [])
const topBadge = computed(() => (result.value?.likelyPlant ? '最可能' : '最接近的候选'))

function pct(v) {
  return `${(v * 100).toFixed(1)}%`
}

function barWidth(v) {
  return Math.max(2, Math.min(100, v * 100))
}

/** 置信度分档：用于配色，避免所有结果都显示成同样的绿色 */
function tone(v) {
  if (v >= 0.5) return 'high'
  if (v >= 0.2) return 'mid'
  return 'low'
}

function reset() {
  status.value = 'idle'
  progress.value = 0
  loadedBytes.value = 0
  totalBytes.value = 0
  errorText.value = ''
  result.value = null
  fromCache.value = false
  caching.value = false
}

watch(
  () => props.image,
  () => reset()
)

async function run() {
  if (!props.image || status.value === 'loading' || status.value === 'running') return
  errorText.value = ''
  result.value = null
  fromCache.value = false
  caching.value = false
  progress.value = 0
  status.value = 'loading'
  loadedBytes.value = 0
  totalBytes.value = 0

  try {
    await prepareModel((evt) => {
      if (!['download', 'cache', 'init'].includes(evt.phase)) return
      caching.value = evt.phase === 'cache'
      fromCache.value = Boolean(evt.fromCache)
      if (typeof evt.ratio === 'number') progress.value = evt.ratio
      if (typeof evt.loaded === 'number') loadedBytes.value = evt.loaded
      if (typeof evt.total === 'number') totalBytes.value = evt.total
    })
    status.value = 'running'
    // 用 setTimeout 让出一帧：后台标签页里 requestAnimationFrame 不会触发，会一直卡在“正在识别”
    await new Promise((resolve) => setTimeout(resolve, 16))
    result.value = await recognizeImage(props.image)
    status.value = 'done'
  } catch (err) {
    status.value = 'error'
    errorText.value = err?.message || '识别失败，请重试'
  }
}

function choose(c) {
  emit('select', {
    name: c.nameCn || c.latin,
    speciesId: c.speciesId || '',
    latin: c.latin,
    confidence: c.confidence
  })
}
</script>

<style scoped>
.photo-identify {
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid var(--green-200);
  border-radius: var(--radius);
  background: linear-gradient(180deg, #fbfdf9, var(--green-050));
}

.idle p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.model-tip {
  margin: 0 0 10px;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.run {
  min-height: 42px;
  padding: 0 18px;
}

.progress p,
.progress-text {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  color: var(--green-700);
  font-size: 13px;
}

.progress small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--green-200);
  border-top-color: var(--green-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(18, 69, 50, 0.08);
}

.bar i {
  display: block;
  width: var(--w, 0%);
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--green-500), var(--green-700));
  animation: grow 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

@keyframes grow {
  from {
    width: 0;
  }
}

.err {
  margin: 8px 0 0;
  color: #c62828;
  font-size: 13px;
}

.warn {
  margin: 0 0 12px;
  padding: 9px 12px;
  border: 1px solid #efdfbd;
  border-radius: 10px;
  background: var(--amber-050);
  color: #8a5a10;
  font-size: 12.5px;
  line-height: 1.7;
}

/* ---------- 结果头部 ---------- */
.result {
  animation: rise 0.28s ease both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.result-head h4 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--ink-strong);
  font-size: 14.5px;
  font-weight: 700;
}

.result-head small {
  color: var(--ink-soft);
  font-size: 11.5px;
  font-weight: 500;
}

.again {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.again:hover {
  border-color: var(--green-300);
  color: var(--green-700);
}

/* ---------- 首位候选 ---------- */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px 18px;
  border: 1px solid var(--green-200);
  border-radius: 14px;
  background: linear-gradient(135deg, #f4fbf6, #e9f5ee);
  overflow: hidden;
}

.hero.tone-mid {
  border-color: #eddfc2;
  background: linear-gradient(135deg, #fffcf4, #fdf5e4);
}

.hero.tone-low {
  border-color: var(--line-strong);
  background: linear-gradient(135deg, #fafbf9, #f2f4f1);
}

.hero-main {
  flex: 1;
  min-width: 0;
}

.hero-badge {
  display: inline-block;
  margin-bottom: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(31, 107, 74, 0.1);
  color: var(--green-700);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero.tone-mid .hero-badge {
  background: rgba(154, 100, 22, 0.12);
  color: var(--amber);
}

.hero.tone-low .hero-badge {
  background: rgba(95, 114, 103, 0.12);
  color: var(--ink-soft);
}

.hero-name {
  margin: 0;
  color: var(--ink-strong);
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.01em;
  line-height: 1.25;
  word-break: break-word;
}

.hero-latin {
  margin: 3px 0 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  font-style: italic;
}

.hero-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0 0;
  color: var(--ink-soft);
  font-size: 12.5px;
}

.hero-meta i {
  font-style: normal;
  opacity: 0.55;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
}

.chip.tone-high {
  background: rgba(43, 125, 89, 0.12);
  color: var(--green-700);
}

.chip.tone-mid {
  background: rgba(154, 100, 22, 0.12);
  color: var(--amber);
}

.chip.tone-low {
  background: rgba(95, 114, 103, 0.12);
  color: var(--ink-soft);
}

.chip-plain {
  margin-left: 2px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.75);
  color: var(--ink-soft);
  font-weight: 500;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.hero-actions .btn {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
}

.hero-score {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 74px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 6px 16px -14px rgba(18, 69, 50, 0.6);
}

.hero-score b {
  color: var(--green-700);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.hero.tone-mid .hero-score b {
  color: var(--amber);
}

.hero.tone-low .hero-score b {
  color: var(--ink-soft);
}

.hero-score small {
  color: var(--ink-soft);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.hero-bar {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 9px;
  height: 4px;
}

.hero.tone-mid .hero-bar i {
  background: linear-gradient(90deg, #d9a94e, var(--amber));
}

.hero.tone-low .hero-bar i {
  background: linear-gradient(90deg, #a9b8ae, #7d8f84);
}

/* ---------- 其他候选 ---------- */
.others-title {
  margin: 16px 0 8px;
  color: var(--ink-soft);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.cands {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cand {
  padding: 9px 12px 10px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fff;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.cand:hover {
  border-color: var(--green-300);
  background: #fdfefd;
}

.cand-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.rank {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--green-050);
  color: var(--ink-soft);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}

.name {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  flex-wrap: wrap;
}

.name b {
  color: var(--ink-strong);
  font-size: 13.5px;
}

.name em {
  color: var(--ink-soft);
  font-size: 11.5px;
  font-style: italic;
}

.conf {
  margin-left: auto;
  color: var(--green-700);
  font-size: 12.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cand.tone-mid .conf {
  color: var(--amber);
}

.cand.tone-low .conf {
  color: var(--ink-soft);
}

.cand .bar {
  height: 4px;
}

.cand.tone-mid .bar i {
  background: linear-gradient(90deg, #d9a94e, var(--amber));
}

.cand.tone-low .bar i {
  background: linear-gradient(90deg, #b6c3ba, #8a9a90);
}

.cand-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
  flex-wrap: wrap;
}

.cand-foot .muted {
  font-size: 11.5px;
}

.links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.link {
  color: var(--green-700);
  font-size: 12.5px;
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.use {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--green-200);
  border-radius: 999px;
  background: #fff;
  color: var(--green-700);
  font-size: 12px;
  font-weight: 650;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.use:hover {
  border-color: var(--green-500);
  background: var(--green-050);
}

.disclaimer {
  margin: 12px 0 0;
  color: var(--ink-soft);
  font-size: 11.5px;
  line-height: 1.7;
}

@media (max-width: 640px) {
  .hero {
    padding: 13px 13px 18px;
    gap: 10px;
  }

  .hero-name {
    font-size: 19px;
  }

  .hero-score {
    min-width: 66px;
    padding: 6px 8px;
  }

  .hero-score b {
    font-size: 23px;
  }

  .hero-actions {
    gap: 10px;
  }

  .hero-actions .btn {
    flex: 1;
    min-height: 42px;
  }

  .cand-foot {
    gap: 8px;
  }

  .use {
    min-height: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result,
  .bar i,
  .spinner {
    animation: none;
  }
}
</style>
