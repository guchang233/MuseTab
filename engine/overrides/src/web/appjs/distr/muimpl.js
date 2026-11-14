import config from "./config.js";
import qtLoad from "./qtloader.js";
import AudioDriver from "./audiodriver.js";

// Pinned MuseScore RPC envelope: MSG_ID, callId, method, type, binary payload.
// SoundProfilesRepository populates its cache when method 18 returns a list.
// Wait for that callback, rather than a time delay, before importing a score.
function hasInputResources(data) {
    let p=0;
    function integer(){
        const tag=data[p++];
        if(tag<128)return tag;
        const widths={204:1,205:2,206:4,207:8,208:1,209:2,210:4,211:8};
        const n=widths[tag];if(!n)throw Error('not an integer');
        let v=0;for(let i=0;i<n;i++)v=v*256+data[p++];return v;
    }
    try{
        if(integer()!==1)return false;
        integer();
        if(integer()!==18||integer()!==3)return false;
        const bin=data[p++];
        if(bin===196)p+=1;else if(bin===197)p+=2;else if(bin===198)p+=4;else return false;
        const tag=data[p++];
        if(tag>=145&&tag<=159)return true;
        if(tag===220)return (data[p]*256+data[p+1])>0;
        if(tag===221)return data.slice(p,p+4).some(v=>v!==0);
    }catch{}
    return false;
}

function setupInternalCallbacks(Module) {

    // Interactive
    Module.openFileDialog = function(callback) {
        console.log("[js] openFileDialog")
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const fileName = file.name
            const reader = new FileReader();
            reader.onload = (e) => {
                const contents = e.target.result;
                const uint8View = new Uint8Array(contents);
                console.log("[js] openFileDialog fileName: ", fileName, ", contents: ", uint8View.length, ", [0]=", uint8View[0])
                callback(fileName, uint8View);
            };
            reader.readAsArrayBuffer(file); 
        };
        input.click();
    }
}

function setupRpc(Module)
{
    // Main <=> Worker 
    // port1 - main
    // port2 - worker
    Module.main_worker_rpcChannel = new MessageChannel();

    // Main-stream changes are complete score snapshots (PlaybackModel sends
    // originEvents + dynamics). Coalesce rapid edits per stream; rendering each
    // intermediate 7,000-note snapshot needlessly stalls synthesis.
    const pending=new Map();let editTimer=0,firstEdit=0;
    Module.flushPlaybackUpdates=()=>{clearTimeout(editTimer);editTimer=0;firstEdit=0;for(const data of pending.values())Module.main_worker_rpcChannel.port1.postMessage(data);pending.clear();};
    Module.main_worker_rpcSend = function(data) {
        if(data[0]===2&&data[1]===101){
            let p=2,tag=data[p++],id=tag;
            if(tag>=128){const n=({204:1,205:2,206:4,207:8})[tag];id=0;for(let i=0;i<n;i++)id=id*256+data[p++];}
            pending.set(id,new Uint8Array(data));if(!firstEdit)firstEdit=performance.now();
            clearTimeout(editTimer);editTimer=setTimeout(Module.flushPlaybackUpdates,Math.max(0,Math.min(180,450-(performance.now()-firstEdit))));return;
        }
        Module.main_worker_rpcChannel.port1.postMessage(data);
    }

    Module.main_worker_rpcListen = function(data) {} // will be overridden

    Module.main_worker_rpcChannel.port1.onmessage = function(event) {
        Module.main_worker_rpcListen(event.data)
        if(hasInputResources(event.data))Module.audioResourcesReady=true;
    };

    // Worker <=> Driver (processor)
    // port1 - driver
    // port2 - worker
    Module.driver_worker_rpcChannel = new MessageChannel();
}

