<!--
  编辑模式：功能全但分层收纳（引擎画布铺在本层之下）。
  · 顶部一行主工具栏：撤销、重做、模式切换、保存、更多
  · 底部拇指区：录入开关、时值、休止、附点、升降号、延音线、声部 1–4
  · 左侧可收起的符号面板：引擎自带的全套符号，图样由引擎绘制，点一下即加到选中处
  · 右侧按需滑出的「选中」面板：对当前选中内容的常用操作
  · 两个面板互斥展开，保证谱面任何时候至少占屏幕七成
-->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { nav } from '../ui/nav.svelte';
  import { theme } from '../ui/theme.svelte';
  import { ms, easeOut } from '../ui/motion';
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Glyph, { type GlyphName } from '../ui/Glyph.svelte';
  import Slip from '../ui/Slip.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import Drawer from '../ui/Drawer.svelte';
  import { engine, type PaletteData, type PaletteInfo } from '../bridge/engine.svelte';
  import { library } from '../library/store.svelte';
  import { workspace } from '../library/workspace.svelte';
  import { editorInset } from './layout.svelte';
  import { PALETTE_ZH, PALETTE_ORDER } from './palette';
  import { saveAs } from '../native';
  import ScoreSettings from './ScoreSettings.svelte';
  import ScorePanels from './ScorePanels.svelte';

  let paletteOpen = $state(false);
  let propsOpen = $state(false);
  let moreOpen = $state(false);
  let panel=$state<'mixer'|'parts'|null>(null);
  function openPanel(kind:'mixer'|'parts'){moreOpen=false;paletteOpen=propsOpen=false;panel=kind;if(kind==='parts'&&engine.playing)engine.stop();}
  let settings = $state<'page'|'style'|'transpose'|null>(null);
  function openSettings(kind:'page'|'style'|'transpose') {
    moreOpen=false;
    panel=null;
    if(engine.noteInput)act('note-input');
    if(engine.playing)engine.stop();
    settings=kind;
  }
  let seenDialog=engine.dialogRequest.seq;
  $effect(()=>{
    const request=engine.dialogRequest;
    if(request.seq===seenDialog)return;
    seenDialog=request.seq;
    if(request.kind==='toggle-mixer'||request.kind==='toggle-instruments')openPanel(request.kind==='toggle-mixer'?'mixer':'parts');
    else openSettings(request.kind==='page-settings'?'page':request.kind==='transpose'?'transpose':'style');
  });
  let notice = $state('');
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let topHeight=$state(59);
  let bottomHeight=$state(63);
  $effect(()=>editorInset.set({top:topHeight+1,right:0,bottom:bottomHeight+1,left:0}));

  function say(text: string) {
    notice = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ''), 2600);
  }

  // 面板互斥
  function togglePalette(next = !paletteOpen) {
    if(next)panel=null;
    paletteOpen = next;
    if (next) propsOpen = false;
  }
  function toggleProps(next = !propsOpen) {
    if(next)panel=null;
    propsOpen = next;
    if (next) paletteOpen = false;
  }

  const title = $derived(engine.project.title || library.current?.title || library.current?.name || '');

  // —— 动作：按钮只负责派发，状态由引擎说了算 ——
  const UNDO = 'action://notation/undo';
  const REDO = 'action://notation/redo';
  const DELETE = 'action://notation/delete';

  function act(code: string) {
    engine.dispatch(code);
    if(/^(note-input|pad-|voice-|sharp$|flat$|nat$)/.test(code))engine.focus();
  }
  const on = (code: string) => engine.action(code).checked;
  const can = (code: string) => engine.action(code).enabled;

  const durations: { name: string; glyph: GlyphName; code: string }[] = [
    { name: '六十四分音符', glyph: 'note64thUp', code: 'pad-note-64' },
    { name: '三十二分音符', glyph: 'note32ndUp', code: 'pad-note-32' },
    { name: '十六分音符', glyph: 'note16thUp', code: 'pad-note-16' },
    { name: '八分音符', glyph: 'note8thUp', code: 'pad-note-8' },
    { name: '四分音符', glyph: 'noteQuarterUp', code: 'pad-note-4' },
    { name: '二分音符', glyph: 'noteHalfUp', code: 'pad-note-2' },
    { name: '全音符', glyph: 'noteWhole', code: 'pad-note-1' },
  ];
  const accidentals: { name: string; glyph: GlyphName; code: string }[] = [
    { name: '降号', glyph: 'accidentalFlat', code: 'flat' },
    { name: '还原号', glyph: 'accidentalNatural', code: 'nat' },
    { name: '升号', glyph: 'accidentalSharp', code: 'sharp' },
  ];

  // —— 符号面板：目录来自引擎，按常用程度重排并配上中文名 ——
  let catalog = $state<(PaletteInfo & { index: number })[]>([]);
  let openIndex = $state<number | null>(null);
  let pages = $state<Record<number, PaletteData>>({});

  $effect(() => {
    if (!paletteOpen || engine.status !== 'ready' || catalog.length) return;
    const all = engine.palettes().map((p, index) => ({ ...p, index }));
    const rank = (name: string) => {
      const i = PALETTE_ORDER.indexOf(name);
      return i < 0 ? 999 : i;
    };
    catalog = all.sort((a, b) => rank(a.name) - rank(b.name));
  });

  function openPalette(index: number) {
    if (openIndex === index) {
      openIndex = null;
      return;
    }
    openIndex = index;
    if (!pages[index]) {
      // 引擎现画这一册的图样，稍等一帧让展开动画先走
      requestAnimationFrame(() => {
        const data = engine.palette(index);
        if (data) pages = { ...pages, [index]: data };
      });
    }
  }
  function applyCell(p: number, c: number) {
    if (engine.selection.none) {
      say('先在谱面上点选一个音符或小节');
      return;
    }
    if (!engine.applyPaletteCell(p, c)) say('这个符号加不到当前选中的位置');
  }

  // —— 「选中」面板 ——
  const NAMES = ['C', '♯C', 'D', '♭E', 'E', 'F', '♯F', 'G', '♭A', 'A', '♭B', 'B'];
  const what = $derived.by(() => {
    const s = engine.selection;
    if (s.none) return '';
    if (s.range) return '一段乐句';
    if (s.pitch != null) return `音符 ${NAMES[s.pitch % 12]}${Math.floor(s.pitch / 12) - 1}`;
    return s.type ?? '记号';
  });

  // —— 保存与导出 ——
  let saving = $state(false);
  async function save() {
    const cur = library.current;
    if (!cur || saving) return;
    saving = true;
    try {
      await workspace.persist(true);
      say('已保存到谱匣');
    } catch {
      say('保存没有成功');
    } finally {
      saving = false;
    }
  }
  async function download(ext: string, mime: string) {
    moreOpen = false;
    try {
      const bytes = await engine.exportTo(ext);
      const ok = await saveAs(`${library.current?.name || title || '乐谱'}.${ext}`, bytes, mime);
      if (ok) say('已导出');
    } catch {
      say('导出没有成功');
    }
  }
  function menu(code: string) {
    moreOpen = false;
    act(code);
  }
  async function leave(to: 'library' | 'reader') {
    if (engine.noteInput) act('note-input');
    try{await workspace.persist();nav.go(to);}
    catch{say('更改尚未保存，请重试保存');}
  }

  $effect(() => () => clearTimeout(noticeTimer));
