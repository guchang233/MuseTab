# Removes CSS rule blocks that svelte-check reports as unused (mockup leftovers).
# Usage: pnpm check --output machine | python prune_css.py   (run in app/)
import re
import sys
from pathlib import Path

hits = {}
for line in sys.stdin:
    m = re.search(r'WARNING "([^"]+)" (\d+):\d+ "Unused CSS selector', line)
    if m:
        hits.setdefault(m.group(1).replace("\\\\", "/").replace("\\", "/"), set()).add(int(m.group(2)))

for file, lines in hits.items():
    p = Path(file)
    src = p.read_text(encoding="utf-8").split("\n")
    drop = set()
    for ln in lines:
        i = ln - 1
        # the rule starts at the reported line (a selector list may start earlier)
        start = i
        while start > 0 and src[start - 1].rstrip().endswith(","):
            start -= 1
        j = i
        depth = 0
        while j < len(src):
            depth += src[j].count("{") - src[j].count("}")
            if "{" in src[j] and depth == 0:
                break
            if depth == 0 and "}" in src[j]:
                break
            j += 1
        drop.update(range(start, j + 1))
        # a blank line right after a removed block
        if j + 1 < len(src) and not src[j + 1].strip():
            drop.add(j + 1)
    out = [l for k, l in enumerate(src) if k not in drop]
    p.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"{file}: removed {len(drop)} lines")
