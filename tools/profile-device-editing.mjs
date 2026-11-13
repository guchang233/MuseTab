import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';
const c=await AndroidCDP.connect(9234),phase=process.argv[2]||'after',out='tests/results/performance';await fs.mkdir(out,{recursive:true});
try{
 if(await c.evaluate('!!document.querySelector(".library")')){
   await c.evaluate('[...document.querySelectorAll(".local-score")].find(e=>e.textContent.includes("Frieren")).click()');
   for(let i=0;i<200;i++){if(await c.evaluate('!!document.querySelector(".reader")'))break;await new Promise(r=>setTimeout(r,250));}
 }
 await c.evaluate('(()=>{const e=document.querySelector(".reading-header .edit");if(e)e.click();})()');await new Promise(r=>setTimeout(r,800));
 if(!await c.evaluate('!!document.querySelector(".editor")'))throw Error('Open the actual editor before profiling');
 if(process.env.MUSETAB_CANVAS_RATIO){
   await c.evaluate('Object.defineProperty(window,"devicePixelRatio",{get:()=>'+Number(process.env.MUSETAB_CANVAS_RATIO)+',configurable:true});true',true);
   await c.evaluate('document.querySelector("iframe").style.width="calc(100% - 1px)"');await new Promise(r=>setTimeout(r,250));await c.evaluate('document.querySelector("iframe").style.width="100%"');await new Promise(r=>setTimeout(r,400));
 }
 console.log('SCREEN',await c.evaluate('document.body.innerText.slice(0,250)'));
 await c.evaluate(`window.editSelections=[];musetabEngine.on((name,data)=>{if(name==='selection')editSelections.push(data);});musetabEngine.dispatch('first-element');for(let i=0;i<100;i++){musetabEngine.sync();if(editSelections.at(-1)?.type==='Note')break;musetabEngine.dispatch('next-element');}`,true);
 const times=[];
 for(let i=0;i<6;i++){
   times.push(await c.evaluate(`(async()=>{const t=performance.now();musetabEngine.dispatch('pitch-up');musetabEngine.dispatch('pitch-down');const native=performance.now()-t;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return{native,frame:performance.now()-t};})()`,true));
   await new Promise(r=>setTimeout(r,120));
 }
 const result={phase,times,ratio:await c.evaluate('devicePixelRatio',true),viewport:await c.evaluate('({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})')};
 await fs.writeFile(out+'/device-editing-'+phase+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await new Promise(r=>setTimeout(r,2300));
}finally{c.close();}
