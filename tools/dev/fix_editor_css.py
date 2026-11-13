# One-off editing helper: makes the editor layer see-through over the engine canvas.
from pathlib import Path

p = Path("app/src/editor/Editor.svelte")
s = p.read_text(encoding="utf-8")
pairs = [
    ("new Blob([bytes], { type: mime })", "new Blob([bytes as BlobPart], { type: mime })"),
    ("    grid-template-rows: auto 1fr auto;\n    background: var(--parchment);\n  }",
     "    grid-template-rows: auto 1fr auto;\n    /* 中间一行透明：引擎画布从这里露出来 */\n  }"),
    ("    min-height: 0;\n    background: var(--parchment-deep);\n    overflow: hidden;\n"
     "    transition: background-color var(--dur-slow) var(--ease);\n  }",
     "    min-height: 0;\n    overflow: hidden;\n  }"),
    ("  .topbar,\n  .thumb,\n  .tab,\n  .more,\n  .scrim,\n  .notice {\n    pointer-events: auto;\n  }",
     "  .topbar,\n  .thumb,\n  .tab,\n  .more,\n  .scrim,\n  .notice {\n    pointer-events: auto;\n  }\n"
     "  .topbar,\n  .thumb {\n    background: var(--parchment);\n  }"),
]
for old, new in pairs:
    if new in s:
        continue
    assert old in s, old[:50]
    s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
