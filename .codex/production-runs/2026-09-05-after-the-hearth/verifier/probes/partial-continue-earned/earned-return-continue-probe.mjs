#!/usr/bin/env node
/**
 * ACTUAL PARTIAL WorldSave / Continue TEST — run-local to
 * 2026-09-05-after-the-hearth, bounded to ONE question:
 *
 *   Does a REAL, physically earned, UNFINISHED ch13 survey drawing survive the
 *   shipped save -> Continue lifecycle, and can a NEW signed action then be
 *   performed and accepted on the restored state?
 *
 * WHAT THIS IS NOT
 * ----------------
 *   - not a chapter verification, not a movie journey, not a cold-run measure;
 *   - no teleport, no progress/milestone setter, no direct predicate call, no
 *     hand-constructed save payload, no relaxed arrival/route rule;
 *   - the movie rail is used ONLY as the shipped way of reaching the drawing
 *     state (exactly as capture world-final/survey-1 did). Where the rail
 *     stalls, ORDINARY shipped movement keys are pressed. Any such key input is
 *     labelled `scripted-input` and NEVER counted as zero-rescue movie success.
 *
 * DIVERGENCE FROM partial-continue-probe.mjs (run-local copy, do not conflate)
 * -------------------------------------------------------------------------
 * The parent probe boots `?story=ch13-survey`, whose seed supplies
 * ch13-fault-reviewed and ch13-return-chosen but NOT story:ch13-origin-landed.
 * That makes its Continue land lawfully in ch13-return on the sibling world, so
 * it can only ever prove INCOMPLETE-FIXTURE DATA PRESERVATION — never a valid
 * earned Continue. Walking to W on the sibling world cannot supply the missing
 * Origin landing.
 *
 * This copy boots `?story=ch13-return` instead and PHYSICALLY EARNS
 * story:ch13-origin-landed through the signed ladder
 *   ch13:return:board (anc.cg.hatch-boarded)
 *     -> ch13:return:launch (anc.cg.lift-committed)
 *     -> ch13:return:origin (anc.cg.origin-landed)
 * BEFORE any drawing is made or saved. No milestone is seeded, forged, granted
 * or world-jumped; the probe only watches the shipped rail drive shipped verbs
 * and fails loudly (ERC-ORIGIN-LANDING-NOT-EARNED) if the landing never fires.
 *
 * LIFECYCLE UNDER TEST (all shipped code paths, no fixtures):
 *   0. `?story=ch13-return&movie=1`, then EARN story:ch13-origin-landed.
 *   1. Only then, earn the partial survey drawing on the earned Origin.
 *   2. Earn the partial recording with actual shipped movement/[F] inputs.
 *   3. Save through the shipped autosave-on-unload path (App.tsx `beforeunload`
 *      -> doSave(true) -> saveWorld -> serializeCommonGroundForWorld), fired by
 *      a same-tab navigation away from the game. The ACTUAL serialized
 *      localStorage bytes are copied out as evidence before the browser closes.
 *   4. Boot the menu with NO story deep link and press the real Continue button
 *      (LandingMenu -> beginStory -> storyEntryPoint). Browser storage is
 *      retained across the navigation; nothing is re-seeded.
 *   5. Compare restored route/identity/actor progress, check that no earned
 *      action replays into fresh AV history, then perform a NEW action (walk to
 *      E with ordinary keys, offer the span with [F]) and check its signed AV
 *      anchor is accepted.
 *
 * Everything is measured; nothing here decides acceptance.
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { ART, CAPTURES, RUN_DIR, REPO_ROOT, MAIN } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard, failureRecord } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from '../lib/sourceSnapshot.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';

// ------------------------------------------------------------------ args ---
const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : d;
};
const outName = arg('out', 'earned-1');
const minSamples = Number(arg('min-samples', '4'));
const earnBudgetMs = Number(arg('earn-ms', '120000'));
const walkBudgetMs = Number(arg('walk-ms', '90000'));
const returnBudgetMs = Number(arg('return-ms', '240000'));
const outDir = resolve(CAPTURES, 'partial-continue', outName);

// ------------------------------------------------------- self-test (no GPU) ---
// Exercises the pure decision helpers with no browser, no preview, no game.
const unit = (v) => { const m = Math.hypot(v[0], v[1]); return m < 1e-9 ? [0, 0] : [v[0] / m, v[1] / m]; };
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Pick the ordinary movement key whose measured world direction best matches want. */
function chooseKey(dirs, want) {
  let best = null; let bestDot = -Infinity;
  for (const [k, d] of Object.entries(dirs)) {
    if (!d) continue;
    const s = dot2(d, want);
    if (s > bestDot) { bestDot = s; best = k; }
  }
  return { key: best, score: bestDot };
}
if (process.argv.includes('--self-test')) {
  const fail = (m) => { console.error(`[partial-continue self-test] FAIL ${m}`); process.exit(1); };
  const dirs = { KeyW: [-0.87, 0.49], KeyS: [0.87, -0.49], KeyA: [-0.49, -0.87], KeyD: [0.49, 0.87] };
  if (chooseKey(dirs, unit([-1, 0])).key !== 'KeyW') fail('west target should pick the measured westward key');
  if (chooseKey(dirs, unit([1, 0])).key !== 'KeyS') fail('east target should pick its opposite');
  if (chooseKey(dirs, unit([0.49, 0.87])).key !== 'KeyD') fail('exact key direction must win');
  if (Math.abs(distXZ([0, 0, 0], [3, 99, 4]) - 5) > 1e-9) fail('distXZ ignores the up axis');
  if (Math.abs(dist3([0, 0, 0], [0, 3, 4]) - 5) > 1e-9) fail('dist3 uses all three axes');
  const p = projectedProgress([0, 0, 0], [-1, 0, 0.5], [-10, 0, 0]);
  if (!(p.alongLeg > 0.9 && p.alongLeg < 1.1)) fail(`projected along-leg wrong: ${p.alongLeg}`);
  if (!(Math.abs(p.lateral - 0.5) < 1e-9)) fail(`lateral component wrong: ${p.lateral}`);
  const q = projectedProgress([0, 0, 0], [0, 0, 2], [-10, 0, 0]);
  if (Math.abs(q.alongLeg) > 1e-9) fail('a pure sidestep must project to zero along the intended leg');
  console.log('[partial-continue self-test] OK');
  process.exit(0);
}

