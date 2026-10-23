# 项目交接文档 · 中科大本部植被分布平台

> **用途**：把本项目的全部上下文压缩成一份可被新对话直接读取的文档。
> **新对话开场白（直接复制）**：
> `请先读 E:\ustc-vegetation-map\PROJECT-CONTEXT.md，然后按里面的现状继续协助我。`

---

## 1. 项目一句话与硬约束

**中科大本部植被分布可视化平台** —— 面向校园植被科普的**网页**（Vue 前端 + 本地 Node 数据服务，无外部数据库）。
物种库 **229 种**（已记录 20 / 待核实 209），详情页采用**图鉴体例**：别名 / 识别特征 / 学名来源 / 分布位置。

**参考书目**：《中国科学技术大学校园植物图鉴》（钱栎屾、邱燕宁 著，指导：沈显生，中国科学技术大学出版社）——
物种库规模与「识别特征 / 学名来源」字段体例参照该书；**项目未使用书内原文**，除已记录 20 种外的数据为公开资料整理的候选清单。

**硬约束（来自需求方，务必遵守）**：

| 约束 | 内容 |
|---|---|
| 性质 | **课堂作业，不公开使用** |
| 范围 | 地图**仅限科大中区** |
| 简化原则 | 不做外部后端 / 数据库 / 备案 / 登录 / 合规；本地 Node 数据服务只负责云盘 JSON 与照片读写；天地图为**可选** Key（不配置时自动用高德） |
| 交付 | 可本地运行的网页 + 示例数据 + 使用指南 |
| 位置 | 所有文件放在 **E 盘**：`E:\ustc-vegetation-map` |

---

## 2. 技术栈与依赖

```json
"dependencies": {
  "leaflet": "^1.9.4",
  "leaflet.markercluster": "^1.5.3",
  "onnxruntime-web": "1.22.0",
  "vue": "^3.5.13",
  "vue-router": "^4.5.0",
  "xlsx": "^0.18.5"
},
"devDependencies": {
  "@vitejs/plugin-vue": "^5.2.1",
  "vite": "^5.4.11"
}
```

- 包管理器：**pnpm**
- 路由模式：**hash**（`createWebHashHistory`）→ 免服务器配置，静态托管即用
- 别名 `@` → `src/`

---

## 3. 目录结构与文件职责

