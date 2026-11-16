# SPDX-License-Identifier: AGPL-3.0-only
"""Headless state for homr; no Kivy, global storage migration or network I/O."""
import json
import os
from pathlib import Path
import sys

APP_PATH = str(Path(__file__).resolve().parent)
MODEL_STORAGE = os.environ["MUSETAB_OMR_MODELS"]
platform = "android" if os.environ.get("MUSETAB_OMR_ANDROID") == "1" else "win" if sys.platform == "win32" else "linux"


class State:
    homr_state = "Preparing"
    homr_progress = 0
    threads = min(4, os.cpu_count() or 1)

    def __setattr__(self, name, value):
        if os.environ.get("MUSETAB_OMR_CANCEL_FILE") and Path(os.environ["MUSETAB_OMR_CANCEL_FILE"]).exists():
            raise InterruptedError("Recognition cancelled")
        object.__setattr__(self, name, value)
        if name in ("homr_state", "homr_progress"):
            print(json.dumps({"type":"progress", "phase":self.homr_state,"percent":min(100, max(0, float(self.homr_progress))) }), flush=True)


appdata = State()
