# One-off editing helper (kept for the record): adds the engine-driven symbol
# palettes to every bridge layer. Run from the repository root.
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
    ('#include "global/async/asyncable.h"',
     '#include "global/async/asyncable.h"\n#include "global/modularity/ioc.h"'),
    ("    void init();\n", "    void init(const muse::modularity::ContextPtr& ctx);\n"),
    ("    //! Reader mode: taps select",
     "    // --- symbol palettes (the same set MuseScore ships) ---\n"
     "    //! JSON: [{ \"name\": ..., \"id\": ..., \"cells\": n }, ...]\n"
     "    std::string palettes();\n"
     "    //! JSON: { \"name\": ..., \"w\": .., \"h\": .., \"cells\": [{ \"name\": ..., \"png\": \"<base64>\" }, ...] }\n"
     "    std::string palette(int index);\n"
     "    bool applyPaletteCell(int paletteIndex, int cellIndex);\n\n"
     "    //! Reader mode: taps select"),
    ("    double m_lastPositionSent = -1.0;",
     "    double m_lastPositionSent = -1.0;\n    muse::modularity::ContextPtr m_ctx;"),
])

PALETTE_CPP = r'''// ---------------------------------------------------------------------------
// Symbol palettes
// ---------------------------------------------------------------------------
static mu::palette::PaletteTreePtr paletteTree(const muse::modularity::ContextPtr& ctx)
{
    static mu::palette::PaletteTreePtr tree;
    if (!tree) {
        tree = mu::palette::PaletteCreator(ctx).newMasterPaletteTree();
    }
    return tree;
}

std::string WebApi::palettes()
{
    QJsonArray arr;
    for (const mu::palette::PalettePtr& p : paletteTree(m_ctx)->palettes) {
        arr.append(QJsonObject { { "name", p->translatedName() }, { "id", p->id() }, { "cells", p->cellsCount() } });
    }
    return QJsonDocument(arr).toJson(QJsonDocument::Compact).toStdString();
}

std::string WebApi::palette(int index)
{
    mu::palette::PaletteTreePtr tree = paletteTree(m_ctx);
    if (index < 0 || index >= static_cast<int>(tree->palettes.size())) {
        return "{}";
    }

    mu::palette::PalettePtr p = tree->palettes.at(index);

    //! NOTE Cells are drawn by the engine itself, so the panel shows exactly what will be added
    const qreal dpr = 2.0;
    const QSize grid = p->scaledGridSize();

    QJsonArray cells;
    for (const mu::palette::PaletteCellPtr& cell : p->cells()) {
        QImage img(grid * dpr, QImage::Format_ARGB32_Premultiplied);
        img.setDevicePixelRatio(dpr);
        img.fill(Qt::transparent);
        {
            QPainter painter(&img);
            painter.setRenderHint(QPainter::Antialiasing, true);
            mu::palette::PaletteCellIconEngine icon(cell, m_ctx);
            icon.paint(&painter, QRect(QPoint(0, 0), grid), QIcon::Normal, QIcon::Off);
        }

        QByteArray png;
        QBuffer buf(&png);
        buf.open(QIODevice::WriteOnly);
        img.save(&buf, "PNG");

        cells.append(QJsonObject {
            { "name", cell->translatedName() },
            { "png", QString::fromLatin1(png.toBase64()) },
        });
    }

    QJsonObject o { { "name", p->translatedName() }, { "id", p->id() }, { "w", grid.width() }, { "h", grid.height() },
                    { "cells", cells } };
    return QJsonDocument(o).toJson(QJsonDocument::Compact).toStdString();
}

bool WebApi::applyPaletteCell(int paletteIndex, int cellIndex)
{
    if (!m_currentNotation) {
        return false;
    }

    mu::palette::PaletteTreePtr tree = paletteTree(m_ctx);
    if (paletteIndex < 0 || paletteIndex >= static_cast<int>(tree->palettes.size())) {
        return false;
    }

    mu::palette::PalettePtr p = tree->palettes.at(paletteIndex);
    if (cellIndex < 0 || cellIndex >= p->cellsCount()) {
        return false;
    }

    mu::palette::PaletteCellPtr cell = p->cellAt(cellIndex);
    if (!cell || !cell->element) {
        return false;
    }

    return m_currentNotation->interaction()->applyPaletteElement(cell->element.get());
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------'''

