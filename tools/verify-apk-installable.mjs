#!/usr/bin/env node
/** 发版前确认 APK：zipalign、签名声明与校验一致、versionCode 匹配。Windows/Linux 都能跑。 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const win = process.platform === 'win32';
const exe = win ? '.exe' : '';
const pkg = JSON.parse(readFileSync(join(root, 'app/package.json'), 'utf8'));
const manifest = readFileSync(join(root, 'android/AndroidManifest.xml'), 'utf8');
const versionCode = Number(/versionCode="(\d+)"/.exec(manifest)?.[1]);
const apk = join(root, `release/MuseTab-${pkg.version}.apk`);
if (!existsSync(apk)) {
  console.error('FAIL missing', apk);
  process.exit(1);
}
if (!manifest.includes(`versionName="${pkg.version}"`)) {
  console.error('FAIL versionName mismatch');
  process.exit(1);
}

const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/home/ubuntu/android-sdk';
const tools = join(sdk, 'build-tools/36.0.0');
const java = join(process.env.JAVA_HOME || '', 'bin', `java${exe}`);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}`;
  return { code: r.status ?? 1, out };
}

const bytes = readFileSync(apk);
const sha = createHash('sha256').update(bytes).digest('hex');
const badging = run(join(tools, `aapt${exe}`), ['dump', 'badging', apk]);
if (badging.code !== 0) {
  console.error('FAIL aapt badging', badging.out);
  process.exit(1);
}
const m = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging.out);
if (!m || Number(m[1]) !== versionCode || m[2] !== pkg.version) {
  console.error('FAIL badging version', m, versionCode, pkg.version);
  process.exit(1);
}

const align = run(join(tools, `zipalign${exe}`), ['-c', '-p', '4', apk]);
if (align.code !== 0) {
  console.error('FAIL zipalign', align.out);
  process.exit(1);
}

const verify = run(java, ['-jar', join(tools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk]);
if (verify.code !== 0) {
  console.error('FAIL apksigner verify', verify.out);
  process.exit(1);
}
const hasV2 = verify.out.includes('Verified using v2 scheme (APK Signature Scheme v2): true');
const hasV3 = verify.out.includes('Verified using v3 scheme (APK Signature Scheme v3): true');
if (!hasV2 && !hasV3) {
  console.error('FAIL no usable v2/v3 signature\n', verify.out);
  process.exit(1);
}

const py = process.env.MUSETAB_PYTHON || (win ? 'python' : 'python3');
const sf = run(py, [
  '-c',
  'import sys,zipfile,re; z=zipfile.ZipFile(sys.argv[1]); names=[i for i in z.namelist() if i.startswith("META-INF/") and i.endswith(".SF")];\n'
    + 'print("" if not names else (re.search(r"X-Android-APK-Signed:\\s*(.+)", z.read(names[0]).decode()).group(1).strip() if re.search(r"X-Android-APK-Signed:\\s*(.+)", z.read(names[0]).decode()) else ""))',
  apk,
]);
if (sf.code !== 0) {
  console.error('FAIL read signature claim', sf.out);
  process.exit(1);
}
const claimed = sf.out.trim();
const claimedSet = new Set(claimed.split(/,\s*/).filter(Boolean));
if (claimedSet.has('2') && !hasV2) {
  console.error('FAIL SF claims v2 but apksigner v2=false (OEM installers reject this)');
  process.exit(1);
}
if (claimedSet.has('3') && !hasV3) {
  console.error('FAIL SF claims v3 but apksigner v3=false');
  process.exit(1);
}

console.log(
  JSON.stringify(
    { apk: `MuseTab-${pkg.version}.apk`, versionCode, size: bytes.length, sha256: sha, v2: hasV2, v3: hasV3, claimed },
    null,
    2,
  ),
);
console.log('PASS apk installability checks');
