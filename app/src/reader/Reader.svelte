<!--
  看谱模式：屏幕上只有谱面（引擎画布铺在本层之下）。
  · 点到音符或其他记号 → 旁边浮出一枚小罗盘：上下左右走到相邻的音符 / 记号，中间从这里播放
  · 点到空白处或谱面之外 → 底部浮出纸带工具条，几秒后自行淡出
  · 普通视图可拖动和缩放；全屏固定整页，左右滑动翻页
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import ScoreGallery from './ScoreGallery.svelte';
  import { theme } from '../ui/theme.svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { nav } from '../ui/nav.svelte';
  import {registerBack} from '../ui/back';
  import {activity} from '../ui/activity.svelte';
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
  import {pageArrival} from './page-motion';
  import {changeMode} from '../workspace/modes';

  let {active=true}:{active?:boolean}=$props();
  const LINGER = 4800; // 工具条停留时长

  type View = 'horizontal' | 'vertical' | 'continuous';
  const VIEW_LABEL: Record<View, string> = { horizontal: '横向排版', vertical:'竖向排版', continuous: '竖向连续' };
  const VIEW_MODE: Record<View, number> = { horizontal:0,vertical:1,continuous:2 };

  let view = $state<View>('horizontal');
  let barOpen = $state(false);
  let tempoOpen = $state(false);
  let compassOpen = $state(false);
  const tempo = $derived(Math.round(engine.tempoMultiplier*100));
  let pageIndex=$state(0),pageCount=$state(0),lastIndex=$state(0),pageError=$state('');
  $effect(()=>{if(active&&reading.fullscreen)reading.setPage(pageIndex);});
  let root:HTMLDivElement,selectionRect=$state<{x:number;y:number;w:number;h:number}>();
  let gallery=$state<{showPage:(page:number)=>Promise<void>;turn:(delta:number)=>void}>();
  let pageLayout=$state<'auto'|'single'|'double'>((localStorage.getItem('musetab.pageLayout') as 'auto'|'single'|'double')||'auto'),layoutOpen=$state(false);
  $effect(()=>active?registerBack(()=>{if(layoutOpen||tempoOpen){layoutOpen=tempoOpen=false;return true;}if(compassOpen){compassOpen=false;return true;}return false;},40):undefined);
  function setLayout(value:'auto'|'single'|'double'){pageLayout=value;localStorage.setItem('musetab.pageLayout',value);linger();}
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
  $effect(()=>{const seq=engine.readerTapSeq;if(!active){seenTap=seq;return;}if(seq===seenTap)return;seenTap=seq;untrack(()=>{if(!engine.selection.none){compassOpen=true;showBar(false);}else{compassOpen=false;showBar(!barOpen);}});});
  let autoTurn=$state(localStorage.getItem('musetab.autoTurn')!=='false');
  function toggleAutoTurn(){autoTurn=!autoTurn;localStorage.setItem('musetab.autoTurn',String(autoTurn));}


  // 进入看谱即只读；离开时交还
  $effect(() => {
    if(!active)return;
    if (engine.status !== 'ready') return;
    engine.setViewOnly(true);
    engine.readerLayout(VIEW_MODE[view]);
    return () => engine.setViewOnly(false);
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
    if (engine.selection.none) compassOpen = false;
  });

  // —— 罗盘的位置：贴着选中的音符，优先放在上方 ——
  const COMPASS_W = 196;
  const COMPASS_H = 174;
  const compass = $derived.by(() => {
    const r = reading.fullscreen?selectionRect:engine.selection.rect;
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
    engine.setTempoMultiplier(v / 100);
    linger();
  }
  function turn(delta: number) {
    if (reading.fullscreen) gallery?.turn(delta);
    else{engine.dispatch(delta > 0 ? 'scr-next' : 'scr-prev');pageArrival(engine.frame||undefined);}
    compassOpen = false;
    if (barOpen) linger();
  }
  async function leave(to: 'library' | 'editor' | 'player') {
    await activity.run('正在切换…',async()=>{
      try{await workspace.persist();}catch{return;}
      if (engine.playing) engine.stop();
      nav.go(to);
      void reading.setFullscreen(false);
    });
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
      compassOpen = false;
      showBar(false);
    }
  }

  $effect(() => () => clearTimeout(timer));
</script>

<svelte:window onkeydown={onkey} />

<div class="reader" bind:this={root}>
  {#if reading.fullscreen}<ScoreGallery bind:this={gallery} mode={pageLayout} {autoTurn} bind:index={pageIndex} bind:count={pageCount} bind:last={lastIndex} bind:selectionRect onerror={message=>pageError=message} ongesture={()=>{compassOpen=false;showBar(false);}}/>{/if}
  <ReaderHeader {title} />
  {#if reading.fullscreen}
    <div class="page-number" class:raised={barOpen} role="status" aria-live="polite">{pageIndex + 1}{lastIndex>pageIndex?'–'+(lastIndex+1):''} / {pageCount || '…'}</div>
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
    <button class="edge next" aria-label={reading.fullscreen ? '下一页' : '下一屏'} disabled={reading.fullscreen && lastIndex >= pageCount - 1} onclick={() => turn(1)} transition:fade={{ duration: ms(300) }}>
      <Icon name="forward" size={20} />
    </button>

    <div class="ribbon-wrap" transition:fly={{ y: 10, duration: ms(380), easing: easeOut }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="ribbon-col" onpointerdown={linger}>
        <Slip class="ribbon" role="toolbar" aria-label="看谱工具条">
          {#if reading.fullscreen}<IconButton label="页面排版" icon="view-spread" active={layoutOpen} onclick={()=>{layoutOpen=!layoutOpen;tempoOpen=false;linger();}}/>{/if}
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
          <button class="to-edit" onclick={() => leave('player')}>
            <Icon name="sliders" size={20} /><span>播放设置</span>
          </button>
          <IconButton label="编谱" icon="pen" onclick={()=>changeMode('editor')}/>
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
    padding: 0 8px;
    border-radius: var(--island-radius);
  }
  .ribbon-col :global(.ribbon){max-width:100%;}
  .ribbon-col :global(.ib){background:transparent;box-shadow:none;}
  .ribbon-col :global(.ib:hover),.ribbon-col :global(.ib.active){background:var(--rubric-wash);box-shadow:var(--chip-ring);}
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
    padding: 0 12px;
    border-radius: var(--chip-radius);
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
    .ribbon-col :global(.ribbon){padding:4px 6px;height:auto;min-height:60px;gap:0;border-radius:var(--sheet-radius);}
    .ribbon-col{max-width:100%;}
    .tempo,.to-edit{padding:0 8px;gap:4px;}
    .sep{margin:0 2px;}
    .ribbon-col :global(.ribbon > .sep:first-of-type){display:none;}
    .tempo-body{gap:8px;padding-left:8px;}
  }
</style>
