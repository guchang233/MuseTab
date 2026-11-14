import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const c=await AndroidCDP.connect(9234),phase=process.argv[2]||'before';
try{
 const data=await c.evaluate(`(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('musetab');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});const all=await Promise.all([...db.objectStoreNames].map(name=>new Promise((ok,no)=>{const r=db.transaction(name).objectStore(name).getAllKeys();r.onsuccess=()=>ok({name,keys:r.result});r.onerror=()=>no(r.error);})));db.close();return all;})()`);
 const dir=process.env.MUSETAB_QA_OUT||'tests/results/update-device',info=await c.evaluate('JSON.parse(Android.appInfo())');await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/data-'+phase+'.json',JSON.stringify(data,null,2));await fs.writeFile(dir+'/version-'+phase+'.json',JSON.stringify(info,null,2));
 if(phase==='after'){assert.deepEqual(data,JSON.parse(await fs.readFile(dir+'/data-before.json','utf8')));assert.equal(info.version,JSON.parse(await fs.readFile('app/package.json','utf8')).version,'the new APK must actually be installed');}
 console.log('PASS local store keys snapshot '+phase,info.version,JSON.stringify(data.map(x=>({name:x.name,count:x.keys.length}))));
}finally{c.close();}
