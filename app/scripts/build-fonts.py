"""把字体源文件子集化并转成 woff2，输出到 app/public/fonts。

用法： python scripts/build-fonts.py <源目录>
源目录需包含：
  NewCM10-Book.otf  NewCM10-BookItalic.otf  NewCM10-Bold.otf   (CTAN newcomputermodern)
  NotoSerifSC-VF.ttf                                            (google/fonts ofl/notoserifsc)
  Leland.otf  LelandText.otf                                    (MuseScore fonts/leland)
Cormorant Garamond 直接取自 @fontsource/cormorant-garamond，不经此脚本。
需要： pip install fonttools brotli
"""
import sys, pathlib
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

src = pathlib.Path(sys.argv[1])
app = pathlib.Path(__file__).resolve().parent.parent
out = app / "public" / "fonts"
out.mkdir(parents=True, exist_ok=True)


def save(font, name):
    font.flavor = "woff2"
    font.save(out / name)
    print(f"{name:34s} {(out / name).stat().st_size / 1024:8.0f} KB")


def do_subset(font, unicodes):
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes)
    s.subset(font)


# —— New Computer Modern：拉丁、标点、常用符号 ——
latin = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180)) | set(range(0x2010, 0x2028))
latin |= {0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193,
          0x2212, 0x00D7, 0x266D, 0x266E, 0x266F, 0x2026}
for f in ("NewCM10-Book", "NewCM10-BookItalic", "NewCM10-Bold"):
    font = TTFont(src / f"{f}.otf")
    do_subset(font, latin)
    save(font, f"{f}.woff2")

# —— 思源宋体（Noto Serif SC）：GB2312 一级字 + 界面源码里出现的字 + 中文标点 ——
han = set()
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try:
            han.add(ord(bytes([hi, lo]).decode("gb2312")))
        except UnicodeDecodeError:
            pass
for p in (app / "src").rglob("*"):
    if p.suffix in (".svelte", ".ts", ".css", ".html"):
        han |= {ord(c) for c in p.read_text(encoding="utf-8") if ord(c) >= 0x2E80}
han |= set(range(0x3000, 0x3020)) | set(range(0xFF00, 0xFF60)) | {0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x00B7}
font = TTFont(src / "NotoSerifSC-VF.ttf")
do_subset(font, han)
font = instancer.instantiateVariableFont(font, {"wght": (400, 700)})
save(font, "NotoSerifSC-subset-VF.woff2")

# —— Leland：整套 SMuFL 字形，不裁剪 ——
for f in ("Leland", "LelandText"):
    save(TTFont(src / f"{f}.otf"), f"{f}.woff2")
