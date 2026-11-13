import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';
const c=await AndroidCDP.connect();
try{
  const data=await c.evaluate(`(async()=>{const a=await musetabEngine.exportTo('mscz');let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);})()`,true);
  await fs.writeFile(process.argv[2]||'tests/results/android-current-export.mscz',Buffer.from(data,'base64'));
  console.log('EXPORTED',Buffer.from(data,'base64').length);
  console.log('UI',await c.evaluate('({text:document.body.innerText,url:location.href})'));
}finally{c.close();}
