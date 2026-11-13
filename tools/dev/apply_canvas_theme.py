# One-off editing helper (kept for the record): lets the page set the score's
# paper / canvas colours and dark-mode inversion. Run from the repository root.
from pathlib import Path


def sub(path, pairs):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if new in s:
            continue
        assert old in s, (path, old[:60])
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8", newline="\n")
    print("ok", path)


sub("engine/overrides/src/web/appjs/webapi.h", [
    ("    //! Reader mode: taps select",
     "    //! Paper and canvas colours (#rrggbb); dark inverts the score for the night theme\n"
     "    void setCanvasTheme(bool dark, const std::string& paper, const std::string& canvas);\n\n"
     "    //! Reader mode: taps select"),
])

sub("engine/overrides/src/web/appjs/webapi.cpp", [
    ('#include "notation/inotationviewstate.h"',
     '#include "notation/inotationviewstate.h"\n#include "notation/inotationconfiguration.h"'),
    ("void WebApi::setViewOnly(bool viewOnly)",
     "void WebApi::setCanvasTheme(bool dark, const std::string& paper, const std::string& canvas)\n"
     "{\n"
     "    auto conf = webResolve<mu::notation::INotationConfiguration>();\n"
     "    if (!conf) {\n"
     "        return;\n"
     "    }\n"
     "    conf->setForegroundUseColor(true);\n"
     "    conf->setForegroundColor(QColor(QString::fromStdString(paper)));\n"
     "    conf->setBackgroundUseColor(true);\n"
     "    conf->setBackgroundColor(QColor(QString::fromStdString(canvas)));\n"
     "    conf->setOnlyInvertInDarkTheme(false);\n"
     "    conf->setScoreInversionEnabled(dark);\n"
     "}\n\n"
     "void WebApi::setViewOnly(bool viewOnly)"),
])

sub("engine/overrides/src/app/webapi_export.cpp", [
    ("EMSCRIPTEN_KEEPALIVE\nvoid mtSetViewOnly(",
     "EMSCRIPTEN_KEEPALIVE\nvoid mtSetCanvasTheme(int dark, const char* paper, const char* canvas)\n"
     "{\n    WebApi::instance()->setCanvasTheme(dark != 0, std::string(paper), std::string(canvas));\n}\n\n"
     "EMSCRIPTEN_KEEPALIVE\nvoid mtSetViewOnly("),
])

sub("engine/patches/web_patches.py", [
    ('"_mtSetViewOnly", "_mtPalettes"', '"_mtSetViewOnly", "_mtSetCanvasTheme", "_mtPalettes"'),
])

sub("engine/host/host.html", [
    ("        setViewOnly(v) {",
     "        setCanvasTheme(dark, paper, canvas) { engine.Module.ccall('mtSetCanvasTheme', null, ['number', 'string', 'string'], [dark ? 1 : 0, paper, canvas]); },\n"
     "        setViewOnly(v) {"),
])

sub("app/src/bridge/engine.svelte.ts", [
    ("  setViewOnly(v: boolean): void;",
     "  setCanvasTheme?(dark: boolean, paper: string, canvas: string): void;\n  setViewOnly(v: boolean): void;"),
    ("  /** 看谱模式：点按只选中",
     "  /** 谱纸与画布底色跟随界面主题；暗色时反相谱面 */\n"
     "  setCanvasTheme(dark: boolean, paper: string, canvas: string) {\n"
     "    host?.setCanvasTheme?.(dark, paper, canvas);\n  },\n\n"
     "  /** 看谱模式：点按只选中"),
])
print("done")
