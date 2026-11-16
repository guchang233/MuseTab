import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const out='tests/results/pdf-omr',input=process.argv[2]||out+'/jobs/f16cd0ff293f4669a2351e4b74069d7a/page-0001.musicxml';
const b=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1280,height:800}});let report={},errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{window.meters=[];const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(...args){if(this instanceof AudioWorkletNode&&!this.__meter){this.__meter=this.context.createAnalyser();this.__meter.fftSize=2048;connect.call(this,this.__meter);meters.push(this.__meter);}return connect.apply(this,args);};});
async function play(){await p.evaluate(async()=>{await musetabEngine.startAudio();musetabEngine.dispatch('play');});await p.waitForTimeout(1800);return p.evaluate(()=>({playing:musetabEngine.isPlaying,seconds:events.findLast(e=>e.name==='position')?.data.secs||0,peak:Math.max(0,...meters.map(m=>{const values=new Float32Array(m.fftSize);m.getFloatTimeDomainData(values);return Math.max(...values.map(Math.abs));})),audioError:musetabEngine.audioError}));}
try{
 await p.goto('http://127.0.0.1:5183/engine/host.html');await p.waitForFunction(()=>musetabEngine?.ready,{},{timeout:90000});await p.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));});
 const bytes=Array.from(await fs.readFile(input));await p.evaluate(async bytes=>musetabEngine.open(new Uint8Array(bytes),'musicxml'),bytes);
 report.font=await p.evaluate(()=>events.find(e=>e.name==='text-font')?.data);assert(report.font?.loaded,'bundled font must load without a diagnostic bypass');
 const mscz=await p.evaluate(async()=>Array.from(await musetabEngine.exportTo('mscz')));await fs.writeFile(out+'/recognized.mscz',Buffer.from(mscz));report.musicxml=await play();assert(report.musicxml.playing&&report.musicxml.seconds>1&&report.musicxml.peak>1e-5&&!report.musicxml.audioError);
 await p.evaluate(()=>musetabEngine.dispatch('stop'));await p.evaluate(async bytes=>musetabEngine.open(new Uint8Array(bytes),'mscz'),mscz);report.mscz=await play();assert(report.mscz.playing&&report.mscz.seconds>1&&report.mscz.peak>1e-5&&!report.mscz.audioError);await p.evaluate(()=>musetabEngine.dispatch('stop'));
 const image=await p.evaluate(()=>musetabEngine.renderPage(0,1600));await fs.writeFile(out+'/recognized.png',Buffer.from(image.split(',')[1],'base64'));assert.deepEqual(errors,[]);console.log('PASS offline recognized MusicXML -> native MSCZ -> actual PCM playback and reopen',JSON.stringify(report));
}finally{await fs.writeFile(out+'/playback.json',JSON.stringify({...report,input:path.resolve(input),errors},null,2));await b.close();}
