<script lang="ts">
  // 非全屏高画质：整页位图盖住引擎画布。页图比视口大，拖动时画面外的谱跟着进来。
  import { untrack } from 'svelte';
  import { engine } from '../bridge/engine.svelte';
  import { theme } from '../ui/theme.svelte';
  import { library } from '../library/store.svelte';
  import { reading } from './layout.svelte';
  import { pageCache } from './page-cache';
  import { readerPage } from './page-tint';
  import pkg from '../../package.json';

  type Rect = { x: number; y: number; w: number; h: number };
  type SheetPage = { page: number; src: string; rect: Rect };
  let pages = $state<SheetPage[]>([]);
  let preview = $state({ scale: 1, x: 0, y: 0 });
  let glyph = $state<{ page: number; src: string; rect: Rect } | null>(null);
  const images = new Map<string, Promise<string>>();
  let generation = 0;
  const documentKey = $derived(`${pkg.version}:sheet3:${library.current?.id}:${library.current?.editedAt || library.current?.addedAt || 0}:${theme.paper ? 1 : 0}:${theme.resolved}`);

  function pixelsFor(rect: Rect) {
    return Math.ceil(Math.max(900, Math.min(1600, rect.w * (devicePixelRatio || 1))) / 200) * 200;
  }
  /** 连续排版是一张很高的“页”，按整页位图铺开会把谱面纵向拉坏。 */
  function isPage(rect?: Rect): rect is Rect {
    return !!rect && rect.w > 2 && rect.h > 2 && rect.h <= rect.w * 2.5;
  }
  function choose(metrics: { rect?: Rect }[], width: number, height: number) {
    const indexed = metrics.flatMap((metric, index) => (isPage(metric.rect) ? [{ index, rect: metric.rect }] : []));
    if (indexed.length <= 16) return indexed;
    const near = new Set<number>();
    for (const item of indexed) {
      const rect = item.rect;
      if (rect.x + rect.w > -width && rect.x < width * 2 && rect.y + rect.h > -height && rect.y < height * 2) near.add(item.index);
    }
    for (const index of [...near]) {
      near.add(index - 1);
      near.add(index + 1);
    }
    return indexed.filter((item) => near.has(item.index));
  }
  /** 换谱、换主题或编辑后旧页图全部作废：释放 blob，免得每次切换都留下整套位图。 */
  let imagesFor = '';
  function release() {
    for (const pending of images.values()) void pending.then((src) => src.startsWith('blob:') && URL.revokeObjectURL(src), () => {});
    images.clear();
  }
  function srcFor(page: number, pixels: number) {
    if (imagesFor !== documentKey) { release(); imagesFor = documentKey; }
    const key = documentKey + ':' + page + ':' + pixels;
    if (!images.has(key)) {
      images.set(key, (async () => {
        const cached = await pageCache.get(key);
        if (cached) return URL.createObjectURL(cached);
        const blob = await readerPage(page, pixels);
        void pageCache.put(key, blob);
        return URL.createObjectURL(blob);
      })());
    }
    return images.get(key)!;
  }

  $effect(() => {
    const key = documentKey;
    const change = engine.changeSeq;
    const viewport = engine.readerViewport.seq;
    const pose = engine.readerPreview;
    const status = engine.status;
    const opening = engine.opening;
    preview = { scale: pose.scale, x: pose.x, y: pose.y };
    if (status !== 'ready' || opening) return;
    if (pose.scale !== 1 || pose.x !== 0 || pose.y !== 0) return;
    const version = ++generation;
    untrack(() => {
      const metrics = engine.pageMetrics();
      const frame = engine.frame?.getBoundingClientRect();
      const wanted = choose(metrics, frame?.width || innerWidth, frame?.height || innerHeight);
      const keep = new Set(wanted.map((item) => item.index));
      pages = pages.filter((item) => keep.has(item.page)).map((item) => {
        const rect = metrics[item.page]?.rect;
        return rect ? { ...item, rect } : item;
      });
      if (!wanted.length) return;
      void (async () => {
        const next: SheetPage[] = [];
        for (const item of wanted) {
          if (version !== generation) return;
          try { next.push({ page: item.index, src: await srcFor(item.index, pixelsFor(item.rect)), rect: item.rect }); }
          catch { /* 单页失败时保留其余页。 */ }
        }
        if (version === generation) pages = next;
      })();
    });
    void key; void change; void viewport;
  });
  $effect(() => () => { generation++; release(); });
  $effect(() => {
    const seq = engine.selectionSeq;
    if (!seq && engine.selection.none) { glyph = null; return; }
    if (engine.selection.none || engine.playing) { glyph = null; return; }
    untrack(() => {
      const image = engine.selectionImage(600);
      glyph = image.src && image.page != null && image.x != null && image.y != null && image.w != null && image.h != null
        ? { page: image.page, src: image.src, rect: { x: image.x, y: image.y, w: image.w, h: image.h } }
        : null;
    });
  });

  function box(page: number, part: { x: number; y: number; w: number; h: number }) {
    const sheet = pages.find((item) => item.page === page);
    if (!sheet) return;
    return { x: sheet.rect.x + part.x * sheet.rect.w, y: sheet.rect.y + part.y * sheet.rect.h, w: part.w * sheet.rect.w, h: part.h * sheet.rect.h };
  }
</script>

<div class="score-sheet-clip" class:ready={pages.length > 0} style:top={reading.top + 'px'}>
  <div class="score-sheet" style:transform={`matrix(${preview.scale},0,0,${preview.scale},${preview.x},${preview.y})`}>
    {#each pages as sheet (sheet.page)}
      <img class="sheet-page" src={sheet.src} alt={'乐谱第 ' + (sheet.page + 1) + ' 页'} draggable="false" style:left={sheet.rect.x + 'px'} style:top={sheet.rect.y + 'px'} style:width={sheet.rect.w + 'px'} style:height={sheet.rect.h + 'px'} />
    {/each}
    {#if glyph && !engine.playing}
      {@const mark = box(glyph.page, glyph.rect)}
      {#if mark}<img class="sheet-glyph" src={glyph.src} alt="" style:left={mark.x + 'px'} style:top={mark.y + 'px'} style:width={mark.w + 'px'} style:height={mark.h + 'px'} />{/if}
    {/if}
    {#if engine.playing && engine.position.cursor}
      {@const line = box(engine.position.cursor.page, engine.position.cursor)}
      {#if line}<span class="playback-line" style:left={line.x + 'px'} style:top={line.y + 'px'} style:width={Math.max(2, line.w) + 'px'} style:height={line.h + 'px'}></span>{/if}
    {/if}
  </div>
</div>

<style>
  .score-sheet-clip { position: absolute; left: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none; z-index: 0; }
  .score-sheet-clip.ready { background: var(--parchment-deep); }
  .score-sheet { position: absolute; inset: 0; transform-origin: 0 0; }
  .sheet-page, .sheet-glyph { position: absolute; max-width: none; user-select: none; }
  .sheet-glyph { z-index: 1; }
  .playback-line { position: absolute; background: #2984e5b8; border-left: 1px solid #2685ed; }
</style>
