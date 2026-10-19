/**
 * 读取用户选择的图片，等比压缩后返回 base64(JPEG)。
 * 目的：控制照片体积，减少云盘占用与上传/加载时间。
 */
export function fileToResizedDataURL(file, { maxWidth = 900, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('未选择文件'))
    if (!file.type.startsWith('image/')) return reject(new Error('请选择图片文件'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/** 将 JS 数据导出为 JSON 文件下载 */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 读取本地 JSON 文件（用于导入投稿数据） */
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result))
      } catch (e) {
        reject(new Error('文件不是有效的 JSON'))
      }
    }
    reader.readAsText(file)
  })
}
