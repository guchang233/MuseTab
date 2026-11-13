<!--
  滑出面板：从左或右缘滑出的一张纸条，压在谱面之上，高度随内容、不占满整边。
  位置（top/left/right/max-height）由使用处通过 class 或 style 决定。
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { ms, easeOut } from './motion';
  import IconButton from './IconButton.svelte';

  type Props = {
    open: boolean;
    side: 'left' | 'right';
    title: string;
    subtitle?: string;
    onclose: () => void;
    children: Snippet;
    width?: number;
  };
  let { open, side, title, subtitle, onclose, children, width = 232 }: Props = $props();
</script>

{#if open}
  <aside
    class="drawer {side}"
    style="width: {width}px"
    aria-label={title}
    transition:fly={{ x: side === 'left' ? -28 : 28, duration: ms(320), easing: easeOut }}
  >
    <header>
      <div class="heading">
        <h2>{title}</h2>
        {#if subtitle}<p class="label">{subtitle}</p>{/if}
      </div>
      <IconButton label="收起{title}" icon={side === 'left' ? 'collapse' : 'close'} onclick={onclose} />
    </header>
    <hr class="double-rule" />
    <div class="body">{@render children()}</div>
  </aside>
{/if}

<style>
  .drawer {
    position: absolute;
    top: 8px;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 16px);
    max-width: calc(100% - 16px);
    background: var(--parchment);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 28px -18px var(--shade);
    z-index: 3;
  }
  .left {
    left: 8px;
  }
  .right {
    right: 8px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 2px 2px 14px;
    min-height: 48px;
  }
  .heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  h2 {
    font-size: var(--text-md);
    letter-spacing: 0.2em;
    white-space: nowrap;
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.08em;
  }
  .double-rule {
    margin: 0 12px;
  }
  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    min-height: 0;
  }
</style>
