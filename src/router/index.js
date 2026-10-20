import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 模式：无需服务器配置，直接 build 后丢到任意静态托管即可访问
const routes = [
  {
    path: '/',
    name: 'map',
    component: () => import('@/views/MapView.vue'),
    meta: { title: '分布地图' }
  },
  {
    path: '/species',
    name: 'species',
    component: () => import('@/views/SpeciesListView.vue'),
    meta: { title: '物种库' }
  },
  {
    path: '/season',
    name: 'season',
    component: () => import('@/views/SeasonView.vue'),
    meta: { title: '季节专题' }
  },
  {
    path: '/community',
    name: 'community',
    component: () => import('@/views/CommunityView.vue'),
    meta: { title: '植物社区' }
  },
  {
    path: '/species/:id',
    name: 'species-detail',
    component: () => import('@/views/SpeciesDetailView.vue'),
    meta: { title: '物种详情' }
  },
  {
    path: '/upload',
    name: 'upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { title: '上传投稿' }
  },
  {
    path: '/batch',
    name: 'batch',
    component: () => import('@/views/BatchImportView.vue'),
    meta: { title: '批量导入' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于与使用说明' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  document.title = to.meta?.title
    ? `${to.meta.title} · 中科大本部植被分布`
    : '中科大本部植被分布'
})

export default router
