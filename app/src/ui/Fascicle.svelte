<!--
  分册式列表：像手抄本的目录页。每册一行——罗马序号、册名、点线引导、条目数；
  点开后在行下展开该册内容，同一时间只开一册。
-->
<script lang="ts" generics="T extends { id: string; title: string; count: number }">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ms } from './motion';

  type Props = {
    sections: T[];
    open?: string | null;
    content: Snippet<[T]>;
  };
  let { sections, open = $bindable(null), content }: Props = $props();

  const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii'];
</script>

<ol class="fascicle">
  {#each sections as s, i (s.id)}
    {@const isOpen = open === s.id}
    <li class:open={isOpen}>
      <button class="row" aria-expanded={isOpen} onclick={() => (open = isOpen ? null : s.id)}>
        <span class="no">{ROMAN[i] ?? i + 1}</span>
        <span class="title">{s.title}</span>
        <span class="leader" aria-hidden="true"></span>
        <span class="count">{s.count}</span>
      </button>
      {#if isOpen}
        <div class="leaf" transition:slide={{ duration: ms(240) }}>
          {@render content(s)}
        </div>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .fascicle {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-height: var(--tap);
    padding: 11px 12px 9px;
    text-align: left;
    line-height: 1.4;
    transition: background-color var(--dur) var(--ease);
  }
  .row:hover {
    background: var(--veil);
  }
  .no {
    width: 2.200em;
    flex: none;
    font-style: italic;
    font-size: var(--text-sm);
    color: var(--ink-mute);
    text-align: right;
    padding-right: 4px;
  }
  .title {
    flex: none;
    font-size: var(--text-md);
    letter-spacing: 0.06em;
  }
  .leader {
    flex: 1;
    min-width: 12px;
    border-bottom: 1px dotted var(--hairline);
    transform: translateY(-4px);
  }
  .count {
    flex: none;
    font-size: var(--text-sm);
    color: var(--ink-mute);
  }
  .open > .row .title,
  .open > .row .no {
    color: var(--rubric);
  }
  .leaf {
    padding: 2px 12px 12px;
    border-bottom: 1px solid var(--hairline-soft);
  }
  li + li.open > .row {
    border-top: 1px solid var(--hairline-soft);
  }
</style>
