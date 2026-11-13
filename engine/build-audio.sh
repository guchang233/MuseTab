#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK=/d/MuseTabSDK
SRC=/d/b/ms
MIRROR=/d/b/audio-src
BUILD=/d/b/aw
NAME=MuseAudio
SIMD_OPTION=OFF
if [ "${SIMD:-0}" = 1 ]; then BUILD=/d/b/aw-simd; NAME=MuseAudio-simd; SIMD_OPTION=ON; fi
export PATH="$SDK/python/Scripts:$PATH"
export EMSDK_QUIET=1
source "$SDK/emsdk/emsdk_env.sh" >/dev/null 2>&1
python "$HERE/prepare-audio.py" D:/b/ms D:/b/audio-src
cmake -S D:/b/audio-src/src/web/audioengine -B "$BUILD" -GNinja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=D:/MuseTabSDK/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
  -DMUSE_MODULE_AUDIO_WORKMODE=3 -DMUSE_CONFIGURATION_IS_WEB=ON -DMUSETAB_AUDIO_SIMD="$SIMD_OPTION"
ninja -C "$BUILD" -j "${JOBS:-2}" -k 40
cp "$MIRROR/build.artifacts/$NAME.js" "$SRC/build.artifacts/$NAME.js"
echo "Audio source build staged to main artifacts"
