<script lang="ts">
  import {untrack} from 'svelte';
  import '../workspace/workspace.css';
  import {engine} from '../bridge/engine.svelte';
  import {library} from '../library/store.svelte';
  import {editorInset} from '../editor/layout.svelte';
  import ScorePanels from '../editor/ScorePanels.svelte';
  import ScoreSettings from '../editor/ScoreSettings.svelte';
  import ModeSwitch from '../workspace/ModeSwitch.svelte';
  import {changeMode} from '../workspace/modes';
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import {registerBack} from '../ui/back';
  import {fitScore} from '../workspace/fit';
  let {active=true}:{active?:boolean}=$props();
  let top=$state(70),bottom=$state(100),width=$state(0);
  let panel=$state<'parts'|'mixer'|null>(null),settings=$state<'page'|'style'|null>(null);
  let duration=$state(0);
  const docked=$derived(width>=1100&&!!panel);
  const title=$derived(library.current?.displayName||engine.project.title||library.current?.name||'乐谱');
  const time=$derived(Math.floor(engine.position.secs/60)+':'+String(Math.floor(engine.position.secs%60)).padStart(2,'0'));
  $effect(()=>{if(active)editorInset.set({top,bottom,left:0,right:docked?392:0});});
  $effect(()=>{if(!active)return;engine.status;engine.project.open;width;docked;return fitScore();});
  $effect(()=>{engine.status;engine.changeSeq;engine.tempoMultiplier;untrack(()=>duration=engine.playbackInfo().duration);});
  $effect(()=>{if(active)return registerBack(()=>{if(settings)return false;if(panel){panel=null;return true;}return false;},40);});
  function openSettings(kind:'page'|'style'){engine.pause();settings=kind;}
</script>
<svelte:window bind:innerWidth={width}/>
<div class="player score-workspace zf-app">
  <header class="workspace-header" bind:clientHeight={top}>
    <IconButton label="返回谱匣" icon="back" onclick={()=>changeMode('library')}/>
    <div class="workspace-title"><h1>{title}</h1><p>播放</p></div>
    <ModeSwitch value="player"/>
  </header>
  <main class="workspace-stage" class:docked>
    <div class="panel-buttons">
      <button class="workspace-button" aria-pressed={panel==='parts'} onclick={()=>panel=panel==='parts'?null:'parts'}><Icon name="view-single" size={18}/>声部</button>
      <button class="workspace-button" aria-pressed={panel==='mixer'} onclick={()=>panel=panel==='mixer'?null:'mixer'}><Icon name="sliders" size={18}/>混音器</button>
    </div>
    {#if active&&panel}<div class="panels" class:docked><ScorePanels kind={panel} structure={false} onclose={()=>panel=null} onsettings={openSettings}/></div>{/if}
  </main>
  <footer class="workspace-footer" bind:clientHeight={bottom}>
    {#if duration>0}<input class="progress" type="range" aria-label="播放进度" min="0" max={duration} step=".1" value={engine.position.secs} onchange={e=>engine.seekSeconds(Number(e.currentTarget.value))}/>{/if}
    <div class="transport">
      <IconButton label="回到开头" icon="rewind" onclick={()=>engine.dispatch('rewind')}/>
      <button class="workspace-button primary play" aria-label={engine.playing?'暂停':'播放'} onclick={()=>engine.togglePlay()}><Icon name={engine.playing?'pause':'play'} size={24}/>{engine.playing?'暂停':'播放'}</button>
      <IconButton label="停止播放" icon="stop" onclick={()=>engine.stop()}/>
      <output class="clock" aria-label="播放时间">{time}</output>
      <button class="workspace-button" aria-label="节拍器" aria-pressed={engine.action('metronome').checked} onclick={()=>engine.dispatch('metronome')}>节拍器</button>
      <label class="speed"><span>速度 {Math.round(engine.tempoMultiplier*100)}%</span><input type="range" aria-label="播放速度" min="40" max="160" step="5" value={engine.tempoMultiplier*100} oninput={e=>engine.setTempoMultiplier(Number(e.currentTarget.value)/100)}/></label>
    </div>
  </footer>
</div>
{#if settings}<ScoreSettings kind={settings} onclose={()=>settings=null}/>{/if}
<style>
  .panel-buttons{position:absolute;top:12px;right:12px;display:flex;gap:6px;pointer-events:auto;z-index:3;background:var(--paper);padding:4px;border-radius:var(--toolbar-radius);box-shadow:var(--island-ring);}
  .panels{pointer-events:auto;}.panels.docked{position:absolute;right:8px;top:76px;bottom:8px;width:376px;}.panels.docked :global(.score-panel){position:static;width:100%;max-height:100%;}
  .transport{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;width:min(920px,100%);margin-inline:auto;padding:6px;border-radius:var(--island-radius);background:var(--material);box-shadow:var(--island-ring),var(--island-shadow);backdrop-filter:blur(18px);}.transport :global(.ib){background:transparent;box-shadow:none;}.transport :global(.ib:hover){background:var(--veil);}.play{min-width:106px;}.clock{min-width:52px;font:600 15px/1.2 var(--font-ui);font-variant-numeric:tabular-nums;}.speed{display:flex;align-items:center;gap:14px;min-width:180px;max-width:320px;flex:1;font:500 13px/1.2 var(--font-ui);}.speed span{white-space:nowrap;}input{min-width:80px;min-height:44px;width:100%;accent-color:var(--rubric);} .progress{display:block;width:min(920px,100%);margin:0 auto 8px;height:28px;}
  @media(max-width:700px){.transport{gap:6px;}.transport>.workspace-button:not(.play){padding:0 12px;}.speed{flex-basis:100%;max-width:none;justify-content:center;}.speed input{max-width:220px;}.panel-buttons{top:8px;right:8px;}}
</style>
