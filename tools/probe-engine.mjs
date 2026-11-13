import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const messages=[];
let page;
try{
  await fs.mkdir('tests/results',{recursive:true});
  page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});
  page.on('console',m=>{if(/ERROR|WARN|FATAL|Error|qrc:|failed|Cannot/.test(m.text()))messages.push(m.text().slice(0,1000));});
  page.on('pageerror',e=>messages.push('PAGEERROR: '+e.message));
  await page.goto('http://127.0.0.1:5183');
  const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
  await frame.waitForFunction(()=>window.musetabEngine?.ready&&window.musetabEngine?.Module,{},{timeout:45000});
  console.log('READY',await frame.evaluate(()=>({ready:musetabEngine.ready,exports:Object.keys(musetabEngine.Module).filter(k=>k.startsWith('_mt'))})));
  const fileEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入乐谱',exact:true}).click();
  const dir='D:/music/Context/2025/2025 7',file=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz'));
  await(await fileEvent).setFiles(dir+'/'+file);
  await page.waitForTimeout(2500);
  const info=await frame.evaluate(()=>{
    const result=[];
    function scan(root){for(const el of root.querySelectorAll('*')){if(el.tagName==='CANVAS'||el.className?.includes?.('qt-window'))result.push({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,opacity:getComputedStyle(el).opacity});if(el.shadowRoot)scan(el.shadowRoot);}}
    scan(document);return result;
  });
  console.log('WINDOWS',JSON.stringify(info));
  await page.screenshot({path:'tests/results/takeover-initial.png'});
  console.log('VISIBLE TEXT',(await page.locator('body').innerText()).slice(0,900));
  console.log('MESSAGES',JSON.stringify(messages.slice(-24)));
  await fs.writeFile('tests/results/probe-console.json',JSON.stringify(messages,null,2));
}catch(e){
  console.log('MESSAGES',JSON.stringify(messages.slice(-50)));
  if(page){await page.screenshot({path:'tests/results/takeover-failure.png'});console.log('BODY',await page.locator('body').innerText());}
  throw e;
}finally{await fs.writeFile('tests/results/probe-console.json',JSON.stringify(messages,null,2));await browser.close();}
