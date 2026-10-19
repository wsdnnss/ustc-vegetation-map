<template>
  <div>
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Batch Import</p>
        <h2 class="page-title">批量导入</h2>
        <p class="page-sub">
          适合「多人调查 → 一人统一录入」：先整理一张表格，再一次性导入点位与照片。
        </p>
      </div>
    </div>

    <!-- 步骤 1：表格 -->
    <section class="card step">
      <h3 class="sub-title"><span class="step-no">1</span>准备表格</h3>
      <p class="help muted">
        列顺序（有表头即可自动识别）：
        <b>物种, 纬度, 经度, 备注, 照片文件名, 采集人</b>。
        可直接从 Excel/WPS 框选复制后粘贴到下面，或上传 CSV 文件。
      </p>

      <div class="row">
        <button class="btn" @click="downloadTemplate">下载 CSV 模板</button>
        <button class="btn" @click="csvInput.click()">上传 CSV 文件</button>
        <input
          ref="csvInput"
          type="file"
          accept=".csv,.tsv,.txt"
          hidden
          @change="onCsv"
        />
        <span v-if="fileName" class="muted">已读取：{{ fileName }}</span>
      </div>

      <textarea
        v-model="tableText"
        class="paste"
        rows="7"
        wrap="off"
        placeholder="物种	纬度	经度	备注	照片文件名	采集人&#10;香樟	31.8395	117.262	东门	IMG_0001.jpg	张三"
      ></textarea>
      <p class="muted small">已解析 {{ rows.length }} 行</p>
    </section>

    <!-- 步骤 2：照片 -->
    <section class="card step">
      <h3 class="sub-title"><span class="step-no">2</span>选择照片（可多选）</h3>
      <p class="help muted">
        按表格中的「照片文件名」自动匹配，可写全名（IMG_0001.jpg）或只写前缀（IMG_0001）。
      </p>
      <div class="row">
        <button class="btn" :disabled="photoProcessing" @click="photoInput.click()">
          {{ photoProcessing ? `处理中 ${photoProgress}/${photoTotal}` : '选择照片' }}
        </button>
        <input ref="photoInput" type="file" accept="image/*" multiple hidden @change="onPhotos" />
        <span class="muted">已加载 {{ photoInfo.length }} 张照片</span>
        <button v-if="photoInfo.length" class="btn btn-ghost" @click="clearPhotos">清空照片</button>
      </div>
    </section>

    <!-- 步骤 3：预览 + 导入 -->
    <section class="card step">
      <h3 class="sub-title"><span class="step-no">3</span>预览并导入</h3>

      <div v-if="!rows.length" class="empty-state batch-empty">
        <div class="empty-art" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="46" height="46" fill="none">
            <rect x="10" y="12" width="44" height="40" rx="6" stroke="currentColor" stroke-width="2.4" opacity="0.45" />
            <path d="M10 24h44M24 24v28M38 24v28M10 35h44M10 45h44" stroke="currentColor" stroke-width="1.8" opacity="0.35" />
            <path d="M17 18h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.6" />
          </svg>
        </div>
        <h4>还没有可预览的数据</h4>
        <p>先在上方粘贴表格或上传 CSV，这里会自动解析并校验。</p>
      </div>

      <template v-else>
        <div class="summary">
          <span class="stat ok">可导入 {{ okCount }} 条</span>
          <span v-if="errCount" class="stat bad">有误 {{ errCount }} 条</span>
          <span v-if="missingPhotoCount" class="stat warn">
            照片未匹配 {{ missingPhotoCount }} 条
          </span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>行</th>
                <th>物种</th>
                <th>纬度</th>
                <th>经度</th>
                <th>备注</th>
                <th>照片</th>
                <th>采集人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in preview" :key="r.rowNo" :class="{ bad: !r.ok }">
                <td>{{ r.rowNo }}</td>
                <td>{{ r.name || '—' }}</td>
                <td>{{ Number.isFinite(r.lat) ? r.lat : '—' }}</td>
                <td>{{ Number.isFinite(r.lng) ? r.lng : '—' }}</td>
                <td class="note">{{ r.note || '—' }}</td>
                <td>
                  <img v-if="r.image" :src="r.image" class="thumb" alt="照片" />
                  <span v-else-if="r.photoStatus === 'missing'" class="pill warn">未匹配</span>
                  <span v-else class="muted">无</span>
                </td>
                <td>{{ r.collector || '—' }}</td>
                <td>
                  <span v-if="r.ok" class="pill ok">可导入</span>
                  <span v-else class="pill bad">{{ r.errors.join('、') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="actions">
          <button class="btn btn-primary" :disabled="!okCount || importing" @click="doImport">
            {{ importing ? '导入中…' : `导入 ${okCount} 条记录` }}
          </button>
          <button class="btn btn-ghost" @click="resetAll">清空</button>
          <span class="muted small">
            导入后可在「分布地图」查看，并到「上传投稿」页导出 JSON 备份
          </span>
        </div>
      </template>

      <p v-if="message" class="msg" :class="messageType">{{ message }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  mapRows,
  normKey,
  parseTable,
  readTableFile,
  downloadTemplate
} from '@/utils/table'
import { fileToResizedDataURL } from '@/utils/image'
import { uploadPhoto } from '@/utils/diskStore'
import { loadSubmissions, saveSubmissions } from '@/utils/storage'

const csvInput = ref(null)
const photoInput = ref(null)
const fileName = ref('')
const tableText = ref('')

const photoFull = ref({})
const photoBase = ref({})
const photoInfo = ref([])
const photoProcessing = ref(false)
const photoProgress = ref(0)
const photoTotal = ref(0)

const importing = ref(false)
const message = ref('')
const messageType = ref('ok')

const parsed = computed(() => parseTable(tableText.value))
const rows = computed(() => mapRows(parsed.value))

function matchPhoto(row) {
  const raw = (row.photo || '').trim()
  if (!raw) return { image: '', status: 'none' }
  if (photoFull.value[raw.toLowerCase()]) return { image: photoFull.value[raw.toLowerCase()], status: 'ok' }
  const base = normKey(raw)
  if (photoBase.value[base]) return { image: photoBase.value[base], status: 'ok' }
  return { image: '', status: 'missing' }
}

const preview = computed(() =>
  rows.value.map((r) => {
    const { image, status } = matchPhoto(r)
    const errors = []
    if (!r.name) errors.push('缺物种名')
    if (!Number.isFinite(r.lat) || r.lat < -90 || r.lat > 90) errors.push('纬度无效')
    if (!Number.isFinite(r.lng) || r.lng < -180 || r.lng > 180) errors.push('经度无效')
    return { ...r, image, photoStatus: status, errors, ok: errors.length === 0 }
  })
)

const okCount = computed(() => preview.value.filter((r) => r.ok).length)
const errCount = computed(() => preview.value.filter((r) => !r.ok).length)
const missingPhotoCount = computed(
  () => preview.value.filter((r) => r.ok && r.photoStatus === 'missing').length
)

function flash(text, type = 'ok') {
  message.value = text
  messageType.value = type
  window.clearTimeout(flash._t)
  flash._t = window.setTimeout(() => (message.value = ''), 3000)
}

async function onCsv(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    tableText.value = await readTableFile(file)
    fileName.value = file.name
    flash(`已读取 ${file.name}`)
  } catch (err) {
    flash(err.message || '读取失败', 'err')
  } finally {
    e.target.value = ''
  }
}

async function onPhotos(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  photoProcessing.value = true
  photoTotal.value = files.length
  photoProgress.value = 0
  for (const f of files) {
    try {
      const url = await fileToResizedDataURL(f)
      photoFull.value[f.name.toLowerCase()] = url
      photoBase.value[normKey(f.name)] = url
      photoInfo.value.push({ name: f.name })
    } catch (err) {
      /* 单张失败跳过 */
    }
    photoProgress.value++
  }
  photoProcessing.value = false
  flash(`已加载 ${files.length} 张照片`)
  e.target.value = ''
}

function clearPhotos() {
  photoFull.value = {}
  photoBase.value = {}
  photoInfo.value = []
}

async function doImport() {
  const valid = preview.value.filter((r) => r.ok)
  if (!valid.length) return flash('没有可导入的有效数据', 'err')

  const withImg = valid.filter((r) => r.image).length
  if (!window.confirm(`即将导入 ${valid.length} 条记录（含照片 ${withImg} 条），确定吗？`)) return

  importing.value = true
  try {
    const list = loadSubmissions()
    const now = Date.now()
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i]
      list.push({
        id: `sub-b${now}-${i}`,
        createdAt: new Date().toISOString(),
        speciesId: '',
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        note: r.note,
        collector: r.collector,
        // 照片逐张写入云盘独立文件，JSON 中只保存图片地址
        image: r.image ? await uploadPhoto(r.image) : ''
      })
    }

    const saved = saveSubmissions(list)

    if (!saved) {
      return flash('保存失败：照片过多超出浏览器本地容量，请分批导入', 'err')
    }
    flash(`成功导入 ${valid.length} 条记录`)
    resetAll(false)
  } finally {
    importing.value = false
  }
}

