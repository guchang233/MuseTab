import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from '../app/node_modules/fflate/esm/index.mjs';
import assert from 'node:assert/strict';
const out='tests/results/touch-composer';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});
const errors=[],report={};let frame;
page.on('pageerror',e=>errors.push(e.message));
async function settle(){await page.waitForTimeout(180);await page.locator('.composer-busy').waitFor({state:'hidden',timeout:15000});}
async function score(){const entries=unzipSync(Uint8Array.from(await frame.evaluate(async()=>Array.from(await musetabEngine.exportTo('mscz')))));return strFromU8(Object.entries(entries).find(([name])=>name.endsWith('.mscx'))[1]);}
const pitches=xml=>[...xml.matchAll(/<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);
async function category(name){await page.getByRole('navigation',{name:'编谱工具分类'}).getByRole('button',{name,exact:true}).click();await settle();}
async function selectFirst(notes=false){
 const selection=await frame.evaluate(notes=>{
  musetabEngine.dispatch('first-element');
  for(let i=0;i<80;i++){
   musetabEngine.sync();const s=musetabEngine.lastSelection;
   if(s?.type==='Note'||(!notes&&s?.type==='Rest'))return s;
   musetabEngine.dispatch('next-element');
  }
  throw Error('No note/rest selection found');
 },notes);
 const bounds=await page.locator('iframe[title="谱面"]').boundingBox(),r=selection.rect;
 await page.mouse.click(bounds.x+r.x+r.w/2,bounds.y+r.y+r.h/2);
 assert.equal(await frame.evaluate(()=>musetabEngine.lastSelection?.type),selection.type);
}
try{
 await page.goto('http://127.0.0.1:5183');frame=page.frames().find(f=>f.url().includes('/engine/host.html'));
 await frame.waitForFunction(()=>window.musetabEngine?.ready,{},{timeout:90000});
 await page.getByRole('button',{name:'新建乐谱',exact:true}).click();
 await page.getByRole('textbox',{name:'乐谱标题',exact:true}).fill('触屏编谱测试');
 await page.getByRole('spinbutton',{name:'小节数',exact:true}).fill('4');
 await page.getByRole('button',{name:'创建乐谱',exact:true}).click();
 await page.locator('.composer-deck').waitFor({timeout:60000});await page.locator('.busy-layer').waitFor({state:'hidden'});await settle();
 if(!process.argv.includes('--layout-only')){
 await category('音符');
 await page.getByRole('button',{name:'输入 C4',exact:true}).click();await page.getByRole('alertdialog',{name:'解锁编辑？'}).waitFor();
 assert.deepEqual(pitches(await score()),[]);await page.getByRole('button',{name:'保持锁定',exact:true}).click();
 await page.getByRole('button',{name:'解锁编辑',exact:true}).click();await selectFirst();
 for(const name of ['C4','E4','G4','C5']){await page.getByRole('button',{name:'输入 '+name,exact:true}).click();await settle();}
 const initialScore=await score();report.pitches=pitches(initialScore);assert.deepEqual(report.pitches,[60,64,67,72]);assert(!initialScore.includes('<Accidental>'),'C major white keys must not create redundant naturals');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await settle();assert.equal(pitches(await score()).length,3);
 await page.getByRole('button',{name:'重做',exact:true}).click();await settle();assert.equal(pitches(await score()).length,4);
 await category('歌词');await selectFirst(true);
 await page.locator('.context-tools').getByRole('button',{name:'添加歌词',exact:true}).click();
 await page.getByRole('textbox',{name:'文本内容',exact:true}).fill('测试歌词');
 await page.getByRole('button',{name:'写入乐谱',exact:true}).click();await settle();
 report.lyrics=(await score()).includes('测试歌词');assert(report.lyrics);
 await category('选择');await page.getByRole('button',{name:'修改选中文字',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'文本内容',exact:true}).inputValue(),'测试歌词');
 await page.getByRole('textbox',{name:'文本内容',exact:true}).fill('修改歌词');await page.getByRole('button',{name:'写入乐谱',exact:true}).click();await settle();report.editedLyrics=(await score()).includes('修改歌词');assert(report.editedLyrics);
 await category('选择');await selectFirst(true);
 await page.locator('.context-tools').getByRole('button',{name:'符号库',exact:true}).click();
 await page.getByRole('navigation',{name:'符号分类'}).getByRole('button',{name:/力度/}).click();
 await page.locator('.cells button').first().waitFor();await page.locator('.cells button').first().click();await settle();
 assert.equal(await page.getByRole('dialog',{name:'符号库'}).count(),0);
 report.dynamic=(await score()).includes('<Dynamic>');assert(report.dynamic);
 await category('更多');await page.getByRole('button',{name:'全部编谱命令',exact:true}).click();
 await page.getByRole('dialog',{name:'全部编谱命令',exact:true}).waitFor();
 report.actionCount=await page.locator('.command-list button').count();assert(report.actionCount>100);
 await page.getByRole('dialog',{name:'全部编谱命令',exact:true}).getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'格式',exact:true}).click();await page.getByRole('menuitem',{name:'页面设置',exact:true}).click();await settle();
 report.nativeDialog=await frame.evaluate(()=>musetabEngine.composerState().modalOpen);assert(report.nativeDialog);
 await page.evaluate(()=>onNativeBack());await settle();assert(!await frame.evaluate(()=>musetabEngine.composerState().modalOpen));
 report.panels=[];
 for(const [name,type] of [['属性面板','InspectorForm'],['声部面板','LayoutPanel'],['混音器','MixerPanel']]){
  await page.getByRole('button',{name:'视图',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();await page.locator('.busy-layer').waitFor({state:'hidden'});await settle();
  const state=await frame.evaluate(()=>musetabEngine.composerState({inspect:true}));assert(state.controls.some(c=>c.type.startsWith(type)&&c.w>0&&c.h>0));
  const close=state.controls.find(c=>c.name===(type==='MixerPanel'?'mt-bottom-close':'mt-side-close'));assert(close);const rect=await page.locator('iframe[title="谱面"]').boundingBox();await page.mouse.click(rect.x+close.x+close.w/2,rect.y+close.y+close.h/2);await settle();assert.equal(await frame.evaluate(()=>musetabEngine.composerState().panel),'');report.panels.push(type);
 }
 await page.getByRole('button',{name:'保存',exact:true}).click();await settle();
 await fs.writeFile(out+'/edited.mscx',await score());
 await page.getByRole('button',{name:'文件',exact:true}).click();await page.getByRole('menuitem',{name:'新建乐谱',exact:true}).click();
 await page.getByRole('textbox',{name:'乐谱标题',exact:true}).fill('调号键盘检查');await page.getByRole('combobox',{name:'调号',exact:true}).selectOption('1');await page.getByRole('spinbutton',{name:'小节数',exact:true}).fill('2');await page.getByRole('button',{name:'创建乐谱',exact:true}).click();await page.locator('.create-layer').waitFor({state:'hidden'});await settle();
 await page.getByRole('button',{name:'解锁编辑',exact:true}).click();await category('音符');await selectFirst();
 for(const name of ['F4','F♯4','G4']){await page.getByRole('button',{name:'输入 '+name,exact:true}).click();await settle();}
 const keyedScore=await score();report.keyedPitches=pitches(keyedScore);assert.deepEqual(report.keyedPitches,[65,66,67]);assert.equal((keyedScore.match(/<Accidental>/g)||[]).length,2);
 await page.getByRole('button',{name:'声部 2',exact:true}).click();await settle();
 await page.getByRole('button',{name:'八分音符',exact:true}).click();await settle();
 await page.getByRole('button',{name:'附点',exact:true}).click();await settle();
 await page.getByRole('button',{name:'输入 C4',exact:true}).click();await settle();
 await page.getByRole('button',{name:'叠加和弦',exact:true}).click();
 await page.getByRole('button',{name:'输入 E4',exact:true}).click();await settle();
 const polyphonic=await score(),chords=[...polyphonic.matchAll(/<Chord[ >][\s\S]*?<\/Chord>/g)].map(m=>m[0]);
 report.dottedChord=chords.some(c=>c.includes('<durationType>eighth</durationType>')&&c.includes('<dots>1</dots>')&&pitches(c).includes(60)&&pitches(c).includes(64));assert(report.dottedChord);
 const musicxml=await frame.evaluate(async()=>new TextDecoder().decode(await musetabEngine.exportTo('musicxml')));assert(musicxml.includes('<voice>2</voice>'));
 }
 for(const [width,height] of [[390,844],[844,390],[640,992],[1024,768],[1280,800],[800,1280]]){
   await page.setViewportSize({width,height});await category('音符');await settle();
   const bounds=await page.locator('iframe[title="谱面"]').boundingBox();assert(bounds.width>=160&&bounds.height>=120);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,`Overflow at ${width}x${height}`);
   await page.screenshot({path:`${out}/composer-${width}x${height}.png`});
 }
 await page.emulateMedia({colorScheme:'dark'});await settle();await page.screenshot({path:out+'/dark.png'});
 await page.getByRole('button',{name:'退出编谱',exact:true}).click();await page.locator('.composer').waitFor({state:'hidden',timeout:15000});
 assert.deepEqual(errors,[]);console.log(process.argv.includes('--layout-only')?'PASS composer responsive layouts only':'PASS touch composer',JSON.stringify(report));
}catch(error){await page.screenshot({path:out+'/failure.png'});throw error;}finally{await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2));await browser.close();}
