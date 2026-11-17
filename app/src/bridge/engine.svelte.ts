// 引擎桥接：页面这一侧。
// 引擎（MuseScore 4.7 WASM）跑在一个同源 iframe 里（/engine/host.html），只画谱面；
// 这里把它的事件收成响应式状态，并把按钮动作转成引擎的具名动作。
import { untrack } from 'svelte';
import {activity} from '../ui/activity.svelte';

export type Selection = {
  none: boolean;
  range: boolean;
  count: number;
  type?: string;
  tick?: number;
  pitch?: number;
  text?:string;
  voice?:number;dots?:number;durationTicks?:number;chordPitches?:number[];measureIndex?:number;
  /** 选中内容在引擎画布里的位置（CSS 像素，相对 iframe 左上角） */
  rect?: { x: number; y: number; w: number; h: number };
};

export type PaletteInfo = { name: string; id: string; cells: number };
export type PaletteData = { name: string; id: string; w: number; h: number; cells: { name: string; png: string }[] };

export type ActionState = { known: boolean; enabled: boolean; checked: boolean };

type HostEngine = {
  supports(name:string):boolean;
  composerState(patch?:Record<string,unknown>):{enabled:boolean;locked:boolean;panel:string;keyboard:boolean;modalOpen:boolean;textOk?:boolean;textError?:string;pitchOk?:boolean;pitchError?:string;editOk?:boolean;editError?:string;editorInfo?:AriaEditorInfo;actions?:{code:string;title:string;enabled:boolean;checked:boolean}[];controls:{name:string;label:string;type:string;x:number;y:number;w:number;h:number;enabled:boolean}[]};
  viewRect():{x:number;y:number;w:number;h:number};
  playbackInfo():{duration:number;bpm?:number;numerator?:number;denominator?:number};
  seekSeconds(seconds:number):boolean;
  addPitch(step:number,octave:number,accidental:number,chord:boolean):boolean;
  pageMetrics():{w:number;h:number;rect?:{x:number;y:number;w:number;h:number}}[];
  selectPageAt(page:number,x:number,y:number):void;
  selectionImage(pixels:number):{page?:number;x?:number;y?:number;w?:number;h?:number;src?:string};
  setPageLock(v: boolean): void;
  pageView(index: number, width: number, height: number): PageState;
  gestureView(factor:number,dx:number,dy:number,cx:number,cy:number):{rect?:PageState['rect']};
  renderPage(index:number,pixels:number):string;
  readerLayout(mode:number):void;
  tapAt(x:number,y:number):void;
  scorePanels():ScorePanels;
  changeMixer(data:Record<string,unknown>):{ok:boolean};
  changeParts(data:Record<string,unknown>):{ok:boolean};
  scoreStyle(): ScoreStyle;
  applyScoreStyle(values: Partial<ScoreStyle>): { ok: boolean; message?: string };
  transposeScore(key: number, direction: number, whole: boolean): { ok: boolean; message?: string };
  ready: boolean;
  audioError?:string;
  on(fn: (name: string, data: any) => void): () => void;
  open(bytes: Uint8Array, ext: string): Promise<void>;
  dispatch(code: string): void;
  actionState(code: string): ActionState;
  setTempoMultiplier(m: number): void;
  setCanvasTheme?(dark: boolean, paper: string, canvas: string): void;
  setViewOnly(v: boolean): void;
  setEditLocked(v:boolean):void;
  palettes(): PaletteInfo[];
  palette(i: number): PaletteData;
  applyPaletteCell(p: number, c: number): boolean;
  sync(): void;
  exportTo(ext: string): Promise<Uint8Array>;
  startAudio(): Promise<void>;
  focus(): void;
};
export type PageState = { index: number; count: number; rect?: { x: number; y: number; w: number; h: number } };
export type ScoreStyle = { width: number; height: number; left: number; right: number; top: number; bottom: number; twoSided: boolean; spatium: number; staffDistance: number; minSystemDistance: number; maxSystemDistance: number; measureSpacing: number; staffLineWidth: number; verticalSpread: boolean };
export type MixerChannel={id:number;name:string;sound:string;volume:number;pan:number;muted:boolean;solo:boolean};
export type LayoutPart={id:string;name:string;visible:boolean;audible:boolean;staves:{id:string;index:number;playbackMask:number;visible:boolean;audible:boolean;lines:number}[]};
export type ScorePanels={parts:LayoutPart[];channels:MixerChannel[]};
export type AriaEditorInfo={metadata?:Record<string,string>;nominalNumerator?:number;nominalDenominator?:number;pickupNumerator?:number;pickupDenominator?:number;hasPickup?:boolean;currentNumerator?:number;currentDenominator?:number;key?:number;parts?:{id:string;name:string;selected:boolean}[];instruments?:{id:string;name:string;group:string;staves:number}[]};

