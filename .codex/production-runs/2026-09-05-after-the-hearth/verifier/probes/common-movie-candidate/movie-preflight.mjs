/**
 * PRIVATE PREFLIGHT GATE (common-movie-candidate). NO BROWSER, NO GPU.
 *
 * The commissioned harness for the actual measurement is the byte-exact private
 * copy of `arrival-common-verifier/journey-probe.mjs` sitting next to this file.
 * That harness takes its URL from `verifier/artifacts/preview-ownership.json`
 * and its source binding from `verifier-control.json`; it has NO `--url`, no
 * `--heavy-lock`, no `--heavy-lock-fd` and no `--expect-source-manifest` flag,
 * and none may be invented for it. So the lock, role and served-identity
 * assertions the commission requires happen HERE, in the launcher's own
 * process, BEFORE any browser is launched.
 *
 * Everything below is read-only. It reads the two root-owned control files, the
 * inherited descriptor, /proc/locks and the ALREADY-SERVED bytes over HTTP. It
 * writes nothing except its own receipt under --out. It never starts, stops or
 * signals the root preview, and it never touches game source.
 *
 * The lock/served-binding logic is the RETAINED helper
 * `../earned-continue-3d/pinned/commonPassageLogic.pinned.mjs` (imported
 * read-only, not copied, not modified). Only its pure, non-route functions are
 * used: heavyLockOwnership / fetchServedIdentity / previewBindingDecision. The
 * manual route geometry and the [F] gates in that module are NOT used here and
 * are NOT part of this candidate: this run is the shipped movie/autopilot lane.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';
import {
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision
} from '../earned-continue-3d/pinned/commonPassageLogic.pinned.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// same depth as arrival-common-verifier: probes -> verifier -> RUN_DIR
const RUN_DIR = resolve(HERE, '..', '..', '..');
const CONTROL_PATH = resolve(RUN_DIR, 'verifier-control.json');
const OWNERSHIP_PATH = resolve(RUN_DIR, 'verifier', 'artifacts', 'preview-ownership.json');

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

const expectRole = arg('expect-role');
const expectAction = arg('expect-action', 'continue');
const expectManifest = arg('expect-source-manifest');
const expectIndexSha = arg('expect-index-sha');
const expectBundleSha = arg('expect-bundle-sha');
const lockPath = arg('heavy-lock');
const lockFdRaw = arg('heavy-lock-fd');
const lockFd = lockFdRaw === null ? null : Number(lockFdRaw);
const outDir = arg('out');
const expectGpu = arg('expect-gpu', 'GB10');

const receipt = {
  schema: 'paravoxia.verifier.commonMovieCandidate.preflight.v1',
  at: new Date().toISOString(),
  pid: process.pid,
  runDir: RUN_DIR,
  request: { expectRole, expectAction, expectManifest, expectIndexSha, expectBundleSha, lockPath, lockFd, outDir, expectGpu },
  refusals: []
};
const refuse = (m) => receipt.refusals.push(m);

// ---------------------------------------------------------------- 1. role ---
// The launcher may only run when ROOT has handed this exact role the baton.
try {
  const raw = readFileSync(CONTROL_PATH);
  const control = JSON.parse(raw.toString('utf8'));
  receipt.control = {
    sha256: createHash('sha256').update(raw).digest('hex'),
    updatedAt: control.updatedAt ?? null,
    activeRole: control.activeRole ?? null,
    action: control.action ?? null,
    sourceManifestSha256: control.sourceManifestSha256 ?? null,
    currentIndexSha256: control.currentIndexSha256 ?? null
  };
  if (!expectRole) refuse('--expect-role is required');
  else if (control.activeRole !== expectRole) {
    refuse(`verifier-control activeRole=${JSON.stringify(control.activeRole ?? null)}, not ${JSON.stringify(expectRole)} — this launcher has NOT been given the baton`);
  }
  if (control.action !== expectAction) {
    refuse(`verifier-control action=${JSON.stringify(control.action ?? null)}, not ${JSON.stringify(expectAction)}`);
  }
  if (expectManifest && control.sourceManifestSha256 !== expectManifest) {
    refuse(`verifier-control sourceManifestSha256 ${control.sourceManifestSha256} != expected ${expectManifest}`);
  }
  if (expectIndexSha && control.currentIndexSha256 && control.currentIndexSha256 !== expectIndexSha) {
    refuse(`verifier-control currentIndexSha256 ${control.currentIndexSha256} != expected ${expectIndexSha}`);
  }
} catch (e) { refuse(`verifier-control.json unreadable: ${String(e).slice(0, 200)}`); }

// ------------------------------------------------- 2. heavy lock ownership ---
// The descriptor must be INHERITED and already exclusively flocked by the
// launcher; this process only proves it, it never acquires it. probeContention
// is ON: an independent `flock -n -x` must be REFUSED, otherwise no live
// exclusive lock is actually held.
receipt.heavyLock = heavyLockOwnership({ lockPath, fd: lockFd, probeContention: true });
if (receipt.heavyLock.owned !== true) {
  refuse(`exclusive heavy lock not provably held by this process tree: ${(receipt.heavyLock.problems ?? []).join('; ') || 'no receipt'}`);
}

// -------------------------------------------------------------- 3. hardware --
// Real headed GB10 only. PARAVOXIA_ALLOW_SWIFTSHADER=1 makes evidence.mjs launch
// HEADLESS software SwiftShader (evidence.mjs SWIFTSHADER/headless), which is
// not an acceptable movie capture here.
receipt.hardware = {
  PARAVOXIA_ALLOW_SWIFTSHADER: process.env.PARAVOXIA_ALLOW_SWIFTSHADER ?? null,
  DISPLAY: process.env.DISPLAY ?? null,
  WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? null,
  gpuList: null
};
if (process.env.PARAVOXIA_ALLOW_SWIFTSHADER === '1') {
  refuse('PARAVOXIA_ALLOW_SWIFTSHADER=1 would launch headless SwiftShader — real headed GPU only');
}
if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) refuse('no DISPLAY/WAYLAND_DISPLAY — a headed session cannot be opened');
try {
  const { execFileSync } = await import('node:child_process');
  receipt.hardware.gpuList = String(execFileSync('nvidia-smi', ['-L'], { encoding: 'utf8' })).trim();
} catch (e) { receipt.hardware.gpuListError = String(e).slice(0, 160); }
if (expectGpu && !String(receipt.hardware.gpuList ?? '').includes(expectGpu)) {
  refuse(`nvidia-smi -L does not report ${expectGpu}: ${JSON.stringify(receipt.hardware.gpuList ?? receipt.hardware.gpuListError ?? null)}`);
}

// ------------------------------------- 4. preview ownership + served bytes ---
let ownership = null;
try {
  const raw = readFileSync(OWNERSHIP_PATH);
  ownership = JSON.parse(raw.toString('utf8'));
  receipt.ownership = {
    sha256: createHash('sha256').update(raw).digest('hex'),
    owner: ownership.owner ?? null, state: ownership.state ?? null, url: ownership.url ?? null,
    sourceManifestSha256: ownership.sourceManifestSha256 ?? null,
    indexSha256: ownership.indexSha256 ?? null,
    bundlePath: ownership.bundlePath ?? null, bundleSha256: ownership.bundleSha256 ?? null,
    contractVersion: ownership.contractVersion ?? null, contractSha256: ownership.contractSha256 ?? null
  };
  if (expectIndexSha && ownership.indexSha256 !== expectIndexSha) refuse(`ownership indexSha256 ${ownership.indexSha256} != expected ${expectIndexSha}`);
  if (expectBundleSha && ownership.bundleSha256 !== expectBundleSha) refuse(`ownership bundleSha256 ${ownership.bundleSha256} != expected ${expectBundleSha}`);
} catch (e) { refuse(`preview-ownership.json unreadable: ${String(e).slice(0, 200)}`); }

if (ownership?.url) {
  const served = await fetchServedIdentity({ url: ownership.url, bundlePath: ownership.bundlePath ?? null });
  receipt.served = served;
  const binding = previewBindingDecision({
    ownership, url: ownership.url, expectSourceManifestSha: expectManifest, served, requireBundle: true
  });
  receipt.previewBinding = binding;
  if (!binding.ok) refuse(`served build is not bound to root preview ownership: ${binding.problems.join('; ')}`);
  // Exact HTTP title, from the served index bytes (not from a browser).
  try {
    const res = await fetch(ownership.url, { signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    const m = html.match(/<title>([^<]*)<\/title>/i);
    receipt.servedTitle = m ? m[1].trim() : null;
    if (receipt.servedTitle !== 'Paravoxia') refuse(`served <title> is ${JSON.stringify(receipt.servedTitle)}, not "Paravoxia"`);
  } catch (e) { refuse(`served index title unreadable: ${String(e).slice(0, 160)}`); }
}

// ----------------------------------------------------- 5. fresh output dir ---
// The journey harness itself refuses ANY existing nonempty --out folder
// (assertFreshOutputDir). Refuse here too, before the lock time is spent, and
// NEVER delete or reuse a prior attempt directory.
if (!outDir) refuse('--out is required (a fresh, unique attempt directory)');
else if (existsSync(outDir)) refuse(`--out ${outDir} already exists — prior attempts are preserved, never overwritten or repurposed`);

receipt.ok = receipt.refusals.length === 0;

if (outDir) {
  try {
    mkdirSync(dirname(outDir), { recursive: true });
    writeFileSync(join(dirname(outDir), `preflight-${receipt.ok ? 'ok' : 'refused'}-${Date.now()}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  } catch { /* the console receipt below is the record of last resort */ }
}
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.ok) {
  for (const r of receipt.refusals) console.error(`[movie-preflight] REFUSE ${r}`);
  process.exit(1);
}
console.error('[movie-preflight] OK');
