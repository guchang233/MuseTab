<script lang="ts">
  import { fade } from 'svelte/transition';
  import { untrack } from 'svelte';
  import { nav } from './ui/nav.svelte';
  import { ms } from './ui/motion';
  import Library from './library/Library.svelte';
  import Reader from './reader/Reader.svelte';
  import Editor from './editor/Editor.svelte';
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
  const isPdf = $derived(library.current?.ext === 'pdf');
  $effect(()=>{if(activity.message)return registerBack(()=>true,200);});
  $effect(() => {
    const dark = theme.resolved === 'dark';
    const home = nav.screen === 'library';
    window.Android?.setSystemBars?.(home ? dark ? '#2a2622' : '#f7f6f2' : dark ? '#201a14' : '#f3ecdd', !dark);
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
    if(e.key.toLowerCase()==='s'){e.preventDefault();workspace.persist(true).catch(()=>{});}
    else if(!isPdf&&nav.screen==='editor'&&['z','y','c','x','v'].includes(e.key.toLowerCase())&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,[contenteditable]'))){
      e.preventDefault();
      const key=e.key.toLowerCase();
      const action=({c:'copy',x:'cut',v:'paste'} as Record<string,string>)[key]||(e.shiftKey||key==='y'?'redo':'undo');
      engine.dispatch('action://notation/'+action);
    }
  }

  // 谱纸与画布底色跟随界面主题（值与 tokens.css 中的 --sheet / --parchment-deep 一致）
  $effect(() => {
    if (engine.status !== 'ready') return;
    const dark = theme.resolved === 'dark';
    engine.setCanvasTheme(dark, theme.paper ? '#fbf8ef':'none', dark ? '#18130e' : '#e9e0cc');
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
<EngineView visible={nav.screen !== 'library' && !isPdf} inset={nav.screen === 'editor' ? editorInset.value : nav.screen === 'reader' ? { ...NONE, top: reading.top } : NONE} />

{#key nav.screen}
  <div class="screen" class:over={nav.screen !== 'library'}>
    {#if nav.screen !== 'library' && isPdf}
      <PdfReader />
    {:else if nav.screen === 'reader'}
      <Reader />
    {:else if nav.screen === 'editor'}
      <Editor />
    {:else}
      <Library />
    {/if}
  </div>
{/key}

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
  .busy-layer{position:fixed;inset:0;z-index:150;display:grid;place-items:center;pointer-events:auto;border-radius:0;cursor:progress;}.busy-message,.engine-starting{display:flex;align-items:center;gap:12px;padding:16px 22px;background:var(--parchment);color:var(--ink);border:1px solid var(--hairline);border-radius:999px;box-shadow:var(--lift);}.engine-starting{position:fixed;z-index:30;left:50%;bottom:90px;transform:translateX(-50%);font-size:13px;pointer-events:none;white-space:nowrap;}
  .save-error{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100;max-width:90%;padding:12px 18px;background:var(--sheet);color:var(--rubric);border:1px solid currentColor;border-radius:8px;}
  .save-error button{min-height:44px;margin-left:12px;text-decoration:underline;}
  .screen {
    position: fixed;
    inset: 0;
    z-index: 1;
  }
  /* 看谱 / 编辑两屏盖在引擎画布上：自身不拦手势，只有其中的控件可点 */
  .over {
    pointer-events: none;
  }
</style>
