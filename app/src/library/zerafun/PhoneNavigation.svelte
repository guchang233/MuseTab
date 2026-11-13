<!-- PhoneChrome's app-tabbar from ZeraFun 0.7.4 main.tsx; music destinations supplied by MuseTab. -->
<script lang="ts" generics="T extends string">
  import Icon, { type IconName } from '../../ui/Icon.svelte';
  let { items, value, onchange }: { items: { value: T; label: string; aria: string; icon: IconName }[]; value: T; onchange: (value: T) => void } = $props();
</script>
<nav class="app-tabbar" aria-label="主导航">
  {#each items as item (item.value)}
    <button aria-current={value === item.value ? 'page' : undefined} aria-label={item.aria} onclick={() => onchange(item.value)}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>
  {/each}
</nav>
