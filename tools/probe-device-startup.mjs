import {AndroidCDP} from './android-cdp.mjs';
import fs from 'node:fs/promises';
const c=await AndroidCDP.connect(9234),events=[];
const handle=c.ws.onmessage;c.ws.onmessage=event=>{const message=JSON.parse(event.data);if(['Runtime.consoleAPICalled','Runtime.exceptionThrown','Log.entryAdded'].includes(message.method))events.push(message);handle(event);};
try{
 await c.call('Log.enable');await c.call('Page.reload',{ignoreCache:true});
 await new Promise(r=>setTimeout(r,12000));
 console.log(events.map(e=>e.method==='Runtime.consoleAPICalled'?e.params.args.map(v=>v.value||v.description).join(' '):JSON.stringify(e.params)).join('\n').slice(-14000));
 console.log('CORE',await c.evaluate('document.body.innerText',true));
}finally{await fs.writeFile('tests/results/reader-fixes/device-startup.json',JSON.stringify(events,null,2));c.close();}