/**
 * Displacement resolved ALONG the intended leg vs LATERAL to it. Root's note:
 * a lateral sidestep alone does not prove the original direction was clear, so
 * collision discrimination reports both components, never just gross distance.
 */
function projectedProgress(from, moved, target) {
  const leg = unit([target[0] - from[0], target[2] - from[2]]);
  const d = [moved[0] - from[0], moved[2] - from[2]];
  const along = dot2(d, leg);
  const lateral = Math.hypot(d[0] - along * leg[0], d[1] - along * leg[1]);
  return { alongLeg: along, lateral, gross: Math.hypot(d[0], d[1]) };
}

// ------------------------------------------------------------------ setup ---
assertFreshOutputDir(outDir, { what: 'partial-continue' });
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
const t0 = Date.now();
const log = [];
const say = (m) => {
  const line = `${new Date().toISOString()} +${Date.now() - t0}ms ${m}`;
  console.log(`[pc] ${m}`);
  log.push(line);
};
const emit = (rec) => appendFileSync(tracePath, `${JSON.stringify({ atMs: Date.now() - t0, at: new Date().toISOString(), ...rec })}\n`);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const own = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (own.state !== 'running') throw new Error(`root preview is not running (state=${own.state}); this probe never starts one`);
const previewRef = { url: own.url, stop() { /* ROOT owns this preview's lifetime */ } };

const sourceManifest = writeSourceSnapshot({
  entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
  note: 'Exact probe + library bytes of the partial WorldSave/Continue test.'
});

// ------------------------------------------------------- page-side readers ---
const cgSnap = (page) => page.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return {
    beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, up: s.up,
    supported: s.supported, worldBound: s.worldBound, rail: s.rail, railCursor: s.railCursor,
    score: s.score, pendingAnchors: s.pendingAnchors,
    anchors: s.diagnostic?.anchors ?? null,
    holdReason: s.diagnostic?.holdReason ?? null,
    worker: s.diagnostic?.worker ?? null,
    survey: s.diagnostic?.survey ?? null,
    common: s.diagnostic?.common ?? null
  };
});

/** Everything the shipped persistence layer actually wrote, verbatim. */
const readStorage = (page) => page.evaluate(() => {
  const out = { keys: [], world: [], global: null, globalKey: null };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) ?? '';
    out.keys.push({ key: k, bytes: v.length });
    if (/\.world\.[^.]+$/.test(k)) out.world.push({ key: k, raw: v });
    if (/\.global$/.test(k) || /global/.test(k)) { out.globalKey = k; out.global = v; }
  }
  return out;
});

const uiProbe = (page) => page.evaluate(() => {
  const cta = document.querySelector('button[aria-describedby="landing-story-subtitle"]');
  const sub = document.getElementById('landing-story-subtitle');
  const pause = document.querySelector('button[aria-label="Pause"], button[aria-label="Pause and open star map"]');
  const hud = document.querySelector('[data-story-guidance-hud]');
  const txt = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);
  return {
    title: document.title,
    landingCta: txt(cta), landingSubtitle: txt(sub), landingMenuPresent: !!cta,
    pauseButton: pause ? (pause.getAttribute('aria-label')) : null,
    hudPresent: !!hud,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    hudText: txt(hud),
    buttons: [...document.querySelectorAll('button')].map((b) => txt(b)).filter(Boolean).slice(0, 40)
  };
});

const shot = async (page, name) => {
  const p = join(outDir, name);
  await page.screenshot({ path: p });
  return { file: name, sha256: sha(readFileSync(p)) };
};

/**
 * ORDINARY SHIPPED MOVEMENT, closed loop.
 *
 * Calibrates each WASD key by pressing it briefly and measuring the REAL world
 * displacement of the body, then walks toward `target` in short bursts, always
 * recording the displacement resolved ALONG the intended leg and LATERAL to it
 * (a sidestep is not proof the intended direction was clear).
 *
 * This is scripted input on the shipped controls. It is never a teleport, never
 * a grant, never a rescue, and no movie run is called successful because of it.
 */
