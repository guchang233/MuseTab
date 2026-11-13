# 内置字体：来源与许可

字体文件在 `public/fonts/`，许可全文在 `public/fonts/licenses/`。
子集化与转 woff2 由 `scripts/build-fonts.py` 完成（需 `fonttools`、`brotli`）；
SMuFL 字形外框表 `src/ui/smufl-metrics.json` 由 `scripts/build-glyph-metrics.py` 生成。

| 字体 | 文件 | 用途 | 来源 | 许可 | 处理 |
| --- | --- | --- | --- | --- | --- |
| New Computer Modern 8.1.1（Book、Book Italic、Bold） | `NewCM10-Book.woff2`、`NewCM10-BookItalic.woff2`、`NewCM10-Bold.woff2` | 英文正文与界面、老式数字 | CTAN `fonts/newcomputermodern`（https://ctan.org/pkg/newcomputermodern） | GUST Font License（GFL）。未使用该包中按 GPL 发布的 Regular、Uncial、Devanagari | 子集到拉丁与常用标点，保留全部 OpenType 特性；转 woff2 |
| Cormorant Garamond（400/500/600 斜体、500 正体） | `cormorant-garamond-latin-*.woff2` | 标题与曲名 | npm `@fontsource/cormorant-garamond` 5.3.0（原作 Christian Thalmann / Catharsis Fonts） | SIL OFL 1.1 | 原样取 latin 分片 |
| 思源宋体 / Noto Serif SC（可变字重） | `NotoSerifSC-subset-VF.woff2` | 中文 | google/fonts `ofl/notoserifsc/NotoSerifSC[wght].ttf` | SIL OFL 1.1 | 子集到 GB2312 一级字 + 界面源码中出现的字 + 中文标点；字重轴限制为 400–700；转 woff2 |
| Leland、Leland Text | `Leland.woff2`、`LelandText.woff2` | SMuFL 音乐字形（时值、升降号、力度等按钮） | MuseScore 源码 `fonts/leland`（经旧工程 `native/musescore/fonts/leland` 复制） | SIL OFL 1.1，保留字体名 “Leland” | 未裁剪、未改动字形，仅转 woff2 |

注意：

- 界面里新增了字库外的汉字时，重跑 `build-fonts.py`（它会扫描 `src/` 把用到的字补进子集）。
- GFL 建议改动后的字体改名；这里只做了子集化，CSS 中以 `NewCM` 为族名引用。正式发布前如需更稳妥，可改用未子集的原文件。
- Leland 带保留字体名，不要对其做子集或改字形后仍叫 Leland。
