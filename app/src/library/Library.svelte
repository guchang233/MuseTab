<script lang="ts">
  import { tick } from 'svelte';
  import './zerafun/source.css';
  import CatalogueHeader from './zerafun/CatalogueHeader.svelte';
  import SearchBar from './zerafun/SearchBar.svelte';
  import PhoneNavigation from './zerafun/PhoneNavigation.svelte';
  import Personal from './zerafun/Personal.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import { library, SUPPORTED, type ScoreRecord } from './store.svelte';
  import { engine } from '../bridge/engine.svelte';
  import { openLocal, documents } from './open.svelte';
  import { cloud } from './cloud.svelte';
  import { REPOSITORY } from './github';

  type Tab = 'local' | 'cloud' | 'recent' | 'settings';
  let tab = $state<Tab>('local');
  let query = $state(''), filter = $state('all'), notice = $state(''), dragging = $state(false);
  let picker: HTMLInputElement;
  let scroller: HTMLDivElement;
  const positions:Record<Tab,{query:string;filter:string;scroll:number}>={local:{query:'',filter:'all',scroll:0},cloud:{query:'',filter:'all',scroll:0},recent:{query:'',filter:'all',scroll:0},settings:{query:'',filter:'all',scroll:0}};
  const accept = SUPPORTED.map(e => '.' + e).join(',');
  const titles: Record<Tab, string> = { local: '我的乐谱', cloud: '云端曲库', recent: '最近打开', settings: '我的' };
  const destinations = $derived<{ value: Tab; label: string; aria: string; icon: IconName }[]>([
    { value: 'local', label: '乐谱', aria: '本地谱匣 ' + library.records.length, icon: 'book' },
    { value: 'cloud', label: '云端', aria: '云端曲库 只读', icon: 'cloud' },
    { value: 'recent', label: '最近', aria: '最近打开', icon: 'history' },
    { value: 'settings', label: '我的', aria: '我的', icon: 'user' },
  ]);
  const latest = $derived(library.records.find(r => r.openedAt > 0));
  const group = (ext: string) => ['mid', 'midi'].includes(ext) ? 'mid' : ['mscz', 'mscx'].includes(ext) ? 'mscz' : ext === 'pdf' ? 'pdf' : 'xml';
  const matches = (r: { name: string; title?: string; ext: string }) => (filter === 'all' || group(r.ext) === filter) && ((r.title || '') + ' ' + r.name).toLowerCase().includes(query.trim().toLowerCase());
  const localScores = $derived(library.records.filter(r => (tab !== 'recent' || r.openedAt > 0) && matches(r)));
  const cloudScores = $derived((cloud.catalog?.scores || []).filter(matches));
  const size = (n: number) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const date = (n: number) => new Date(n).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  async function switchTab(value: Tab) {
    if(value===tab)return;
    positions[tab]={query,filter,scroll:scroller?.scrollTop||0};
    tab = value; filter = positions[value].filter; query = positions[value].query; notice = '';
    if (value === 'cloud') cloud.ensure();
    await tick();if(scroller&&tab===value)scroller.scrollTop=positions[value].scroll;
  }
  $effect(() => {
    const back = (event: Event) => { if (!event.defaultPrevented && tab !== 'local') { event.preventDefault(); switchTab('local'); } };
    addEventListener('musetab-back', back);
    return () => removeEventListener('musetab-back', back);
  });
  async function openScore(rec: ScoreRecord) {
    notice = '';
    try { await openLocal(rec); } catch (e) { notice = e instanceof Error ? e.message : '打开失败，请重试'; }
  }
  async function importFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const imported = Array.from(files); notice = ''; let last: ScoreRecord | undefined;
    for (const file of imported) { try { last = await library.add(file); } catch (e) { notice = e instanceof Error ? e.message : '导入失败'; } }
    picker.value = ''; tab = 'local';
    if (last && imported.length === 1) await openScore(last);
    else if (!notice) notice = '已导入 ' + imported.length + ' 份文件';
  }
  function ondrop(e: DragEvent) { e.preventDefault(); dragging = false; void importFiles(e.dataTransfer?.files || null); }
</script>