```
E:\ustc-vegetation-map\
├─ start-share.bat              一键共享脚本（构建 + 选端口 + 打印 IPv6 地址 + 随机访问口令 + 起服务）
├─ backup-data.bat              备份云盘数据目录到 backups/
├─ reset-demo.bat               重置演示数据（先自动备份）
├─ server.mjs                   构建版静态服务 + 数据接口 + 可选 HTTP Basic 口令
├─ server/store.js              云盘 JSON 按条读写（Vite 中间件与 server.mjs 共用）
├─ scripts/validate-data.mjs    物种数据校验
├─ scripts/merge-exports.mjs    合并多人导出的投稿 JSON
├─ scripts/copy-ort.mjs         构建/开发前复制 onnxruntime-web 的 wasm 运行时到 public/ort（该目录已 gitignore）
├─ public/models/plant/         本地识别模型 inat21-resnet50-int8.onnx（约 43 MB）+ inat21-plants.json（4271 个植物类别）
├─ tests/                       Vitest 单元测试（coord / table / species）
├─ vitest.config.js
├─ README.md                    面向使用者的使用指南
├─ PROJECT-CONTEXT.md           本文档（面向 AI 的交接说明）
├─ index.html
├─ vite.config.js
├─ package.json
├─ .gitignore
├─ public/                      静态资源（自备高清底图已移除）
├─ dist/                        构建产物
└─ src/
   ├─ main.js / App.vue / style.css        入口与全局样式（含 CSS 变量主题色）
   ├─ router/index.js                      6 条路由 + 兜底重定向 + 动态标题
   ├─ components/
   │  ├─ AppHeader.vue                     顶部导航（高亮当前路由）
   │  ├─ SearchSuggest.vue                 搜索联想
   │  ├─ AreaPicker.vue                    投稿页选点 / 地块框选小地图
   │  ├─ PlotPanel.vue                     框选结果与地块管理面板
   │  ├─ PhotoIdentify.vue                  照片本地识别按钮与候选列表（投稿页 / 识树页共用）
   │  └─ SpeciesCard.vue                   物种卡片（待核实 / 示例坐标徽章）
   ├─ views/
   │  ├─ MapView.vue                       分布地图（主页面）
   │  ├─ SpeciesListView.vue               物种库（229 种 + 5 个筛选器）
   │  ├─ SpeciesDetailView.vue             物种详情（含数据分级提示 / 迷你地图）
   │  ├─ IdentifyView.vue                  拍照识树（选图 → 本地识别 → 带入投稿）
   │  ├─ UploadView.vue                    上传投稿（照片 + 可选本地识别 + 选点 + 导出/导入 JSON）
   │  ├─ BatchImportView.vue               批量导入（CSV / Excel + 批量照片）
   │  └─ AboutView.vue                     关于与使用说明
   ├─ data/species.json                    ★ 全站数据源
   └─ utils/
      ├─ species.js                        数据访问 + 类别/状态/花期/数据分级
      ├─ coord.js                          GCJ-02 ↔ WGS-84 坐标转换（天地图用）
      ├─ plots.js                          框选几何/分析、地块智能推荐、plots.json 存储与导入合并
      ├─ storage.js                        投稿读写（按条调用数据服务）
      ├─ community.js                      社区帖子读写
      ├─ diskStore.js                      数据服务客户端 / 缓存 / 历史数据迁移
      ├─ identify.js                       识别候选 → 物种库匹配、置信度分级（纯函数，已覆盖单测）
      ├─ recognition.js                    ONNX Runtime Web 加载、IndexedDB 模型缓存、图片预处理与推理
      ├─ image.js                          图片压缩 + 占位图 URL
      └─ table.js                          表格解析（CSV / xlsx）+ 模板下载
```

---

## 4. 数据结构

### 4.1 `src/data/species.json`

```jsonc
{
  "meta": {
    "campus": "中国科学技术大学中校区（合肥市蜀山区黄山路 373 号）",
    "center": { "lat": 31.839, "lng": 117.2623 },
    "zoom": 17, "minZoom": 17, "maxZoom": 18,
    "bounds": { "south": 31.8358, "west": 117.2582, "north": 31.8422, "east": 117.2664 },
    "note": "…说明 status 语义…",
    "updatedAt": "2025-01-01"
  },
  "species": [
    {
      "id": "sp001",
      "nameCn": "香樟",
      "nameLatin": "Cinnamomum camphora",
      "family": "樟科",
      "genus": "樟属",
      "habit": "常绿乔木",
      "tags": ["行道树", "常绿", "芳香"],
      "bloomMonths": [4, 5],
      "bloomText": "4–5 月",
      "fruitText": "8–11 月",
      "status": "已记录",                    // "已记录" | "待核实"
      "description": "…一句话描述…",
      "alias": ["樟树", "乌樟"],              // 可选：别名数组（检索/展示）
      "identify": "…识别特征（叶/花/果/树皮要点）…",   // 可选，图鉴体例
      "nameOrigin": "…学名来源 / 命名释义…",           // 可选，图鉴体例
      "points": [                            // 待核实物种此数组为空
        { "lat": 31.8418, "lng": 117.2624, "location": "中区北门主干道" }
      ]
    }
  ]
}
```

### 4.2 用户数据存储（科大云盘 JSON + 独立照片文件）

- **云盘文件**：`E:\科大云盘\云盘文件\科大植物地图\植物地图数据.json`
  - 由 `server/store.js` 读写；目录可用环境变量 `VEG_DATA_DIR` 覆盖
  - 结构：`{ "ustc-veg-community-posts": [...], "ustc-veg-community-author": "昵称", "ustc-veg-submissions": [...] }`
