import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile),adb=process.env.MUSETAB_ADB||'D:/MuMu/nx_main/adb.exe',device=process.env.MUSETAB_DEVICE||'127.0.0.1:16480',out='tests/results/zerafun-home';
const shell=(...args)=>run(adb,['-s',device,'shell',...args],{timeout:15000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const checks=[];let c;
async function wait(expression){for(let i=0;i<120;i++){if(await c.evaluate(expression))return;await sleep(250);}throw Error('Timed out: '+expression);}
async function tap(selector){
  await shell('uiautomator','dump','/sdcard/musetab-test-ui.xml').catch(e=>{if(!e.stdout?.includes('dumped to:'))throw e;});
  const xml=(await shell('cat','/sdcard/musetab-test-ui.xml')).stdout,node=xml.match(/<node[^>]*class="android.webkit.WebView"[^>]*>/)[0],origin=node.match(/bounds="\[(\d+),(\d+)\]/);
  const point=await c.evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:(r.x+r.width/2)*devicePixelRatio,y:(r.y+r.height/2)*devicePixelRatio};})()');
  await shell('input','tap',String(Math.round(point.x+Number(origin[1]))),String(Math.round(point.y+Number(origin[2]))));await sleep(250);
}
async function size(w,h,dpi){await shell('wm','size',w+'x'+h);await shell('wm','density',String(dpi));await shell('settings','put','system','accelerometer_rotation','0');await shell('cmd','window','user-rotation','lock','0');await sleep(2000);}
const pass=name=>{checks.push(name);console.log('PASS',name);};
try{
  await size(1080,2400,480);await shell('am','start','-n','org.musetab.app/.MainActivity');
  for(let i=0;i<20;i++){try{c=await AndroidCDP.connect();break;}catch{await sleep(300);}}
  assert(c);await c.evaluate('location.hash="/library"');await wait('!!document.querySelector(".zf-app")');
  const count=await c.evaluate('document.querySelectorAll(".local-score").length');assert(count>0,'upgrade preserves saved library');
  await c.screenshot(out+'/mumu-phone.png');
  await tap('[aria-label="筛选格式"]');await wait('!!document.querySelector(".search-filters")');
  await shell('input','keyevent','4');await wait('!document.querySelector(".search-filters")');
  pass('real Android touch opens source filter; Back dismisses it without exiting');
  await tap('.app-tabbar button:nth-child(4)');await wait('!!document.querySelector(".theme-options")');
  await tap('.theme-options button:nth-child(3)');
  assert.equal(await c.evaluate('getComputedStyle(document.querySelector(".library")).getPropertyValue("--c-paper").trim()'),await c.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--parchment").trim()'));
  await c.screenshot(out+'/mumu-phone-dark.png');
  await tap('.theme-options button:nth-child(2)');
  await shell('input','keyevent','4');await wait('document.querySelector(".browse-heading h1")?.textContent==="我的乐谱"');
  pass('theme tokens update Android system bars; Back from My returns to library');
  await c.screenshot(out+'/mumu-phone.png');
  await size(1200,1920,240);await c.screenshot(out+'/mumu-tablet.png');
  const dimensions=await c.evaluate('({w:innerWidth,h:innerHeight,nav:document.querySelector(".app-tabbar").getBoundingClientRect().toJSON(),scroll:document.querySelector(".library").scrollWidth})');
  assert.equal(dimensions.scroll,dimensions.w);assert(Math.abs(dimensions.nav.bottom-dimensions.h)<1);
  pass('packaged source layout fits Android phone and tablet; local files survive upgrade');
  assert.equal(c.errors.length,0);
}finally{await fs.writeFile(out+'/mumu-report.json',JSON.stringify({checks,errors:c?.errors||[]},null,2));c?.close();}
