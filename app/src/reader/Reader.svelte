<!--
  看谱模式：屏幕上只有谱面（引擎画布铺在本层之下）。
  · 点到音符或其他记号 → 旁边浮出罗盘：上下左右走到相邻记号，中间从这里播放
  · 点到空白处 → 底部只出现播放、速度和排版，看谱 / 播放 / 编谱只放在顶栏
  · 普通视图可拖动和缩放；全屏固定整页，左右滑动翻页
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import ScoreGallery from './ScoreGallery.svelte';
  import ScoreSheet from './ScoreSheet.svelte';
  import { readerPrefs } from './preferences.svelte';
  import AriaSymbol from '../composer/aria/AriaSymbol.svelte';
  import { theme } from '../ui/theme.svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { nav } from '../ui/nav.svelte';
  import {registerBack} from '../ui/back';
  import { ms, easeOut } from '../ui/motion';
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Glyph from '../ui/Glyph.svelte';
  import Slip from '../ui/Slip.svelte';
  import Slider from '../ui/Slider.svelte';
  import { engine } from '../bridge/engine.svelte';
  import { library } from '../library/store.svelte';
  import ReaderHeader from './ReaderHeader.svelte';
  import { reading } from './layout.svelte';
  import {pageArrival} from './page-motion';
  let {active=true}:{active?:boolean}=$props();
  const LINGER = 4800; // 工具条停留时长

  type View = 'horizontal' | 'vertical' | 'continuous';
  const VIEW_LABEL: Record<View, string> = { vertical: '单页', horizontal: '双页', continuous: '连续' };
  const VIEW_MODE: Record<View, number> = { horizontal:0,vertical:1,continuous:2 };
  function nextView(current: View): View {
    if (current === 'vertical') return 'horizontal';
    if (current === 'horizontal') return 'continuous';
    return 'vertical';
  }

  let view = $state<View>('vertical');
  let barOpen = $state(false);
  let tempoOpen = $state(false);
  let compassOpen = $state(false);
  let compassMenu = $state(false);
  const tempo = $derived(Math.round(engine.tempoMultiplier*100));
  let pageIndex=$state(0),pageCount=$state(0),lastIndex=$state(0),pageError=$state('');
  $effect(()=>{if(active&&reading.fullscreen)reading.setPage(pageIndex);});
  let root:HTMLDivElement,selectionRect=$state<{x:number;y:number;w:number;h:number}>();
  let gallery=$state<{showPage:(page:number)=>Promise<void>;turn:(delta:number)=>void}>();
  let pageLayout=$state<'auto'|'single'|'double'>((localStorage.getItem('musetab.pageLayout') as 'auto'|'single'|'double')||'auto'),layoutOpen=$state(false);
  $effect(()=>active?registerBack(()=>{if(compassMenu){compassMenu=false;return true;}if(layoutOpen||tempoOpen){layoutOpen=tempoOpen=false;return true;}if(compassOpen){compassOpen=false;return true;}return false;},40):undefined);
  function setLayout(value:'auto'|'single'|'double'){pageLayout=value;localStorage.setItem('musetab.pageLayout',value);if(value==='single')view='vertical';else if(value==='double')view='horizontal';linger();}
  const layoutName = $derived(reading.fullscreen ? (pageLayout === 'double' ? '双页' : pageLayout === 'single' ? '单页' : '自动') : VIEW_LABEL[view]);
  function fitPage(index:number){void gallery?.showPage(index);}
  $effect(()=>{if(!active)return;
    if(!reading.fullscreen||engine.status!=='ready')return;
    untrack(()=>engine.setPageLock(true));
    return()=>untrack(()=>{engine.setPageLock(false);if(nav.screen==='reader'){engine.readerLayout(VIEW_MODE[view]);engine.dispatch('zoom-page-width');}});
  });
  let seenControl=engine.readerControl.seq;
  $effect(()=>{const command=engine.readerControl;if(!active){seenControl=command.seq;return;}if(command.seq===seenControl)return;seenControl=command.seq;untrack(()=>{
    if(command.key==='gesture'){compassOpen=false;showBar(false);return;}
    if(!reading.fullscreen){if(command.key==='next'||command.key==='previous')turn(command.key==='next'?1:-1);return;}
    if(command.key==='exit')void reading.setFullscreen(false);
    else if(command.key==='first')fitPage(0);
    else if(command.key==='last')fitPage(pageCount-1);
    else turn(command.key==='next'?1:-1);
  });});

  const title = $derived(library.current?.displayName || engine.project.title || library.current?.title || library.current?.name || '');

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
    else {tempoOpen = false;layoutOpen=false;}
  }

  let seenTap=engine.readerTapSeq;
  $effect(()=>{const seq=engine.readerTapSeq;if(!active){seenTap=seq;return;}if(seq===seenTap)return;seenTap=seq;untrack(()=>{compassMenu=false;if(!engine.selection.none){compassOpen=true;showBar(false);}else{compassOpen=false;showBar(!barOpen);}});});
  let autoTurn=$state(localStorage.getItem('musetab.autoTurn')!=='false');
  function toggleAutoTurn(){autoTurn=!autoTurn;localStorage.setItem('musetab.autoTurn',String(autoTurn));}


  // 进入看谱即只读。不要把排版模式写进这个 effect：view 一变就会先关掉只读再打开，画布会被拉回原来的排版。
  $effect(() => {
    if(!active)return;
    if (engine.status !== 'ready') return;
    engine.setViewOnly(true);
    return () => engine.setViewOnly(false);
  });
  $effect(() => {
    if(!active || engine.status !== 'ready' || reading.fullscreen) return;
    const mode = VIEW_MODE[view];
    untrack(() => {
      engine.readerLayout(mode);
      engine.dispatch('zoom-page-width');
      engine.readerLayout(mode);
    });
  });

  // 新翻开的谱子：按页宽铺满
  let fittedFor = '';
  $effect(() => {
    if(!active)return;
    const key = engine.project.open ? `${library.current?.id ?? ''}:${engine.project.title ?? ''}` : '';
    if (!key || key === fittedFor || engine.status !== 'ready') return;
    fittedFor = key;
    engine.readerLayout(VIEW_MODE[view]);
    engine.dispatch('zoom-page-width');
  });

  // 记下曲名，谱匣里显示用
  $effect(() => {
    if(!active)return;
    const t = engine.project.title;
    const cur = library.current;
    if (t && cur && cur.title !== t) library.touch(cur.id, { title: t });
  });

  // 选择消失时收起罗盘
  $effect(() => {
    if(!active)return;
    if (engine.selection.none) { compassOpen = false; compassMenu = false; }
  });

  const compass = $derived.by(() => {
    const r = reading.fullscreen ? selectionRect : engine.selection.rect;
    if (!r) return null;
    const offset = reading.fullscreen ? { left: 0, top: 0 } : engine.frame?.getBoundingClientRect();
    const x = Math.min(innerWidth - 42, Math.max(8, r.x + r.w + (offset?.left || 0) + 8));
    const y = Math.min(innerHeight - 42, Math.max(8, r.y + (offset?.top || 0) - 10));
    const menuHeight = 248;
    const below = y + 42 + menuHeight <= innerHeight - 8;
    return { x, y, menuTop: below ? y + 42 : Math.max(8, y - menuHeight - 8), menuLeft: Math.min(innerWidth - 196, Math.max(8, x - 80)) };
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
    compassMenu = false;
    compassOpen = false;
    if(!engine.playing)await engine.togglePlay();
  }
  function step(code: string) {
    engine.dispatch(code);
  }

  function cycleView() {
    const current: View = !reading.fullscreen ? view : pageLayout === 'double' ? 'horizontal' : pageLayout === 'single' ? 'vertical' : 'horizontal';
    const next = reading.fullscreen && pageLayout === 'auto' ? 'vertical' : nextView(current);
    if (reading.fullscreen && next !== 'continuous') { setLayout(next === 'horizontal' ? 'double' : 'single'); return; }
    view = next;
    if (reading.fullscreen) void reading.setFullscreen(false);
    linger();
  }
  function setTempo(v: number) {
    engine.setTempoMultiplier(v / 100);
    linger();
  }
  function turn(delta: number) {
    if (reading.fullscreen) gallery?.turn(delta);
    else{engine.dispatch(delta > 0 ? 'scr-next' : 'scr-prev');pageArrival(engine.frame||undefined);}
    compassOpen = false;
    if (barOpen) linger();
  }
  function onkey(e: KeyboardEvent) {
    if(!active)return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1);
    else if (e.key === ' ') {
      e.preventDefault();
      engine.togglePlay();
    } else if (e.key === 'Escape') {
      if (reading.fullscreen) void reading.setFullscreen(false);
      compassMenu = false;
      compassOpen = false;
      showBar(false);
    }
  }

  $effect(() => () => clearTimeout(timer));
