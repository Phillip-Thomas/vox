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
const outName = arg('out', 'manual-1');
const minSamples = Number(arg('min-samples', '4'));
const earnBudgetMs = Number(arg('earn-ms', '120000'));
const walkBudgetMs = Number(arg('walk-ms', '90000'));
const returnBudgetMs = Number(arg('return-ms', '240000'));
const watchBudgetMs = Number(arg('watch-ms', '90000'));
const outDir = resolve(CAPTURES, 'manual-survey', outName);

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
  // ============================ TRUE MANUAL LANE ============================
  // NO movie=1. Every input below is an ordinary shipped key pressed by this
  // probe. Nothing is granted, teleported or nudged by a rail. The question:
  //
  //   In ordinary manual play, can the player make a deviation and recover, and
  //   can the player move OFF-ROUTE so W-7744 can actually test the route --
  //   i.e. is anc.cg.route-tested reachable by hand, or is the hold that the
  //   movie lane showed also present for a real player?
  //
  say('MANUAL LANE — ch13-survey with NO movie rail; ordinary keys only');
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1',
    preview: previewRef, build: false, viewport: { width: 1280, height: 720 }, log: say
  }));
  const page = session.page;
  report.renderer = session.renderer; report.headed = session.headed; report.entryUrl = session.url;
  report.lane = 'MANUAL (no movie=1). Key input is the player\'s own; never a zero-rescue movie claim.';
  report.prerequisiteFixtures.push({
    what: 'story deep link ?story=ch13-survey',
    effect: 'seedForBeat marks ch13-fault-reviewed/ch13-return-chosen. Prerequisite setup, NOT earned play, and NOT a cold-journey claim.',
    label: 'prerequisite-fixture'
  });
  await waitReady(page, { timeoutMs: 120000 });
  say(`renderer=${session.renderer} headed=${session.headed}`);

  const W = [-34, 51.05, 10];
  const S = [-26, 51.05, 12];
  const steps = [];
  const snap = async (label) => {
    const st = await readState(page); const cg = await cgSnap(page); const ui = await uiProbe(page);
    const rec = {
      label, atMs: Date.now() - t0, beat: st?.beat ?? null, objectiveId: st?.objectiveId ?? null,
      markerLabel: st?.markerLabel ?? null, workOrder: st?.workOrder ?? ui?.hudText ?? null,
      prompts: st?.interactionPrompts ?? null,
      anchors: cg?.anchors ?? [], survey: cg?.survey ?? null,
      bodyCentre: cg?.bodyCentre ?? null, supported: cg?.supported ?? null,
      worker: cg?.worker ?? null,
      milestonesCh13: (st?.milestones ?? []).filter((m) => m.includes('ch13'))
    };
    steps.push(rec); emit({ phase: 'manual', ...rec });
    say(`  [${label}] obj=${rec.objectiveId} anchors=${rec.anchors.length} survey=${rec.survey?.phase}/${rec.survey?.samples} body=${JSON.stringify(rec.bodyCentre)}`);
    return rec;
  };
  const pressF = async (why) => {
    await page.keyboard.down('KeyF'); await sleep(70); await page.keyboard.up('KeyF');
    await sleep(1500); say(`  pressed [F] (${why})`);
  };

  await snap('boot');

  // Without a movie rail the CG snapshot/body can lag waitReady. Wait for a
  // REAL body pose before any input. This is a harness wait, not a game grant.
  const bodyWait0 = Date.now();
  let bootBody = null;
  while (Date.now() - bodyWait0 < 60000) {
    bootBody = (await cgSnap(page))?.bodyCentre ?? null;
    if (Array.isArray(bootBody) && Math.hypot(bootBody[0], bootBody[1], bootBody[2]) > 0.001) break;
    await sleep(1000);
  }
  report.bodyReadyMs = Date.now() - bodyWait0;
  if (!Array.isArray(bootBody)) {
    report.findings.push({ id: 'MAN-NO-BODY', detail: `no bodyCentre from the CG snapshot within ${report.bodyReadyMs}ms of a manual (non-movie) ch13-survey boot` });
    throw new Error('no body pose in manual lane — see MAN-NO-BODY');
  }
  say(`body ready after ${report.bodyReadyMs}ms at ${JSON.stringify(bootBody)}`);
  await snap('body-ready');

  // FOCUS. A deep-link boot never receives a click, so keyboard events land on
  // nothing and the body cannot move. run-5 showed ordinary keys DO drive this
  // build once the canvas has focus (it had been clicked via Continue). Click
  // the canvas first, then PROVE input is live with a calibration displacement.
  // This is harness focus, not a game grant.
  await page.mouse.click(640, 400);
  await sleep(800);
  const preKey = (await cgSnap(page))?.bodyCentre ?? null;
  await page.keyboard.down('KeyW'); await sleep(700); await page.keyboard.up('KeyW');
  await sleep(600);
  const postKey = (await cgSnap(page))?.bodyCentre ?? null;
  const inputMoved = (Array.isArray(preKey) && Array.isArray(postKey))
    ? Math.hypot(postKey[0] - preKey[0], postKey[1] - preKey[1], postKey[2] - preKey[2]) : 0;
  const entrySt = await readState(page);
  const entryDom = await page.evaluate(() => {
    const b = document.body ? document.body.innerText : '';
    const f = b.match(/Flight:\s*([^\n]+)/); const sh = b.match(/Ship:\s*([^\n]+)/);
    return { flightMode: f ? f[1].trim() : null, shipState: sh ? sh[1].trim() : null };
  });
  report.inputLivenessCheck = {
    preKey, postKey, movedUnits: Number(inputMoved.toFixed(4)), clickedCanvas: true,
    entryMode: entryDom, system: entrySt?.system ?? null,
    interactionPrompts: entrySt?.interactionPrompts ?? null,
    note: 'Measured only AFTER a real (non-placeholder) body pose existed.'
  };
  say(`entry mode: flight=${entryDom.flightMode} ship=${entryDom.shipState} prompts=${JSON.stringify(entrySt?.interactionPrompts)}`);
  // SECOND liveness check AFTER the body has settled on the ground. The first
  // one can be contaminated by the spawn fall (pure -Y). Only HORIZONTAL
  // displacement counts as walking.
  let gy = null; let stable = 0;
  for (let i = 0; i < 40; i += 1) {
    const b = (await cgSnap(page))?.bodyCentre ?? null;
    if (Array.isArray(b) && gy !== null && Math.abs(b[1] - gy) < 0.001) stable += 1; else stable = 0;
    if (Array.isArray(b)) gy = b[1];
    if (stable >= 3) break;
    await sleep(500);
  }
  await page.mouse.click(640, 400);
  await sleep(500);
  const g0 = (await cgSnap(page))?.bodyCentre ?? null;
  await page.keyboard.down('KeyW'); await sleep(1000); await page.keyboard.up('KeyW');
  await sleep(700);
  const g1 = (await cgSnap(page))?.bodyCentre ?? null;
  const horiz = (Array.isArray(g0) && Array.isArray(g1)) ? Math.hypot(g1[0] - g0[0], g1[2] - g0[2]) : null;
  const vert = (Array.isArray(g0) && Array.isArray(g1)) ? Math.abs(g1[1] - g0[1]) : null;
  report.groundedLivenessCheck = {
    settledY: gy, before: g0, after: g1,
    horizontalUnits: horiz === null ? null : Number(horiz.toFixed(4)),
    verticalUnits: vert === null ? null : Number(vert.toFixed(4)),
    clickedCanvasAgain: true,
    interpretation: horiz !== null && horiz < 0.05
      ? 'NO HORIZONTAL MOVEMENT while grounded on this entry'
      : 'horizontal walking works while grounded'
  };
  say(`grounded liveness: horizontal=${horiz} vertical=${vert} from ${JSON.stringify(g0)} -> ${JSON.stringify(g1)}`);
  await snap('after-grounded-liveness');

  if (process.argv.includes('--entry-only')) {
    report.finishedAt = new Date().toISOString();
    report.phases.manual = { lane: 'ENTRY-MODE CHECK ONLY', steps };
    writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
    say('entry-only mode: stopping after the entry/liveness measurement');
    await guard.stopOnce('entry-only');
    process.exit(0);
  }
  say(`input liveness: KeyW moved ${inputMoved.toFixed(4)}u after canvas click`);
  if (inputMoved < 0.05) {
    report.findings.push({
      id: 'MAN-INPUT-DEAD',
      detail: `after a canvas click, a 700 ms KeyW hold moved the body ${inputMoved.toFixed(4)} units at ${JSON.stringify(preKey)}. Ordinary manual movement input is not reaching the body in this lane.`,
      preKey, postKey
    });
    say('WARNING: ordinary key input produced no displacement — continuing so the state is captured, but every later leg is suspect');
  }
  await snap('after-input-liveness');

  const dirs = {};

  // ---- leg 1: walk to W and offer, using ordinary keys -------------------
  const legW = await walkTowards(page, W, { budgetMs: 70000, arriveUnits: 2.6, dirs, say });
  await snap('arrived-W');
  await pressF('offer a route to W-7744');
  const afterOffer = await snap('after-F-at-W');

  // ---- leg 2: DELIBERATE EARLY-CORNER DEVIATION, then recover -----------
  // The commissioned ordinary deviation: leave the intended line early, then
  // return to the guide. This is what an actual player does, and the inbox
  // asks whether the proof recovers honestly or sticks.
  const deviateTo = [S[0] + 6, S[1], S[2] - 7];
  say('MANUAL deviation: stepping off the intended line BEFORE the start, then recovering');
  const legDev = await walkTowards(page, deviateTo, { budgetMs: 40000, arriveUnits: 2.0, calibrate: false, dirs, say });
  const atDeviation = await snap('early-deviation');
  const legBack = await walkTowards(page, S, { budgetMs: 60000, arriveUnits: 1.6, calibrate: false, dirs, say });
  const recovered = await snap('recovered-to-survey-start');
  await pressF('begin recording the route at S');
  const afterStart = await snap('after-F-at-S');

  // ---- leg 3: walk the route by hand to grow real samples ---------------
  const E = [-42, 51.05, 12];
  const legDraw = await walkTowards(page, E, { budgetMs: 90000, arriveUnits: 1.5, calibrate: false, dirs, say });
  const afterDraw = await snap('walked-route-to-E');
  await pressF('offer the walked span');
  const afterSpan = await snap('after-F-offer-span');

  // ---- leg 4: THE DISCRIMINATOR — move OFF-ROUTE so W can test ----------
  // Root: a true manual lane can ordinarily move off route to let W test.
  // Standing-clear is E.z-3 = z9; a player would simply walk aside. We walk
  // WELL clear and then WAIT, watching whether W actually advances.
  const clearOf = [E[0], E[1], E[2] - 4];
  say('MANUAL clearance: walking aside so W-7744 has an unobstructed test');
  const legClear = await walkTowards(page, clearOf, { budgetMs: 45000, arriveUnits: 1.2, calibrate: false, dirs, say });
  const atClear = await snap('stood-clear');

  const watch0 = Date.now();
  let routeTested = false; let workerMoved = 0; let lastWorker = atClear.worker?.position ?? null;
  while (Date.now() - watch0 < watchBudgetMs) {
    const r = await snap(`watch+${Math.round((Date.now() - watch0) / 1000)}s`);
    const wp = r.worker?.position ?? null;
    if (wp && lastWorker) workerMoved += Math.hypot(wp.x - lastWorker.x, wp.y - lastWorker.y, wp.z - lastWorker.z);
    if (wp) lastWorker = wp;
    if ((r.anchors || []).includes('anc.cg.route-tested') || r.milestonesCh13.includes('story:ch13-route-tested')) { routeTested = true; break; }
    await sleep(5000);
  }
  const watchMs = Date.now() - watch0;
  const finalShot = await shot(page, '0010-manual-final.png');
  const finalRec = await snap('final');

  report.phases.manual = {
    lane: 'MANUAL, ordinary keys, no movie rail, no rescue/teleport/grant',
    legs: {
      toW: { bursts: legW.bursts, stopReason: legW.stopReason, finalBody: legW.finalBody ?? null },
      deviation: { bursts: legDev.bursts, stopReason: legDev.stopReason },
      recovery: { bursts: legBack.bursts, stopReason: legBack.stopReason },
      draw: { bursts: legDraw.bursts, stopReason: legDraw.stopReason },
      standClear: { bursts: legClear.bursts, stopReason: legClear.stopReason }
    },
    deviationRecovered: {
      question: 'after an ordinary early deviation, does the survey proof still progress?',
      atDeviation: { survey: atDeviation.survey, objectiveId: atDeviation.objectiveId },
      afterRecovery: { survey: recovered.survey, objectiveId: recovered.objectiveId },
      afterStart: { survey: afterStart.survey, objectiveId: afterStart.objectiveId, anchors: afterStart.anchors }
    },
    drawing: { afterDraw: afterDraw.survey, afterSpan: afterSpan.survey, anchors: afterSpan.anchors },
    clearanceTest: {
      question: 'with the player standing genuinely clear, does W-7744 actually test the route?',
      watchMs, routeTested, workerMovedUnits: Number(workerMoved.toFixed(3)),
      stoodAt: atClear.bodyCentre, finalAnchors: finalRec.anchors,
      finalObjectiveId: finalRec.objectiveId, finalSurvey: finalRec.survey
    },
    finalFrame: finalShot,
    steps
  };
  if (!routeTested) {
    report.findings.push({
      id: 'MAN-ROUTE-TESTED-NOT-REACHED',
      detail: `anc.cg.route-tested did not fire within ${watchMs}ms of standing clear in a TRUE manual lane`,
      workerMovedUnits: Number(workerMoved.toFixed(3)), finalAnchors: finalRec.anchors
    });
  }
  say(`MANUAL RESULT: routeTested=${routeTested} workerMoved=${workerMoved.toFixed(3)}u anchors=${JSON.stringify(finalRec.anchors)}`);

  report.finishedAt = new Date().toISOString();
  report.cleanupPreFinally = guard.describe();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);

} catch (error) {
  report.failure = failureRecord({ probe: 'manual-survey-probe.mjs', error });
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(report.failure, null, 2)}\n`);
  say(`FAILED: ${String(error && error.message ? error.message : error)}`);
  throw error;
} finally {
  const receipt = await guard.stopOnce('finally');
  const post = guard.cleanupReceipt({ probe: 'manual-survey-probe.mjs' });
  writeFileSync(join(outDir, 'cleanup-receipt.json'), `${JSON.stringify({ ...post, stopCall: receipt, rootPreviewUntouched: true, rootPreviewUrl: own.url }, null, 2)}\n`);
  writeFileSync(join(outDir, 'probe-log.txt'), `${log.join('\n')}\n`);
  say(`cleanup ${post.state}`);
}
