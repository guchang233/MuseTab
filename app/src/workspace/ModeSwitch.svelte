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
  .mode-switch{display:flex;flex:none;gap:8px;align-items:center;}.view-modes{display:flex;gap:3px;padding:4px;border-radius:999px;background:var(--c-soft,var(--veil));}.compose{border:1px solid var(--c-line,var(--hairline));}
  button{min-width:58px;min-height:44px;padding:0 14px;border-radius:999px;color:var(--c-muted,var(--ink-soft));font:500 14px/1.4 var(--font-sans,system-ui);}
  button[aria-checked=true]{background:var(--c-raised,var(--rubric-wash));color:var(--c-ink,var(--ink));}
</style>
