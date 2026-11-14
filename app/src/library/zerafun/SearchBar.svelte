<!-- ZeraFun 0.7.4 SearchBar.tsx, adapted to Svelte state/bindings.
     Keeps the original DOM, CSS and outside/Escape/Back dismissal. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../ui/Icon.svelte';
  import {registerBack} from '../../ui/back';
  let { value = $bindable(''), active = false, filters }: { value?: string; active?: boolean; filters?: Snippet } = $props();
  let open = $state(false);
  let root: HTMLDivElement, input: HTMLInputElement, trigger: HTMLButtonElement;
  const id = $props.id();
  function close() { open = false; trigger?.focus({preventScroll:true}); }
  $effect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.contains(event.target as Node)) open = false; };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    const off=registerBack(()=>{close();return true;},100);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); off(); };
  });
</script>
<div bind:this={root} class="shared-search">
  <form class="search-bar" role="search" aria-label="搜索曲谱" onsubmit={event => { event.preventDefault(); open = false; input.blur(); }}>
    <div class="search-field">
      <button bind:this={trigger} type="button" class="search-filter" class:is-active={active} aria-label="筛选格式" aria-expanded={open} aria-controls={id} onclick={() => open = !open}><Icon name="sliders" size={16} />{#if active}<i aria-hidden="true"></i>{/if}</button>
      <input bind:this={input} type="search" class="search-input" aria-label="搜索曲谱" placeholder="搜索曲名、文件名" bind:value enterkeyhint="search" />
      <button type="button" class="search-clear" aria-label="清空搜索曲谱" aria-hidden={!value} disabled={!value} tabindex={value ? 0 : -1} style:visibility={value ? 'visible' : 'hidden'} onclick={() => value = ''}><Icon name="close" size={14} /></button>
    </div>
    <button type="submit" class="search-submit">搜索</button>
  </form>
  {#if open && filters}
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <section {id} role="dialog" aria-label="曲谱格式筛选" class="search-filters" tabindex="-1">
    <header><strong>筛选</strong><button type="button" class="icon-btn" aria-label="关闭筛选" onclick={close}><Icon name="close" size={16} /></button></header>
    <div class="filter-content">{@render filters()}</div>
  </section>{/if}
</div>