{#snippet pageActions()}
  {#if tab === 'cloud'}<IconButton label="刷新曲库" icon="refresh" disabled={cloud.refreshing} onclick={() => cloud.refresh()} />
  {:else}<IconButton label="导入乐谱" icon="plus" onclick={() => picker.click()} />{/if}
{/snippet}
{#snippet pageSearch()}
  <SearchBar bind:value={query} active={filter !== 'all'}>
    {#snippet filters()}
      <div class="filter-group"><span class="filter-label">文件格式</span><div class="filter-options">
        {#each [{ value: 'all', label: '全部' }, { value: 'mscz', label: 'MSCZ' }, { value: 'mid', label: 'MIDI' }, { value: 'pdf', label: 'PDF' }, ...(tab !== 'cloud' ? [{ value: 'xml', label: 'MusicXML' }] : [])] as f}
          <button class="format-option" class:on={filter === f.value} aria-pressed={filter === f.value} onclick={() => filter = f.value}>{f.label}</button>
        {/each}
      </div></div>
    {/snippet}
  </SearchBar>
{/snippet}

<input bind:this={picker} type="file" {accept} multiple hidden onchange={() => importFiles(picker.files)} />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="library zf-app" bind:this={scroller} class:dragging ondragover={e => { e.preventDefault(); dragging = true; }} ondragleave={() => dragging = false} {ondrop}>
  <div class="page">
    {#if tab !== 'settings'}<CatalogueHeader title={titles[tab]} actions={pageActions} search={pageSearch} />{/if}

    {#if tab === 'settings'}
      <Personal oncloud={() => switchTab('cloud')} />
    {:else}
      <div class="collection-meta">
        {#if tab === 'cloud'}
          <span class="source">{REPOSITORY}</span><span>{cloud.refreshing ? '同步中…' : cloud.catalog ? '更新于 ' + date(cloud.catalog.updatedAt) : '只读曲库'}</span>
        {:else}<span>{tab === 'recent' ? '按最近打开排序' : '本地乐谱'}</span><span>{localScores.length} 份</span>{/if}
      </div>

      {#if tab === 'local' && latest && !query && filter === 'all'}
        <div class="resume-row"><span>继续看谱</span><button class="continue" disabled={documents.opening} onclick={() => openScore(latest)}>{#if latest.cover}<img src={latest.cover} alt="" />{:else}<Icon name="book" size={20} />{/if}<span>{latest.title || latest.name}</span><small>{latest.ext.toUpperCase()}</small></button><button class="all-recent" onclick={() => switchTab('recent')}>全部</button></div>
      {/if}
      {#if notice}<p class="message" role="status">{notice}</p>{/if}
      {#if tab === 'cloud' && cloud.error}<p class="message" role="alert">{cloud.error}</p>{/if}

      <main class="collection" aria-label={tab === 'cloud' ? '云端乐谱' : '本地乐谱'}>
        {#if tab === 'cloud'}
          {#if cloudScores.length}
            <div class="scores cloud-list media-grid">
              {#each cloudScores as rec (rec.path)}
                {@const saved = cloud.saved(rec)}
                <article class="score cloud-score media-card">
                  <div class="cover poster poster-fallback placeholder"><Icon name={rec.ext === 'pdf' ? 'view-single' : 'book'} size={30} /><span class="format">{rec.ext.toUpperCase()} · {size(rec.size)}</span></div>
                  <h2 title={rec.name}>{rec.name}</h2>
                  {#if cloud.saving === rec.path}
                    <button class="download" onclick={() => cloud.cancel()} aria-label="取消下载 {rec.name}">{Math.min(100, Math.round(cloud.received / Math.max(1, rec.size) * 100))}% · 取消</button>
                  {:else if saved}
                    <button class="download saved" onclick={() => switchTab('local')}><Icon name="check" size={14} />已保存</button>
                  {:else}
                    <button class="download" disabled={!!cloud.saving} onclick={() => cloud.save(rec)} aria-label="保存到本地 {rec.name}"><Icon name="download" size={14} />保存到本地</button>
                  {/if}
                </article>
              {/each}
            </div>
          {:else if cloud.refreshing && !cloud.catalog}
            <div class="empty" role="status"><span class="spinner"></span><p>正在读取曲库…</p></div>
          {:else}
            <div class="empty"><Icon name="cloud" size={32} /><h2>{query || filter !== 'all' ? '没有匹配的乐谱' : cloud.catalog ? '曲库还没有乐谱' : '暂时连接不到曲库'}</h2><p>{query || filter !== 'all' ? '试试其他曲名或格式' : '上传到对应目录后，点击右上角刷新。'}</p>{#if !query && filter === 'all'}<div class="folders"><code>mid/</code><code>mscz/</code><code>pdf/</code></div>{/if}</div>
          {/if}
        {:else if localScores.length}
          <div class="scores local-grid media-grid">
            {#each localScores as rec (rec.id)}
              <button class="score local-score media-card" disabled={documents.opening} onclick={() => openScore(rec)} aria-label={'打开 ' + (rec.title || rec.name)}>
                <div class="cover poster poster-fallback" class:placeholder={!rec.cover}>{#if rec.cover}<img src={rec.cover} alt="" loading="lazy" />{:else}<Icon name={rec.ext === 'pdf' ? 'view-single' : 'book'} size={30} />{/if}<span class="format">{rec.ext.toUpperCase()}{rec.editedAt ? ' · 已编辑' : ''}</span></div>
                <h2 title={rec.title || rec.name}>{rec.title || rec.name}</h2>
                <p>{tab === 'recent' ? date(rec.openedAt) : rec.source ? '已下载到本地' : '本地导入'} · {size(rec.size)}</p>
              </button>
            {/each}
          </div>
        {:else}
          <div class="empty"><Icon name="book" size={32} /><h2>{query || filter !== 'all' ? '没有匹配的乐谱' : tab === 'recent' ? '还没有打开过乐谱' : '谱匣还是空的'}</h2><p>{query || filter !== 'all' ? '试试其他曲名或格式' : '导入一份乐谱，或从云端保存到本地。'}</p><div class="empty-actions"><button onclick={() => picker.click()}>从设备导入</button><button onclick={() => switchTab('cloud')}>浏览云端</button></div></div>
        {/if}
      </main>
      {#if documents.opening}<p class="opening" role="status">正在打开乐谱…</p>{/if}
      {#if engine.status === 'error' && tab !== 'cloud'}<p class="engine-error" role="status">谱面核心启动失败，PDF 仍可打开</p>{/if}
    {/if}
  </div>

  <PhoneNavigation items={destinations} value={tab} onchange={switchTab} />
</div>

<style>
  /* Music-specific layout only. Catalogue/search/phone chrome use source.css. */
  .library {
    --parchment:var(--c-paper); --sheet:var(--c-card); --parchment-deep:var(--c-raised);
    --ink:var(--c-ink); --ink-soft:var(--c-muted); --ink-mute:var(--c-faint);
    --hairline:var(--c-line); --hairline-soft:var(--c-line);
    --rubric:var(--c-accent); --rubric-wash:var(--c-soft); --veil:var(--c-soft);
    position:absolute; inset:0; overflow-y:auto; overscroll-behavior:contain;
    background:var(--c-paper); color:var(--c-ink); font:14px/1.5 var(--font-sans);
    font-variant-numeric:lining-nums proportional-nums;
  }
  .dragging{outline:3px dashed var(--c-muted);outline-offset:-6px;}
  .page{display:flex;flex-direction:column;gap:20px;max-width:1328px;margin:auto;padding:16px 16px 88px;}
  .page :global(.browse-actions .ib){--tap:44px;color:var(--c-muted);}
  .format-option{min-height:44px;padding:0 14px;border-radius:999px;font-size:13px;color:var(--c-muted);}
  .format-option.on{background:var(--c-soft);color:var(--c-ink);}
  .collection-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:28px;color:var(--c-muted);font-size:12px;}
  .source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .collection-meta>span:last-child{flex:none;}
  .resume-row{display:flex;align-items:center;gap:14px;min-height:44px;color:var(--c-muted);font-size:12px;}
  .resume-row>span{font-weight:600;white-space:nowrap;flex:none;}
  .continue{display:flex;align-items:center;gap:8px;min-width:0;max-width:600px;flex:1;text-align:left;height:44px;}
  .continue img{width:24px;height:32px;object-fit:cover;object-position:top;border-radius:3px;flex:none;}
  .continue>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--c-ink);font-size:13px;}
  .continue small{font-size:10px;flex:none;color:var(--c-muted);}
  .all-recent{min-height:44px;padding:0 4px;flex:none;}
  .score{min-width:0;text-align:left;align-self:start;display:block;background:none;}
  .cover{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--c-faint);}
  .cover>img{height:100%;width:100%;object-fit:contain;object-position:top;background:#fff;}
  .cover::after{content:'';position:absolute;inset:auto 0 0;height:44px;background:linear-gradient(transparent,#0009);pointer-events:none;}
  .format{position:absolute;z-index:1;left:8px;right:4px;bottom:7px;font-size:10px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .score h2{margin:8px 0 3px;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;}
  .score p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--c-muted);}
  .local-score:active .cover{opacity:.8;}
  .score:focus-visible{outline-offset:4px;}
  .download{display:flex;align-items:center;justify-content:center;gap:4px;width:100%;min-height:44px;font-size:11px;border:1px solid var(--c-line);border-radius:999px;margin-top:8px;padding:0 3px;white-space:nowrap;}
  .download.saved{border-color:transparent;color:var(--c-muted);background:var(--c-soft);}
  .empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;min-height:240px;padding:50px 20px;color:var(--c-muted);}
  .empty h2{font-size:16px;color:var(--c-ink);font-weight:400;}
  .empty p{font-size:13px;}
  .folders{display:flex;gap:16px;font-size:12px;margin-top:4px;}
  .empty-actions{display:flex;gap:16px;}
  .empty-actions button{min-height:44px;padding:0 10px;text-decoration:underline;text-underline-offset:4px;}
  .message{font-size:12px;line-height:1.6;padding:12px 14px;border:1px solid var(--c-line);border-radius:8px;margin:0;color:var(--c-muted);overflow-wrap:anywhere;}
  .opening{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);padding:10px 16px;border:1px solid var(--c-line);border-radius:8px;background:var(--c-card);font-size:13px;z-index:50;}
  .engine-error{font-size:12px;color:var(--c-muted);}
  .spinner{width:22px;height:22px;border:2px solid var(--c-line);border-top-color:var(--c-muted);border-radius:50%;animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @media(max-width:500px){.resume-row{gap:10px;}.continue small{display:none;}}
  @media(prefers-reduced-motion:reduce){.spinner{animation:none;}}
</style>
