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
    flat?: boolean;
    children?: Snippet;
  };
  let { label, icon, glyph, glyphSize = 28, active = false, seal = false, flat = false, children, ...rest }: Props = $props();
</script>

<button class="ib" class:active class:seal class:flat aria-label={label} title={label} aria-pressed={active || undefined} {...rest}>
  <span class="face">
    {#if icon}<Icon name={icon} />{/if}
    {#if glyph}<Glyph name={glyph} size={glyphSize} />{/if}
    {#if children}{@render children()}{/if}
  </span>
</button>

<style>
  .ib.flat{border-radius:3px;box-shadow:none;background:transparent;}
  .ib {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    flex: none;
    border-radius: var(--island-radius);
    color: var(--ink);
    background: var(--material);
    box-shadow: var(--island-ring), var(--island-shadow);
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease),
      transform var(--dur) var(--ease);
  }
  .ib:hover {
    background: color-mix(in srgb, var(--paper) 92%, var(--ink));
  }
  .ib:active:not(:disabled) {
    transform: scale(0.97);
  }
  .ib:disabled {
    color: var(--ink-mute);
    opacity: 0.4;
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
    box-shadow: var(--chip-ring), var(--island-shadow);
  }

  .seal {
    background: var(--rubric);
    color: var(--on-rubric);
    box-shadow: var(--island-shadow);
  }
  .seal:hover,
  .seal:active {
    background: color-mix(in srgb, var(--rubric) 88%, var(--ink));
    color: var(--on-rubric);
  }
  /* play 路径自带 fill；pause 等描边图标必须保留 stroke */
  .seal :global(.icon) {
    color: inherit;
  }
</style>
