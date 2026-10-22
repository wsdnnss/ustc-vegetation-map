<template>
  <header class="app-header">
    <div class="container header-inner">
      <router-link to="/" class="brand">
        <span class="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="38" height="38">
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#3d9d73" />
                <stop offset="1" stop-color="#124532" />
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="12" fill="url(#brandGrad)" />
            <path
              d="M20 8c-6.4 3.8-10 8.6-10 14.2a10 10 0 0 0 20 0C30 16.6 26.4 11.8 20 8z"
              fill="#e6f4e8"
              opacity="0.96"
            />
            <path
              d="M20 13v16M20 20c-3-1.4-5-3.8-5.8-6.6M20 24c3-1.2 5.2-3.4 6.2-6"
              stroke="#2b7d59"
              stroke-width="1.5"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </span>
        <span class="brand-text">
          <strong>中科大本部植被分布</strong>
          <small>校园植物地图 · 课程作业</small>
        </span>
      </router-link>

      <nav class="nav" aria-label="主导航">
        <router-link
          v-for="item in navs"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isActive(item) }"
        >
          {{ item.label }}
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navs = [
  { to: '/', label: '分布地图' },
  { to: '/species', label: '物种库' },
  { to: '/season', label: '季节专题' },
  { to: '/community', label: '社区' },
  { to: '/upload', label: '上传投稿' },
  { to: '/batch', label: '批量导入' },
  { to: '/about', label: '使用说明' }
]

function isActive(item) {
  if (item.to === '/') return route.path === '/'
  return route.path.startsWith(item.to)
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  overflow: hidden;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.78), rgba(246, 250, 244, 0.55));
  backdrop-filter: blur(20px) saturate(1.7);
  -webkit-backdrop-filter: blur(20px) saturate(1.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 14px 38px -32px rgba(18, 69, 50, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.app-header::before {
  content: '';
  position: absolute;
  inset: -160% -20%;
  background:
    radial-gradient(32% 45% at 24% 40%, rgba(255, 255, 255, 0.55), transparent 62%),
    radial-gradient(30% 40% at 78% 60%, rgba(169, 216, 189, 0.32), transparent 66%);
  animation: header-drift 18s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes header-drift {
  0% {
    transform: translate3d(-2%, 0, 0) rotate(0deg);
  }
  100% {
    transform: translate3d(3%, 2%, 0) rotate(6deg);
  }
}

.header-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  flex: 0 0 auto;
}

.brand-logo {
  display: inline-flex;
  flex: 0 0 auto;
  transition: transform 0.2s ease;
}

.brand:hover .brand-logo {
  transform: rotate(-4deg) scale(1.03);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}

.brand-text strong {
  color: var(--ink-strong);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand-text small {
  color: var(--ink-soft);
  font-size: 11px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.nav {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 1px solid rgba(213, 223, 211, 0.9);
  border-radius: 999px;
  background: rgba(241, 247, 242, 0.9);
}

.nav-link {
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.9);
  color: var(--green-700);
}

.nav-link.active {
  background: var(--green-700);
  box-shadow: 0 6px 14px -8px rgba(18, 69, 50, 0.9);
  color: #fff;
}

@media (max-width: 980px) {
  .header-inner {
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 20px;
  }

  .nav {
    order: 2;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    justify-content: flex-start;
  }

  .nav::-webkit-scrollbar {
    display: none;
  }

  .nav-link {
    padding: 7px 12px;
    font-size: 13px;
  }
}

@media (max-width: 560px) {
  .app-header {
    position: static;
  }

  .brand-text small {
    display: none;
  }

  .brand-text strong {
    font-size: 14.5px;
  }

  .brand-logo svg {
    width: 34px;
    height: 34px;
  }

  .nav {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    overflow: visible;
    border-radius: 15px;
  }

  .nav-link {
    padding: 8px 2px;
    text-align: center;
    font-size: 12.5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-header::before {
    animation: none;
  }
}
</style>
