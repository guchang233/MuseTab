import fs from 'node:fs/promises';
const source='tests/results/cloud-ui',target='release/ui-preview';
await fs.mkdir(target,{recursive:true});
const shots=[
  ['home','source-phone','源码移植 · 手机首页','ZeraFun 0.7.4 CatalogueHeader / SearchBar / PhoneChrome'],
  ['home','source-tablet','源码移植 · 平板首页','800 × 1280 · 使用原 CSS 响应断点'],
  ['home','source-filter','源码移植 · 筛选弹层','原搜索组件的关闭、Escape 与 Android Back'],
  ['home','source-dark','源码移植 · 深色主题','使用原源码的主题令牌'],
  ['home','source-mumu-phone','MuMu · 手机 App 首页','安装包实际运行截图'],
  ['home','source-mumu-tablet','MuMu · 平板 App 首页','安装包实际运行截图'],
  ['phone','phone-home-recent','手机 · 首页 / 最近打开','390 × 844'],
  ['phone','phone-cloud-populated-fixture','手机 · 云端曲库（测试列表）','390 × 844 · 本地拦截响应'],
  ['phone','phone-reader-controls','手机 · 看谱工具条','360 × 800'],
  ['phone','phone-reader-fullscreen','手机 · 全屏看谱','390 × 844'],
  ['phone','phone-small-editor','小屏手机 · 编辑工具栏','360 × 800 · 两排可横向滑动'],
  ['phone','phone-editor-selection-panel','手机 · 选中内容面板','390 × 844 · 底部展开'],
  ['phone','phone-pdf-annotation','手机 · PDF 本地批注','390 × 844'],
  ['tablet','tablet-home-recent','平板 · 首页','800 × 1280'],
  ['tablet','tablet-cloud-populated-fixture','平板 · 云端曲库（测试列表）','800 × 1280 · 本地拦截响应'],
  ['tablet','tablet-portrait-editor','平板竖屏 · 编辑','800 × 1280'],
  ['tablet','tablet-landscape-editor','平板横屏 · 编辑','1280 × 800'],
  ['android','mumu-tablet-reader-fullscreen','MuMu · 安卓平板全屏看谱','Android 15 · 实际运行截图'],
  ['android','mumu-phone-editor','MuMu · 安卓手机编辑','1080 × 2400 / 480 dpi · 实际触摸区域'],
  ['android','mumu-phone-offline-pdf','MuMu · 断网重启后的 PDF 与批注','WebView 网络断开 · 原文件、字体和 worker 在 APK 内'],
];
for(const [from,to]of[['phone','source-phone'],['tablet-portrait','source-tablet'],['phone-source-filter','source-filter'],['phone-dark','source-dark'],['mumu-phone','source-mumu-phone'],['mumu-tablet','source-mumu-tablet']])await fs.copyFile('tests/results/zerafun-home/'+from+'.png',source+'/'+to+'.png');
for(const [,name] of shots)await fs.copyFile(source+'/'+name+'.png',target+'/'+name+'.png');
const cards=shots.map(([group,name,title,desc])=>'<article data-group="'+group+'"><h2>'+title+'</h2><p>'+desc+'</p><a href="'+name+'.png" target="_blank"><img src="'+name+'.png" loading="lazy" alt="'+title+'"></a></article>').join('\n');
await fs.writeFile(target+'/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MuseTab 0.4.1 界面实测</title><style>body{margin:0;background:#eee8dc;color:#3a3127;font:16px/1.6 system-ui,sans-serif}header{padding:24px max(20px,calc((100vw - 1440px)/2));border-bottom:1px solid #d0c6b4;background:#fbf8ef}h1{font-size:26px;margin:0}header p{margin:8px 0;max-width:900px}nav{display:flex;gap:8px;flex-wrap:wrap;padding:20px;max-width:1440px;margin:auto}button{min-height:44px;padding:0 20px;border:1px solid #bcaa8d;border-radius:8px;background:#fbf8ef;color:inherit;font:inherit;cursor:pointer}button[aria-pressed=true]{background:#b4573c;color:white;border-color:#b4573c}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;padding:0 20px 40px;max-width:1440px;margin:auto}article{min-width:0;background:#fbf8ef;border:1px solid #d0c6b4;border-radius:10px;padding:16px}h2{font-size:17px;margin:0}article p{font-size:13px;margin:4px 0 14px;color:#766957}img{display:block;width:100%;height:auto;max-height:900px;object-fit:contain;object-position:top}article[hidden]{display:none}a{display:block}</style><header><h1>MuseTab 0.4.1 · 手机和平板界面实测</h1><p>下列图片来自实际浏览器视口与 MuMu 的运行截图。点击图片可查看原图。云端有曲目列表的画面采用本地测试响应；没有向 GitHub 上传这些测试文件。</p><p>PDF 支持本地手写批注；导出原始 PDF 不包含墨迹。云端曲谱先保存到本地，才可打开。</p></header><nav aria-label="截图分组"><button data-filter="home" aria-pressed="true">ZeraFun 源码移植</button><button data-filter="phone" aria-pressed="false">手机其他页面</button><button data-filter="tablet" aria-pressed="false">平板</button><button data-filter="android" aria-pressed="false">MuMu 实机运行</button><button data-filter="all" aria-pressed="false">全部</button></nav><main>'+cards+'</main><script>function show(group){document.querySelectorAll("article").forEach(e=>e.hidden=group!=="all"&&e.dataset.group!==group);document.querySelectorAll("button").forEach(e=>e.setAttribute("aria-pressed",String(e.dataset.filter===group)))}document.querySelectorAll("button").forEach(e=>e.onclick=()=>show(e.dataset.filter));show("home")</script></html>');
console.log('Gallery:',target+'/index.html');
