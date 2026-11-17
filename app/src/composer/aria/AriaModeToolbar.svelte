<script lang="ts">
 import {zh} from './zh';
  // Port of ScoreReaderModeToolbar / ScoreReaderModeToolbarButton and compact
  // equivalents. The seven primary tools and their ordering are intentional.
  import AriaSymbol from './AriaSymbol.svelte';
  import {tabletCategories,phoneCategories,ariaCategoryActive,ariaCategoryEnabled,type AriaCategory} from './reference';
  let {category,compact=false,tight=false,busy=false,measureSelection=false,singleMeasure=false,onselect}:{category:AriaCategory;compact?:boolean;tight?:boolean;busy?:boolean;measureSelection?:boolean;singleMeasure?:boolean;onselect:(category:AriaCategory)=>void}=$props();
  const icons:Record<string,string>={notes:'music.note.list',select:'cursorarrow',repeats:'repeat',text:'textformat',layout:'square.grid.2x2',more:'ellipsis'};
  const regularLabels:Record<string,string>={notes:'Note\nEntry',select:'Select',repeats:'Repeats',text:'Text',expression:'Expression',layout:'Layout',more:'More'};
  const compactLabels:Record<string,string>={notes:'Note',select:'Select',repeats:'Repeats',text:'Text',expression:'Expr',layout:'Layout',more:'More'};
</script>
<nav class="aria-mode-toolbar" class:compact class:tight aria-label="编谱工具">
  {#each (compact?phoneCategories:tabletCategories) as key,index}
    {#if !compact&&index===2}<span class="mode-divider" aria-hidden="true"></span>{/if}
    <button class:active={ariaCategoryActive(category,key)} aria-pressed={ariaCategoryActive(category,key)} disabled={!ariaCategoryEnabled(key,busy,measureSelection,singleMeasure)} onclick={()=>onselect(key)}>
      <span class="icon-slot" aria-hidden="true">{#if key==='expression'}<span class="expression-symbol">f</span>{:else}<AriaSymbol name={compact&&key==='notes'?'music.note':icons[key]} size={compact?18:17}/>{/if}{#if key==='notes'}<span class="plus-badge"><AriaSymbol name="plus.circle.fill" size={9}/></span>{/if}</span>
      <span class="tool-label">{zh(compact?compactLabels[key]:regularLabels[key])}</span>
    </button>
  {/each}
</nav>
<style>
 .aria-mode-toolbar{display:flex;align-items:center;width:max-content;gap:0;padding:8px 10px;background:var(--aria-material,var(--aria-material));border:0;box-shadow:inset 0 0 0 .7px var(--aria-line);border-radius:12px;color:var(--aria-ink,var(--aria-ink));backdrop-filter:blur(20px);}
 button{display:flex;flex:none;align-items:center;justify-content:center;gap:7px;height:34px;min-height:34px;padding:0 11px;border-radius:9px;background:transparent;border:0;font:500 12px/1.15 var(--font-ui);color:inherit;}
 button:disabled{opacity:.42;}.active{color:var(--aria-active,var(--aria-active));background:var(--aria-selection,var(--aria-selection));outline:.8px solid color-mix(in srgb, var(--aria-active) 28%, transparent);outline-offset:-.8px;}
 .icon-slot{position:relative;display:grid;place-items:center;flex:none;width:22px;height:22px;}.plus-badge{position:absolute;right:-5px;bottom:-4px;width:9px;height:9px;display:grid;place-items:center;border-radius:50%;background:var(--aria-surface);}
 .tool-label{white-space:pre;text-align:left;}.expression-symbol{font:italic 700 19px/1 Georgia,serif;transform:rotate(-3deg) translateY(1px);}.mode-divider{height:34px;width:1px;margin:0 6px;background:var(--aria-line);}
 .tight{padding-inline:4px;}.tight button{gap:4px;padding-inline:6px;font-size:11px;}.tight .mode-divider{margin-inline:3px;}
 .compact{width:100%;padding:0;border:0;border-radius:0;background:none;backdrop-filter:none;}.compact button{flex:1;min-width:0;flex-direction:column;gap:3px;height:62px;min-height:62px;padding:0;border-radius:10px;}.compact .icon-slot{width:24px;height:24px;}.compact .plus-badge{right:-4px;bottom:-2px;}.compact .tool-label{font-size:9px;line-height:1.2;font-weight:500;white-space:nowrap;}.compact .active .tool-label{font-weight:600;}.compact .expression-symbol{font-size:23px;transform:rotate(-3deg);}
</style>
