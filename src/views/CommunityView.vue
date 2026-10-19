<template>
  <div class="community-page">
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">Community</p>
        <h2 class="page-title">植物社区</h2>
        <p class="page-sub">
          分享校园植物的观察、花期与疑问；也可以针对地图上的每一个植物分布点单独发帖讨论。
        </p>
      </div>
      <div class="stats">
        <span class="stat"><b>{{ posts.length }}</b> 条帖子</span>
        <span class="stat"><b>{{ pointPostTotal }}</b> 条点位讨论</span>
        <span class="stat"><b>{{ participants }}</b> 位参与者</span>
      </div>
    </div>

    <form class="composer card" @submit.prevent="submit">
      <div class="composer-head">
        <h3>发布新帖</h3>
        <span v-if="targetPoint" class="target point">
          发往：{{ targetPoint.speciesName }} · {{ targetPoint.location }}
        </span>
        <span v-else class="target">发往：社区广场</span>
      </div>

      <div class="row">
        <label class="f author-field">
          <span>昵称</span>
          <input
            v-model.trim="author"
            type="text"
            maxlength="20"
            placeholder="留空则显示匿名访客"
          />
        </label>

        <label class="f grow">
          <span>帖子位置</span>
          <select v-model="targetKey">
            <option value="">社区广场（不指定分布点）</option>
            <optgroup v-for="g in pointGroups" :key="g.id" :label="g.nameCn">
              <option v-for="p in g.points" :key="p.key" :value="p.key">
                {{ p.location }}
              </option>
            </optgroup>
          </select>
        </label>
      </div>

      <label class="f">
        <span>内容</span>
        <textarea
          ref="contentEl"
          v-model="content"
          rows="4"
          maxlength="500"
          placeholder="例如：这棵香樟本周开始落叶，北侧枝条上有新芽……"
          @input="message = ''"
        ></textarea>
      </label>

      <div class="f photo-field">
        <span>照片（可选，最多 {{ MAX_PHOTOS }} 张）</span>
        <div class="photo-list">
          <div v-for="(img, i) in photos" :key="i" class="photo-thumb">
            <img :src="img" alt="" />
            <button
              type="button"
              class="photo-del"
              title="移除照片"
              aria-label="移除照片"
              @click="removePhoto(i)"
            >
              ×
            </button>
          </div>
          <label
            v-if="photos.length < MAX_PHOTOS"
            class="photo-add"
            :class="{ 'is-busy': photoBusy }"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              :disabled="photoBusy"
              @change="onPhotos"
            />
            <span class="photo-add-icon" aria-hidden="true">+</span>
            <span>{{ photoBusy ? '处理中…' : '添加照片' }}</span>
          </label>
        </div>
      </div>

      <div class="composer-foot">
        <span class="muted counter">{{ content.length }} / 500</span>
        <button
          class="btn btn-primary"
          type="submit"
          :disabled="publishing || (!content.trim() && !photos.length)"
        >
          {{ publishing ? '发布中…' : '发布帖子' }}
        </button>
      </div>
      <p v-if="message" class="message" :class="messageType">{{ message }}</p>
    </form>

    <div class="feed-head">
      <div class="tabs" :class="{ 'has-focus': focus }">
        <button
          v-for="t in tabs"
          :key="t.value"
          type="button"
          class="tab"
          :class="{ active: filter === t.value }"
          @click="setFilter(t.value)"
        >
          {{ t.label }}
          <b>{{ counts[t.value] || 0 }}</b>
        </button>
      </div>

      <span v-if="focus" class="focus-note">
        正在查看：{{ focus.species.nameCn }} · {{ focus.point.location }}
        <button type="button" class="btn btn-ghost" @click="clearFocus">查看全部</button>
      </span>
    </div>

    <div v-if="feed.length" class="feed">
      <article v-for="post in feed" :key="post.id" class="post card lift">
        <div class="avatar" aria-hidden="true">{{ avatarOf(post.author) }}</div>
        <div class="post-body">
          <div class="post-head">
            <b>{{ post.author }}</b>
            <span class="muted">{{ fromNow(post.createdAt) }}</span>
            <span v-if="post.speciesId" class="post-tag point">
              分布点 · {{ post.speciesName }}
            </span>
            <span v-else class="post-tag">社区广场</span>
          </div>
          <p v-if="post.content" class="post-content">{{ post.content }}</p>
          <div v-if="post.images?.length" class="post-photos" :class="`n-${post.images.length}`">
            <button
              v-for="(img, i) in post.images"
              :key="i"
              type="button"
              class="post-photo"
              :aria-label="`查看照片 ${i + 1}`"
              @click="openPhoto(img)"
            >
              <img :src="img" :alt="`帖子照片 ${i + 1}`" loading="lazy" />
            </button>
          </div>
          <div class="post-foot">
            <span v-if="post.location" class="muted">位置：{{ post.location }}</span>
            <router-link
              v-if="post.speciesId"
              :to="`/species/${post.speciesId}`"
              class="link"
            >
              查看物种 →
            </router-link>
            <button type="button" class="del" title="删除这条帖子" @click="remove(post)">
              删除
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="card empty-state">
      <div class="empty-art" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
          <path
            d="M12 16h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H30l-10 8v-8h-8a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z"
            stroke="currentColor"
            stroke-width="2.4"
            opacity="0.45"
          />
          <path
            d="M32 24c-4 2.3-6.2 5.3-6.2 8.7a6.2 6.2 0 0 0 12.4 0c0-3.4-2.2-6.4-6.2-8.7z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M32 27.5v9M32 31c-1.7-.7-2.8-2-3.3-3.6M32 34c1.6-.7 2.9-1.9 3.5-3.4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <h4>{{ emptyCopy.title }}</h4>
      <p>{{ emptyCopy.text }}</p>
      <button
        v-if="filter !== 'points'"
        type="button"
        class="btn btn-primary"
        @click="focusComposer"
      >
        写第一条帖子
      </button>
      <router-link v-else to="/" class="btn">去地图看看</router-link>
    </div>

    <p class="hint muted">
      <template v-if="diskMode">
        帖子与照片保存在科大云盘同步目录（{{ diskDir }}），换浏览器或清缓存不会丢失；本页面为课程作业演示，无登录与审核。
      </template>
      <template v-else>
        当前未连接本地数据服务，帖子暂存在本机浏览器（localStorage），换浏览器或清缓存会丢失；用 pnpm dev 或 start-share.bat 启动即可保存到科大云盘。
      </template>
    </p>

    <Teleport to="body">
      <div v-if="lightbox" class="photo-lightbox" @click.self="lightbox = ''">
        <img :src="lightbox" alt="照片预览" />
        <button
          type="button"
          class="lightbox-close"
          aria-label="关闭预览"
          @click="lightbox = ''"
        >
          ×
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { speciesList, getSpeciesById } from '@/utils/species'
import { loadPosts, addPost, removePost, loadAuthor, saveAuthor } from '@/utils/community'
import { deletePhoto, getDiskStatus, uploadPhoto } from '@/utils/diskStore'
import { fileToResizedDataURL } from '@/utils/image'

