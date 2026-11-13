//import MuseAudio_entry from '../MuseAudio.js';

let MuseAudio = {
    preRun: [],
    postRun: [],
    locateFile: function(path, prefix) { 
        var file = prefix + "../" + path;
        return file
    },
    setStatus: (function () {
        return function (text) {
            if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
            console.info(text);
        };
    })(),
    onLogMessage: function (type, error) {
      debugLog(type + ": " + error)
    },
    inited: false,
    onSoundFontReady: function(ok) {
        globalThis.mainPort.postMessage({type: 'SOUNDFONT_READY', ok: ok});
    },
    onRuntimeInitialized: function () {
        debugLog("onRuntimeInitialized MuseAudio: " + MuseAudio)
        try {
        //MuseAudio.ccall('Init', '', ['number'], [42]);
        MuseAudio._Init(42)
        MuseAudio.inited = true;
        globalThis.mainPort.postMessage({type: "DRIVER_INITED" });
        } catch (error) {
        debugLog("init ERROR: " + error)
        }
    }
}

globalThis.self = {
    location: {
        href: ""
    }
}

class MuseDriverProcessor extends AudioWorkletProcessor {

    constructor(options) {
        super(options)

        this.port.onmessage = this.onMessageFromMain.bind(this);

        this.debugLog("end of constructor MuseDriverProcessor")

        globalThis.mainPort = this.port;
        globalThis.debugLog = function(data) {
            globalThis.mainPort.postMessage(data)
        }
    }

    init(data) {
        this.config = data.config;
        this.IS_USED_WORKER = this.config.MUSE_MODULE_AUDIO_WORKER == "ON";


        if (this.IS_USED_WORKER) {

            this.workerPort = data.rpcPort
            this.workerPort.onmessage = this.onMessageFromWorker.bind(this);

            this.workerBuffer = [];
            this.offset=0;this.buffered=0;this.consumed=0;this.underruns=0;this.started=false;this.lastReport=0;
            this.channel_inited = false;
            this.audio_requested = false;
            this.sendToMain({type:'DRIVER_INITED'});

        } else {

            // Rpc
            // main <=> worker
            MuseAudio.mainPort = data.rpcPort;
            MuseAudio.main_worker_rpcSend = function(data) {
                MuseAudio.mainPort.postMessage(data)
            }

            MuseAudio.main_worker_rpcListen = function(data) {} // will be overridden
            MuseAudio.mainPort.onmessage = function(event) {
                MuseAudio.main_worker_rpcListen(event.data)
            }

            // Init wasm
            try {
                MuseAudio_entry(MuseAudio);
            } catch (error) {
                this.debugLog("MuseAudio_entry ERROR:" + error)
            }

            // Buffer
            this.wasmBuffer = {
                size: 0,
                ptr: null
            }

        }
    }

    sendToMain(data) {
        this.port.postMessage(data)
    }

    onMessageFromMain(event) {
        if (event.data.type == "INITIALIZE_DRIVER") {
            this.init(event.data)
        } else if(event.data.type === 'MUSETAB_SOUNDFONT') {
            const bytes=new Uint8Array(event.data.bytes),ptr=MuseAudio._malloc(bytes.length);
            try {
                MuseAudio.HEAPU8.set(bytes,ptr);
                MuseAudio.ccall('loadSoundFont',null,['number','number','string'],[ptr,bytes.length,event.data.uri]);
            } catch(error) {
                this.sendToMain({type:'SOUNDFONT_READY',ok:false});
                this.debugLog(String(error));
            } finally { MuseAudio._free(ptr); }
        }
    }

    debugLog(msg) {
        this.sendToMain({type: "debug", msg: msg})
    }

    sendToWorker(data) {
        this.workerPort.postMessage(data)
    }

    onMessageFromWorker(event) {
        if (event.data.type == "response_audio") {
            this.onResponseAudio(event.data)
        } else if (event.data.type == "channel_inited") {
            this.channel_inited = true;
            this.requestAudio();
        }
    }

    requestAudio() {
        if (!this.channel_inited) {
            return;
        }

        if (this.audio_requested || this.buffered>=6144) {
            return;
        }

        this.sendToWorker({type: "request_audio", samplesPerChannel: 1024})
        this.audio_requested = true;
    }

    onResponseAudio(msg) {
        this.workerBuffer.push(msg.data);
        this.buffered+=msg.data.length/2;this.started=true;
        this.audio_requested = false;
        this.requestAudio();
    }

    process(inputs, outputs, parameters) {

        // Some mobile WebViews render an empty output while the node is not
        // yet connected. Keep the processor alive until channels are present.
        const activeOutput = outputs[0];
        if (!activeOutput?.length || !activeOutput[0]?.length) return true;

        // Direct wasm, not worker
        if (!this.IS_USED_WORKER) {
            if (!MuseAudio.inited) {
                // Wait for the WASM module to be loaded.
                return true;
            }

            const output = outputs[0];
            const chCount = output.length;
            const samplesPerCh = output[0].length;
            const totalSamples = chCount * samplesPerCh;

            const bufferSize = totalSamples * 4 /*float*/
            if (this.wasmBuffer.size < bufferSize) {
                MuseAudio._free(this.wasmBuffer.ptr);
                this.wasmBuffer.ptr = MuseAudio._malloc(bufferSize);
                this.wasmBuffer.size = bufferSize;
            }

            MuseAudio._process(this.wasmBuffer.ptr, samplesPerCh);

            const view = new Float32Array(MuseAudio.HEAPU8.buffer, this.wasmBuffer.ptr, totalSamples);

            for (let ci = 0; ci < output.length; ++ci) {
                let channel = output[ci];
                for (let i = 0; i < channel.length; i++) {
                    let index = i * 2 + ci;
                    if (index < view.length) {
                        channel[i] = view[i * 2 + ci];
                    } else {
                        channel[i] = 0;
                    }
                }
            }
        } 
        // use worker
        else {
            const output = outputs[0];
            let written=0;
            for(let i=0;i<output[0].length;i++){
                const chunk=this.workerBuffer[0];if(!chunk)break;
                for(let channel=0;channel<output.length;channel++)output[channel][i]=chunk[this.offset+channel]||0;
                this.offset+=2;this.buffered--;written++;this.consumed++;
                if(this.offset>=chunk.length){this.workerBuffer.shift();this.offset=0;}
            }
            if(this.started&&written<output[0].length)this.underruns++;
            this.requestAudio();
            if(currentTime-this.lastReport>=1){this.lastReport=currentTime;this.sendToMain({type:'AUDIO_STATS',buffered:this.buffered,consumed:this.consumed,underruns:this.underruns,time:currentTime});}
        }

        return true; 
    }
}

registerProcessor('musedriver-processor', MuseDriverProcessor);
