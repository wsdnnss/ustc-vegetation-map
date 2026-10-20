<template>
  <div>
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Contribute</p>
        <h2 class="page-title">上传投稿</h2>
        <p class="page-sub">
          上传植物照片、选择物种与位置，即可在地图上新增一个标记（{{ diskMode ? '数据保存到科大云盘' : '数据保存在本机浏览器中' }}）。
        </p>
      </div>
    </div>

    <div class="layout">
      <!-- 表单 -->
      <form class="card form" @submit.prevent="submit">
        <h3 class="sub-title"><span class="step-no">1</span>选择照片</h3>
        <div class="uploader" :class="{ 'has-img': form.image }">
          <img v-if="form.image" :src="form.image" alt="预览" />
          <div v-else class="ph">
            <span class="ph-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34">
                <rect x="5" y="9" width="38" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="2.4" />
                <circle cx="16" cy="20" r="3.6" fill="currentColor" opacity="0.7" />
                <path d="M8 34l9.5-9.5 7 7 5-5L42 36" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span>点击选择图片</span>
            <small>支持 JPG / PNG，会自动压缩</small>
          </div>
          <input type="file" accept="image/*" @change="onFile" />
        </div>
        <button v-if="form.image" type="button" class="btn btn-ghost" @click="form.image = ''">
          移除图片
        </button>

        <h3 class="sub-title"><span class="step-no">2</span>物种信息</h3>
        <div class="field">
          <label>从物种库选择（可选）</label>
          <select v-model="form.speciesId" @change="onSpeciesChange">
            <option value="">— 不选择，手动填写 —</option>
            <option v-for="s in speciesList" :key="s.id" :value="s.id">
              {{ s.nameCn }}（{{ s.family }}）
            </option>
          </select>
        </div>
        <div class="field">
          <label>物种名称 *</label>
          <input v-model.trim="form.name" type="text" placeholder="如：香樟 / 不确定可填“待鉴定”" />
        </div>

        <h3 class="sub-title"><span class="step-no">3</span>采集位置 <i class="req">*</i></h3>
        <p class="tip muted">在地图上点一下即可选点，也可直接填写经纬度。</p>
        <div ref="pickMapEl" class="pick-map"></div>
        <div class="coord-row">
          <div class="field">
            <label>纬度 lat</label>
            <input v-model.number="form.lat" type="number" step="0.0001" placeholder="31.8395" />
          </div>
          <div class="field">
            <label>经度 lng</label>
            <input v-model.number="form.lng" type="number" step="0.0001" placeholder="117.2620" />
          </div>
          <button type="button" class="btn" @click="useCampusCenter">用校园中心</button>
        </div>

        <div class="field">
          <label>备注</label>
          <textarea v-model.trim="form.note" rows="2" placeholder="如：东区樱花大道旁，盛花期"></textarea>
        </div>

        <button type="submit" class="btn btn-primary submit" :disabled="saving">
          {{ saving ? '保存中…' : '保存投稿' }}
        </button>
        <p v-if="message" class="msg" :class="messageType">{{ message }}</p>
      </form>

      <!-- 我的投稿 -->
      <aside class="card side">
        <div class="side-head">
          <h3 class="sub-title">我的投稿（{{ submissions.length }}）</h3>
          <div class="side-actions">
            <button class="btn btn-ghost" :disabled="!submissions.length" @click="exportData">
              导出 JSON
            </button>
            <button class="btn btn-ghost" @click="triggerImport">导入 JSON</button>
            <input ref="importEl" type="file" accept="application/json" hidden @change="onImport" />
          </div>
        </div>

        <div v-if="submissions.length" class="sub-list">
          <div v-for="sub in submissions" :key="sub.id" class="sub-item">
            <img v-if="sub.image" :src="sub.image" alt="投稿" />
            <div v-else class="no-img">无图</div>
            <div class="sub-body">
              <b>{{ sub.name }}</b>
              <small class="muted">
                {{ sub.lat?.toFixed(4) }}, {{ sub.lng?.toFixed(4) }}
                <template v-if="sub.note"> · {{ sub.note }}</template>
              </small>
            </div>
            <button class="del" title="删除" @click="remove(sub.id)">✕</button>
          </div>
        </div>
        <div v-else class="empty-state side-empty">
          <div class="empty-art" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="42" height="42" fill="none">
              <rect x="9" y="20" width="46" height="32" rx="7" stroke="currentColor" stroke-width="2.4" opacity="0.45" />
              <path d="M23 20l3-6h12l3 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.45" />
              <circle cx="32" cy="35" r="9" stroke="currentColor" stroke-width="2.2" opacity="0.6" />
              <path
                d="M32 29c-3 1.8-4.7 4-4.7 6.6a4.7 4.7 0 0 0 9.4 0c0-2.6-1.7-4.8-4.7-6.6z"
                fill="currentColor"
                opacity="0.22"
              />
            </svg>
          </div>
          <h4>还没有投稿</h4>
          <p>上传第一张植物照片，它就会出现在校园地图上。</p>
        </div>

        <button
          v-if="submissions.length"
          class="btn btn-ghost danger"
          @click="clearAll"
        >
          清空全部投稿
        </button>

        <p class="side-tip muted">
          <template v-if="diskMode">
            数据保存在科大云盘同步目录（{{ diskDir }}），换浏览器/清缓存不会丢失。
          </template>
          <template v-else>
            数据保存在本机浏览器（localStorage），换浏览器/清缓存会丢失，建议定期“导出 JSON”备份。
          </template>
        </p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import L from 'leaflet'
