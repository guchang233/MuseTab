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
// Modified for MuseTab. This is the bridge between the HTML interface and the
// engine: the page dispatches named actions and receives state as JSON events
// through Module.onEngineEvent(name, json).
#pragma once

#include <memory>
#include <string>

#include "global/async/asyncable.h"
#include "global/modularity/ioc.h"
#include "global/io/path.h"

#include "project/inotationproject.h"
#include "notation/inotation.h"
#include "draw/types/transform.h"

namespace mu::appjs {
class WebApi : public muse::async::Asyncable
{
public:

    static WebApi* instance();

    void init(const muse::modularity::ContextPtr& ctx);
    void deinit();

    // --- files ---
    void load(const void* source, unsigned int len);                    // .mscz (upstream entry point)
    void open(const void* source, unsigned int len, const std::string& ext);
    //! Serializes the current score and hands it to Module.onEngineExport(ext, bytes, ok)
    void exportTo(const std::string& ext);

    // --- actions ---
    void dispatch(const std::string& actionCode);
    //! bit 0: enabled, bit 1: checked; -1 if there is no such action
    int actionState(const std::string& actionCode) const;

    // --- playback ---
    void addSoundFont(const std::string& uri);
    void startAudioProcessing();
    void setTempoMultiplier(double multiplier);

    // --- symbol palettes (the same set MuseScore ships) ---
    //! JSON: [{ "name": ..., "id": ..., "cells": n }, ...]
    std::string palettes();
    //! JSON: { "name": ..., "w": .., "h": .., "cells": [{ "name": ..., "png": "<base64>" }, ...] }
    std::string palette(int index);
    bool applyPaletteCell(int paletteIndex, int cellIndex);

    //! Paper and canvas colours (#rrggbb); dark inverts the score for the night theme
    void setCanvasTheme(bool dark, const std::string& paper, const std::string& canvas);

    //! Reader mode: taps select, but no gesture can change the score
    void setViewOnly(bool viewOnly);
    void setPageLock(bool enabled);
    std::string pageView(int page, double width, double height);
    std::string gestureView(double factor, double dx, double dy, double cx, double cy);
    std::string renderPage(int page, int pixels);
    void readerLayout(int mode);
    std::string scorePanels() const;
    std::string changeMixer(const std::string& json);
    std::string changeParts(const std::string& json);
    std::string scoreStyle() const;
    std::string applyScoreStyle(const std::string& json);
    std::string transposeScore(int key, int direction, bool wholeScore);

    //! Re-sends every state event (the page calls this once it has subscribed)
    void sync();

private:

    WebApi() = default;

    void onProjectChanged();
    void onNotationChanged();
    void onProjectSaved(const muse::io::path_t& path, mu::project::SaveMode mode);

    void sendProject();
    void sendSelection();
    void sendNoteInput();
    void sendPlaying();

    project::INotationProjectPtr m_currentProject;
    notation::INotationPtr m_currentNotation;
    double m_lastPositionSent = -1.0;
    muse::modularity::ContextPtr m_ctx;
    bool m_pageLocked = false;
    int m_readerPage = 0;
    muse::draw::Transform m_pageMatrix;
};
}