const MAX_PHOTOS = 3
const disk = getDiskStatus()
const diskMode = disk.available
const diskDir = disk.dir

const route = useRoute()
const router = useRouter()

const posts = ref(loadPosts())
const author = ref(loadAuthor())
const content = ref('')
const message = ref('')
const messageType = ref('ok')
const filter = ref('all')
const contentEl = ref(null)
const photos = ref([])
const photoBusy = ref(false)
const publishing = ref(false)
const lightbox = ref('')
// 空字符串表示发到社区广场；"物种id:点位序号" 表示发到某个分布点
const targetKey = ref('')

/** 按物种分组的分布点选项，供发帖时选择 */
const pointGroups = computed(() =>
  speciesList
    .filter((s) => (s.points || []).length)
    .map((s) => ({
      id: s.id,
      nameCn: s.nameCn,
      points: s.points.map((p, i) => ({
        key: `${s.id}:${i}`,
        speciesId: s.id,
        index: i,
        speciesName: s.nameCn,
        location: p.location
      }))
    }))
)

const allPointOptions = computed(() => pointGroups.value.flatMap((g) => g.points))

const targetPoint = computed(
  () => allPointOptions.value.find((p) => p.key === targetKey.value) || null
)

/** 从地图或物种详情页带 query 进入时，聚焦到对应分布点 */
const focus = computed(() => {
  const speciesId = route.query.species
  const pointIndex = Number(route.query.point)
  if (!speciesId || !Number.isInteger(pointIndex)) return null
  const species = getSpeciesById(String(speciesId))
  const point = species?.points?.[pointIndex]
  if (!species || !point) return null
  return { species, pointIndex, point, key: `${species.id}:${pointIndex}` }
})

