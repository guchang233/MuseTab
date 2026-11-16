<script lang="ts">
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import { reading } from './layout.svelte';
  import { nav } from '../ui/nav.svelte';
  import { engine } from '../bridge/engine.svelte';
  import { workspace } from '../library/workspace.svelte';
  import ModeSwitch from '../workspace/ModeSwitch.svelte';
  let { title, onedit, editLabel = '编辑', active = false }: { title: string; onedit?: () => void; editLabel?: string; active?: boolean } = $props();
  let height = $state(57);
  $effect(() => { if (!reading.fullscreen) reading.setHeader(height); });
  async function leave(to: 'library' | 'editor') {
    try { await workspace.persist(); } catch { return; }
    if (engine.playing) engine.stop();
    await reading.setFullscreen(false);
    nav.go(to);
  }
</script>

{#if reading.fullscreen}
  <div class="exit"><IconButton label="退出全屏" icon="exit-fullscreen" onclick={() => reading.setFullscreen(false)} /></div>
{:else}
  <header class="reading-header" bind:clientHeight={height}>
    <IconButton label="返回谱匣" icon="back" onclick={() => leave('library')} />
    <div class="title"><span class="display">{title}</span><small>看谱{editLabel === '批注' ? ' · PDF' : ''}</small></div>
    <IconButton label="全屏看谱" icon="fullscreen" onclick={() => reading.setFullscreen(true)} />
    {#if onedit}<button class="edit" class:on={active} onclick={onedit}><Icon name="pen" size={20} /><span>{editLabel}</span></button>{:else}<ModeSwitch value="reader"/>{/if}
  </header>
{/if}

<style>
  .reading-header {
    position:absolute;
    inset:0 0 auto;
    min-height:56px;
    padding:8px max(12px,env(safe-area-inset-right)) 8px max(12px,env(safe-area-inset-left));
    padding-top:max(8px,env(safe-area-inset-top));
    display:flex;
    gap:10px;
    align-items:center;
    pointer-events:auto;
    background:color-mix(in srgb, var(--parchment) 94%, transparent);
    border:0;
    border-bottom:1px solid var(--hairline);
    box-sizing:border-box;
    z-index:30;
  }
    .title {
    flex:1;
    min-width:0;
    display:flex;
    align-items:center;
    gap:10px;
    min-height:44px;
    padding:0 16px;
    border-radius:var(--island-radius);
    background:var(--paper);
    box-shadow:var(--island-ring);
  }
    .title>span {
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font:600 16px/1.25 var(--font-ui);
    font-style:normal;
  }
    small {
    flex:none;
    color:var(--ink-soft);
    font-size:var(--text-xs);
  }
    .edit {
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    min-height:44px;
    padding:0 14px;
    border:0;
    border-radius:var(--island-radius);
    background:var(--paper);
    box-shadow:var(--island-ring);
    font:500 14px/1.2 var(--font-ui);
    flex:none;
  }
    .edit.on {
    background:var(--rubric-wash);
    color:var(--rubric);
    box-shadow:var(--chip-ring),var(--island-shadow);
  }
    .exit {
    position:absolute;
    right:max(12px,env(safe-area-inset-right));
    top:max(12px,env(safe-area-inset-top));
    z-index:8;
    pointer-events:auto;
    border-radius:var(--island-radius);
    background:transparent;
    border:0;
    opacity:1;
  }
    @media(max-width:900px) {
    .reading-header {
      gap:8px;
      flex-wrap:wrap;
    }
    .reading-header :global(.mode-switch){flex-basis:100%;justify-content:stretch;margin-top:2px;}
    .reading-header :global(.mode-switch button){flex:1;min-height:48px;}
    .title {
      padding:0 4px;
    }
    .title>span {
      font-size:1rem;
    }
    small {
      display:none;
    }
    .edit {
      padding:0 10px;
    }
  }
</style>
