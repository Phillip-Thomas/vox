/**
 * manual-witness-clearance-probe.mjs — bounded manual-focused route probe (commission step 3).
 *
 * Runs ONLY after manual-input-gate-probe proved, on hardware, that a real key
 * down reaches the shipped gate and moves a grounded body (capture
 * verifier/captures/manual-focused/input-gate-1). Same lane: no movie=1, no
 * autopilot, no teleport, no route grant, no pose/milestone writes. Every step
 * is an ordinary held key, and every arrival is asserted by measured distance
 * before the next act is attempted.
 *
 * Gates reused from the input-gate probe (same source reasoning):
 *   pointer lock via a REAL canvas click (CameraControls.tsx:100-114) is what
 *   enables `active` in EfficientPlayer.tsx:1565. Without it keys are ignored.
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { ART, CAPTURES, REPO_ROOT } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard, failureRecord } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from '../lib/sourceSnapshot.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
// The pure guards are RE-DECLARED here on purpose: manual-input-gate-probe.mjs
// is an executable capture script, so importing it would launch a second
// browser. These are byte-identical copies of its already self-tested helpers.
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function splitByUp(from, to, up) {
  const m0 = Math.hypot(up[0], up[1], up[2]);
  const u = m0 < 1e-9 ? [0, 1, 0] : [up[0] / m0, up[1] / m0, up[2] / m0];
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const v = dot3(d, u);
  const h = [d[0] - v * u[0], d[1] - v * u[1], d[2] - v * u[2]];
  const hMag = Math.hypot(h[0], h[1], h[2]);
  return { vertical: v, horizontal: hMag, hUnit: hMag < 1e-9 ? null : [h[0] / hMag, h[1] / hMag, h[2] / hMag] };
}
export function bodyUsable(p) {
  if (!Array.isArray(p) || p.length !== 3) return { ok: false, why: 'not-a-3-vector' };
  if (!p.every((n) => Number.isFinite(n))) return { ok: false, why: 'non-finite' };
  if (Math.hypot(p[0], p[1], p[2]) < 1e-6) return { ok: false, why: 'uninitialised-origin-000' };
  return { ok: true, why: null };
}
export function settled(samples, { n = 8, eps = 0.02 } = {}) {
  if (samples.length < n) return { ok: false, why: `only ${samples.length} samples`, spread: null };
  const tail = samples.slice(-n);
  let spread = 0;
  for (let i = 0; i < tail.length; i++) for (let j = i + 1; j < tail.length; j++) spread = Math.max(spread, dist3(tail[i], tail[j]));
  return { ok: spread <= eps, why: spread <= eps ? null : `spread ${spread.toFixed(4)} > ${eps}`, spread };
}
export function directionsDistinct(aUnit, bUnit, minDeg = 25) {
  if (!aUnit || !bUnit) return { ok: false, deg: null, why: 'a held key produced no horizontal direction' };
  const c = Math.max(-1, Math.min(1, dot3(aUnit, bUnit)));
  const deg = (Math.acos(c) * 180) / Math.PI;
  return { ok: deg >= minDeg, deg, why: deg >= minDeg ? null : `only ${deg.toFixed(1)}deg apart` };
}

const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const unit2 = (v) => { const m = Math.hypot(v[0], v[1]); return m < 1e-9 ? null : [v[0] / m, v[1] / m]; };
/** Choose the calibrated key whose MEASURED world direction best matches want. */
export function chooseKey(dirs, want) {
  let best = null; let bestDot = -Infinity;
  for (const [k, d] of Object.entries(dirs)) { if (!d) continue; const s = d[0] * want[0] + d[1] * want[1]; if (s > bestDot) { bestDot = s; best = k; } }
  return { key: best, score: bestDot };
}

