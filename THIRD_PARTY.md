# Third-party components

MuseTab's application code and modifications to MuseScore are distributed under
GPL-3.0-only. See `LICENSE.txt`. This is an independent project, not an official
MuseScore product.

| Component | Source / version | License and use |
| --- | --- | --- |
| MuseScore Studio | https://github.com/musescore/MuseScore; source reports 4.7.4 development | GPL-3.0-only; notation, import/export, layout, playback and synthesis. Main WebAssembly module compiled locally with `engine/` patches; matching audio module built with `engine/build-audio.sh`. |
| MuseScore web port | https://github.com/clclyzybzjsq/mscore-web-engine | GPL-3.0-only; the upstream web bridge and audio driver form the basis of the port. The delivered audio module is built from the matching local source. |
| Qt 6.7.3 | https://code.qt.io/cgit/qt/ | Qt's applicable GPL/LGPL/commercial licenses; statically linked into the main GPL application. Build kit remains in `D:/MuseTabSDK/Qt/6.7.3`. |
| Emscripten 3.1.50 | https://github.com/emscripten-core/emscripten | MIT / University of Illinois/NCSA; WebAssembly toolchain and generated glue. |
| MS Basic SoundFont | MuseScore General, based on FluidR3 | MIT; full credits and license at `app/public/engine/sound/MS Basic_License.md`. |
| Svelte / Vite | See `app/pnpm-lock.yaml` | MIT; application UI / build tooling. |
| fflate | See `app/pnpm-lock.yaml` | MIT; local score archive thumbnails. |
| PDF.js / pdfjs-dist | https://github.com/mozilla/pdf.js; 4.10.38 legacy build | Apache-2.0; offline PDF pages and bundled worker. CMaps and standard fonts are copied with their included notices to APK assets/pdfjs; PDF.js license is in assets/pdfjs/LICENSE. |
| Interface fonts | See `app/THIRD_PARTY_FONTS.md` | GFL / SIL OFL; full license texts in `app/public/fonts/licenses/`. |
| ZeraFun 0.7.4 phone UI | User-owned local source; see `docs/ZERAFUN-UI-REUSE.md` | Reused at the user's request. Scoped catalogue/search CSS and Svelte ports of PhoneChrome, CatalogueHeader, SearchBar and Personal/AppSettings. Source snapshots and SHA-256 provenance retained under `docs/references/zerafun-0.7.4`. |

The private Frieren MSCZ/MIDI test files are not project assets and are excluded
from the APK. They are used locally only, with the original files left intact.

For a build distributed beyond local development, provide the corresponding
MuseScore source, this patch set and build instructions alongside the binary.
The current development machine keeps the complete source in `D:/b/ms`.

Exact native corresponding source and the locked build are distributed at the engine-runtime-v1 Release in guchang233/MuseTab. Qt 6.7.3 source: https://download.qt.io/archive/qt/6.7/6.7.3/single/ .
