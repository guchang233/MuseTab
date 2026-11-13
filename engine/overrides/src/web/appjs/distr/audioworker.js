// Synthesise ahead on a dedicated worker. The real-time AudioWorklet only
// copies ready PCM; engraving, RPC and sample loading never run on its deadline.
let MuseAudio,driverPort,mainPort,pointer=0,capacity=0,frames=0,maxMs=0,lastReport=0;
globalThis.debugLog=()=>{};
function render(samples){
  const count=samples*2,size=count*4;if(size>capacity){if(pointer)MuseAudio._free(pointer);pointer=MuseAudio._malloc(size);capacity=size;}
  const start=performance.now();MuseAudio._process(pointer,samples);maxMs=Math.max(maxMs,performance.now()-start);frames+=samples;
  const data=new Float32Array(MuseAudio.HEAPU8.buffer,pointer,count).slice();driverPort.postMessage({type:'response_audio',data},[data.buffer]);
  if(performance.now()-lastReport>1000){lastReport=performance.now();postMessage({type:'WORKER_STATS',frames,maxMs,heap:MuseAudio.HEAPU8.length});maxMs=0;}
}
onmessage=async event=>{
  try{
    const data=event.data;
    if(data.type==='INITIALIZE_WORKER'){
      mainPort=data.mainPort;driverPort=data.driverPort;
      MuseAudio={noInitialRun:true,main_worker_rpcSend:bytes=>mainPort.postMessage(bytes),main_worker_rpcListen:()=>{},
        onRuntimeInitialized:()=>{MuseAudio._Init(42);postMessage({type:'WORKER_INITED'});},
        onSoundFontReady:ok=>{if(ok)driverPort.postMessage({type:'channel_inited'});postMessage({type:'SOUNDFONT_READY',ok});},
        print:()=>{},printErr:message=>postMessage({type:'WORKER_LOG',message}),
      };
      mainPort.onmessage=e=>MuseAudio.main_worker_rpcListen(e.data);
      driverPort.onmessage=e=>{if(e.data.type==='request_audio')render(e.data.samplesPerChannel);};
      importScripts(data.options.museAudioUrl);
      MuseAudio=await MuseAudio_entry(MuseAudio);
    }else if(data.type==='MUSETAB_SOUNDFONT'){
      const bytes=new Uint8Array(data.bytes),ptr=MuseAudio._malloc(bytes.length);
      try{MuseAudio.HEAPU8.set(bytes,ptr);MuseAudio.ccall('loadSoundFont',null,['number','number','string'],[ptr,bytes.length,data.uri]);}finally{MuseAudio._free(ptr);}
    }
  }catch(error){postMessage({type:'WORKER_ERROR',message:error.stack||String(error)});}
};
