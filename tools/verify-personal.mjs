import {chromium} from '../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='tests/results/personal';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome'});
try{
 for(const [name,width,height] of [['phone',390,844],['tablet',1024,768]]){
  const p=await b.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/engine/host.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>UI test</title>'}));
  await p.addInitScript(()=>{const release={version:'0.4.5',versionCode:7,size:130000000,sha256:'a'.repeat(64),url:'https://github.com/guchang233/MuseTab/releases/download/v0.4.5/MuseTab-0.4.5.apk',notes:'测试版本说明'};window.Android={appInfo:()=>JSON.stringify({version:'0.4.4',versionCode:6}),setSystemBars(){},setImmersive(){},checkUpdate(){setTimeout(()=>window.onNativeUpdate({status:'checked',data:{current:{version:'0.4.4',versionCode:6},release}}),20)},downloadUpdate(){setTimeout(()=>window.onNativeUpdate({status:'ready',data:release}),20)},installUpdate(){window.installed=true;},cancelUpdate(){}};});
  await p.goto('http://127.0.0.1:5183');await p.getByRole('button',{name:'我的',exact:true}).click();await p.locator('.personal').waitFor();
  assert.equal(await p.locator('.settings-menu-row').count(),3);await p.screenshot({path:out+'/'+name+'-my.png'});
  await p.getByRole('button',{name:'应用设置 外观、版本与更新'}).click();await p.getByRole('button',{name:'版本与更新',exact:true}).click();await p.getByRole('button',{name:'检查更新',exact:true}).click();await p.getByText('发现新版本 0.4.5').waitFor();await p.getByRole('button',{name:'下载更新',exact:true}).click();await p.getByRole('button',{name:'安装更新',exact:true}).waitFor();await p.screenshot({path:out+'/'+name+'-update.png'});await p.getByRole('button',{name:'安装更新',exact:true}).click();assert(await p.evaluate(()=>window.installed));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await p.getByRole('button',{name:'返回我的',exact:true}).click();await p.getByRole('button',{name:'应用设置 外观、版本与更新'}).click();await p.getByRole('button',{name:'外观',exact:true}).click();await p.getByRole('radio',{name:'深色',exact:true}).click();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await p.screenshot({path:out+'/'+name+'-appearance.png'});
  assert.deepEqual(errors,[]);await p.close();console.log('PASS '+name+' source settings menu, update states, appearance and layout');
 }
}finally{await b.close();}
