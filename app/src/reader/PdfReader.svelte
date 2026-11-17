<script lang="ts">
  import Spinner from '../ui/Spinner.svelte';
  import {tick,untrack} from 'svelte';
  import {registerBack} from '../ui/back';
  import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
  import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
  import {library,type PdfNotes,type InkStroke} from '../library/store.svelte';
  import ReaderHeader from './ReaderHeader.svelte';import PdfPage from './PdfPage.svelte';
  import IconButton from '../ui/IconButton.svelte';import {reading} from './layout.svelte';import {readerGestures} from './gestures.js';import {saveAs} from '../native';
  GlobalWorkerOptions.workerSrc=workerUrl;
  type Layout='horizontal'|'vertical'|'continuous';
  let pdf=$state.raw<PDFDocumentProxy|null>(null),sizes=$state<{w:number;h:number}[]>([]),pageNo=$state(1);
  let mode=$state<Layout>('vertical'),zoom=$state(1),panX=$state(0),panY=$state(0),width=$state(0),height=$state(0),toolHeight=$state(74);
  let loading=$state(true),error=$state(''),saved=$state(true),annotating=$state(false),erasing=$state(false),color=$state('#b33f35'),controls=$state(false);
  let notes=$state<PdfNotes>({}),draft=$state<InkStroke|null>(null),pointer:number|null=null,strokePage=$state(1);
  let viewport:HTMLDivElement,writes:Promise<void>=Promise.resolve();
  let turnPage=$state(0),turnSeq=$state(0);
  $effect(()=>registerBack(()=>{if(!annotating)return false;draft=null;pointer=null;annotating=false;return true;},40));
  const current=$derived(library.current),strokes=$derived(notes[pageNo]||[]);
  const layout=$derived(sizes.map(s=>{const base=reading.fullscreen?Math.min(width/s.w,height/s.h):mode==='horizontal'?Math.min((width-24)/s.w,(height-24)/s.h):Math.max(1,width-(mode==='continuous'?0:24))/s.w;return{w:s.w*base*zoom,h:s.h*base*zoom};}));
  const contentWidth=$derived(reading.fullscreen?width:Math.max(width,mode==='horizontal'?layout.reduce((n,s)=>n+s.w+24,0):Math.max(0,...layout.map(s=>s.w))+(mode==='continuous'?0:24)));
  const activeSize=$derived(layout[pageNo-1]||{w:0,h:0});
  $effect(()=>{
    const id=current?.id;if(!id)return;let cancelled=false,task:ReturnType<typeof getDocument>|undefined;loading=true;error='';
    (async()=>{try{
      const bytes=await library.bytes(id);if(cancelled)return;
      task=getDocument({data:bytes.slice(),cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',isEvalSupported:false});const doc=await task.promise;
      const dimensions=await Promise.all(Array.from({length:doc.numPages},async(_,i)=>{const page=await doc.getPage(i+1),r=page.getViewport({scale:1});return{w:r.width,h:r.height};}));
      const ink=await library.notes(id);if(cancelled)return;pdf=doc;sizes=dimensions;notes=ink;pageNo=1;zoom=1;
    }catch(e){if(!cancelled)error=e instanceof Error?e.message:'PDF 没能打开';}finally{if(!cancelled)loading=false;}})();
    return()=>{cancelled=true;void task?.destroy();};
  });
  $effect(()=>{const full=reading.fullscreen,style=mode;untrack(()=>{zoom=1;panX=panY=0;controls=false;if(full)annotating=false;void tick().then(()=>{if(!full)scrollToPage(pageNo);});});});
  function persist(){const id=current?.id;if(!id)return;const snapshot=$state.snapshot(notes);saved=false;writes=writes.catch(()=>{}).then(()=>library.saveNotes(id,snapshot)).then(()=>{saved=true;}).catch(e=>{error='批注尚未保存：'+String(e);});}
  function point(e:PointerEvent):[number,number]{const r=(e.currentTarget as Element).closest('.pdf-surface')!.getBoundingClientRect();return[Math.max(0,Math.min(1000,(e.clientX-r.x)/r.width*1000)),Math.max(0,Math.min(1000,(e.clientY-r.y)/r.height*1000))];}
  function erase(p:[number,number]){const ink=notes[strokePage]||[],remaining=ink.filter(s=>!s.points.some((a,i)=>{const b=s.points[Math.min(i+1,s.points.length-1)],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<18;}));if(remaining.length!==ink.length){notes[strokePage]=remaining;persist();}}
  function inkDown(e:PointerEvent,index:number){if(!annotating||pointer!==null)return;e.preventDefault();pageNo=strokePage=index;pointer=e.pointerId;(e.currentTarget as Element).setPointerCapture(pointer);if(erasing)erase(point(e));else{const p=point(e);draft={color,width:3,points:[p,[p[0]+.1,p[1]+.1]]};}}
  function inkMove(e:PointerEvent){if(e.pointerId!==pointer)return;if(erasing)erase(point(e));else draft?.points.push(point(e));}
  function inkUp(e:PointerEvent){if(e.pointerId!==pointer)return;if(draft){notes[strokePage]=[...(notes[strokePage]||[]),draft];draft=null;persist();}pointer=null;}
  function scrollToPage(index:number){const page=viewport?.querySelector<HTMLElement>('[data-wrapper="'+index+'"]');if(!page)return;viewport.scrollTo({left:mode==='horizontal'?page.offsetLeft-12:Math.max(0,(contentWidth-width)/2),top:mode==='horizontal'?0:page.offsetTop-12});}
  async function turn(delta:number){if(!pdf)return;const next=Math.max(1,Math.min(pdf.numPages,pageNo+delta));if(next!==pageNo){turnPage=next;turnSeq++;}pageNo=next;zoom=1;panX=panY=0;await tick();if(!reading.fullscreen)scrollToPage(pageNo);}
  function onScroll(){if(reading.fullscreen||!viewport)return;const target=mode==='horizontal'?viewport.scrollLeft+width/2:viewport.scrollTop+Math.min(height/2,200);let closest=Infinity,next=pageNo;for(const el of viewport.querySelectorAll<HTMLElement>('[data-wrapper]')){const center=mode==='horizontal'?el.offsetLeft+el.offsetWidth/2:el.offsetTop+Math.min(el.offsetHeight/2,200);if(Math.abs(center-target)<closest){closest=Math.abs(center-target);next=Number(el.dataset.wrapper);}}pageNo=next;}
  function clampPan(){panX=Math.max(-Math.max(0,(activeSize.w-width)/2),Math.min(Math.max(0,(activeSize.w-width)/2),panX));panY=Math.max(-Math.max(0,(activeSize.h-height)/2),Math.min(Math.max(0,(activeSize.h-height)/2),panY));}
  function changeZoom(factor:number,cx:number,cy:number,dx=0,dy=0){const r=viewport.getBoundingClientRect(),x=cx-r.x,y=cy-r.y,previous=zoom,next=Math.max(reading.fullscreen?1:.5,Math.min(4,previous*factor)),ratio=next/previous;
    if(reading.fullscreen){panX=(panX+width/2-x)*ratio-width/2+x+dx;panY=(panY+height/2-y)*ratio-height/2+y+dy;zoom=next;clampPan();}
    else{const left=(viewport.scrollLeft+x)*ratio-x-dx,top=(viewport.scrollTop+y)*ratio-y-dy;zoom=next;void tick().then(()=>viewport.scrollTo(left,top));}
    controls=false;
  }
  function tap(e:PointerEvent){const box=viewport.querySelector<HTMLElement>('[data-wrapper="'+pageNo+'"]')?.getBoundingClientRect();if(box&&(e.clientX<box.x||e.clientX>box.right)){void turn(e.clientX<box.x?-1:1);return;}controls=!controls;}
  $effect(()=>readerGestures(viewport,{enabled:()=>true,inking:()=>annotating,gallery:()=>reading.fullscreen,zoomed:()=>zoom>1.01,tap,turn:delta=>void turn(delta),pan:(dx,dy)=>{if(reading.fullscreen){panX+=dx;panY+=dy;clampPan();}else{viewport.scrollLeft-=dx;viewport.scrollTop-=dy;}controls=false;},zoom:changeZoom,cancel:()=>{draft=null;pointer=null;}}));
  async function exportOriginal(){if(current)await saveAs(current.name+'.pdf',await library.bytes(current.id),'application/pdf');}
  function onkey(e:KeyboardEvent){if(e.key==='Escape'&&reading.fullscreen)void reading.setFullscreen(false);else if(e.key==='PageDown')void turn(1);else if(e.key==='PageUp')void turn(-1);}
</script>
<svelte:window onkeydown={onkey}/>
<div class="pdf-reader" class:gallery={reading.fullscreen} class:quiet={reading.fullscreen&&!annotating&&!controls}>
  <ReaderHeader title={current?.displayName||current?.name||'PDF'} editLabel="批注" active={annotating} onedit={()=>annotating=!annotating}/>
  <div class="pdf-viewport" bind:this={viewport} bind:clientWidth={width} bind:clientHeight={height} style:top={reading.top+'px'} style:bottom={(reading.fullscreen?0:toolHeight)+'px'} onscroll={onScroll}>
    {#if loading}<p class="status" role="status"><Spinner size={24}/> 正在打开本地 PDF…</p>{/if}{#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="page-space" class:horizontal={mode==='horizontal'} class:continuous={mode==='continuous'} style:width={contentWidth+'px'}>
      {#if pdf}{#each layout as size,i (i)}
        <div class="page-wrapper" data-wrapper={i+1} style:display={reading.fullscreen&&i+1!==pageNo?'none':undefined} style:left={reading.fullscreen?(width-size.w)/2+panX+'px':undefined} style:top={reading.fullscreen?(height-size.h)/2+panY+'px':undefined}>
          <PdfPage {pdf} index={i+1} width={size.w} height={size.h} active={i+1===pageNo} warm={Math.abs(i+1-pageNo)<=1} arrival={i+1===turnPage?turnSeq:0} strokes={notes[i+1]||[]} draft={strokePage===i+1?draft:null} inking={annotating} oninkdown={inkDown} oninkmove={inkMove} oninkup={inkUp}/>
        </div>
      {/each}{/if}
    </div>
  </div>
  {#if reading.fullscreen}<div class="gallery-number" style:bottom={(controls?toolHeight+12:12)+'px'} role="status">{pageNo} / {pdf?.numPages||'…'}</div>{/if}
  <footer class="pdf-tools" bind:clientHeight={toolHeight}>
    {#if annotating}<div class="ink-tools" role="toolbar" aria-label="PDF 批注工具">
      <IconButton label="画笔" icon="pen" active={!erasing} onclick={()=>erasing=false}/><IconButton label="橡皮（整笔擦除）" icon="eraser" active={erasing} onclick={()=>erasing=true}/>
      <button class="color red" class:on={color==='#b33f35'} aria-label="红色画笔" onclick={()=>{color='#b33f35';erasing=false;}}></button><button class="color blue" class:on={color==='#285b9d'} aria-label="蓝色画笔" onclick={()=>{color='#285b9d';erasing=false;}}></button>
      <IconButton label="撤销本页最后一笔" icon="undo" disabled={!strokes.length} onclick={()=>{notes[pageNo]=strokes.slice(0,-1);persist();}}/><small>{saved?'批注已存本地':'保存中…'}</small><button class="done" onclick={()=>annotating=false}>完成</button>
    </div>{/if}
    <div class="page-tools" role="toolbar" aria-label="PDF 看谱工具">
      <IconButton label="上一页" icon="back" disabled={pageNo<=1} onclick={()=>void turn(-1)}/><span class="page-number">{pageNo} / {pdf?.numPages||'…'}</span><IconButton label="下一页" icon="forward" disabled={!pdf||pageNo>=pdf.numPages} onclick={()=>void turn(1)}/>
      {#if !reading.fullscreen}<select aria-label="谱面排版" bind:value={mode}><option value="horizontal">横向排版</option><option value="vertical">竖向排版</option><option value="continuous">竖向连续</option></select>{/if}
      <button class="zoom" aria-label="缩放 {Math.round(zoom*100)}%（轻点还原）" onclick={()=>{zoom=1;panX=panY=0;void tick().then(()=>{if(!reading.fullscreen)scrollToPage(pageNo);});}}>{Math.round(zoom*100)}%</button><IconButton label="导出原始 PDF（不含本地批注）" icon="export" onclick={exportOriginal}/>
    </div>
  </footer>
</div>
<style>
  .pdf-reader{position:absolute;inset:0;pointer-events:auto;background:var(--parchment-deep);}
  .pdf-viewport{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;touch-action:none;scrollbar-width:thin;}
  .page-space{display:flex;flex-direction:column;align-items:center;gap:24px;padding:12px;min-height:100%;position:relative;}
  .page-space.horizontal{flex-direction:row;align-items:flex-start;gap:24px;}.page-space.continuous{gap:0;padding:0;}
  .page-wrapper{flex:none;position:relative;}
  .gallery .pdf-viewport{overflow:hidden;}.gallery .page-space{display:block;position:absolute;inset:0;padding:0;}.gallery .page-wrapper{position:absolute;}
  .gallery :global(.pdf-surface),.continuous :global(.pdf-surface){box-shadow:none;}
  .gallery-number{position:absolute;left:50%;transform:translateX(-50%);padding:4px 12px;border-radius:999px;background:var(--slip);color:var(--ink-soft);font-size:12px;pointer-events:none;}
  .quiet .pdf-tools{visibility:hidden;pointer-events:none;}
  .pdf-tools{position:absolute;bottom:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;background:transparent;border:0;padding:8px 8px max(10px,env(safe-area-inset-bottom));pointer-events:none;}
  .page-tools,.ink-tools{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;width:min(520px,calc(100% - 16px));padding:6px;border-radius:18px;background:var(--aria-material);outline:.7px solid var(--aria-line);outline-offset:-.7px;box-shadow:var(--island-shadow);backdrop-filter:blur(18px);pointer-events:auto;}
  .page-tools :global(.ib),.ink-tools :global(.ib){background:transparent;box-shadow:none;}
  .page-tools :global(.ib.active),.ink-tools :global(.ib.active){background:var(--rubric-wash);box-shadow:var(--chip-ring);}
  .page-number{min-width:56px;text-align:center;font-variant-numeric:tabular-nums;}.zoom,.done{min-height:44px;padding:0 14px;border-radius:var(--island-radius);background:var(--material);box-shadow:var(--island-ring),var(--island-shadow);font:500 14px/1.2 var(--font-ui);}
  select{min-height:44px;padding:0 12px;border:0;border-radius:var(--chip-radius);background:var(--material);box-shadow:var(--island-ring);color:var(--ink);font:500 14px var(--font-ui);}
  .color{width:44px;height:48px;display:grid;place-items:center;}.color::after{content:'';width:22px;height:22px;border-radius:50%;background:var(--color);border:3px solid var(--parchment);box-shadow:0 0 0 1px var(--hairline);}.color.on::after{box-shadow:0 0 0 2px var(--color);}.red{--color:#b33f35;}.blue{--color:#285b9d;}
  .ink-tools small{font-size:var(--text-xs);color:var(--ink-soft);}.status,.error{padding:24px;text-align:center;overflow-wrap:anywhere;}.error{color:var(--rubric);}
  @media(max-width:600px){.page-tools,.ink-tools{gap:2px;}.ink-tools small{display:none;}select{max-width:128px;}.pdf-tools{padding-inline:4px;}}
</style>