if (process.argv.includes('--self-test')) {
  const fail = (m) => { console.error(`[manual-survey-corner self-test] FAIL ${m}`); process.exit(1); };
  const dirs = { KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
  if (chooseKey(dirs, [-1, 0]).key !== 'KeyW') fail('west must pick the measured westward key');
  if (chooseKey(dirs, [0, 1]).key !== 'KeyD') fail('exact key direction must win');
  if (chooseKey({ KeyW: null }, [1, 0]).key !== null) fail('an uncalibrated key must not be chosen');
  if (unit2([0, 0]) !== null) fail('a zero vector has no direction');
  if (Math.abs(distXZ([0, 9, 0], [3, -9, 4]) - 5) > 1e-9) fail('distXZ must ignore the up axis');
  if (bodyUsable([0, 0, 0]).ok) fail('shared guard must still reject the uninitialised origin');
  console.log('[manual-survey-corner self-test] OK'); process.exit(0);
}

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const outName = arg('out', 'witness-1');
const legBudgetMs = Number(arg('leg-ms', '90000'));
const outDir = resolve(CAPTURES, 'manual-focused', outName);
assertFreshOutputDir(outDir, { what: 'manual-focused witness clearance' });
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
const t0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`[msc] ${new Date().toISOString()} +${Date.now() - t0}ms ${m}`);
const emit = (rec) => appendFileSync(tracePath, `${JSON.stringify({ atMs: Date.now() - t0, at: new Date().toISOString(), ...rec })}\n`);
const sha = (b) => createHash('sha256').update(b).digest('hex');

const own = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (own.state !== 'running') throw new Error(`root preview not running (state=${own.state})`);
const previewRef = { url: own.url, stop() { /* ROOT owns this preview */ } };
const sourceManifest = writeSourceSnapshot({ entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
  note: 'Exact bytes of the manual-focused route probe and its libraries.' });

const cgSnap = (page) => page.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return { beat: s.beat, bodyCentre: s.bodyCentre, up: s.up, supported: s.supported, worldBound: s.worldBound,
    rail: s.rail, railCursor: s.railCursor, holdReason: s.diagnostic?.holdReason ?? null,
    survey: s.diagnostic?.survey ?? null, common: s.diagnostic?.common ?? null, anchors: s.diagnostic?.anchors ?? null };
});
const controlProbe = (page) => page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return { pointerLockIsCanvas: !!canvas && document.pointerLockElement === canvas, hasFocus: document.hasFocus(),
    policy: window.__storyInputPolicy ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode } : null,
    autopilotPresent: !!window.__autopilot,
    canvasRect: canvas ? (({ x, y, width, height }) => ({ x, y, width, height }))(canvas.getBoundingClientRect()) : null,
    hotkeyActivations: (() => { try { return window.__paravoxiaJourneyProbe?.snapshot?.()?.input?.hotkeyActivations ?? null; } catch { return null; } })() };
});

const visited = [];
const guard = createOwnedSessionGuard({ log: say, label: 'manual-focused route session' });
const report = { schema: 'paravoxia.verifier.manualSurveyCorner.v1', probe: 'manual-witness-clearance-probe.mjs', role: 'manual-focused',
  startedAt: new Date(t0).toISOString(), lane: 'MANUAL — no movie=1, no autopilot, ordinary held keys only',
  sourceSnapshot: snapshotRef(sourceManifest), previewUrl: own.url, gates: [], legs: [], steps: [], verdict: 'INCOMPLETE', stoppedAt: null };
const gate = (name, ok, detail) => { const g = { name, ok, detail, at: new Date().toISOString() }; report.gates.push(g); emit({ gate: g });
  say(`GATE ${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail).slice(0, 300)}`); return ok; };

let page = null;
const stop = async (name, detail) => {
  report.verdict = 'STOPPED-PREREQUISITE'; report.stoppedAt = name;
  if (page) { const png = await page.screenshot().catch(() => null); if (png) writeFileSync(join(outDir, `stop-${name}.png`), png);
    report.stopState = { cg: await cgSnap(page).catch(() => null), state: await readState(page).catch(() => null), control: await controlProbe(page).catch(() => null) }; }
  throw Object.assign(new Error(`stopped at ${name}: ${JSON.stringify(detail).slice(0, 300)}`), { gateStop: true });
};