const counts = computed(() => {
  const list = posts.value
  return {
    all: list.length,
    hall: list.filter((p) => !p.speciesId).length,
    points: list.filter((p) => p.speciesId).length,
    focus: focus.value
      ? list.filter(
          (p) => p.speciesId === focus.value.species.id && p.pointIndex === focus.value.pointIndex
        ).length
      : 0
  }
})

const tabs = computed(() => {
  const list = [
    { value: 'all', label: '全部' },
    { value: 'hall', label: '社区广场' },
    { value: 'points', label: '分布点讨论' }
  ]
  if (focus.value) list.unshift({ value: 'focus', label: '当前分布点' })
  return list
})

const pointPostTotal = computed(() => counts.value.points)

const participants = computed(() => new Set(posts.value.map((p) => p.author)).size)

const feed = computed(() => {
  // 新帖排前
  const list = [...posts.value].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  )
  if (filter.value === 'hall') return list.filter((p) => !p.speciesId)
  if (filter.value === 'points') return list.filter((p) => p.speciesId)
  if (filter.value === 'focus' && focus.value) {
    return list.filter(
      (p) =>
        p.speciesId === focus.value.species.id && p.pointIndex === focus.value.pointIndex
    )
  }
  return list
})

const emptyCopy = computed(() => {
  if (filter.value === 'focus') {
    return {
      title: '这个分布点还没有讨论',
      text: '拍拍它、记下花期，成为第一个分享观察的人。'
    }
  }
  if (filter.value === 'hall') {
    return {
      title: '社区广场还很安静',
      text: '分享一次校园植物观察，或抛出一个辨认问题。'
    }
  }
  if (filter.value === 'points') {
    return {
      title: '还没有分布点讨论',
      text: '去地图上点一个植物标记，就能针对具体位置发帖。'
    }
  }
  return {
    title: '社区还没有帖子',
    text: '从一条观察开始，让这里的植物被更多人看见。'
  }
})

function focusComposer() {
  contentEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  nextTick(() => contentEl.value?.focus())
}

watch(
  focus,
  (f) => {
    if (f) {
      filter.value = 'focus'
      targetKey.value = f.key
    } else if (filter.value === 'focus') {
      filter.value = 'all'
    }
  },
  { immediate: true }
)

function setFilter(value) {
  filter.value = value
  if (value !== 'focus' && focus.value) router.replace('/community')
}

function clearFocus() {
  setFilter('all')
}

function notify(text, type = 'ok') {
  message.value = text
  messageType.value = type
}

/** 选择照片：压缩后转成 base64，随帖子一起保存到云盘数据文件 */
async function onPhotos(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return

  const room = MAX_PHOTOS - photos.value.length
  const picked = files.slice(0, room)
  photoBusy.value = true
  let failed = 0
  for (const file of picked) {
    try {
      photos.value.push(
        await fileToResizedDataURL(file, { maxWidth: 1080, quality: 0.72 })
      )
    } catch (err) {
      failed += 1
    }
  }
  photoBusy.value = false

  if (files.length > picked.length) {
    notify(`最多上传 ${MAX_PHOTOS} 张照片`, 'err')
  } else if (failed) {
    notify(`${failed} 张照片处理失败，请换一张试试`, 'err')
  } else {
    message.value = ''
  }
}

