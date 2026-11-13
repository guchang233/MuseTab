// SPDX-License-Identifier: GPL-3.0-only
// Builds the MuseTab Android APK without Gradle:
//   vite build -> assets, aapt2 (manifest + icon) -> javac -> d8 -> zipalign -> apksigner
// Usage (repo root): node android/build.mjs
// Tooling lives in D:/MuseTabSDK, intermediates in D:/MuseTabBuild/android,
// the APK lands in release/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SDK = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || 'D:/MuseTabSDK/Android/Sdk';
const JDK = process.env.JAVA_HOME || 'C:/Program Files/Microsoft/jdk-17.0.11.9-hotspot';
const PY = process.env.MUSETAB_PYTHON || 'D:/MuseTabSDK/python/Scripts/python.exe';
const buildRoot = process.env.MUSETAB_BUILD_ROOT || 'D:/MuseTabBuild';
const BUILD = path.join(buildRoot,'android');
const TOOLS = path.join(SDK, 'build-tools/36.0.0');
const ANDROID_JAR = path.join(SDK, 'platforms/android-36/android.jar');
const KEY = process.env.MUSETAB_KEYSTORE || 'D:/MuseTabSDK/android-debug.keystore';
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'app/package.json'), 'utf8'));
const VERSION = pkg.version;
const OUT = path.join(ROOT, `release/MuseTab-${VERSION}.apk`);

// Files under app/public/engine that are for local testing only
const EXCLUDE = [/^engine\/_test\./, /^engine\/viewer\.html$/, /^mock\//];

function run(exe, args, opts = {}) {
  console.log('»', path.basename(exe), args.slice(0, 3).join(' '));
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      stdio: 'inherit',
      windowsHide: true,
      shell: opts.shell ?? false,
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env, JAVA_HOME: JDK, PATH: path.join(JDK, 'bin') + path.delimiter + process.env.PATH },
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${exe} exited with ${code}`))));
  });
}

async function walk(dir, base = dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, base, out);
    else out.push(path.relative(base, p).replaceAll('\\', '/'));
  }
  return out;
}

console.log(`MuseTab ${VERSION} (${pkg.name})`);
const resolvedBuild=path.resolve(BUILD);
if(path.dirname(resolvedBuild)!==path.resolve(buildRoot)||path.basename(resolvedBuild)!=='android')throw Error('Unexpected Android build output directory');
await fs.rm(BUILD, { recursive: true, force: true });
for (const d of ['assets', 'classes', 'dex', 'gen', 'res']) await fs.mkdir(path.join(BUILD, d), { recursive: true });

// 1. web app
await run('pnpm', ['--dir', 'app', 'build'], { shell: true });
const dist = path.join(ROOT, 'app/dist');
let copied = 0;
for (const rel of await walk(dist)) {
  if (EXCLUDE.some((rx) => rx.test(rel))) continue;
  const to = path.join(BUILD, 'assets', rel);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(path.join(dist, rel), to);
  copied++;
}
console.log(`assets: ${copied} files`);
for (const need of ['index.html', 'engine/host.html', 'engine/MuseScoreStudio.wasm', 'engine/MuseAudio.js', 'engine/sound/MS Basic.sf3']) {
  await fs.access(path.join(BUILD, 'assets', need)).catch(() => {
    throw new Error(`missing asset: ${need} (run engine/stage.sh first)`);
  });
}

// 2. resources (launcher icon)
const resZip = path.join(BUILD, 'res.zip');
await run(path.join(TOOLS, 'aapt2.exe'), ['compile', '--dir', path.join(ROOT, 'android/res'), '-o', resZip]);

// 3. keystore (debug)
await fs.access(KEY).catch(() => {
  if(process.env.CI)throw new Error('Release signing keystore is required in CI');
  return run(path.join(JDK, 'bin/keytool.exe'), [
    '-genkeypair', '-keystore', KEY, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
    '-dname', 'CN=Android Debug,O=Android,C=US', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
  ]);
});

// 4. link: manifest + resources + uncompressed assets (WASM/SF3 are served by range)
await run(path.join(TOOLS, 'aapt2.exe'), [
  'link', '-I', ANDROID_JAR,
  '--manifest', path.join(ROOT, 'android/AndroidManifest.xml'),
  '--java', path.join(BUILD, 'gen'),
  '-A', path.join(BUILD, 'assets'),
  '-R', resZip, '--auto-add-overlay',
  '-0', '',
  '--min-sdk-version', '28', '--target-sdk-version', '35',
  '-o', path.join(BUILD, 'unsigned.apk'),
]);

// 5. code
const javaSources = [(await walk(path.join(ROOT,'android'))).filter(f=>f.endsWith('.java')).map(f=>path.join(ROOT,'android',f)),(await walk(path.join(BUILD, 'gen'))).filter(f=>f.endsWith('.java')).map(f=>path.join(BUILD, 'gen', f))].flat();
await run(path.join(JDK, 'bin/javac.exe'), [
  '-encoding', 'UTF-8', '-source', '17', '-target', '17', '-nowarn',
  '-classpath', ANDROID_JAR, '-d', path.join(BUILD, 'classes'), ...javaSources,
]);
const classes = (await walk(path.join(BUILD, 'classes'))).filter((f) => f.endsWith('.class')).map((f) => path.join(BUILD, 'classes', f));
await run(path.join(JDK, 'bin/java.exe'), [
  '-cp', path.join(TOOLS, 'lib/d8.jar'), 'com.android.tools.r8.D8',
  '--lib', ANDROID_JAR, '--min-api', '28', '--output', path.join(BUILD, 'dex'), ...classes,
]);

// 6. add dex (+ fix Windows path separators), align, sign
await run(PY, [path.join(ROOT, 'android/normalize-apk.py'), path.join(BUILD, 'unsigned.apk'), path.join(BUILD, 'dex/classes.dex'), path.join(BUILD, 'with-dex.apk')]);
await run(path.join(TOOLS, 'zipalign.exe'), ['-f', '-p', '4', path.join(BUILD, 'with-dex.apk'), path.join(BUILD, 'aligned.apk')]);
await fs.mkdir(path.dirname(OUT), { recursive: true });
const signer = path.join(TOOLS, 'lib/apksigner.jar');
await run(path.join(JDK, 'bin/java.exe'), ['-jar', signer, 'sign', '--ks', KEY, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', OUT, path.join(BUILD, 'aligned.apk')]);
await run(path.join(JDK, 'bin/java.exe'), ['-jar', signer, 'verify', OUT]);
const { size } = await fs.stat(OUT);
console.log(`APK: ${OUT}  (${(size / 1048576).toFixed(1)} MB)`);
