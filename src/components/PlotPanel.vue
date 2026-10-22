<template>
  <section class="plot-panel card" aria-live="polite">
    <header class="panel-head">
      <div class="head-text">
        <h4 v-if="analysis">{{ editingPlotId ? '编辑地块' : '框选结果' }}</h4>
        <h4 v-else>地块管理</h4>
        <p v-if="analysis">
          <b>{{ formatArea(analysis.area) }}</b>
          <template v-if="sizeText"> · {{ sizeText }}</template>
          · {{ analysis.count }} 个分布点 · {{ analysis.speciesCount }} 种植物
          <template v-if="filtering">（筛选命中 {{ analysis.matchedSpeciesCount }} 种）</template>
        </p>
        <p v-else>共 {{ plots.length }} 个地块 · 数据保存在本浏览器，可导出 plots.json 分享</p>
      </div>
      <button class="icon-btn" type="button" aria-label="关闭面板" @click="$emit('close')">×</button>
    </header>

    <div class="panel-body">
      <template v-if="analysis">
        <div v-if="analysis.nearbyCount" class="nearby">
          <span>边界外 25 m 内还有 <b>{{ analysis.nearbyCount }}</b> 个分布点</span>
          <button type="button" class="link-btn" @click="$emit('expand')">一键纳入</button>
        </div>

        <div v-if="analysis.species.length" class="species-block">
          <div class="block-title">
            <span>范围内的植物</span>
            <small>按命中和点位数排序</small>
          </div>
          <ul class="species-list">
            <li v-for="s in analysis.species" :key="s.id" :class="{ matched: s.matched }">
              <router-link class="sp-name" :to="`/species/${s.id}`">{{ s.nameCn }}</router-link>
              <span class="sp-meta">{{ s.family }} · {{ s.count }} 个点</span>
              <span v-if="s.matched && filtering" class="hit">命中</span>
            </li>
          </ul>
        </div>
        <div v-else class="empty">
          <p class="empty-title">这个范围内还没有已记录的植物</p>
          <p class="empty-sub">
            可以拖动边界上的圆点微调范围，或从地图上重新框选。
            <template v-if="analysis.nearbySpeciesCount">
              边界外近旁有 {{ analysis.nearbySpeciesCount }} 种植物，点「一键纳入」即可包含。
            </template>
          </p>
        </div>

        <div class="form-block">
          <div class="block-title">
            <span>地块信息</span>
            <small v-if="analysis">
              优势物种：{{ analysis.species.slice(0, 3).map((s) => s.nameCn).join('、') || '—' }}
            </small>
          </div>

          <div v-if="suggestion" class="suggest">
            <span class="suggest-icon" aria-hidden="true">✦</span>
            <span class="suggest-text">
              智能建议：<b>{{ suggestion.landuse }}</b> · {{ suggestion.name }}
              <small>{{ suggestion.reason }}</small>
            </span>
            <button v-if="!matchesSuggestion" type="button" class="link-btn" @click="$emit('apply-suggestion')">
              采用
            </button>
          </div>

          <div class="form-grid">
            <label class="f">
              <span>编号</span>
              <input v-model.trim="form.plotId" type="text" maxlength="16" @input="$emit('touch')" />
            </label>
            <label class="f">
              <span>名称</span>
              <input
                v-model.trim="form.name"
                type="text"
                maxlength="24"
                placeholder="如：樱花大道"
                @input="$emit('touch')"
              />
            </label>
            <label class="f">
              <span>类型</span>
              <select v-model="form.landuse" @change="onLanduseChange">
                <option v-for="o in LANDUSE_OPTIONS" :key="o.value" :value="o.value">{{ o.value }}</option>
              </select>
            </label>
            <label class="f">
              <span>颜色</span>
              <select v-model="form.color" @change="$emit('touch')">
                <option v-for="o in LANDUSE_OPTIONS" :key="o.value" :value="o.color">
                  {{ o.tone }}
                </option>
              </select>
            </label>
          </div>

          <div class="actions">
            <button type="button" class="btn btn-primary" @click="$emit('save')">
              {{ editingPlotId ? '更新地块' : '保存地块' }}
            </button>
            <button type="button" class="btn btn-ghost" @click="$emit('copy')">复制 JSON</button>
            <button v-if="editingPlotId" type="button" class="btn btn-ghost danger" @click="$emit('delete')">
              删除
            </button>
          </div>
          <div class="actions sub">
            <button type="button" class="link-btn" @click="$emit('reselect', 'rect')">重新矩形框选</button>
            <button type="button" class="link-btn" @click="$emit('reselect', 'poly')">重新多边形框选</button>
            <button type="button" class="link-btn" @click="$emit('clear')">清空选区</button>
          </div>
        </div>
      </template>

      <div v-else class="manage-tip">
        <p>在地图上拖动即可矩形框选；也可以切换到多边形，沿地块边界逐点描边。</p>
        <div class="actions">
          <button type="button" class="btn btn-primary" @click="$emit('reselect', 'rect')">矩形框选</button>
          <button type="button" class="btn" @click="$emit('reselect', 'poly')">多边形框选</button>
        </div>
      </div>

      <div class="saved-block">
        <div class="block-title">
          <span>已保存地块（{{ plots.length }}）</span>
          <span class="saved-actions">
            <button type="button" class="link-btn" @click="triggerImport">导入</button>
            <button type="button" class="link-btn" :disabled="!plots.length" @click="$emit('export')">
              导出
            </button>
            <input ref="fileEl" type="file" accept=".json,application/json" hidden @change="onFile" />
          </span>
        </div>
        <ul v-if="plots.length" class="plot-list">
          <li v-for="p in plots" :key="p.plotId" :class="{ active: p.plotId === activePlotId }">
            <button type="button" class="plot-main" @click="$emit('focus', p)">
              <i class="dot" :style="{ background: p.color }"></i>
              <span class="plot-name">{{ p.name }}</span>
              <small>{{ p.plotId }} · {{ p.landuse }} · {{ formatArea(p.areaSize) }}</small>
            </button>
            <button type="button" class="del" :aria-label="`删除 ${p.name}`" @click="$emit('remove', p.plotId)">
              ×
            </button>
          </li>
        </ul>
        <p v-else class="saved-empty">还没有保存的地块。框选后填写名称即可保存。</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  LANDUSE_OPTIONS,
  colorOfLanduse,
  formatArea,
  formatSize
} from '@/utils/plots'

