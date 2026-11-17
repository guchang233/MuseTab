<!-- 纸条式浮层：一张压在谱面上的半透明羊皮纸条。发丝边框，只有一层极淡的投影。 -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Props = HTMLAttributes<HTMLDivElement> & { children: Snippet };
  let { children, class: cls = '', ...rest }: Props = $props();
</script>

<div class="slip {cls}" {...rest}>{@render children()}</div>

<style>
  .slip {
    background: var(--aria-material);
    border: 0;
    border-radius: var(--sheet-radius);
    outline: 0.7px solid var(--aria-line);
    outline-offset: -0.7px;
    box-shadow: var(--island-shadow);
  }
</style>