const UNKNOWN: ActionState = { known: false, enabled: false, checked: false };

let host: HostEngine | null = null;
let frame: HTMLIFrameElement | null = null;

let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
let error = $state('');
let project = $state<{ open: boolean; title?: string; name?: string }>({ open: false });
let selection = $state<Selection>({ none: true, range: false, count: 0 });
/** 每收到一次选择事件加一：同一个音符被再次点中时也能触发界面反应 */
let selectionSeq = $state(0);
let playing = $state(false);
let tempoMultiplier=$state(1);
let mixerLevels=$state<Record<number,number>>({});
let position = $state<{secs:number;tick:number;cursor?:{page:number;x:number;y:number;w:number;h:number}}>({ secs: 0, tick: 0 });
let editLocked=$state(true),unlockRequestSeq=$state(0),readerTapSeq=$state(0);
let noteInput = $state(false);
let composerViewportSeq=$state(0);
let actionStates = $state<Record<string, ActionState>>({});
let opening = $state(false);
let changeSeq = $state(0);
let storedSeq = $state(0);
let saveRequestSeq=$state(0);
let readerControl=$state({seq:0,key:''});
let readerViewport=$state<{seq:number;zoom:number;rect?:PageState['rect']}>({seq:0,zoom:1});
let dialogRequest=$state({seq:0,kind:''});

const pendingActions=new Set<string>();let actionFrame=0;
function refreshActions(codes: string[]) {
  for(const code of codes)pendingActions.add(code);
  if(actionFrame)return;
  actionFrame=requestAnimationFrame(()=>{
    actionFrame=0;if(!host)return;
    const next={...actionStates};let changed=false;
    for(const code of pendingActions)if(code in next){const value=host.actionState(code);if(value.enabled!==next[code].enabled||value.checked!==next[code].checked||value.known!==next[code].known){next[code]=value;changed=true;}}
    pendingActions.clear();if(changed)actionStates=next;
  });
}

function onEvent(name: string, data: any) {
  switch (name) {
    case 'composer-ui':composerViewportSeq++;break;
    case 'audio-error':playing=false;dispatchEvent(new CustomEvent('musetab-error',{detail:data.message}));break;
    case 'edit-unlock-request':unlockRequestSeq++;break;
    case 'reader-tap':readerTapSeq++;break;
    case 'reader-control': readerControl={seq:readerControl.seq+1,key:data.key};break;
    case 'reader-viewport': readerViewport={...data,seq:readerViewport.seq+1};break;
    case 'mobile-dialog': dialogRequest={seq:dialogRequest.seq+1,kind:data.kind};break;
    case 'ready':
      status = 'ready';
      host?.sync();
      break;
    case 'error':
      if(data.operation==='open'){opening=false;break;}
      status = 'error';
      error = data.message ?? '引擎加载失败';
      break;
    case 'project':
      // The native importer uses an internal temporary filename when a score
      // has no title. Keep the user's library filename as the visible fallback.
      project = data.title===data.name&&/^import-\d+(?:\.[a-z]+)?$/.test(data.name??'')?{...data,title:undefined}:data;
      if (data.open) opening = false;
      refreshActions(Object.keys(actionStates));
      break;
    case 'selection':
      selection = data;
      selectionSeq++;
      break;
    case 'changed':
      changeSeq++;
      break;
    case 'save-request':
      saveRequestSeq++;
      break;
    case 'playing':
      playing = !!data.playing;
      break;
    case 'mixer-level':
      mixerLevels={...mixerLevels,[data.id]:data.level};
      break;
    case 'position':
      position = data;
      break;
    case 'noteInput':
      noteInput = !!data.active;
      break;
    case 'actions':
      refreshActions(data.codes ?? []);
      break;
  }
}

