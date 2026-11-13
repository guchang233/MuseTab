import {AndroidCDP} from './android-cdp.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
const exec=promisify(execFile),adb='D:/MuseTabSDK/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>exec(adb,['-s','emulator-5556',...args]);
const mode=process.argv[2];
if(mode==='push'){
  const dir='D:/music/Context/2025/2025 7';
  for(const ext of ['mscz','mid']){
    const name=(await fs.readdir(dir)).find(n=>n.includes('Frieren_ Beyond Journey')&&n.endsWith('.'+ext));
    console.log((await run('push',dir+'/'+name,'/sdcard/Download/Frieren.'+ext)).stdout);
  }
}else if(mode==='native'){
  await run('shell','uiautomator','dump','/sdcard/musetab-ui.xml');
  const xml=(await run('shell','cat','/sdcard/musetab-ui.xml')).stdout;
  await fs.writeFile('tests/results/android-ui.xml',xml);
  const nodes=[...xml.matchAll(/<node\s+([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
  if(process.argv[3]){
    const n=process.argv[3]==='@edit'?nodes.find(n=>n.class==='android.widget.EditText'):nodes.find(n=>n.text===process.argv[3]||n['content-desc']===process.argv[3]||n['resource-id']===process.argv[3]);
    if(!n)throw Error('Native element missing: '+process.argv[3]);
    const [x1,y1,x2,y2]=n.bounds.match(/\d+/g).map(Number);
    await run('shell','input','tap',String((x1+x2)/2),String((y1+y2)/2));
  }else console.log(nodes.filter(n=>n.text||n['content-desc']).map(n=>({text:n.text,desc:n['content-desc'],bounds:n.bounds})));
}else{
  const c=await AndroidCDP.connect();
  try{
    if(mode==='tap'){
      const pos=await c.evaluate(`(()=>{const e=${process.argv[3]};if(!e)throw Error('Element missing');const r=e.getBoundingClientRect();return {x:(r.x+r.width/2)*devicePixelRatio,y:(r.y+r.height/2)*devicePixelRatio};})()`);
      await run('shell','input','tap',String(Math.round(pos.x)),String(Math.round(pos.y)));
    }else if(mode==='point')await run('shell','input','tap',process.argv[3],process.argv[4]);
    else if(mode==='eval')console.log(await c.evaluate(process.argv[3],process.argv[4]==='core'));
    await c.screenshot('tests/results/android-current.png');
  }finally{c.close();}
}
