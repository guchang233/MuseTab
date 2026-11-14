<script lang="ts">
 import {untrack} from 'svelte';import {engine} from '../bridge/engine.svelte';import {theme} from '../ui/theme.svelte';import {readerGestures} from './gestures.js';
 import {library} from '../library/store.svelte';import {pageCache} from './page-cache';import pkg from '../../package.json';
 export type PageLayout='auto'|'single'|'double';
 type Rect={x:number;y:number;w:number;h:number};type PageBitmap={src:string;image:HTMLImageElement};type Visible={page:number;bitmap:PageBitmap;rect:Rect};
 let {mode='auto',autoTurn=true,index=$bindable(0),count=$bindable(0),last=$bindable(0),selectionRect=$bindable<Rect|undefined>(),onerror,ongesture}:{mode?:PageLayout;autoTurn?:boolean;index?:number;count?:number;last?:number;selectionRect?:Rect;onerror?:(message:string)=>void;ongesture?:()=>void}=$props();
 let surface:HTMLDivElement,width=$state(0),height=$state(0),metrics=$state<{w:number;h:number}[]>([]),pages=$state<Visible[]>([]),zoom=$state(1),dx=$state(0),dy=$state(0),focusPage=0,generation=0,cacheVersion=0;
 let selected=$state<{page:number;rect:Rect;src:string}|null>(null),loaded=$state(false),busy=$state(false);
 const columns=$derived(mode==='double'?2:mode==='single'?1:(width>=900&&height>=480&&width>height*1.15?2:1));
 const documentKey=$derived(`${pkg.version}:page3:${library.current?.id}:${library.current?.editedAt||library.current?.addedAt||0}`);
 let lastInput=0;
 const images=new Map<string,Promise<PageBitmap>>(),decoded=new Map<string,PageBitmap>();let warming:ReturnType<typeof setTimeout>;
 function rasterWidth(){return Math.ceil(Math.max(1000,Math.min(1600,width/columns*(devicePixelRatio||1)))/200)*200;}
 function imageFor(page:number){
  const pixels=rasterWidth(),paper=theme.paper,key=page+':'+pixels+':'+paper;if(!images.has(key)){
   const version=cacheVersion,persistentKey=documentKey+':'+key;images.set(key,(async()=>{
    const cached=await pageCache.get(persistentKey);if(version!==cacheVersion)throw Error('Page generation changed');
    engine.setCanvasTheme(theme.resolved==='dark',paper?'#fbf8ef':'none',theme.resolved==='dark'?'#18130e':'#e9e0cc');
    const src=cached?URL.createObjectURL(cached):engine.renderPage(page,pixels),image=new Image();image.src=src;await image.decode();
    if(!cached)void pageCache.put(persistentKey,src);const value={src,image};if(version===cacheVersion)decoded.set(key,value);else if(src.startsWith('blob:'))URL.revokeObjectURL(src);return value;
   })());
  }return images.get(key)!;
 }
 function layoutPage(page:number,start:number,bitmap:PageBitmap):Visible{
  const gap=columns===2?12:0,slot=(width-gap)/columns,m=metrics[page];const scale=Math.min(slot/m.w,height/m.h),w=m.w*scale,h=m.h*scale;
  return{page,bitmap,rect:{x:(page-start)*(slot+gap)+(slot-w)/2,y:(height-h)/2,w,h}};
 }
 function scheduleWarm(){
  clearTimeout(warming);const version=generation,near=[...new Set([last+1,last+2,index-1,index-2,...(count<=32?Array.from({length:count},(_,i)=>i):[])])].filter(p=>p>=0&&p<count&&(p<index||p>last));
  const next=async()=>{
   if(version!==generation||!near.length)return;
   const page=near[0],far=page<index-2||page>last+2;
   if(performance.now()-lastInput<600||(far&&engine.playing)){warming=setTimeout(next,500);return;}
   near.shift();try{await imageFor(page);}catch{}
   evict();if(version===generation)warming=setTimeout(next,200);
  };warming=setTimeout(next,120);evict();
 }
 function evict(){for(const [key,value] of decoded){const page=Number(key.split(':')[0]);if(page<index-2||page>last+2){if(value.src.startsWith('blob:'))URL.revokeObjectURL(value.src);images.delete(key);decoded.delete(key);}}}
 export async function showPage(page:number){
  if(!metrics.length||!width||!height)return;
  focusPage=Math.max(0,Math.min(count-1,page));const start=Math.floor(focusPage/columns)*columns,end=Math.min(count-1,start+columns-1),version=++generation;busy=true;
  try{
   const wanted=Array.from({length:end-start+1},(_,i)=>start+i),bitmaps=await Promise.all(wanted.map(imageFor));if(version!==generation)return;
   pages=wanted.map((p,i)=>layoutPage(p,start,bitmaps[i]));index=start;last=end;zoom=1;dx=dy=0;busy=false;loaded=true;scheduleWarm();
  }catch(e){if(version===generation){busy=false;onerror?.(e instanceof Error?e.message:'页面暂时未能显示');}}
 }
 export function turn(delta:number){lastInput=performance.now();void showPage(index+delta*columns);}
 function pose(r:Rect):Rect{return{x:r.x*zoom+dx,y:r.y*zoom+dy,w:r.w*zoom,h:r.h*zoom};}
 function limit(){
  if(!pages.length)return;const all=pages.map(p=>pose(p.rect)),left=Math.min(...all.map(r=>r.x)),right=Math.max(...all.map(r=>r.x+r.w)),top=Math.min(...all.map(r=>r.y)),bottom=Math.max(...all.map(r=>r.y+r.h));
  if(right-left<=width)dx+=(width-left-right)/2;else dx+=Math.max(width-right,Math.min(-left,0));
  if(bottom-top<=height)dy+=(height-top-bottom)/2;else dy+=Math.max(height-bottom,Math.min(-top,0));
 }
 function zoomView(f:number,cx:number,cy:number,x:number,y:number){lastInput=performance.now();const next=Math.max(1,Math.min(4,zoom*f));f=next/zoom;dx=(dx-cx)*f+cx+x;dy=(dy-cy)*f+cy+y;zoom=next;if(zoom===1)dx=dy=0;else limit();}
 function tap(e:PointerEvent){
  const target=pages.find(p=>{const r=pose(p.rect);return e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h;});
  if(target){const r=pose(target.rect);focusPage=target.page;engine.selectPageAt(target.page,(e.clientX-r.x)/r.w,(e.clientY-r.y)/r.h);}
  else if(pages.length&&e.clientX<pose(pages[0].rect).x)turn(-1);
  else if(pages.length&&e.clientX>pose(pages.at(-1)!.rect).x+pose(pages.at(-1)!.rect).w)turn(1);
  else engine.selectPageAt(index,0,0);
 }
 $effect(()=>{const mark=()=>lastInput=performance.now();surface.addEventListener('pointerdown',mark,true);return()=>surface.removeEventListener('pointerdown',mark,true);});
 $effect(()=>readerGestures(surface,{enabled:e=>e.target===surface,gallery:()=>true,zoomed:()=>zoom>1.01,tap,turn,pan:(x,y)=>{lastInput=performance.now();dx+=x;dy+=y;limit();},zoom:zoomView,cancel:()=>ongesture?.()}));
 $effect(()=>{documentKey;if(engine.status!=='ready'||engine.opening)return;untrack(()=>{try{metrics=engine.pageMetrics();count=metrics.length;const state=engine.pageView(-1,innerWidth,innerHeight);focusPage=state.index;}catch(e){onerror?.(String(e));}});});
 $effect(()=>{width;height;columns;if(!metrics.length)return;untrack(()=>void showPage(focusPage));});
 $effect(()=>{documentKey;theme.paper;const change=engine.changeSeq;untrack(()=>{cacheVersion++;generation++;for(const v of decoded.values())if(v.src.startsWith('blob:'))URL.revokeObjectURL(v.src);images.clear();decoded.clear();if(!engine.opening&&metrics.length&&width&&height)void showPage(focusPage);});});
 $effect(()=>{const cursor=engine.position.cursor;if(autoTurn&&engine.playing&&cursor){focusPage=cursor.page;if(cursor.page<index||cursor.page>last)untrack(()=>void showPage(cursor.page));}});
 $effect(()=>{const seq=engine.selectionSeq;if(engine.selection.none||engine.playing){selected=null;return;}untrack(()=>{const s=engine.selectionImage(rasterWidth());selected=s.src&&s.page!=null?{page:s.page,src:s.src,rect:{x:s.x!,y:s.y!,w:s.w!,h:s.h!}}:null;});});
 function symbolPose(page:number,r:Rect){const p=pages.find(p=>p.page===page);if(!p)return;const box=pose(p.rect);return{x:box.x+r.x*box.w,y:box.y+r.y*box.h,w:r.w*box.w,h:r.h*box.h};}
 $effect(()=>{selectionRect=selected?symbolPose(selected.page,selected.rect):undefined;});
 $effect(()=>()=>{generation++;cacheVersion++;clearTimeout(warming);for(const v of decoded.values())if(v.src.startsWith('blob:'))URL.revokeObjectURL(v.src);images.clear();decoded.clear();});
