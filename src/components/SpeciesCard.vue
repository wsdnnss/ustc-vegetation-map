<template>
  <router-link :to="`/species/${species.id}`" class="card species-card lift">
    <div class="thumb" :style="{ aspectRatio: ratio }">
      <div v-if="!loaded" class="thumb-skeleton skeleton" aria-hidden="true"></div>
      <img
        ref="imgEl"
        :src="img"
        :alt="species.nameCn"
        loading="lazy"
        :class="{ 'is-loaded': loaded }"
        @load="loaded = true"
        @error="onError"
      />
      <span class="habit">{{ species.habit }}</span>
      <span v-if="species.status === '待核实'" class="status-badge">待核实</span>
      <span v-else-if="level.key === 'example'" class="coord-badge">示例坐标</span>
    </div>
    <div class="body">
      <div class="name-row">
        <h3>{{ species.nameCn }}</h3>
        <span class="tag">花期 {{ species.bloomText }}</span>
      </div>
      <p class="latin">{{ species.nameLatin }}</p>
      <p class="meta">{{ species.family }} · {{ species.genus }}</p>
      <p v-if="aliases.length" class="alias">别名：{{ aliases.join('、') }}</p>
      <div class="tags">
        <span v-for="t in species.tags" :key="t" class="mini">{{ t }}</span>
      </div>
      <span class="more">查看图鉴 <i aria-hidden="true">→</i></span>
    </div>
  </router-link>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { speciesImage, aliasesOf, dataLevelOf } from '@/utils/species'

const props = defineProps({
  species: { type: Object, required: true }
})

const img = ref(speciesImage(props.species))
const aliases = computed(() => aliasesOf(props.species))
const level = computed(() => dataLevelOf(props.species))
const broken = ref(false)
const loaded = ref(false)
const imgEl = ref(null)

onMounted(() => {
  if (imgEl.value?.complete) loaded.value = true
})

// 不同卡片使用稳定的不同画幅，形成高低错落的瀑布流
const RATIOS = ['4 / 5', '3 / 4', '1 / 1', '5 / 4', '4 / 5', '3 / 4', '1 / 1']
const ratio = computed(() => {
  const seed = [...props.species.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return RATIOS[seed % RATIOS.length]
})

// 图片加载失败时的兜底占位图（内联 SVG，纯本地、不依赖网络）
const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='%23eef7ee'/%3E%3Cpath d='M200 70c-34 20-56 48-56 82a56 56 0 0 0 112 0c0-34-22-62-56-82z' fill='%23a5d6a7'/%3E%3Cpath d='M200 92v104' stroke='%232e7d32' stroke-width='3'/%3E%3Ctext x='200' y='196' font-size='15' fill='%235b6b62' text-anchor='middle' font-family='sans-serif'%3E暂无图片%3C/text%3E%3C/svg%3E"

function onError(e) {
  if (broken.value) return
  broken.value = true
  e.target.src = FALLBACK
}
</script>

<style scoped>
.species-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
}

.thumb {
  position: relative;
  overflow: hidden;
  background: var(--green-050);
}

.thumb-skeleton {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.thumb::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: auto 0 0;
  height: 42%;
  background: linear-gradient(to top, rgba(10, 30, 20, 0.42), transparent);
  pointer-events: none;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: transform 0.5s ease, opacity 0.35s ease;
}

.thumb img.is-loaded {
  opacity: 1;
}

.species-card:hover .thumb img {
  transform: scale(1.05);
}

.habit {
  position: absolute;
  z-index: 2;
  left: 14px;
  bottom: 14px;
  padding: 3px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(15, 35, 25, 0.42);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11.5px;
}

.status-badge {
  position: absolute;
  z-index: 2;
  right: 14px;
  top: 14px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(253, 246, 231, 0.94);
  color: var(--amber);
  font-size: 11.5px;
  font-weight: 600;
  box-shadow: 0 2px 8px -2px rgba(90, 60, 10, 0.35);
}

.coord-badge {
  position: absolute;
  z-index: 2;
  right: 14px;
  top: 14px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #5f6f66;
  font-size: 11.5px;
  font-weight: 600;
  box-shadow: 0 2px 8px -2px rgba(30, 50, 40, 0.28);
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 16px 18px 18px;
}

.name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.name-row h3 {
  margin: 0;
  color: var(--ink-strong);
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.name-row .tag {
  flex: 0 0 auto;
  padding: 2px 8px;
  font-size: 11.5px;
}

.latin {
  margin: 5px 0 8px;
  color: var(--ink-soft);
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  margin: 0 0 10px;
  color: var(--ink-soft);
  font-size: 12.5px;
}

.alias {
  margin: -3px 0 10px;
  overflow: hidden;
  color: #6b7a70;
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini {
  padding: 2px 8px;
  border-radius: 7px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 11.5px;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding-top: 16px;
  color: var(--green-600);
  font-size: 12.5px;
  font-weight: 600;
}

.more i {
  font-style: normal;
  transition: transform 0.18s ease;
}

.species-card:hover .more i {
  transform: translateX(3px);
}

@media (max-width: 640px) {
  .body {
    padding: 12px 13px 14px;
  }

  .name-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .name-row h3 {
    font-size: 16px;
  }

  .latin,
  .meta {
    font-size: 12px;
  }
}
</style>
