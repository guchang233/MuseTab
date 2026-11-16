import {chromium} from '../app/node_modules/@playwright/test/index.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {unzipSync,strFromU8} from '../app/node_modules/fflate/esm/index.mjs';
const out='tests/results/aria-editor';await fs.mkdir(out,{recursive:true});const errors=[],report={};
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack||e.message));let frame;
const pause=()=>page.waitForTimeout(180);
async function score(){const zip=unzipSync(Uint8Array.from(await frame.evaluate(async()=>Array.from(await musetabEngine.exportTo('mscz')))));return strFromU8(Object.entries(zip).find(([name])=>name.endsWith('.mscx'))[1]);}
const pitches=xml=>[...xml.matchAll(/<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);
async function key(pitch){const key=page.locator('.aria-keyboard button[aria-label="钢琴 '+pitch+'"]');await key.waitFor();const r=await key.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height-6);await pause();}
try{
 await page.goto('http://127.0.0.1:5183');frame=page.frames().find(f=>f.url().includes('/engine/host.html'));await frame.waitForFunction(()=>window.musetabEngine?.ready,{},{timeout:90000});
 await page.getByRole('button',{name:'新建乐谱',exact:true}).click();await page.getByRole('textbox',{name:'乐谱标题',exact:true}).fill('Aria editor');await page.getByRole('spinbutton',{name:'小节数',exact:true}).fill('4');await page.getByRole('button',{name:'创建乐谱',exact:true}).click();await page.locator('[data-aria-editor]').waitFor({timeout:60000});await page.locator('.busy-layer').waitFor({state:'hidden'});await pause();
 assert.equal(await page.locator('.menubar').count(),0);assert.equal(await page.locator('[aria-label="解锁编辑"]').count(),0);assert.equal(await page.getByRole('navigation',{name:'编谱工具'}).locator('button').count(),7);
 await key('C4');report.first=pitches(await score());assert.deepEqual(report.first,[60]);assert.equal(await frame.evaluate(()=>musetabEngine.actionState('note-input').checked),false);
 await key('E4');report.replaced=pitches(await score());assert.deepEqual(report.replaced,[64]);await page.getByRole('button',{name:'撤销',exact:true}).click();await pause();assert.deepEqual(pitches(await score()),[60]);
 const scroll=await page.locator('.aria-keyboard').boundingBox();await page.mouse.move(scroll.x+scroll.width*.85,scroll.y+scroll.height-8);await page.mouse.down();await page.mouse.move(scroll.x+scroll.width*.1,scroll.y+scroll.height-8,{steps:14});await page.mouse.up();await pause();
 assert.deepEqual(pitches(await score()),[60]);const scrolled=await page.getByRole('button',{name:'钢琴 C6',exact:true}).boundingBox();assert(scrolled&&scrolled.x>=scroll.x&&scrolled.x+scrolled.width<=scroll.x+scroll.width,'Select keyboard must stay where it was manually scrolled');await key('C6');assert.deepEqual(pitches(await score()),[84]);await page.getByRole('button',{name:'撤销',exact:true}).click();await pause();
 await page.getByRole('navigation',{name:'编谱工具'}).getByRole('button',{name:/音符\s*输入/}).click();await pause();await key('G4');await key('C5');report.entered=pitches(await score());assert(report.entered.includes(67)&&report.entered.includes(72));
 const before=await score(),r=await page.locator('.aria-keyboard').boundingBox();await page.mouse.move(r.x+r.width*.6,r.y+r.height-10);await page.mouse.down();await page.mouse.move(r.x+r.width*.3,r.y+r.height-10,{steps:10});await page.mouse.up();await pause();assert.deepEqual(pitches(await score()),pitches(before),'Dragging keyboard must scroll, not enter notes');
 report.layouts=[];
 for(const [width,height] of [[1280,800],[800,1280],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);const tabs=await page.getByRole('navigation',{name:'编谱工具'}).locator('button').allTextContents();assert.equal(tabs.length,7);const frameBounds=await page.locator('iframe[title="谱面"]').boundingBox();assert(frameBounds.height>=120);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/${width}x${height}-notes.png`});report.layouts.push({width,height,tabs:tabs.map(t=>t.trim()),frame:frameBounds});
 }
 assert.deepEqual(errors,[]);console.log('PASS Aria main editor layout and select/input keyboard semantics',JSON.stringify(report));
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2));await browser.close();}