</script>
<div class="score-gallery gallery-backdrop" bind:this={surface} bind:clientWidth={width} bind:clientHeight={height} data-layout={columns===2?'double':'single'} aria-busy={busy}>
 {#each pages as p (p.page)}{@const r=pose(p.rect)}<img class="gallery-page" data-page={p.page} src={p.bitmap.src} alt={'乐谱第 '+(p.page+1)+' 页'} draggable="false" style:left={r.x+'px'} style:top={r.y+'px'} style:width={r.w+'px'} style:height={r.h+'px'}/>{/each}
 {#if selected&&selectionRect&&!engine.playing}<img class="selected-glyph" src={selected.src} alt="原生选中音符" style:left={selectionRect.x+'px'} style:top={selectionRect.y+'px'} style:width={selectionRect.w+'px'} style:height={selectionRect.h+'px'}/>{/if}
 {#if engine.playing&&engine.position.cursor}{@const c=engine.position.cursor}{@const r=symbolPose(c.page,{x:c.x,y:c.y,w:c.w,h:c.h})}{#if r}<span class="playback-line" aria-label="播放进度" style:left={r.x+'px'} style:top={r.y+'px'} style:width={Math.max(2,r.w)+'px'} style:height={r.h+'px'}></span>{/if}{/if}
 {#if busy&&!pages.length}<span class="preparing" role="status">正在准备乐谱页面…</span>{/if}
</div>
<style>
 .score-gallery{position:absolute;inset:0;overflow:hidden;pointer-events:auto;touch-action:none;background:var(--parchment-deep);}.gallery-page,.selected-glyph{position:absolute;max-width:none;pointer-events:none;user-select:none;}.selected-glyph{z-index:2;}:global([data-theme=dark]) .gallery-page{filter:invert(1);}.playback-line{position:absolute;pointer-events:none;z-index:3;background:#2984e5b8;border-left:1px solid #2685ed;}.preparing{position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-soft);font-size:14px;pointer-events:none;}
</style>
