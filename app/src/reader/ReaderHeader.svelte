<script lang="ts">
  import '../workspace/workspace.css';
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
  <header class="workspace-header reading-header" bind:clientHeight={height}>
    <IconButton label="返回谱匣" icon="back" onclick={() => leave('library')} />
    <div class="workspace-title">
      <h1>{title}</h1>
      <p>看谱{editLabel === '批注' ? ' · PDF' : ''}</p>
    </div>
    <IconButton label="全屏看谱" icon="fullscreen" onclick={() => reading.setFullscreen(true)} />
    {#if onedit}<button class="workspace-button edit" class:on={active} onclick={onedit}><Icon name="pen" size={20} /><span>{editLabel}</span></button>{:else}<ModeSwitch value="reader"/>{/if}
  </header>
{/if}

<style>
  .reading-header {
    position: absolute;
    inset: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    pointer-events: auto;
    z-index: 30;
  }
  .edit.on {
    background: var(--rubric-wash);
    color: var(--rubric);
    box-shadow: var(--chip-ring), var(--island-shadow);
  }
  .exit {
    position: absolute;
    right: max(12px, env(safe-area-inset-right));
    top: max(12px, env(safe-area-inset-top));
    z-index: 8;
    pointer-events: auto;
  }
</style>
