import { buildLibraryIndex, decorateCandidates, topPlantCandidates, PLANT_CONFIDENCE_FLOOR } from './identify'

/**
 * 浏览器端本地植物识别：ONNX Runtime Web + iNaturalist 2021 模型。
 *
 * - 模型首次使用时下载（约 43 MB），存入 IndexedDB，之后离线可用；
 * - 推理全部在浏览器内完成，照片不会上传到任何服务器；
 * - 模型文件与类别表放在 public/models/plant/，wasm 运行时由 scripts/copy-ort.mjs 复制。
 */

const MODEL_FILE = 'models/plant/inat21-resnet50-int8.onnx'
const CLASSES_FILE = 'models/plant/inat21-plants.json'
const CACHE_KEY = 'inat21-resnet50-int8-v1'
const IMAGE_SIZE = 256
// 与训练时的归一化参数一致（birder 模型的 rgb_stats）
const MEAN = [0.5191, 0.5306, 0.4877]
const STD = [0.2316, 0.2304, 0.2588]

let enginePromise = null
let libraryIndex = null

function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

/* ---------------- IndexedDB 缓存 ---------------- */

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'))
    const req = indexedDB.open('ustc-veg-recognizer', 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('indexedDB error'))
  })
}

async function cacheGet(key) {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const req = db.transaction('files').objectStore('files').get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch (e) {
    return null
  }
}

async function cacheSet(key, value) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    // 隐私模式或空间不足时忽略，下次重新下载即可
  }
}

/* ---------------- 模型加载 ---------------- */

async function fetchModel(onProgress) {
  const cached = await cacheGet(CACHE_KEY)
  if (cached && cached.byteLength > 1024 * 1024) {
    onProgress?.({ phase: 'download', ratio: 1, fromCache: true })
    return cached
  }

  const res = await fetch(assetUrl(MODEL_FILE))
  if (!res.ok) throw new Error(`模型下载失败（HTTP ${res.status}）`)
  const total = Number(res.headers.get('content-length')) || 0

  if (!res.body?.getReader) {
    const buffer = await res.arrayBuffer()
    onProgress?.({ phase: 'download', ratio: 1 })
    await cacheSet(CACHE_KEY, buffer)
    return buffer
  }

  const reader = res.body.getReader()
  const chunks = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress?.({ phase: 'download', ratio: total ? loaded / total : 0, loaded, total })
  }

  const buffer = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.length
  }
  const result = buffer.buffer
  onProgress?.({ phase: 'cache', ratio: 1, loaded, total })
  await cacheSet(CACHE_KEY, result)
  return result
}

async function loadClasses() {
  const res = await fetch(assetUrl(CLASSES_FILE))
  if (!res.ok) throw new Error(`类别表加载失败（HTTP ${res.status}）`)
  const data = await res.json()
  const classes = data.c.map(([i, g, s, f]) => ({ i, g, s, f }))
  return { classes, size: data.size || IMAGE_SIZE }
}

async function initEngine(onProgress) {
  const [ortModule, modelBuffer, meta] = await Promise.all([
    import('onnxruntime-web/wasm'),
    fetchModel(onProgress),
    loadClasses()
  ])

  // Vite 开发服务器会把 /public 下的 .mjs 当成源码模块处理，
  // 这里先取回文本再生成 blob URL，让 ORT 以普通模块方式加载，dev / build 行为一致。
  const loaderText = await (await fetch(`${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.mjs`)).text()
  const loaderUrl = URL.createObjectURL(new Blob([loaderText], { type: 'text/javascript' }))

  ortModule.env.wasm.wasmPaths = {
    mjs: loaderUrl,
    wasm: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.wasm`
  }
  ortModule.env.wasm.numThreads = 1
  ortModule.env.logLevel = 'error'

  onProgress?.({ phase: 'init', ratio: 0 })
  const session = await ortModule.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  })
  onProgress?.({ phase: 'ready', ratio: 1 })

  return { ort: ortModule, session, classes: meta.classes, size: meta.size }
}

/** 预热模型（首次会下载），返回模型信息；重复调用共享同一个 Promise */
export function prepareModel(onProgress) {
  if (!enginePromise) {
    enginePromise = initEngine(onProgress).catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

/* ---------------- 图片预处理与推理 ---------------- */

async function toDrawable(source) {
  if (typeof source === 'string') {
    const img = new Image()
    img.src = source
    img.decoding = 'async'
    await img.decode().catch(
      () => new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('图片解析失败'))
      })
    )
    return img
  }
  return source
}

function preprocess(source, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const plane = size * size
  const tensor = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const p = i * 4
    tensor[i] = (data[p] / 255 - MEAN[0]) / STD[0]
    tensor[plane + i] = (data[p + 1] / 255 - MEAN[1]) / STD[1]
    tensor[2 * plane + i] = (data[p + 2] / 255 - MEAN[2]) / STD[2]
  }
  return tensor
}

/**
 * 识别一张图片。
 * @param {string|HTMLImageElement|HTMLCanvasElement|ImageBitmap} source 图片地址或可绘制对象
 * @param {{ topK?: number }} options
 * @returns {Promise<{ candidates: Array, topConfidence: number, likelyPlant: boolean }>}
 */
export async function recognizeImage(source, { topK = 5 } = {}) {
  const engine = await prepareModel()
  const drawable = await toDrawable(source)
  const size = engine.size
  const tensor = new engine.ort.Tensor('float32', preprocess(drawable, size), [1, 3, size, size])

  const outputs = await engine.session.run({ input: tensor })
  const logits = outputs.logits.data

  if (!libraryIndex) libraryIndex = buildLibraryIndex()
  const raw = topPlantCandidates(logits, engine.classes, topK)
  const candidates = decorateCandidates(raw, libraryIndex)
  const topConfidence = candidates[0]?.confidence || 0

  return {
    candidates,
    topConfidence,
    likelyPlant: topConfidence >= PLANT_CONFIDENCE_FLOOR
  }
}

/** 模型是否已在本次会话中加载完成（不代表已缓存到磁盘） */
export function isEngineReady() {
  return Boolean(enginePromise)
}
