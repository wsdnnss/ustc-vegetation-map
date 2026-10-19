import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { storeMiddleware } from './server/store.js'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 为子路径部署（/ustc-vegetation-map/），本地开发与共享服务保持根路径
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    vue(),
    {
      name: 'ustc-data-store',
      configureServer(server) {
        server.middlewares.use(storeMiddleware())
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
