<script lang="ts">
  import {engine} from '../bridge/engine.svelte';
  import Glyph,{type GlyphName} from '../ui/Glyph.svelte';
  import type {NoteIntent} from './session';
  let {onaction,intent,onintent}:{onaction:(code:string,label:string)=>void;intent:NoteIntent;onintent:(value:NoteIntent)=>void}=$props();
  const durations:{code:string;label:string;glyph:GlyphName}[]=[
    {code:'pad-note-1',label:'全音符',glyph:'noteWhole'},
    {code:'pad-note-2',label:'二分音符',glyph:'noteHalfUp'},
    {code:'pad-note-4',label:'四分音符',glyph:'noteQuarterUp'},
    {code:'pad-note-8',label:'八分音符',glyph:'note8thUp'},
    {code:'pad-note-16',label:'十六分音符',glyph:'note16thUp'},
    {code:'pad-note-32',label:'三十二分音符',glyph:'note32ndUp'},
    {code:'pad-note-64',label:'六十四分音符',glyph:'note64thUp'},
  ];
</script>
<section class="touch-input" aria-label="触屏音符输入">
  <div class="input-mode">
    <button class:chosen={engine.noteInput} aria-pressed={engine.noteInput} onclick={()=>onaction('note-input','切换音符输入')}>{engine.noteInput?'输入音符':'选择 / 输入'}</button>
    <div class="voices" aria-label="输入声部">{#each [1,2,3,4] as voice}<button title={'声部 '+voice} aria-label={'声部 '+voice} aria-pressed={intent.voice===voice} class:chosen={intent.voice===voice} onclick={()=>{onintent({...intent,voice});onaction('voice-'+voice,'切换声部');}}>{voice}</button>{/each}</div>
  </div>
  <div class="rhythm" aria-label="时值与节奏">
    {#each durations as duration}<button title={duration.label} aria-label={duration.label} aria-pressed={intent.duration===duration.code} class:chosen={intent.duration===duration.code} onclick={()=>{onintent({...intent,duration:duration.code,dotted:false});onaction(duration.code,duration.label);}}><Glyph name={duration.glyph}/></button>{/each}
    <button aria-pressed={intent.dotted} class:chosen={intent.dotted} onclick={()=>{onintent({...intent,dotted:!intent.dotted});onaction('pad-dot','附点');}}>附点</button>
    <button aria-pressed={intent.chord} class:chosen={intent.chord} onclick={()=>onintent({...intent,chord:!intent.chord})}>叠加和弦</button>
  </div>
</section>
<style>
  .touch-input{display:flex;flex-basis:100%;gap:12px;align-items:center;padding:6px 0;border-top:1px solid var(--c-line);min-width:0;}
  .input-mode,.voices,.rhythm{display:flex;align-items:center;gap:3px;}.input-mode{flex:none;}.rhythm{overflow:auto;min-width:0;scrollbar-width:thin;}
  button{min-width:44px;min-height:44px;flex:none;padding:4px 9px;border:1px solid transparent;border-radius:3px;display:flex;align-items:center;justify-content:center;white-space:nowrap;}.chosen{background:var(--c-raised);border-color:var(--c-line);color:var(--c-ink);}
  @media(max-width:700px){.touch-input{display:block;padding:4px 0;}.input-mode{justify-content:space-between;margin-bottom:4px;}.rhythm{gap:2px;}button{min-width:44px;}}
</style>
