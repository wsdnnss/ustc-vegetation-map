<template>
  <div>
    <div class="page-head">
      <div class="page-head-main">
        <p class="eyebrow">About</p>
        <h2 class="page-title">关于与使用说明</h2>
        <p class="page-sub">本项目为课程作业演示，用于展示校园植被分布的可视化与数据采集流程。</p>
      </div>
    </div>

    <div class="cards">
      <section class="card box lift">
        <h3>项目简介</h3>
        <p>
          “中科大本部植被分布”是一个校园植物科普与分布可视化网页，围绕
          <b>分布地图 / 物种库 / 季节专题 / 上传投稿</b> 等功能展开。物种数据以 JSON
          静态文件维护；用户投稿与社区帖子保存在本机数据服务（科大云盘同步文件），
          未启动服务时回退浏览器本地存储。
        </p>
        <ul>
          <li>分布地图：按科、花期筛选，相近点位自动聚合；同一位置的多种植物合并为一个数字点，点击后在地图底部展开该位置全部物种</li>
          <li>物种库：搜索联想（中文名 / 别名 / 学名 / 科）、科与花期筛选、详情页</li>
          <li>季节专题：按月查看「观花 / 观果」清单，一键跳回地图看当月分布</li>
          <li>物种详情：<b>识别特征、学名来源</b>、分布位置（图鉴体例）</li>
          <li>拍照识树：拍照或选图后<b>在浏览器本地识别</b>，给出候选物种与置信度，可一键带入投稿</li>
          <li>上传投稿：上传照片（可选本地识别）、地图选点、导出/导入数据</li>
        </ul>
      </section>

      <section class="card box lift">
        <h3>参考书目与数据来源</h3>
        <p>
          物种库规模（229 种）与「识别特征 / 学名来源」字段体例，参考
          <b>《中国科学技术大学校园植物图鉴》</b>（钱栎屾、邱燕宁 著，沈显生 指导，
          中国科学技术大学出版社）——该书收录校园常见且有鉴赏价值的植物 229 种。
        </p>
        <ul>
          <li>本书为正式出版图鉴；本项目<b>未使用书内原文</b>，物种数据由公开资料整理，不代表该书内容。</li>
          <li>「已记录」20 种含近似分布点位；其余 209 种为候选清单，标注为「待核实」。</li>
          <li v-if="dataNotice"><b>数据分级</b>：{{ dataNotice }}</li>
        </ul>
      </section>

      <section class="card box lift">
        <h3>技术栈</h3>
        <ul>
          <li>前端框架：Vue 3（组合式 API）</li>
          <li>构建工具：Vite</li>
          <li>地图引擎：Leaflet（开源）；默认天地图影像（需 Key），未配置时回退高德标准地图</li>
          <li>路由：Vue Router（hash 模式）</li>
          <li>数据：本地 JSON + 科大云盘同步文件（未启动本地服务时回退浏览器 localStorage）</li>
          <li>图像识别：ONNX Runtime Web（wasm）+ iNaturalist 2021 模型，纯浏览器推理，照片不上传</li>
        </ul>
      </section>

      <section class="card box lift">
        <h3>使用说明</h3>
        <ol>
          <li><b>看分布</b>：进入「分布地图」，用上方下拉框按科或花期筛选，点击圆点查看物种；相同区域点位会聚合为数字标记，点击放大即可展开。</li>
          <li><b>查物种</b>：进入「物种库」，搜索时会出现中文名 / 别名 / 学名联想，点击联想项直接进入详情页。</li>
          <li><b>看季节</b>：进入「季节专题」，选择月份并在「观花 / 观果」间切换，即可看到当月物候清单。</li>
          <li>
            <b>识植物</b>：进入「拍照识树」，拍照或选择图片后点「识别这张照片」。
            首次使用需下载约 43 MB 模型（之后浏览器缓存、可离线），识别结果只是候选，请结合叶形花果确认。
          </li>
          <li>
            <b>传照片</b>：进入「上传投稿」，选择照片 → 选择/填写物种 → 在地图上点选位置 →
            填写备注 → 保存。保存后可到地图查看。
          </li>
          <li><b>备份数据</b>：在「上传投稿」右侧点“导出 JSON”，即可把投稿导出成文件保存。</li>
        </ol>
      </section>

      <section class="card box warn lift">
        <h3>数据与免责说明</h3>
        <ul>
          <li>物种分布坐标为<b>近似示例值</b>（约 ±50 m，未实测），仅用于演示，不可作为专业或测量依据。</li>
          <li>数据分三级：<b>实地调查 / 示例坐标 / 公开资料整理</b>；页面上的徽章与提示会标明当前等级，未标「实地调查」即不可视为实测数据。</li>
          <li>「识别特征 / 学名来源」等文字为公开资料整理，仅供参考，正式鉴定请查阅《中国科学技术大学校园植物图鉴》及专业文献。</li>
          <li><b>拍照识别结果仅供参考</b>：模型来自 iNaturalist 2021（4271 种植物），只覆盖物种库的一部分，同科近缘种容易混淆，不能作为鉴定依据。</li>
          <li>图片由 AI 生成或为占位图，非真实拍摄；正式使用请替换为实拍照片。</li>
          <li>本项目<b>不公开、不商用</b>，仅作课程学习交流；演示数据不包含真实师生个人信息。</li>
          <li>定位与坐标涉及坐标系差异（<span class="nowrap">GCJ-02 / WGS-84</span>）；切换天地图与高德底图时应用会自动换算显示坐标。</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { dataNotice } from '@/utils/species'
</script>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.box {
  padding: 28px 30px;
}

.box h3 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 14px;
  color: var(--ink-strong);
  font-size: 16px;
  font-weight: 700;
}

.box h3::before {
  content: '';
  width: 4px;
  height: 15px;
  border-radius: 4px;
  background: var(--green-500);
}

.box p {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.9;
}

.box ul,
.box ol {
  margin: 0;
  padding-left: 20px;
  color: #33463c;
  font-size: 13.5px;
  line-height: 2.05;
}

.box.warn {
  border-color: #f0dfbe;
  background: var(--amber-050);
}

.box.warn h3::before {
  background: var(--amber);
}

.nowrap {
  white-space: nowrap;
}

@media (max-width: 640px) {
  .cards {
    grid-template-columns: 1fr;
  }

  .box {
    padding: 22px 20px;
  }
}
</style>