import { speciesList, getSpeciesById, campus } from '@/utils/species'
import {
  addSubmission,
  addSubmissions,
  clearSubmissions,
  loadSubmissions,
  removeSubmission
} from '@/utils/storage'
import { downloadJSON, fileToResizedDataURL, readJSONFile } from '@/utils/image'
import { getDiskStatus, uploadPhoto } from '@/utils/diskStore'

const disk = getDiskStatus()
const diskMode = disk.available
const diskDir = disk.dir

const pickMapEl = ref(null)
const importEl = ref(null)
let pickMap = null
let pickMarker = null

const submissions = ref(loadSubmissions())
const message = ref('')
const messageType = ref('ok')
const saving = ref(false)

const form = reactive({
  speciesId: '',
  name: '',
  lat: null,
  lng: null,
  note: '',
  image: ''
})

function flash(text, type = 'ok') {
  message.value = text
  messageType.value = type
  window.clearTimeout(flash._t)
  flash._t = window.setTimeout(() => (message.value = ''), 2600)
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    form.image = await fileToResizedDataURL(file)
    flash('图片已就绪')
  } catch (err) {
    flash(err.message || '图片处理失败', 'err')
  } finally {
    e.target.value = ''
  }
}

function onSpeciesChange() {
  const s = getSpeciesById(form.speciesId)
  if (s) form.name = s.nameCn
}

function useCampusCenter() {
  form.lat = campus.center.lat
  form.lng = campus.center.lng
  updatePickerMarker()
}

function updatePickerMarker() {
  if (!pickMap || typeof form.lat !== 'number' || typeof form.lng !== 'number') return
  const ll = [form.lat, form.lng]
  if (pickMarker) {
    pickMarker.setLatLng(ll)
  } else {
    pickMarker = L.marker(ll, {
      icon: L.divIcon({
        className: '',
        html: '<div class="pin-dot" style="background:#e08e0b"></div>',
        iconSize: [13, 13],
        iconAnchor: [6.5, 6.5]
      })
    }).addTo(pickMap)
  }
  pickMap.panTo(ll)
}

watch(() => [form.lat, form.lng], updatePickerMarker)

async function submit() {
  if (saving.value) return
  if (!form.name) return flash('请填写物种名称', 'err')
  if (typeof form.lat !== 'number' || typeof form.lng !== 'number')
    return flash('请在图上选点或填写经纬度', 'err')

  saving.value = true
  try {
    // 照片保存为独立文件，投稿 JSON 只记录图片地址
    const image = form.image ? await uploadPhoto(form.image) : ''
    const record = await addSubmission({
      speciesId: form.speciesId || '',
      name: form.name,
      lat: Number(form.lat),
      lng: Number(form.lng),
      note: form.note,
      image
    })

    if (!record) return flash('保存失败：请确认数据服务已启动后重试', 'err')

    submissions.value = loadSubmissions()
    flash('已保存，可到“分布地图”查看')

    // 保留物种选择，清空其余
    form.note = ''
    form.image = ''
  } finally {
    saving.value = false
  }
}

async function remove(id) {
  submissions.value = await removeSubmission(id)
}

async function clearAll() {
  if (!window.confirm('确定清空全部投稿吗？此操作不可恢复。')) return
  await clearSubmissions()
  submissions.value = []
}

function exportData() {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadJSON(submissions.value, `submissions-export-${stamp}.json`)
}

function triggerImport() {
  importEl.value?.click()
}