- **照片文件**：`E:\科大云盘\云盘文件\科大植物地图\图片\photo-<时间戳>-<随机>.<jpg|png|webp>`
  - `POST /api/images`（body `{ dataUrl }`）保存照片并返回 `/api/images/<文件名>`
  - `GET /api/images/<文件名>` 读取、`DELETE /api/images/<文件名>` 删除
  - 帖子 `images[]` 与投稿 `image` 字段只保存 URL；删除帖子/投稿/清空投稿时服务端同步删除照片文件
  - 未启动本地服务或上传失败时回退为 base64 data URL，功能不中断
- **按条读写（已替换整表覆盖）**
  - `GET /api/store`：初始化读取全部数据
  - `POST /api/posts`、`POST /api/posts/batch`、`DELETE /api/posts/:id`
  - `POST /api/submissions`、`POST /api/submissions/batch`、`DELETE /api/submissions/:id`、`DELETE /api/submissions`
  - `PUT /api/author`
  - 所有写入在进程内串行化（先读最新文件再追加），多人同时发帖不会互相覆盖
  - JSON 解析失败时拒绝写入，避免把损坏文件覆盖成空数据
- **读取路径**
  - 启动时 `src/utils/diskStore.js` 先 `GET /api/store` 读取云盘文件，写入 localStorage 作为缓存；云盘缺失的键会把浏览器旧数据批量迁移上去
  - 每次发帖/删帖/投稿/改昵称：调用对应按条接口，成功后用服务端返回的列表刷新缓存
  - 未启动本地服务（如直接打开 `dist/index.html` 或 GitHub Pages）时自动回退纯 localStorage
- **访问口令**
  - `server.mjs` 读取 `VEG_ACCESS_TOKEN`，设置后整站启用 HTTP Basic（用户名任意、密码为口令）
  - `start-share.bat` 默认生成随机口令并打印；`pnpm dev` 不启用口令
- **key**：`ustc-veg-submissions`、`ustc-veg-community-posts`、`ustc-veg-community-author`
- 由 `src/utils/storage.js` / `src/utils/community.js` 提供读写函数
- **投稿记录字段**：`id / createdAt / speciesId / name / lat / lng / polygon / areaSize / note / collector / image`
  - `polygon` 为 `[[lng, lat], ...]`（GCJ-02）；点状投稿为空数组，块状投稿的 `lat/lng` 为地块中心
  - 地图页把块状投稿绘制为**橙色虚线面 + 名称标签**，点状投稿仍是橙色圆点；服务端 `server/store.js` 同步校验并保留这些字段
  - 投稿页支持「单点位置 / 地块范围」切换，地块可用矩形拖拽或多边形逐点描绘，并支持拖动顶点微调

### 4.3 批量导入表格格式

**列顺序（无表头时）**：`物种, 纬度, 经度, 备注, 照片文件名, 采集人`

- 有表头时自动识别别名（见 `table.js` 的 `ALIASES`）
- 支持 **TAB**（从 Excel/WPS 直接粘贴）或 **逗号** 分隔
- CSV 读取自动兼容 **UTF-8 / GBK**；模板带 BOM

---

## 5. 路由与页面功能

| 路由 | 名称 | 功能要点 |
|---|---|---|
| `/` | 分布地图 | marker、**科/花期/关键词**筛选、**3 个底图**（天地图影像 / 天地图矢量 / 高德标准；无 Key 时仅高德标准）、18 级起显示物种名称、地图限制 18 级、勾选显示"我的投稿"（橙色）、统计「N 个分布点 / M 个已定位物种」；切换底图自动换算 GCJ-02 ↔ WGS-84；**手动框选**（矩形 / 多边形）统计范围内物种并保存为地块 |
| `/#/species` | 物种库 | 229 种（已记录 20 / 待核实 209）；**搜索（中文名/学名/别名/识别特征）+ 科 + 花期 + 类别 + 状态** 5 个筛选；已记录排前；待核实卡片右上角橙色徽章 |
| `/#/community` | 植物社区 | 社区广场 / 分布点讨论；发帖支持最多 3 张照片与纯图片帖；大图预览（Esc 关闭）；数据写入科大云盘 |
| `/#/species/:id` | 物种详情 | 科/属/习性/花期/果期/标签/描述 + **别名 / 识别特征 / 学名来源（图鉴分区）** + 分布点列表 + 迷你地图；**无点位时显示"尚未在校园内定位"提示**；底部标注参考书目 |
| `/#/identify` | 拍照识树 | 拍照 / 选图 → 本地 ONNX 模型识别（Top-5 候选 + 置信度）→ 可带照片与物种跳到投稿页；模型首次下载约 43 MB，存 IndexedDB，之后离线可用 |
| `/#/upload` | 上传投稿 | 选照片（自动压到宽 ≤900px JPEG，可选本地识别回填物种）→ 选物种 → **地图点选位置或框选地块范围** → 保存；右侧"我的投稿"；导出/导入 JSON |
| `/#/batch` | 批量导入 | ①粘贴表格/上传 CSV（可下载模板）②批量选照片（按文件名匹配）③预览状态（可导入/有误/未匹配）→ 一键导入 |
| `/#/about` | 关于 | 项目说明与使用指南 |
| 其他 | — | 重定向到 `/` |

