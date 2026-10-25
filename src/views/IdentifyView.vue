<template>
  <div>
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Identify</p>
        <h2 class="page-title">拍照识树</h2>
        <p class="page-sub">
          拍一张或选一张校园植物的照片，在浏览器里本地识别，给出最可能的几种植物；
          确认后可以带着照片和物种直接去投稿。
        </p>
      </div>
    </div>

    <div class="layout">
      <section class="card panel">
        <h3 class="sub-title"><span class="step-no">1</span>选择照片</h3>
        <div
          class="uploader"
          :class="{ 'has-img': image, dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <img v-if="image" :src="image" alt="待识别照片" />
          <div v-else class="ph">
            <span class="ph-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34">
                <rect x="5" y="9" width="38" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="2.4" />
                <circle cx="16" cy="20" r="3.6" fill="currentColor" opacity="0.7" />
                <path
                  d="M8 34l9.5-9.5 7 7 5-5L42 36"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span>点击拍照或选择图片</span>
            <small>手机可直接调用相机；图片会自动压缩</small>
          </div>
          <input ref="fileEl" type="file" accept="image/*" @change="onFile" />
        </div>
        <div class="photo-actions">
          <button type="button" class="btn" @click="fileEl?.click()">
            {{ image ? '换一张' : '拍照 / 选图' }}
          </button>
          <button v-if="image" type="button" class="btn btn-ghost" @click="image = ''">
            移除照片
          </button>
        </div>
        <p v-if="error" class="err" role="alert">{{ error }}</p>

        <PhotoIdentify
          :image="image"
          action-label="用这个结果去投稿"
          @select="onSelect"
        />
      </section>

      <aside class="card tips">
        <h3 class="sub-title"><span class="step-no">?</span>怎么拍更容易认对</h3>
        <ul>
          <li>让叶片、花或果实占据画面主要位置，避免逆光和大面积阴影。</li>
          <li>树下远景、整片林子很难识别，靠近拍局部特征更可靠。</li>
          <li>同科植物长相接近，最好再拍一张树皮、叶背或果实作对照。</li>
        </ul>

        <h3 class="sub-title"><span class="step-no">i</span>关于这个功能</h3>
        <ul>
          <li>模型在浏览器内运行，照片不会上传到任何服务器。</li>
          <li><b>识别结果只在物种库 229 种内排序</b>，不会出现库外植物。</li>
          <li>其中 73 种有模型直接类别，89 种按「同属参考」（置信度会折减），银杏、桂花等 67 种暂无法识别。</li>
          <li>首次识别需下载约 43 MB 模型，浏览器会缓存；识别一张约 0.3–2 秒（取决于设备）。</li>
          <li>结果只作为候选提示，不能替代实地观察和专业鉴定。</li>
        </ul>

        <p class="back">
          <router-link to="/upload" class="link">跳过识别，直接上传投稿 →</router-link>
        </p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fileToResizedDataURL } from '@/utils/image'
import PhotoIdentify from '@/components/PhotoIdentify.vue'

const router = useRouter()
const fileEl = ref(null)
const image = ref('')
const dragging = ref(false)
const error = ref('')

async function handleFile(file) {
  if (!file) return
  error.value = ''
  try {
    image.value = await fileToResizedDataURL(file)
  } catch (err) {
    error.value = err.message || '图片处理失败'
  }
}

async function onFile(e) {
  await handleFile(e.target.files?.[0])
  e.target.value = ''
}

async function onDrop(e) {
  dragging.value = false
  await handleFile(e.dataTransfer?.files?.[0])
}

function onSelect(payload) {
  try {
    sessionStorage.setItem(
      'ustc-veg-identify',
      JSON.stringify({
        image: image.value,
        name: payload.name,
        speciesId: payload.speciesId || '',
        latin: payload.latin || '',
        at: Date.now()
      })
    )
  } catch (e) {
    // 存储失败时仍然跳转，用户可以在投稿页手动填物种
  }
  router.push('/upload')
}
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.panel {
  padding: 26px 28px 30px;
}

.tips {
  padding: 24px;
  position: sticky;
  top: 100px;
}

.sub-title {
  display: flex;
  align-items: center;
  margin: 0 0 14px;
  color: var(--ink-strong);
  font-size: 15.5px;
  font-weight: 700;
}

.tips .sub-title:not(:first-child) {
  margin-top: 22px;
}

.step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--green-100);
  color: var(--green-700);
  font-size: 11.5px;
  font-weight: 700;
}

.tips ul {
  margin: 0;
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.85;
}

.tips li + li {
  margin-top: 6px;
}

.back {
  margin: 20px 0 0;
}

.link {
  color: var(--green-700);
  font-size: 13px;
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.uploader {
  position: relative;
  margin-bottom: 12px;
  border: 1.5px dashed var(--green-300);
  border-radius: var(--radius);
  background: linear-gradient(180deg, #f8fbf6, var(--green-050));
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.uploader:hover,
.uploader.dragging {
  border-color: var(--green-500);
  background: var(--green-050);
}

.uploader.has-img {
  border-style: solid;
  border-color: var(--line);
}

.uploader img {
  width: 100%;
  max-height: 380px;
  object-fit: contain;
  background: #0f1c16;
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

.photo-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.photo-actions .btn {
  min-height: 38px;
}

.err {
  margin: 6px 0 0;
  color: #c62828;
  font-size: 13px;
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .tips {
    position: static;
  }
}

@media (max-width: 640px) {
  .panel,
  .tips {
    padding: 20px 16px 24px;
  }

  .photo-actions .btn {
    flex: 1;
    min-height: 42px;
  }

  .uploader {
    min-height: 180px;
  }
}
</style>
