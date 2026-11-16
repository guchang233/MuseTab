import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from '../app/node_modules/fflate/esm/index.mjs';
import assert from 'node:assert/strict';
const out='tests/results/native-composer';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:800},hasTouch:true});const errors=[],consoleErrors=[];let f,report={};
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||/qrc:.*(TypeError|ReferenceError|Error|Cannot)/.test(m.text()))consoleErrors.push(m.text().slice(0,1200));});
async function native(name,label=false){const s=await f.evaluate(()=>musetabEngine.composerState({inspect:true}));const c=s.controls.find(c=>label?c.label.startsWith(name):c.name===name);assert(c,'Missing native control: '+name);const box=await p.locator('iframe[title="谱面"]').boundingBox();await p.mouse.click(box.x+c.x+c.w/2,box.y+c.y+c.h/2);await p.waitForTimeout(150);}
async function xml(){const bytes=await f.evaluate(async()=>Array.from(await musetabEngine.exportTo('mscz')));const entries=unzipSync(Uint8Array.from(bytes));return strFromU8(Object.entries(entries).find(([name])=>name.endsWith('.mscx'))[1]);}
try{
 await p.goto('http://127.0.0.1:5183');f=p.frames().find(x=>x.url().includes('/engine/host.html'));await f.waitForFunction(()=>musetabEngine?.ready,{},{timeout:90000});
 await f.evaluate(()=>{window.fontResult=null;musetabEngine.on((name,data)=>{if(name==='text-font')window.fontResult=data;});});
 await p.getByRole('button',{name:'新建乐谱',exact:true}).click();await p.getByRole('textbox',{name:'乐谱标题',exact:true}).fill('原生编谱测试');await p.getByRole('spinbutton',{name:'小节数',exact:true}).fill('4');await p.getByRole('button',{name:'创建乐谱',exact:true}).click();await p.locator('.composer').waitFor({timeout:60000});await p.locator('.busy-layer').waitFor({state:'hidden'});await p.waitForTimeout(1000);
 report.font=await f.evaluate(()=>window.fontResult);report.state=await f.evaluate(()=>musetabEngine.composerState({inspect:true}));report.rect=await f.evaluate(()=>musetabEngine.viewRect());report.metrics=await f.evaluate(()=>musetabEngine.pageMetrics());await p.screenshot({path:out+'/native-desktop.png'});console.log(JSON.stringify(report));
 assert(report.font.loaded);assert(report.rect.w>300&&report.rect.h>200);assert(report.state.controls.some(c=>c.name==='mt-palettes'&&c.type.startsWith('PalettesPanel')));assert.equal(((await xml()).match(/<Note>/g)||[]).length,0);
 await native('mt-piano');await p.getByRole('alertdialog',{name:'解锁编辑？'}).waitFor();assert.equal(((await xml()).match(/<Note>/g)||[]).length,0);await p.getByRole('button',{name:'保持锁定',exact:true}).click();await p.getByRole('button',{name:'解锁编辑',exact:true}).click();
 if(!process.argv.includes('--panels-only')){
 await f.evaluate(()=>musetabEngine.selectPageAt(0,.273,.157));
 report.selectedRest=await f.evaluate(()=>musetabEngine.lastSelection);
 await native('Input by note name',true);await native('Quarter note',true);
 report.inputState=await f.evaluate(()=>({noteInput:musetabEngine.actionState('note-input'),method:musetabEngine.actionState('note-input-by-note-name'),workspace:musetabEngine.composerState(),selection:musetabEngine.lastSelection}));
 const piano=(await f.evaluate(()=>musetabEngine.composerState({inspect:true}))).controls.find(c=>c.name==='mt-piano');const frameBox=await p.locator('iframe[title="谱面"]').boundingBox();for(const key of [23,25,27,30]){await p.mouse.click(frameBox.x+piano.x+key*32+16,frameBox.y+piano.y+piano.h-20);await p.waitForTimeout(140);}
 const score=await xml();report.pitches=[...score.matchAll(/<pitch>(\d+)<\/pitch>/g)].map(m=>+m[1]);await fs.writeFile(out+'/native-input.mscx',score);assert.deepEqual(report.pitches,[60,64,67,72]);await native('Undo',true);assert.equal(((await xml()).match(/<Note>/g)||[]).length,3);await native('Redo',true);assert.equal(((await xml()).match(/<Note>/g)||[]).length,4);
 }
 for(const [panel,type] of [['selection','InspectorForm'],['parts','LayoutPanel'],['mixer','MixerPanel'],['symbols','PalettesPanel']]){await native('mt-panel-'+panel);const s=await f.evaluate(()=>musetabEngine.composerState({inspect:true}));assert(s.controls.some(c=>c.type.startsWith(type)));await p.screenshot({path:out+'/native-'+panel+'.png'});}
 await p.getByRole('button',{name:'格式',exact:true}).click();await p.getByRole('menuitem',{name:'页面设置',exact:true}).click();await p.waitForTimeout(400);report.pageDialog=await f.evaluate(()=>musetabEngine.composerState().modalOpen);assert(report.pageDialog);await p.screenshot({path:out+'/page-settings.png'});await p.evaluate(()=>onNativeBack());await p.waitForTimeout(200);assert(!await f.evaluate(()=>musetabEngine.composerState().modalOpen));assert(await p.locator('.composer').count());
 await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(400);await p.screenshot({path:out+'/native-dark.png'});assert.deepEqual(errors,[]);console.log('PASS native font, actual QML panels, lock, native piano input, undo/redo and QWidget dialog Back',JSON.stringify({pitches:report.pitches,dialog:report.pageDialog}));
}catch(e){await p.screenshot({path:out+'/failure.png'});throw e;}finally{await fs.writeFile(out+'/report.json',JSON.stringify({...report,errors,consoleErrors},null,2));await b.close();}