async function onImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const data = await readJSONFile(file)
    if (!Array.isArray(data)) throw new Error('文件格式应为投稿数组')
    const added = await addSubmissions(data)
    submissions.value = loadSubmissions()
    flash(`已导入 ${added} 条`)
  } catch (err) {
    flash(err.message || '导入失败', 'err')
  } finally {
    e.target.value = ''
  }
}

onMounted(() => {
  const b = campus.bounds
  pickMap = L.map(pickMapEl.value, {
    center: [campus.center.lat, campus.center.lng],
    zoom: campus.zoom || 17,
    minZoom: campus.minZoom || 17,
    maxZoom: campus.maxZoom || 19,
    maxBounds: b ? L.latLngBounds([b.south, b.west], [b.north, b.east]) : null,
    maxBoundsViscosity: 1.0
  })
  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: '1234',
      maxZoom: campus.maxZoom || 19,
      maxNativeZoom: 18,
      attribution: '© 高德地图'
    }
  ).addTo(pickMap)

  pickMap.on('click', (e) => {
    form.lat = Number(e.latlng.lat.toFixed(5))
    form.lng = Number(e.latlng.lng.toFixed(5))
  })
})

onBeforeUnmount(() => {
  if (pickMap) {
    pickMap.remove()
    pickMap = null
  }
})
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.form {
  padding: 28px 30px 32px;
  position: relative;
  z-index: 1;
}

.sub-title {
  display: flex;
  align-items: center;
  margin: 28px 0 14px;
  color: var(--ink-strong);
  font-size: 16px;
  font-weight: 700;
}

.sub-title:first-child {
  margin-top: 0;
}

.req {
  margin-left: 3px;
  color: #c0562f;
  font-style: normal;
}

.uploader {
  position: relative;
  margin-bottom: 12px;
  border: 1.5px dashed var(--green-300);
  border-radius: var(--radius);
  background: linear-gradient(180deg, #f8fbf6, var(--green-050));
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.uploader:hover {
  border-color: var(--green-500);
  background: var(--green-050);
}

.uploader.has-img {
  border-style: solid;
  border-color: var(--line);
}

.uploader img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
}

.uploader .ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  color: var(--ink-soft);
  font-size: 14px;
}

.ph-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 2px;
  border: 1px solid var(--green-200);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--shadow-sm);
  color: var(--green-600);
}

.uploader small {
  color: #8b9a91;
  font-size: 12px;
}

.uploader input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.tip {
  margin: 0 0 10px;
  font-size: 12.5px;
}

.pick-map {
  height: 280px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  overflow: hidden;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.coord-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.coord-row .field {
  flex: 1;
  min-width: 120px;
  margin-bottom: 8px;
}

.coord-row .btn {
  margin-bottom: 14px;
}

.submit {
  width: 100%;
  min-height: 44px;
  margin-top: 6px;
  font-size: 15px;
}

.msg {
  margin: 10px 0 0;
  font-size: 13.5px;
}

.msg.ok {
  color: var(--green-700);
}

.msg.err {
  color: #c62828;
}

/* 侧栏 */
.side {
  position: sticky;
  top: 100px;
  padding: 24px;
  z-index: 1;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.side-actions {
  display: flex;
  gap: 4px;
}

.sub-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 460px;
  overflow: auto;
  margin: 12px 0;
}

.sub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.sub-item:hover {
  border-color: var(--green-300);
  background: #fbfdf9;
}

.sub-item img,
.no-img {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  flex: 0 0 auto;
  background: var(--green-050);
}

.no-img {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ink-soft);
}

.sub-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sub-body b {
  font-size: 14px;
}

.sub-body small {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side .sub-title {
  margin-bottom: 0;
}

.del {
  border: none;
  background: transparent;
  color: var(--danger);
  font-size: 14px;
  padding: 4px 6px;
  border-radius: 6px;
}

.del:hover {
  background: var(--danger-050);
}

.danger {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
  color: var(--danger);
}

.danger:hover {
  background: var(--danger-050);
  color: var(--danger);
}

.side-empty {
  padding: 44px 12px 40px;
}

.side-empty .empty-art {
  width: 84px;
  height: 84px;
  margin-bottom: 2px;
  border-radius: 26px;
}

.side-empty h4 {
  font-size: 15px;
}

.side-empty p {
  margin-bottom: 0;
  font-size: 12.5px;
}

.side-tip {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}

@media (max-width: 640px) {
  .form {
    padding: 22px 18px 26px;
  }
  .side {
    padding: 20px 18px;
  }
}
</style>