try {
  const session = guard.adopt(await openParavoxia({ url: '?story=ch13-survey&journeyprobe=1&debug=1', preview: previewRef,
    build: false, viewport: { width: 1280, height: 720 }, log: say }));
  page = session.page; report.renderer = session.renderer; report.headed = session.headed; report.entryUrl = session.url;
  report.prerequisiteFixture = 'Deep entry ?story=ch13-survey seeds this beat only — a labelled fixture, NOT full-story continuity.';
  await waitReady(page, { timeoutMs: 120000 });
  await page.bringToFront();
  gate('hardware', /ANGLE/.test(session.renderer) && session.headed, { renderer: session.renderer, headed: session.headed });

  // ---- prerequisites, identical to the proven input-gate probe -------------
  let cg = null; const t1 = Date.now();
  while (Date.now() - t1 < 90000) { cg = await cgSnap(page); if (cg?.worldBound && bodyUsable(cg.bodyCentre).ok) break; await sleep(400); }
  if (!gate('world-bound-and-body', !!cg?.worldBound && bodyUsable(cg?.bodyCentre ?? null).ok, { worldBound: cg?.worldBound, body: cg?.bodyCentre })) await stop('world-bound-and-body', cg);
  const samples = []; const t2 = Date.now(); let sr = { ok: false };
  while (Date.now() - t2 < 60000) { const s = await cgSnap(page); if (s && bodyUsable(s.bodyCentre).ok) samples.push(s.bodyCentre);
    sr = settled(samples); if (sr.ok && s?.supported === true) break; await sleep(250); }
  cg = await cgSnap(page);
  if (!gate('settled-grounded-body', sr.ok && cg?.supported === true, { spread: sr.spread, supported: cg?.supported, body: cg?.bodyCentre })) await stop('settled-grounded-body', sr);
  let ctl = await controlProbe(page);
  if (!gate('policy-permits-movement', !!ctl.policy && ctl.policy.moveSpeedScale > 0 && ctl.policy.lookMode !== 'side', ctl.policy)) await stop('policy-permits-movement', ctl.policy);
  const r = ctl.canvasRect;
  await page.mouse.click(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
  const t4 = Date.now(); while (Date.now() - t4 < 5000) { ctl = await controlProbe(page); if (ctl.pointerLockIsCanvas) break; await sleep(200); }
  if (!gate('pointer-lock-active', ctl.pointerLockIsCanvas, ctl)) await stop('pointer-lock-active', ctl);
  gate('manual-lane', ctl.autopilotPresent === false, { autopilotPresent: ctl.autopilotPresent });

  // ---- calibrate: measure what each ordinary key actually does -------------
  const hold = async (code, ms) => {
    const b = await cgSnap(page); await page.keyboard.down(code);
    const th = Date.now(); while (Date.now() - th < ms) await sleep(60);
    await page.keyboard.up(code); await sleep(160);
    const a = await cgSnap(page);
    const sp = splitByUp(b.bodyCentre, a.bodyCentre, b.up ?? [0, 1, 0]);
    return { code, ms, from: b.bodyCentre, to: a.bodyCentre, horizontal: sp.horizontal, vertical: sp.vertical,
      dir2: unit2([a.bodyCentre[0] - b.bodyCentre[0], a.bodyCentre[2] - b.bodyCentre[2]]), supported: a.supported };
  };
  const dirs = {}; const calib = [];
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const h = await hold(code, 700); calib.push(h); emit({ phase: 'calibrate', ...h });
    dirs[code] = h.horizontal >= 0.5 ? h.dir2 : null;
    say(`calib ${code}: horiz=${h.horizontal.toFixed(2)} dir=${JSON.stringify(h.dir2)}`);
  }
  report.calibration = calib;
  const live = Object.values(dirs).filter(Boolean);
  const spread = live.length >= 2 ? directionsDistinct(
    [live[0][0], 0, live[0][1]], [live[live.length - 1][0], 0, live[live.length - 1][1]], 25) : { ok: false, why: 'fewer than two live directions' };
  if (!gate('four-key-calibration-is-directional', live.length === 4 && spread.ok, { live: live.length, spreadDeg: spread.deg, dirs }))
    await stop('four-key-calibration-is-directional', { dirs, calib });

  // ---- ordinary walk to a target, asserted by measured distance -----------
  const walkTo = async (label, target, { arrive = 1.2, budgetMs = legBudgetMs } = {}) => {
    const t = Date.now(); const start = (await cgSnap(page)).bodyCentre; let last = start; let stallMs = 0; let travelled = 0;
    while (Date.now() - t < budgetMs) {
      const s = await cgSnap(page); const p = s.bodyCentre;
      const d = distXZ(p, target);
      if (d <= arrive) { const leg = { label, target, arrive, reached: true, finalDistance: d, elapsedMs: Date.now() - t, travelled, from: start, to: p };
        report.legs.push(leg); emit({ phase: 'leg', ...leg }); say(`LEG ${label} REACHED d=${d.toFixed(2)} in ${leg.elapsedMs}ms`); return leg; }
      const want = unit2([target[0] - p[0], target[2] - p[2]]);
      const pick = chooseKey(dirs, want);
      await page.keyboard.down(pick.key); await sleep(Math.min(500, Math.max(120, d * 60))); await page.keyboard.up(pick.key); await sleep(120);
      const q = (await cgSnap(page)).bodyCentre;
      visited.push([...q]);
      const step = distXZ(last, q); travelled += step;
      stallMs = step < 0.05 ? stallMs + 700 : 0; last = q;
      emit({ phase: 'step', label, key: pick.key, pos: q, distance: distXZ(q, target), step });
      if (stallMs >= 7000) break;
    }
    const p = (await cgSnap(page)).bodyCentre; const d = distXZ(p, target);
    const leg = { label, target, arrive, reached: false, finalDistance: d, elapsedMs: Date.now() - t, travelled, from: start, to: p, stalled: stallMs >= 7000 };
    report.legs.push(leg); emit({ phase: 'leg', ...leg });
    say(`LEG ${label} NOT REACHED d=${d.toFixed(2)} travelled=${travelled.toFixed(2)} stalled=${leg.stalled}`);
    return leg;
  };

  const snapState = async (label) => {
    const st = await readState(page); const s = await cgSnap(page);
    const rec = { label, beat: st?.beat, objectiveId: st?.objectiveId, markerLabel: st?.markerLabel, hudText: st?.hudText,
      prompts: st?.interactionPrompts, anchors: s?.anchors ?? [], survey: s?.survey ?? null, rail: s?.rail ?? null,
      holdReason: s?.holdReason ?? null, body: s?.bodyCentre, supported: s?.supported };
    report.steps.push(rec); emit({ phase: 'state', ...rec });
    say(`[${label}] obj=${rec.objectiveId} marker=${rec.markerLabel} prompts=${JSON.stringify(rec.prompts)} survey=${rec.survey?.phase}/${rec.survey?.samples} rail=${JSON.stringify(rec.rail?.target)}`);
    const png = await page.screenshot(); writeFileSync(join(outDir, `${label}.png`), png);
    return rec;
  };

  await snapState('after-calibration');
  // W-7744's stand: the beat's own first rail target if it offers one, else the
  // coordinate already observed in the movie lane (verifier navigation record).
  const railNow = (await cgSnap(page)).rail;
  const W = Array.isArray(railNow?.target) ? [...railNow.target] : [-34, 51.05, 10];
  report.targetW = { value: W, source: Array.isArray(railNow?.target) ? 'live shipped rail target (the game\'s own marker)' : 'previously observed movie-lane W stand' };
  const legW = await walkTo('to-W', W, { arrive: 1.5 });
  const atW = await snapState('at-W');
  if (!gate('arrived-at-W', legW.reached === true, { finalDistance: legW.finalDistance, travelled: legW.travelled, stalled: legW.stalled }))
    await stop('arrived-at-W', legW);
  if (!gate('W-offers-an-interaction', (atW.prompts ?? []).some((p) => /\bF\b/.test(p ?? '')),
    { prompts: atW.prompts, objectiveId: atW.objectiveId, markerLabel: atW.markerLabel })) await stop('W-offers-an-interaction', atW);

  // ---- ordinary F at the offered prompt -----------------------------------
  const pressF = async (why) => {
    await page.keyboard.down('KeyF'); await sleep(80); await page.keyboard.up('KeyF'); await sleep(1400);
    emit({ phase: 'input', key: 'KeyF', why }); say(`pressed [F] (${why})`);
  };
  await pressF('the shipped prompt at W offers to demonstrate a route');
  const afterF = await snapState('after-F');
  if (!gate('F-advanced-the-objective', afterF.objectiveId !== atW.objectiveId || (afterF.anchors ?? []).length > (atW.anchors ?? []).length,
    { before: atW.objectiveId, after: afterF.objectiveId, anchorsBefore: atW.anchors, anchorsAfter: afterF.anchors }))
    await stop('F-advanced-the-objective', { before: atW, after: afterF });

  // ---- walk to the survey start S, begin recording, draw with an EARLY
  // CORNER deviation, and return to the frontier by ordinary movement --------
  // S/E and the authored long route are read from frozen source
  // (main/src/story/commonGroundState.ts CG_POSES / CG_ROUTE_LONG). Knowing
  // where to walk is not a grant: every unit below is a held key and every
  // arrival is asserted by measured distance. No teleport, no rail, no F beyond
  // the two the shipped prompt itself offers.
  const surveyOf = (s) => ({ phase: s?.survey?.phase ?? null, samples: s?.survey?.samples ?? 0,
    lengthUnits: s?.survey?.lengthUnits ?? 0, walkedUnits: s?.survey?.walkedUnits ?? 0,
    testedPrefix: s?.survey?.testedPrefix ?? 0, holdReason: s?.holdReason ?? null });
  const S = [-26, 51.05, 12];
  const ROUTE = [[-26,51.05,14],[-28,51.05,14],[-28,51.05,16],[-30,51.05,16],[-30,51.05,18],
    [-32,51.05,18],[-32,51.05,20],[-32,51.05,22],[-34,51.05,22],[-36,51.05,22],[-38,51.05,22],
    [-40,51.05,22],[-42,51.05,22],[-42,51.05,20],[-42,51.05,18],[-42,51.05,16],[-42,51.05,14],[-42,51.05,12]];
  const legS = await walkTo('to-S', S, { arrive: 1.0, budgetMs: 90000 });
  const atS = await snapState('at-S');
  if (!gate('arrived-at-survey-start', legS.reached === true, { finalDistance: legS.finalDistance, travelled: legS.travelled, stalled: legS.stalled }))
    await stop('arrived-at-survey-start', legS);
  if (!gate('S-offers-begin-recording', (atS.prompts ?? []).some((p) => /\bF\b/.test(p ?? '')), { prompts: atS.prompts, objectiveId: atS.objectiveId }))
    await stop('S-offers-begin-recording', atS);
  await pressF('the shipped prompt at the survey start offers to begin recording');
  const started = await snapState('after-F-at-S');
  const svStart = surveyOf(await cgSnap(page));
  if (!gate('survey-actually-started', (started.anchors ?? []).includes('anc.cg.survey-started'), { anchors: started.anchors, survey: svStart }))
    await stop('survey-actually-started', { started, svStart });

  // draw: walk the authored long route; deviate EARLY (third waypoint), then
  // return to the frontier and traverse the omitted ground ordinarily.
  report.deviation = null;
  const drawLegs = [];
  for (let i = 0; i < ROUTE.length; i++) {
    if (i === 2 && !report.deviation) {
      const svBefore = surveyOf(await cgSnap(page));
      const from = (await cgSnap(page)).bodyCentre;
      const want = unit2([ROUTE[i][0] - from[0], ROUTE[i][2] - from[2]]) ?? [1, 0];
      const perp = [-want[1], want[0]];
      const off = chooseKey(dirs, perp).key;
      await page.keyboard.down(off); await sleep(900); await page.keyboard.up(off); await sleep(500);
      const away = (await cgSnap(page)).bodyCentre;
      const svAway = surveyOf(await cgSnap(page));
      await snapState('deviated-off-route');
      const back = await walkTo('return-to-frontier', from, { arrive: 0.8, budgetMs: 45000 });
      const svBack = surveyOf(await cgSnap(page));
      report.deviation = { at: new Date().toISOString(), waypointIndex: i, from, away, offKey: off,
        offsetUnits: distXZ(from, away), returned: back.reached, returnDistance: back.finalDistance,
        surveyBefore: svBefore, surveyAtDeviation: svAway, surveyAfterReturn: svBack };
      emit({ phase: 'deviation', ...report.deviation });
      say(`DEVIATION off=${report.deviation.offsetUnits.toFixed(2)} returned=${back.reached} samples ${svBefore.samples}->${svAway.samples}->${svBack.samples}`);
      gate('deviation-was-a-real-step-off-route', report.deviation.offsetUnits >= 1.0, { offsetUnits: report.deviation.offsetUnits });
      gate('returned-to-frontier-by-ordinary-movement', back.reached === true, { finalDistance: back.finalDistance });
      gate('earned-prefix-retained-across-deviation', svBack.samples >= svBefore.samples && svBack.lengthUnits >= svBefore.lengthUnits - 1e-6,
        { before: svBefore, after: svBack });
      await snapState('after-return-to-frontier');
    }
    const leg = await walkTo(`draw-${i}`, ROUTE[i], { arrive: 0.8, budgetMs: 45000 });
    const sv = surveyOf(await cgSnap(page));
    drawLegs.push({ i, target: ROUTE[i], reached: leg.reached, finalDistance: leg.finalDistance, survey: sv });
    emit({ phase: 'draw-leg', i, target: ROUTE[i], reached: leg.reached, survey: sv });
    if (!leg.reached) { report.drawStop = { why: 'leg-not-reached', i, leg, survey: sv }; say(`draw leg ${i} not reached; stopping honestly`); break; }
  }
  report.drawLegs = drawLegs;
  const svAfterDraw = surveyOf(await cgSnap(page));
  const atE = await snapState('at-E-after-draw');
  gate('progress-resumed-after-the-deviation', !!report.deviation && svAfterDraw.samples > (report.deviation.surveyAfterReturn.samples ?? 0),
    { afterReturn: report.deviation?.surveyAfterReturn ?? null, afterDraw: svAfterDraw });
  gate('a-real-drawing-was-recorded', svAfterDraw.samples > 0 && svAfterDraw.lengthUnits > 0, svAfterDraw);
  if ((atE.prompts ?? []).some((p) => /\bF\b/.test(p ?? ''))) {
    await pressF('the shipped prompt at the survey end offers the recorded span');
    await snapState('after-F-at-E');
  } else { say('no F prompt at the survey end; not pressing F'); }
  const fin = await snapState('final');
  report.surveyFinal = surveyOf(await cgSnap(page));
  // ---- W-7744 actually tests the offered span; Terra stands clear ---------
  // The stand-clear point is chosen from GROUND THIS BODY ACTUALLY WALKED
  // (positions sampled on the way to W), at least 1 unit clear of every point
  // of the span W is about to test. It is not an arithmetic E.z-3/E.z-4 label
  // and no pose is written.
  const spanPoints = [S, ...ROUTE];
  const clearOf = (p) => Math.min(...spanPoints.map((r) => distXZ(p, r)));
  const cands = visited.filter((p) => clearOf(p) >= 1.0);
  const here = (await cgSnap(page)).bodyCentre;
  cands.sort((a, b) => distXZ(a, here) - distXZ(b, here));
  const standClear = cands[0] ?? null;
  report.standClear = { chosen: standClear, clearanceUnits: standClear ? clearOf(standClear) : null,
    candidateCount: cands.length, source: 'a position this body actually occupied while walking to W (trace-observed reachable ground)' };
  if (!gate('an-observed-reachable-clear-stand-exists', !!standClear, report.standClear)) await stop('an-observed-reachable-clear-stand-exists', report.standClear);
  const legClear = await walkTo('to-stand-clear', standClear, { arrive: 1.0, budgetMs: 60000 });
  const atClear = await snapState('standing-clear');
  gate('reached-the-clear-stand', legClear.reached === true, { finalDistance: legClear.finalDistance, clearance: report.standClear.clearanceUnits });

  const watchMs = Number(arg('watch-ms', '90000'));
  const tw = Date.now(); const watch = []; let tested = false; let workerMoved = 0; let lastW = null;
  while (Date.now() - tw < watchMs) {
    const s2 = await cgSnap(page);
    const w = s2?.survey ?? null;
    const wp = (await page.evaluate(() => { try { const d = window.__paravoxiaCommonGround?.snapshot?.()?.diagnostic?.worker; return d ? { leg: d.leg, travelled: d.travelled, held: d.held, position: d.position } : null; } catch { return null; } }));
    if (wp?.position && lastW) workerMoved += Math.hypot(wp.position.x - lastW.x, wp.position.y - lastW.y, wp.position.z - lastW.z);
    if (wp?.position) lastW = wp.position;
    const rec = { ms: Date.now() - tw, holdReason: s2?.holdReason ?? null, survey: w, worker: wp, anchors: s2?.anchors ?? [], body: s2?.bodyCentre,
      prompts: (await readState(page))?.interactionPrompts ?? [] };
    watch.push(rec); emit({ phase: 'witness-watch', ...rec });
    if ((s2?.anchors ?? []).includes('anc.cg.route-tested')) { tested = true; say(`route-tested reached at +${rec.ms}ms`); break; }
    // An authored short-reference hold is answered with the authored witness verb, not by calling it clearance.
    if (rec.prompts.some((p) => /\bF\b/.test(p ?? '')) && (w?.witnessOffered === true)) { await pressF('the shipped witness prompt was offered during W\'s test'); }
    await sleep(2000);
  }
  report.witnessWatch = { elapsedMs: Date.now() - tw, samples: watch.length, routeTested: tested, workerTravelledUnits: workerMoved,
    lastHoldReason: watch.length ? watch[watch.length - 1].holdReason : null, last: watch.length ? watch[watch.length - 1] : null, series: watch };
  gate('W-actually-tested-the-route', tested, { routeTested: tested, lastHoldReason: report.witnessWatch.lastHoldReason,
    workerTravelledUnits: workerMoved, lastSurvey: report.witnessWatch.last?.survey ?? null });
  await snapState('witness-watch-end');

  report.verdict = report.deviation && report.deviation.returned && report.surveyFinal.samples > 0
    && drawLegs.every((l) => l.reached) ? 'CORNER-RECOVERY-OBSERVED'
    : report.deviation ? 'PARTIAL-DRAW' : 'SURVEY-STARTED-NO-CORNER-PROOF';
  report.finalCg = await cgSnap(page); report.finalState = await readState(page);
} catch (err) {
  if (!err.gateStop) { report.verdict = 'ERROR'; report.error = String(err).slice(0, 400); }
  report.failure = failureRecord({ probe: 'manual-witness-clearance-probe.mjs', error: err, phase: report.stoppedAt ?? 'capture' });
  say(`STOP: ${String(err).slice(0, 300)}`);
} finally {
  await guard.stopOnce('probe-finally');
  report.cleanup = guard.cleanupReceipt({ probe: 'manual-witness-clearance-probe.mjs' });
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - t0;
  const body = JSON.stringify(report, null, 1);
  writeFileSync(join(outDir, 'summary.json'), body);
  writeFileSync(join(outDir, 'summary.sha256'), `${sha(body)}  summary.json\n`);
  say(`verdict=${report.verdict} out=${outDir}`);
}
process.exit(report.verdict === 'CORNER-RECOVERY-OBSERVED' ? 0 : 2);