function removePhoto(index) {
  photos.value.splice(index, 1)
}

function openPhoto(url) {
  lightbox.value = url
}

function onKeydown(e) {
  if (e.key === 'Escape') lightbox.value = ''
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

async function submit() {
  if (publishing.value) return
  const text = content.value.trim()
  if (!text && !photos.value.length) return

  publishing.value = true
  try {
    const point = targetPoint.value
    saveAuthor(author.value)
    // 照片先写入云盘独立文件，JSON 中只保存图片地址
    const images = await Promise.all(photos.value.map((p) => uploadPhoto(p)))
    const record = addPost({
      author: author.value,
      content: text,
      images,
      speciesId: point?.speciesId || null,
      pointIndex: point ? point.index : null,
      speciesName: point?.speciesName || null,
      location: point?.location || null
    })

    if (!record) {
      for (const url of images) deletePhoto(url)
      notify('保存失败：本机存储空间不足，请删除旧帖或减少照片后重试', 'err')
      return
    }

    posts.value = loadPosts()
    content.value = ''
    photos.value = []
    notify(
      point
        ? `已发布到「${point.speciesName} · ${point.location}」`
        : '已发布到社区广场'
    )

    if (point) {
      filter.value =
        focus.value && focus.value.key === point.key ? 'focus' : 'points'
    } else {
      filter.value = 'hall'
    }
  } finally {
    publishing.value = false
  }
}

function remove(post) {
  if (!window.confirm('确定删除这条帖子吗？')) return
  removePost(post.id)
  posts.value = loadPosts()
}

function avatarOf(name) {
  return (name || '匿').slice(0, 1)
}

function fromNow(iso) {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const minutes = Math.floor((Date.now() - time) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(time).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.composer {
  padding: 24px 26px;
  margin-bottom: 24px;
}

.composer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.composer-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink-strong);
  font-size: 17px;
  font-weight: 700;
}

.composer-head h3::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-500);
  box-shadow: 0 0 0 4px var(--green-050);
}

.target {
  padding: 4px 11px;
  border: 1px solid var(--green-200);
  border-radius: 999px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 12.5px;
  font-weight: 600;
}

.target.point {
  border-color: #f0dfbe;
  background: var(--amber-050);
  color: var(--amber);
}

.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.row .f {
  margin-bottom: 12px;
}

.f {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  margin-bottom: 12px;
}

.f > span {
  color: var(--ink-soft);
  font-weight: 600;
}

.f input,
.f select,
.f textarea {
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: #fff;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.f textarea {
  min-height: 112px;
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.75;
  font-size: 14px;
}

.f input:focus,
.f select:focus,
.f textarea:focus {
  border-color: var(--green-500);
  box-shadow: var(--ring);
}

.f input::placeholder,
.f textarea::placeholder {
  color: #9aa9a0;
}

.author-field {
  flex: 0 0 200px;
}

.f.grow {
  flex: 1;
  min-width: 240px;
}

.photo-field {
  margin-bottom: 16px;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.photo-thumb {
  position: relative;
  width: 92px;
  height: 92px;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--green-050);
}

.photo-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(20, 40, 30, 0.62);
  color: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.photo-del:hover {
  background: rgba(180, 45, 35, 0.86);
}

.photo-add {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 92px;
  height: 92px;
  border: 1.5px dashed var(--green-300);
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbf6, var(--green-050));
  color: var(--green-700);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.photo-add:hover {
  border-color: var(--green-500);
  background: var(--green-050);
}

.photo-add:has(input:disabled) {
  cursor: progress;
  opacity: 0.65;
}

