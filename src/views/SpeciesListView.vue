<template>
  <div>
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Species Library</p>
        <h2 class="page-title">物种库</h2>
        <p class="page-sub">
          共收录 {{ speciesList.length }} 种校园植物；已记录物种附有校园分布点，其余为待核实的候选清单。
        </p>
      </div>
      <div class="stats">
        <span class="stat"><b>{{ speciesList.length }}</b> 种收录</span>
        <span class="stat"><b>{{ recorded }}</b> 种已记录</span>
        <span class="stat amber"><b>{{ speciesList.length - recorded }}</b> 种待核实</span>
      </div>
    </div>

    <div class="toolbar card glass">
      <div class="f grow">
        <span>搜索</span>
        <SearchSuggest v-model="keyword" @select="openSpecies" />
      </div>
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
      <label class="f">
        <span>类别</span>
        <select v-model="category">
          <option value="">全部类别</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="f">
        <span>状态</span>
        <select v-model="status">
          <option value="">全部</option>
          <option value="已记录">已记录</option>
          <option value="待核实">待核实</option>
        </select>
      </label>
      <button class="btn btn-ghost" @click="reset">重置</button>
    </div>

    <p class="count muted">筛选结果 <b>{{ filtered.length }}</b> 种</p>

    <div v-if="filtered.length" class="grid">
      <SpeciesCard v-for="s in filtered" :key="s.id" :species="s" />
    </div>
    <div v-else class="card empty-state">
      <div class="empty-art" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
          <circle cx="28" cy="28" r="17" stroke="currentColor" stroke-width="2.4" opacity="0.45" />
          <path d="M41 41l11 11" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7" />
          <path
            d="M28 17c-5.5 3.2-8.5 7.4-8.5 12.1a8.5 8.5 0 0 0 17 0c0-4.7-3-8.9-8.5-12.1z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M28 21v13M28 26c-2.3-1-3.8-2.8-4.5-5M28 30c2.2-1 3.9-2.6 4.7-4.6"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <h4>没有找到符合条件的物种</h4>
      <p>试试减少筛选条件，或换一个关键词搜索。</p>
      <button class="btn" @click="reset">清除筛选</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SpeciesCard from '@/components/SpeciesCard.vue'
import SearchSuggest from '@/components/SearchSuggest.vue'
import {
  speciesList,
  allFamilies,
  allMonths,
  bloomsIn,
  categoryOf,
  allCategories,
  hasPoints,
  recordedCount,
  searchText
} from '@/utils/species'

const families = allFamilies()
const months = allMonths()
const categories = allCategories()
const recorded = recordedCount()
const router = useRouter()

const keyword = ref('')
const family = ref('')
const month = ref('')
const category = ref('')
const status = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = speciesList.filter((s) => {
    if (family.value && s.family !== family.value) return false
    if (month.value && !bloomsIn(s, month.value)) return false
    if (category.value && categoryOf(s) !== category.value) return false
    if (status.value && s.status !== status.value) return false
    if (kw && !searchText(s).includes(kw)) return false
    return true
  })
  // 已记录的排在前面
  return list.sort((a, b) => Number(hasPoints(b)) - Number(hasPoints(a)))
})

function reset() {
  keyword.value = ''
  family.value = ''
  month.value = ''
  category.value = ''
  status.value = ''
}

/** 联想选中后直接进入物种详情，避免再点一次卡片 */
function openSpecies(species) {
  router.push(`/species/${species.id}`)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 24px;
}

.f {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
}

.f > span {
  color: var(--ink-soft);
  font-weight: 600;
}

.f.grow {
  flex: 1;
  min-width: 240px;
}

.f select,
.f input {
  padding: 11px 13px;
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.86);
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.f select:focus,
.f input:focus {
  border-color: var(--green-500);
  background: #fff;
  box-shadow: var(--ring);
}

.f input::placeholder {
  color: #9aa9a0;
}

.count {
  margin: 0 2px 20px;
  font-size: 13px;
}

.count b {
  color: var(--green-700);
  font-size: 15px;
}

/* 瀑布流：列布局让不同画幅的卡片自然错落 */
.grid {
  columns: 4 230px;
  column-gap: var(--gap-grid);
}

.grid > * {
  display: block;
  break-inside: avoid;
  margin-bottom: var(--gap-grid);
}

@media (max-width: 1100px) {
  .grid {
    columns: 3 220px;
  }
}

@media (max-width: 820px) {
  .grid {
    columns: 2 210px;
  }
}

@media (max-width: 520px) {
  .grid {
    columns: 2 150px;
    column-gap: 14px;
  }

  .grid > * {
    margin-bottom: 14px;
  }

  .toolbar {
    gap: 12px;
    padding: 16px;
  }
}
</style>