function poll(win: Window, tries = 0) {
  const h = (win as any).musetabEngine as HostEngine | undefined;
  if (h) {
    host = h;
    h.on(onEvent);
    if (h.ready) onEvent('ready', {});
    return;
  }
  if (tries > 600) {
    status = 'error';
    error = '引擎没有响应';
    return;
  }
  setTimeout(() => poll(win, tries + 1), 100);
}

export const engine = {
  pageMetrics(){return untrack(()=>host?.pageMetrics()||[]);},
  supports(name:string){return untrack(()=>typeof host?.supports==='function'&&host.supports(name));},
  composerState(patch:Record<string,unknown>={}){return untrack(()=>host?.composerState(patch));},
  viewRect(){return untrack(()=>host?.viewRect());},
  selectPageAt(page:number,x:number,y:number){untrack(()=>host?.selectPageAt(page,x,y));},
  selectionImage(pixels:number){return untrack(()=>host?.selectionImage(pixels)||{});},
  get editLocked(){return editLocked;},
  get composerViewportSeq(){return composerViewportSeq;},
  get unlockRequestSeq(){return unlockRequestSeq;},
  get readerTapSeq(){return readerTapSeq;},
  setEditLocked(v:boolean){editLocked=v;untrack(()=>host?.setEditLocked(v));},
  enterEditor(){editLocked=true;untrack(()=>host?.setEditLocked(true));},
  leaveEditor(){editLocked=true;untrack(()=>host?.setEditLocked(false));},
  get readerControl(){return readerControl;},
  get readerViewport(){return readerViewport;},
  gestureView(factor:number,dx:number,dy:number,cx:number,cy:number){return untrack(()=>host?.gestureView(factor,dx,dy,cx,cy));},
  renderPage(index:number,pixels:number){return untrack(()=>host?.renderPage(index,pixels)||'');},
  readerLayout(mode:number){untrack(()=>host?.readerLayout(mode));},
  tapAt(x:number,y:number){untrack(()=>host?.tapAt(x,y));},
  scorePanels(){if(!host)throw Error('引擎尚未就绪');return untrack(()=>host!.scorePanels());},
  changeMixer(data:Record<string,unknown>){return untrack(()=>host?.changeMixer(data)||{ok:false});},
  changeParts(data:Record<string,unknown>){return untrack(()=>host?.changeParts(data)||{ok:false});},
  get dialogRequest(){return dialogRequest;},
  setPageLock(v: boolean){untrack(()=>host?.setPageLock(v));},
  pageView(index: number,width: number,height: number): PageState {return untrack(()=>host?.pageView(index,width,height)??{index:0,count:0});},
  scoreStyle(): ScoreStyle {if(!host)throw Error('引擎尚未就绪');return untrack(()=>host!.scoreStyle());},
  applyScoreStyle(values: Partial<ScoreStyle>){if(!host)throw Error('引擎尚未就绪');return untrack(()=>host!.applyScoreStyle(values));},
  transposeScore(key: number,direction: number,whole: boolean){if(!host)throw Error('引擎尚未就绪');return untrack(()=>host!.transposeScore(key,direction,whole));},
  get status() {
    return status;
  },
  get error() {
    return error;
  },
  get project() {
    return project;
  },
  get selection() {
    return selection;
  },
  get selectionSeq() {
    return selectionSeq;
  },
  get playing() {
    return playing;
  },
  get tempoMultiplier(){return tempoMultiplier;},
  get mixerLevels(){return mixerLevels;},
  get position() {
    return position;
  },
  get noteInput() {
    return noteInput;
  },
  get opening() {
    return opening;
  },
  get changeSeq(){return changeSeq;},
  get saveRequestSeq(){return saveRequestSeq;},
  get dirty(){return changeSeq!==storedSeq;},
  markStored(seq:number){storedSeq=seq;},
  get frame() {
    return frame;
  },

  /** 由 EngineView 在 iframe 挂上后调用 */
  attach(el: HTMLIFrameElement) {
    frame = el;
    status = 'loading';
    const start = () => el.contentWindow && poll(el.contentWindow);
    if (el.contentDocument?.readyState === 'complete') start();
    else el.addEventListener('load', start, { once: true });
  },

  async open(bytes: Uint8Array, ext: string) {
    if (!host || status !== 'ready') throw new Error('引擎尚未就绪');
    if(opening)throw new Error('已有乐谱正在打开，请稍候');
    opening = true;
    selection = { none: true, range: false, count: 0 };
    try{
      await host.open(bytes, ext.toLowerCase());
      changeSeq=0;storedSeq=0;
    }catch(e){
      const message=e instanceof Error?e.message:(e&&typeof e==='object'&&'message' in e?String((e as {message:unknown}).message):'');
      throw new Error(message||'没能打开这份乐谱');
    }finally{opening=false;}
  },

  /** 派发引擎动作，例如 'play'、'undo'、'note-input'、'pad-note-4' */
  dispatch(code: string) {
    untrack(()=>host?.dispatch(code));
  },
  addPitch(step:number,octave:number,accidental=0,chord=false){return untrack(()=>host?.addPitch(step,octave,accidental,chord)??false);},
  playbackInfo(){return untrack(()=>host?.playbackInfo()??{duration:0});},
  seekSeconds(seconds:number){return untrack(()=>host?.seekSeconds(seconds)??false);},

  /** 某个动作当前是否可用 / 处于选中态；首次查询后会随引擎事件自动更新 */
  action(code: string): ActionState {
    const known = actionStates[code];
    if (known) return known;
    if (!host || status !== 'ready') return UNKNOWN;
    const st = host.actionState(code);
    queueMicrotask(() => {
      if (!(code in actionStates)) actionStates = { ...actionStates, [code]: st };
    });
    return st;
  },
  // Command preparation must read the current core state, not a cached UI event.
  currentAction(code:string):ActionState{return untrack(()=>host?.actionState(code)??UNKNOWN);},

  /** 引擎自带的全套符号面板（目录） */
  palettes(): PaletteInfo[] {
    return host && status === 'ready' ? host.palettes() : [];
  },
  /** 某一册的全部条目，图样由引擎绘制 */
  palette(i: number): PaletteData | null {
    return host && status === 'ready' ? host.palette(i) : null;
  },
  /** 把某个符号加到当前选中的位置 */
  applyPaletteCell(p: number, c: number): boolean {
    return !!host?.applyPaletteCell(p, c);
  },

  /** 谱纸与画布底色跟随界面主题；暗色时反相谱面 */
  setCanvasTheme(dark: boolean, paper: string, canvas: string) {
    untrack(()=>host?.setCanvasTheme?.(dark, paper, canvas));
  },

  /** 看谱模式：点按只选中，任何手势都不会改动乐谱 */
  setViewOnly(v: boolean) {
    untrack(()=>host?.setViewOnly(v));
  },

  setTempoMultiplier(m: number) {
    tempoMultiplier=Math.max(.25,Math.min(2,m));
    host?.setTempoMultiplier(tempoMultiplier);
  },

  exportTo(ext: string): Promise<Uint8Array> {
    if (!host) return Promise.reject(new Error('引擎尚未就绪'));
    return host.exportTo(ext);
  },

  /** 必须在用户手势里调用（浏览器的自动播放限制） */
  async togglePlay() {
    if (!host) return;
    if(playing){host.dispatch('play');return;}
    try{
      // 先在手势栈里恢复 AudioContext，再进 activity 队列等播放态。
      // 若先 await tick/rAF，手势会失效，表现为“在播但没声音”。
      await host.startAudio();
      host.dispatch('play');
      await activity.run('正在准备播放…',async()=>{
        const until=Date.now()+10000;
        while(!playing){
          if(host!.audioError)throw Error(host!.audioError);
          if(Date.now()>until)throw Error('播放未能启动，请保存后重新打开应用');
          await new Promise(resolve=>setTimeout(resolve,40));
        }
      },'playback-start');
    }catch(e){dispatchEvent(new CustomEvent('musetab-error',{detail:(e as {message?:string})?.message||'播放未能启动'}));}
  },
  stop() {
    host?.dispatch('stop');
  },
  pause(){untrack(()=>{if(playing)host?.dispatch('play');});},

  /** 让引擎画布拿回键盘焦点（外接键盘输入音符时需要） */
  focus() {
    host?.focus();
  },
};
