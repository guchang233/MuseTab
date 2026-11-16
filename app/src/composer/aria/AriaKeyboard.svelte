<script lang="ts">
 import {zh} from './zh';
 import {untrack} from 'svelte';
 import {naturalIndex,naturalPitch,visibleCount,clampStart,hitPitch,pitchName} from './keyboard';
 let {phone=false,landscape=false,enabled=true,activePitch,activePitches=[],follow=true,flats=false,onpitch}:{phone?:boolean;landscape?:boolean;enabled?:boolean;activePitch?:number;activePitches?:number[];follow?:boolean;flats?:boolean;onpitch:(pitch:number)=>void}=$props();
 let width=$state(600),height=$state(92),start=$state(naturalIndex(48)),translation=$state(0),drag=$state<{id:number;x:number;start:number}|null>(null),surface:HTMLDivElement;
 const count=$derived(visibleCount(width,phone,landscape)),whiteWidth=$derived(width/count);
 const keys=$derived(Array.from({length:count+2},(_,i)=>({pitch:naturalPitch(start+i-1),left:(i-1)*whiteWidth}))),blackWidth=$derived(Math.min(whiteWidth*.58,34));
 const blackKeys=$derived(keys.slice(0,-1).filter((k,i)=>keys[i+1].pitch-k.pitch===2&&k.pitch>=21&&keys[i+1].pitch<=108).map(k=>({pitch:k.pitch+1,left:k.left+whiteWidth-blackWidth/2})));
 $effect(()=>{const n=count;start=clampStart(start,n);});
 $effect(()=>{const pitch=activePitch,shouldFollow=follow;untrack(()=>{if(shouldFollow&&pitch!=null&&(pitch<naturalPitch(start)||pitch>naturalPitch(start+count-1)))start=clampStart(naturalIndex(pitch)-Math.floor(count/2),count);});});
 function active(p:number){return activePitches.length?activePitches.includes(p):p===activePitch;}
 function down(e:PointerEvent){if(!enabled)return;e.preventDefault();surface.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,start};}
 function move(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;if(Math.abs(dx)<=3){translation=0;return;}const delta=Math.trunc(dx/whiteWidth),next=clampStart(drag.start-delta,count);start=next;translation=next===drag.start-delta?dx-delta*whiteWidth:0;}
 function up(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;translation=0;drag=null;if(Math.abs(dx)>14)return;const r=surface.getBoundingClientRect(),pitch=hitPitch(e.clientX-r.left,e.clientY-r.top,width,height,start,count);if(pitch!=null)onpitch(pitch);}
</script>
<div class="aria-keyboard" class:disabled={!enabled} bind:this={surface} bind:clientWidth={width} bind:clientHeight={height} role="group" aria-label="钢琴键盘" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={()=>{drag=null;translation=0;}}>
 <div class="keyboard-track" style:transform={'translateX('+translation+'px)'} class:settling={!drag}>
 {#each keys as key (key.pitch)}<button tabindex={enabled&&key.pitch>=21&&key.pitch<=108?0:-1} class="natural" class:active={active(key.pitch)} style:left={key.left+'px'} style:width={whiteWidth+'px'} aria-label={zh('Piano '+pitchName(key.pitch,flats))} onclick={e=>{if(e.detail===0&&enabled&&key.pitch>=21&&key.pitch<=108)onpitch(key.pitch);}}>{#if key.pitch>=21&&key.pitch<=108&&(key.pitch%12===0||active(key.pitch))}<span>{pitchName(key.pitch,flats)}</span>{/if}</button>{/each}
 {#each blackKeys as key (key.pitch)}<button tabindex={enabled?0:-1} class="accidental" class:active={active(key.pitch)} style:left={key.left+'px'} style:width={blackWidth+'px'} aria-label={zh('Piano '+pitchName(key.pitch,flats))} onclick={e=>{if(e.detail===0&&enabled)onpitch(key.pitch);}}>{#if active(key.pitch)}<span style:font-size={phone&&!landscape?'7px':'9px'}>{pitchName(key.pitch,flats)}</span>{/if}</button>{/each}
 </div>
</div>
<style>
 .aria-keyboard{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;}.disabled{opacity:.55;}.keyboard-track{position:absolute;inset:0;pointer-events:none;}.settling{transition:transform .28s cubic-bezier(.2,.8,.2,1);}button{position:absolute;top:0;display:flex;align-items:end;justify-content:center;border:0;padding:0;border-radius:0;pointer-events:none;color:#000c;font-family:system-ui,sans-serif;}.natural{height:100%;background:#fff;border-right:1px solid #0000002e;font-size:20px;font-weight:500;}.natural span{padding-bottom:8px;}.natural.active{background:#e0edff;}.accidental{height:62px;background:#14171a;border-radius:4px;box-shadow:0 1px 2px #0005;color:white;}.accidental.active{background:#1f57c7;}.accidental span{font-weight:700;padding-bottom:5px;}button:focus-visible{outline:2px solid #1680f0;outline-offset:-3px;}
</style>
