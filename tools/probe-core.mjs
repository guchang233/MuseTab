import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
await page.addInitScript(()=>{
  window.audioMeters=[];
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(...args){
    if(this instanceof AudioWorkletNode&&!this.__meter){
      this.__meter=this.context.createAnalyser();
      connect.call(this,this.__meter);window.audioMeters.push(this.__meter);
    }
    return connect.apply(this,args);
  };
});
page.on('console',m=>{if(/ERROR|FATAL|Error|failed|STEP/.test(m.text()))console.log(m.text().slice(0,1200));});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
try{
  await page.goto('http://127.0.0.1:5183');
  const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>window.musetabEngine?.Module,{},{timeout:45000});
  await frame.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));});
  console.log('OPEN',await frame.evaluate(async()=>{await musetabEngine.open(new Uint8Array(await(await fetch('_test.mscz')).arrayBuffer()),'mscz');return events.filter(e=>['project','opened'].includes(e.name));}));
  for(const ext of ['mscz','musicxml']){
    await writeExport('core-original',ext);
  }
  console.log('ACTIONS',await frame.evaluate(()=>Object.fromEntries(['next-element','select-first-element','up-chromatic','play','stop','view-mode-page','zoom-page-width','action://notation/undo'].map(x=>[x,musetabEngine.actionState(x)]))));
  const note=await frame.evaluate(()=>{
    for(let i=0;i<300;i++){
      musetabEngine.dispatch('next-element');musetabEngine.sync();
      const selection=events.findLast(e=>e.name==='selection')?.data;
      if(selection?.type==='Note'&&selection.count===1&&!selection.range)return selection;
    }
    throw Error('Could not select a single note');
  });console.log('NOTE',note);
  await frame.evaluate(()=>musetabEngine.dispatch('pitch-up'));
  await writeExport('core-edited','mscz');
  await frame.evaluate(()=>musetabEngine.dispatch('action://notation/undo'));
  await writeExport('core-undone','mscz');
  await frame.evaluate(()=>musetabEngine.dispatch('action://notation/redo'));
  await writeExport('core-redone','mscz');
  console.log('SELECTIONS',await frame.evaluate(()=>events.filter(e=>['selection','changed'].includes(e.name)).slice(-8)));
  await frame.evaluate(()=>musetabEngine.dispatch('play'));
  await page.waitForTimeout(3000);
  console.log('AUDIO',await frame.evaluate(()=>audioMeters.map(a=>{const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return {state:a.context.state,peak:Math.max(...b.map(Math.abs))};})));
  console.log('STATE',await frame.evaluate(()=>events.filter(e=>['selection','playing','position','error'].includes(e.name)).slice(-10)));
  await frame.evaluate(()=>musetabEngine.dispatch('stop'));
  if(process.env.AUDIO_ONLY!=='1'){
  console.log('MIDI OPEN',await frame.evaluate(async()=>{await musetabEngine.open(new Uint8Array(await(await fetch('_test.mid')).arrayBuffer()),'mid');return events.findLast(e=>e.name==='project');}));
  await writeExport('core-midi','mscz');
  console.log('BAD FILE',await frame.evaluate(async()=>{try{await musetabEngine.open(new Uint8Array([1,2,3]),'mscz');return 'unexpected success';}catch(e){return e.message;}}));
  await writeExport('core-after-invalid','mscz');
  const xml=(await fs.readFile('tests/results/core-original.musicxml')).toString('base64');
  console.log('XML OPEN',await frame.evaluate(async b64=>{await musetabEngine.open(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),'musicxml');return events.findLast(e=>e.name==='project');},xml));
  await writeExport('core-xml','mscz');
  await frame.evaluate(async()=>musetabEngine.open(new Uint8Array(await(await fetch('_test.mscz')).arrayBuffer()),'mscz'));
  await writeExport('core-reopened','mscz');
  }
}finally{await browser.close();}

async function writeExport(name,ext){
  const data=await page.frames().find(f=>f.url().includes('/engine/host.html')).evaluate(async ext=>{
    const bytes=await musetabEngine.exportTo(ext);let s='';
    for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);
  },ext);
  const bytes=Buffer.from(data,'base64');await fs.writeFile('tests/results/'+name+'.'+ext,bytes);console.log('EXPORTED',name,ext,bytes.length);
}