async function walkTowards(page, target, {
  budgetMs = 90000, arriveUnits = 1.2, stopWhen = null, minDistToTarget = 0, calibrate = true, dirs = {}, say: log = () => {}
} = {}) {
  const journey = [];
  const keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
  for (const k of keys) if (!(k in dirs)) dirs[k] = null;
  if (calibrate) {
    for (const key of keys) {
      const b = (await cgSnap(page))?.bodyCentre;
      await page.keyboard.down(key); await sleep(450); await page.keyboard.up(key); await sleep(350);
      const a = (await cgSnap(page))?.bodyCentre;
      const d = [a[0] - b[0], a[2] - b[2]];
      dirs[key] = Math.hypot(...d) > 0.05 ? unit(d) : null;
      journey.push({ step: 'calibrate', key, from: b, to: a, moved: Math.hypot(...d), dir: dirs[key] });
      log(`calibrate ${key}: moved ${Math.hypot(...d).toFixed(3)} dir=${JSON.stringify(dirs[key])}`);
    }
  }
  const t = Date.now();
  let cur = await cgSnap(page);
  let bursts = 0; let stopReason = 'budget-exhausted';
  while (Date.now() - t < budgetMs) {
    if (stopWhen && await stopWhen(cur)) { stopReason = 'stop-condition'; break; }
    const dTo = distXZ(cur.bodyCentre, target);
    if (dTo <= arriveUnits) { stopReason = 'arrived'; break; }
    if (minDistToTarget && dTo <= minDistToTarget) { stopReason = 'hold-off-distance'; break; }
    const want = unit([target[0] - cur.bodyCentre[0], target[2] - cur.bodyCentre[2]]);
    const pick = chooseKey(dirs, want);
    if (!pick.key) { stopReason = 'no-key-produced-displacement'; break; }
    const b = cur.bodyCentre;
    await page.keyboard.down(pick.key); await sleep(400); await page.keyboard.up(pick.key); await sleep(220);
    cur = await cgSnap(page);
    const proj = projectedProgress(b, cur.bodyCentre, target);
    const moved = [cur.bodyCentre[0] - b[0], cur.bodyCentre[2] - b[2]];
    if (Math.hypot(...moved) > 0.05) dirs[pick.key] = unit(moved);
    bursts++;
    journey.push({ step: 'walk', burst: bursts, key: pick.key, from: b, to: cur.bodyCentre,
      distToTarget: distXZ(cur.bodyCentre, target), alongLeg: proj.alongLeg, lateral: proj.lateral,
      gross: proj.gross, supported: cur.supported, samples: cur.survey?.samples, walked: cur.survey?.walkedUnits });
    if (bursts % 8 === 0) log(`burst ${bursts}: body=${cur.bodyCentre.map((n) => n.toFixed(2))} distToTarget=${distXZ(cur.bodyCentre, target).toFixed(2)} samples=${cur.survey?.samples}`);
  }
  return { journey, dirs, bursts, stopReason, ms: Date.now() - t, final: cur,
    label: 'scripted-input journey with ORDINARY shipped movement keys (never a movie zero-rescue claim)' };
}

const avOf = (st) => ({
  beat: st?.av?.beat ?? null,
  active: st?.av?.active ?? null,
  history: st?.av?.activationHistoryAnchorIds ?? st?.av?.history ?? null,
  ledger: st?.av?.anchorLedger ?? null
});

// ------------------------------------------------------------------- main ---
const guard = createOwnedSessionGuard({ log: say, label: 'partial-continue' });
const report = {
  schema: 'paravoxia.verifier.partialContinue.v1',
  probe: 'partial-continue-probe.mjs',
  startedAt: new Date(t0).toISOString(),
  question: 'Does an actual unfinished ch13 survey drawing survive the shipped save -> Continue lifecycle, and is a NEW signed action then accepted?',
  isAcceptance: false,
  isChapterVerification: false,
  preview: { url: own.url, bundlePath: own.bundlePath, bundleSha256: own.bundleSha256, indexSha256: own.indexSha256, sourceManifestSha256: own.sourceManifestSha256, ownedBy: own.owner },
  probeSource: snapshotRef(sourceManifest),
  prerequisiteFixtures: [], actualInteractions: [], phases: {}, findings: []
};

