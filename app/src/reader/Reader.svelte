<!--
  看谱模式：屏幕上只有谱面（引擎画布铺在本层之下）。
  · 点到音符或其他记号 → 旁边浮出一枚小罗盘：上下左右走到相邻的音符 / 记号，中间从这里播放
  · 点到空白处或谱面之外 → 底部浮出纸带工具条，几秒后自行淡出
  · 普通视图可拖动和缩放；全屏固定整页，左右滑动翻页
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { readerGestures } from './gestures.js';
  import { theme } from '../ui/theme.svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { nav } from '../ui/nav.svelte';
  import { ms, easeOut } from '../ui/motion';
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Glyph from '../ui/Glyph.svelte';
  import Slip from '../ui/Slip.svelte';
  import Slider from '../ui/Slider.svelte';
  import { engine } from '../bridge/engine.svelte';
  import { library } from '../library/store.svelte';
  import { workspace } from '../library/workspace.svelte';
  import ReaderHeader from './ReaderHeader.svelte';
  import { reading } from './layout.svelte';

  const LINGER = 4800; // 工具条停留时长

  type View = 'horizontal' | 'vertical' | 'continuous';
  const VIEW_LABEL: Record<View, string> = { horizontal: '横向排版', vertical:'竖向排版', continuous: '竖向连续' };
  const VIEW_MODE: Record<View, number> = { horizontal:0,vertical:1,continuous:2 };

  let view = $state<View>('horizontal');
  let barOpen = $state(false);
  let tempoOpen = $state(false);
  let compassOpen = $state(false);
  let tempo = $state(100);
  let pageIndex = $state(0), pageCount = $state(0), pageError = $state('');
  let pageRect = $state<{x:number;y:number;w:number;h:number}>();
  let root:HTMLDivElement, pageImage=$state(''), galleryZoom=$state(1), imageGeneration=0;
  const pageImages=new Map<number,Promise<string>>();
  const decodedPages=new Map<number,HTMLImageElement>();
  let prefetch:ReturnType<typeof setTimeout>;
  function imageFor(index:number){
    if(!pageImages.has(index))pageImages.set(index,(async()=>{
      // A child effect can run before the parent's theme effect. Set native ink
      // and paper together before rasterisation, including prefetched pages.
      engine.setCanvasTheme(theme.resolved==='dark','#fbf8ef',theme.resolved==='dark'?'#18130e':'#e9e0cc');
      const src=engine.renderPage(index,1600);const img=new Image();img.src=src;await img.decode();decodedPages.set(index,img);return src;
    })());
    return pageImages.get(index)!;
  }
  function fitPage(index: number) {
    const frame = engine.frame;
    if (!frame) return;
    const state = engine.pageView(index, frame.clientWidth, frame.clientHeight);
    pageIndex = state.index; pageCount = state.count; pageRect=state.rect;
    galleryZoom=1;const generation=++imageGeneration;
    void imageFor(state.index).then(src=>{if(generation===imageGeneration)pageImage=src;}).catch(e=>pageError=String(e));
    clearTimeout(prefetch);prefetch=setTimeout(()=>{
      for(const i of [state.index-1,state.index+1])if(i>=0&&i<state.count)void imageFor(i).catch(()=>{});
      for(const i of pageImages.keys())if(Math.abs(i-state.index)>2){pageImages.delete(i);decodedPages.delete(i);}
    },80);
  }
  $effect(()=>{engine.changeSeq;pageImages.clear();decodedPages.clear();pageImage='';imageGeneration++;untrack(()=>{if(reading.fullscreen)fitPage(pageIndex);});});
  let seenViewport=engine.readerViewport.seq;
  $effect(()=>{const pose=engine.readerViewport;if(pose.seq===seenViewport)return;seenViewport=pose.seq;if(reading.fullscreen){pageRect=pose.rect;galleryZoom=pose.zoom;compassOpen=false;showBar(false);}});
  $effect(() => {
    const full = reading.fullscreen, ready = engine.status === 'ready', open = engine.project.open, frame = engine.frame;
    if (!full || !ready || !open || !frame) return;
    let resizeTimer: ReturnType<typeof setTimeout>;
    let settleTimer: ReturnType<typeof setTimeout>;
    pageError = ''; compassOpen = false; showBar(false);
    const resize = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { try { fitPage(pageIndex); } catch (e) { pageError = String(e); } }, 40);
    });
    try {
      untrack(() => { engine.setPageLock(true); fitPage(-1); });
      settleTimer=setTimeout(()=>fitPage(pageIndex),180);
      resize.observe(frame);
    } catch (e) { pageError = e instanceof Error ? e.message : '整页视图暂时无法打开'; }
    return () => {
      resize.disconnect(); clearTimeout(resizeTimer); clearTimeout(settleTimer);
      untrack(() => {
        try { engine.setPageLock(false); } catch { /* Old development engine. */ }
        clearTimeout(prefetch);imageGeneration++;
        if (nav.screen === 'reader') { engine.readerLayout(VIEW_MODE[view]); engine.dispatch('zoom-page-width'); }
      });
    };
  });
  let seenControl = engine.readerControl.seq;
  $effect(()=>readerGestures(root,{enabled:e=>reading.fullscreen&&e.target instanceof Element&&(e.target.classList.contains('page-matte')||e.target.classList.contains('gallery-backdrop')),gallery:()=>true,zoomed:()=>galleryZoom>1.01,
    tap:e=>{if(pageRect&&(e.clientX<pageRect.x||e.clientX>pageRect.x+pageRect.w))turn(e.clientX<pageRect.x?-1:1);else if(pageRect&&e.clientY>=pageRect.y&&e.clientY<=pageRect.y+pageRect.h)engine.tapAt(e.clientX,e.clientY);else{compassOpen=false;showBar(!barOpen);}},turn,
    pan:(dx,dy)=>engine.gestureView(1,dx,dy,0,0),zoom:(f,cx,cy,dx,dy)=>engine.gestureView(f,dx,dy,cx,cy),cancel:()=>compassOpen=false}));
  $effect(() => {
    const command = engine.readerControl;
    if (command.seq === seenControl) return;
    seenControl = command.seq;
    untrack(() => {
      if(command.key==='gesture'){compassOpen=false;showBar(false);return;}
      if(!reading.fullscreen){if(command.key==='next'||command.key==='previous')turn(command.key==='next'?1:-1);return;}
      if (command.key === 'exit') void reading.setFullscreen(false);
      else if (command.key === 'first') { fitPage(0); compassOpen=false; }
      else if (command.key === 'last') { fitPage(pageCount-1); compassOpen=false; }
      else turn(command.key === 'next' ? 1 : -1);
    });
  });

  const title = $derived(engine.project.title || library.current?.title || library.current?.name || '');

  // —— 工具条的停留与淡出 ——
  let timer: ReturnType<typeof setTimeout> | undefined;
  function linger() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      barOpen = false;
      tempoOpen = false;
    }, LINGER);
  }
  function showBar(open: boolean) {
    barOpen = open;
    if (open) linger();
    else tempoOpen = false;
  }

  let seenTap=engine.readerTapSeq;
  $effect(()=>{const seq=engine.readerTapSeq;if(seq===seenTap)return;seenTap=seq;untrack(()=>{if(!engine.selection.none){compassOpen=true;showBar(false);}else{compassOpen=false;showBar(!barOpen);}});});
  let autoTurn=$state(localStorage.getItem('musetab.autoTurn')!=='false');
  function toggleAutoTurn(){autoTurn=!autoTurn;localStorage.setItem('musetab.autoTurn',String(autoTurn));}
  $effect(()=>{const cursor=engine.position.cursor;if(reading.fullscreen&&engine.playing&&autoTurn&&cursor&&cursor.page!==pageIndex)untrack(()=>fitPage(cursor.page));});

  // 进入看谱即只读；离开时交还
  $effect(() => {
    if (engine.status !== 'ready') return;
    engine.setViewOnly(true);
    return () => engine.setViewOnly(false);
  });

  // 新翻开的谱子：按页宽铺满
  let fittedFor = '';
  $effect(() => {
    const key = engine.project.open ? `${library.current?.id ?? ''}:${engine.project.title ?? ''}` : '';
    if (!key || key === fittedFor || engine.status !== 'ready') return;
    fittedFor = key;
    engine.readerLayout(VIEW_MODE[view]);
    engine.dispatch('zoom-page-width');
  });

  // 记下曲名，谱匣里显示用
  $effect(() => {
    const t = engine.project.title;
    const cur = library.current;
    if (t && cur && cur.title !== t) library.touch(cur.id, { title: t });
  });

  // 选择消失时收起罗盘
  $effect(() => {
    if (engine.selection.none) compassOpen = false;
  });

  // —— 罗盘的位置：贴着选中的音符，优先放在上方 ——
  const COMPASS_W = 196;
  const COMPASS_H = 174;
  const compass = $derived.by(() => {
    const r = engine.selection.rect;
    if (!r) return null;
    const offset = engine.frame?.getBoundingClientRect();
    const cx = r.x + r.w / 2 + (offset?.left || 0);
    const left = Math.min(innerWidth - COMPASS_W - 12, Math.max(12, cx - COMPASS_W / 2));
    let top = r.y + reading.top - COMPASS_H - 16;
    let below = false;
    if (top < reading.top + 12) {
      top = r.y + reading.top + r.h + 16;
      below = true;
    }
    top = Math.min(innerHeight - COMPASS_H - 12, Math.max(12, top));
    return { left, top, below, tail: Math.min(COMPASS_W - 24, Math.max(24, cx - left)) };
  });

  const NAMES = ['C', '♯C', 'D', '♭E', 'E', 'F', '♯F', 'G', '♭A', 'A', '♭B', 'B'];
  const KIND: Record<string, string> = {
    Rest: '休止',
    Dynamic: '力度',
    Slur: '连线',
    SlurSegment: '连线',
    Tie: '延音线',
    TieSegment: '延音线',
    Hairpin: '渐强渐弱',
    HairpinSegment: '渐强渐弱',
    Pedal: '踏板',
    PedalSegment: '踏板',
    TempoText: '速度',
    Clef: '谱号',
    KeySig: '调号',
    TimeSig: '拍号',
    BarLine: '小节线',
    Articulation: '奏法',
    Arpeggio: '琶音',
    Ottava: '八度',
    OttavaSegment: '八度',
    RehearsalMark: '排练号',
    Text: '文字',
    StaffText: '文字',
    Measure: '小节',
  };
  const what = $derived.by(() => {
    const s = engine.selection;
    if (s.none) return '';
    if (s.range) return '一段乐句';
    if (s.pitch != null) return `${NAMES[s.pitch % 12]}${Math.floor(s.pitch / 12) - 1}`;
    return KIND[s.type ?? ''] ?? '记号';
  });

  async function playFromHere() {
    compassOpen = false;
    if(!engine.playing)await engine.togglePlay();
  }

  function cycleView() {
    if (reading.fullscreen) return;
    view = view === 'horizontal' ? 'vertical' : view==='vertical'?'continuous':'horizontal';
    engine.readerLayout(VIEW_MODE[view]);
    engine.dispatch('zoom-page-width');
    linger();
  }
  function setTempo(v: number) {
    tempo = v;
    engine.setTempoMultiplier(v / 100);
    linger();
  }
  function turn(delta: number) {
    if (reading.fullscreen) fitPage(Math.max(0, Math.min(pageCount - 1, pageIndex + delta)));
    else engine.dispatch(delta > 0 ? 'scr-next' : 'scr-prev');
    compassOpen = false;
    if (barOpen) linger();
  }
  async function leave(to: 'library' | 'editor') {
    try{await workspace.persist();}catch{return;}
    if (engine.playing) engine.stop();
    nav.go(to);
    void reading.setFullscreen(false);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1);
    else if (e.key === ' ') {
      e.preventDefault();
      engine.togglePlay();
    } else if (e.key === 'Escape') {
      if (reading.fullscreen) void reading.setFullscreen(false);
      compassOpen = false;
      showBar(false);
    }
  }

  $effect(() => () => clearTimeout(timer));
