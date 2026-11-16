import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {unzipSync,strFromU8} from '../app/node_modules/fflate/esm/index.mjs';
import assert from 'node:assert/strict';
const run=promisify(execFile),adb=process.env.MUSETAB_ADB||'D:/MuMu/nx_main/adb.exe',serial=process.env.MUSETAB_DEVICE||'127.0.0.1:16480';
const out='tests/results/android-touch-composer';await fs.mkdir(out,{recursive:true});const report={},sleep=ms=>new Promise(r=>setTimeout(r,ms));let c,offset={x:0,y:0};
const shell=(...args)=>run(adb,['-s',serial,'shell',...args],{timeout:15000});
async function wait(expression,core=false){const end=Date.now()+90000;while(Date.now()<end){try{if(await c.evaluate(expression,core))return;}catch(e){if(!/context|destroyed/i.test(String(e)))throw e;}await sleep(150);}throw Error('Timeout '+expression);}
async function syncOffset(){await shell('uiautomator','dump','/sdcard/musetab-composer-ui.xml').catch(e=>{if(!e.stdout?.includes('dumped to:'))throw e;});const xml=(await shell('cat','/sdcard/musetab-composer-ui.xml')).stdout,node=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*>/)?.[0],bounds=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(bounds,'Native WebView bounds missing');offset={x:+bounds[1],y:+bounds[2]};}
async function tap(name,selector='button'){
 const rect=await c.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(name)}||e.textContent.trim()===${JSON.stringify(name)})&&e.getClientRects().length&&!e.closest('[inert]'));if(!e)throw Error('Missing '+${JSON.stringify(name)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,dpr:devicePixelRatio};})()`);
 await shell('input','tap',String(Math.round(offset.x+rect.x*rect.dpr)),String(Math.round(offset.y+rect.y*rect.dpr)));await sleep(180);
}
async function fill(name,value){await c.evaluate(`(()=>{const e=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(name))}+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function score(){const bytes=Uint8Array.from(await c.evaluate('Array.from(await musetabEngine.exportTo("mscz"))',true));const zip=unzipSync(bytes);return strFromU8(Object.entries(zip).find(([name])=>name.endsWith('.mscx'))[1]);}
try{
 for(let i=0;i<30;i++){try{c=await AndroidCDP.connect(9238);break;}catch(e){if(i===29)throw e;await sleep(400);}}
 report.app=await c.evaluate('JSON.parse(Android.appInfo())');assert.equal(report.app.version,JSON.parse(await fs.readFile('app/package.json','utf8')).version);
 await wait('window.musetabEngine?.ready',true);await wait('typeof onNativeBack==="function"');
 for(let i=0;i<6;i++){await c.evaluate('onNativeBack();true');await sleep(100);}
 await syncOffset();await tap('新建乐谱');await fill('乐谱标题','安卓触屏编谱验证');await fill('小节数',4);await tap('创建乐谱');
 await wait('!!document.querySelector(".composer-deck")&&!document.querySelector(".busy-layer")');await syncOffset();
 await tap('音符','.category-row button');await tap('输入 C4');await wait('!!document.querySelector(".unlock-dialog")');assert(!((await score()).includes('<Note>')));await tap('保持锁定');await tap('解锁编辑');
 for(const name of ['C4','E4','G4','C5']){await tap('输入 '+name);await wait('!document.querySelector(".composer-busy")');}
 report.pitches=[...(await score()).matchAll(/<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);assert.deepEqual(report.pitches,[60,64,67,72]);
 await tap('保存');await wait('!document.querySelector(".composer-busy")');await c.screenshot(out+'/tablet-composer.png');
 await c.evaluate('window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));true',true);
 await tap('播放');await wait('(events.findLast(e=>e.name==="position")?.data.secs??0)>.4',true);await tap('暂停');
 report.clocks=[];
 for(const audible of [false,true,false,true]){
  await c.evaluate(`(()=>{const staff=musetabEngine.scorePanels().parts[0].staves[0];if(!musetabEngine.changeParts({op:'staff-audible',id:staff.id,audible:${audible}}).ok)throw Error('mute failed');musetabEngine.seekSeconds(0);musetabEngine.dispatch('rewind');events.length=0;})()`,true);
  await tap('播放');await wait('(events.findLast(e=>e.name==="position")?.data.secs??0)>.5',true);
  const secs=await c.evaluate('events.findLast(e=>e.name==="position").data.secs',true);report.clocks.push({audible,secs});assert(secs>.5);await tap('暂停');
 }
 await c.screenshot(out+'/after-mute-playback.png');
 assert.deepEqual(c.errors,[]);console.log('PASS Android actual touch input, default lock, MSCZ save, playback and four staff mute/unmute cycles',JSON.stringify(report));
}finally{try{await c?.evaluate('musetabEngine.dispatch("stop");true',true);}catch{}await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors:c?.errors},null,2));c?.close();}
