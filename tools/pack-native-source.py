"""Package the exact native source used by this developer build (no SDK/build outputs)."""
from pathlib import Path
import subprocess, tarfile
root=Path('D:/b/ms')
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files += [str(p.relative_to(root)).replace('\\','/') for p in (root/'src/web/appshell').rglob('*') if p.is_file()]
files += ['src/web/appjs/distr/config.js']
out=Path('release/musescore-corresponding-source.tar.gz')
with tarfile.open(out,'w:gz',compresslevel=1) as archive:
    for rel in sorted(set(files)):
        p=root/rel
        if rel and p.is_file(): archive.add(p,arcname='musescore/'+rel,recursive=False)
    # Standalone audio has its own Qt-free fixes; include its actual source too.
    audio=Path('D:/b/audio-src')
    for base in ['src','buildscripts']:
        for p in (audio/base).rglob('*'):
            if p.is_file() and '__pycache__' not in p.parts:
                archive.add(p,arcname='audio-source/'+str(p.relative_to(audio)).replace('\\','/'),recursive=False)
print(f'Corresponding native source: {out} ({out.stat().st_size} bytes)')
