<script lang="ts">
  import { fade } from 'svelte/transition';
  import { untrack } from 'svelte';
  import { nav } from './ui/nav.svelte';
  import { ms } from './ui/motion';
  import Library from './library/Library.svelte';
  import Reader from './reader/Reader.svelte';
  import Editor from './composer/aria/AriaEditor.svelte';
  import Player from './player/Player.svelte';
  import EngineView from './bridge/EngineView.svelte';
  import { engine } from './bridge/engine.svelte';
  import { editorInset } from './editor/layout.svelte';
  import { theme } from './ui/theme.svelte';
  import { workspace } from './library/workspace.svelte';
  import { library } from './library/store.svelte';
  import PdfReader from './reader/PdfReader.svelte';
  import { reading } from './reader/layout.svelte';
  import Spinner from './ui/Spinner.svelte';
  import {activity} from './ui/activity.svelte';
  import {registerBack} from './ui/back';
  import {closeComposer} from './workspace/modes';
  import {dispatchComposerAction,flushComposer} from './composer/session';
  const isPdf = $derived(library.current?.ext === 'pdf');
  const baseScreen=$derived(nav.screen==='editor'?nav.composerParent:nav.screen);
  $effect(()=>{if(nav.screen==='editor')return registerBack(()=>{void closeComposer();return true;},45);});
  $effect(()=>{
    const mode=nav.screen;if(engine.status!=='ready')return;
    queueMicrotask(()=>{if(nav.screen!==mode)return;engine.setViewOnly(mode==='reader'||mode==='library');engine.setEditLocked(mode==='player');});
  });
  $effect(()=>{if(activity.message)return registerBack(()=>true,200);});
  $effect(() => {
    theme.resolved;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--parchment').trim();
    window.Android?.setSystemBars?.(bg, theme.resolved !== 'dark');
  });
  let importError=$state('');
  $effect(()=>{
    const report=(e:Event)=>{importError=(e as CustomEvent<string>).detail;};
    addEventListener('musetab-error',report);
    return()=>removeEventListener('musetab-error',report);
  });

  $effect(()=>{
    const seq=engine.changeSeq;
    const playing=engine.playing;
    const id=library.current?.id;
    if(!id||isPdf||!seq||!engine.dirty||engine.opening||playing)return;
    const timer=setTimeout(()=>{workspace.persist().catch(()=>{});},2000);
    return()=>clearTimeout(timer);
  });
  $effect(()=>{const saveOnHide=()=>{if(document.hidden)void workspace.persist().catch(()=>{});};document.addEventListener('visibilitychange',saveOnHide);return()=>document.removeEventListener('visibilitychange',saveOnHide);});

  $effect(()=>{
    if(engine.saveRequestSeq)untrack(()=>workspace.persist(true).catch(()=>{}));
  });

  function onkey(e:KeyboardEvent){
    if(!(e.ctrlKey||e.metaKey))return;
    if(e.key.toLowerCase()==='s'){e.preventDefault();void flushComposer().then(()=>workspace.persist(true)).catch(()=>{});}
    else if(!isPdf&&nav.screen==='editor'&&['z','y','c','x','v'].includes(e.key.toLowerCase())&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,[contenteditable]'))){
      e.preventDefault();
      const key=e.key.toLowerCase();
      const action=({c:'copy',x:'cut',v:'paste'} as Record<string,string>)[key]||(e.shiftKey||key==='y'?'redo':'undo');
      if(!dispatchComposerAction('action://notation/'+action))engine.dispatch('action://notation/'+action);
    }
  }

  // 谱纸是第一色，四周是第二色；dark 为真时反相，音符变浅。
  // 编谱的音符按深色四周绘制，四周必须保持深灰，否则浅色模式下谱线和音符会消失。
  $effect(() => {
    if (engine.status !== 'ready') return;
    const dark = theme.resolved === 'dark';
    const composer=nav.screen==='editor';
    const css=getComputedStyle(document.documentElement);
    const sheet=css.getPropertyValue('--sheet').trim()||'#fbf8ef';
    const deep=css.getPropertyValue('--parchment-deep').trim()||(dark?'#18130e':'#e9e0cc');
    engine.setCanvasTheme(composer?!theme.paper:dark, theme.paper?(composer?'#ffffff':sheet):'none', composer?'#3b3b40':deep);
  });

  const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
  // 没有翻开任何谱子时，看谱 / 编辑页无从显示，退回谱匣
  $effect(() => {
    if (nav.screen !== 'library' && !isPdf && engine.status === 'ready' && !engine.project.open && !engine.opening) {
      nav.go('library');
    }
  });
  $effect(() => { if (nav.screen !== 'reader' && reading.fullscreen) void reading.setFullscreen(false); });
