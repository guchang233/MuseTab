#!/usr/bin/env bash
# One build iteration: apply patches, sync shell, build (keep going), summarize errors.
# Usage: bash engine/iterate.sh [-k N]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG=/d/b/build.log
bash "$HERE/sync-shell.sh" >/dev/null || exit 1
if ! /d/MuseTabSDK/python/Scripts/python.exe "$HERE/patches/web_patches.py" D:/b/ms > /d/b/patch.log 2>&1; then
  cat /d/b/patch.log
  exit 1
fi
grep -v "^  ok" /d/b/patch.log || true
export PATH="/d/MuseTabSDK/python/Scripts:$PATH"
export EMSDK_QUIET=1
source /d/MuseTabSDK/emsdk/emsdk_env.sh >/dev/null 2>&1
ninja -C D:/b/w -j "${JOBS:-10}" -k "${KEEP:-40}" > "$LOG" 2>&1
RC=$?
# Generated QML type registrations need a fix-up under Qt 6.7; if any were fixed, build again.
if /d/MuseTabSDK/python/Scripts/python.exe "$HERE/patches/qmltypes_fix.py" D:/b/w | grep -q "fixed [a-z]"; then
  echo "--- qml type registrations fixed, building again"
  ninja -C D:/b/w -j "${JOBS:-10}" -k "${KEEP:-40}" > "$LOG" 2>&1
  RC=$?
fi
echo "BUILD_EXIT=$RC" >> "$LOG"
echo "--- progress: $(grep -o '^\[[0-9]*/[0-9]*\]' "$LOG" | tail -1)  $(tail -n 1 "$LOG")"
echo "--- failed targets:"
grep "^FAILED:" "$LOG" | cut -c1-160 | sort -u | head -40
echo "--- errors:"
grep -E "error:|undefined symbol|fatal error" "$LOG" | grep -v "^em++: error" | sed 's/^.*D:\/b\/ms\///' | cut -c1-330 | sort | uniq -c | sort -rn | head -60
exit "$RC"
