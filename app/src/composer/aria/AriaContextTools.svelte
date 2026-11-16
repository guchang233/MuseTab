<script lang="ts">
 import {zh} from './zh';
 import AriaPaletteButton from './AriaPaletteButton.svelte';
 import type {AriaTool} from './tools';
 let {items,phone=false,enabled=true,selected=()=>false,onaction}:{items:AriaTool[];phone?:boolean;enabled?:boolean;selected?:(id:string)=>boolean;onaction:(tool:AriaTool,event:MouseEvent)=>void}=$props();
</script>
<div class="aria-context-tools" class:phone>{#each items as tool,index}{#if index}<span class="context-divider"></span>{/if}<AriaPaletteButton {tool} active={selected(tool.id)} {enabled} {onaction}/>{/each}</div>
<style>.aria-context-tools{width:100%;display:flex;align-items:center;overflow-x:auto;min-height:58px;padding:7px 10px;background:#ffffffa8;border:0;box-shadow:inset 0 0 0 .7px #0000000f;border-radius:12px;scrollbar-width:none;}.aria-context-tools::-webkit-scrollbar{display:none;}.context-divider{height:36px;width:.5px;background:#0000001a;margin:0 2.25px;flex:none;}.phone{padding:4px;min-height:52px;border:0;border-radius:0;background:none;}</style>
