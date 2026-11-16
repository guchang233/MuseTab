<script lang="ts">
  import {untrack} from 'svelte';
  import {engine,type PaletteData,type PaletteInfo} from '../bridge/engine.svelte';
  import {PALETTE_ZH} from '../editor/palette';
  import {registerBack} from '../ui/back';
  let {groups,onapply,onclose}:{groups?:string[];onapply:(palette:number,cell:number,label:string)=>void;onclose:()=>void}=$props();
  let catalog=$state<(PaletteInfo&{index:number})[]>([]),selected=$state(-1),data=$state<PaletteData|null>(null),search=$state(''),busy=$state(false),error=$state('');
  $effect(()=>{if(engine.status==='ready')catalog=untrack(()=>engine.palettes().map((p,index)=>({...p,index})));});
  $effect(()=>registerBack(()=>{onclose();return true;},65));
  const visible=$derived(catalog.filter(p=>(!groups?.length||groups.includes(p.name))&&(!search||(PALETTE_ZH[p.name]||p.name).toLowerCase().includes(search.toLowerCase()))));
  async function open(index:number){selected=index;data=null;error='';busy=true;await new Promise(resolve=>setTimeout(resolve,16));try{const page=engine.palette(index);if(selected===index)data=page;}catch(e){error=String(e);}finally{if(selected===index)busy=false;}}
</script>
<div class="symbols-layer">
 <button class="symbol-shade" aria-label="关闭符号库" onclick={onclose}></button>
 <div class="symbol-dialog" role="dialog" aria-modal="true" aria-label="符号库" tabindex="-1">
  <header><h2>符号库</h2><button onclick={onclose}>关闭</button></header>
  <input aria-label="搜索符号分类" placeholder="搜索符号分类" bind:value={search}/>
  {#if groups?.length}<button class="all" onclick={()=>groups=undefined}>显示全部分类</button>{/if}
  <div class="symbol-body"><nav aria-label="符号分类">{#each visible as palette}<button class:selected={selected===palette.index} onclick={()=>open(palette.index)}>{PALETTE_ZH[palette.name]||palette.name}<small>{palette.cells}</small></button>{/each}</nav>
   <div class="cells">{#if busy}<p role="status">正在加载符号…</p>{:else if error}<p role="alert">{error}</p>{:else if data}{#each data.cells as cell,index}<button aria-label={cell.name} title={cell.name} onclick={()=>onapply(selected,index,cell.name)}><img alt="" draggable="false" src={'data:image/png;base64,'+cell.png}/><small>{cell.name}</small></button>{/each}{:else}<p>选择分类，再点记号添加到选中的音符或小节。</p>{/if}</div>
  </div>
 </div>
</div>
<style>
 .symbols-layer{position:fixed;inset:0;z-index:70;display:grid;place-items:center;pointer-events:auto;padding:16px;}.symbol-shade{position:absolute;inset:0;border-radius:0;background:#0005;}.symbol-dialog{position:relative;width:min(900px,100%);height:min(640px,calc(100dvh - 32px));display:flex;flex-direction:column;gap:8px;background:var(--c-card);border:1px solid var(--c-line);border-radius:3px;padding:12px;min-height:0;}header{display:flex;justify-content:space-between;align-items:center;}h2{font-size:18px;}button,input{min-height:44px;padding:8px 12px;border:1px solid var(--c-line);border-radius:3px;}input{background:var(--c-paper);color:var(--c-ink);}.all{align-self:start;}.symbol-body{display:flex;flex:1;min-height:0;gap:12px;}nav{width:180px;flex:none;overflow:auto;}nav button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;margin-bottom:4px;}.selected{background:var(--c-raised);}.cells{display:flex;align-content:start;flex-wrap:wrap;flex:1;overflow:auto;min-width:0;gap:6px;}.cells button{width:96px;min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:#fff;color:#222;}.cells img{max-width:65px;height:38px;object-fit:contain;}.cells small{font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}small{font-size:11px;color:var(--c-muted);}p{padding:12px;line-height:1.7;color:var(--c-muted);}@media(max-width:600px){.symbols-layer{padding:6px;}.symbol-dialog{height:calc(100dvh - 12px);padding:8px;}nav{width:120px;}nav button{font-size:12px;padding-inline:6px;}.cells button{width:76px;}.symbol-body{gap:6px;}}
</style>