function resetAll(clearMsg = true) {
  tableText.value = ''
  fileName.value = ''
  clearPhotos()
  if (clearMsg) message.value = ''
}
</script>

<style scoped>
.step {
  padding: 28px 30px;
  margin-bottom: 24px;
}

.sub-title {
  display: flex;
  align-items: center;
  margin: 0 0 10px;
  color: var(--ink-strong);
  font-size: 16px;
  font-weight: 700;
}

.help {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.75;
}

.row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.paste {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  font-family: Consolas, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.paste:focus {
  border-color: var(--green-500);
  box-shadow: var(--ring);
}

.paste::placeholder {
  color: #9aa9a0;
}

.small {
  font-size: 12.5px;
}

.summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.stat {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
}

.stat.ok {
  background: var(--green-050);
  color: var(--green-700);
}

.stat.bad {
  background: var(--danger-050);
  color: var(--danger);
}

.stat.warn {
  background: var(--amber-050);
  color: var(--amber);
}

.table-wrap {
  max-height: 440px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eef3ec;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: #f8fbf6;
  color: var(--ink-soft);
  font-weight: 600;
  z-index: 1;
}

tbody tr {
  transition: background 0.14s ease;
}

tbody tr:hover {
  background: #fbfdf9;
}

tr.bad {
  background: #fffafa;
}

td.note {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumb {
  width: 46px;
  height: 34px;
  object-fit: cover;
  border-radius: 6px;
  background: var(--green-050);
}

.pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
}

.pill.ok {
  background: var(--green-050);
  color: var(--green-700);
}

.pill.bad {
  background: var(--danger-050);
  color: var(--danger);
}

.pill.warn {
  background: var(--amber-050);
  color: var(--amber);
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.batch-empty {
  padding: 52px 16px 48px;
}

.batch-empty .empty-art {
  width: 88px;
  height: 88px;
  border-radius: 28px;
}

.msg {
  margin: 12px 0 0;
  font-size: 13.5px;
}

.msg.ok {
  color: var(--green-700);
}

.msg.err {
  color: #c62828;
}

@media (max-width: 640px) {
  .step {
    padding: 22px 18px;
  }
}
</style>
