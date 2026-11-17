<!-- 看谱 / 播放共用的悬浮顶栏：透明底，只有浮岛可点，无整宽底座。 -->
<script lang="ts">
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import ModeSwitch from './ModeSwitch.svelte';
  import type {ScoreMode} from './modes';
  let {
    title,
    mode,
    subtitle = '',
    fullscreen = false,
    height = $bindable(62),
    onback,
    onfullscreen,
    onedit,
    editLabel = '编辑',
    editActive = false,
  }: {
    title: string;
    mode: ScoreMode;
    subtitle?: string;
    fullscreen?: boolean;
    height?: number;
    onback: () => void;
    onfullscreen?: () => void;
    onedit?: () => void;
    editLabel?: string;
    editActive?: boolean;
  } = $props();
</script>

{#if fullscreen}
  <div class="exit"><IconButton label="退出全屏" icon="exit-fullscreen" onclick={onfullscreen} /></div>
{:else}
  <header class="score-chrome" bind:clientHeight={height}>
    <IconButton label="返回谱匣" icon="back" onclick={onback} />
    <div class="title-island">
      <span class="name">{title}</span>
      {#if subtitle}<small>{subtitle}</small>{/if}
    </div>
    {#if onfullscreen}<IconButton label="全屏看谱" icon="fullscreen" onclick={onfullscreen} />{/if}
    {#if onedit}
      <button class="edit-island" class:on={editActive} onclick={onedit}><Icon name="pen" size={20} /><span>{editLabel}</span></button>
    {:else}
      <ModeSwitch value={mode} />
    {/if}
  </header>
{/if}

<style>
  .score-chrome {
    position: absolute;
    inset: 0 0 auto;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left));
    box-sizing: border-box;
    pointer-events: none;
    background: transparent;
    border: 0;
  }
  .score-chrome > :global(*) {
    pointer-events: auto;
  }
  .title-island {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: var(--island-radius);
    background: var(--material);
    box-shadow: var(--island-ring), var(--island-shadow);
    backdrop-filter: blur(18px);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 16px / 1.25 var(--font-ui);
  }
  small {
    flex: none;
    color: var(--ink-soft);
    font-size: var(--text-xs);
  }
  .edit-island {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--island-radius);
    background: var(--material);
    box-shadow: var(--island-ring), var(--island-shadow);
    backdrop-filter: blur(18px);
    font: 500 14px / 1.2 var(--font-ui);
    flex: none;
  }
  .edit-island.on {
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
  @media (max-width: 700px) {
    .score-chrome :global(.mode-switch) {
      flex-basis: 100%;
      justify-content: stretch;
    }
    .score-chrome :global(.mode-switch button) {
      flex: 1;
    }
    .title-island {
      padding: 0 12px;
    }
    .name {
      font-size: 1rem;
    }
    small {
      display: none;
    }
  }
</style>
