# One-off editing helper (kept for the record): swaps the mock editor's script and
# markup for the engine-backed version, keeping its stylesheet. Run from the repo root.
from pathlib import Path

ed = Path("app/src/editor/Editor.svelte")
s = ed.read_text(encoding="utf-8")
style = s[s.index("<style>"):]
head = Path("tools/dev/editor_head.svelte").read_text(encoding="utf-8")

extra = """<style>
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
    min-height: 40px;
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
"""
assert style.startswith("<style>\n")
ed.write_text(head + extra + style[len("<style>\n"):], encoding="utf-8", newline="\n")

# palette.ts: the mock catalogue is replaced by names for the engine's own palettes
Path("app/src/editor/palette.ts").write_text('''// 符号面板：条目与图样全部来自引擎（MuseScore 自带的整套符号面板）。
// 这里只管两件事：给每一册配中文名，以及按钢琴谱的常用程度排个序。

export const PALETTE_ZH: Record<string, string> = {
  Clefs: '谱号',
  'Key signatures': '调号',
  'Time signatures': '拍号',
  Tempo: '速度',
  Pitch: '音高',
  Accidentals: '变音记号',
  Dynamics: '力度',
  Articulations: '奏法',
  Text: '文字',
  Keyboard: '键盘',
  'Repeats & jumps': '反复与跳转',
  Barlines: '小节线',
  Layout: '版面',
  Brackets: '括号',
  Ornaments: '装饰音',
  'Breaths & pauses': '换气与停顿',
  'Grace notes': '倚音',
  Noteheads: '符头',
  Arpeggios: '琶音',
  'Arpeggios & glissandi': '琶音与滑奏',
  Tremolos: '震音',
  Harp: '竖琴',
  Guitar: '吉他',
  Fingering: '指法',
  'Fretboard diagrams': '和弦指板图',
  Accordion: '手风琴',
  'Bagpipe embellishments': '风笛装饰音',
  Handbells: '手铃',
  'Beam properties': '符杠',
  Lines: '线条',
};

/** 排在前面的是弹琴读谱最常用的几册；没列出的排在后面，保持引擎原序 */
export const PALETTE_ORDER = [
  'Dynamics',
  'Articulations',
  'Lines',
  'Keyboard',
  'Fingering',
  'Ornaments',
  'Arpeggios & glissandi',
  'Arpeggios',
  'Grace notes',
  'Tempo',
  'Text',
  'Repeats & jumps',
  'Barlines',
  'Clefs',
  'Key signatures',
  'Time signatures',
  'Accidentals',
  'Pitch',
  'Tremolos',
  'Beam properties',
  'Layout',
  'Breaths & pauses',
  'Brackets',
  'Noteheads',
];
''', encoding="utf-8", newline="\n")
print("editor applied")