</script>

<div class="editor">
  <!-- 顶部主工具栏 -->
  <header class="topbar" bind:clientHeight={topHeight}>
    <div class="side">
      <IconButton label="返回谱匣" icon="back" onclick={() => leave('library')} />
      <span class="sep"></span>
      <IconButton label="撤销" icon="undo" disabled={!can(UNDO)} onclick={() => act(UNDO)} />
      <IconButton label="重做" icon="redo" disabled={!can(REDO)} onclick={() => act(REDO)} />
    </div>

    <Segmented
      label="模式"
      value="editor"
      options={[
        { value: 'reader', label: '看谱' },
        { value: 'editor', label: '编辑' },
      ]}
      onchange={(v) => v === 'reader' && leave('reader')}
    />

    <div class="side end">
      <span class="display piece">{title}</span>
      <IconButton label={engine.playing ? '暂停' : '播放'} icon={engine.playing ? 'pause' : 'play'} onclick={() => engine.togglePlay()} />
      <IconButton label="保存" icon="save" disabled={saving} onclick={save} />
      <IconButton label="更多" icon="more" active={moreOpen} onclick={() => (moreOpen = !moreOpen)} />
    </div>
  </header>

  <!-- 谱面由引擎画在下层；这里只放浮在谱面上的东西 -->
  <main class="stage">
    {#if notice}
      <p class="notice" role="status" transition:fade={{ duration: ms(200) }}>{notice}</p>
    {/if}

    <!-- 书口标签：面板收起时留在边缘 -->
    {#if !panel}
      <button class="tab left secondary" onclick={()=>openPanel('parts')} aria-label="版面"><span>版面</span></button>
      <button class="tab right secondary" onclick={()=>openPanel('mixer')} aria-label="混音器"><span>混音器</span></button>
    {/if}
    {#if panel}<ScorePanels kind={panel} onclose={()=>panel=null} onsettings={openSettings}/>{/if}
    {#if !paletteOpen}
      <button class="tab left" onclick={() => togglePalette(true)} transition:fade={{ duration: ms(200) }}>
        <span>符号</span>
      </button>
    {/if}
    {#if !propsOpen}
      <button class="tab right" onclick={() => toggleProps(true)} transition:fade={{ duration: ms(200) }}>
        <span>选中</span>
      </button>
    {/if}

    <!-- 左：符号面板 -->
    <Drawer open={paletteOpen} side="left" title="符号" subtitle="共 {catalog.length} 册" width={264} onclose={() => togglePalette(false)}>
      <ul class="fascicles">
        {#each catalog as p, i (p.index)}
          <li>
            <button class="head" class:on={openIndex === p.index} aria-expanded={openIndex === p.index} onclick={() => openPalette(p.index)}>
              <span class="num">{i + 1}</span>
              <span class="name">{PALETTE_ZH[p.name] ?? p.name}</span>
              <span class="dots" aria-hidden="true"></span>
              <span class="count">{p.cells}</span>
            </button>
            {#if openIndex === p.index}
              <div class="pcells" transition:fade={{ duration: ms(200) }}>
                {#if pages[p.index]}
                  {#each pages[p.index].cells as c, ci (ci)}
                    <button class="pcell" title={c.name} aria-label={c.name} onclick={() => applyCell(p.index, ci)}>
                      <img src="data:image/png;base64,{c.png}" alt="" draggable="false" />
                    </button>
                  {/each}
                {:else}
                  <p class="loading muted">正在取出这一册…</p>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </Drawer>

    <!-- 右：选中面板 -->
    <Drawer open={propsOpen} side="right" title="选中" subtitle={what || '未选中'} width={236} onclose={() => toggleProps(false)}>
      {#if engine.selection.none}
        <p class="hint muted">在谱面上点一下音符、休止符或任意记号，这里会出现能对它做的事。</p>
      {:else}
        <div class="ops">
          <span class="label">音高</span>
          <div class="oprow">
            <button class="op" onclick={() => act('pitch-up')}><Icon name="up" size={18} />升半音</button>
            <button class="op" onclick={() => act('pitch-down')}><Icon name="down" size={18} />降半音</button>
            <button class="op" onclick={() => act('pitch-up-octave')}>高八度</button>
            <button class="op" onclick={() => act('pitch-down-octave')}>低八度</button>
          </div>
          <span class="label">时值</span>
          <div class="oprow">
            <button class="op" onclick={() => act('half-duration')}>减半</button>
            <button class="op" onclick={() => act('double-duration')}>加倍</button>
          </div>
          <span class="label">外观</span>
          <div class="oprow">
            <button class="op" onclick={() => act('flip')}>翻转方向</button>
            <button class="op" onclick={() => act('toggle-visible')}>显示 / 隐藏</button>
            <button class="op" onclick={() => act('reset')}>恢复默认位置</button>
          </div>
          <span class="label">编辑</span>
          <div class="oprow">
            <button class="op" onclick={() => act('action://notation/copy')}>复制</button>
            <button class="op" onclick={() => act('action://notation/cut')}>剪切</button>
            <button class="op" onclick={() => act('action://notation/paste')}>粘贴</button>
            <button class="op danger" onclick={() => act(DELETE)}>删除</button>
          </div>
        </div>
      {/if}
    </Drawer>

    <!-- 更多 -->
    {#if moreOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="scrim" onclick={() => (moreOpen = false)}></div>
      <div class="more" transition:fly={{ y: -6, duration: ms(240), easing: easeOut }}>
        <Slip role="menu">
          <button role="menuitem" onclick={() => download('musicxml', 'application/vnd.recordare.musicxml+xml')}>
            <Icon name="export" size={20} />导出 MusicXML
          </button>
          <button role="menuitem" onclick={() => download('mid', 'audio/midi')}><Icon name="export" size={20} />导出 MIDI</button>
          <button role="menuitem" onclick={() => download('mscz', 'application/octet-stream')}>
            <Icon name="export" size={20} />导出 MuseScore 文件
          </button>
          <hr class="hair-rule" />
          <button role="menuitem" onclick={() => openSettings('transpose')}><Icon name="sliders" size={20} />移调…</button>
          <button role="menuitem" onclick={() => openSettings('page')}><Icon name="view-single" size={20} />页面设置…</button>
          <button role="menuitem" onclick={() => openSettings('style')}><Icon name="book" size={20} />样式…</button>
          <button role="menuitem" onclick={()=>openPanel('mixer')}><Icon name="sliders" size={20}/>混音器</button>
          <button role="menuitem" onclick={()=>openPanel('parts')}><Icon name="view-single" size={20}/>版面</button>
          <hr class="hair-rule" />
          <button role="menuitem" onclick={() => theme.cycle()}>
            <Icon name={theme.pref === 'auto' ? 'auto' : theme.pref === 'light' ? 'sun' : 'moon'} size={20} />
            主题 · {theme.label}
          </button>
        </Slip>
      </div>
    {/if}
  </main>

  <!-- 底部拇指区 -->
  <footer class="thumb" aria-label="录入工具" bind:clientHeight={bottomHeight}>
    <div class="tool-row primary" role="toolbar" aria-label="音符与时值（可左右滑动）">
    <div class="group">
      <IconButton label="音符录入" icon="pen" active={engine.noteInput} onclick={() => act('note-input')} />
    </div>
    <div class="group" role="radiogroup" aria-label="时值">
      {#each durations as d (d.code)}
        <IconButton label={d.name} glyph={d.glyph} active={on(d.code)} onclick={() => act(d.code)} />
      {/each}
    </div>
    <div class="group">
      <IconButton label="休止符" glyph="restQuarter" active={on('pad-rest')} onclick={() => act('pad-rest')} />
      <IconButton label="附点" active={on('pad-dot')} onclick={() => act('pad-dot')}>
        <span class="dotted"><Glyph name="noteQuarterUp" size={28} /><Glyph name="augmentationDot" size={28} /></span>
      </IconButton>
    </div>
    </div>
    <div class="tool-row secondary" role="toolbar" aria-label="变音、声部与删除（可左右滑动）">
    <div class="group">
      {#each accidentals as a (a.code)}
        <IconButton label={a.name} glyph={a.glyph} glyphSize={30} active={on(a.code)} onclick={() => act(a.code)} />
      {/each}
      <IconButton label="延音线" icon="tie" active={on('tie')} onclick={() => act('tie')} />
    </div>
    <div class="group" role="radiogroup" aria-label="声部">
      {#each [1, 2, 3, 4] as v (v)}
        <IconButton label="声部 {v}" active={on(`voice-${v}`)} onclick={() => act(`voice-${v}`)}>
          <span class="voice">{v}</span>
        </IconButton>
      {/each}
    </div>
    <div class="group">
      <IconButton label="删除" icon="close" onclick={() => act(DELETE)} />
    </div>
    </div>
  </footer>
</div>
{#if settings}<ScoreSettings kind={settings} onclose={()=>{settings=null;engine.focus();}}/>{/if}

<style>
  /* —— 接引擎后新增 —— */
  /* 本层盖在引擎画布上：整体不拦手势，只有控件可点 */
  .editor {
    pointer-events: none;
  }
  .topbar,
  .thumb,
  .tab,
  .more,
  .scrim,
  .notice {
    pointer-events: auto;
  }
  .topbar,
  .thumb {
    background: var(--parchment);
  }
  .stage :global(.drawer) {
    pointer-events: auto;
  }
  .notice {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    margin: 0;
    padding: 10px 20px;
    border-radius: 999px;
    background: var(--slip);
    border: 1px solid var(--hairline-soft);
    box-shadow: var(--lift);
    white-space: nowrap;
  }
  .fascicles {
    list-style: none;
    margin: 0;
    padding: 4px 0 12px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    min-height: var(--tap);
    padding: 0 16px;
    text-align: left;
    border-radius: var(--radius);
    transition: background-color var(--dur) var(--ease);
  }
  .head:hover {
    background: var(--veil);
  }
  .head.on .name {
    color: var(--rubric);
  }
  .num {
    width: 1.6em;
    text-align: right;
    font-style: italic;
    font-size: var(--text-sm);
    color: var(--ink-mute);
  }
  .dots {
    flex: 1;
    border-bottom: 1px dotted var(--hairline);
    transform: translateY(-4px);
  }
  .count {
    font-size: var(--text-sm);
    color: var(--ink-mute);
  }
  .pcells {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px;
    padding: 6px 14px 14px;
  }
  .pcell {
    display: grid;
    place-items: center;
    min-height: 52px;
    padding: 4px;
    border-radius: var(--radius);
    background: var(--paper);
    border: 1px solid var(--hairline-soft);
    transition:
      background-color var(--dur) var(--ease),
      transform var(--dur) var(--ease);
  }
  .pcell:hover {
    background: var(--rubric-wash);
  }
  .pcell:active {
    transform: scale(0.94);
  }
  .pcell img {
    max-width: 100%;
    max-height: 56px;
  }
  :global([data-theme='dark']) .pcell img {
    filter: invert(1) hue-rotate(180deg);
  }
  .loading,
  .hint {
    margin: 0;
    padding: 14px 18px;
    font-size: var(--text-sm);
    line-height: 1.7;
  }
  .ops {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 6px 16px 18px;
  }
  .ops .label {
    margin-top: 8px;
  }
  .oprow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .op {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--hairline);
    font-size: var(--text-sm);
    transition: background-color var(--dur) var(--ease);
  }
  .op:hover {
    background: var(--veil);
  }
  .op.danger {
    color: var(--rubric);
    border-color: color-mix(in srgb, var(--rubric) 40%, transparent);
  }
  .editor {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: minmax(0, 1fr);
    /* 中间一行透明：引擎画布从这里露出来 */
  }

  /* —— 顶栏 —— */
  .topbar {
    min-width: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 60px;
    padding: max(4px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) 4px max(6px,env(safe-area-inset-left));
    border-bottom: 1px solid var(--hairline-soft);
  }
  .side {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .end {
    justify-content: flex-end;
  }
  .sep {
    width: 1px;
    height: 22px;
    margin: 0 8px;
    background: var(--hairline);
  }
  .piece {
    min-width: 0;
    margin: 0 10px;
    font-size: 1.2rem;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* —— 谱面 —— */
  .stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  /* 横屏时符号面板把谱面让开，而不是盖住；竖屏时浮在谱面之上 */
  @media (orientation: landscape) {
  }
  @media (orientation: portrait) {
    .stage :global(.drawer) {
      max-height: min(calc(100% - 16px), 600px);
    }
  }

  /* 书口标签 */
  .tab {
    position: absolute;
    top: 20px;
    width: var(--tap);
    height: 84px;
    display: flex;
    z-index: 2;
  }
  .tab.secondary{top:112px;}
  .tab span {
    display: grid;
    place-items: center;
    width: 48px;
    height: 100%;
    writing-mode: vertical-rl;
    font-size: var(--text-sm);
    letter-spacing: 0.3em;
    padding-top: 0.3em;
    color: var(--ink-soft);
    background: var(--slip);
    border: 1px solid var(--hairline);
    transition: color var(--dur) var(--ease);
  }
  .tab:hover span {
    color: var(--ink);
  }
  .tab.left {
    left: 0;
  }
  .tab.left span {
    border-left: 0;
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  .tab.right {
    right: 0;
    justify-content: flex-end;
  }
  .tab.right span {
    border-right: 0;
    border-radius: var(--radius) 0 0 var(--radius);
  }

  /* —— 符号面板的格子 —— */
  /* —— 属性面板 —— */
  /* —— 更多 —— */
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 4;
  }
  .more {
    position: absolute;
    top: 6px;
    right: 8px;
    width: 196px;
    max-height:calc(100% - 12px);
    overflow-y:auto;
    z-index: 5;
  }
  .more button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: var(--tap);
    padding: 0 14px;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
  .more button:hover {
    background: var(--veil);
  }
  .more hr {
    margin: 4px 12px;
  }

  /* —— 底部拇指区 —— */
  .thumb {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    gap: 4px;
    padding: 6px 8px max(6px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--hairline-soft);
  }
  .tool-row{display:flex;align-items:center;min-width:0;flex:none;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;padding:2px 0;}
  .tool-row .group{flex:none;}
  .group {
    display: flex;
    gap: 2px;
    padding: 0 9px;
  }
  .group + .group,
  .tool-row + .tool-row {
    border-left: 1px solid var(--hairline);
  }
  .dotted {
    display: flex;
    align-items: flex-end;
    gap: 4px;
  }
  .voice {
    font-size: 1.250rem;
    line-height: 1;
  }

  @media (max-width: 1150px) {
    .piece {
      display: none;
    }
    .group {
      padding: 0 7px;
    }
    .thumb{flex-direction:column;align-items:stretch;padding:4px 6px max(6px,env(safe-area-inset-bottom));gap:2px;}
    .tool-row{width:100%;justify-content:flex-start;}
    .tool-row + .tool-row{border-left:0;border-top:1px solid var(--hairline-soft);}
    .tool-row .group:first-child{border-left:0;}
  }
  @media(max-width:600px){
    .topbar{grid-template-columns:1fr 1fr;gap:4px;min-height:0;padding:4px 6px 6px;}
    .topbar>.side:first-child{grid-column:1;grid-row:1;gap:0;}
    .topbar>.end{grid-column:2;grid-row:1;gap:0;}
    .topbar :global(.seg){grid-column:1 / -1;grid-row:2;justify-self:stretch;justify-content:center;}
    .topbar :global(.seg button){flex:1;height:44px;}
    .sep{display:none;}
    .tool-row .group{padding:0 4px;gap:2px;}
    .tab{top:12px;height:72px;}
    .tab span{writing-mode:horizontal-tb;letter-spacing:.08em;padding:0;font-size:13px;}
    .notice{max-width:calc(100% - 20px);white-space:normal;border-radius:12px;text-align:center;font-size:var(--text-sm);}
    .more{width:min(280px,calc(100% - 16px));max-height:calc(100% - 12px);overflow:auto;}
    .pcells{grid-template-columns:repeat(auto-fill,minmax(56px,1fr));}
    .pcell{min-height:56px;}
    .op{min-height:48px;}
  }
  @media(max-width:600px) and (min-height:600px){
    .stage :global(.drawer){top:auto;bottom:6px;left:6px;right:6px;width:auto!important;max-width:none;max-height:65%;border-radius:18px 18px 10px 10px;}
    .ops{gap:6px;padding:6px 16px 14px;}
  }
</style>