</script>

<svelte:window onkeydown={onkey} />

<div class="reader" bind:this={root}>
  {#if reading.fullscreen}<div class="gallery-backdrop"></div>{/if}
  {#if reading.fullscreen && pageRect && pageImage}
    <img class="gallery-page" src={pageImage} alt="当前乐谱整页" draggable="false" style:left={pageRect.x+'px'} style:top={pageRect.y+'px'} style:width={pageRect.w+'px'} style:height={pageRect.h+'px'}/>
    {#if engine.playing&&engine.position.cursor&&engine.position.cursor.page===pageIndex}
      {@const c=engine.position.cursor}<span class="playback-line" aria-label="播放进度" style:left={pageRect.x+c.x*pageRect.w+'px'} style:top={pageRect.y+c.y*pageRect.h+'px'} style:width={Math.max(2,c.w*pageRect.w)+'px'} style:height={c.h*pageRect.h+'px'}></span>
    {/if}
    {#if !engine.playing && !engine.selection.none && engine.selection.type==='Note' && engine.selection.rect}
      {@const r=engine.selection.rect}<span class="note-highlight" style:left={r.x-2+'px'} style:top={r.y-2+'px'} style:width={r.w+4+'px'} style:height={r.h+4+'px'}></span>
    {/if}
  {/if}
  {#if reading.fullscreen && pageRect}
    {#each [
      {left:0,top:0,width:Math.max(0,pageRect.x),height:'100%'},
      {left:pageRect.x+pageRect.w,top:0,width:'100%',height:'100%'},
      {left:pageRect.x,top:0,width:pageRect.w,height:Math.max(0,pageRect.y)},
      {left:pageRect.x,top:pageRect.y+pageRect.h,width:pageRect.w,height:'100%'},
    ] as mask}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="page-matte" style:left={mask.left+'px'} style:top={mask.top+'px'} style:width={typeof mask.width==='number'?mask.width+'px':mask.width} style:height={typeof mask.height==='number'?mask.height+'px':mask.height}></div>
    {/each}
  {/if}
  <ReaderHeader {title} />
  {#if reading.fullscreen}
    <div class="page-number" class:raised={barOpen} role="status" aria-live="polite">{pageIndex + 1} / {pageCount || '…'}</div>
    {#if pageError}<p class="page-error" role="alert">{pageError}</p>{/if}
  {/if}
  <!-- 小罗盘：点中音符时出现 -->
  {#if compassOpen && compass}
    <div
      class="compass"
      class:below={compass.below}
      style="left:{compass.left}px; top:{compass.top}px; --tail:{compass.tail}px"
      transition:scale={{ start: 0.92, duration: ms(220), easing: easeOut }}
      role="toolbar"
      aria-label="在乐谱中移动"
    >
      <Slip class="rose">
        <span class="what label">{what}</span>
        <div class="pad">
          <span class="up"><IconButton label="上面的音符" icon="up" onclick={() => engine.dispatch('up-chord')} /></span>
          <span class="left"><IconButton label="前一个" icon="back" onclick={() => engine.dispatch('prev-element')} /></span>
          <span class="mid"><IconButton label="从这里播放" icon="play" seal onclick={playFromHere} /></span>
          <span class="right"><IconButton label="后一个" icon="forward" onclick={() => engine.dispatch('next-element')} /></span>
          <span class="down"><IconButton label="下面的音符" icon="down" onclick={() => engine.dispatch('down-chord')} /></span>
        </div>
      </Slip>
    </div>
  {/if}

  <!-- 纸带工具条：点到空白处时出现 -->
  {#if barOpen}
    <button class="edge prev" aria-label={reading.fullscreen ? '上一页' : '上一屏'} disabled={reading.fullscreen && pageIndex === 0} onclick={() => turn(-1)} transition:fade={{ duration: ms(300) }}>
      <Icon name="back" size={20} />
    </button>
    <button class="edge next" aria-label={reading.fullscreen ? '下一页' : '下一屏'} disabled={reading.fullscreen && pageIndex >= pageCount - 1} onclick={() => turn(1)} transition:fade={{ duration: ms(300) }}>
      <Icon name="forward" size={20} />
    </button>

    <div class="ribbon-wrap" transition:fly={{ y: 10, duration: ms(380), easing: easeOut }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ribbon-col" onpointerdown={linger}>
        <Slip class="ribbon" role="toolbar" aria-label="看谱工具条">
          {#if reading.fullscreen}<button class="auto-turn" aria-label="自动翻页" aria-pressed={autoTurn} onclick={toggleAutoTurn}>自动翻页{autoTurn?'：开':'：关'}</button>{/if}
          <IconButton label="返回谱匣" icon="back" onclick={() => leave('library')} />
          <span class="sep"></span>
          <IconButton
            label={engine.playing ? '暂停' : '播放'}
            icon={engine.playing ? 'pause' : 'play'}
            seal
            onclick={() => engine.togglePlay()}
          />
          <button
            class="tempo"
            class:on={tempoOpen}
            aria-label="播放速度 {tempo}%"
            aria-expanded={tempoOpen}
            onclick={() => (tempoOpen = !tempoOpen)}
          >
            <Glyph name="metNoteQuarterUp" size={22} maxH={22} />
            <span>{tempo}%</span>
          </button>
          {#if !reading.fullscreen}<IconButton
            label="视图：{VIEW_LABEL[view]}（轻点切换）"
            icon={view === 'horizontal' ? 'view-spread' : 'view-scroll'}
            onclick={cycleView}
          />{/if}
          <span class="sep"></span>
          <button class="to-edit" onclick={() => leave('editor')}>
            <Icon name="pen" size={20} /><span>编辑</span>
          </button>
        </Slip>

        {#if tempoOpen}
          <div class="tempo-slip" transition:fly={{ y: 6, duration: ms(260), easing: easeOut }}>
            <Slip>
              <div class="tempo-body">
                <span class="label">速度</span>
                <Slider label="播放速度" min={40} max={160} step={5} bind:value={tempo} oninput={setTempo} />
                <span class="pct">{tempo}%</span>
                <button class="reset" onclick={() => setTempo(100)}>原速</button>
              </div>
            </Slip>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gallery-backdrop{position:absolute;inset:0;background:var(--parchment-deep);pointer-events:auto;touch-action:none;}
  .playback-line{position:absolute;pointer-events:none;z-index:3;background:#2984e5b8;border-left:1px solid #2685ed;}
  .auto-turn{min-height:44px;padding:0 12px;font-size:12px;white-space:nowrap;border-radius:8px;}
  .auto-turn[aria-pressed=true]{background:var(--hairline-soft);}
  .gallery-page{position:absolute;pointer-events:none;max-width:none;user-select:none;}
  :global([data-theme=dark]) .gallery-page{filter:invert(1);}
  .note-highlight{position:absolute;border:2px solid #448ed8;border-radius:4px;pointer-events:none;}
  .page-number.raised{bottom:max(96px,calc(env(safe-area-inset-bottom) + 96px));}
  .page-matte{position:absolute;background:var(--parchment-deep);pointer-events:auto;touch-action:none;}
  .reader{overflow:hidden;}
  .page-number{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);padding:4px 12px;background:var(--slip);color:var(--ink-soft);border-radius:999px;font-size:12px;pointer-events:none;font-variant-numeric:tabular-nums;}
  .page-error{position:absolute;top:70px;left:16px;right:16px;padding:12px;background:var(--sheet);color:var(--rubric);font-size:14px;pointer-events:auto;}
  /* 本层盖在引擎画布之上，但自己不接手势：只有浮出来的东西可点 */
  .reader {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .compass,
  .edge {
    pointer-events: auto;
  }

  /* —— 小罗盘 —— */
  .compass {
    position: absolute;
    width: 196px;
    transform-origin: var(--tail) 100%;
  }
  .compass.below {
    transform-origin: var(--tail) 0;
  }
  .compass :global(.rose) {
    padding: 10px 10px 8px;
    border-radius: 24px;
  }
  .what {
    display: block;
    text-align: center;
    letter-spacing: 0.18em;
    color: var(--ink-soft);
  }
  .pad {
    display: grid;
    grid-template-columns: repeat(3, var(--tap));
    grid-template-rows: var(--tap) var(--tap) var(--tap);
    justify-content: center;
    align-items: center;
    column-gap: 8px;
  }
  .up {
    grid-area: 1 / 2;
  }
  .left {
    grid-area: 2 / 1;
  }
  .mid {
    grid-area: 2 / 2;
  }
  .right {
    grid-area: 2 / 3;
  }
  .down {
    grid-area: 3 / 2;
  }
  .up :global(.ib),
  .down :global(.ib) {
    height: var(--tap);
  }

  /* —— 两侧翻屏 —— */
  .edge {
    position: absolute;
    top: 50%;
    width: 44px;
    height: 72px;
    margin-top: -36px;
    display: grid;
    place-items: center;
    color: var(--ink-soft);
    background: var(--slip);
    border: 1px solid var(--hairline-soft);
    border-radius: 999px;
    box-shadow: var(--lift);
  }
  .edge.prev {
    left: 10px;
  }
  .edge.next {
    right: 10px;
  }
  .edge:active {
    transform: scale(0.96);
  }

  /* —— 纸带工具条 —— */
  .ribbon-wrap {
    position: absolute;
    bottom: max(22px, env(safe-area-inset-bottom));
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .ribbon-col {
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-end;
    gap: 8px;
    max-width: 100%;
    pointer-events: auto;
  }
  .ribbon-col :global(.ribbon) {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 64px;
    padding: 0 10px;
    border-radius: 999px;
    max-width: 100%;
  }
  .sep {
    width: 1px;
    height: 22px;
    margin: 0 8px;
    background: var(--hairline);
    flex: none;
  }
  .tempo,
  .to-edit {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: var(--tap);
    padding: 0 14px;
    border-radius: 999px;
    white-space: nowrap;
    flex: none;
    transition: background-color var(--dur) var(--ease);
  }
  .tempo:hover,
  .to-edit:hover,
  .tempo.on {
    background: var(--veil);
  }
  .to-edit {
    letter-spacing: 0.14em;
  }

  .tempo-slip {
    width: min(380px, 100%);
  }
  .tempo-body {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 6px 0 18px;
  }
  .tempo-body .label {
    flex: none;
  }
  .pct {
    flex: none;
    width: 3em;
    text-align: right;
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }
  .reset {
    flex: none;
    height: var(--tap);
    padding: 0 12px;
    font-size: var(--text-sm);
    letter-spacing: 0.12em;
    color: var(--ink-soft);
  }

  @media (max-width: 860px) {
    .sep {
      margin: 0 4px;
    }
  }
  @media (max-width: 600px) {
    .ribbon-wrap{left:8px;right:8px;bottom:max(12px,env(safe-area-inset-bottom));}
    .ribbon-col :global(.ribbon){padding:4px 6px;height:auto;min-height:60px;gap:0;border-radius:20px;}
    .ribbon-col{max-width:100%;}
    .tempo,.to-edit{padding:0 8px;gap:4px;}
    .sep{margin:0 2px;}
    .ribbon-col :global(.ribbon > .sep:first-of-type){display:none;}
    .tempo-body{gap:8px;padding-left:8px;}
  }
</style>
