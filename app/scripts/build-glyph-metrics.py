"""读取 src/ui/smufl-glyphs.json 里的字形名→码位表，从 Leland.otf 量出每个字形的
外框（换算到 1000 单位/em），写入 src/ui/smufl-metrics.json，供 Glyph.svelte 精确居中。

用法： python scripts/build-glyph-metrics.py <Leland.otf 路径>
"""
import sys, json, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

app = pathlib.Path(__file__).resolve().parent.parent
names = json.loads((app / "src/ui/smufl-glyphs.json").read_text(encoding="utf-8"))
font = TTFont(sys.argv[1])
k = 1000 / font["head"].unitsPerEm
cmap, gs = font.getBestCmap(), font.getGlyphSet()
out, missing = {}, []
for name, hexcp in names.items():
    cp = int(hexcp, 16)
    if cp not in cmap:
        missing.append(name)
        continue
    pen = BoundsPen(gs)
    gs[cmap[cp]].draw(pen)
    if pen.bounds is None:
        missing.append(name)
        continue
    out[name] = [hexcp] + [round(v * k) for v in pen.bounds]
(app / "src/ui/smufl-metrics.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(len(out), "glyphs; missing:", missing)
