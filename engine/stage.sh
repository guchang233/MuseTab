#!/usr/bin/env bash
# Copies the built engine (+ MuseTab host page) into app/public/engine,
# where the dev server and the Android package pick it up.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ART="${MUSETAB_SRC:-/d/b/ms}/build.artifacts"
OUT="$HERE/../app/public/engine"
# Audio engine + sound font fallback: the prebuilt MuseScore 4.7.4 web audio
# engine from github.com/clclyzybzjsq/mscore-web-engine (GPL-3.0), used only
# when a local standalone audio build is absent. See THIRD_PARTY.md.
PREBUILT="${MUSETAB_PREBUILT:-/d/AI/2026/MUSE TAB/native/web-engine/engine}"

[ -f "$ART/MuseScoreStudio.wasm" ] || { echo "engine not built: $ART/MuseScoreStudio.wasm missing"; exit 1; }
mkdir -p "$OUT/distr" "$OUT/sound"
cp "$ART/MuseScoreStudio.wasm" "$ART/MuseScoreStudio.js" "$OUT/"
cp "$ART"/distr/* "$OUT/distr/"
for script in "$HERE"/overrides/src/web/appjs/distr/*; do
  [ -f "$script" ] && cp "$script" "$OUT/distr/"
done
cp "$HERE/host/host.html" "$OUT/host.html"
cp "$HERE/shell/qml/MuseScore/AppShell/platform/web/ComposerWorkspace.qml" "$OUT/ComposerWorkspace.qml"
cp "$HERE/../app/src/reader/gestures.js" "$OUT/reader-gestures.js"

[ -f "$ART/MuseAudio.js" ] || { echo "matching audio engine missing: run engine/build-audio.sh"; exit 1; }
cp "$ART/MuseAudio.js" "$OUT/"; echo "audio engine: own build"
if [ -f "$ART/MuseAudio-simd.js" ]; then cp "$ART/MuseAudio-simd.js" "$OUT/"; fi

if [ ! -f "$OUT/sound/MS Basic.sf3" ]; then
  for sf in "$ART/sound/MS Basic.sf3" "$PREBUILT/sound/MS Basic.sf3"; do
    [ -f "$sf" ] && { cp "$sf" "$OUT/sound/"; break; }
  done
fi
[ -f "$OUT/sound/MS Basic.sf3" ] || { echo "sound font missing"; exit 1; }
for notice in "MS Basic_License.md" "MS Basic_Readme.md"; do
  [ -f "$PREBUILT/sound/$notice" ] && cp "$PREBUILT/sound/$notice" "$OUT/sound/"
done
[ -f "$PREBUILT/../NOTICE" ] && cp "$PREBUILT/../NOTICE" "$OUT/UPSTREAM_NOTICE.txt"
[ -f "$ART/../LICENSE.txt" ] && cp "$ART/../LICENSE.txt" "$OUT/LICENSE.txt"
cp "$HERE/../THIRD_PARTY.md" "$OUT/MUSETAB_NOTICE.md"
ls -la "$OUT" | sed -n 1,20p
