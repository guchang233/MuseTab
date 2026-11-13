import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const ext=process.argv[2]||'mid';
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();const messages=[];
page.on('console',m=>messages.push(m.text().slice(0,1500)));
page.on('pageerror',e=>messages.push(e.stack));
try{
  await page.goto('http://127.0.0.1:5183');const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:45000});
  console.log('OPEN',ext);
  await frame.evaluate(async ext=>musetabEngine.open(new Uint8Array(await(await fetch('_test.'+ext)).arrayBuffer()),ext),ext);
  console.log('OPENED');
  const b64=await frame.evaluate(async()=>{const a=await musetabEngine.exportTo('mscz');let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);});
  await fs.writeFile('tests/results/open-only-'+ext+'.mscz',Buffer.from(b64,'base64'));
  await page.setViewportSize({width:800,height:1280});await page.waitForTimeout(200);
  console.log('RESIZED',await frame.evaluate(()=>{
    const result=[];function scan(root){for(const el of root.querySelectorAll('*')){if(el.tagName==='CANVAS')result.push(el.getBoundingClientRect().toJSON());if(el.shadowRoot)scan(el.shadowRoot);}}scan(document);return result;
  }));
}finally{await fs.writeFile('tests/results/open-only-'+ext+'.json',JSON.stringify(messages,null,2));await browser.close();}
