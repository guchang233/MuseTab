# Build environment

Canonical project: `D:/AI/2026/MuseTab` (without a space). The older
`D:/AI/2026/MUSE TAB` is a separate prototype; do not mix its source or packages
with this project.

## Frontend

Node and pnpm must be on PATH. Run from the canonical project directory:

```powershell
pnpm --dir app install --frozen-lockfile
pnpm --dir app check
pnpm --dir app dev --host 127.0.0.1 --port 5183
```

Open `http://127.0.0.1:5183`. The native engine assets must already be staged in
`app/public/engine`. Do not open `app/index.html` directly as a file.

## Native score engine

Current environment:

- MuseScore source: `D:/b/ms`, version.cmake reports 4.7.4 development.
- Main build tree: `D:/b/w`; generated artifacts: `D:/b/ms/build.artifacts`.
- SDK: `D:/MuseTabSDK`.
- Qt: 6.7.3 `wasm_singlethread`, matching host tools `msvc2019_64`.
- Emscripten: 3.1.50; CMake/Ninja/Python: `D:/MuseTabSDK/python/Scripts`.
- Git Bash: `C:/Program Files/Git/bin/bash.exe`.

The source tree must include MuseScore's normal third-party dependencies.
`engine/shell` replaces only the web application shell; `engine/overrides`
replaces selected native files. `engine/patches/web_patches.py` contains the
idempotent compatibility and import fixes.

Initial configuration, in Git Bash:

```bash
bash engine/sync-shell.sh
/d/MuseTabSDK/python/Scripts/python.exe engine/patches/web_patches.py D:/b/ms
JOBS=2 BINARYEN_CORES=2 bash engine/build-wasm.sh configure
JOBS=2 BINARYEN_CORES=2 bash engine/iterate.sh
bash engine/stage.sh
```

For later source changes, run only `iterate.sh` then `stage.sh`. The iteration
script also corrects Qt 6.7-generated namespace registrations. Link and
WebAssembly optimization can take several minutes. Logs: `D:/b/build.log` and
`D:/b/patch.log`. A failed patch or native build returns a nonzero exit code.

Build the matching audio target before final staging:

```bash
JOBS=1 BINARYEN_CORES=1 bash engine/build-audio.sh
bash engine/stage.sh
```

`prepare-audio.py` creates a matching isolated source tree in `D:/b/audio-src`,
applies the standalone target's Qt-free compatibility fixes, and builds in
`D:/b/aw`. This avoids invalidating the notation build while fixing audio-only
headers. The resulting `MuseAudio.js` is copied into the main artifacts folder.
Staging requires this matching module and the SoundFont; it fails if either is
missing. Older prebuilt audio modules lack this port's readiness handshake.
See `THIRD_PARTY.md`.

## Android APK

Requirements already installed on this machine:

- Android SDK: `D:/MuseTabSDK/Android/Sdk`, platform/build-tools 36.
- JDK 17: `C:/Program Files/Microsoft/jdk-17.0.11.9-hotspot`.
- Python: `D:/MuseTabSDK/python/Scripts/python.exe`.

```powershell
node android/build.mjs
```

This builds the frontend, packages offline assets, compiles the Java WebView
container, aligns and signs `release/MuseTab-0.5.0.apk`. Intermediates are confined
to `D:/MuseTabBuild/android`. It uses a development signing key, package
`org.musetab.app`, Android 9+ and target SDK 35. Gradle is not required.

INTERNET permission is used for read-only HTTPS GET requests to
raw.githubusercontent.com. The app does not call the GitHub REST API.
Navigation remains on the local app origin.
Embedded assets are served inside WebView under `https://musetab.local/`.
SoundFont, fonts, WebAssembly and the PDF.js legacy worker are included.
The frontend dev/build scripts stage PDF CMaps and standard fonts locally.
Private `_test.*` inputs and interface mockups are excluded from packaging.

## Local verification tools

`tools/probe-engine.mjs` exercises the real browser file input and captures the
native canvas; `tools/probe-core.mjs` checks native import/export, pitch editing,
undo/redo, playback position and file switching. They require desktop Chrome,
the dev server on port 5183 and the local `_test.mscz` / `_test.mid` files.
Results are written to `tests/results`; these private files are not shipped.

Do not replace file-level verification with UI labels: compare exported MSCZ
note data and confirm that switching files changes the native document.

Additional checks for 0.4.2 (development server required for browser checks):

```powershell
node --experimental-transform-types tools/verify-catalog.mjs
node tools/verify-live-cloud.mjs
node tools/verify-reader-fixes.mjs
node tools/verify-pdf-gallery.mjs
node tools/verify-cloud-ui.mjs
```

The static catalog generator and GitHub Actions workflow live in `cloud-library`.
The real public repository has the same files installed; successful workflow runs
publish `catalog.json` after score uploads. Browser checks verify immutable raw
downloads with Git blob checksums, never REST directory traversal.

## 固定依赖和 tag CI

首次检出源码后，可直接 `node tools/runtime.mjs` 下载 SHA-256 锁定的原生运行包，再构建 Web / APK，不需要每位开发者重装 Qt。完整原生对应源码随 runtime Release 提供，锁文件记录上游 commit。

音频支持两个独立构建：`bash engine/build-audio.sh` 生成标量版本，`SIMD=1 bash engine/build-audio.sh` 生成 SIMD 版本；都完成后再 stage。运行时检测 SIMD 支持并选择对应模块。

Android 构建支持环境变量：ANDROID_SDK_ROOT（或 ANDROID_HOME）、JAVA_HOME、MUSETAB_PYTHON、MUSETAB_BUILD_ROOT、MUSETAB_KEYSTORE。本地默认路径仍在 D 盘；CI 必须传入既有签名密钥，不生成替代密钥。

推送与 package/manifest 一致的 v* tag 后自动构建并发布；详见 [RELEASING.md](RELEASING.md)。客户端更新直接读 Release 附件，独立于 raw 曲库请求；两者都不会上传用户乐谱。
