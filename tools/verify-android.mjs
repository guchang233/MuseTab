import {AndroidCDP} from './android-cdp.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const exec=promisify(execFile),adb='D:/MuseTabSDK/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>exec(adb,['-s','emulator-5556',...args]);
const c=await AndroidCDP.connect(),checks=[];
const editingOnly=process.argv[2]==='edit';
if(editingOnly)checks.push(...JSON.parse(await fs.readFile('tests/results/stage1-android.json','utf8')).checks);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function pass(name,data){checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));}
async function tap(expression){
  const pos=await c.evaluate(`(()=>{const e=${expression};if(!e)throw Error('Missing element');const r=e.getBoundingClientRect();return {x:(r.x+r.width/2)*devicePixelRatio,y:(r.y+r.height/2)*devicePixelRatio};})()`);
  await run('shell','input','tap',String(Math.round(pos.x)),String(Math.round(pos.y)));await sleep(250);
}
try{
  assert.equal((await run('shell','settings','get','global','airplane_mode_on')).stdout.trim(),'1');
  assert.equal(await c.evaluate('musetabEngine.ready',true),true);pass('offline native engine ready');
  if(!editingOnly){
  await c.evaluate(`window.mobileEvents=[];musetabEngine.on((name,data)=>mobileEvents.push({name,data}));musetabEngine.dispatch('first-element');musetabEngine.sync();`,true);
  const note=await c.evaluate(`(()=>{for(let i=0;i<300;i++){musetabEngine.sync();const s=mobileEvents.findLast(e=>e.name==='selection')?.data;if(s?.type==='Note'&&s.tick>=960)return s;musetabEngine.dispatch('next-element');}throw Error('No note');})()`,true);
  await c.evaluate(`musetabEngine.dispatch('action://notation/cancel')`,true);
  assert.equal(await c.evaluate(`mobileEvents.findLast(e=>e.name==='selection').data.none`,true),true);
  const geom=await c.evaluate(`({dpr:devicePixelRatio,frame:document.querySelector('iframe').getBoundingClientRect().toJSON()})`);
  await run('shell','input','tap',String(Math.round((geom.frame.x+note.rect.x+note.rect.w/2)*geom.dpr)),String(Math.round((geom.frame.y+note.rect.y+note.rect.h/2)*geom.dpr)));
  await sleep(400);
  const hit=await c.evaluate(`mobileEvents.findLast(e=>e.name==='selection').data`,true);assert.equal(hit.type,'Note');assert.equal(hit.count,1);assert.equal(hit.tick,note.tick);pass('real Android touch selects a note',hit);
  await c.screenshot('tests/results/android-reader-selection.png');
  await c.evaluate(`window.mobileMeter=null;{const old=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){if(this instanceof AudioWorkletNode&&!window.mobileMeter){window.mobileMeter=this.context.createAnalyser();old.call(this,mobileMeter);}return old.apply(this,args);};musetabEngine.Module.driver.open();AudioNode.prototype.connect=old;}`,true);
  await tap(`document.querySelector('button[aria-label="从这里播放"]')`);await sleep(1200);
  const state=await c.evaluate(`({position:mobileEvents.findLast(e=>e.name==='position')?.data,playing:mobileEvents.findLast(e=>e.name==='playing')?.data})`,true);
  assert.equal(state.playing.playing,true);assert(state.position.tick>note.tick);pass('offline playback starts at touched note and advances',state);
  let peak=0;
  for(let i=0;i<8;i++){peak=Math.max(peak,await c.evaluate(`(()=>{const a=mobileMeter,b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));})()`,true));await sleep(150);}
  assert(peak>0.00001);pass('Android WebAudio produces sound samples',peak);
  await c.evaluate(`musetabEngine.dispatch('stop')`,true);
  await run('shell','input','tap','15','15');await sleep(250);
  await tap(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='编辑')`);
  }
  await c.evaluate(`musetabEngine.dispatch('first-element');for(let i=0;i<50;i++){musetabEngine.sync();if(mobileEvents.findLast(e=>e.name==='selection')?.data.type==='Note')break;musetabEngine.dispatch('next-element');}`,true);
  if(!await c.evaluate(`!!document.querySelector('.drawer[aria-label="选中"]')`))await tap(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='选中')`);
  await tap(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='升半音')`);
  await sleep(1800);
  const edited=await c.evaluate(`musetabEngine.sync();mobileEvents.findLast(e=>e.name==='selection').data`,true);assert.equal(edited.pitch,78);pass('Android edit raises first note by one semitone',edited);
  await tap(`document.querySelector('button[aria-label="保存"]')`);await sleep(800);
  const stored=await c.evaluate(`new Promise((resolve,reject)=>{const o=indexedDB.open('musetab');o.onerror=()=>reject(o.error);o.onsuccess=()=>{const d=o.result,t=d.transaction(['scores','files'],'readonly'),q=t.objectStore('scores').getAll();q.onsuccess=()=>{const f=t.objectStore('files').get(q.result[0].id);f.onsuccess=()=>{const a=f.result;let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));resolve(btoa(s));};};t.oncomplete=()=>d.close();};})`);
  await fs.writeFile('tests/results/android-stored.mscz',Buffer.from(stored,'base64'));pass('edited score stored in Android IndexedDB');
  await c.screenshot('tests/results/android-editor-landscape.png');
  await run('shell','settings','put','system','accelerometer_rotation','0');await run('shell','settings','put','system','user_rotation','1');await sleep(1000);
  const layout=await c.evaluate(`({width:innerWidth,height:innerHeight,frame:document.querySelector('iframe').getBoundingClientRect().toJSON(),footer:document.querySelector('.thumb').getBoundingClientRect().toJSON()})`);assert(layout.width<layout.height);assert(layout.frame.bottom<=layout.footer.y+1);pass('Android portrait canvas avoids editor controls',layout);
  await c.screenshot('tests/results/android-editor-portrait.png');
}finally{await fs.writeFile('tests/results/stage1-android.json',JSON.stringify({checks,errors:c.errors},null,2));c.close();}
