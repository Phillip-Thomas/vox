#!/usr/bin/env node
/** finale-authority-seam launcher. REFUSES unless root transfers ownership.
 *  Requires: SEAM_ACTIVE_ROLE=finale-authority-seam-runtime, SEAM_ACTION=continue,
 *  and an INHERITED already-exclusive flock on fd 9. No new preview is started. */
import { fstatSync, existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';
const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_DIR = resolve(HERE, '..', '..', '..', '..');
const die = (c, m) => { console.error(`[finale-authority-seam] REFUSE: ${m}`); process.exit(c); };
if (process.env.SEAM_ACTIVE_ROLE !== 'finale-authority-seam-runtime') die(70, `activeRole not transferred (got ${process.env.SEAM_ACTIVE_ROLE ?? 'unset'})`);
if (process.env.SEAM_ACTION !== 'continue') die(71, `action!=continue (got ${process.env.SEAM_ACTION ?? 'unset'})`);
try { if (!fstatSync(9).isFile()) die(75, 'fd 9 is not a regular file'); } catch { die(75, 'fd 9 not inherited; root must exec 9>heavy.lock and flock THAT descriptor'); }
const bundle = resolve(RUN_DIR, '..', '..', '..', 'main', 'dist', 'assets', 'index-C1X65dZp.js');
const { BUNDLE_SHA256, LOGPOINTS, SINK_SOURCE } = await import('./seamLogpoints.mjs');
if (!existsSync(bundle)) die(72, `served bundle missing: ${bundle}`);
const got = createHash('sha256').update(readFileSync(bundle)).digest('hex');
if (got !== BUNDLE_SHA256) die(73, `bundle sha mismatch: ${got}`);
const pins = JSON.parse(readFileSync(resolve(HERE, 'candidate-pins.json'), 'utf8'));
for (const lp of LOGPOINTS) { const p = pins.pins[lp.pinRef];
  if (!p || p.status !== 'resolved-unique') die(74, `pin ${lp.pinRef} unresolved/ambiguous`);
  if (!lp.condition.endsWith(',!1')) die(74, `logpoint ${lp.id} is not non-pausing`); }
const stamp = new Date().toISOString().replace(/[:.]/g, '').replace(/-/g, '');
const OUT = resolve(RUN_DIR, 'verifier', 'captures', 'manual-credit-finale', `authority-seam-attempt-${stamp}`);
if (existsSync(OUT)) die(76, 'capture dir collision');
mkdirSync(resolve(OUT, 'source-snapshot'), { recursive: true });
for (const f of readdirSync(HERE)) copyFileSync(resolve(HERE, f), resolve(OUT, 'source-snapshot', f));
writeFileSync(resolve(OUT, 'preflight.json'), JSON.stringify({ bundleSha256: got, pins: Object.keys(pins.pins), logpoints: LOGPOINTS.map(l => l.id), sinkBytes: SINK_SOURCE.length, scenario: process.env.SEAM_SCENARIO ?? 'normal-expiry' }, null, 1));
console.log(`[finale-authority-seam] PREFLIGHT OK -> ${OUT}`);
console.log('[finale-authority-seam] capture body intentionally NOT implemented by the prep role; runtime role attaches CDP to the adopted browser PID.');
process.exit(0);
