#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Builds the MuseTab engine: MuseScore Studio 4.7.4 (app-web) -> WebAssembly.
# Run from git-bash:  bash engine/build-wasm.sh [configure|build|audio|all]
#
# Everything lives on short D: paths because moc output paths inside the
# MuseScore tree exceed Windows MAX_PATH otherwise.
set -euo pipefail

SDK="${MUSETAB_SDK:-/d/MuseTabSDK}"
SRC="${MUSETAB_SRC:-/d/b/ms}"
BUILD="${MUSETAB_BUILD:-/d/b/w}"
AUDIO_BUILD="${MUSETAB_AUDIO_BUILD:-/d/b/a}"
EMSDK="$SDK/emsdk"
QT_WASM="$SDK/Qt/6.7.3/wasm_singlethread"
QT_HOST="$SDK/Qt/6.7.3/msvc2019_64"
JOBS="${JOBS:-8}"
STEP="${1:-all}"

[ -f "$EMSDK/emsdk_env.sh" ] || { echo "emsdk missing at $EMSDK"; exit 1; }
[ -f "$QT_WASM/lib/cmake/Qt6/qt.toolchain.cmake" ] || { echo "Qt wasm kit missing at $QT_WASM"; exit 1; }
[ -d "$QT_HOST/bin" ] || { echo "Qt host kit missing at $QT_HOST"; exit 1; }

export PATH="$SDK/python/Scripts:$PATH"
export EMSDK_QUIET=1
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
echo "emcc : $(emcc --version 2>&1 | head -1)"
echo "cmake: $(cmake --version | head -1)"

w() { cygpath -m "$1"; }

configure() {
  mkdir -p "$BUILD"
  cmake -S "$(w "$SRC")" -B "$(w "$BUILD")" -GNinja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE="$(w "$QT_WASM")/lib/cmake/Qt6/qt.toolchain.cmake" \
    -DQT_HOST_PATH="$(w "$QT_HOST")" \
    -DMUSESCORE_BUILD_CONFIGURATION=app-web \
    -DMUSE_APP_BUILD_MODE=dev \
    -DCMAKE_BUILD_NUMBER=0 \
    -DMUSESCORE_REVISION=musetab \
    -DMUE_DOWNLOAD_SOUNDFONT=OFF \
    -DMUSE_MODULE_VST=OFF \
    -DMUSE_MODULE_NETWORK_WEBSOCKET=OFF \
    -DMUSE_MODULE_AUDIO_PIPEWIRE=OFF \
    -DMUSE_MODULE_DIAGNOSTICS_CRASHPAD_CLIENT=OFF \
    -DMUSE_ENABLE_UNIT_TESTS=OFF \
    -DMUSE_COMPILE_USE_UNITY=ON
}

build() {
  cmake --build "$(w "$BUILD")" --parallel "$JOBS"
}

audio() {
  bash "$(dirname "$0")/build-audio.sh"
}

case "$STEP" in
  configure) configure ;;
  build) build ;;
  audio) audio ;;
  all) configure; build; audio ;;
  *) echo "usage: $0 [configure|build|audio|all]"; exit 2 ;;
esac
echo "=== $STEP done ==="
