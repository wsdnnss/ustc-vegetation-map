/**
 * 表格解析工具：供「批量导入」使用。
 * 支持从 Excel/WPS 直接粘贴（制表符分隔）或上传 CSV/TSV 文本。
 */

/** 各字段可识别的表头别名（大小写不敏感） */
const ALIASES = {
  name: ['物种', '物种名', '名称', '中文名', '植物', 'species', 'name', 'plant'],
  lat: ['纬度', 'lat', 'latitude'],
  lng: ['经度', 'lng', 'lon', 'long', 'longitude'],
  note: ['备注', '说明', 'note', 'remark', '描述'],
  photo: ['照片', '照片文件名', '图片', '图片名', '文件名', 'photo', 'image', 'file'],
  collector: ['采集人', '调查人', '记录人', 'collector', 'author']
}

/** 无表头时的列顺序 */
export const COLUMN_ORDER = ['name', 'lat', 'lng', 'note', 'photo', 'collector']

/** 拆分一行（支持引号包裹与转义） */
function splitLine(line, delimiter) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/** 解析整段文本为 { headers, rows } */
export function parseTable(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (!lines.length) return { headers: [], rows: [] }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const first = splitLine(lines[0], delimiter)
  const allAliasWords = Object.values(ALIASES).flat()
  const hasHeader = first.some((c) => allAliasWords.some((a) => c.toLowerCase() === a.toLowerCase()))

  return {
    headers: hasHeader ? first : [],
    rows: (hasHeader ? lines.slice(1) : lines).map((l) => splitLine(l, delimiter))
  }
}

function findIndex(headers, key) {
  const list = ALIASES[key] || []
  return headers.findIndex((h) => list.some((a) => h.toLowerCase() === a.toLowerCase()))
}

function toNumber(v) {
  if (v === null || v === undefined || String(v).trim() === '') return NaN
  const n = parseFloat(String(v).replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** 将解析结果映射为结构化行 */
export function mapRows({ headers, rows }) {
  const idx = {}
  if (headers.length) {
    for (const key of COLUMN_ORDER) idx[key] = findIndex(headers, key)
  } else {
    COLUMN_ORDER.forEach((key, i) => (idx[key] = i))
  }

  return rows.map((cells, i) => {
    const get = (key) => (idx[key] >= 0 ? (cells[idx[key]] || '').trim() : '')
    return {
      rowNo: i + 1,
      name: get('name'),
      lat: toNumber(get('lat')),
      lng: toNumber(get('lng')),
      note: get('note'),
      photo: get('photo'),
      collector: get('collector')
    }
  })
}

/** 归一化文件名（去扩展名、小写），用于照片匹配 */
export function normKey(fileName) {
  return String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
}

/** 读取表格文件：xlsx/xls 自动转成制表符文本；CSV/TSV 兼容 UTF-8 / GBK */
export async function readTableFile(file) {
  if (/\.(xlsx|xls)$/i.test(file.name || '')) {
    const buffer = await file.arrayBuffer()
    const mod = await import('xlsx')
    const XLSX = mod.default || mod
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) throw new Error('Excel 中没有可读取的工作表')
    return XLSX.utils.sheet_to_csv(sheet, { FS: '\t' })
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      const buf = reader.result
      let text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
      if (text.includes('\uFFFD')) {
        try {
          text = new TextDecoder('gbk').decode(buf)
        } catch (e) {
          /* 环境不支持 gbk 时忽略 */
        }
      }
      resolve(text.replace(/^\uFEFF/, ''))
    }
    reader.readAsArrayBuffer(file)
  })
}

export const TEMPLATE_CSV =
  '\uFEFF物种,纬度,经度,备注,照片文件名,采集人\n' +
  '香樟,31.8395,117.2620,东区北门主干道,IMG_0001.jpg,张三\n' +
  '银杏,31.8398,117.2686,东区樱花大道旁,IMG_0002.jpg,李四\n'

/** 下载 CSV 模板（带 BOM，Excel 直接打开不乱码） */
export function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '植被调查-导入模板.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
