import raw from '@/data/species.json'

export const campus = raw.meta
export const speciesList = raw.species

/** 按 id 获取物种 */
export function getSpeciesById(id) {
  return speciesList.find((s) => s.id === id)
}

/** 全部科名（去重排序），用于筛选下拉 */
export function allFamilies() {
  return [...new Set(speciesList.map((s) => s.family))].sort()
}

/** 1-12 月 */
export function allMonths() {
  return Array.from({ length: 12 }, (_, i) => i + 1)
}

/**
 * 生成物种封面图 URL。
 * 优先使用数据里的 imageUrl（放本地图片后可填 '/images/xxx.jpg'）；
 * 否则依据 imagePrompt 走平台文生图接口，避免出现空白图。
 */
export function speciesImage(species) {
  if (!species) return ''
  if (species.imageUrl) return species.imageUrl
  const prompt =
    species.imagePrompt ||
    `${species.nameLatin || species.nameCn} plant, botanical photography, natural light`
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt
  )}&image_size=landscape_4_3`
}

/** 拉平所有分布点，供地图渲染/统计使用 */
export function allPoints() {
  const out = []
  for (const s of speciesList) {
    for (const p of s.points || []) {
      out.push({
        lat: p.lat,
        lng: p.lng,
        location: p.location,
        speciesId: s.id,
        nameCn: s.nameCn,
        family: s.family
      })
    }
  }
  return out
}

/** 判断某物种是否在指定月份开花 */
export function bloomsIn(species, month) {
  if (!month) return true
  return (species.bloomMonths || []).includes(Number(month))
}

/** 是否有校园分布点位（已记录 / 待核实 的区分依据） */
export function hasPoints(species) {
  return (species.points || []).length > 0
}

/** 生活型归类规则（顺序敏感） */
const CATEGORY_RULES = [
  { name: '水生', test: (h) => h.includes('水生') },
  { name: '竹类', test: (h) => h.includes('竹') },
  { name: '蕨类', test: (h) => h.includes('蕨') },
  { name: '藤本', test: (h) => h.includes('藤本') },
  { name: '灌木', test: (h) => h.includes('灌木') },
  { name: '乔木', test: (h) => h.includes('乔木') },
  { name: '草本', test: (h) => h.includes('草本') }
]

/** 由 habit 推导类别 */
export function categoryOf(species) {
  const h = species?.habit || ''
  for (const r of CATEGORY_RULES) if (r.test(h)) return r.name
  return '其他'
}

/** 全部类别 */
export function allCategories() {
  return [...new Set(speciesList.map(categoryOf))]
}

/** 已记录（有分布点）的物种数 */
export function recordedCount() {
  return speciesList.filter(hasPoints).length
}

/** 别名数组（缺省为空数组） */
export function aliasesOf(species) {
  return species?.alias || []
}

/** 参考文献（来自 meta.reference） */
export const reference = raw.meta.reference || null

/** 数据分级说明（来自 meta.dataNotice） */
export const dataNotice = raw.meta.dataNotice || ''

/**
 * 物种数据可信度分级：
 * - candidate 待核实：公开资料整理的候选清单，无校园点位
 * - example   示例坐标：有分布点，但为演示用近似值（未实测）
 * - measured  实地调查：点位带 source=实地调查 或 measured=true
 */
export function dataLevelOf(species) {
  const points = species?.points || []
  if (!points.length) {
    return {
      key: 'candidate',
      label: '公开资料整理',
      note: '该物种来自公开资料整理的候选清单，尚未在校园内定位，需实地确认。'
    }
  }
  if (points.some((p) => p?.source === '实地调查' || p?.measured === true)) {
    return {
      key: 'measured',
      label: '实地调查',
      note: '该物种的分布点来自实地调查记录。'
    }
  }
  return {
    key: 'example',
    label: '示例坐标',
    note: '分布点为演示用近似坐标（约 ±50 m），未实地测量，不可作为专业依据。'
  }
}

/** 单个点位的精度说明 */
export function pointAccuracyText(point) {
  if (!point) return ''
  if (point.source === '实地调查' || point.measured === true) {
    return point.coordAccuracy || '实地调查点位'
  }
  return point.coordAccuracy || '示例坐标（约 ±50 m，未实测）'
}


/**
 * 统一检索文本：中文名 / 学名 / 别名 / 科属 / 标签 / 描述 / 识别特征 / 学名来源。
 * 供列表页与地图页的关键词搜索复用，保证各处检索口径一致。
 */
export function searchText(species) {
  return [
    species.nameCn,
    species.nameLatin,
    (species.alias || []).join(' '),
    species.family,
    species.genus,
    (species.tags || []).join(' '),
    species.description,
    species.identify,
    species.nameOrigin
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