</script>

<!-- 引擎画布常驻在各屏之下 -->
<svelte:window onkeydown={onkey}/>
<EngineView visible={nav.screen !== 'library' && !isPdf} inset={nav.screen === 'editor'||nav.screen==='player' ? editorInset.value : nav.screen === 'reader' ? { ...NONE, top: reading.top } : NONE} />

{#key baseScreen}
  <div class="screen" class:over={baseScreen !== 'library'} class:underlay={nav.screen==='editor'} inert={nav.screen==='editor'}>
    {#if baseScreen !== 'library' && isPdf}
      <PdfReader />
    {:else if baseScreen === 'reader'}
      <Reader active={nav.screen!=='editor'} />
    {:else if baseScreen === 'player'}
      <Player active={nav.screen!=='editor'} />
    {:else}
      <Library />
    {/if}
  </div>
{/key}
{#if nav.screen==='editor'}<div class="composer-layer"><Editor/></div>{/if}

{#if activity.message}
  <div class="busy-layer"><div class="busy-message" role="status" aria-live="polite"><Spinner/><span>{activity.message}</span></div></div>
{:else if nav.screen==='library'&&(engine.status==='loading'||engine.status==='idle')}
  <div class="engine-starting" role="status"><Spinner size={18}/><span>正在启动谱面引擎…</span></div>
{/if}

{#if workspace.error}
  <p class="save-error" role="alert">更改还没能保存：{workspace.error}</p>
{:else if importError}
  <p class="save-error" role="alert">{importError} <button onclick={()=>importError=''}>关闭</button></p>
{/if}

<style>
  .underlay{visibility:hidden;pointer-events:none;}
  .composer-layer{position:fixed;inset:0;z-index:6;pointer-events:none;}
  .busy-layer{position:fixed;inset:0;z-index:20;display:grid;place-items:center;pointer-events:auto;border-radius:0;cursor:progress;}.busy-message,.engine-starting{display:flex;align-items:center;gap:12px;padding:12px 18px;background:var(--material);color:var(--ink);border:0;border-radius:var(--island-radius);box-shadow:var(--island-ring),var(--island-shadow);backdrop-filter:blur(18px);font:500 14px/1.3 var(--font-ui);}.engine-starting{position:fixed;z-index:30;left:50%;bottom:90px;transform:translateX(-50%);pointer-events:none;white-space:nowrap;}
  .save-error{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:var(--z-toast);max-width:90%;padding:12px 16px;background:var(--material);color:var(--danger);border:0;border-radius:var(--island-radius);box-shadow:var(--island-ring),var(--island-shadow);backdrop-filter:blur(18px);font:500 14px/1.4 var(--font-ui);}
  .save-error button{min-height:44px;margin-left:12px;padding:0 12px;border-radius:var(--chip-radius);background:var(--veil);color:var(--ink);}
  .screen {
    position: fixed;
    inset: 0;
    /* 必须高于引擎画布。画布是原生图层，盖住它的区域收不到界面点击。 */
    z-index: 2;
  }
  /* 看谱 / 编辑两屏盖在引擎画布上：自身不拦手势，只有其中的控件可点 */
  .over {
    pointer-events: none;
  }
</style>
