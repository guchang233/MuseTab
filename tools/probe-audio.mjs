import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const logs=[];const page=await browser.newPage();
await page.route('**/distr/audio_worklet_processor.js',async route=>{
  const response=await route.fetch();let code=await response.text();
  code=code.replace('MuseAudio.mainPort.postMessage(data)',"debugLog('AUDIO_TX '+JSON.stringify(Array.from(data).slice(0,25)));MuseAudio.mainPort.postMessage(data)");
  code=code.replace('MuseAudio.main_worker_rpcListen(event.data)',"debugLog('AUDIO_RX '+JSON.stringify(Array.from(event.data).slice(0,25)));MuseAudio.main_worker_rpcListen(event.data)");
  await route.fulfill({response,body:code});
});
await page.addInitScript(()=>{
  window.audioMeters=[];const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(...args){if(this instanceof AudioWorkletNode&&!this.__meter){this.__meter=this.context.createAnalyser();connect.call(this,this.__meter);audioMeters.push(this.__meter);}return connect.apply(this,args);};
});
page.on('console',m=>{logs.push(m.text().slice(0,1800));});
page.on('pageerror',e=>logs.push('PAGEERROR '+e.message));
page.on('response',r=>{if(r.status()>=400)logs.push('HTTP '+r.status()+' '+r.url());});
try{
  await page.goto('http://127.0.0.1:5183');
  const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:45000});
  await frame.evaluate(()=>{
    const m=musetabEngine.Module;
    console.info('RPC_LISTENER',m.main_worker_rpcListen?.toString().slice(0,180));
    const receive=m.main_worker_rpcChannel.port1.onmessage;
    m.main_worker_rpcChannel.port1.onmessage=e=>{console.info('MAIN_RX',JSON.stringify(Array.from(e.data).slice(0,25)));receive(e);};
    const send=m.main_worker_rpcSend;
    m.main_worker_rpcSend=data=>{console.info('MAIN_TX',JSON.stringify(Array.from(data).slice(0,25)));send(data);};
  });
  await frame.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));});
  await frame.evaluate(async()=>musetabEngine.open(new Uint8Array(await(await fetch('_test.mscz')).arrayBuffer()),'mscz'));
  await page.waitForTimeout(2000);await frame.evaluate(()=>musetabEngine.dispatch('play'));
  const samples=[];
  for(let i=0;i<30;i++){
    await page.waitForTimeout(250);samples.push(await frame.evaluate(()=>({position:events.findLast(e=>e.name==='position')?.data,playing:events.findLast(e=>e.name==='playing')?.data,meters:audioMeters.map(a=>{const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return {state:a.context.state,peak:Math.max(...b.map(Math.abs))};})})));
  }
  console.log(JSON.stringify(samples));await fs.writeFile('tests/results/audio-samples.json',JSON.stringify(samples,null,2));
}finally{await fs.writeFile('tests/results/audio-console.json',JSON.stringify(logs,null,2));await browser.close();}
