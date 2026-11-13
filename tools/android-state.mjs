import {AndroidCDP} from './android-cdp.mjs';
const c=await AndroidCDP.connect();
try{
  console.log(await c.evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,text:document.body.innerText})'));
  console.log('ENGINE',await c.evaluate('({ready:musetabEngine.ready,audio:musetabEngine.audioStarted})',true));
  await c.screenshot('tests/results/android-current.png');
  if(process.argv[2])console.log('EVAL',await c.evaluate(process.argv[2],process.argv[3]==='core'));
}finally{c.close();}
