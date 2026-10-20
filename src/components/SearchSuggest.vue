<template>
  <div class="search-suggest">
    <div class="input-wrap">
      <svg class="icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        ref="inputEl"
        :value="modelValue"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        aria-label="搜索物种"
        :placeholder="placeholder"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="close"
      />
      <button
        v-if="modelValue"
        type="button"
        class="clear"
        aria-label="清除搜索"
        @mousedown.prevent="clear"
      >
        ×
      </button>
    </div>

    <Teleport to="body">
      <transition name="suggest">
        <div v-if="open" class="panel" :style="panelStyle">
          <p class="panel-head">
            <span>{{ query ? '匹配物种' : `${monthLabel}开花` }}</span>
            <span class="panel-count">{{ query ? `${items.length} 条` : '本月看点' }}</span>
          </p>
          <p v-if="!items.length" class="panel-empty">
            没有匹配的物种，试试别名、学名或科名。
          </p>
          <ul v-else class="list" role="listbox">
            <li v-for="(item, i) in items" :key="item.species.id" role="option" :aria-selected="i === active">
              <button
                type="button"
                :class="{ active: i === active }"
                @mousedown.prevent="choose(item.species)"
                @mouseenter="active = i"
                @focus="active = i"
              >
                <span class="dot" :class="{ recorded: item.species.status === '已记录' }"></span>
                <span class="text">
                  <span class="name" v-html="highlight(item.species.nameCn)"></span>
                  <span class="sub">
                    {{ item.species.nameLatin }} · {{ item.species.family }}
                  </span>
                </span>
                <span class="kind">{{ item.label }}</span>
              </button>
            </li>
          </ul>
          <p class="panel-foot">
            <template v-if="query">↑↓ 切换 · 回车选择 · Esc 关闭</template>
            <template v-else>输入中文名、别名或学名开始搜索</template>
          </p>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { speciesList, hasPoints, bloomsIn } from '@/utils/species'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入中文名 / 学名 / 别名 / 关键词' },
  limit: { type: Number, default: 8 }
})

const emit = defineEmits(['update:modelValue', 'select', 'clear'])

const inputEl = ref(null)
const open = ref(false)
const active = ref(0)
const panelStyle = reactive({ top: '0px', left: '0px', width: '0px' })
let blurTimer = null

/** 面板 Teleport 到 body，用 fixed 跟随输入框，避免被工具栏的 overflow 裁剪 */
function updatePosition() {
  const el = inputEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const width = Math.min(rect.width, window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  panelStyle.top = `${Math.round(rect.bottom + 6)}px`
  panelStyle.left = `${Math.round(left)}px`
  panelStyle.width = `${Math.round(width)}px`
}

function onViewportChange() {
  if (open.value) updatePosition()
}

const query = computed(() => props.modelValue.trim().toLowerCase())
const month = new Date().getMonth() + 1
const monthLabel = `${month} 月`

/** 参与联想的字段与权重（权重越高排得越前） */
function matchOf(species, kw) {
  const fields = [
    { label: '中文名', values: [species.nameCn], weight: 100 },
    { label: '别名', values: species.alias || [], weight: 80 },
    { label: '学名', values: [species.nameLatin], weight: 70 },
    { label: '科', values: [species.family], weight: 60 },
    { label: '属', values: [species.genus], weight: 50 },
    { label: '标签', values: species.tags || [], weight: 30 }
  ]
  let best = null
  for (const field of fields) {
    for (const value of field.values) {
      const text = String(value || '').toLowerCase()
      if (!text || !text.includes(kw)) continue
      let score = field.weight
      if (text === kw) score += 20
      else if (text.startsWith(kw)) score += 10
      if (!best || score > best.score) best = { label: field.label, score }
    }
  }
  return best
}

const items = computed(() => {
  if (!query.value) {
    // 输入框为空时给出「本月开花」的观察建议，与季节专题口径一致
    return speciesList
      .filter((s) => bloomsIn(s, month))
      .sort((a, b) => Number(hasPoints(b)) - Number(hasPoints(a)))
      .slice(0, Math.min(props.limit, 6))
      .map((species) => ({ species, label: '本月开花' }))
  }

  return speciesList
    .map((species) => ({ species, match: matchOf(species, query.value) }))
    .filter((item) => item.match)
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score
      if (hasPoints(a.species) !== hasPoints(b.species)) return hasPoints(b.species) ? 1 : -1
      return a.species.nameCn.localeCompare(b.species.nameCn, 'zh-Hans-CN')
    })
    .slice(0, props.limit)
    .map((item) => ({ species: item.species, label: item.match.label }))
})

