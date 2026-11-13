import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/results/reader-fixes';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const pass=name=>{checks.push(name);console.log('PASS',name);};
const snap=name=>page.screenshot({path:out+'/'+name+'.png'});
async function touch(points){
  const c=await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points[0]});
  await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points[1]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await page.waitForTimeout(300);
}
async function surface(){return page.locator('.pdf-surface[data-active=true]').boundingBox();}
async function loaded(){await page.waitForFunction(()=>document.querySelector('.pdf-surface[data-active=true].ready canvas')?.width>0&&!document.querySelector('.pdf-reader .status'));await page.waitForTimeout(250);}
try{
  await page.goto('http://127.0.0.1:5183');
  const fc=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();await(await fc).setFiles('tests/results/cloud-ui/score.pdf');await loaded();
  for(const mode of ['horizontal','vertical','continuous']){
    await page.getByRole('combobox',{name:'谱面排版'}).selectOption(mode);await loaded();
    const a=await page.locator('.page-wrapper').nth(0).boundingBox(),b=await page.locator('.page-wrapper').nth(1).boundingBox();
    if(mode==='horizontal')assert(b.x>=a.x+a.width+20);else if(mode==='vertical')assert(b.y>=a.y+a.height+20);else assert(Math.abs(b.y-a.y-a.height)<1);
  }
  await page.getByRole('combobox',{name:'谱面排版'}).selectOption('vertical');await loaded();
  const free=await surface();await touch([[{id:1,x:140,y:250},{id:2,x:240,y:350}],[{id:1,x:100,y:210},{id:2,x:280,y:390}]]);assert((await surface()).width>free.width*1.5);
  const scroll=await page.locator('.pdf-viewport').evaluate(e=>e.scrollTop);await touch([[{x:190,y:500}],[{x:190,y:250}]]);assert((await page.locator('.pdf-viewport').evaluate(e=>e.scrollTop))>scroll+100);
  await page.getByRole('button',{name:/缩放 .*轻点还原/}).click();if(await page.getByRole('button',{name:'上一页',exact:true}).isEnabled())await page.getByRole('button',{name:'上一页',exact:true}).click();await loaded();
  pass('PDF three page layouts, free-mode two-finger zoom and one-finger drag');
  await page.getByRole('button',{name:'批注',exact:true}).click();const b=await surface();await page.mouse.move(b.x+40,b.y+80);await page.mouse.down();await page.mouse.move(b.x+160,b.y+100,{steps:5});await page.mouse.up();await page.locator('.pdf-surface[data-active=true] path').waitFor();await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'全屏看谱',exact:true}).click();await page.locator('.gallery-number').waitFor();await loaded();
  for(const [w,h]of[[390,844],[800,1280],[1280,800],[844,390]]){
    await page.setViewportSize({width:w,height:h});await loaded();const before=await surface();
    assert(before.x>=-.1&&before.y>=-.1&&before.x+before.width<=w+.1&&before.y+before.height<=h+.1);
    assert(Math.abs(before.width/before.height-595/842)<.001);
    await touch([[{x:w*.5,y:h*.7}],[{x:w*.5,y:h*.2}]]);await page.mouse.wheel(0,900);assert.deepEqual(await surface(),before);
    await touch([[{id:1,x:w*.4,y:h*.4},{id:2,x:w*.6,y:h*.6}],[{id:1,x:w*.2,y:h*.2},{id:2,x:w*.8,y:h*.8}]]);assert((await surface()).width>before.width*2);assert.equal(await page.locator('.gallery-number').innerText(),'1 / 2');
    await touch([[{x:w*.5,y:h*.5}],[{x:w*.5+30,y:h*.5+30}]]);assert.equal(await page.locator('.gallery-number').innerText(),'1 / 2');
    await page.mouse.click(w/2,12);await page.getByRole('button',{name:/缩放 .*轻点还原/}).click();await loaded();
    await touch([[{x:w*.8,y:h*.5}],[{x:w*.2,y:h*.5}]]);assert.equal(await page.locator('.gallery-number').innerText(),'2 / 2');assert.equal(await page.locator('.pdf-surface[data-active=true] path').count(),0);
    await snap(`pdf-gallery-${w}x${h}`);
    await touch([[{x:w*.2,y:h*.5}],[{x:w*.8,y:h*.5}]]);assert.equal(await page.locator('.gallery-number').innerText(),'1 / 2');assert.equal(await page.locator('.pdf-surface[data-active=true] path').count(),1);
  }pass('PDF whole page fits phone/tablet in both orientations; swipe pages, pinch zoom, pan when zoomed; page annotations preserved');
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await page.getByRole('button',{name:'返回谱匣',exact:true}).click();await page.reload();await page.locator('.local-score').first().click();await loaded();assert.equal(await page.locator('.pdf-surface[data-active=true] path').count(),1);pass('PDF annotations survive gallery and reopen');
  assert.deepEqual(errors,[]);
}catch(e){await snap('pdf-failure');throw e;}finally{await fs.writeFile(out+'/pdf-gallery.json',JSON.stringify({checks,errors},null,2));await browser.close();}
