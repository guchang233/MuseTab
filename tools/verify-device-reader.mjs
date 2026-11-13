import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import assert from 'node:assert/strict';
const run=promisify(execFile),adb=process.env.MUSETAB_ADB,serial=process.env.MUSETAB_DEVICE;
if(!adb||!serial)throw Error('Set MUSETAB_ADB and MUSETAB_DEVICE explicitly; this test uses real device touches.');
const out='tests/results/reader-fixes/device';await fs.mkdir(out,{recursive:true});
const shell=(...args)=>run(adb,['-s',serial,'shell',...args],{timeout:20000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];let c,origin={x:0,y:0};
async function wait(expression,timeout=60000){const until=Date.now()+timeout;while(Date.now()<until){if(await c.evaluate(expression))return;await sleep(250);}throw Error('Timed out: '+expression);}
async function offset(){
 await shell('uiautomator','dump','/sdcard/musetab-test-ui.xml').catch(e=>{if(!e.stdout?.includes('dumped to:'))throw e;});
 const xml=(await shell('cat','/sdcard/musetab-test-ui.xml')).stdout,node=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*>/)?.[0],b=node?.match(/bounds="\[(\d+),(\d+)\]/);
 if(!b)throw Error('App WebView bounds missing');origin={x:+b[1],y:+b[2]};
}
async function at(x,y){const ratio=await c.evaluate('devicePixelRatio');await shell('input','tap',String(Math.round(origin.x+x*ratio)),String(Math.round(origin.y+y*ratio)));await sleep(300);}
async function tap(selector){await offset();const p=await c.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await at(p.x,p.y);}
async function swipe(dx,dy=0){await offset();const v=await c.evaluate('({w:innerWidth,h:innerHeight,d:devicePixelRatio})');const x=v.w/2,y=v.h*.52;await shell('input','swipe',String(Math.round(origin.x+(x-dx/2)*v.d)),String(Math.round(origin.y+(y-dy/2)*v.d)),String(Math.round(origin.x+(x+dx/2)*v.d)),String(Math.round(origin.y+(y+dy/2)*v.d)),'220');await sleep(300);}
const pass=(name,data)=>{checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));};
const snap=name=>c.screenshot(out+'/'+name+'.png');
try{
 c=await AndroidCDP.connect(9234);
 for(let i=0;i<160;i++){if(await c.evaluate('!!musetabEngine?.ready',true))break;await sleep(250);}
 assert(await c.evaluate('musetabEngine.ready',true),'native core must start on device');
 pass('real device native startup',{heap:await c.evaluate('musetabEngine.Module.HEAPU8.length',true)});
 await c.evaluate('location.hash="/library"');await wait('!!document.querySelector(".app-tabbar")');await snap('home');
 const dir='D:/music/Context/2025/2025 7',file=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz'));
 const existing=await c.evaluate('[...document.querySelectorAll(".local-score")].some(e=>e.textContent.includes("Frieren"))');
 if(existing)await c.evaluate('[...document.querySelectorAll(".local-score")].find(e=>e.textContent.includes("Frieren")).click()');
 else await c.evaluate('window.onNativeOpen("Frieren.mscz",'+JSON.stringify((await fs.readFile(dir+'/'+file)).toString('base64'))+')');
 await wait('!!document.querySelector(".reader")');await sleep(800);
 await snap('reader');
 await c.evaluate('window.deviceEvents=[];musetabEngine.on((name,data)=>deviceEvents.push({name,data}));',true);
 await tap('[aria-label="全屏看谱"]');await wait('document.querySelector(".reader .page-number")?.textContent==="1 / 14"');await sleep(700);await snap('gallery-page1');
 await swipe(-300);await wait('document.querySelector(".reader .page-number")?.textContent==="2 / 14"');await snap('gallery-page2');
 await swipe(300);await wait('document.querySelector(".reader .page-number")?.textContent==="1 / 14"');
 const masks=await c.evaluate('[...document.querySelectorAll(".page-matte")].map(e=>e.getAttribute("style"))');await swipe(0,-200);assert.deepEqual(await c.evaluate('[...document.querySelectorAll(".page-matte")].map(e=>e.getAttribute("style"))'),masks);
 pass('physical touch swipe turns native pages; vertical drag stays fixed');
 const note=await c.evaluate(`(()=>{musetabEngine.dispatch('first-element');for(let i=0;i<100;i++){musetabEngine.sync();const s=deviceEvents.findLast(e=>e.name==='selection')?.data;if(s?.type==='Note')return s;musetabEngine.dispatch('next-element');}})()`,true);
 await c.evaluate('musetabEngine.dispatch("action://notation/cancel")',true);await offset();await at(note.rect.x+note.rect.w/2,note.rect.y+note.rect.h/2);
 await wait('!!document.querySelector("[aria-label=\\"从这里播放\\"]")');await snap('gallery-note');
 assert.equal(await c.evaluate('deviceEvents.findLast(e=>e.name==="selection")?.data?.type',true),'Note');
 await tap('[aria-label="从这里播放"]');await sleep(1200);const pos=await c.evaluate('deviceEvents.findLast(e=>e.name==="position")?.data',true);assert(pos.tick>note.tick);await c.evaluate('musetabEngine.dispatch("stop")',true);pass('physical touch note selection and playback advances from that note',pos);
 await shell('input','keyevent','4');await wait('!!document.querySelector(".reading-header")');await tap('.reading-header .edit');await wait('!!document.querySelector(".editor")');await snap('editor');
 const baseline=await c.evaluate('musetabEngine.scoreStyle()',true);
  await tap('[aria-label="更多"]');await tap('[role="menuitem"]:nth-of-type(5)');await wait('!!document.querySelector(".score-settings")');
 assert.equal(await c.evaluate('document.querySelector(".score-settings h2").textContent'),'页面设置');await snap('page-settings');await shell('input','keyevent','4');await wait('!document.querySelector(".score-settings")');
 await c.evaluate('musetabEngine.dispatch("edit-style")',true);await wait('!!document.querySelector(".score-settings")');await snap('style-settings');
 const spacing=baseline.measureSpacing===2?2.1:2;
 await c.evaluate('(()=>{const e=document.querySelector("input[aria-label=\\"小节间距倍率\\"]");e.value='+JSON.stringify(String(spacing))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');await tap('.score-settings .apply');await wait('!document.querySelector(".score-settings")');assert.equal((await c.evaluate('musetabEngine.scoreStyle()',true)).measureSpacing,spacing);
 await tap('[aria-label="撤销"]');assert(Math.abs((await c.evaluate('musetabEngine.scoreStyle()',true)).measureSpacing-baseline.measureSpacing)<.00001);pass('mobile page/style panels, Android Back, apply and undo without desktop UI');
 await tap('.topbar [aria-label="返回谱匣"]');await wait('!!document.querySelector(".app-tabbar")');
 await tap('.app-tabbar button:nth-child(2)');await wait('document.querySelectorAll(".cloud-score").length>=573',65000);await snap('cloud');pass('actual static cloud catalog on tablet',{scores:await c.evaluate('document.querySelectorAll(".cloud-score").length')});
 assert.deepEqual(c.errors,[]);
}catch(e){console.error(e);await snap('failure').catch(()=>{});throw e;}finally{await fs.writeFile(out+'/report.json',JSON.stringify({checks,errors:c?.errors||[]},null,2));c?.close();}
