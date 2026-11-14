/*
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
// Modified for MuseTab: C entry points of the HTML <-> engine bridge.
#include "web/appjs/webapi.h"

#include <string>

#include <emscripten.h>

using namespace mu::appjs;

extern "C" {
EMSCRIPTEN_KEEPALIVE
void load(const void* source, unsigned int len) { WebApi::instance()->load(source, len); }

EMSCRIPTEN_KEEPALIVE
void addSoundFont(const char* uri) { WebApi::instance()->addSoundFont(std::string(uri)); }

EMSCRIPTEN_KEEPALIVE
void startAudioProcessing() { WebApi::instance()->startAudioProcessing(); }

EMSCRIPTEN_KEEPALIVE
void mtOpen(const void* source, unsigned int len, const char* ext) { WebApi::instance()->open(source, len, std::string(ext)); }

EMSCRIPTEN_KEEPALIVE
void mtExport(const char* ext) { WebApi::instance()->exportTo(std::string(ext)); }

EMSCRIPTEN_KEEPALIVE
void mtDispatch(const char* actionCode) { WebApi::instance()->dispatch(std::string(actionCode)); }

EMSCRIPTEN_KEEPALIVE
int mtActionState(const char* actionCode) { return WebApi::instance()->actionState(std::string(actionCode)); }

EMSCRIPTEN_KEEPALIVE
void mtSetTempoMultiplier(double multiplier) { WebApi::instance()->setTempoMultiplier(multiplier); }

EMSCRIPTEN_KEEPALIVE
void mtSetCanvasTheme(int dark, const char* paper, const char* canvas)
{
    WebApi::instance()->setCanvasTheme(dark != 0, std::string(paper), std::string(canvas));
}

EMSCRIPTEN_KEEPALIVE
void mtSetViewOnly(int viewOnly) { WebApi::instance()->setViewOnly(viewOnly != 0); }
EMSCRIPTEN_KEEPALIVE
void mtSetPageLock(int locked) { WebApi::instance()->setPageLock(locked != 0); }
EMSCRIPTEN_KEEPALIVE
void mtSelectAt(double x,double y) { WebApi::instance()->selectAt(x,y); }
EMSCRIPTEN_KEEPALIVE
void mtSelectPageAt(int page,double x,double y) { WebApi::instance()->selectPageAt(page,x,y); }
EMSCRIPTEN_KEEPALIVE
const char* mtPageMetrics() {static std::string s;s=WebApi::instance()->pageMetrics();return s.c_str();}
EMSCRIPTEN_KEEPALIVE
const char* mtSelectionImage(int pixels) {static std::string s;s=WebApi::instance()->selectionImage(pixels);return s.c_str();}
EMSCRIPTEN_KEEPALIVE
const char* mtPageView(int page, double width, double height) { static std::string s; s=WebApi::instance()->pageView(page,width,height); return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtGestureView(double factor,double dx,double dy,double cx,double cy) { static std::string s;s=WebApi::instance()->gestureView(factor,dx,dy,cx,cy);return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtRenderPage(int page,int pixels) { static std::string s;s=WebApi::instance()->renderPage(page,pixels);return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
void mtReaderLayout(int mode) { WebApi::instance()->readerLayout(mode); }
EMSCRIPTEN_KEEPALIVE
const char* mtScorePanels() { static std::string s;s=WebApi::instance()->scorePanels();return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtChangeMixer(const char* json) { static std::string s;s=WebApi::instance()->changeMixer(json);return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtChangeParts(const char* json) { static std::string s;s=WebApi::instance()->changeParts(json);return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtScoreStyle() { static std::string s; s=WebApi::instance()->scoreStyle(); return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtApplyScoreStyle(const char* json) { static std::string s; s=WebApi::instance()->applyScoreStyle(json); return s.c_str(); }
EMSCRIPTEN_KEEPALIVE
const char* mtTransposeScore(int key, int direction, int wholeScore) { static std::string s; s=WebApi::instance()->transposeScore(key,direction,wholeScore!=0); return s.c_str(); }

//! NOTE Returned strings stay valid until the next call of the same function
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
void mtSync() { WebApi::instance()->sync(); }
}