try {
  // ---------------------------------------------------------- PHASE 1: earn ---
  say('PHASE 0 — boot ch13-return and PHYSICALLY EARN the Origin landing BEFORE any drawing/save');
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-return&journeyprobe=1&debug=1&movie=1',
    preview: previewRef, build: false, viewport: { width: 1280, height: 720 }, log: say
  }));
  const page = session.page;
  report.renderer = session.renderer;
  report.headed = session.headed;
  report.entryUrl = session.url;
  report.prerequisiteFixtures.push({
    what: 'story deep link ?story=ch13-return',
    effect: 'seedForBeat marks the ch13-return entry milestones. It does NOT seed story:ch13-origin-landed — that milestone must be physically earned by this probe through the signed board -> launch -> origin ladder before any drawing is saved.',
    label: 'prerequisite-fixture'
  });
  report.prerequisiteFixtures.push({
    what: 'movie=1 rail',
    effect: 'The shipped ch13-return/ch13-survey rails drive the same keys/verbs a player uses. Scripted input used to reach state; NEVER reported as a zero-rescue movie success.',
    label: 'scripted-input-journey'
  });
  say(`renderer=${session.renderer} headed=${session.headed}`);
  await waitReady(page, { timeoutMs: 120000 });

  // ---- PHASE 0: earn story:ch13-origin-landed through the signed ladder ------
  // ch13:return:board (anc.cg.hatch-boarded) -> ch13:return:launch
  // (anc.cg.lift-committed) -> ch13:return:origin (anc.cg.origin-landed).
  // Nothing here grants, seeds or teleports: we only watch the shipped rail
  // drive the shipped verbs and record what actually fires.
  const ret0 = Date.now();
  const returnLadder = [];
  const flightTelemetry = [];
  let originLanded = false;
  let lastLadderSig = '';
  // A seated body during MOVING flight is not a stall (commission). The only
  // honest discriminator available in the DOM is the marker's own distance
  // readout, e.g. "origin · audit site · 435m", plus the ship/flight mode.
  const flightRead = (p) => p.evaluate(() => {
    const body = document.body ? document.body.innerText : '';
    const m = body.match(/·\s*([\d.]+)\s*m\b/);
    const f = body.match(/Flight:\s*([^\n]+)/);
    const s = body.match(/Ship:\s*([^\n]+)/);
    const c = body.match(/Coordinate:\s*([^\n]+)/);
    return {
      markerDistanceM: m ? Number(m[1]) : null,
      flightMode: f ? f[1].trim() : null,
      shipState: s ? s[1].trim() : null,
      coordinate: c ? c[1].trim() : null
    };
  });
  while (Date.now() - ret0 < returnBudgetMs) {
    const rSt = await readState(page);
    const rCg = await cgSnap(page);
    const fl = await flightRead(page).catch(() => null);
    flightTelemetry.push({ atMs: Date.now() - ret0, ...(fl ?? {}), objectiveId: rSt?.objectiveId ?? null });
    const ms = rSt?.milestones ?? [];
    const sig = `${rSt?.beat}|${rSt?.objectiveId}|${(rCg?.anchors ?? []).join(',')}`;
    if (sig !== lastLadderSig) {
      lastLadderSig = sig;
      returnLadder.push({
        atMs: Date.now() - ret0, beat: rSt?.beat ?? null,
        objectiveId: rSt?.objectiveId ?? null, markerLabel: rSt?.markerLabel ?? null,
        anchors: rCg?.anchors ?? [], bodyCentre: rCg?.bodyCentre ?? null,
        originLandedMilestone: ms.includes('story:ch13-origin-landed')
      });
      say(`  return ladder: beat=${rSt?.beat} obj=${rSt?.objectiveId} marker=${JSON.stringify(rSt?.markerLabel)} dist=${fl?.markerDistanceM}m flight=${fl?.flightMode} body=${JSON.stringify(rCg?.bodyCentre)}`);
    }
    emit({ phase: 'earn-return', cg: rCg, beat: rSt?.beat, objectiveId: rSt?.objectiveId, av: avOf(rSt) });
    if (ms.includes('story:ch13-origin-landed')) { originLanded = true; break; }
    await sleep(1000);
  }
  const returnMs = Date.now() - ret0;
  const originState = await readState(page);
  const originCg = await cgSnap(page);
  const shotOrigin = await shot(page, '0000a-origin-landed.png');
  report.phases.earnedReturn = {
    lane: 'movie rail driving the shipped return ladder (scripted input, NOT a zero-rescue claim)',
    returnMs, originLanded, ladder: returnLadder,
    flightTelemetry,
    flightDistanceTrend: (() => {
      const d = flightTelemetry.filter((t) => typeof t.markerDistanceM === 'number');
      if (d.length < 2) return { samples: d.length, verdict: 'insufficient-distance-samples' };
      const first = d[0], last = d[d.length - 1];
      const min = d.reduce((a, b) => (b.markerDistanceM < a.markerDistanceM ? b : a));
      const max = d.reduce((a, b) => (b.markerDistanceM > a.markerDistanceM ? b : a));
      return {
        samples: d.length, firstM: first.markerDistanceM, lastM: last.markerDistanceM,
        minM: min.markerDistanceM, maxM: max.markerDistanceM,
        closedM: first.markerDistanceM - last.markerDistanceM,
        verdict: Math.abs(first.markerDistanceM - last.markerDistanceM) < 1
          ? 'NO-CLOSURE: marker distance did not change — seated body AND stationary ship'
          : (last.markerDistanceM < first.markerDistanceM
              ? 'CLOSING: ship is actually flying toward the target'
              : 'OPENING: distance increased')
      };
    })(),
    beat: originState?.beat ?? null,
    milestonesCh13: (originState?.milestones ?? []).filter((m) => m.includes('ch13')),
    originLandedMilestone: (originState?.milestones ?? []).includes('story:ch13-origin-landed'),
    cg: originCg, frame: shotOrigin,
    note: 'story:ch13-origin-landed here is EARNED by playing the signed board/launch/origin ladder. No milestone was seeded, forged or granted by this probe.'
  };
  say(`PHASE 0 result after ${returnMs}ms: originLanded=${originLanded} beat=${originState?.beat}`);
  if (!originLanded) {
    report.findings.push({
      id: 'ERC-ORIGIN-LANDING-NOT-EARNED',
      detail: `story:ch13-origin-landed did not fire within ${returnBudgetMs}ms of the shipped ch13-return rail`,
      lastBeat: originState?.beat ?? null, ladder: returnLadder
    });
    throw new Error('Origin landing not earned — see ERC-ORIGIN-LANDING-NOT-EARNED');
  }

  say('PHASE 1 — earn a real partial drawing on the EARNED Origin');
  const earn0 = Date.now();
  let cg = null; let st = null;
  let lastGrowthAt = Date.now(); let lastSamples = -1;
  while (Date.now() - earn0 < earnBudgetMs) {
    cg = await cgSnap(page);
    st = await readState(page);
    emit({ phase: 'earn', cg, beat: st?.beat, objectiveId: st?.objectiveId, av: avOf(st) });
    const n = cg?.survey?.samples ?? -1;
    if (n !== lastSamples) { lastSamples = n; lastGrowthAt = Date.now(); }
    if (cg?.survey?.phase === 'drawing' && n >= minSamples) break;
    // Do not re-run the already-established 150 s stall: once the drawing is
    // open and the rail has stopped growing it, hand over to ordinary input.
    if (cg?.survey?.phase === 'drawing' && Date.now() - lastGrowthAt > 15000) {
      say(`movie rail has not grown the drawing for 15 s at ${n} samples — treating as the known rail stall`);
      break;
    }
    await sleep(750);
  }
  const railMs = Date.now() - earn0;
  const railState = cg;
  say(`movie rail alone after ${railMs}ms: phase=${cg?.survey?.phase} samples=${cg?.survey?.samples} walked=${cg?.survey?.walkedUnits} body=${JSON.stringify(cg?.bodyCentre)}`);
  const shotRail = await shot(page, '0000-movie-rail-state.png');

  // The rail stall (VF4-SURVEY-STALL-1) is already an established observation.
  // It does not block SAVING a partial drawing: ordinary shipped keys grow the
  // real recording. Held well short of E so no offer can fire in this phase.
  let earnWalk = null;
  if (cg?.survey?.phase === 'drawing' && (cg.survey.samples ?? 0) < minSamples) {
    say(`rail produced only ${cg.survey.samples} samples; growing the drawing with ORDINARY movement keys (scripted input, not a movie success)`);
    earnWalk = await walkTowards(page, [-42, 51.05, 12], {
      budgetMs: 60000, arriveUnits: 1.2, minDistToTarget: 8, say,
      stopWhen: async (s) => (s?.survey?.samples ?? 0) >= minSamples
    });
    cg = await cgSnap(page);
    say(`after ${earnWalk.bursts} ordinary bursts (${earnWalk.stopReason}): samples=${cg?.survey?.samples} walked=${cg?.survey?.walkedUnits} body=${JSON.stringify(cg?.bodyCentre)}`);
  }
  const earnMs = Date.now() - earn0;
  const shotEarned = await shot(page, '0001-earned-partial-drawing.png');
  const earnedState = await readState(page);
  const earnedUi = await uiProbe(page);
  report.phases.earn = {
    lane: 'movie+ordinary-keys', earnMs, cg, ui: earnedUi, frame: shotEarned,
    railOnly: { ms: railMs, state: railState, frame: shotRail,
      note: 'The movie rail alone reached this state and then stalled; it is NOT reported as a zero-rescue movie success.' },
    ordinaryKeyGrowth: earnWalk,
    milestones: earnedState?.milestones ?? null,
    av: avOf(earnedState),
    objectiveId: earnedState?.objectiveId ?? null,
    markerLabel: earnedState?.markerLabel ?? null,
    hudText: earnedState?.hudText ?? null,
    system: earnedState?.system ?? null,
    routeTestedMilestonePresent: (earnedState?.milestones ?? []).includes('story:ch13-route-tested'),
    reached: cg?.survey?.phase === 'drawing' && (cg?.survey?.samples ?? 0) >= minSamples
  };
  if (!report.phases.earn.reached) {
    report.findings.push({ id: 'PC-EARN-BLOCKED', detail: `did not reach a >=${minSamples}-sample drawing within ${earnBudgetMs}ms`, state: cg });
    throw new Error('partial drawing not earned — see report.findings PC-EARN-BLOCKED');
  }
  if (report.phases.earn.routeTestedMilestonePresent) {
    report.findings.push({ id: 'PC-CHECKPOINT-IMPURE', detail: 'story:ch13-route-tested already present at the checkpoint; this is no longer a PARTIAL save' });
  }

  // ------------------------------------------------- PHASE 2: shipped save ---
  say('PHASE 2 — save through the shipped autosave lifecycle (beforeunload -> doSave)');
  const preSaveStorage = await readStorage(page);
  report.phases.save = { beforeNavigation: { keys: preSaveStorage.keys, worldKeys: preSaveStorage.world.map((w) => w.key) } };
  for (const w of preSaveStorage.world) {
    writeFileSync(join(outDir, `worldsave-presave-${w.key.replace(/[^\w.-]/g, '_')}.json`), w.raw);
  }

  const menuUrl = new URL('?journeyprobe=1&debug=1', own.url).toString();
  say(`navigating same tab to ${menuUrl} — this fires the shipped beforeunload autosave and RETAINS localStorage`);
  await page.goto(menuUrl, { waitUntil: 'load', timeout: 180000 });
  report.actualInteractions.push({ what: 'same-tab navigation away from the running game', shippedPath: 'App.tsx beforeunload -> doSave(true) -> saveWorld/savePlayerPose/saveGlobal', label: 'actual-shipped-save' });

  const savedStorage = await readStorage(page);
  const saved = savedStorage.world.map((w) => {
    let parsed = null; try { parsed = JSON.parse(w.raw); } catch { /* keep raw */ }
    const file = `worldsave-${w.key.replace(/[^\w.-]/g, '_')}.json`;
    writeFileSync(join(outDir, file), w.raw);
    const cgBlob = parsed?.commonGround ?? null;
    return {
      key: w.key, bytes: w.raw.length, sha256: sha(w.raw), file,
      worldId: parsed?.worldId ?? null, seed: parsed?.seed ?? null,
      hasCommonGround: cgBlob != null,
      commonGroundSha256: cgBlob ? sha(JSON.stringify(cgBlob)) : null,
      commonGround: cgBlob
    };
  });
  if (savedStorage.global) writeFileSync(join(outDir, 'globalsave.json'), savedStorage.global);
  let globalParsed = null; try { globalParsed = JSON.parse(savedStorage.global ?? 'null'); } catch { /* ignore */ }
  report.phases.save.actualWorldSaves = saved.map(({ commonGround, ...rest }) => rest);
  report.phases.save.savedCommonGround = saved.find((s) => s.hasCommonGround)?.commonGround ?? null;
  report.phases.save.globalSave = globalParsed
    ? { key: savedStorage.globalKey, sha256: sha(savedStorage.global), milestones: globalParsed.milestones ?? null, lastPlanetWorldId: globalParsed.lastPlanetWorldId ?? null }
    : null;
  report.phases.save.routeTestedMilestoneInSave = (globalParsed?.milestones ?? []).includes('story:ch13-route-tested');
  say(`saved world blobs: ${JSON.stringify(report.phases.save.actualWorldSaves)}`);
  if (!saved.some((s) => s.hasCommonGround)) {
    report.findings.push({ id: 'PC-SAVE-NO-COMMONGROUND', detail: 'the shipped save wrote no commonGround blob for any world key after an earned partial drawing' });
  }

  // ----------------------------------------------- PHASE 3: real Continue ---
  say('PHASE 3 — operate the real Continue UI (no deep link, storage retained)');
  // The menu boot has no story runtime yet, so `waitReady`'s beat/`__game`
  // predicate does not apply here: wait for the actual landing CTA element.
  await page.waitForSelector('button[aria-describedby="landing-story-subtitle"]', { timeout: 120000 });
  await sleep(6000);
  const menuUi = await uiProbe(page);
  const shotMenu = await shot(page, '0002-landing-menu-continue.png');
  say(`menu: title=${menuUi.title} cta=${JSON.stringify(menuUi.landingCta)} subtitle=${JSON.stringify(menuUi.landingSubtitle)}`);
  report.phases.continue = { menuUrl, menuUi, menuFrame: shotMenu, uiActions: [] };
  if (menuUi.title !== 'Paravoxia') throw new Error(`served page is not Paravoxia (title=${menuUi.title})`);
  if (!menuUi.landingMenuPresent) {
    report.findings.push({ id: 'PC-CONTINUE-NO-MENU', detail: 'no landing story CTA present on a plain boot', ui: menuUi });
    throw new Error('landing Continue CTA absent — see PC-CONTINUE-NO-MENU');
  }
  if (!/Continue/i.test(menuUi.landingCta ?? '')) {
    report.findings.push({ id: 'PC-CONTINUE-CTA-LABEL', detail: `landing CTA reads ${JSON.stringify(menuUi.landingCta)} after a real mid-chapter save; canContinueStory()/storyEntryPoint() did not see a resumable save`, subtitle: menuUi.landingSubtitle });
  }
  await page.click('button[aria-describedby="landing-story-subtitle"]');
  report.phases.continue.uiActions.push({ action: 'click', selector: 'button[aria-describedby="landing-story-subtitle"]', label: menuUi.landingCta, shippedPath: 'LandingMenu.startOrContinueStory -> beginStory() -> storyEntryPoint()' });
  report.actualInteractions.push({ what: 'clicked the real landing Continue button', label: 'actual-continue-ui' });

  const cont0 = Date.now();
  let contCg = null; let contSt = null; let contUi = null;
  while (Date.now() - cont0 < 60000) {
    contCg = await cgSnap(page);
    contSt = await readState(page);
    contUi = await uiProbe(page);
    emit({ phase: 'continue', cg: contCg, beat: contSt?.beat, objectiveId: contSt?.objectiveId, av: avOf(contSt), menuPresent: contUi.landingMenuPresent });
    if (contCg?.survey && contUi.hudPresent && !contUi.landingMenuPresent) break;
    await sleep(1000);
  }
  const restoreMs = Date.now() - cont0;
  const shotAfter = await shot(page, '0003-after-continue.png');
  report.phases.continue.afterClick = {
    ms: restoreMs, cg: contCg, ui: contUi, frame: shotAfter,
    beat: contSt?.beat ?? null, objectiveId: contSt?.objectiveId ?? null,
    markerLabel: contSt?.markerLabel ?? null, hudText: contSt?.hudText ?? null,
    milestones: contSt?.milestones ?? null, av: avOf(contSt),
    autopilot: contSt?.autopilot ?? null, spaceFlight: contSt?.spaceFlight ?? null,
    system: contSt?.system ?? null
  };
  say(`after Continue (${restoreMs}ms): beat=${contSt?.beat} menuStillUp=${contUi?.landingMenuPresent} survey=${JSON.stringify(contCg?.survey)}`);

  // Did the live (possibly empty) chapter state overwrite the earned bytes?
  const postContinueStorage = await readStorage(page);
  report.phases.continue.storageAfterContinue = postContinueStorage.world.map((w) => {
    let parsed = null; try { parsed = JSON.parse(w.raw); } catch { /* keep raw */ }
    const cgBlob = parsed?.commonGround ?? null;
    const file = `worldsave-after-continue-${w.key.replace(/[^\w.-]/g, '_')}.json`;
    writeFileSync(join(outDir, file), w.raw);
    return { key: w.key, bytes: w.raw.length, sha256: sha(w.raw), file,
      hasCommonGround: cgBlob != null,
      commonGroundSha256: cgBlob ? sha(JSON.stringify(cgBlob)) : null,
      surveyPhase: cgBlob?.survey?.phase ?? null,
      savedSamples: cgBlob?.survey?.working?.samples?.length ?? 0 };
  });
  const stillOnDisk = report.phases.continue.storageAfterContinue.find((w) => w.savedSamples > 0);
  say(`stored WorldSave after Continue: ${JSON.stringify(report.phases.continue.storageAfterContinue)}`);
  if (!stillOnDisk) {
    report.findings.push({ id: 'PC-SAVE-OVERWRITTEN', detail: 'after Continue the persisted WorldSave no longer carries the earned samples; the empty live chapter state was written over the earned bytes' });
  }

  // ------------------------------------------- PHASE 4: survival + new act ---
  const before = report.phases.earn.cg.survey;
  const after = contCg?.survey ?? null;
  report.phases.survival = {
    beforeSave: before, afterContinue: after,
    samplesSurvived: after ? after.samples === before.samples : false,
    walkedUnitsSurvived: after ? Math.abs((after.walkedUnits ?? -1) - (before.walkedUnits ?? -2)) < 1e-6 : false,
    phaseAfterContinue: after?.phase ?? null,
    identity: {
      savedWorldIds: report.phases.save.actualWorldSaves.map((s) => s.worldId),
      liveBeat: contSt?.beat ?? null
    },
    avReplayCheck: {
      earnedHistory: report.phases.earn.av.history,
      restoredHistory: avOf(contSt).history,
      pendingAnchorsAfterContinue: contCg?.pendingAnchors ?? null,
      note: 'A restored survey must not replay already-earned activations into fresh AV history nor play a deferred acknowledgement.'
    }
  };

  report.phases.newAction = { attempted: false, reason: null };

  // The save carries no story:ch13-origin-landed (the deep link seeds only
  // fault-reviewed/return-chosen), so the shipped resume ladder lands a
  // restored save in ch13-return. Walking to W is the SHIPPED earned way back
  // into the survey — an actual new action with its own signed anchor, not a
  // grant. Ordinary keys only.
  if (contSt?.beat === 'ch13-return') {
    say('PHASE 4a — NEW action: the resume ladder landed in ch13-return; walk to W with ordinary keys to earn the landing');
    const W = [-34, 51.05, 10];
    // Approach along the authored route plane first (the direct line crosses a
    // lower shelf), then step in to W. Ordinary keys, no pose setter.
    const legA = await walkTowards(page, [-34, 51.05, 12], { budgetMs: Math.round(walkBudgetMs / 2), arriveUnits: 1.4, say });
    for (const j of legA.journey) emit({ phase: 'walk-to-route-plane', ...j });
    const wWalk = await walkTowards(page, W, { budgetMs: Math.round(walkBudgetMs / 2), arriveUnits: 1.2, calibrate: false, dirs: legA.dirs, say });
    wWalk.journey = [...legA.journey, ...wWalk.journey];
    wWalk.bursts += legA.bursts;
    for (const j of wWalk.journey) emit({ phase: 'walk-to-W', ...j });
    await sleep(2500);
    const wCg = await cgSnap(page);
    const wSt = await readState(page);
    const shotW = await shot(page, '0003b-after-walk-to-W.png');
    report.phases.newAction.returnLeg = {
      label: wWalk.label, target: W, bursts: wWalk.bursts, walkMs: wWalk.ms, stopReason: wWalk.stopReason,
      finalBody: wWalk.final?.bodyCentre ?? null, finalBodyPose: wWalk.final?.bodyPose ?? null,
      finalDistToW: wWalk.final ? distXZ(wWalk.final.bodyCentre, W) : null,
      finalPoseDistanceToW3d: wWalk.final?.bodyPose ? dist3(wWalk.final.bodyPose, W) : null,
      actorReachUnits: 3.4, actorReachIs3d: true,
      supported: wWalk.final?.supported ?? null,
      journey: wWalk.journey, frame: shotW,
      beatAfter: wSt?.beat ?? null, cgAfter: wCg,
      originLandedMilestone: (wSt?.milestones ?? []).includes('story:ch13-origin-landed'),
      originLandedAnchor: (wCg?.anchors ?? []).includes('anc.cg.origin-landed'),
      av: avOf(wSt),
      spaceFlight: wSt?.spaceFlight ?? null
    };
    say(`after walking to W: beat=${wSt?.beat} originLanded=${report.phases.newAction.returnLeg.originLandedMilestone} anchor=${report.phases.newAction.returnLeg.originLandedAnchor}`);
    report.actualInteractions.push({ what: `ordinary WASD movement toward W, ${wWalk.bursts} bursts`, label: 'scripted-input' });
    contCg = wCg; contSt = wSt;
    report.phases.survival.afterEarnedReentry = wCg?.survey ?? null;
  }

  const surveyLive = contCg?.survey && contSt?.beat === 'ch13-survey';
  if (!surveyLive) {
    report.phases.newAction.reason = `the survey verbs are not live: beat=${contSt?.beat} survey=${JSON.stringify(contCg?.survey)}`;
    report.findings.push({ id: 'PC-CONTINUE-RESUME-POINT', detail: report.phases.newAction.reason });
  } else {
    say('PHASE 4 — NEW action on the restored state: walk to E with ordinary keys, then [F] to offer the span');
    report.phases.newAction.attempted = true;
    const E = [-42, 51.05, 12];
    const walk = await walkTowards(page, E, { budgetMs: walkBudgetMs, arriveUnits: 1.2, say });
    const cur = walk.final;
    const arrived = walk.stopReason === 'arrived';
    say(`walk finished in ${walk.ms}ms after ${walk.bursts} bursts (${walk.stopReason}): distToE=${distXZ(cur.bodyCentre, E).toFixed(3)} arrived=${arrived}`);
    for (const j of walk.journey) emit({ phase: 'walk-to-E', ...j });
    const shotAtE = await shot(page, '0004-at-survey-end.png');
    const atE = await readState(page);
    report.phases.newAction.walk = {
      label: walk.label, target: E, bursts: walk.bursts, walkMs: walk.ms, stopReason: walk.stopReason,
      arrived, finalBody: cur.bodyCentre, finalDistToE: distXZ(cur.bodyCentre, E),
      calibratedKeyDirections: walk.dirs, frame: shotAtE, journey: walk.journey,
      promptsAtEnd: atE?.interactionPrompts ?? null, hudText: atE?.hudText ?? null,
      survey: cur.survey, supported: cur.supported
    };
    report.actualInteractions.push({ what: `ordinary WASD movement toward E, ${walk.bursts} bursts`, label: 'scripted-input' });

    // The offer itself: the shipped [F] context interact.
    const beforeOffer = await cgSnap(page);
    const beforeOfferState = await readState(page);
    await page.keyboard.press('KeyF');
    report.actualInteractions.push({ what: 'pressed [F] (shipped primary interact) to offer the walked span', label: 'actual-interaction' });
    await sleep(1500);
    const afterOffer = await cgSnap(page);
    const afterOfferState = await readState(page);
    const shotOffer = await shot(page, '0005-after-offer.png');
    report.phases.newAction.offer = {
      key: 'KeyF', shippedPath: 'storyInteractions candidate story-ch13-offer-span -> commitCommonGroundSpanOffer',
      promptBefore: beforeOfferState?.interactionPrompts ?? null,
      surveyBefore: beforeOffer?.survey ?? null, surveyAfter: afterOffer?.survey ?? null,
      anchorsBefore: beforeOffer?.anchors ?? null, anchorsAfter: afterOffer?.anchors ?? null,
      avBefore: avOf(beforeOfferState), avAfter: avOf(afterOfferState),
      accepted: (afterOffer?.survey?.phase && afterOffer.survey.phase !== 'drawing')
        || (afterOffer?.anchors ?? []).includes('anc.cg.route-offered'),
      frame: shotOffer
    };
    say(`offer result: phase ${beforeOffer?.survey?.phase} -> ${afterOffer?.survey?.phase}; route-offered anchor present=${(afterOffer?.anchors ?? []).includes('anc.cg.route-offered')}`);
    if (!report.phases.newAction.offer.accepted) {
      report.findings.push({ id: 'PC-NEW-ACTION-REFUSED', detail: 'the [F] span offer on restored state produced no phase change and no anc.cg.route-offered anchor', state: afterOffer });
    }
  }

  // --------------------------------- PHASE 5: secondary quit-to-menu probe ---
  const quitUi = await uiProbe(page);
  report.phases.quitToMenu = { pauseButtonPresent: !!quitUi.pauseButton, exercised: false };
  if (quitUi.pauseButton) {
    say('PHASE 5 — secondary: shipped Pause -> Quit to Menu, observing what it writes');
    const storageBeforeQuit = await readStorage(page);
    let pauseClicked = 'clicked';
    try { await page.click(`button[aria-label="${quitUi.pauseButton}"]`, { timeout: 8000 }); }
    catch (e) {
      pauseClicked = `intercepted: ${String(e.message ?? e).split('\n')[0]}`;
      say(`pause button not clickable normally (${pauseClicked}); retrying with a forced dispatch and labelling it`);
      try { await page.click(`button[aria-label="${quitUi.pauseButton}"]`, { force: true, timeout: 8000 }); pauseClicked += ' -> forced click'; }
      catch (e2) { pauseClicked += ` -> forced click also failed: ${String(e2.message ?? e2).split('\n')[0]}`; }
    }
    report.phases.quitToMenu.pauseClick = pauseClicked;
    await sleep(1200);
    const pauseShot = await shot(page, '0006-pause-menu.png');
    const pauseUi = await uiProbe(page);
    let clicked = false;
    try { await page.click('text=Quit to Menu', { timeout: 4000 }); clicked = true; } catch { /* recorded below */ }
    await sleep(2500);
    const storageAfterQuit = await readStorage(page);
    const quitShot = await shot(page, '0007-after-quit-to-menu.png');
    const pick = (s) => s.world.map((w) => ({ key: w.key, sha256: sha(w.raw), hasCommonGround: /"commonGround"/.test(w.raw) }));
    report.phases.quitToMenu = {
      pauseButtonPresent: true, exercised: true, quitClicked: clicked,
      pauseMenuButtons: pauseUi.buttons, pauseFrame: pauseShot, afterFrame: quitShot,
      worldSaveBefore: pick(storageBeforeQuit), worldSaveAfter: pick(storageAfterQuit),
      uiAfter: await uiProbe(page),
      note: 'Secondary observation only. The primary save under test is the shipped beforeunload autosave in PHASE 2.'
    };
  }

  report.finishedAt = new Date().toISOString();
  report.cleanupPreFinally = guard.describe();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  report.failure = failureRecord({ probe: 'partial-continue-probe.mjs', error });
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(report.failure, null, 2)}\n`);
  say(`FAILED: ${String(error && error.message ? error.message : error)}`);
  throw error;
} finally {
  const receipt = await guard.stopOnce('finally');
  const post = guard.cleanupReceipt({ probe: 'partial-continue-probe.mjs' });
  writeFileSync(join(outDir, 'cleanup-receipt.json'), `${JSON.stringify({ ...post, stopCall: receipt, rootPreviewUntouched: true, rootPreviewUrl: own.url }, null, 2)}\n`);
  writeFileSync(join(outDir, 'probe-log.txt'), `${log.join('\n')}\n`);
  say(`cleanup ${post.state}`);
}
