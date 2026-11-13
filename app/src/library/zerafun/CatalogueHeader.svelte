<!-- Port of ZeraFun 0.7.4 components/CatalogueHeader.tsx; source DOM/classes preserved. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, actions, search }: { title: string; actions?: Snippet; search?: Snippet } = $props();
</script>
<header class="browse-header">
  <div class="browse-heading"><h1>{title}</h1>{#if actions}<div class="browse-actions">{@render actions()}</div>{/if}</div>
  <div class="browse-search">{#if search}{@render search()}{/if}</div>
</header>
