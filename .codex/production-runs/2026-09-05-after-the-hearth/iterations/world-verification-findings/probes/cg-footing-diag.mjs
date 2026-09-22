#!/usr/bin/env node
/**
 * BOUNDED FOOTING DIAGNOSTIC — run-local to 2026-09-05-after-the-hearth.
 *
 * Question, from root: why does the world's support query disagree with the
 * physically grounded body at the Origin audit site, where 200 shipped F
 * attempts at S were silently refused with `supported: false`?
 *
 * No voxel query is reachable from any read-only probe global, so this probe
 * discriminates between the remaining source candidates using ONLY the shipped
 * diagnostic and the shipped jump control:
 *
 *   `createFooting` (CommonGroundWorld.tsx) asks, for the grounded body pose,
 *   `cy = round((y - 1.05) / 2)`, then requires solid(cy), NOT solid(cy+1) and
 *   no water/hazard at cy or cy+1.
 *
 *   - If the body's standing cell is genuinely EMPTY in the terrain model, no
 *     height makes it supported.
 *   - If the cell ABOVE is logically solid (a generated/rendered or
 *     WorldSave/collider disagreement), then raising the feet by one cell makes
 *     the query land on that solid cell with air above it, and `supported`
 *     flips TRUE in mid-air. That is a decisive signature.
 *   - Water or hazard at the standing cell stays false at every height.
 *
 * It therefore samples `supported` as a FUNCTION OF THE BODY'S OWN HEIGHT while
 * the player jumps with the shipped Space control, and reports the observed
 * (feet height -> voxel cell -> supported) map with the cell arithmetic made
 * explicit. It grants nothing: a jump is an ordinary player action, no story
 * state is written, no predicate is touched and no ground is invented.
 *
 * Root control is polled every --control-ms (default 10 s) exactly as the
 * journey probe does, and a checkpoint finalises the media and summary.
 *
 *   node cg-footing-diag.mjs --beat ch13-survey --seconds 150 --out final/footing-diag
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { loadContract, ART, CAPTURES, RUN_DIR } from './lib/cgContract.mjs';
import { openParavoxia, waitReady, readState, frameStats } from '../../../../../main/tools/lib/evidence.mjs';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = (n) => process.argv.includes(`--${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (m) => console.log(`[cg-footing] ${m}`);

const VOXEL_SCALE = 2;          // src/utils/cubeGravityConstants.ts
const GROUND_CLEARANCE = 1.05;  // src/story/world/CommonGroundWorld.tsx
const cell = (v) => Math.round(v / VOXEL_SCALE);

// -------------------------------------------------------------- self-test ---
if (has('self-test')) {
  const fail = (m) => { console.error(`[cg-footing self-test] FAIL ${m}`); process.exit(1); };
  // The exact arithmetic the chapter uses, checked against the two heights this
  // run actually observed and against the authored pose.
  if (cell(50.988975 - GROUND_CLEARANCE) !== 25) fail('observed audit-site feet must map to cell 25');
  if (cell(51.05 - GROUND_CLEARANCE) !== 25) fail('the AUTHORED pose must map to the same cell 25');
  if (cell(51.186 - GROUND_CLEARANCE) !== 25) fail('the supported landing-site height also maps to cell 25');
  // one cell up: feet above 52.05 land the query on cell 26
  if (cell(52.10 - GROUND_CLEARANCE) !== 26) fail('a one-cell lift must query cell 26');
  if (cell(53.99 - GROUND_CLEARANCE) !== 26) fail('cell 26 must span to just under 54.05');
  // and the classifier
  const c = (rows) => classify(rows);
  if (c([{ cy: 25, supported: false }, { cy: 26, supported: true }]) !== 'supported-only-one-cell-above-the-standing-cell') fail('lift-true signature');
  if (c([{ cy: 25, supported: false }, { cy: 26, supported: false }]) !== 'unsupported-at-every-sampled-height') fail('all-false signature');
  if (c([{ cy: 25, supported: true }]) !== 'supported-at-the-standing-cell') fail('normal signature');
  if (c([]) !== 'insufficient-samples') fail('empty signature');
  console.log('[cg-footing self-test] OK — cell arithmetic and the three signatures');
  process.exit(0);
}

function classify(rows) {
  if (!rows.length) return 'insufficient-samples';
  const standing = Math.min(...rows.map((r) => r.cy));
  const atStanding = rows.filter((r) => r.cy === standing);
  const above = rows.filter((r) => r.cy > standing);
  if (atStanding.some((r) => r.supported === true)) return 'supported-at-the-standing-cell';
  if (above.length && above.some((r) => r.supported === true)) return 'supported-only-one-cell-above-the-standing-cell';
  return 'unsupported-at-every-sampled-height';
}

const beat = arg('beat', 'ch13-survey');
const seconds = Number(arg('seconds', '150'));
const outName = arg('out', 'final/footing-diag');
const controlMs = Number(arg('control-ms', '10000'));
const sampleMs = Number(arg('sample-ms', '50'));
const jumps = Number(arg('jumps', '10'));
const approachUnits = Number(arg('approach-units', '2.5'));

const ownership = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (ownership.state !== 'running') throw new Error(`owned preview is "${ownership.state}", not running — refusing to measure or to start one`);
const { sha256: contractSha } = loadContract();
const CONTROL_PATH = resolve(RUN_DIR, 'verifier-control.json');
const CHECKPOINT = new Set(['finish-current-and-checkpoint', 'pause', 'stop', 'halt']);

const outDir = resolve(CAPTURES, outName);
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
writeFileSync(tracePath, '');

const S = [-26, 51.05, 12];
const url = `?story=${beat}&journeyprobe=1&debug=1&movie=1`;
tag(`beat=${beat} url=${ownership.url}${url}`);

let control = null;
const pollControl = () => {
  try {
    const live = JSON.parse(readFileSync(CONTROL_PATH, 'utf8'));
    if (CHECKPOINT.has(String(live.action))) control = live;
    return live;
  } catch { return null; }
};
if (pollControl()) { /* recorded below */ }
if (control) {
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify({ probe: 'cg-footing-diag.mjs', ranBrowser: false, checkpointed: true, control }, null, 2)}\n`);
  tag('root control is a checkpoint before the browser opened — not measuring');
  process.exit(0);
}

const session = await openParavoxia({
  url, preview: { url: ownership.url, stop() {} }, build: false,
  viewport: { width: 1280, height: 720 }, log: tag
});
const { page } = session;
await waitReady(page, { timeoutMs: 180_000 });

const readCg = async () => page.evaluate(() => {
  try {
    const fn = window.__paravoxiaCommonGround?.snapshot;
    return typeof fn === 'function' ? { available: true, value: fn() } : { available: false, value: null };
  } catch (e) { return { available: false, value: null, error: String(e).slice(0, 160) }; }
});

const rows = [];
const started = Date.now();
let lastControl = 0;
let phase = 'approaching';
let arrivedAtMs = null;
let jumpsDone = 0;

const record = (kind, extra) => appendFileSync(tracePath, `${JSON.stringify({ kind, atMs: Date.now(), elapsedMs: Date.now() - started, ...extra })}\n`);

while (Date.now() - started < seconds * 1000) {
  const now = Date.now();
  if (now - lastControl >= controlMs) {
    lastControl = now;
    const live = pollControl();
    record('control', { control: live });
    if (control) { tag(`root checkpoint: ${control.action}`); break; }
  }
  const cg = await readCg();
  const state = await readState(page).catch(() => null);
  const v = cg?.available ? cg.value : null;
  const pose = Array.isArray(v?.bodyPose) ? v.bodyPose : null;
  const centre = Array.isArray(v?.bodyCentre) ? v.bodyCentre : null;
  const supported = v?.supported ?? null;
  const cy = pose ? cell(pose[1] - GROUND_CLEARANCE) : null;
  const horiz = pose ? Math.hypot(pose[0] - S[0], pose[2] - S[2]) : null;

  record('sample', {
    phase, pose, centre, up: v?.up ?? null, supported, cy,
    cx: pose ? cell(pose[0]) : null, cz: pose ? cell(pose[2]) : null,
    horizToS: horiz, worldBound: v?.worldBound ?? null,
    rail: v?.rail ?? null, surveyPhase: v?.diagnostic?.survey?.phase ?? null,
    beat: state?.beat ?? null, objectiveId: state?.objectiveId ?? null
  });
  if (pose && supported !== null && v?.worldBound) {
    rows.push({ atMs: now, pose, cy, supported, horizToS: horiz, phase });
  }

  if (phase === 'approaching' && horiz != null && horiz <= approachUnits) {
    phase = 'at-S';
    arrivedAtMs = now;
    tag(`arrived within ${horiz.toFixed(3)} of S at ${((now - started) / 1000).toFixed(1)} s — beginning the shipped-jump height sweep`);
  }
  if (phase === 'at-S' && jumpsDone < jumps) {
    // THE SHIPPED JUMP CONTROL, pressed as a player does. It writes no story
    // state, grants no progress and is not counted as an interaction.
    await page.keyboard.down('Space');
    await sleep(90);
    await page.keyboard.up('Space');
    jumpsDone += 1;
    // sample densely through the arc
    for (let i = 0; i < 24; i += 1) {
      const c2 = await readCg();
      const w = c2?.available ? c2.value : null;
      const p2 = Array.isArray(w?.bodyPose) ? w.bodyPose : null;
      const s2 = w?.supported ?? null;
      const y2 = p2 ? cell(p2[1] - GROUND_CLEARANCE) : null;
      record('jump-sample', { jump: jumpsDone, i, pose: p2, supported: s2, cy: y2, worldBound: w?.worldBound ?? null });
      if (p2 && s2 !== null && w?.worldBound) rows.push({ atMs: Date.now(), pose: p2, cy: y2, supported: s2, phase: 'jump' });
      await sleep(40);
    }
  }
  if (phase === 'at-S' && jumpsDone >= jumps) { phase = 'done'; break; }
  await sleep(sampleMs);
}

// ------------------------------------------------------------------ report --
const shot = join(outDir, '0000-footing-diag.png');
await page.screenshot({ path: shot }).catch(() => {});
const bytes = (() => { try { return readFileSync(shot); } catch { return null; } })();

const byCell = new Map();
for (const r of rows) {
  const k = String(r.cy);
  const e = byCell.get(k) ?? { cy: r.cy, samples: 0, supportedTrue: 0, minFeetY: Infinity, maxFeetY: -Infinity };
  e.samples += 1;
  if (r.supported === true) e.supportedTrue += 1;
  e.minFeetY = Math.min(e.minFeetY, r.pose[1]);
  e.maxFeetY = Math.max(e.maxFeetY, r.pose[1]);
  byCell.set(k, e);
}
const atS = rows.filter((r) => r.phase !== 'approaching');
const verdict = classify(atS.map((r) => ({ cy: r.cy, supported: r.supported })));

const summary = {
  schema: 'paravoxia.verifier.footingDiagnostic.v1',
  probe: 'cg-footing-diag.mjs',
  probeSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  kind: 'BOUNDED DIAGNOSTIC — not a journey, not acceptance, not a visual or audio claim',
  runId: '2026-09-05-after-the-hearth',
  contractSha256: contractSha,
  preview: { url: ownership.url, indexSha256: ownership.indexSha256, buildHash: ownership.buildHash ?? null, sourceManifestSha256: ownership.sourceManifestSha256 ?? null },
  renderer: session.renderer, rendererClass: /swiftshader|llvmpipe|software/i.test(String(session.renderer)) ? 'software' : 'hardware',
  headed: session.headed,
  request: { beat, seconds, jumps, approachUnits, url: `${ownership.url}${url}` },
  startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  checkpointed: Boolean(control), control,
  arrivedAtS: arrivedAtMs != null, arrivedAfterMs: arrivedAtMs ? arrivedAtMs - started : null,
  jumpsPerformed: jumpsDone,
  cellArithmetic: {
    VOXEL_SCALE, GROUND_CLEARANCE,
    rule: 'cy = Math.round((feetY - 1.05) / 2); supported requires solid(cy), NOT solid(cy+1), and no water/hazard at cy or cy+1',
    source: 'main/src/story/world/CommonGroundWorld.tsx createFooting/supportedColumn'
  },
  samplesUsed: rows.length,
  perCell: [...byCell.values()].sort((a, b) => a.cy - b.cy),
  verdict,
  verdictMeaning: {
    'supported-at-the-standing-cell': 'the footing query agrees with the body; the earlier refusal was not reproduced here',
    'supported-only-one-cell-above-the-standing-cell': 'the terrain model holds a SOLID cell one cell ABOVE the surface the body physically stands on: a generated/rendered (or WorldSave/collider) disagreement, not a tolerance',
    'unsupported-at-every-sampled-height': 'no sampled height satisfies the query: the standing column is empty, water or hazardous in the terrain model',
    'insufficient-samples': 'the body never reached S with a world-bound diagnostic; nothing is concluded'
  },
  limits: [
    'No voxel-level query is reachable from a read-only probe global, so the FAILING CLAUSE (missing solid, solid above, water, hazard) is inferred from the height response only, never read directly.',
    'A jump is an ordinary shipped player action. It grants no progress, writes no story state and is not counted as an interaction or as journey evidence.',
    'This proves nothing about rendering, hearing, performance or chapter acceptance.'
  ],
  frame: bytes ? { path: shot, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), stats: (() => { try { return frameStats(bytes); } catch { return null; } })() } : null,
  pageErrors: session.pageErrors
};
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
tag(`verdict=${verdict} samples=${rows.length} jumps=${jumpsDone} -> ${join(outDir, 'summary.json')}`);
await session.stop();