async function setupDriver(Module) 
{
    Module.driver = AudioDriver;
    AudioDriver.playbackRunning=()=>Module.playbackRunning?.()??true;
    AudioDriver.onPlaybackPosition=bytes=>Module.main_worker_rpcListen(bytes);

    AudioDriver.onInited = function() {
        console.log("driver on inited add sound font")

        if (Module.isNeedStartAudio) {
            Module._startAudioProcessing()
        }

        if(config.MUSE_MODULE_AUDIO_WORKER !== 'ON')void AudioDriver.loadSoundFont(Module.soundFont);
    }

    if (config.MUSE_MODULE_AUDIO_WORKER == "ON") {
        await AudioDriver.setup(Module.config, Module.driver_worker_rpcChannel.port1);
    } else {
        await AudioDriver.setup(Module.config, Module.main_worker_rpcChannel.port2);
    }

}

async function setupWorker(Module)
{
    // Initialize the worker.
    Module.worker = new Worker("distr/audioworker.js")

    const simd=WebAssembly.validate(Uint8Array.from([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,22,1,20,0,253,12,...Array(16).fill(0),11]));
    Module.audioBackend=simd?'simd':'scalar';
    var museAudioUrl = new URL(simd?'MuseAudio-simd.js':'MuseAudio.js', window.location) + "";

    Module.worker.onmessage = function(event) {
        if (event.data.type == "WORKER_INITED") {
            void AudioDriver.loadSoundFont(Module.soundFont,Module.worker);
        }else if(event.data.type==='SOUNDFONT_READY'){
            AudioDriver.soundFontReady=!!event.data.ok;AudioDriver.soundFontFailed=!event.data.ok;
        }else if(event.data.type==='WORKER_STATS'){
            AudioDriver.workerDiagnostics=event.data;
        }else if(event.data.type==='WORKER_ERROR'){
            AudioDriver.soundFontFailed=true;console.error(event.data.message);
        }
    }

    Module.worker.postMessage({
    type: 'INITIALIZE_WORKER',
    mainPort: Module.main_worker_rpcChannel.port2,
    driverPort: Module.driver_worker_rpcChannel.port2,
    options: {
        museAudioUrl: museAudioUrl
    }
    }, [Module.main_worker_rpcChannel.port2, Module.driver_worker_rpcChannel.port2]);
}

const MuImpl = {

    Module: {},

    loadModule: async function(opt) {

        console.info("STEP 0: Begin load main module")

        this.Module = {
            config: config, // static configuration

            qt: {
                onLoaded: opt.onLoaded,
                onExit: opt.onExit,
                entryFunction: window.MuseScoreStudio_entry, // from MuseScoreStudio.js
                containerElements: [opt.screen],
            },

            soundFont: opt.soundFont,

            // called from cpp
            onStartApp: this._onStartApp.bind(this)
        }

        setupRpc(this.Module);
        console.info("STEP 0.1: End setupRpc")
        setupInternalCallbacks(this.Module);
        console.info("STEP 0.2: End setupInternalCallbacks")

        this.Module = await qtLoad(this.Module);
        console.info("STEP 0.3: End load main module")

        return this.Module;
    },

    _onStartApp: async function() {
        console.info("STEP 1: Begin on onStartApp")
        await setupDriver(this.Module);
        console.info("STEP 1.1: End setupDriver")

        if (config.MUSE_MODULE_AUDIO_WORKER == "ON") {
            await setupWorker(this.Module);
            console.info("STEP 1.2: End setupWorker")
        }
    },

    loadScoreFile: async function(file) {
        if (!file) {
            return
        }

        const buffer = await file.arrayBuffer();
        this.loadScoreData(new Uint8Array(buffer)) 
    },

    loadScoreData: function(data) {
        const ptr = this.Module._malloc(data.length);
        this.Module.HEAPU8.set(data, ptr);
        this.Module._load(ptr, data.length);
        this.Module._free(ptr);
    },

    startAudioProcessing: async function() {
        if (this.Module.driver.inited) {
            this.Module._startAudioProcessing()
        } else {
            console.log("driver not inited, start audio will be later")
            this.Module.isNeedStartAudio = true;
        }
    }
}

export default MuImpl;
