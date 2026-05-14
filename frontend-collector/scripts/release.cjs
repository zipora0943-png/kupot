#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * Release a new collector build.
 *
 * Pipeline:
 *   1. bump package.json version  (semver patch / minor / major)
 *   2. sync Android build.gradle  (versionName + auto-incremented versionCode)
 *   3. npm run build              (vite production build)
 *   4. npx cap sync android       (copy web assets into the native project)
 *   5. gradlew assembleDebug      (sign + package APK)
 *   6. upload APK to backend      (POST /api/version/collector — admin only)
 *
 * Invocation:
 *   node scripts/release.js [--bump=patch|minor|major] [--notes="..."]
 *                           [--min=X.Y.Z] [--skip-upload] [--no-bump]
 *
 * Env (or pass as flags):
 *   RELEASE_SERVER  e.g. http://178.105.96.70:3000
 *   RELEASE_TOKEN   admin JWT from /api/auth/login
 */
'use strict';

const fs       = require('fs');
const fsp      = require('fs/promises');
const path     = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT       = path.resolve(__dirname, '..');
const PKG_PATH   = path.join(ROOT, 'package.json');
const GRADLE     = path.join(ROOT, 'android', 'app', 'build.gradle');
const APK_OUT    = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const IS_WIN     = process.platform === 'win32';
const GRADLEW    = path.join(ROOT, 'android', IS_WIN ? 'gradlew.bat' : 'gradlew');

// ── CLI arg parsing ───────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { bump: 'patch', notes: '', min: null, skipUpload: false, noBump: false };
for (const a of args) {
  if (a === '--no-bump' || a === '--skip-bump') opts.noBump = true;
  else if (a === '--skip-upload')               opts.skipUpload = true;
  else if (a.startsWith('--bump='))             opts.bump  = a.slice('--bump='.length);
  else if (a.startsWith('--notes='))            opts.notes = a.slice('--notes='.length);
  else if (a.startsWith('--min='))              opts.min   = a.slice('--min='.length);
  else if (a.startsWith('--server='))           process.env.RELEASE_SERVER = a.slice('--server='.length);
  else if (a.startsWith('--token='))            process.env.RELEASE_TOKEN  = a.slice('--token='.length);
  else { console.error(`Unknown arg: ${a}`); process.exit(2); }
}
if (!['patch', 'minor', 'major'].includes(opts.bump)) {
  console.error('--bump must be one of: patch, minor, major'); process.exit(2);
}

// ── Helpers ───────────────────────────────────────────────────────
function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (cwd: ${cwd || ROOT})`);
  const r = spawnSync(cmd, { cwd: cwd || ROOT, shell: true, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`✘ command failed (exit ${r.status}): ${cmd}`);
    process.exit(r.status || 1);
  }
}

function bumpSemver(v, kind) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  let [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === 'major') { maj++; min = 0; pat = 0; }
  else if (kind === 'minor') { min++; pat = 0; }
  else { pat++; }
  return `${maj}.${min}.${pat}`;
}

function readJson(p)  { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

// Update Android versionName + auto-increment versionCode in build.gradle.
function syncAndroidVersion(version) {
  let txt = fs.readFileSync(GRADLE, 'utf8');
  txt = txt.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  txt = txt.replace(/versionCode\s+(\d+)/, (_m, n) => `versionCode ${Number(n) + 1}`);
  fs.writeFileSync(GRADLE, txt, 'utf8');
  const after = fs.readFileSync(GRADLE, 'utf8');
  const code  = after.match(/versionCode\s+(\d+)/)?.[1];
  console.log(`  android versionName=${version}, versionCode=${code}`);
}

async function uploadApk({ server, token, version, minSupported, notes, apkPath }) {
  const url = server.replace(/\/+$/, '') + '/api/version/collector';
  const apkBuf = await fsp.readFile(apkPath);
  const fd = new FormData();
  fd.append('apk', new Blob([apkBuf], { type: 'application/vnd.android.package-archive' }),
            `collector-${version}.apk`);
  fd.append('version', version);
  fd.append('min_supported_version', minSupported);
  fd.append('release_notes', notes || '');

  console.log(`\n▶ POST ${url}  (apk: ${(apkBuf.length / 1024 / 1024).toFixed(2)} MB)`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✘ upload failed: HTTP ${res.status}\n${text}`);
    process.exit(1);
  }
  console.log('✔ manifest updated on server:\n' + text);
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  const pkg = readJson(PKG_PATH);
  const oldVersion = pkg.version;
  const newVersion = opts.noBump ? oldVersion : bumpSemver(oldVersion, opts.bump);

  console.log(`\n=== collector release ===`);
  console.log(`  ${oldVersion}  →  ${newVersion}` + (opts.noBump ? '  (no bump)' : ''));

  if (!opts.noBump) {
    pkg.version = newVersion;
    writeJson(PKG_PATH, pkg);
    syncAndroidVersion(newVersion);
  }

  // Build pipeline
  run('npm run build');
  run('npx cap sync android');
  run((IS_WIN ? '.\\' : './') + path.basename(GRADLEW) + ' assembleDebug', path.dirname(GRADLEW));

  if (!fs.existsSync(APK_OUT)) {
    console.error(`✘ APK not found at expected path: ${APK_OUT}`);
    process.exit(1);
  }

  if (opts.skipUpload) {
    console.log(`\n✔ build complete (upload skipped). APK:\n  ${APK_OUT}`);
    return;
  }

  const server = process.env.RELEASE_SERVER;
  const token  = process.env.RELEASE_TOKEN;
  if (!server || !token) {
    console.error('\n✘ RELEASE_SERVER and RELEASE_TOKEN must be set (or pass --server / --token).');
    console.error('  Build succeeded but upload skipped. APK is at:\n  ' + APK_OUT);
    process.exit(1);
  }

  await uploadApk({
    server,
    token,
    version: newVersion,
    minSupported: opts.min || newVersion,   // default: only this version is supported
    notes: opts.notes,
    apkPath: APK_OUT,
  });

  console.log(`\n✔ release ${newVersion} published.`);
})().catch((err) => {
  console.error('✘ release failed:', err);
  process.exit(1);
});
