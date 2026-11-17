/**
 * Prove the library catalogue title cannot move when the list scrolls or overscrolls.
 * Fails if getBoundingClientRect().top of 「云端曲库」/「我的乐谱」 changes by >0.5px.
 */
import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.MUSETAB_URL||'http://127.0.0.1:5184';
const out='tests/results/library-header-fixed';
await fs.mkdir(out,{recursive:true});

const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'云端曲库 只读'}).click();
  const title=page.locator('.library-top .browse-heading h1');
  await title.waitFor({timeout:15000});
  assert.equal((await title.textContent())?.trim(),'云端曲库');
  const scroller=page.locator('.library-scroll');
  assert.ok(await page.locator('.library-top').count(),'library-top must exist');
  assert.ok(await scroller.count(),'library-scroll must exist');

  const top0=await title.evaluate(el=>el.getBoundingClientRect().top);
  await page.screenshot({path:`${out}/before.png`});

  await scroller.evaluate(el=>{el.scrollTop=Math.min(el.scrollHeight,1200);});
  await page.waitForTimeout(200);
  const top1=await title.evaluate(el=>el.getBoundingClientRect().top);
  const scroll1=await scroller.evaluate(el=>el.scrollTop);
  await page.screenshot({path:`${out}/after-scroll.png`});

  // Overscroll past the end: keep pushing.
  await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.waitForTimeout(50);
  for(let i=0;i<8;i++){
    await scroller.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true})));
    await page.mouse.wheel(0,180);
    await page.waitForTimeout(40);
  }
  const top2=await title.evaluate(el=>el.getBoundingClientRect().top);
  await page.screenshot({path:`${out}/after-overscroll.png`});

  const report={top0,top1,top2,scroll1,deltaScroll:Math.abs(top1-top0),deltaOverscroll:Math.abs(top2-top0)};
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log('REPORT',JSON.stringify(report));
  assert.ok(scroll1>10,'list must have scrolled');
  assert.ok(report.deltaScroll<=0.5,`title moved on scroll: ${top0} -> ${top1}`);
  assert.ok(report.deltaOverscroll<=0.5,`title moved on overscroll: ${top0} -> ${top2}`);
  console.log('PASS library header stays fixed through scroll and overscroll');
}finally{
  await browser.close();
}
