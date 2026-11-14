import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const out='tests/results/muted-playback';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true}),report={logs:[],cases:[]};let f;
p.on('pageerror',e=>report.logs.push({type:'pageerror',text:e.message}));p.on('console',e=>{if(e.type()==='error'||/WORKER|error|failed|assert/i.test(e.text()))report.logs.push({type:e.type(),text:e.text()});});
await p.addInitScript(()=>{window.meters=[];const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){if(this instanceof AudioWorkletNode&&!this.__meter){this.__meter=this.context.createAnalyser();this.__meter.fftSize=4096;connect.call(this,this.__meter);meters.push(this.__meter);}return connect.apply(this,args);};});
async function sample(){return f.evaluate(()=>({playing:musetabEngine.isPlaying,position:events.findLast(e=>e.name==='position')?.data,audio:musetabEngine.Module.driver.diagnostics,worker:musetabEngine.Module.driver.workerDiagnostics,failed:musetabEngine.Module.driver.soundFontFailed,energy:Math.max(0,...meters.map(a=>{const wave=new Float32Array(a.fftSize);a.getFloatTimeDomainData(wave);return Math.max(...wave.map(Math.abs));}))}));}
try{
 await p.goto('http://127.0.0.1:5183');f=p.frames().find(x=>x.url().includes('/engine/host.html'));await f.waitForFunction(()=>musetabEngine?.ready,{},{timeout:90000});await f.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));});
 const dir='D:/music/Context/2025/2025 7',name=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz')),score=process.env.MUSETAB_SCORE||dir+'/'+name,fc=p.waitForEvent('filechooser');await p.getByRole('button',{name:'导入乐谱',exact:true}).click();await(await fc).setFiles(score);await p.locator('.reader').waitFor();await p.getByRole('button',{name:'编辑',exact:true}).first().click();
 for(const muted of [-1,0,1]){
  await f.evaluate(()=>musetabEngine.dispatch('stop'));await p.waitForTimeout(300);const state=await f.evaluate(()=>musetabEngine.scorePanels());
  for(let i=0;i<state.parts[0].staves.length;i++)await f.evaluate(({id,audible})=>musetabEngine.changeParts({op:'staff-audible',id,audible}),{id:state.parts[0].staves[i].id,audible:i!==muted});
  const item={muted,panels:await f.evaluate(()=>musetabEngine.scorePanels()),samples:[]};report.cases.push(item);await p.getByRole('button',{name:'播放',exact:true}).click();
  for(let i=0;i<18;i++){await p.waitForTimeout(800);const s=await sample();item.samples.push(s);console.log(JSON.stringify({muted,i,...s}));}
  await p.screenshot({path:out+'/muted-'+muted+'.png'});
 }
}finally{try{await f.evaluate(()=>musetabEngine.dispatch('stop'));}catch{}await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
