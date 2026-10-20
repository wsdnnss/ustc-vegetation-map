import http from 'node:http'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './server/store.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.argv[2] || process.env.PORT || 8080)
const store = createStore()

// 可选访问口令：设置后整站走 HTTP Basic（用户名任意，密码为口令）。
// 共享服务在公网 IPv6 上可直接访问，建议至少设一个口令，避免数据被随意覆盖。
const accessToken = (process.env.VEG_ACCESS_TOKEN || '').trim()

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

function authorized(req) {
  if (!accessToken) return true
  const header = req.headers.authorization || ''
  const matched = /^Basic\s+(.+)$/i.exec(header)
  if (!matched) return false
  try {
    const raw = Buffer.from(matched[1], 'base64').toString('utf8')
    const index = raw.indexOf(':')
    const password = index >= 0 ? raw.slice(index + 1) : raw
    return password === accessToken
  } catch (e) {
    return false
  }
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
  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="ustc-veg", charset="UTF-8"')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('需要访问口令')
    return
  }

  store.handle(req, res).then((handled) => {
    if (!handled) serveStatic(req, res)
  })
})

server.listen(port, () => {
  console.log(`服务已启动: http://localhost:${port}/`)
  console.log(`数据文件: ${store.file}`)
  console.log(
    accessToken
      ? '访问口令: 已启用（浏览器会弹窗，用户名任意，密码为 VEG_ACCESS_TOKEN）'
      : '访问口令: 未启用（设置环境变量 VEG_ACCESS_TOKEN 可开启）'
  )
})
