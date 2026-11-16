"""Pin the actual Android/shared Aria editor sources and Android icon assets."""
from pathlib import Path
import hashlib, json, shutil, subprocess

project = Path(__file__).resolve().parents[1]
source = Path('D:/AI/2026/MuseTab-reference/aria')
commit = '9dffd7f3feea6d5af068723d5cfff47e7283a69c'
actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
if actual != commit:
    raise SystemExit('Reference commit mismatch: ' + actual)
destination = project / 'docs/references/aria-editor'
icons = project / 'app/public/aria-symbols'
files = set()
for folder in ['Views', 'Models']:
    base = source / 'MuseReaderiOS/MuseReaderiOS' / folder
    files.update(base.glob('ScoreReader*.swift'))
files.update([
    source / 'MuseReaderiOS/MuseReaderiOS/Models/AriaWindowLayout.swift',
    source / 'MuseReaderiOS/MuseReaderiOS/Models/NewScoreDraft.swift',
    source / 'MuseReaderiOS/MuseReaderiOS/Models/NewScoreInstrumentCatalog.swift',
    source / 'MuseReaderiOS/MuseReaderiOS/Models/ScoreExportModels.swift',
    source / 'MuseReaderiOS/MuseReaderiOS/Views/CreateNewScoreView.swift',
    source / 'sandbox/engraving/score_render_edit_commands.cpp',
    source / 'MuseReaderiOS/MuseReaderiOS/Services/LiveScoreRenderSession.swift',
    source / 'MuseReaderAndroid/scripts/generate-symbols.py',
    source / 'MuseReaderAndroid/THIRD_PARTY_NOTICES.md',
    source / 'LICENSE.txt',
])
android = source / 'MuseReaderAndroid/Aria/Sources/AriaSkip'
for pattern in ['AndroidSelection*.swift', 'Android*Text*.swift', 'AndroidMusicNotationFont.swift', 'AndroidPlatformTypes.swift', 'AndroidSwiftUIShims.swift']:
    files.update(android.glob(pattern))
manifest = {'repository': 'https://github.com/hdi200/aria', 'commit': commit, 'files': []}
for path in sorted(files):
    relative = path.relative_to(source)
    target = destination / 'source' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    manifest['files'].append({'source': relative.as_posix(), 'destination': target.relative_to(project).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
catalog = source / 'MuseReaderAndroid/Aria/Android/app/symbol-assets/aria/skip/Resources/Module.xcassets'
icons.mkdir(parents=True, exist_ok=True)
for path in sorted(catalog.glob('*.symbolset/*.svg')):
    target = icons / path.name
    shutil.copyfile(path, target)
    manifest['files'].append({'source': path.relative_to(source).as_posix(), 'destination': target.relative_to(project).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
extras={
    'MuseReaderAndroid/Aria/Vendor/swift-jni/LICENSE.txt':'app/public/aria-symbols/LICENSE-APACHE-2.0.txt',
    'fonts/bravura/BravuraText.otf':'app/public/fonts/aria/BravuraText.otf',
    'fonts/bravura/OFL.txt':'app/public/fonts/aria/OFL.txt',
    'MuseReaderiOS/MuseReaderiOS/Assets.xcassets/ScoreReaderStackedChord.imageset/ScoreReaderStackedChord.png':'app/public/aria-symbols/ScoreReaderStackedChord.png',
}
for relative, output in extras.items():
    path=source/relative;target=project/output;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
    manifest['files'].append({'source':relative,'destination':output,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
destination.mkdir(parents=True, exist_ok=True)
(destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Pinned {len(manifest["files"])} editor source/icon files from {commit}')