</script>

<svelte:window onkeydown={onkey} />

<div class="reader" bind:this={root}>
  {#if reading.fullscreen}<ScoreGallery bind:this={gallery} mode={pageLayout} {autoTurn} bind:index={pageIndex} bind:count={pageCount} bind:last={lastIndex} bind:selectionRect onerror={message=>pageError=message}/>{:else if readerPrefs.richScore}<ScoreSheet/>{/if}
  <ReaderHeader {title} />
  {#if reading.fullscreen}
    <div class="page-number" class:raised={barOpen} role="status" aria-live="polite">{pageIndex + 1}{lastIndex>pageIndex?'–'+(lastIndex+1):''} / {pageCount || '…'}</div>
    {#if pageError}<p class="page-error" role="alert">{pageError}</p>{/if}
    <!-- 全屏始终可点的翻页键；左右滑由页图自己翻页 -->
    <button class="edge prev always" aria-label="上一页" disabled={pageIndex === 0} onclick={() => turn(-1)}>
      <Icon name="back" size={20} />
    </button>
    <button class="edge next always" aria-label="下一页" disabled={lastIndex >= pageCount - 1} onclick={() => turn(1)}>
      <Icon name="forward" size={20} />
    </button>
  {/if}
  <!-- 选中记号：先只露出三点按钮，点开后是播放和上下左右 -->
  {#if compassOpen && compass}
    <button class="selection-options" aria-label="选区操作" aria-expanded={compassMenu} style:left={compass.x + 'px'} style:top={compass.y + 'px'} onclick={() => (compassMenu = !compassMenu)}>
      <AriaSymbol name="ellipsis" size={13} />
    </button>
    {#if compassMenu}
      <button class="selection-shade" aria-label="关闭选区菜单" onclick={() => (compassMenu = false)}></button>
      <div class="selection-menu" role="menu" aria-label="在乐谱中移动" style:left={compass.menuLeft + 'px'} style:top={compass.menuTop + 'px'} transition:scale={{ start: 0.96, duration: ms(120), easing: easeOut }}>
        <span class="what">{what}</span>
        <button role="menuitem" onclick={playFromHere}><AriaSymbol name="play.fill" size={14} /><span>播放</span></button>
        <button role="menuitem" onclick={() => step('up-chord')}><AriaSymbol name="chevron.up" size={14} /><span>上面的音符</span></button>
        <button role="menuitem" onclick={() => step('down-chord')}><AriaSymbol name="chevron.down" size={14} /><span>下面的音符</span></button>
        <button role="menuitem" onclick={() => step('prev-element')}><AriaSymbol name="chevron.left" size={14} /><span>前一个</span></button>
        <button role="menuitem" onclick={() => step('next-element')}><AriaSymbol name="chevron.right" size={14} /><span>后一个</span></button>
      </div>
    {/if}
  {/if}

  <!-- 纸带工具条：点到空白处时出现；非全屏时附带左右翻屏 -->
  {#if barOpen}
    {#if !reading.fullscreen}
      <button class="edge prev" aria-label="上一屏" onclick={() => turn(-1)} transition:fade={{ duration: ms(300) }}>
        <Icon name="back" size={20} />
      </button>
      <button class="edge next" aria-label="下一屏" onclick={() => turn(1)} transition:fade={{ duration: ms(300) }}>
        <Icon name="forward" size={20} />
      </button>
    {/if}

    <div class="ribbon-wrap" transition:fly={{ y: 10, duration: ms(380), easing: easeOut }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ribbon-col" onpointerdown={linger}>
        <Slip class="ribbon" role="toolbar" aria-label="看谱工具条">
          {#if reading.fullscreen}<IconButton label="页面排版" icon="view-spread" active={layoutOpen} onclick={()=>{layoutOpen=!layoutOpen;tempoOpen=false;linger();}}/>{/if}
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
          <button class="layout-cycle" type="button" aria-label="排版：{layoutName}（轻点切换）" onclick={cycleView}>
            <Icon name={layoutName === '连续' ? 'view-scroll' : 'view-spread'} size={20} />
            <span>{layoutName}</span>
          </button>
        </Slip>

        {#if layoutOpen}<div class="layout-slip"><Slip><div class="layout-body"><span class="label">页面排版</span><div class="layout-options">{#each [{value:'auto',label:'自动'},{value:'single',label:'单页'},{value:'double',label:'双页'}] as option}<button aria-pressed={pageLayout===option.value} onclick={()=>setLayout(option.value as 'auto'|'single'|'double')}>{option.label}</button>{/each}</div><p>自动：竖屏单页，横屏平板并排双页。</p><button class="auto-turn" aria-label="自动翻页" aria-pressed={autoTurn} onclick={()=>{toggleAutoTurn();linger();}}>播放时自动翻页 · {autoTurn?'开':'关'}</button></div></Slip></div>{/if}
        {#if tempoOpen}
          <div class="tempo-slip" transition:fly={{ y: 6, duration: ms(260), easing: easeOut }}>
            <Slip>
              <div class="tempo-body">
                <span class="label">速度</span>
                <Slider label="播放速度" min={40} max={160} step={5} value={tempo} oninput={setTempo} />
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
  .auto-turn{min-height:44px;padding:0 16px;font:500 13px/1.2 var(--font-ui);width:100%;border:0;border-radius:var(--chip-radius);background:var(--veil);}
  .auto-turn[aria-pressed=true]{background:var(--rubric-wash);}
  .ribbon-col{position:relative;}
  .layout-slip{position:absolute;bottom:calc(100% + 12px);left:0;width:min(340px,calc(100vw - 24px));pointer-events:auto;}
  .layout-body{padding:20px;display:flex;flex-direction:column;gap:14px;}.layout-options{display:flex;gap:8px;}.layout-options button{min-height:44px;flex:1;padding:8px 12px;border:0;border-radius:var(--chip-radius);background:var(--veil);font:500 14px/1.2 var(--font-ui);}.layout-options button[aria-pressed=true]{background:var(--rubric-wash);color:var(--rubric);box-shadow:var(--chip-ring);}.layout-body p{font-size:12px;line-height:1.7;color:var(--ink-soft);}
  .page-number.raised{bottom:max(96px,calc(env(safe-area-inset-bottom) + 96px));}
  .reader{overflow:hidden;}
  .page-number{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);padding:4px 12px;background:var(--slip);color:var(--ink-soft);border-radius:999px;font-size:12px;pointer-events:none;font-variant-numeric:tabular-nums;}
  .page-error{position:absolute;top:70px;left:16px;right:16px;padding:12px 16px;background:var(--paper);color:var(--danger);font-size:14px;pointer-events:auto;border:1px solid var(--danger);border-radius:var(--radius-sm);}
  /* 本层盖在引擎画布之上，但自己不接手势：只有浮出来的东西可点 */
  .reader {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .selection-options,
  .selection-shade,
  .selection-menu,
  .edge {
    pointer-events: auto;
  }
  .selection-options {
    position: absolute;
    width: 34px;
    height: 34px;
    min-height: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: var(--aria-active);
    color: var(--aria-on-active);
    box-shadow: 0 3px 8px color-mix(in srgb, var(--aria-ink) 16%, transparent);
    z-index: 6;
  }
  .selection-shade {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    z-index: 5;
  }
  .selection-menu {
    position: absolute;
    width: 188px;
    padding: 8px 0;
    border: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--aria-surface) 93%, transparent);
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 20px #0003;
    outline: 0.5px solid var(--aria-line);
    z-index: 7;
  }
  .what {
    display: block;
    padding: 4px 14px 8px;
    text-align: center;
    letter-spacing: 0.12em;
    color: var(--ink-soft);
    font-size: 12px;
  }
  .selection-menu > button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 36px;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--aria-ink);
    font: 600 13px var(--font-ui);
    text-align: left;
  }
  .selection-menu > button:active {
    background: var(--aria-line);
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
  .edge.always {
    opacity: 0.72;
  }
  .edge.always:disabled {
    opacity: 0.28;
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
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    height: auto;
    min-height: 68px;
    padding: 10px 14px;
    border-radius: var(--island-radius);
  }
  .ribbon-col :global(.ribbon){max-width:min(520px,100%);}
  .ribbon-col :global(.ib:not(.seal)){background:transparent;box-shadow:none;color:var(--ink);}
  .ribbon-col :global(.ib:not(.seal):hover),.ribbon-col :global(.ib.active:not(.seal)){background:var(--rubric-wash);color:var(--rubric);box-shadow:var(--chip-ring);}
  .ribbon-col :global(.ib.seal){background:var(--rubric);color:var(--on-rubric);box-shadow:var(--island-shadow);}
  .tempo {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: var(--tap);
    padding: 0 12px;
    border-radius: var(--chip-radius);
    white-space: nowrap;
    flex: none;
    color: var(--ink);
    transition: background-color var(--dur) var(--ease);
  }
  .tempo:hover,
  .tempo.on {
    background: var(--veil);
  }
  .layout-cycle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--tap);
    padding: 0 12px;
    border: 0;
    border-radius: var(--chip-radius);
    background: transparent;
    color: var(--ink);
    font: 500 14px/1 var(--font-ui);
    white-space: nowrap;
    flex: none;
  }
  .layout-cycle:hover,
  .layout-cycle:focus-visible {
    background: var(--rubric-wash);
    color: var(--rubric);
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

  @media (max-width: 600px) {
    .ribbon-wrap{left:8px;right:8px;bottom:max(12px,env(safe-area-inset-bottom));}
    .ribbon-col :global(.ribbon){padding:10px 12px;min-height:68px;gap:10px;border-radius:var(--sheet-radius);}
    .ribbon-col{max-width:min(520px,100%);}
    .tempo{padding:0 8px;gap:4px;}
    .layout-cycle{padding:0 8px;gap:4px;}
    .tempo-body{gap:8px;padding-left:8px;}
  }
</style>
