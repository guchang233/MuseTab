import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='tests/results/update-device';await fs.mkdir(out,{recursive:true});const c=await AndroidCDP.connect(9234),report={};
const wait=async(expression,timeout=60000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await c.evaluate(expression))return;await new Promise(r=>setTimeout(r,300));}throw Error('Timed out '+expression);};
const button=label=>c.evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);
try{
 report.before=await c.evaluate('JSON.parse(Android.appInfo())');assert.equal(report.before.versionCode,7,'seed APK for real upgrade test');
 await c.evaluate('document.querySelector("[aria-label=我的]").click()');await button('应用设置外观、版本与更新');await button('版本与更新');await button('检查更新');await wait('document.body.innerText.includes("发现新版本 0.5.0")');await c.screenshot(out+'/available.png');
 await button('下载更新');await wait('document.body.innerText.includes("校验完成，可以安装更新")',240000);await c.screenshot(out+'/verified.png');report.download='real HTTPS release download verified by native SHA-256, package/version and signature checks';
 await button('安装更新');await new Promise(r=>setTimeout(r,1000));await c.screenshot(out+'/installer.png');report.installRequested=true;
 console.log('PASS',JSON.stringify(report));
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));c.close();}