const props = defineProps({
  analysis: { type: Object, default: null },
  form: { type: Object, required: true },
  editingPlotId: { type: String, default: '' },
  suggestion: { type: Object, default: null },
  plots: { type: Array, default: () => [] },
  activePlotId: { type: String, default: '' },
  filtering: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close',
  'save',
  'delete',
  'clear',
  'reselect',
  'expand',
  'copy',
  'export',
  'import',
  'focus',
  'touch',
  'apply-suggestion',
  'remove'
])

const fileEl = ref(null)

const sizeText = computed(() => (props.analysis ? formatSize(props.analysis.shape) : ''))

const matchesSuggestion = computed(() => {
  const s = props.suggestion
  if (!s) return true
  return (
    props.form.name === s.name &&
    props.form.landuse === s.landuse &&
    props.form.color === s.color
  )
})

function onLanduseChange() {
  props.form.color = colorOfLanduse(props.form.landuse)
  emit('touch')
}

function triggerImport() {
  fileEl.value?.click()
}

function onFile(e) {
  const file = e.target.files?.[0]
  if (file) emit('import', file)
  e.target.value = ''
}
</script>

<style scoped>
.plot-panel {
  display: flex;
  flex-direction: column;
  max-height: 66vh;
  min-height: 0;
  overflow: hidden;
  border-color: rgba(169, 216, 189, 0.9);
  box-shadow: 0 24px 54px -26px rgba(18, 69, 50, 0.55), 0 2px 8px rgba(18, 69, 50, 0.08);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px 11px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(140deg, #f4faf5, #fff);
}

.head-text h4 {
  margin: 0 0 3px;
  color: var(--ink-strong);
  font-size: 15px;
  font-weight: 700;
}

.head-text p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11.8px;
  line-height: 1.6;
}

.head-text b {
  color: var(--green-700);
}

