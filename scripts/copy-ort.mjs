import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 把 onnxruntime-web 的 wasm 运行时复制到 public/ort/，
 * 避免依赖 CDN，也避免把 11 MB 的二进制提交进 Git。
 * 由 package.json 的 dev / build 脚本在启动前执行。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const from = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')
const to = path.join(root, 'public', 'ort')
const files = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']

fs.mkdirSync(to, { recursive: true })
for (const name of files) {
  const src = path.join(from, name)
  const dest = path.join(to, name)
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) continue
  fs.copyFileSync(src, dest)
  console.log(`[ort] 已复制 ${name} → public/ort/`)
}
