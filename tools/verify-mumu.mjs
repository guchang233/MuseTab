import { AndroidCDP } from './android-cdp.mjs';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile),adb=process.env.MUSETAB_ADB||'D:/MuMu/nx_main/adb.exe',serial=process.env.MUSETAB_DEVICE||'127.0.0.1:16480';
const out='tests/results/cloud-ui',checks=[];
const shell=(...args)=>run(adb,['-s',serial,'shell',...args],{timeout:15000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let c;
let webOffset={x:0,y:24};
async function connect(){for(let i=0;i<25;i++){try{return await AndroidCDP.connect(9223);}catch{await sleep(400);}}throw Error('WebView unavailable');}
async function wait(expression,timeout=60000){const start=Date.now();while(Date.now()-start<timeout){try{if(await c.evaluate(expression))return;}catch{}await sleep(250);}throw Error('Timed out: '+expression);}
const pass=(name,data)=>{checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));};
async function bounds(selector){return c.evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("Missing control");const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,dpr:devicePixelRatio};})()');}
async function tap(selector){
  const b=await bounds(selector);
  await shell('uiautomator','dump','/sdcard/musetab-test-ui.xml').catch(e=>{if(!e.stdout?.includes('dumped to:'))throw e;});
  const xml=(await shell('cat','/sdcard/musetab-test-ui.xml')).stdout;
  const node=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*>/)?.[0];
  const box=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  webOffset={x:box?+box[1]:0,y:box?+box[2]:24};
  const x=webOffset.x+(b.x+b.w/2)*b.dpr,y=webOffset.y+(b.y+b.h/2)*b.dpr;
  await shell('input','tap',String(Math.round(x)),String(Math.round(y)));await sleep(300);
}
async function importFile(name,bytes){await c.evaluate('window.onNativeOpen('+JSON.stringify(name)+','+JSON.stringify(bytes.toString('base64'))+')');}
async function resolution(w,h,density){await shell('wm','size',w+'x'+h);await shell('wm','density',String(density));await shell('settings','put','system','accelerometer_rotation','0');await shell('cmd','window','user-rotation','lock','0');await sleep(2400);}
try{
  c=await connect();
  if(process.argv.includes('offline')) { await offlineCheck(); }
  else {
  if(!await c.evaluate('!!document.querySelector(".library")')) {await c.evaluate('location.hash="/library"');await wait('!!document.querySelector(".library")');}
  const network=await c.evaluate("fetch('https://api.github.com/repos/guchang233/muse-repo').then(async r=>({status:r.status,body:(await r.text()).slice(0,500)}))");
  assert(network.status===200||network.body.includes('API rate limit'));
  pass('Android HTTPS GitHub data requests reach the actual server',network);
  await resolution(1200,1920,240);
  await c.screenshot(out+'/mumu-tablet-home.png');
  await importFile('离线练习谱.pdf',await fs.readFile(out+'/score.pdf'));
  await wait('document.querySelector(".pdf-surface canvas")?.width>0&&!document.querySelector(".pdf-reader .status")');
  await tap('.reading-header .edit');
  const b=await bounds('.pdf-surface');
  await shell('input','swipe',String(Math.round((b.x+60)*b.dpr+webOffset.x)),String(Math.round((b.y+120)*b.dpr+webOffset.y)),String(Math.round((b.x+200)*b.dpr+webOffset.x)),String(Math.round((b.y+170)*b.dpr+webOffset.y)),'400');
  await wait('document.querySelectorAll(".pdf-surface path").length===1');
  await wait('document.querySelector(".ink-tools small")?.textContent==="批注已存本地"');
  await c.screenshot(out+'/mumu-tablet-pdf-annotation.png');
  await tap('.ink-tools .done');await tap('[aria-label="全屏看谱"]');
  await wait('!!document.querySelector(".exit")&&!document.querySelector(".reading-header")');
  await sleep(1200);await c.screenshot(out+'/mumu-tablet-pdf-fullscreen.png');
  await shell('input','keyevent','4');await wait('!!document.querySelector(".reading-header")');
  pass('Android touch ink, native immersive fullscreen, and Back exits fullscreen');
  await tap('[aria-label="返回谱匣"]');
  const dir='D:/music/Context/2025/2025 7',names=await fs.readdir(dir);
  await wait('!!document.querySelector("iframe")');
  for(let i=0;i<180;i++){if(await c.evaluate('!!window.musetabEngine?.ready',true))break;await sleep(300);}
  await importFile('Frieren.mscz',await fs.readFile(dir+'/'+names.find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz'))));
  await wait('!!document.querySelector(".reader")');await sleep(600);
  await c.screenshot(out+'/mumu-tablet-reader.png');
  await tap('[aria-label="全屏看谱"]');await sleep(900);await c.screenshot(out+'/mumu-tablet-reader-fullscreen.png');
  assert.equal(await c.evaluate('document.querySelector("iframe").getBoundingClientRect().top'),0);
  await shell('input','keyevent','4');await wait('!!document.querySelector(".reading-header")');
  await tap('.reading-header .edit');await wait('!!document.querySelector(".editor")');
  await c.screenshot(out+'/mumu-tablet-editor.png');
  await resolution(1080,2400,480);await c.screenshot(out+'/mumu-phone-editor.png');
  const layout=await c.evaluate('({w:innerWidth,h:innerHeight,top:document.querySelector(".topbar").getBoundingClientRect().toJSON(),frame:document.querySelector("iframe").getBoundingClientRect().toJSON(),bottom:document.querySelector(".thumb").getBoundingClientRect().toJSON()})');
  assert(layout.frame.y>=layout.top.bottom-1);assert(layout.frame.bottom<=layout.bottom.y+1);
  assert(await c.evaluate('[...document.querySelectorAll(".topbar button")].every(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.height>=44})'));
  pass('MuMu tablet and phone editor bounds',layout);
  await tap('.topbar [aria-label="返回谱匣"]');
  await offlineCheck();
  }
  assert.equal(c.errors.length,0,c.errors.join('\n'));
}finally{
  await fs.writeFile(out+'/mumu-report'+(process.argv.includes('offline')?'-offline':'')+'.json',JSON.stringify({checks,errors:c?.errors||[]},null,2));
  await run('D:/MuMu/nx_main/mumu-cli.exe',['sh','-v','3','-c','cmd connectivity airplane-mode disable'],{timeout:15000}).catch(()=>{});
  await run(adb,['disconnect',serial],{timeout:5000}).catch(()=>{});
  await run(adb,['connect',serial],{timeout:5000}).catch(()=>{});
  c?.close();
}
async function offlineCheck(){
  // MuMu disconnects ADB in airplane mode. Keep the transport available and
  // emulate a fully offline WebView after restarting the packaged application.
  c.close();
  await shell('am','force-stop','org.musetab.app');await shell('am','start','-n','org.musetab.app/.MainActivity');await sleep(1500);c=await connect();
  await wait('!!document.querySelector(".local-score")');
  await c.call('Network.enable');
  await c.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert(await c.evaluate("fetch('https://api.github.com/repos/guchang233/muse-repo').then(()=>false,()=>true)"));
  await c.evaluate('[...document.querySelectorAll(".local-score")].find(e=>e.textContent.includes("离线练习谱")).click()');
  await wait('!!document.querySelector(".pdf-surface path")');
  assert.equal(await c.evaluate('document.querySelectorAll(".pdf-reader .error").length'),0);
  await c.screenshot(out+'/mumu-phone-offline-pdf.png');
  pass('packaged PDF worker, fonts, file and handwriting open offline after process restart; remote fetch fails');
  await c.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
}
