import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='tests/results/aria-panels';await fs.mkdir(out,{recursive:true});const errors=[],report=[];
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});page.on('pageerror',e=>errors.push(e.stack||e.message));let frame;
async function settle(){await page.waitForTimeout(220);await page.locator('.aria-edit-busy').waitFor({state:'hidden'});}
async function category(name){await page.getByRole('navigation',{name:'编谱工具'}).getByRole('button',{name,exact:true}).click();await settle();}
async function back(){await page.evaluate(()=>onNativeBack());await settle();}
async function capture(name,width,height){await page.screenshot({path:`${out}/${width}x${height}-${name}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Window must not overflow');const english=await page.locator('[data-aria-editor]').evaluate(root=>{
 const expressions=/\b(?:Undo|Redo|Cancel|Apply|Save|Close|Metronome|Practice|Margins|Visibility|instruments|Select Similar|Change Clef|File name|Sharing)\b/;
 return [...root.querySelectorAll('button,input,select,h2,strong,small,label,legend')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0).map(el=>(el.textContent||'').trim()+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')).filter(v=>expressions.test(v));
 });assert.deepEqual(english,[],name+' must use Chinese copy');report.push({width,height,state:name});}
try{
 await page.goto('http://127.0.0.1:5183');frame=page.frames().find(f=>f.url().includes('/engine/host.html'));await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:90000});await page.getByRole('button',{name:'新建乐谱',exact:true}).click();await page.getByRole('textbox',{name:'乐谱标题',exact:true}).fill('界面验收');await page.getByRole('spinbutton',{name:'小节数',exact:true}).fill('4');await page.getByRole('button',{name:'创建乐谱',exact:true}).click();await page.locator('[data-aria-editor]').waitFor({timeout:60000});await page.locator('.busy-layer').waitFor({state:'hidden'});await settle();
 const key=await page.getByRole('button',{name:'钢琴 C4',exact:true}).boundingBox();await page.mouse.click(key.x+key.width/2,key.y+key.height-5);await settle();
 for(const [width,height] of [[1280,800],[800,1280],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(450);
  for(const tab of ['选择','反复','文本','表情','排版','更多']){await category(tab);await capture(tab,width,height);}
  for(const [tab,label] of [['更多','乐谱信息'],['更多','整曲移调'],['更多','调号'],['更多','拍号'],['更多','速度'],['更多','设置弱起'],['更多','更改谱号'],['更多','增删乐器'],['排版','页面设置'],['排版','自动换行'],['排版','乐器排列']]){
   await category(tab);await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog').waitFor();await settle();await capture(label,width,height);await back();assert.equal(await page.getByRole('dialog').count(),0,label+' must close one layer');
  }
  for(const label of ['混音器','播放与练习','导出乐谱']){await page.locator('.aria-chrome').getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog').waitFor();await settle();await capture(label,width,height);await back();}
  await category('文本');await page.getByRole('button',{name:'和弦符号',exact:true}).first().click();await settle();await capture('和弦',width,height);await page.getByRole('button',{name:'返回文本工具',exact:true}).click();await settle();await page.getByRole('button',{name:'指法',exact:true}).first().click();await settle();await capture('指法',width,height);await back();
 }
 assert.deepEqual(errors,[]);console.log('PASS Chinese Aria categories, panels, subtools and back navigation',report.length,'states');
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await fs.writeFile(out+'/report.json',JSON.stringify({states:report,errors},null,2));await browser.close();}
