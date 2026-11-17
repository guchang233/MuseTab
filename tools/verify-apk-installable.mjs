#!/usr/bin/env node
/** 发版前确认 APK：zipalign、签名方案声明与内容一致、versionCode 匹配。 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
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

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const bytes = readFileSync(apk);
const sha = createHash('sha256').update(bytes).digest('hex');
const badging = run(join(tools, 'aapt'), ['dump', 'badging', apk]);
if (badging.code !== 0) {
  console.error('FAIL aapt badging', badging.out);
  process.exit(1);
}
const m = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging.out);
if (!m || Number(m[1]) !== versionCode || m[2] !== pkg.version) {
  console.error('FAIL badging version', m, versionCode, pkg.version);
  process.exit(1);
}

const align = run(join(tools, 'zipalign'), ['-c', '-p', '4', apk]);
if (align.code !== 0) {
  console.error('FAIL zipalign', align.out);
  process.exit(1);
}

const verify = run(join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk]);
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

const dir = mkdtempSync(join(tmpdir(), 'musetab-apk-'));
try {
  const unzip = run('unzip', ['-Z1', apk]);
  const sfEntry = unzip.out.split(/\r?\n/).find((n) => n.startsWith('META-INF/') && n.endsWith('.SF'));
  let claimed = '';
  if (sfEntry) {
    run('unzip', ['-oq', apk, sfEntry, '-d', dir]);
    const sf = readFileSync(join(dir, sfEntry), 'utf8');
    claimed = (/X-Android-APK-Signed:\s*(.+)/.exec(sf) || [])[1]?.trim() || '';
    const claimedSet = new Set(claimed.split(/,\s*/).filter(Boolean));
    if (claimedSet.has('2') && !hasV2) {
      console.error('FAIL SF claims v2 but apksigner v2=false (OEM installers reject this)');
      process.exit(1);
    }
    if (claimedSet.has('3') && !hasV3) {
      console.error('FAIL SF claims v3 but apksigner v3=false');
      process.exit(1);
    }
  }
  console.log(
    JSON.stringify(
      { apk: `MuseTab-${pkg.version}.apk`, versionCode, size: bytes.length, sha256: sha, v2: hasV2, v3: hasV3, claimed },
      null,
      2,
    ),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('PASS apk installability checks');