function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

/** 高亮命中的关键词（先转义再包裹，避免 XSS） */
function highlight(text) {
  const safe = escapeHtml(text)
  if (!query.value) return safe
  const idx = safe.toLowerCase().indexOf(query.value)
  if (idx < 0) return safe
  const end = idx + query.value.length
  return `${safe.slice(0, idx)}<mark>${safe.slice(idx, end)}</mark>${safe.slice(end)}`
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
  active.value = 0
  updatePosition()
  open.value = true
}

function onFocus() {
  if (blurTimer) window.clearTimeout(blurTimer)
  updatePosition()
  open.value = true
}

function onBlur() {
  blurTimer = window.setTimeout(() => {
    open.value = false
  }, 120)
}

function close() {
  open.value = false
  inputEl.value?.blur()
}

function move(step) {
  if (!open.value) open.value = true
  if (!items.value.length) return
  const total = items.value.length
  active.value = (active.value + step + total) % total
}

function choose(species) {
  emit('update:modelValue', species.nameCn)
  emit('select', species)
  open.value = false
}

function onEnter() {
  if (!open.value || !items.value.length) return
  choose(items.value[active.value]?.species || items.value[0].species)
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
  active.value = 0
  inputEl.value?.focus()
}

onMounted(() => {
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  if (blurTimer) window.clearTimeout(blurTimer)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
.search-suggest {
  position: relative;
  width: 100%;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.icon {
  position: absolute;
  left: 12px;
  color: #9aa9a0;
  pointer-events: none;
}

input {
  width: 100%;
  padding: 10px 34px 10px 33px;
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: #fff;
  color: var(--ink);
  font-size: 14px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

input::placeholder {
  color: #9aa9a0;
}

input:focus {
  border-color: var(--green-500);
  box-shadow: var(--ring);
}

.clear {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(95, 114, 103, 0.12);
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1;
}

.clear:hover {
  background: rgba(95, 114, 103, 0.22);
  color: var(--ink);
}

.panel {
  position: fixed;
  z-index: 1400;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 48px -26px rgba(18, 69, 50, 0.45), 0 2px 8px rgba(18, 69, 50, 0.06);
}

.panel-head,
.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 13px;
  color: var(--ink-soft);
  font-size: 11.5px;
}

.panel-head {
  border-bottom: 1px solid var(--line);
  background: var(--green-050);
  font-weight: 600;
}

.panel-count {
  color: var(--green-600);
  font-weight: 600;
}

.panel-foot {
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: #8b9a90;
}

.panel-empty {
  margin: 0;
  padding: 20px 14px;
  color: var(--ink-soft);
  font-size: 12.5px;
  text-align: center;
}

.list {
  max-height: 336px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
}

.list button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  text-align: left;
}

.list button.active {
  background: var(--green-050);
}

.dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cdd9ce;
}

.dot.recorded {
  background: var(--green-500);
  box-shadow: 0 0 0 3px rgba(61, 157, 115, 0.16);
}

.text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.name {
  color: var(--ink-strong);
  font-size: 13.5px;
  font-weight: 650;
}

.name :deep(mark) {
  padding: 0 1px;
  border-radius: 3px;
  background: rgba(169, 216, 189, 0.55);
  color: var(--green-900);
}

.sub {
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.kind {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--green-050);
  color: var(--green-600);
  font-size: 10.5px;
  white-space: nowrap;
}

.suggest-enter-active,
.suggest-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.suggest-enter-from,
.suggest-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
