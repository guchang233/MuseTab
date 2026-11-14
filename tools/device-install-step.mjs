import {AndroidCDP} from './android-cdp.mjs';
const c=await AndroidCDP.connect(9234);
try{await c.evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='安装更新').click()`);await new Promise(r=>setTimeout(r,1200));await c.screenshot('tests/results/update-device/system-install.png');}finally{c.close();}