sub("engine/overrides/src/web/appjs/webapi.cpp", [
    ("#include <QBuffer>\n", "#include <QBuffer>\n#include <QIcon>\n#include <QImage>\n#include <QPainter>\n"),
    ('#include "engraving/dom/engravingitem.h"',
     '#include "palette/internal/palettecreator.h"\n#include "palette/internal/palettetree.h"\n'
     '#include "palette/internal/palette.h"\n#include "palette/internal/palettecell.h"\n'
     '#include "palette/internal/palettecelliconengine.h"\n\n#include "engraving/dom/engravingitem.h"'),
    ("template<typename I>\nstatic std::shared_ptr<I> webResolve()\n{\n"
     "    std::shared_ptr<I> p = muse::modularity::ioc()->resolve<I>(mname);\n",
     "static muse::modularity::ContextPtr s_ctx;\n\n"
     "template<typename I>\nstatic std::shared_ptr<I> webResolve()\n{\n"
     "    std::shared_ptr<I> p = muse::modularity::ioc(s_ctx)->resolve<I>(mname);\n"
     "    if (!p && s_ctx) {\n        p = muse::modularity::ioc()->resolve<I>(mname);\n    }\n"),
    ("void WebApi::init()\n{\n",
     "void WebApi::init(const muse::modularity::ContextPtr& ctx)\n{\n    m_ctx = ctx;\n    s_ctx = ctx;\n\n"),
    ("// ---------------------------------------------------------------------------\n"
     "// Playback\n"
     "// ---------------------------------------------------------------------------", PALETTE_CPP),
])

EXPORTS = r'''//! NOTE Returned strings stay valid until the next call of the same function
EMSCRIPTEN_KEEPALIVE
const char* mtPalettes()
{
    static std::string s;
    s = WebApi::instance()->palettes();
    return s.c_str();
}

EMSCRIPTEN_KEEPALIVE
const char* mtPalette(int index)
{
    static std::string s;
    s = WebApi::instance()->palette(index);
    return s.c_str();
}

EMSCRIPTEN_KEEPALIVE
int mtPaletteApply(int paletteIndex, int cellIndex)
{
    return WebApi::instance()->applyPaletteCell(paletteIndex, cellIndex) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void mtSync()'''

sub("engine/overrides/src/app/webapi_export.cpp", [
    ("EMSCRIPTEN_KEEPALIVE\nvoid mtSync()", EXPORTS),
])

sub("engine/patches/web_patches.py", [
    ('_mtSetViewOnly,_mtSync]",', '_mtSetViewOnly,_mtPalettes,_mtPalette,_mtPaletteApply,_mtSync]",'),
])

sub("engine/host/host.html", [
    ("        sync() {",
     "        palettes() { return JSON.parse(engine.Module.ccall('mtPalettes', 'string', [], [])); },\n"
     "        palette(i) { return JSON.parse(engine.Module.ccall('mtPalette', 'string', ['number'], [i])); },\n"
     "        applyPaletteCell(p, c) { return engine.Module.ccall('mtPaletteApply', 'number', ['number', 'number'], [p, c]) === 1; },\n"
     "        sync() {"),
])

sub("app/src/bridge/engine.svelte.ts", [
    ("  sync(): void;",
     "  palettes(): PaletteInfo[];\n  palette(i: number): PaletteData;\n"
     "  applyPaletteCell(p: number, c: number): boolean;\n  sync(): void;"),
    ("export type ActionState =",
     "export type PaletteInfo = { name: string; id: string; cells: number };\n"
     "export type PaletteData = { name: string; id: string; w: number; h: number; cells: { name: string; png: string }[] };\n\n"
     "export type ActionState ="),
    ("  /** 看谱模式：点按只选中",
     "  /** 引擎自带的全套符号面板（目录） */\n"
     "  palettes(): PaletteInfo[] {\n    return host && status === 'ready' ? host.palettes() : [];\n  },\n"
     "  /** 某一册的全部条目，图样由引擎绘制 */\n"
     "  palette(i: number): PaletteData | null {\n    return host && status === 'ready' ? host.palette(i) : null;\n  },\n"
     "  /** 把某个符号加到当前选中的位置 */\n"
     "  applyPaletteCell(p: number, c: number): boolean {\n    return !!host?.applyPaletteCell(p, c);\n  },\n\n"
     "  /** 看谱模式：点按只选中"),
])

HEADER = '''/*
 * SPDX-License-Identifier: GPL-3.0-only
 * MuseScore-Studio-CLA-applies
 *
 * MuseScore Studio
 * Music Composition & Notation
 *
 * Copyright (C) 2025 MuseScore Limited and others
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// Modified for MuseTab: hands the IoC context to the bridge.
'''
Path("engine/overrides/src/web/appjs/appjsmodule.cpp").write_text(HEADER + '''#include "appjsmodule.h"

#include <emscripten/val.h>

#include "webapi.h"

using namespace muse;
using namespace mu::appjs;

std::string AppJsModule::moduleName() const
{
    return "appjs";
}

void AppJsModule::onInit(const muse::IApplication::RunMode&)
{
    WebApi::instance()->init(iocContext());
}

void AppJsModule::onDeinit()
{
    WebApi::instance()->deinit();
}

void AppJsModule::onStartApp()
{
    emscripten::val::module_property("onStartApp")();
}
''', encoding="utf-8", newline="\n")
print("done")
