import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initDiskStore } from './utils/diskStore'
import 'leaflet/dist/leaflet.css'
import './style.css'

// 先读取云盘数据，再挂载页面，保证各页面拿到的是最新数据
initDiskStore().finally(() => {
  createApp(App).use(router).mount('#app')
})