---

## 6. 关键实现细节与坑（重要）

1. **存储坐标必须是 GCJ-02**
   高德/腾讯底图是 GCJ-02，与 WGS-84 在合肥相差 **约 565 m**（实测：东 519 m、北 −224 m）。
   天地图为 WGS-84（CGCS2000），不能直接把 GCJ-02 点位叠上去；`MapView.vue` 按当前底图用 `coord.js` 做**显示层换算**，数据本身不回写。

2. **自备高清底图已移除**
   原 `public/overlay/campus.jpg` 与 `meta.overlay` 已按需求删除；地图不再叠加自备卫星图，19/20 级也不再提供额外细节。

3. **`status` 语义**：`已记录`（有 `points`，显示在地图）/ `待核实`（候选清单，不显示）。
   把待核实转已记录 = 改 `status` + 填 `points`。

4. **地图只显示有分布点的物种**；地图页统计用「已定位物种」而非物种库总数，避免 120 vs 20 的误导。

5. **类别由 `habit` 推导**（`species.js` 的 `CATEGORY_RULES`，顺序敏感）：
   `水生 → 竹类 → 蕨类 → 藤本 → 灌木 → 乔木 → 草本`
   例如"落叶灌木或小乔木"归为**灌木**。

6. **照片保存为云盘 `图片/` 下的独立文件**，帖子/投稿 JSON 只存图片 URL → JSON 体积小、页面按需加载照片；删除条目时同步删照片。未启动本地服务时回退为 base64 内嵌。

7. **`bloomMonths: [0]`** 表示"不开花/罕见开花"（如竹类、蕨类），花期筛选不会命中。

8. **底图与缩放策略（重要）**
   - 天地图与高德瓦片**原生最高均为 18 级**；实测天地图 19/20 级返回 4.7 KB 空白占位图，因此 `meta.maxZoom` 与所有瓦片层统一设为 **18**，不再请求 19/20 级。
   - 只保留 **3 个底图**：`天地图影像（含影像注记）`（img + cia，**默认**）、`天地图矢量（含矢量注记）`（vec + cva）、`高德标准地图`（`webrd style=8`，无 Key 时默认）。WMTS URL 见 `MapView.vue` 的 `tdtTile()`。
   - **坐标系双模式**：数据仍以 GCJ-02 保存；底图为天地图时，`coordMode='wgs84'`，点位与 `maxBounds` 经 `coord.js` 的 `gcj02ToWgs84()` 换算。合肥偏移约 565 m，切换底图时由 `baselayerchange` 事件触发 `applyCoordMode()`，不改数据。
   - **18 级起**显示物种名称：marker 绑定 `permanent` tooltip（class `marker-label`），由地图容器上的 `.show-labels` 控制显隐。
   - **文字清晰度**：瓦片层加 CSS `image-rendering: -webkit-optimize-contrast`，并限制在原生 18 级，避免拉伸导致的注记发虚。

---

## 7. 环境与常用命令

**本机环境（已确认）**：Node v24.20.0 / npm 11.19.0 / pnpm 12.11.2 / Python 3.13.14 / Git / VS Code / WSL

