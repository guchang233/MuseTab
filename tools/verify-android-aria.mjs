import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {unzipSync,strFromU8} from '../app/node_modules/fflate/esm/index.mjs';
import assert from 'node:assert/strict';
const run=promisify(execFile),adb=process.env.MUSETAB_ADB||'D:/MuMu/nx_main/adb.exe',serial=process.env.MUSETAB_DEVICE||'127.0.0.1:16480';
const out='tests/results/android-aria';await fs.mkdir(out,{recursive:true});const report={},sleep=ms=>new Promise(r=>setTimeout(r,ms));let c,offset={x:0,y:0};
const shell=(...args)=>run(adb,['-s',serial,'shell',...args],{timeout:15000});
async function wait(expression,core=false){const end=Date.now()+90000;while(Date.now()<end){try{if(await c.evaluate(expression,core))return;}catch(e){if(!/context|destroyed/i.test(String(e)))throw e;}await sleep(150);}throw Error('Timeout '+expression);}
async function syncOffset(){await shell('uiautomator','dump','/sdcard/musetab-aria-ui.xml').catch(e=>{if(!e.stdout?.includes('dumped to:'))throw e;});const xml=(await shell('cat','/sdcard/musetab-aria-ui.xml')).stdout,node=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*>/)?.[0],bounds=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert(bounds,'Native WebView bounds missing');offset={x:+bounds[1],y:+bounds[2]};}
async function tap(name,selector='button',bottom=false){
 const rect=await c.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(name)}||e.textContent.trim().replace(/\\s+/g,'')===${JSON.stringify(name.replace(/\s+/g,''))})&&e.getClientRects().length&&!e.closest('[inert]'));if(!e)throw Error('Missing '+${JSON.stringify(name)});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:${bottom?'r.bottom-6':'r.y+r.height/2'},dpr:devicePixelRatio};})()`);
 await shell('input','tap',String(Math.round(offset.x+rect.x*rect.dpr)),String(Math.round(offset.y+rect.y*rect.dpr)));await sleep(180);
}
async function fill(name,value){await c.evaluate(`(()=>{const e=[...document.querySelectorAll('input')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(name)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function score(){const bytes=Uint8Array.from(await c.evaluate('(async()=>Array.from(await musetabEngine.exportTo("mscz")))()',true));const zip=unzipSync(bytes);return strFromU8(Object.entries(zip).find(([name])=>name.endsWith('.mscx'))[1]);}
async function backHome(){for(let i=0;i<7;i++){await c.evaluate('onNativeBack();true');await sleep(100);}}
const pitches=xml=>[...xml.matchAll(/<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);
try{
 for(let i=0;i<30;i++){try{c=await AndroidCDP.connect(9238);break;}catch(e){if(i===29)throw e;await sleep(400);}}
 report.app=await c.evaluate('JSON.parse(Android.appInfo())');assert.equal(report.app.version,JSON.parse(await fs.readFile('app/package.json','utf8')).version);
 await wait('window.musetabEngine?.ready',true);await wait('typeof onNativeBack==="function"');await backHome();
 await syncOffset();await tap('新建乐谱');await fill('乐谱标题','安卓触屏编谱验证');await fill('小节数',4);await tap('创建乐谱');
 await wait('!!document.querySelector("[data-aria-editor]")&&!document.querySelector(".busy-layer")');await syncOffset();
 report.icons=await c.evaluate('(()=>{const e=document.querySelector(".aria-symbol"),s=getComputedStyle(e);return {image:s.webkitMaskImage||s.maskImage,size:s.webkitMaskSize||s.maskSize,repeat:s.webkitMaskRepeat||s.maskRepeat};})()');assert(report.icons.image?.includes('/aria-symbols/'),'Android icons must have a supported mask');assert.equal(report.icons.size,'contain');assert.equal(report.icons.repeat,'no-repeat');
 assert.equal(await c.evaluate('document.querySelectorAll("[aria-label=解锁编辑]").length'),0);
 await tap('钢琴 C4','.aria-keyboard button',true);await wait('!document.querySelector(".aria-edit-busy")');assert.deepEqual(pitches(await score()),[60]);
 await tap('钢琴 E4','.aria-keyboard button',true);await wait('!document.querySelector(".aria-edit-busy")');assert.deepEqual(pitches(await score()),[64]);
 await tap('撤销');await wait('!document.querySelector(".aria-edit-busy")');assert.deepEqual(pitches(await score()),[60]);
 await tap('音符输入','nav button');
 for(const name of ['G4','C5']){await tap('钢琴 '+name,'.aria-keyboard button',true);await wait('!document.querySelector(".aria-edit-busy")');}
 report.pitches=pitches(await score());assert(report.pitches.includes(67)&&report.pitches.includes(72));await c.screenshot(out+'/tablet-editor.png');
 await c.evaluate('window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));true',true);
 await tap('混音器');await wait('!!document.querySelector(".tablet-mixer")');await tap('播放');await wait('(events.findLast(e=>e.name==="position")?.data.secs??0)>.4',true);await tap('暂停播放');
 assert(await c.evaluate('!!document.querySelector(".tablet-mixer")'),'tablet mixer must leave transport accessible');await c.screenshot(out+'/tablet-mixer.png');await tap('关闭混音器');
 report.clocks=[];
 for(const audible of [false,true,false,true]){
  await c.evaluate(`(()=>{const staff=musetabEngine.scorePanels().parts[0].staves[0];if(!musetabEngine.changeParts({op:'staff-audible',id:staff.id,audible:${audible}}).ok)throw Error('mute failed');musetabEngine.seekSeconds(0);musetabEngine.dispatch('rewind');events.length=0;})()`,true);
  await tap('播放');await wait('(events.findLast(e=>e.name==="position")?.data.secs??0)>.5',true);
  const secs=await c.evaluate('events.findLast(e=>e.name==="position").data.secs',true);report.clocks.push({audible,secs});assert(secs>.5);await tap('暂停播放');
 }
 await tap('完成编谱');await wait('!document.querySelector("[data-aria-editor]")&&!document.querySelector(".busy-layer")');await c.screenshot(out+'/saved-reader.png');
 assert.deepEqual(c.errors,[]);console.log('PASS Android Aria actual touches, replacement/input semantics, undo, nonmodal mixer, save and four staff mute/unmute playback cycles',JSON.stringify(report));
}finally{try{await c?.evaluate('musetabEngine.dispatch("stop");true',true);}catch{}await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors:c?.errors},null,2));c?.close();}
