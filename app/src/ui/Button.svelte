<!-- 文字按钮。primary 用朱砂赭红，一屏至多一个。 -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    variant?: 'plain' | 'primary' | 'quiet';
    children: Snippet;
  };
  let { variant = 'plain', children, ...rest }: Props = $props();
</script>

<button class="btn {variant}" {...rest}>{@render children()}</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--tap);
    padding: 0 18px;
    border: 0;
    border-radius: var(--chip-radius);
    background: var(--material);
    box-shadow: var(--island-ring), var(--island-shadow);
    backdrop-filter: blur(18px);
    font-size: var(--text-md);
    font-weight: 500;
    letter-spacing: 0;
    white-space: nowrap;
    transition:
      background-color var(--dur) var(--ease),
      border-color var(--dur) var(--ease),
      color var(--dur) var(--ease),
      transform var(--dur) var(--ease);
  }
  .btn:hover {
    background: var(--veil);
  }
  .btn:active {
    transform: scale(0.98);
    background: var(--hairline-soft);
  }
  .primary {
    background: var(--rubric);
    box-shadow: var(--island-shadow);
    color: var(--on-rubric);
  }
  .primary:hover,
  .primary:active {
    background: color-mix(in srgb, var(--rubric) 90%, var(--ink));
  }
  .quiet {
    background: transparent;
    box-shadow: none;
    padding: 0 12px;
  }
</style>
