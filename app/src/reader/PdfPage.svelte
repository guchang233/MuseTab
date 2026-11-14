<script lang="ts">
  import Spinner from '../ui/Spinner.svelte';
  import {untrack} from 'svelte';
  import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist/legacy/build/pdf.mjs';
  import type {InkStroke} from '../library/store.svelte';
  import {theme} from '../ui/theme.svelte';
  import {pageArrival} from './page-motion';
  let {pdf,index,width,height,active,warm,arrival=0,strokes,draft,inking,oninkdown,oninkmove,oninkup}:{pdf:PDFDocumentProxy;index:number;width:number;height:number;active:boolean;warm:boolean;arrival?:number;strokes:InkStroke[];draft:InkStroke|null;inking:boolean;oninkdown:(e:PointerEvent,index:number)=>void;oninkmove:(e:PointerEvent)=>void;oninkup:(e:PointerEvent)=>void}=$props();
  let canvas:HTMLCanvasElement,surface:HTMLDivElement,near=$state(false),loaded=$state(false),error=$state('');
  let lastArrival=0;$effect(()=>{if(active&&loaded&&arrival&&arrival!==lastArrival){lastArrival=arrival;untrack(()=>pageArrival(surface));}});
  const path=(stroke:InkStroke)=>stroke.points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
  // Keep stored ink unchanged; make dark pen strokes readable on transparent dark paper.
  function ink(color:string){
    if(theme.paper||theme.resolved!=='dark'||!/^#[0-9a-f]{6}$/i.test(color))return color;
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    return Math.max(...rgb)<70&&Math.max(...rgb)-Math.min(...rgb)<25?'#eee8dc':color;
  }
  $effect(()=>{const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;},{root:surface.closest('.pdf-viewport'),rootMargin:'900px'});observer.observe(surface);return()=>observer.disconnect();});
  $effect(()=>{
    const doc=pdf,page=index,w=width,h=height,needed=near||warm;
    if(!canvas||!needed||w<1||h<1)return;
    let cancelled=false,task:RenderTask|undefined;
    const timer=setTimeout(async()=>{
      try{
        const source=await doc.getPage(page);if(cancelled)return;
        const natural=source.getViewport({scale:1}),ratio=Math.min(devicePixelRatio||1,2,2400/w,3400/h);
        const view=source.getViewport({scale:w/natural.width*ratio}),buffer=document.createElement('canvas');
        buffer.width=Math.ceil(view.width);buffer.height=Math.ceil(view.height);
        task=source.render({canvasContext:buffer.getContext('2d')!,viewport:view});await task.promise;
        if(cancelled)return;
        // Swap a completed bitmap in one task: never expose half-painted staves.
        canvas.width=buffer.width;canvas.height=buffer.height;canvas.getContext('2d')!.drawImage(buffer,0,0);loaded=true;error='';
      }catch(e){if(!cancelled)error=e instanceof Error?e.message:'页面未能显示';}
    },untrack(()=>loaded)?120:0);
    return()=>{cancelled=true;clearTimeout(timer);task?.cancel();};
  });
</script>
<div class="pdf-surface" class:ready={loaded} data-page={index} data-active={active} bind:this={surface} style:width={width+'px'} style:height={height+'px'}>
  <canvas bind:this={canvas} aria-label="PDF 第 {index} 页"></canvas>
  {#if !loaded}<span class="placeholder" role="status"><Spinner size={24}/><span>正在准备第 {index} 页…</span></span>{/if}
  {#if error}<span class="placeholder error" role="alert">{error}</span>{/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg class:inking viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="第 {index} 页本地手写批注" onpointerdown={e=>oninkdown(e,index)} onpointermove={oninkmove} onpointerup={oninkup} onpointercancel={oninkup}>
    {#each strokes as stroke}<path d={path(stroke)} stroke={ink(stroke.color)} stroke-width={stroke.width} vector-effect="non-scaling-stroke"/>{/each}
    {#if draft}<path d={path(draft)} stroke={ink(draft.color)} stroke-width={draft.width} vector-effect="non-scaling-stroke"/>{/if}
  </svg>
</div>
<style>
  .pdf-surface{position:relative;flex:none;background:white;box-shadow:0 3px 12px #0002;touch-action:none;}
  canvas{display:block;width:100%;height:100%;}
  svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;fill:none;stroke-linecap:round;stroke-linejoin:round;}
  svg.inking{pointer-events:auto;touch-action:none;cursor:crosshair;}
  .placeholder{position:absolute;inset:0;display:grid;place-items:center;color:#777;font-size:14px;pointer-events:none;}.error{color:var(--rubric);}
</style>
