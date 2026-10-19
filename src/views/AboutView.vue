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
          <b>分布地图 / 物种库 / 上传投稿</b> 三块核心功能展开。数据以 JSON
          静态文件维护，用户投稿保存在本机浏览器，无需服务器与数据库。
        </p>
        <ul>
          <li>分布地图：按科、花期筛选，点击标记查看物种</li>
          <li>物种库：名称/别名搜索、科与花期筛选、详情页</li>
          <li>物种详情：<b>识别特征、学名来源</b>、分布位置（图鉴体例）</li>
          <li>上传投稿：上传照片、地图选点、导出/导入数据</li>
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
        </ul>
      </section>

      <section class="card box lift">
        <h3>使用说明</h3>
        <ol>
          <li><b>看分布</b>：进入「分布地图」，用上方下拉框按科或花期筛选，点击圆点查看物种。</li>
          <li><b>查物种</b>：进入「物种库」，搜索或筛选后点击卡片进入详情页。</li>
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
          <li>物种分布坐标为<b>近似示例值</b>，仅用于演示，不可作为专业依据。</li>
          <li>「识别特征 / 学名来源」等文字为公开资料整理，仅供参考，正式鉴定请查阅《中国科学技术大学校园植物图鉴》及专业文献。</li>
          <li>图片由 AI 生成或为占位图，非真实拍摄；正式使用请替换为实拍照片。</li>
          <li>本项目<b>不公开、不商用</b>，仅作课程学习交流。</li>
          <li>定位与坐标涉及坐标系差异（<span class="nowrap">GCJ-02 / WGS-84</span>）；切换天地图与高德底图时应用会自动换算显示坐标。</li>
        </ul>
      </section>
    </div>
  </div>
</template>

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
