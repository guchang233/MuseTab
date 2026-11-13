<!--
  图标按钮：44px 触控目标。内容可以是线条图标、SMuFL 字形，或任意子内容（如声部数字）。
  active 为选中态（赭红 + 底部一小段红线）；seal 为「火漆印」式实心赭红圆钮，只给播放键用。
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconName } from './Icon.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';

  type Props = HTMLButtonAttributes & {
    label: string;
    icon?: IconName;
    glyph?: GlyphName;
    glyphSize?: number;
    active?: boolean;
    seal?: boolean;
    children?: Snippet;
  };
  let { label, icon, glyph, glyphSize = 28, active = false, seal = false, children, ...rest }: Props = $props();
</script>

<button class="ib" class:active class:seal aria-label={label} title={label} aria-pressed={active || undefined} {...rest}>
  <span class="face">
    {#if icon}<Icon name={icon} />{/if}
    {#if glyph}<Glyph name={glyph} size={glyphSize} />{/if}
    {#if children}{@render children()}{/if}
  </span>
</button>

<style>
  .ib {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    flex: none;
    border-radius: 14px;
    color: var(--ink);
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .ib:hover {
    background: var(--veil);
  }
  .ib:active {
    background: var(--hairline-soft);
  }
  .ib:disabled {
    color: var(--ink-mute);
    opacity: 0.55;
    pointer-events: none;
  }
  .face {
    display: grid;
    place-items: center;
    grid-auto-flow: column;
    gap: 4px;
  }

  .active {
    color: var(--rubric);
    background: var(--rubric-wash);
  }
  .active::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 5px;
    width: 12px;
    height: 2px;
    border-radius: 2px;
    margin-left: -6px;
    background: var(--rubric);
  }

  .seal:hover,
  .seal:active {
    background: none;
  }
  .seal .face {
    width: 42px;
    height: 42px;
    box-shadow: 0 2px 10px color-mix(in srgb, var(--rubric) 28%, transparent);
    border-radius: 50%;
    background: var(--rubric);
    color: var(--on-rubric);
    transition: transform var(--dur) var(--ease);
  }
  .seal:active .face {
    transform: scale(0.94);
  }
</style>
