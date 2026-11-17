<script lang="ts">
  import ScoreChrome from '../workspace/ScoreChrome.svelte';
  import { reading } from './layout.svelte';
  import { nav } from '../ui/nav.svelte';
  import { engine } from '../bridge/engine.svelte';
  import { workspace } from '../library/workspace.svelte';
  let { title, onedit, editLabel = '编辑', active = false }: { title: string; onedit?: () => void; editLabel?: string; active?: boolean } = $props();
  let height = $state(62);
  $effect(() => { if (!reading.fullscreen) reading.setHeader(height); });
  async function leave() {
    try { await workspace.persist(); } catch { /* 仍允许退出 */ }
    if (engine.playing) engine.stop();
    await reading.setFullscreen(false);
    nav.go('library');
  }
</script>

<ScoreChrome
  {title}
  mode="reader"
  subtitle={editLabel === '批注' ? '看谱 · PDF' : '看谱'}
  fullscreen={reading.fullscreen}
  bind:height
  onback={leave}
  onfullscreen={() => reading.setFullscreen(!reading.fullscreen)}
  {onedit}
  {editLabel}
  editActive={active}
/>
