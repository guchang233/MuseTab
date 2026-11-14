// Synthesise ahead on a dedicated worker. The real-time AudioWorklet only
// copies ready PCM; engraving, RPC and sample loading never run on its deadline.
let MuseAudio,driverPort,mainPort,pointer=0,capacity=0,frames=0,maxMs=0,lastReport=0,renderPositions=null;
let failed=false,lastSnapshotMemory;
function reportError(error){if(failed)return;failed=true;postMessage({type:'WORKER_ERROR',message:error.stack||String(error)});}
function releasePreviousSnapshot(bytes){
  if(bytes[0]!==2||bytes[1]!==101)return;
  let end=3;const tag=bytes[2];if(tag>=128){const width=({204:1,205:2,206:4,207:8})[tag];if(!width)return;end+=width;}
  // Same stream, two empty maps (events/dynamics), followed by ByteArray's
  // terminator. Release the old native/MIDI caches before decoding the full
  // replacement, rather than keeping two entire scores at the allocation peak.
  const clear=new Uint8Array(end+5);clear.set(bytes.subarray(0,end));clear.set([196,3,128,128,0],end);
  const before=MuseAudio._audioHeapUsed?.();
  MuseAudio.main_worker_rpcListen(clear);
  lastSnapshotMemory={before,cleared:MuseAudio._audioHeapUsed?.(),bytes:bytes.length};
}
globalThis.debugLog=()=>{};
function render(samples){
  const count=samples*2,size=count*4;if(size>capacity){if(pointer)MuseAudio._free(pointer);pointer=MuseAudio._malloc(size);capacity=size;}
  const start=performance.now();renderPositions=[];MuseAudio._process(pointer,samples);const positions=renderPositions;renderPositions=null;maxMs=Math.max(maxMs,performance.now()-start);frames+=samples;
  const data=new Float32Array(MuseAudio.HEAPU8.buffer,pointer,count).slice();driverPort.postMessage({type:'response_audio',data,positions},[data.buffer,...positions.map(p=>p.buffer)]);
  if(performance.now()-lastReport>1000){lastReport=performance.now();postMessage({type:'WORKER_STATS',frames,maxMs,heap:MuseAudio.HEAPU8.length,used:MuseAudio._audioHeapUsed?.(),snapshot:lastSnapshotMemory});maxMs=0;}
}
onmessage=async event=>{
  try{
    const data=event.data;
    if(data.type==='INITIALIZE_WORKER'){
      mainPort=data.mainPort;driverPort=data.driverPort;
      MuseAudio={noInitialRun:true,main_worker_rpcSend:bytes=>{
        // Stream 106 is PlaybackPositionStream. Its time describes this PCM
        // block, not the already audible block ~6,000 frames behind it.
        if(renderPositions&&bytes[0]===2&&bytes[1]===106)renderPositions.push(new Uint8Array(bytes));
        else mainPort.postMessage(bytes);
      },main_worker_rpcListen:()=>{},
        onRuntimeInitialized:()=>{MuseAudio._Init(42);postMessage({type:'WORKER_INITED'});},
        onSoundFontReady:ok=>{if(ok)driverPort.postMessage({type:'channel_inited'});postMessage({type:'SOUNDFONT_READY',ok});},
        print:()=>{},printErr:message=>postMessage({type:'WORKER_LOG',message}),
      };
      mainPort.onmessage=e=>{if(!failed)try{releasePreviousSnapshot(e.data);MuseAudio.main_worker_rpcListen(e.data);}catch(error){reportError(error);}};
      driverPort.onmessage=e=>{if(!failed&&e.data.type==='request_audio')try{render(e.data.samplesPerChannel);}catch(error){reportError(error);}};
      importScripts(data.options.museAudioUrl);
      MuseAudio=await MuseAudio_entry(MuseAudio);
    }else if(data.type==='MUSETAB_STAFF_PLAYBACK'){
      const masks=Uint8Array.from(data.masks),ptr=MuseAudio._malloc(masks.length||1);
      try{MuseAudio.HEAPU8.set(masks,ptr);MuseAudio._setStaffPlayback(ptr,masks.length);}finally{MuseAudio._free(ptr);}
    }else if(data.type==='MUSETAB_SOUNDFONT'){
      const bytes=new Uint8Array(data.bytes),ptr=MuseAudio._malloc(bytes.length);
      try{MuseAudio.HEAPU8.set(bytes,ptr);MuseAudio.ccall('loadSoundFont',null,['number','number','string'],[ptr,bytes.length,data.uri]);}finally{MuseAudio._free(ptr);}
    }
  }catch(error){reportError(error);}
};