```powershell
cd E:\ustc-vegetation-map
pnpm dev                 # 开发预览 → http://localhost:5173/
pnpm run build           # 构建 → dist/
pnpm run preview         # 预览构建产物
pnpm run validate:data   # 校验物种数据（id、越界坐标、重复点等）
pnpm test                # Vitest 单元测试
```

> 新终端若提示找不到 `pnpm`，需**重启一次 IDE** 让 PATH 生效。

---

## 8. 共享给队友（IPv6）

- **一键脚本**：双击 `start-share.bat` → 自动 ①构建 ②选端口（8080 起，占用则顺延至 8090）③打印 IPv6 地址 ④生成并打印随机访问口令 ⑤启动服务
- **手动命令**：
  ```powershell
  node E:\ustc-vegetation-map\server.mjs 8080
  ```
  需要口令时先 `set VEG_ACCESS_TOKEN=你的口令`；不设则关闭口令。
- **访问地址**：`http://[IPv6地址]:8080/`（**方括号不可省**）
- **访问口令**：`start-share.bat` 默认开启，浏览器弹窗用户名任意、密码填窗口打印的口令
- **防火墙**：已按「程序 `node.exe` / `python3.13.exe` + **公用(Public)** 网络」放行（若改用 node 服务仍未放行，需补一次 node.exe）
- 注意：队友需有 IPv6；IPv6 地址会变化（以脚本每次打印的为准）；关闭窗口即停止

---

## 9. 已完成的工作

