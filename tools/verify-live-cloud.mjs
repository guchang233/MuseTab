import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/results/reader-fixes';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:800,height:1280},hasTouch:true}),requests=[],errors=[];
page.on('request',request=>{if(request.url().startsWith('https:'))requests.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
await page.route('https://api.github.com/**',route=>route.abort());
try{
  await page.goto('http://127.0.0.1:5183');await page.getByRole('button',{name:'云端曲库 只读',exact:true}).click();
  await page.locator('.cloud-score').first().waitFor({timeout:60000});
  const count=await page.locator('.cloud-score').count();assert(count>=573);
  await page.screenshot({path:out+'/live-cloud-tablet.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/live-cloud-phone.png'});
  await page.getByRole('button',{name:'筛选格式',exact:true}).click();await page.getByRole('button',{name:'MSCZ',exact:true}).click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cloud-score').count(),223);
  await page.locator('.library').evaluate(e=>e.scrollTop=1500);const top=await page.locator('.library').evaluate(e=>e.scrollTop);
  for(const name of ['本地谱匣 0','最近打开','我的']){
    await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'云端曲库 只读',exact:true}).click();
    assert.equal(await page.locator('.cloud-score').count(),223);assert.equal(await page.locator('.library').evaluate(e=>e.scrollTop),top);
  }
  await page.getByRole('button',{name:'筛选格式',exact:true}).click();await page.getByRole('button',{name:'全部',exact:true}).click();await page.keyboard.press('Escape');
  await page.getByRole('searchbox',{name:'搜索曲谱',exact:true}).fill('1');
  const row=page.locator('.cloud-score').filter({has:page.getByRole('heading',{name:'1',exact:true})}).first();
  await row.getByRole('button',{name:'保存到本地 1',exact:true}).click();await row.getByRole('button',{name:'已保存',exact:true}).waitFor({timeout:45000});
  assert.equal(await page.locator('.reader').count(),0);assert(!requests.some(url=>url.includes('api.github.com')));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS live static cloud UI, '+count+' scores, classification and scroll restored across all tabs, download saved locally, zero REST calls');
}finally{await fs.writeFile(out+'/live-cloud.json',JSON.stringify({requests,errors},null,2));await browser.close();}
