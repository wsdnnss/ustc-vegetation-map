<template>
  <div class="app">
    <AppHeader />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
    <footer class="app-footer">
      <div class="container footer-inner">
        <span class="footer-brand"><i aria-hidden="true"></i>中科大本部植被分布</span>
        <span class="muted">课程作业演示 · 数据为示例，仅供学习交流</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import AppHeader from '@/components/AppHeader.vue'
</script>

<style scoped>
.app-footer {
  margin-top: auto;
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.55);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 20px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-weight: 600;
}

.footer-brand i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green-500);
  box-shadow: 0 0 0 4px var(--green-050);
}

@media (max-width: 640px) {
  .footer-inner {
    padding: 16px 14px;
  }
}
</style>
