import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='tests/results/visible-staves/device';await fs.mkdir(out,{recursive:true});const c=await AndroidCDP.connect(9234),report={};let staff;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const wait=async expression=>{for(let i=0;i<200;i++){if(await c.evaluate(expression))return;await sleep(300);}throw Error('Timed out '+expression);};
try{
 await wait('!!document.querySelector(".local-score")');await c.evaluate('[...document.querySelectorAll(".local-score")].find(e=>e.textContent.includes("Frieren")).click()');await wait('!!document.querySelector(".reader")');await c.evaluate('document.querySelector(".reading-header .edit").click()');await wait('!!document.querySelector(".editor")');
 report.before=await c.evaluate('musetabEngine.scorePanels()',true);staff=report.before.parts[0].staves[0];assert(staff.visible,'expected treble visible before test');
 await c.evaluate(`window.staffEvents=[];musetabEngine.on((name,data)=>staffEvents.push({name,data}));musetabEngine.dispatch('first-element');for(let i=0;i<100;i++){musetabEngine.sync();if(staffEvents.findLast(e=>e.name==='selection')?.data?.type==='Note')break;musetabEngine.dispatch('next-element');}musetabEngine.changeParts({op:'staff-visible',id:${JSON.stringify(staff.id)},visible:false});musetabEngine.dispatch('rewind');`,true);
 await c.evaluate('document.querySelector("[aria-label=播放]").click()');await sleep(4000);report.hidden=await c.evaluate('({position:staffEvents.findLast(e=>e.name==="position")?.data,playing:staffEvents.findLast(e=>e.name==="playing")?.data,panels:musetabEngine.scorePanels(),backend:musetabEngine.Module.audioBackend})',true);assert(report.hidden.playing.playing);assert(report.hidden.position.secs>3);assert.equal(report.hidden.panels.parts[0].staves[0].visible,false);await c.screenshot(out+'/bass-only-playing.png');
 await c.evaluate('musetabEngine.dispatch("stop");musetabEngine.dispatch("undo")',true);await sleep(500);assert((await c.evaluate('musetabEngine.scorePanels()',true)).parts[0].staves[0].visible);
 await c.evaluate('document.querySelector("[aria-label=播放]").click()');await sleep(2500);report.restored=await c.evaluate('staffEvents.findLast(e=>e.name==="position")?.data',true);assert(report.restored.secs>2);await c.evaluate('musetabEngine.dispatch("stop")',true);await sleep(2400);
 console.log('PASS real tablet original MSCZ: selected treble hidden, bass-only playback advances, undo restores staff and playback',JSON.stringify(report.hidden.position));
}finally{
 try{if(staff){const current=await c.evaluate('musetabEngine.scorePanels()',true);if(!current.parts[0].staves[0].visible)await c.evaluate('musetabEngine.dispatch("stop");musetabEngine.dispatch("undo")',true);}}catch{}
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));c.close();
}