1. 需求澄清与方案设计（含小程序 vs Web 对比，最终选 **Web 简化版**）
2. 安装开发环境（Node / pnpm，桌面快捷方式）
3. 初始化 Vue3 + Vite 工程并接入 Git
4. 实现 6 个页面：地图 / 物种库 / 详情 / 上传投稿 / 批量导入 / 关于
5. 地图限定中区 + 精度提升（zoom 17、maxZoom 18、范围锁定）
6. 曾接入自备高清卫星底图叠加层；后按需求移除（`public/overlay` 与 `meta.overlay` 均已删除）
7. 物种库从 20 种扩展到 **120 种**（20 已记录 + 100 待核实）
8. 新增「类别 / 状态」筛选与「待核实」徽章、无点位提示
9. 实现**批量导入**（表格解析 + 照片匹配 + 预览校验）
10. 编写 `README.md`、`start-share.bat`（含防火墙放行与 IPv6 共享）
11. **图鉴化改造**：物种库扩容至 **229 种**（对齐《中国科学技术大学校园植物图鉴》）；数据模型新增 `alias / identify / nameOrigin` 字段并为 20 种已记录物种补全；详情页新增「识别特征 / 学名来源」分区；列表页/地图页统一检索（`species.js` 的 `searchText`，支持按别名与识别特征搜索）；卡片展示别名；`meta.reference` 与「使用说明」页标注参考书目
12. **地图底图收敛**：最终只保留 3 个底图（天地图影像 / 天地图矢量 / 高德标准），默认天地图影像；移除自备高清叠加层、高德卫星/浅色、OSM、天地图地形；`maxZoom` 设为 **18**，避免 19/20 级拉伸
13. **天地图接入**：新增 `src/utils/coord.js`（GCJ-02 ↔ WGS-84）；`MapView.vue` 支持天地图影像/矢量两套官方 WMTS 图层（各带注记），通过 `.env.local` 的 `VITE_TIANDITU_TK` 启用；切换底图时自动换算点位与视野范围；实测 19/20 级为空白占位图，故限制 18 级；已浏览器验证瓦片、图层切换、42 个点位与 18 级标签均正常
14. **植物社区 + 数据落盘**：新增社区页（广场发帖、分布点讨论、最多 3 张照片、大图预览）；社区帖子、昵称与投稿统一保存到科大云盘同步文件 `植物地图数据.json`（`server/store.js`），照片保存为同目录 `图片/` 下的独立文件（`/api/images`），启动读取、变更即写入，`localStorage` 仅作缓存；`pnpm dev`（Vite 中间件）与 `start-share.bat`（`server.mjs`）均已接入
15. **存储并发改造**：`/api/store` 的整表 PUT 已停用，改为按条接口（posts / submissions / author），服务端串行读-改-写；JSON 损坏时拒绝写入；删除记录时同步删除照片
16. **共享安全**：`server.mjs` 支持 `VEG_ACCESS_TOKEN` 整站 HTTP Basic；`start-share.bat` 默认生成随机口令并打印
17. **数据可信度分级**：`species.js` 新增 `dataLevelOf / pointAccuracyText`；卡片、详情页、地图弹窗标注「示例坐标 / 实地调查 / 公开资料整理」；`meta.dataNotice` 同步到使用说明页
18. **演示与交付增强**：`backup-data.bat` / `reset-demo.bat`；批量导入支持 `.xlsx`；`scripts/merge-exports.mjs` 合并去重；Vitest 覆盖坐标、表格、物种筛选与数据分级；新增 `scripts/validate-data.mjs`
19. **手动框选地块**：地图页新增矩形拖拽 / 多边形逐点描绘两种手动框选；拖动时实时显示面积与物种数，结束后可拖动顶点微调；结果面板按范围统计物种（筛选命中优先）、支持边界外 25 m「一键纳入」、按面积/狭长程度/乔木占比智能推荐名称与用地类型；地块以 `plots.json` 兼容结构保存在 `localStorage`，支持保存/更新/删除/导入合并/导出；宽屏时面板与地图并排，窄屏时位于地图下方，避免遮挡选区手柄
20. **投稿支持块状分布**：上传投稿页新增「单点位置 / 地块范围」切换，地块模式复用迷你地图做矩形/多边形框选并支持顶点微调；投稿记录新增 `polygon`（`[[lng,lat],...]`，GCJ-02）与 `areaSize`，`lat/lng` 存地块中心；分布地图把块状投稿绘制为橙色虚线面 + 名称标签，点击查看面积与照片；`storage.js` 与 `server/store.js` 均保留/校验地块字段，导出导入 JSON 兼容
21. **移动端适配**：≤640px 顶栏导航改 4 列网格、全局输入字号 16px（避免 iOS 聚焦放大）、页面边距与标题缩放；地图筛选工具栏改 2 列网格、地图高度 58vh、框选完成后自动滚动到结果面板、文字按钮与边界圆点扩大触控热区；投稿页模式切换满宽、迷你地图高度用 `clamp()` 自适应；物种库/季节专题窄屏改为逐行 2 列网格，避免瀑布流「先滚完一列」；社区/批量导入/物种详情复核无横向溢出
22. **触摸框选修复**：矩形框选改为 `pointerdown` 在容器捕获 + `pointermove/up/cancel` 拖拽期间挂到 `window`（避免手指移出地图/指针捕获失败导致中断）；按 `pointerId`/`isPrimary` 过滤多指，第二根手指不会覆盖起点；绘制时 `touch-action:none`、禁用 `touchZoom`、屏蔽长按菜单；`pointerup` 以抬起点重算矩形，快速滑动不会停在最后一次 move；高频 move 用 rAF 合并；系统 `pointercancel` 时放弃本次框选；无 PointerEvent 的极旧浏览器自动退化为多边形点击
23. **拍照识别**：新增「拍照识树」页（`/#/identify`）并在投稿页嵌入识别入口；使用 iNaturalist 2021 微调的 ResNet50（int8 ONNX，43 MB）在浏览器内推理，`scripts/copy-ort.mjs` 负责复制 onnxruntime-web 的 wasm；模型按需下载并存 IndexedDB，图片不上传；`identify.js` 把模型类别按拉丁名/属名异名映射回 229 种物种库，Top-5 候选可一键回填物种或带图跳转投稿。实测 229 种中 73 种可对上中文名，香樟 93%、广玉兰 68% 可正确识别，紫薇/棕榈等同科近缘种会混淆

---

## 10. 已知限制与待办

