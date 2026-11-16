<script lang="ts">
  import {changeMode,type ScoreMode} from './modes';
  let {value}:{value:ScoreMode}=$props();
  const modes=[{value:'reader',label:'看谱'},{value:'player',label:'播放'}] as const;
</script>
<div class="mode-switch" role="group" aria-label="乐谱工作区">
  <div class="view-modes" role="radiogroup" aria-label="浏览与播放">{#each modes as mode}<button role="radio" aria-checked={value===mode.value} onclick={()=>changeMode(mode.value)}>{mode.label}</button>{/each}</div>
  <button class="compose" aria-label="编谱" onclick={()=>changeMode('editor')}>编谱 ↗</button>
</div>
<style>
  .mode-switch{display:flex;flex:none;gap:8px;align-items:center;min-width:0;}.view-modes{display:flex;gap:4px;padding:4px;border-radius:var(--toolbar-radius);background:var(--paper);box-shadow:var(--island-ring);}.compose{border:0;color:var(--ink);background:var(--paper);box-shadow:var(--island-ring);}
  button{min-width:72px;min-height:48px;padding:0 16px;border-radius:var(--chip-radius);color:var(--ink);font:600 15px/1.2 var(--font-ui);transition:background-color var(--dur) var(--ease),color var(--dur) var(--ease);}
  button:active:not(:disabled){transform:scale(0.98);}
  button[aria-checked=true]{background:var(--rubric-wash);color:var(--rubric);box-shadow:var(--chip-ring);}
</style>
