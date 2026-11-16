<script lang="ts">
 import {zh} from './zh';
 let {value,color,compact=false,label,onchange}:{value:number;color:string;compact?:boolean;label:string;onchange:(v:number)=>void}=$props();
 let surface:HTMLDivElement,drag=$state<number|null>(null),height=$state(138);
 const diameter=$derived(compact?22:28),travel=$derived(Math.max(height-diameter,1)),thumb=$derived(diameter/2+(1-Math.min(1,Math.max(0,value)))*travel);
 function update(e:PointerEvent){const rect=surface.getBoundingClientRect();onchange(Math.min(1,Math.max(0,1-(e.clientY-rect.top-diameter/2)/travel)));}
 function down(e:PointerEvent){e.preventDefault();surface.setPointerCapture(e.pointerId);drag=e.pointerId;update(e);}
</script>
<div bind:this={surface} bind:clientHeight={height} class="fader" class:compact style:--fader-color={color} role="slider" tabindex="0" aria-label={zh(label)} aria-valuenow={Math.round(value*100)} aria-valuemin={0} aria-valuemax={100} aria-orientation="vertical" onpointerdown={down} onpointermove={e=>{if(drag===e.pointerId)update(e);}} onpointerup={()=>drag=null} onpointercancel={()=>drag=null} onkeydown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();onchange(Math.min(1,Math.max(0,value+(e.key==='ArrowUp'?.05:-.05))));}}}><div class="track"></div><div class="fill" style:top={thumb+'px'}></div><div class="thumb" style:top={thumb-diameter/2+'px'}></div></div>
<style>.fader{position:relative;width:44px;height:100%;touch-action:none;cursor:pointer;}.track,.fill{position:absolute;left:calc(50% - 2px);width:4px;bottom:0;border-radius:2px;}.track{top:0;background:#0003;}.fill{background:var(--fader-color);}.thumb{position:absolute;left:calc(50% - 14px);width:28px;height:28px;border-radius:50%;background:white;box-shadow:0 2px 4px #00000029;outline:.5px solid #0002;}.compact{width:34px;}.compact .thumb{left:calc(50% - 11px);width:22px;height:22px;}.fader:focus-visible{outline:2px solid #007aff;border-radius:8px;}</style>
