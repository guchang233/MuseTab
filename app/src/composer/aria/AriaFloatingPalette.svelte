<script lang="ts">
 import {zh} from './zh';
 import AriaPaletteButton from './AriaPaletteButton.svelte';import AriaSymbol from './AriaSymbol.svelte';
 import {durations,dot,rest,tie,tuplets,accidentals,repeats,textTools,expressions,type AriaTool} from './tools';import type {AriaCategory} from './reference';
 let {category,landscape,left=true,maxHeight,enabled,selected,onaction,ondock}:{category:AriaCategory;landscape:boolean;left?:boolean;maxHeight:number;enabled:boolean;selected:(id:string)=>boolean;onaction:(t:AriaTool,e:MouseEvent)=>void;ondock:()=>void}=$props();
 const noteTools=$derived([...durations,dot,rest,tie,{id:'tuplets',label:'Tuplet',symbol:'3',menu:tuplets},...accidentals]);
 const items=$derived(category==='notes'?noteTools:category==='repeats'?repeats:category==='text'?textTools:expressions);
</script>
<aside class="aria-floating-palette" class:notes={category==='notes'} style:left={left?'16px':'auto'} style:right={left?'auto':'16px'} style:top={(category==='notes'&&landscape?108:148)+'px'} style:max-height={maxHeight+'px'} aria-label="编辑工具栏">
 {#each items as tool,index}{#if category==='notes'&&index>=durations.length}<span class="separator"></span>{/if}<AriaPaletteButton {tool} {enabled} active={selected(tool.id)} titled={category!=='notes'||(index>=durations.length&&tool.id!=='flat'&&tool.id!=='nat'&&tool.id!=='sharp')} {onaction}/>{/each}
 {#if !landscape}<span class="separator"></span><button class="dock-toggle" aria-label={zh(left?'Move palette right':'Move palette left')} onclick={ondock}><AriaSymbol name={left?'arrow.right':'arrow.left'} size={17}/></button>{/if}
</aside>
<style>.aria-floating-palette{position:absolute;z-index:10;display:flex;align-items:center;flex-direction:column;gap:5px;width:106px;padding:9px 7px;overflow-y:auto;scrollbar-width:none;background:#ffffffc4;backdrop-filter:blur(20px);border:0;outline:.5px solid #00000014;outline-offset:-.5px;border-radius:12px;box-shadow:0 6px 14px #0000001f;pointer-events:auto;}.notes{width:66px;}.separator{height:.5px;width:36px;background:#00000014;flex:none;}.dock-toggle{width:38px;height:30px;min-height:0;background:none;border:0;display:grid;place-items:center;padding:0;color:#0009;}</style>
