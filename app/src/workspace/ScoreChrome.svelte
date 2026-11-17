<!-- 看谱 / 播放顶栏：与编谱 AriaChrome 同一套浮岛样式（描边岛、返回+标题合并）。 -->
<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import ModeSwitch from './ModeSwitch.svelte';
  import type { ScoreMode } from './modes';
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
  <div class="exit">
    <div class="island">
      <button type="button" aria-label="退出全屏" onclick={onfullscreen}><Icon name="exit-fullscreen" size={20} /></button>
    </div>
  </div>
{:else}
  <header class="score-chrome" bind:clientHeight={height}>
    <div class="leading">
      <div class="island back-island">
        <button type="button" aria-label="返回谱匣" onclick={onback}>
          <Icon name="back" size={20} />
          <span class="title">{title}</span>
          {#if subtitle}<small>{subtitle}</small>{/if}
        </button>
      </div>
    </div>
    <div class="trailing">
      {#if onfullscreen}
        <div class="island icon-island">
          <button type="button" aria-label="全屏看谱" onclick={onfullscreen}><Icon name="fullscreen" size={20} /></button>
        </div>
      {/if}
      {#if onedit}
        <div class="island edit-island" class:on={editActive}>
          <button type="button" aria-label={editLabel} onclick={onedit}><Icon name="pen" size={18} /><span>{editLabel}</span></button>
        </div>
      {:else}
        <ModeSwitch value={mode} />
      {/if}
    </div>
  </header>
{/if}

<style>
  .score-chrome {
    position: absolute;
    inset: 0 0 auto;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 62px;
    padding: 10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
    box-sizing: border-box;
    pointer-events: none;
    background: transparent;
    border: 0;
    color: var(--aria-ink);
    font: 500 14px var(--font-ui);
  }
  .leading {
    display: flex;
    flex: 1;
    min-width: 0;
  }
  .trailing {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    margin-left: auto;
  }
  .island {
    height: 44px;
    display: flex;
    align-items: center;
    padding-inline: 8px;
    background: var(--aria-material);
    border: 0;
    outline: 0.7px solid var(--aria-line);
    outline-offset: -0.7px;
    border-radius: 18px;
    box-shadow: 0 8px 18px color-mix(in srgb, var(--aria-ink) 9%, transparent);
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }
  .back-island {
    padding-inline: 10px;
    max-width: min(340px, 58vw);
  }
  .back-island button {
    gap: 10px;
    min-width: 44px;
    max-width: 100%;
  }
  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 600;
  }
  small {
    flex: none;
    color: var(--aria-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .icon-island {
    padding-inline: 5px;
  }
  .icon-island button {
    min-width: 44px;
  }
  .edit-island button {
    gap: 7px;
    min-width: 72px;
    padding-inline: 6px;
  }
  .edit-island.on {
    color: var(--aria-active);
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    min-width: 44px;
    background: none;
    padding: 0;
    border: 0;
    color: inherit;
    border-radius: 0;
    cursor: pointer;
    font: inherit;
  }
  .exit {
    position: absolute;
    right: max(12px, env(safe-area-inset-right));
    top: max(12px, env(safe-area-inset-top));
    z-index: 40;
    pointer-events: none;
  }
  .exit .island {
    pointer-events: auto;
  }

  @media (max-width: 700px) {
    .score-chrome {
      gap: 8px;
      padding-block: 8px;
    }
    .trailing {
      gap: 8px;
    }
    .back-island {
      padding-inline: 5px;
      max-width: min(220px, 42vw);
    }
    .title {
      font-size: 15px;
    }
    small {
      display: none;
    }
  }
</style>
