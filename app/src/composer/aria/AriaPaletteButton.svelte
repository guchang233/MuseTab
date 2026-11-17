<script lang="ts">
 import {zh} from './zh';
 import AriaSymbol from './AriaSymbol.svelte';
 import type {AriaTool} from './tools';
 let {tool,active=false,enabled=true,titled=true,grid=false,width,onaction}:{tool:AriaTool;active?:boolean;enabled?:boolean;titled?:boolean;grid?:boolean;width?:number;onaction:(tool:AriaTool,event:MouseEvent)=>void}=$props();
</script>
<button class="aria-palette-button" class:active class:grid class:untitled={!titled} style:width={width!=null?width+'px':grid?'100%':titled?'68px':'38px'} disabled={!enabled} aria-label={zh(tool.label||tool.id)} aria-pressed={active} onclick={event=>onaction(tool,event)}>
 <span class="glyph-slot">{#if tool.icon==='ScoreReaderStackedChord'}<span class="stacked-icon"></span>{:else if tool.icon}<AriaSymbol name={tool.icon} size={19}/>{:else}<span class:music={tool.music} class:small-symbol={(tool.symbol?.length||0)>1}>{tool.symbol}</span>{/if}</span>
 {#if titled}<span class="palette-label">{zh(tool.label)}</span>{/if}
</button>
<style>
 button{display:flex;flex:none;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:48px;min-height:0;padding:0;border:0;border-radius:6px;background:transparent;color:var(--aria-ink);font-family:var(--font-ui);}.glyph-slot{height:22px;display:grid;place-items:center;font-size:21px;font-weight:500;}.small-symbol{font-size:16px;}.music{font:25px/1 'Aria Bravura Text';}.music.small-symbol{font-size:21px;}.palette-label{font-size:9px;line-height:11px;max-width:100%;text-align:center;white-space:normal;}.untitled{height:32px;gap:0;}.untitled .glyph-slot{height:28px;}.active{background:var(--aria-active);color:var(--aria-on-active);}.grid{height:46px;border-radius:10px;background:color-mix(in srgb, var(--aria-surface) 58%, transparent);border:.7px solid var(--aria-line);}.grid .palette-label{display:none;}.grid .glyph-slot{height:100%;}.grid.active{color:var(--aria-active);background:var(--aria-selection);border-color:color-mix(in srgb, var(--aria-active) 24%, transparent);}.stacked-icon{width:27px;height:27px;background:currentColor;mask:url('/aria-symbols/ScoreReaderStackedChord.png') center/contain no-repeat;}button:disabled{opacity:.42;}
</style>
