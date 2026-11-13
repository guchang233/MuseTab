import { chromium } from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const out = 'tests/results/cloud-ui';
await fs.mkdir(out, { recursive: true });
// Small, real PDF fixture with two pages; text and staff lines exercise rendering.
function pdfFixture() {
  const content = 'BT /F1 24 Tf 60 760 Td (MuseTab - PDF score test) Tj ET\n' + [0,1,2,3,4].map(i => '60 ' + (680-i*12) + ' m 530 ' + (680-i*12) + ' l S').join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length ' + Buffer.byteLength(content) + ' >>\nstream\n' + content + '\nendstream'];
  let text = '%PDF-1.4\n', offsets = [0];
  for (let i=0;i<objects.length;i++) { offsets.push(Buffer.byteLength(text)); text += (i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'; }
  const xref = Buffer.byteLength(text);
  text += 'xref\n0 7\n0000000000 65535 f \n' + offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('') + 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return Buffer.from(text);
}
const dir='D:/music/Context/2025/2025 7', names=await fs.readdir(dir);
const mscz=await fs.readFile(dir+'/'+names.find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mscz')));
const mid=await fs.readFile(dir+'/'+names.find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.mid')));
const pdf=pdfFixture(); await fs.writeFile(out+'/score.pdf',pdf);
const files=new Map([['mscz/葬送的芙莉莲 · Animenz.mscz',mscz],['mid/钢琴组曲 #1.mid',mid],['PDF/练习谱.pdf',pdf]]);
const sha=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const tree=[...files].map(([path,bytes])=>({path,type:'blob',size:bytes.length,sha:sha(bytes)}));
tree.push({path:'mid/损坏.mid',type:'blob',size:3,sha:'0'.repeat(40)},{path:'mid/超大.mid',type:'blob',size:40*1024*1024,sha:'2'.repeat(40)},{path:'unrelated.pdf',type:'blob',size:pdf.length,sha:sha(pdf)},{path:'mid/README.txt',type:'blob',size:10,sha:'3'.repeat(40)});
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const pass=(name,data)=>{checks.push({name,data});console.log('PASS',name,JSON.stringify(data??''));};
async function dbRecords(){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('musetab');r.onsuccess=()=>{const d=r.result,t=d.transaction('scores','readonly'),q=t.objectStore('scores').getAll();q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>d.close();};r.onerror=()=>reject(r.error);}));}
async function snap(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'root horizontal overflow');}
try{
  await page.goto('http://127.0.0.1:5183');
  await page.getByRole('button',{name:'云端曲库 只读',exact:true}).click();
  await page.locator('.cloud-score').first().waitFor({timeout:60000});
  pass('real public static catalog',{scores:await page.locator('.cloud-score').count()});
  let mode='normal';
  await page.route('https://api.github.com/**',()=>{throw Error('Unexpected GitHub REST request');});
  await page.route('https://raw.githubusercontent.com/guchang233/muse-repo/**',async route=>{
    if(new URL(route.request().url()).pathname.endsWith('/catalog.json')){
      if(mode==='rate')return route.fulfill({status:503});
      const entries=tree.filter(e=>['mid','mscz','pdf'].includes(e.path.split('/')[0].toLowerCase())&&/\.(mid|mscz|pdf)$/i.test(e.path));
      return route.fulfill({json:{version:1,repo:'guchang233/muse-repo',branch:'main',commit:'a'.repeat(40),updatedAt:Date.now(),scores:mode==='empty'?[]:entries},headers:{'Access-Control-Allow-Origin':'*'}});
    }
    const path=decodeURIComponent(new URL(route.request().url()).pathname.split('/').slice(4).join('/'));
    const bytes=files.get(path)||Buffer.from('bad'); await route.fulfill({body:bytes,headers:{'Access-Control-Allow-Origin':'*'}});
  });
  mode='empty';await page.getByRole('button',{name:'刷新曲库',exact:true}).first().click();await page.getByRole('heading',{name:'曲库还没有乐谱',exact:true}).waitFor();await snap('phone-cloud-empty');pass('empty repository state');
  mode='normal';
  await page.getByRole('button',{name:'刷新曲库',exact:true}).first().click();
  await page.locator('.cloud-score').first().waitFor();
  assert.equal(await page.locator('.cloud-score').count(),5);
  assert.equal((await dbRecords()).length,0);
  pass('format directories only; listing never imports files');
  await snap('phone-cloud-populated-fixture');
  await page.setViewportSize({width:800,height:1280});await snap('tablet-cloud-populated-fixture');
  await page.setViewportSize({width:390,height:844});
  for(const name of ['葬送的芙莉莲 · Animenz','钢琴组曲 #1','练习谱']){
    await page.getByRole('button',{name:'保存到本地 '+name,exact:true}).click();
    await page.locator('.cloud-score').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'已保存',exact:true}).waitFor();
    assert(!await page.locator('.reader,.pdf-reader').count());
  }
  const records=await dbRecords();assert.equal(records.length,3);assert(records.every(r=>r.source?.sha&&r.openedAt===0));
  pass('download three formats to independent local copies without opening');
  await page.getByRole('button',{name:'保存到本地 损坏',exact:true}).click();await page.getByRole('alert').filter({hasText:'文件内容与格式不符'}).waitFor();
  await page.getByRole('button',{name:'保存到本地 超大',exact:true}).click();await page.getByRole('alert').filter({hasText:'32 MB'}).waitFor();assert.equal((await dbRecords()).length,3);
  mode='rate';await page.getByRole('button',{name:'刷新曲库',exact:true}).first().click();await page.getByRole('alert').filter({hasText:'暂时不可用'}).waitFor();assert.equal(await page.locator('.cloud-score').count(),5);
  pass('bad files, size limit and static service failure preserve local files and cached catalog');mode='normal';
  await page.getByRole('button',{name:'本地谱匣 3',exact:true}).click();
  await snap('phone-home');
  for(const [name,w,h] of [['phone-small',360,800],['phone-landscape',844,390],['tablet-portrait',800,1280],['tablet-landscape',1280,800]]){
    await page.setViewportSize({width:w,height:h});await noOverflow();await snap(name+'-home');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.local-score').filter({hasText:'练习谱'}).click();
  await page.waitForFunction(()=>document.querySelector('.pdf-surface canvas')?.width>0&&!document.querySelector('.pdf-reader .status'));
  await page.waitForTimeout(600);assert.equal(await page.locator('.pdf-reader .error').count(),0);await snap('phone-pdf');
  await page.getByRole('button',{name:'批注',exact:true}).click();
  const box=await page.locator('.pdf-surface').boundingBox();
  await page.mouse.move(box.x+40,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+160,{steps:10});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.ink-tools small')?.textContent==='批注已存本地');assert.equal(await page.locator('.pdf-surface path').count(),1);await snap('phone-pdf-annotation');
  await page.getByRole('button',{name:'下一页',exact:true}).click();assert.equal(await page.locator('.pdf-surface path').count(),0);
  await page.getByRole('button',{name:'上一页',exact:true}).click();assert.equal(await page.locator('.pdf-surface path').count(),1);
  await page.getByRole('button',{name:'返回谱匣',exact:true}).click();
  await page.locator('.local-score').filter({hasText:'练习谱'}).click();await page.locator('.pdf-surface path').waitFor();
  pass('local PDF renders, paginates, persists annotations across reopen');
  await page.getByRole('button',{name:'全屏看谱',exact:true}).click();await page.getByRole('button',{name:'退出全屏',exact:true}).waitFor();assert(!await page.locator('.reading-header').count());await snap('phone-pdf-fullscreen');
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  await page.getByRole('button',{name:'返回谱匣',exact:true}).click();
  const frame=page.frames().find(f=>f.url().includes('/engine/host.html'));await frame.waitForFunction(()=>musetabEngine?.ready,{},{timeout:60000});
  await page.locator('.local-score').filter({hasText:'葬送的芙莉莲'}).click();await page.locator('.reader').waitFor();
  await page.waitForTimeout(700);await snap('phone-reader');
  await page.getByRole('button',{name:'全屏看谱',exact:true}).click();await page.waitForTimeout(500);await snap('phone-reader-fullscreen');
  assert((await page.locator('iframe[title="谱面"]').boundingBox()).y===0);
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.locator('.editor').waitFor();
  for(const [name,w,h] of [['phone',390,844],['phone-small',360,800],['phone-landscape',844,390],['tablet-portrait',800,1280],['tablet-landscape',1280,800]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(450);await noOverflow();
    const top=await page.locator('.topbar').boundingBox(),bottom=await page.locator('.thumb').boundingBox(),canvas=await page.locator('iframe[title="谱面"]').boundingBox();assert(canvas.height>100);assert(canvas.y>=top.height-1);assert(canvas.y+canvas.height<=bottom.y+1);
    for(const label of ['撤销','重做','播放','保存','更多']){const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert(b.width>=44&&b.height>=44&&b.x>=0&&b.x+b.width<=w);}
    await snap(name+'-editor');
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'符号',exact:true}).click();await snap('phone-editor-symbols');await page.getByRole('button',{name:'收起符号',exact:true}).click();
  await frame.evaluate(()=>{
    window.testEvents=[];musetabEngine.on((name,data)=>testEvents.push({name,data}));musetabEngine.dispatch('first-element');
    for(let i=0;i<200;i++){musetabEngine.sync();if(testEvents.findLast(e=>e.name==='selection')?.data?.type==='Note')break;musetabEngine.dispatch('next-element');}
  });
  await page.getByRole('button',{name:'选中',exact:true}).click();await snap('phone-editor-selection-panel');
  const oldSource=records.find(r=>r.ext==='mscz').source;
  await page.getByRole('button',{name:'升半音',exact:true}).click();
  await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('musetab');r.onsuccess=()=>{const d=r.result,t=d.transaction('scores','readonly'),q=t.objectStore('scores').getAll();q.onsuccess=()=>resolve(q.result.some(v=>v.editedAt&&v.source?.path.startsWith('mscz/')));t.oncomplete=()=>d.close();};}));
  assert.deepEqual((await dbRecords()).find(r=>r.ext==='mscz').source,oldSource);
  await page.getByRole('button',{name:'收起选中',exact:true}).click();
  pass('editing a cloud copy preserves its source identity and only replaces local bytes');
  pass('phone and tablet editor layouts keep canvas clear and toolbar targets >=44px');
  await page.getByRole('radio',{name:'看谱',exact:true}).click();await page.locator('.reader').waitFor();
  await page.setViewportSize({width:360,height:800});await page.waitForTimeout(400);
  const rect=await page.locator('iframe[title="谱面"]').boundingBox();await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height-22);
  await page.locator('.ribbon-wrap').waitFor();assert((await page.locator('.ribbon-col').boundingBox()).width<=360);await snap('phone-reader-controls');
  await page.getByRole('button',{name:'返回谱匣',exact:true}).first().click();
  await page.getByRole('button',{name:'云端曲库 只读',exact:true}).click();
  const path='mid/钢琴组曲 #1.mid',newMid=Buffer.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,13,0,144,60,64,131,96,128,60,0,0,255,47,0]);
  files.set(path,newMid);Object.assign(tree.find(f=>f.path===path),{sha:sha(newMid),size:newMid.length});
  await page.getByRole('button',{name:'刷新曲库',exact:true}).first().click();
  await page.getByRole('button',{name:'保存到本地 钢琴组曲 #1',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.download.saved').length===3);
  assert.equal((await dbRecords()).length,4);
  assert.equal((await dbRecords()).filter(r=>r.source?.path===path).length,2);
  pass('new cloud revision saves a new copy, preserving the old local version');
  await page.getByRole('button',{name:'本地谱匣 4',exact:true}).click();
  await page.context().route('https://**/*', route=>route.abort());await page.reload();await page.locator('.local-score').filter({hasText:'练习谱'}).click();await page.locator('.pdf-surface path').waitFor();
  pass('local PDF annotations survive reload without cloud access');
  await page.getByRole('button',{name:'返回谱匣',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await snap('phone-home-recent');
  await page.setViewportSize({width:800,height:1280});await snap('tablet-home-recent');
  assert.equal(errors.length,0,errors.join('\n'));
}finally{await snap('last-state').catch(()=>{});await fs.writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}

