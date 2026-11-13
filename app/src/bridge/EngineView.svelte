<!--
  引擎画布：整个应用只有一个，常驻不销毁（引擎启动要几秒，谱子也留在里面）。
  它铺在各屏之下，位置由当前屏通过 inset 指定；曲库页时隐藏。
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { engine } from './engine.svelte';

  type Props = {
    visible: boolean;
    /** 画布四边让出的距离（px）：编辑模式要给顶栏、底栏留位置 */
    inset?: { top: number; right: number; bottom: number; left: number };
  };
  let { visible, inset = { top: 0, right: 0, bottom: 0, left: 0 } }: Props = $props();

  let el: HTMLIFrameElement;
  $effect(() => {
    const target=el;
    untrack(()=>engine.attach(target));
  });
</script>

<div
  class="engine"
  class:hidden={!visible}
  style="top:{inset.top}px; right:{inset.right}px; bottom:{inset.bottom}px; left:{inset.left}px"
>
  <iframe bind:this={el} src="/engine/host.html" title="谱面" allow="autoplay"></iframe>

  {#if visible && engine.status !== 'ready'}
    <div class="veil">
      {#if engine.status === 'error'}
        <p class="display">谱面引擎没能启动</p>
        <p class="muted">{engine.error}</p>
      {:else}
        <p class="display">正在铺开谱纸…</p>
        <p class="muted">首次启动需要几秒钟</p>
      {/if}
    </div>
  {:else if visible && engine.opening}
    <div class="veil soft"><p class="display">正在翻开乐谱…</p></div>
  {/if}
</div>

<style>
  .engine {
    position: fixed;
    z-index: 0;
    background: var(--parchment-deep);
    transition:
      top var(--dur) var(--ease),
      right var(--dur) var(--ease),
      bottom var(--dur) var(--ease),
      left var(--dur) var(--ease);
  }
  /* 不用 display:none：那样引擎的画布尺寸会归零 */
  .hidden {
    visibility: hidden;
    pointer-events: none;
  }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 8px;
    text-align: center;
    background: var(--parchment-deep);
    color: var(--ink-soft);
  }
  .veil.soft {
    background: color-mix(in srgb, var(--parchment-deep) 82%, transparent);
  }
  .veil .display {
    font-size: var(--text-xl);
    color: var(--ink);
  }
</style>
