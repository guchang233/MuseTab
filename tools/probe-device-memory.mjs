import {AndroidCDP} from './android-cdp.mjs';import fs from 'node:fs/promises';
const c=await AndroidCDP.connect(9234),events=[];
const handle=c.ws.onmessage;
c.ws.onmessage=async event=>{
 const m=JSON.parse(event.data);handle(event);
 if(m.method==='Debugger.paused'){
  const f=m.params.callFrames[0];
  const r=await c.call('Debugger.evaluateOnCallFrame',{callFrameId:f.callFrameId,expression:'({requestedSize,heap:HEAPU8.length})',returnByValue:true});
  events.push(r);console.log(JSON.stringify(r));await c.call('Debugger.resume');
 }
};
try{
 await c.call('Debugger.enable');
 const src=(await fs.readFile('app/public/engine/MuseScoreStudio.js','utf8')).split('\n')[7],i=src.indexOf('function _emscripten_resize_heap(');
 console.log('offset',i,src.slice(i,i+350));
 await c.call('Debugger.setBreakpointByUrl',{url:'https://musetab.local/engine/MuseScoreStudio.js',lineNumber:7,columnNumber:i+src.slice(i).indexOf('var oldSize')});
 await c.call('Page.reload',{ignoreCache:true});await new Promise(r=>setTimeout(r,15000));
}finally{await c.call('Debugger.disable');await fs.writeFile('tests/results/reader-fixes/device-memory.json',JSON.stringify(events,null,2));c.close();}
