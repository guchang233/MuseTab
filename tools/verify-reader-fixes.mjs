import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {unzipSync}=createRequire(import.meta.url)('../app/node_modules/fflate');
const out='tests/results/reader-fixes';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:800,height:1280},hasTouch:true}),checks=[],errors=[];
page.on('pageerror',e=>{errors.push(e.stack||e.message);console.error('BROWSER',e.stack||e.message);});
const pass=(name,data)=>{checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));};
const snap=name=>page.screenshot({path:out+'/'+name+'.png'});
let frame;
async function swipe(x1,y1,x2,y2){
  const c=await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
  for(let i=1;i<=8;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await page.waitForTimeout(220);
}
async function pinch(factor,w=800,h=1280){
  const c=await page.context().newCDPSession(page),d=80;
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:w/2-d,y:h/2},{id:2,x:w/2+d,y:h/2}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:w/2-d*factor,y:h/2},{id:2,x:w/2+d*factor,y:h/2}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await page.waitForTimeout(250);
}
async function pitches(){
  const bytes=await frame.evaluate(async()=>Array.from(await musetabEngine.exportTo('mscz')));
  const zip=unzipSync(Uint8Array.from(bytes)),x=new TextDecoder().decode(zip[Object.keys(zip).find(n=>n.endsWith('.mscx'))]);
  return [...x.matchAll(/<Note(?:\s[^>]*)?>[\s\S]*?<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);
}
async function style(){return frame.evaluate(()=>musetabEngine.scoreStyle());}
async function more(label){await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();await page.getByRole('dialog').waitFor();}
async function apply(){await page.getByRole('button',{name:'应用并保存',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached',timeout:15000});}
async function full(){await page.getByRole('button',{name:'全屏看谱',exact:true}).click();await page.locator('.reader .page-number').waitFor();await page.waitForTimeout(700);}
async function pageNumber(){return page.locator('.reader .page-number').innerText();}
async function selectFirst(){
  const s=await frame.evaluate(()=>{
    musetabEngine.dispatch('first-element');
    for(let i=0;i<100;i++){musetabEngine.sync();const s=events.findLast(e=>e.name==='selection')?.data;if(s?.type==='Note')return s;musetabEngine.dispatch('next-element');}
  });
  await frame.evaluate(()=>musetabEngine.dispatch('action://notation/cancel'));
  const f=await page.locator('iframe').boundingBox();await page.touchscreen.tap(f.x+s.rect.x+s.rect.w/2,f.y+s.rect.y+s.rect.h/2);await page.waitForTimeout(200);
  assert.equal(await frame.evaluate(()=>events.findLast(e=>e.name==='selection')?.data?.type),'Note');
  await page.getByRole('button',{name:'从这里播放',exact:true}).waitFor();return s;
}
try{
  await page.goto('http://127.0.0.1:5183');frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:60000});
  await frame.evaluate(()=>{window.events=[];musetabEngine.on((name,data)=>events.push({name,data}));});
  const dir='D:/music/Context/2025/2025 7',name=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz'));
  const fc=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();await(await fc).setFiles(dir+'/'+name);
  await page.locator('.reader').waitFor();await page.waitForTimeout(500);
  const before=await selectFirst();await pinch(1.5);const zoomed=await frame.evaluate(()=>events.findLast(e=>e.name==='selection')?.data);assert(zoomed.rect.w>before.rect.w*1.4);
  await swipe(400,640,460,700);const panned=await frame.evaluate(()=>events.findLast(e=>e.name==='selection')?.data);assert(panned.rect.y>zoomed.rect.y+40);
  await frame.evaluate(()=>{musetabEngine.dispatch('action://notation/cancel');musetabEngine.dispatch('zoom-page-width');});
  pass('native non-fullscreen two-finger zoom and one-finger pan');
  await full();assert.match(await pageNumber(),/^1 \/ \d+/);const first=await pageNumber();
  await page.waitForFunction(()=>document.querySelector('.gallery-page')?.complete&&document.querySelector('.gallery-page')?.naturalWidth>1000);
  await snap('tablet-gallery-page1');
  await swipe(650,640,180,640);assert.match(await pageNumber(),/^2 \/ /);await snap('tablet-gallery-page2');
  await swipe(180,640,650,640);assert.equal(await pageNumber(),first);
  const fit=await page.locator('.gallery-page').boundingBox();await pinch(2);assert((await page.locator('.gallery-page').boundingBox()).width>fit.width*1.9);assert.equal(await pageNumber(),first);
  await swipe(400,640,330,590);assert.equal(await pageNumber(),first);await pinch(.25);assert(Math.abs((await page.locator('.gallery-page').boundingBox()).width-fit.width)<1);
  pass('native fullscreen pinch zoom, pan when zoomed, restore whole page and cached complete bitmap');
  await swipe(180,640,650,640);assert.equal(await pageNumber(),first);
  const rect=await page.locator('.page-matte').first().getAttribute('style');
  await swipe(400,800,400,200);await page.mouse.wheel(0,1000);assert.equal(await pageNumber(),first);assert.equal(await page.locator('.page-matte').first().getAttribute('style'),rect);
  const note=await selectFirst();await page.getByRole('button',{name:'从这里播放',exact:true}).click();await page.waitForTimeout(1000);
  const position=await frame.evaluate(()=>events.findLast(e=>e.name==='position')?.data);assert(position.tick>note.tick);await frame.evaluate(()=>musetabEngine.dispatch('stop'));
  pass('native gallery touch swipe, boundaries, vertical/wheel lock and tap-to-play',{pages:first,position});
  await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(600);await snap('landscape-gallery');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await snap('phone-gallery');
  await swipe(320,420,80,420);assert.match(await pageNumber(),/^2 \/ /);pass('phone gallery swipe and rotation');
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.locator('.editor').waitFor();
  const baseline=await style(),original=await pitches();assert.equal(original.length,7687);
  await more('页面设置…');await snap('phone-page-settings');await page.getByRole('button',{name:'横向',exact:true}).click();await apply();
  assert(Math.abs((await style()).width-baseline.height)<.001);assert.deepEqual(await pitches(),original);
  await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await style(),baseline);
  await more('页面设置…');await page.getByRole('spinbutton',{name:'左页边距',exact:true}).fill('999');await page.getByRole('button',{name:'应用并保存',exact:true}).click();await page.getByRole('alert').filter({hasText:'页边距'}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(await style(),baseline);
  pass('mobile page settings apply, single undo, validation, cancel and unchanged notes');
  await frame.evaluate(()=>musetabEngine.dispatch('edit-style'));await page.getByRole('dialog',{name:'谱面样式',exact:true}).waitFor();await snap('phone-style-settings');
  const spacing=baseline.measureSpacing===2?2.1:2;
  await page.getByRole('spinbutton',{name:'小节间距倍率',exact:true}).fill(String(spacing));await apply();assert.equal((await style()).measureSpacing,spacing);assert.equal((await style()).width,baseline.width);assert.deepEqual(await pitches(),original);
  await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await style(),baseline);
  await frame.evaluate(()=>musetabEngine.Module.ccall('mtDispatch',null,['string'],['page-settings']));await page.getByRole('dialog',{name:'页面设置',exact:true}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();
  pass('style settings native-action interception and grouped undo');
  await more('移调…');await page.getByRole('combobox',{name:'目标调号'}).selectOption('0');await apply();const transposed=await pitches();assert.equal(transposed.length,7687);assert.notDeepEqual(transposed,original);await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await pitches(),original);pass('mobile whole-score transpose and undo');
  for(const [w,h] of [[800,1280],[1280,800],[844,390],[360,800]]){
    await page.setViewportSize({width:w,height:h});await more('样式…');
    const b=await page.getByRole('button',{name:'应用并保存',exact:true}).boundingBox();assert(b.y>=0&&b.y+b.height<=h+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await snap(`style-${w}x${h}`);await page.getByRole('button',{name:'取消',exact:true}).click();
  }pass('phone and tablet dialogs keep save/cancel reachable in both orientations');
  assert.deepEqual(errors,[]);pass('zero browser runtime errors');
}catch(e){await snap('failure');throw e;}finally{await fs.writeFile(out+'/native-gallery.json',JSON.stringify({checks,errors},null,2));await browser.close();}
