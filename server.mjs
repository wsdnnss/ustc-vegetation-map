import http from 'node:http'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './server/store.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.argv[2] || process.env.PORT || 8080)
const store = createStore()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  const target = path.resolve(root, `.${pathname}`)
  if (!target.startsWith(root + path.sep)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  try {
    const stat = await fsp.stat(target)
    if (stat.isDirectory()) throw new Error('is directory')
    const data = await fsp.readFile(target)
    res.setHeader('Content-Type', MIME[path.extname(target).toLowerCase()] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(data)
  } catch (err) {
    res.statusCode = 404
    res.end('Not Found')
  }
}

const server = http.createServer((req, res) => {
  store.handle(req, res).then((handled) => {
    if (!handled) serveStatic(req, res)
  })
})

server.listen(port, () => {
  console.log(`服务已启动: http://localhost:${port}/`)
  console.log(`数据文件: ${store.file}`)
})
