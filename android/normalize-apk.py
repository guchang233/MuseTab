# SPDX-License-Identifier: GPL-3.0-only
"""Adds classes.dex to the aapt2 output and normalizes Windows path separators.

aapt2 on Windows writes nested asset names with backslashes; Android requires
forward slashes. Everything is stored uncompressed so large assets can be
served by byte range.
"""
import shutil
import sys
import zipfile

source, dex, target = sys.argv[1:]
with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as output:
    for entry in original.infolist():
        name = entry.filename.replace("\\", "/")
        info = zipfile.ZipInfo(name, date_time=entry.date_time)
        info.compress_type = zipfile.ZIP_STORED
        with original.open(entry) as incoming, output.open(info, "w") as outgoing:
            shutil.copyfileobj(incoming, outgoing, 1024 * 1024)
    output.write(dex, "classes.dex")
    assert all("\\" not in e.filename for e in output.infolist())
