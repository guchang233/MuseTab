<script lang="ts">
 import {zh} from './zh';
 import type {Snippet} from 'svelte';import {registerBack} from '../../ui/back';
 let {title,onclose,children,width=560,height}:{title:string;onclose:()=>void;children:Snippet;width?:number;height?:number}=$props();
 $effect(()=>registerBack(()=>{onclose();return true;},100));
</script>
<div class="aria-sheet-layer"><button class="sheet-shade" aria-label={zh('Close '+title)} onclick={onclose}></button><div class="aria-sheet" role="dialog" aria-modal="true" aria-label={zh(title)} tabindex="-1" style:width={'min('+width+'px,100%)'} style:height={height?Math.min(height,innerHeight*.88)+'px':undefined}><div class="sheet-handle"></div>{@render children()}</div></div>
<style>.aria-sheet-layer{position:fixed;inset:0;z-index:80;background:transparent;display:flex;align-items:end;justify-content:center;pointer-events:auto;}.sheet-shade{position:absolute;inset:0;background:#0005;border-radius:0;}.aria-sheet{position:relative;max-height:88dvh;background:var(--aria-sunken);border-radius:28px 28px 0 0;overflow:auto;box-shadow:0 -4px 24px #0002;color:var(--aria-ink);padding-bottom:env(safe-area-inset-bottom);font:14px var(--font-ui);}.sheet-handle{width:32px;height:4px;border-radius:2px;background:var(--aria-line);margin:12px auto 8px;}</style>