| # | 限制 / 待办 | 说明 |
|---|---|---|
| 1 | **数据非实地调查** | 209 种是候选清单；20 种的 42 个点坐标是**近似示例值**，页面已以「示例坐标」徽章标注 |
| 2 | **底图最高 18 级** | 天地图/高德原生最高 18；19/20 级为空白或拉伸，已限制 `maxZoom=18` |
| 3 | 移动端已做基础适配 | 顶栏 4 列导航、筛选工具栏 2 列、地图 58vh、框选结果自动滚动、物种/季节卡片逐行网格、触控热区放大；未做原生 App 级手势与离线优化 |
| 4 | 合并脚本需手动执行 | `pnpm run merge:exports a.json b.json`，未做界面入口 |
| 5 | 公网静态托管没有数据服务 | GitHub Pages 无 `/api`，社区/投稿回退各浏览器 localStorage；完整演示用 `start-share.bat` |
| 6 | 无登录与后台审核 | 当前为匿名发帖 + 单一口令保护；正式系统需另加账号、角色与审核流 |
| 7 | 天地图需自行申请 Key | 无 Key 时仅高德标准底图；Key 需实名、有每日配额，且不要提交到 Git |
| 8 | 天地图影像无更高层级 | 实测 19/20 级返回 4.7 KB 空白占位图；更高精度需自备高清图或付费服务 |
| 9 | **本地识别模型能力有限** | iNat21 ResNet50 int8 仅 4271 种植物，229 种物种库中 73 种能对上中文名（银杏/桂花/水杉/棕榈等不在类别内）；同科近缘种易混淆（紫薇→夹竹桃、棕榈→箬棕），高置信度也会错。首次使用需下载 43 MB 模型，Git 仓库中已提交该文件 |
| 10 | 识别为主线程推理 | 单张 0.3–2 秒，期间页面短暂无响应；未做 Web Worker / WebGPU 加速 |

**分工经验**：4 人实地调查 →群里发照片+物种+位置（统一格式）→ 1 人用「批量导入」统一录入，效率最高。位置建议发**地标描述**（录入人在图上点选）或**经纬度文本**；微信发图会丢 EXIF，位置必须单独给。

---

## 11. 决策记录（为什么这么做）

| 决策 | 原因 |
|---|---|
| 选 Web 而非小程序 | 课堂作业、不公开；Web 免账号/审核/开发者工具，开发更快；地图是 Web 强项 |
| 纯前端、无外部后端 | 不公开 → 免备案/服务器/数据库；数据用静态 JSON + 本地 Node 数据服务（云盘 JSON） |
| 数据按条写入而非整表覆盖 | 多人同时操作时整表 PUT 会互相覆盖；改为服务端串行读-改-写 |
| 共享服务默认开启访问口令 | IPv6 公网可直连，无鉴权的写接口可被随意覆盖；Basic 口令用于挡住误操作与随手扫描 |
| 数据分三级（实地调查/示例坐标/公开资料整理） | 209 种候选清单与 42 个近似坐标必须与实测数据区分，避免被误认为调查成果 |
| 用 Leaflet + 天地图/高德底图 | 天地图为官方底图；无 Key 时自动回退高德，课程演示可直接运行 |
| 天地图做成可选接入 | 官方底图更权威，但需 Key 与实名；用 `VITE_TIANDITU_TK` 启用，无 Key 自动降级，不破坏「开箱即用」 |
| 切换底图时动态换算坐标 | 数据统一存 GCJ-02，避免迁移 42 个点位；显示层按底图转换为 WGS-84，切回即还原 |
| 路由用 hash | 静态托管免配置 |
| 底图限制在原生 18 级 | 19/20 级无新细节且会让文字发虚；限制 `maxZoom` 比叠加自备图更简单 |
| 只保留 3 个底图 | 减少选择干扰，聚焦天地图影像/矢量与高德标准 |
| 物种分「已记录/待核实」 | 无法凭空枚举"校园里一切植物"，用状态字段诚实区分候选与实测 |
| 采用图鉴体例（识别特征/学名来源） | 参考《中国科学技术大学校园植物图鉴》，让物种详情更有科普信息量；因无书内原文，数据由公开资料整理并明确标注 |
