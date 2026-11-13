import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/results/zerafun-home';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const pass=name=>{checks.push(name);console.log('PASS',name);};
const snap=name=>page.screenshot({path:out+'/'+name+'.png'});
try{
  await page.goto('http://127.0.0.1:5183');
  const dir='D:/music/Context/2025/2025 7',names=await fs.readdir(dir);
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();
  await(await chooser).setFiles([dir+'/'+names.find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz')),dir+'/'+names.find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mid')),'tests/results/cloud-ui/score.pdf']);
  await page.locator('.local-score').nth(2).waitFor();
  await page.getByRole('button',{name:'最近打开',exact:true}).click();await page.getByRole('heading',{name:'还没有打开过乐谱',exact:true}).waitFor();
  await page.getByRole('button',{name:'本地谱匣 3',exact:true}).click();
  await page.getByRole('button',{name:'筛选格式',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'MIDI',exact:true}).click();assert.equal(await page.locator('.local-score').count(),1);
  assert.equal(await page.evaluate(()=>window.onNativeBack()),true);assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'筛选格式',exact:true}).click();await page.getByRole('button',{name:'全部',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('.local-score').count(),3);
  pass('source SearchBar popup filters files; Escape and native Back close the popup');
  await page.getByRole('searchbox',{name:'搜索曲谱',exact:true}).fill('芙莉莲');assert.equal(await page.locator('.local-score').count(),2);
  await page.getByRole('button',{name:'清空搜索曲谱',exact:true}).click();assert.equal(await page.locator('.local-score').count(),3);
  await page.locator('.local-score').filter({hasText:'score'}).click();await page.locator('.pdf-surface canvas').waitFor();await page.getByRole('button',{name:'返回谱匣',exact:true}).click();
  assert.equal(await page.locator('.continue').count(),1);
  await page.getByRole('button',{name:'最近打开',exact:true}).click();assert.equal(await page.locator('.local-score').count(),1);
  pass('search works with original filenames; recent tab contains opened files only');
  await page.getByRole('button',{name:'本地谱匣 3',exact:true}).click();
  for(const [name,w,h]of[['phone',390,844],['phone-small',360,800],['phone-landscape',844,390],['tablet-portrait',800,1280],['tablet-landscape',1280,800]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(250);
    const state=await page.evaluate(()=>{const header=document.querySelector('.browse-header').getBoundingClientRect(),bar=document.querySelector('.app-tabbar').getBoundingClientRect();return{w:innerWidth,h:innerHeight,header:header.toJSON(),bar:bar.toJSON(),overflow:document.querySelector('.library').scrollWidth>innerWidth,nav:[...document.querySelectorAll('.app-tabbar button')].map(e=>e.getBoundingClientRect().toJSON())};});
    assert(!state.overflow);assert.equal(state.bar.bottom,h);assert(state.nav.every(r=>r.width>=44&&r.height>=44));assert(state.header.right<=w);
    await snap(name);
  }
  pass('source PhoneChrome stays at the bottom across five phone/tablet viewports');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'我的',exact:true}).click();await page.getByRole('radio',{name:'深色',exact:true}).click();await snap('phone-settings-dark');
  await page.getByRole('button',{name:'本地谱匣 3',exact:true}).click();
  assert.equal(await page.locator('.library').evaluate(e=>getComputedStyle(e).getPropertyValue('--c-paper').trim()),'#2a2622');
  await snap('phone-dark');
  await page.getByRole('button',{name:'我的',exact:true}).click();await page.getByRole('radio',{name:'浅色',exact:true}).click();
  await page.getByRole('button',{name:'本地谱匣 3',exact:true}).click();
  await page.getByRole('button',{name:'筛选格式',exact:true}).click();await snap('phone-source-filter');
  pass('original ZeraFun light/dark theme tokens and settings work');
  assert.equal(errors.length,0,errors.join('\n'));
}finally{await snap('last-state').catch(()=>{});await fs.writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
