import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {unzipSync}=createRequire(import.meta.url)('../app/node_modules/fflate');
const out='tests/results';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});
const logs=[],checks=[];
let frame;
page.on('console',m=>{if(/ERROR|WARN|Error|qrc:/.test(m.text()))logs.push(m.text().slice(0,1500));});
page.on('pageerror',e=>logs.push('PAGEERROR '+e.message));
await page.addInitScript(()=>{
  window.audioMeters=[];
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(...args){
    if(this instanceof AudioWorkletNode&&!this.__meter){this.__meter=this.context.createAnalyser();connect.call(this,this.__meter);audioMeters.push(this.__meter);}
    return connect.apply(this,args);
  };
});
function pass(name,data){checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));}
async function ready(){
  frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:45000});
  await frame.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));musetabEngine.sync();});
}
async function selected(){return frame.evaluate(()=>events.findLast(e=>e.name==='selection')?.data);}
async function selectNote(minTick=0){
  const note=await frame.evaluate(minTick=>{
    musetabEngine.dispatch('first-element');
    for(let i=0;i<500;i++){
      musetabEngine.sync();
      const s=events.findLast(e=>e.name==='selection')?.data;
      if(s?.type==='Note'&&s.count===1&&!s.range&&s.tick>=minTick)return s;
      musetabEngine.dispatch('next-element');
    }
    throw Error('No single note selected');
  },minTick);
  await frame.evaluate(()=>musetabEngine.dispatch('action://notation/cancel'));
  const box=await page.locator('iframe[title="谱面"]').boundingBox();
  const r=note.rect;
  assert(r.x>=0&&r.y>=0&&r.x+r.w/2<box.width&&r.y+r.h/2<box.height,'selected note must be visible');
  await page.mouse.click(box.x+r.x+r.w/2,box.y+r.y+r.h/2);
  await page.waitForTimeout(220);
  const hit=await selected();assert.equal(hit.type,'Note');assert.equal(hit.count,1);assert.equal(hit.range,false);assert.equal(hit.tick,note.tick);
  return hit;
}
async function stored(){
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const o=indexedDB.open('musetab');o.onerror=()=>reject(o.error);
    o.onsuccess=()=>{const db=o.result,t=db.transaction(['scores','files'],'readonly'),s=t.objectStore('scores').getAll();
      s.onsuccess=()=>{const rec=s.result[0],q=t.objectStore('files').get(rec.id);q.onsuccess=()=>{let b='';const bytes=q.result;for(let i=0;i<bytes.length;i+=32768)b+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve({rec,b64:btoa(b)});};};t.oncomplete=()=>db.close();};
  }));
}
function xml(bytes){const z=unzipSync(bytes);return new TextDecoder().decode(z[Object.keys(z).find(n=>n.endsWith('.mscx'))]);}
function pitches(s){return Array.from(s.matchAll(/<Note(?:\s[^>]*)?>[\s\S]*?<pitch>(\d+)<\/pitch>/g),m=>Number(m[1]));}
async function waitStoredPitch(p){
  for(let i=0;i<40;i++){const v=await stored();if(pitches(xml(Buffer.from(v.b64,'base64')))[0]===p)return v;await page.waitForTimeout(250);}
  throw Error('Edited score was not persisted');
}
try{
  await page.goto('http://127.0.0.1:5183');await ready();pass('engine startup');
  const dir='D:/music/Context/2025/2025 7',file=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz'));
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();await(await chooser).setFiles(dir+'/'+file);
  await page.locator('.reader').waitFor();await page.waitForTimeout(700);
  await page.screenshot({path:out+'/reader-landscape.png'});pass('real MSCZ import and reader');
  const note=await selectNote(960);await page.getByRole('button',{name:'从这里播放',exact:true}).waitFor();pass('precise pointer selection',note);
  await page.screenshot({path:out+'/reader-selection.png'});
  await page.getByRole('button',{name:'从这里播放',exact:true}).click();await page.waitForTimeout(1000);
  const position=await frame.evaluate(()=>events.findLast(e=>e.name==='position')?.data);assert(position.tick>=note.tick);assert(position.tick<note.tick+2500);
  if(process.env.SKIP_AUDIO!=='1'){
    assert(position.tick>note.tick,'playback tick must advance from selection');
    assert.equal(await frame.evaluate(()=>events.findLast(e=>e.name==='playing')?.data?.playing),true);
  }
  pass('play from selected note',position);
  let peak=0;
  for(let i=0;i<12;i++){peak=Math.max(peak,...await frame.evaluate(()=>audioMeters.map(a=>{const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return Math.max(...b.map(Math.abs));})));await page.waitForTimeout(150);}
  if(process.env.SKIP_AUDIO==='1')console.log('SKIPPED audio assertion for UI diagnosis');
  else{assert(peak>0.00001,'synthesizer must produce a nonzero audio signal');pass('synthesized audio',peak);}
  await frame.evaluate(()=>musetabEngine.dispatch('stop'));
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.locator('.editor').waitFor();
  const first=await selectNote();assert.equal(first.pitch,77);
  await page.getByRole('button',{name:'选中',exact:true}).click();await page.getByRole('button',{name:'升半音',exact:true}).click();
  const edited=await waitStoredPitch(78);const ps=pitches(xml(Buffer.from(edited.b64,'base64')));assert.equal(ps.length,7687);pass('UI pitch edit and autosave',{notes:ps.length,first:ps[0]});
  await page.getByRole('button',{name:'撤销',exact:true}).click();await waitStoredPitch(77);await page.getByRole('button',{name:'重做',exact:true}).click();await waitStoredPitch(78);pass('UI undo redo and saved document');
  const fingeringCount=s=>(s.match(/<Fingering(?:\s[^>]*)?>/g)||[]).length;
  const beforeFinger=fingeringCount(xml(Buffer.from((await stored()).b64,'base64')));
  await page.getByRole('button',{name:'符号',exact:true}).click();
  await page.locator('button.head').filter({hasText:'指法'}).click();
  await page.locator('button.pcell').first().click();
  let marked;
  for(let i=0;i<40;i++){marked=await stored();if(fingeringCount(xml(Buffer.from(marked.b64,'base64')))===beforeFinger+1)break;await page.waitForTimeout(250);}
  assert.equal(fingeringCount(xml(Buffer.from(marked.b64,'base64'))),beforeFinger+1);pass('native fingering palette and persisted marking');
  await page.getByRole('button',{name:'收起符号',exact:true}).click();await page.getByRole('button',{name:'撤销',exact:true}).click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:out+'/editor-landscape.png'});
  await page.setViewportSize({width:800,height:1280});await page.waitForTimeout(500);
  const layout=await page.evaluate(()=>({footer:document.querySelector('.thumb').getBoundingClientRect().toJSON(),frame:document.querySelector('iframe').getBoundingClientRect().toJSON()}));assert(layout.frame.bottom<=layout.footer.y+1);pass('portrait editor canvas avoids toolbar',layout);
  await page.screenshot({path:out+'/editor-portrait.png'});
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.getByRole('button',{name:'更多',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('menuitem',{name:'导出 MuseScore 文件',exact:true}).click();await(await download).saveAs(out+'/ui-export.mscz');assert.equal(pitches(xml(await fs.readFile(out+'/ui-export.mscz')))[0],78);pass('export edited MSCZ');
  await page.reload();await ready();await page.locator('button.local-score').first().click();await page.locator('.reader').waitFor();await page.waitForTimeout(400);
  const reopened=await selectNote();assert.equal(reopened.pitch,78);pass('reopen locally saved edit after reload',reopened);
  await page.screenshot({path:out+'/reader-portrait.png'});
}catch(e){console.error(e);await page.screenshot({path:out+'/stage1-failure.png'});throw e;}
finally{await fs.writeFile(out+'/stage1-web.json',JSON.stringify({checks,logs},null,2));await browser.close();}
