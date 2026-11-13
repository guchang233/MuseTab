#!/usr/bin/env bash
# 用无头 Chrome 给三屏各截明、暗主题与横、竖屏图（共 12 张），存到 docs/design。
# 先起开发服务器（pnpm dev），再运行：  bash scripts/shots.sh [输出目录] [服务器地址]
set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$APP/../docs/design}"
BASE="${2:-http://localhost:5183}"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="${TMPDIR:-/tmp}/musetab-shots-profile"
SCALE="${SCALE:-2}"

mkdir -p "$OUT"

shot() { # 名称 宽 高 路由与参数
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$PROFILE" --force-device-scale-factor="$SCALE" \
    --window-size="$2,$3" --virtual-time-budget=6000 \
    --screenshot="$(cygpath -w "$OUT/$1.png" 2>/dev/null || echo "$OUT/$1.png")" \
    "$BASE/#/$4" >/dev/null 2>&1
  echo "  $1.png"
}

for theme in light dark; do
  for o in landscape portrait; do
    if [ "$o" = landscape ]; then w=1280; h=800; else w=800; h=1280; fi
    shot "library-$theme-$o" $w $h "library?theme=$theme"
    shot "reader-$theme-$o" $w $h "reader?theme=$theme&pin"
    shot "editor-$theme-$o" $w $h "editor?theme=$theme"
  done
done

# 补充状态（不计入 12 张）
if [ "${EXTRAS:-1}" = 1 ]; then
  mkdir -p "$OUT/extras"
  shot "extras/reader-bare-light-landscape" 1280 800 "reader?theme=light"
  shot "extras/reader-bare-dark-portrait" 800 1280 "reader?theme=dark"
  shot "extras/reader-tempo-light-landscape" 1280 800 "reader?theme=light&pin&tempo"
  shot "extras/editor-props-light-landscape" 1280 800 "editor?theme=light&props"
  shot "extras/editor-palette-dark-portrait" 800 1280 "editor?theme=dark&palette"
  shot "extras/editor-more-dark-landscape" 1280 800 "editor?theme=dark&more"
fi
