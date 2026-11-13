import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';
const c=await AndroidCDP.connect(9234);try{
 await c.call('Profiler.enable');await c.call('Profiler.setSamplingInterval',{interval:500});await c.call('Profiler.start');
 for(let i=0;i<8;i++){await c.evaluate('(async()=>{musetabEngine.dispatch("pitch-up");musetabEngine.dispatch("pitch-down");await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);})()',true);}
 const {profile}=await c.call('Profiler.stop');await fs.writeFile('tests/results/performance/device.cpuprofile',JSON.stringify(profile));
 const symbols=new Map((await fs.readFile('D:/b/ms/build.artifacts/MuseScoreStudio.js.symbols','utf8')).split('\n').map(line=>{const pos=line.indexOf(':');return[line.slice(0,pos),line.slice(pos+1).replace(/\\([0-9a-f]{2})/gi,(_,n)=>String.fromCharCode(parseInt(n,16)))];}));
 const times=new Map();for(let i=0;i<profile.samples.length;i++)times.set(profile.samples[i],(times.get(profile.samples[i])||0)+profile.timeDeltas[i]/1000);
 const top=profile.nodes.map(n=>{const name=n.callFrame.functionName,id=name.match(/(?:func|function\[)(\d+)/)?.[1];return{ms:times.get(n.id)||0,name:id?symbols.get(id)||name:name,url:n.callFrame.url};}).sort((a,b)=>b.ms-a.ms).slice(0,30);
 console.log(JSON.stringify(top,null,2));await fs.writeFile('tests/results/performance/device-cpu-top.json',JSON.stringify(top,null,2));
}finally{await c.call('Profiler.disable');c.close();}
