<script lang="ts">
  import { changeMode, type ScoreMode } from './modes';
  let { value }: { value: ScoreMode } = $props();
  const modes = [
    { value: 'reader', label: '看谱' },
    { value: 'player', label: '播放' },
  ] as const;
</script>
<div class="mode-switch" role="group" aria-label="乐谱工作区">
  <div class="island view-modes" role="radiogroup" aria-label="浏览与播放">
    {#each modes as mode}
      <button type="button" role="radio" aria-checked={value === mode.value} onclick={() => changeMode(mode.value)}>{mode.label}</button>
    {/each}
  </div>
  <div class="island compose-island">
    <button type="button" class="compose" aria-label="编谱" onclick={() => changeMode('editor')}>编谱 ↗</button>
  </div>
</div>
<style>
  .mode-switch {
    display: flex;
    flex: none;
    gap: 10px;
    align-items: center;
    min-width: 0;
    pointer-events: auto;
    color: var(--aria-ink);
    font: 500 14px var(--font-ui);
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
  }
  .view-modes {
    gap: 2px;
    padding-inline: 4px;
  }
  .compose-island {
    padding-inline: 5px;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    min-width: 52px;
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: none;
    color: var(--aria-muted);
    font: inherit;
    white-space: nowrap;
  }
  .compose {
    min-width: 44px;
    min-height: 44px;
    color: var(--aria-ink);
    border-radius: 0;
  }
  button[aria-checked='true'] {
    color: var(--aria-active);
    background: var(--aria-selection);
    box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--aria-active) 32%, transparent);
  }
  @media (max-width: 700px) {
    .mode-switch {
      gap: 8px;
    }
    button {
      min-width: 48px;
      padding: 0 10px;
    }
  }
</style>
