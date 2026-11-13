#!/usr/bin/env bash
# Syncs MuseTab's engine sources into the MuseScore tree:
#  - engine/shell      replaces src/web/appshell entirely
#  - engine/overrides  mirrors the source tree; each file replaces its upstream counterpart
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${MUSETAB_SRC:-/d/b/ms}"

# copy only when content differs, so ninja does not rebuild untouched files
sync_tree() {
  local from="$1" to="$2"
  (cd "$from" && find . -type f) | while read -r f; do
    if ! cmp -s "$from/$f" "$to/$f" 2>/dev/null; then
      mkdir -p "$(dirname "$to/$f")"
      cp "$from/$f" "$to/$f"
      echo "  synced ${f#./}"
    fi
  done
}

# drop upstream shell files that are not part of ours
if [ -d "$SRC/src/web/appshell" ]; then
  (cd "$SRC/src/web/appshell" && find . -type f) | while read -r f; do
    [ -f "$HERE/shell/$f" ] || rm -f "$SRC/src/web/appshell/$f"
  done
fi
sync_tree "$HERE/shell" "$SRC/src/web/appshell"
[ -d "$HERE/overrides" ] && sync_tree "$HERE/overrides" "$SRC"
exit 0