.photo-add input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.photo-add input[type='file']:disabled {
  cursor: progress;
}

.photo-add-icon {
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}

.counter {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.message {
  display: inline-flex;
  margin: 12px 0 0;
  padding: 7px 12px;
  border-radius: 9px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 13px;
}

.message.err {
  background: var(--danger-050);
  color: var(--danger);
}

.feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.tabs {
  position: relative;
  display: inline-flex;
  gap: 2px;
  max-width: 100%;
  padding: 5px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 999px;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.56));
  box-shadow: 0 14px 34px -26px rgba(18, 69, 50, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  overflow: hidden;
}

.tabs::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(60% 120% at 20% 0%, rgba(255, 255, 255, 0.5), transparent 62%);
  pointer-events: none;
}

.tab {
  position: relative;
  z-index: 1;
  padding: 7px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.16s ease, background 0.16s ease;
}

.tab b {
  margin-left: 5px;
  color: var(--green-600);
  font-weight: 700;
}

.tab:hover {
  background: var(--green-050);
  color: var(--green-700);
}

.tab.active {
  background: var(--green-700);
  color: #fff;
  box-shadow: 0 6px 14px -9px rgba(18, 69, 50, 0.9);
}

.tab.active b {
  color: #d7f0d9;
}

.focus-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.focus-note .btn {
  padding: 4px 8px;
  font-size: 12.5px;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.post {
  display: flex;
  gap: 16px;
  padding: 18px 20px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.post:hover {
  border-color: var(--green-300);
  box-shadow: var(--shadow-hover);
}

.avatar {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--green-100), var(--green-200));
  color: var(--green-900);
  font-weight: 750;
  font-size: 16px;
}

.post-body {
  flex: 1;
  min-width: 0;
}

.post-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.post-tag {
  padding: 3px 9px;
  border: 1px solid var(--green-200);
  border-radius: 999px;
  background: var(--green-050);
  color: var(--green-700);
  font-size: 11.5px;
}

.post-tag.point {
  border-color: #f0dfbe;
  background: var(--amber-050);
  color: var(--amber);
}

.post-content {
  margin: 9px 0;
  font-size: 14.5px;
  line-height: 1.8;
  color: #33463c;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-photos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 170px));
  gap: 8px;
  margin: 10px 0 12px;
}

.post-photos.n-1 {
  grid-template-columns: minmax(0, 240px);
}

.post-photos.n-2 {
  grid-template-columns: repeat(2, minmax(0, 190px));
}

.post-photo {
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 11px;
  overflow: hidden;
  background: var(--green-050);
  cursor: zoom-in;
  transition: border-color 0.16s ease, transform 0.16s ease;
}

.post-photo:hover {
  border-color: var(--green-300);
  transform: translateY(-1px);
}

.post-photo img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.post-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12.5px;
}

.link {
  color: var(--green-700);
  font-weight: 600;
}

.del {
  margin-left: auto;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12.5px;
}

.del:hover {
  background: var(--danger-050);
  color: var(--danger);
}

.hint {
  margin: 20px 2px 0;
  font-size: 12.5px;
}

.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  background: rgba(12, 24, 18, 0.78);
  backdrop-filter: blur(4px);
}

.photo-lightbox img {
  max-width: min(92vw, 1100px);
  max-height: 86vh;
  border-radius: 14px;
  box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.75);
  object-fit: contain;
}

.lightbox-close {
  position: absolute;
  top: 22px;
  right: 26px;
  width: 42px;
  height: 42px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.26);
}

@media (max-width: 700px) {
  .author-field {
    flex: 1 1 100%;
  }
  .f.grow {
    min-width: 100%;
  }
  .post {
    padding: 14px;
  }
  .tabs {
    width: 100%;
    flex-wrap: wrap;
    border-radius: 15px;
  }
  .tabs.has-focus {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tab {
    flex: 1 1 auto;
    padding: 7px 10px;
    font-size: 12.5px;
    text-align: center;
  }
}
</style>
