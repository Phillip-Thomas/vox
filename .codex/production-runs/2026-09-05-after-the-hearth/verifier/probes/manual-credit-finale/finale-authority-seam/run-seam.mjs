#!/usr/bin/env node
/** finale-authority-seam PREFLIGHT GATE (no capture body).
 *  Refuses unless the RUNTIME owner has actually been given the role by root:
 *   1. verifier-control.json activeRole=finale-authority-seam-runtime AND action=continue
 *   2. frozen sourceManifestSha256 + served bundle sha + live HTTP index sha at the pinned preview
 *   3. an INHERITED, ALREADY-EXCLUSIVE flock on fd 9 whose st_dev/st_ino equal the SHARED heavy lock
 *      /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock, proven by a CONTENDER:
 *      a child that tries flock -n -x on that same path MUST fail. env/fstat alone prove nothing.
 *  This file NEVER creates a lock, never starts a preview, never launches a browser. */
import { fstatSync, statSync, existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_DIR = resolve(HERE, '..', '..', '..', '..');
const REPO = resolve(RUN_DIR, '..', '..', '..');
const SHARED_LOCK = '/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock';
const die = (c, m) => { console.error(`[finale-authority-seam] REFUSE(${c}): ${m}`); process.exit(c); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

// 1. root control file is the ONLY source of role truth.
const ctlPath = resolve(RUN_DIR, 'verifier-control.json');
if (!existsSync(ctlPath)) die(70, `missing ${ctlPath}`);
const ctl = JSON.parse(readFileSync(ctlPath, 'utf8'));
if (ctl.activeRole !== 'finale-authority-seam-runtime') die(70, `verifier-control.json activeRole=${ctl.activeRole} (need finale-authority-seam-runtime); role NOT transferred`);
if (ctl.action !== 'continue') die(71, `verifier-control.json action=${ctl.action} (need continue)`);

// 2a. frozen source manifest pin.
const FROZEN_SOURCE = '8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962';
if (ctl.sourceManifestSha256 !== FROZEN_SOURCE) die(72, `source drift: control=${ctl.sourceManifestSha256} frozen=${FROZEN_SOURCE}`);

// 2b. served bundle pin (offline pin resolution was done against exactly this bytes).
const { BUNDLE_SHA256, LOGPOINTS } = await import('./seamLogpoints.mjs');
const bundle = resolve(REPO, 'main', 'dist', 'assets', 'index-C1X65dZp.js');
if (!existsSync(bundle)) die(72, `served bundle missing: ${bundle}`);
const gotBundle = sha(readFileSync(bundle));
if (gotBundle !== BUNDLE_SHA256) die(73, `bundle sha mismatch: ${gotBundle}`);

// 2c. the LIVE preview must serve the pinned index (HTTP, not filesystem).
const previewUrl = ctl.currentPreviewUrl;
if (!previewUrl) die(72, 'verifier-control.json has no currentPreviewUrl');
let liveIndexSha;
try {
  const res = await fetch(previewUrl, { redirect: 'follow' });
  if (!res.ok) die(72, `preview ${previewUrl} HTTP ${res.status}`);
  liveIndexSha = sha(Buffer.from(await res.arrayBuffer()));
} catch (err) { die(72, `preview ${previewUrl} unreachable: ${err.message}`); }
if (liveIndexSha !== ctl.currentIndexSha256) die(73, `live index sha ${liveIndexSha} != control ${ctl.currentIndexSha256}`);

// 3. inherited exclusive SHARED lock: identity, then contention proof.
let fd9;
try { fd9 = fstatSync(9); } catch { die(75, 'fd 9 not inherited; root must `exec 9>' + SHARED_LOCK + '` and flock THAT descriptor before exec'); }
if (!fd9.isFile()) die(75, 'fd 9 is not a regular file');
if (!existsSync(SHARED_LOCK)) die(75, `shared lock file absent: ${SHARED_LOCK}`);
const shared = statSync(SHARED_LOCK);
if (fd9.dev !== shared.dev || fd9.ino !== shared.ino) die(75, `fd 9 (dev=${fd9.dev},ino=${fd9.ino}) is NOT ${SHARED_LOCK} (dev=${shared.dev},ino=${shared.ino})`);
// contender: if we did NOT already hold it exclusively, this child would succeed.
const contend = spawnSync('flock', ['-n', '-x', SHARED_LOCK, '-c', 'true'], { stdio: 'ignore' });
if (contend.error) die(75, `contender probe could not run flock: ${contend.error.message}`);
if (contend.status === 0) die(75, 'CONTENDER ACQUIRED THE SHARED LOCK -> this process does NOT hold it exclusively. Ownership NOT proven.');

// 4. logpoint hygiene (0-based coords, executable statements, non-pausing, guarded).
const pins = JSON.parse(readFileSync(resolve(HERE, 'authority-pins-corrected.json'), 'utf8'));
if (pins.bundleSha256 !== gotBundle) die(73, 'authority-pins-corrected.json was resolved against a different bundle');
for (const lp of LOGPOINTS) {
  const p = pins.pins[lp.pinRef];
  if (!p) die(74, `pin ${lp.pinRef} not present in authority-pins-corrected.json`);
  if (!Number.isInteger(p.line0) || !Number.isInteger(p.column0)) die(74, `pin ${lp.pinRef} lacks 0-based coordinates`);
  if (!lp.condition.endsWith(',!1')) die(74, `logpoint ${lp.id} is not non-pausing`);
  if (!lp.condition.includes('try{')) die(74, `logpoint ${lp.id} is not try/catch guarded`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '').replace(/-/g, '');
const OUT = resolve(RUN_DIR, 'verifier', 'captures', 'manual-credit-finale', `authority-seam-attempt-${stamp}`);
if (existsSync(OUT)) die(76, 'capture dir collision');
mkdirSync(resolve(OUT, 'source-snapshot'), { recursive: true });
for (const f of readdirSync(HERE)) copyFileSync(resolve(HERE, f), resolve(OUT, 'source-snapshot', f));
writeFileSync(resolve(OUT, 'preflight.json'), JSON.stringify({
  at: new Date().toISOString(), activeRole: ctl.activeRole, action: ctl.action,
  sourceManifestSha256: ctl.sourceManifestSha256, bundleSha256: gotBundle,
  previewUrl, liveIndexSha256: liveIndexSha,
  sharedLock: { path: SHARED_LOCK, dev: String(shared.dev), ino: String(shared.ino), contenderRefused: true },
  pins: Object.keys(pins.pins), logpoints: LOGPOINTS.map((l) => l.id),
  scenario: process.env.SEAM_SCENARIO ?? 'normal-expiry',
}, null, 1));
console.log(`[finale-authority-seam] PREFLIGHT OK -> ${OUT}`);
console.log('[finale-authority-seam] NO CAPTURE PERFORMED: the CDP attach/capture body is NOT implemented in this file. The runtime owner must attach it before any measurement claim.');
process.exit(0);
