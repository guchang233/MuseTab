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
    background: var(--material);
    border: 0;
    border-radius: var(--sheet-radius);
    box-shadow: var(--island-ring), var(--island-shadow);
  }
</style>
