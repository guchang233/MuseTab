// 暗色主题看谱：普通视图与全屏页图都应是深色谱纸、浅色音符，且与亮色主题互不串缓存。
// 用法：先 pnpm --dir app dev --host 127.0.0.1 --port 5183，再 node tools/verify-night-pages.mjs
import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/results/night-pages';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
/** 统计一张页图里“纸”和“墨”的亮度：暗色时纸应暗、墨应亮。 */
async function tone(page,selector){
  return page.evaluate(async sel=>{
    const img=document.querySelector(sel);if(!img)return null;await img.decode();
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);
    const d=g.getImageData(0,0,c.width,c.height).data,hist=new Map();
    for(let i=0;i<d.length;i+=16){if(d[i+3]<128)continue;const l=Math.round((d[i]*.299+d[i+1]*.587+d[i+2]*.114)/16)*16;hist.set(l,(hist.get(l)||0)+1);}
    const sorted=[...hist].sort((a,b)=>b[1]-a[1]),paper=sorted[0][0];
    // 墨：与纸亮度相差最大且有一定数量的灰阶
    const ink=sorted.filter(([,n])=>n>20).reduce((best,[l])=>Math.abs(l-paper)>Math.abs(best-paper)?l:best,paper);
    return {paper,ink,contrast:Math.abs(ink-paper)};
  },selector);
}
async function run(scheme){
  const page=await browser.newPage({viewport:{width:800,height:1280},colorScheme:scheme,hasTouch:true});
  page.on('pageerror',e=>errors.push(scheme+': '+(e.stack||e.message)));
  await page.addInitScript(()=>localStorage.setItem('musetab.pageLayout','single'));
  await page.goto('http://127.0.0.1:5183');
  const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:90000});
  const fc=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();
  await(await fc).setFiles('app/public/engine/_test.mscz');
  await page.locator('.sheet-page').first().waitFor({timeout:90000});await page.waitForTimeout(800);
  const sheet=await tone(page,'.sheet-page');await page.screenshot({path:`${out}/${scheme}-sheet.png`});
  await page.getByRole('button',{name:'全屏看谱',exact:true}).click();
  await page.locator('.gallery-page').first().waitFor({timeout:60000});await page.waitForTimeout(600);
  const gallery=await tone(page,'.gallery-page');await page.screenshot({path:`${out}/${scheme}-gallery.png`});
  await page.close();
  return {sheet,gallery};
}
try{
  const dark=await run('dark'),light=await run('light');
  console.log(JSON.stringify({dark,light}));
  for(const [name,t] of Object.entries(dark)){assert(t.paper<96,`dark ${name} paper should be dark: ${JSON.stringify(t)}`);assert(t.ink>t.paper+96,`dark ${name} ink should be light: ${JSON.stringify(t)}`);}
  for(const [name,t] of Object.entries(light)){assert(t.paper>200,`light ${name} paper should be light: ${JSON.stringify(t)}`);assert(t.ink<t.paper-96,`light ${name} ink should be dark: ${JSON.stringify(t)}`);}
  assert.deepEqual(errors,[]);
  console.log('PASS night pages readable in both themes');
}finally{await browser.close();}
