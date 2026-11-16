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
  .mode-switch{display:flex;flex:none;gap:8px;align-items:center;}.view-modes{display:flex;gap:3px;padding:4px;border-radius:var(--radius-pill);background:var(--veil);border:1px solid var(--hairline-soft);}.compose{border:1px solid color-mix(in srgb, var(--rubric) 45%, var(--hairline));color:var(--rubric);background:var(--paper);}
  button{min-width:58px;min-height:44px;padding:0 14px;border-radius:var(--radius-pill);color:var(--ink-soft);font:500 14px/1.4 var(--font-ui);}
  button[aria-checked=true]{background:var(--paper);color:var(--rubric);box-shadow:var(--shadow-sm);}
</style>