.icon-btn {
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

.icon-btn:hover {
  border-color: var(--green-300);
  background: var(--green-050);
  color: var(--green-700);
}

.panel-body {
  flex: 1;
  padding: 12px 14px 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.block-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 0 7px;
  color: var(--ink-strong);
  font-size: 12.5px;
  font-weight: 700;
}

.block-title small {
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 400;
}

.nearby {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid #efdfbd;
  border-radius: 10px;
  background: var(--amber-050);
  color: var(--amber);
  font-size: 11.8px;
}

.species-block {
  margin-bottom: 12px;
}

.species-list {
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 11px;
  overflow: hidden;
  list-style: none;
}

.species-list li {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 7px 9px;
  border-top: 1px dashed var(--line);
  background: #fff;
}

.species-list li:first-child {
  border-top: none;
}

.species-list li.matched {
  background: linear-gradient(90deg, rgba(230, 242, 234, 0.85), #fff 70%);
}

.sp-name {
  flex: 0 0 auto;
  color: var(--green-700);
  font-size: 12.8px;
  font-weight: 650;
}

.sp-name:hover {
  text-decoration: underline;
}

.sp-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hit {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--green-100);
  color: var(--green-700);
  font-size: 10px;
}

.empty {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 11px;
  background: var(--green-050);
}

.empty-title {
  margin: 0 0 4px;
  color: var(--ink-strong);
  font-size: 12.8px;
  font-weight: 650;
}

.empty-sub {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11.5px;
  line-height: 1.65;
}

.form-block {
  padding-top: 2px;
}

.suggest {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 9px;
  padding: 8px 10px;
  border: 1px solid rgba(169, 216, 189, 0.75);
  border-radius: 10px;
  background: linear-gradient(140deg, #f3faf5, #fbfdfb);
  font-size: 11.6px;
  line-height: 1.55;
}

.suggest-icon {
  color: var(--green-600);
}

.suggest-text {
  flex: 1;
  min-width: 0;
  color: var(--ink);
}

.suggest-text small {
  display: block;
  color: var(--ink-soft);
  font-size: 11px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.f {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
}

.f > span {
  color: var(--ink-soft);
}

.f input,
.f select {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  background: #fff;
  font-size: 12.5px;
  outline: none;
}

.f input:focus,
.f select:focus {
  border-color: var(--green-500);
  box-shadow: var(--ring);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 9px;
}

.actions .btn {
  padding: 8px 13px;
  font-size: 12.5px;
}

.actions.sub {
  margin-top: 5px;
  gap: 12px;
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--green-700);
  font-size: 11.6px;
  font-weight: 600;
}

.link-btn:hover {
  text-decoration: underline;
}

.link-btn:disabled {
  color: #a9b7ae;
  cursor: not-allowed;
  text-decoration: none;
}

.danger {
  color: var(--danger);
}

.manage-tip {
  margin-bottom: 12px;
  padding: 11px 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 11px;
  background: var(--green-050);
}

.manage-tip p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11.8px;
  line-height: 1.7;
}

.saved-block {
  margin-top: 14px;
  padding-top: 11px;
  border-top: 1px solid var(--line);
}

.saved-actions {
  display: flex;
  gap: 10px;
}

.plot-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.plot-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 9px;
}

.plot-list li:hover,
.plot-list li.active {
  background: var(--green-050);
}

.plot-main {
  display: grid;
  flex: 1;
  grid-template-columns: 10px 1fr;
  column-gap: 7px;
  row-gap: 1px;
  padding: 2px 0;
  border: none;
  background: none;
  text-align: left;
}

.dot {
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 50%;
}

.plot-name {
  color: var(--ink);
  font-size: 12.4px;
  font-weight: 600;
}

.plot-main small {
  grid-column: 2;
  color: var(--ink-soft);
  font-size: 10.8px;
}

.del {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #a9b7ae;
  font-size: 14px;
  line-height: 1;
}

.del:hover {
  background: var(--danger-050);
  color: var(--danger);
}

.saved-empty {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11.5px;
  line-height: 1.7;
}

@media (max-width: 999px) {
  .plot-panel {
    max-height: none;
    scroll-margin-top: 108px;
  }

  .panel-body {
    max-height: 70vh;
  }

  /* 文字按钮在地图上不好点，窄屏时给足触控高度 */
  .actions.sub {
    gap: 2px 14px;
  }

  .actions.sub .link-btn {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
  }
}

@media (max-width: 640px) {
  .panel-head {
    padding: 12px 13px 10px;
  }

  .panel-body {
    padding: 10px 12px 12px;
  }

  .actions .btn {
    min-height: 40px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
  }

  .plot-list .del {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
}
</style>
