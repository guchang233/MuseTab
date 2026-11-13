import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();p.on('console',m=>console.log(m.text().slice(0,500)));p.on('pageerror',e=>console.log('ERROR',e.message));
try{await p.goto('http://127.0.0.1:5183');const f=p.frames().find(f=>f.url().includes('/engine/host.html'));await f.waitForFunction(()=>musetabEngine?.ready,{},{timeout:60000});
await f.waitForFunction(()=>!!musetabEngine.Module.worker,{},{timeout:15000});
await f.evaluate(()=>{musetabEngine.Module.worker.addEventListener('message',e=>console.log('workerEvent',JSON.stringify(e.data)));musetabEngine.startAudio().catch(e=>console.error(e));});
await p.waitForTimeout(5000);console.log('STATE',await f.evaluate(()=>({d:musetabEngine.Module.driver.inited,sf:musetabEngine.Module.driver.soundFontReady,failed:musetabEngine.Module.driver.soundFontFailed,resources:musetabEngine.Module.audioResourcesReady,stats:musetabEngine.Module.driver.diagnostics})));}
finally{await b.close();}
