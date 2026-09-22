#!/usr/bin/env node
/**
 * EARNED RETURN -> CONTINUE PROBE (PREPARED, NEVER YET RUN) — run-local copy of
 * verifier/probes/partial-continue/partial-continue-probe.mjs. The original and
 * every historical capture under verifier/captures/partial-continue/ are
 * preserved untouched; this file diverges as documented below.
 *
 * WHY A COPY EXISTS
 *   partial run-5 preserved 1305 identical stored bytes, but its entry was the
 *   ch13-survey deep-link fixture, which seeds fault-reviewed/return-chosen and
 *   NOT story:ch13-origin-landed. The lawful Continue therefore resumed at the
 *   DEPARTURE body (`-1,-1:p1`), so run-5 could only ever show fixture-data
 *   preservation. earned-1/earned-2 tried ?story=ch13-return but their flights
 *   never reached Origin. handoff-standby/flight-1 (2026-09-06T16:03Z, this same
 *   frozen source dc63…36c and preview 38007) DID physically land and open the
 *   survey: story:ch13-origin-landed latched at 73 791 ms, beat ch13-survey,
 *   objective ch13:survey:start. That unblocks a PRIMARY earned entry.
 *
 *   PREPARATION ONLY. Nothing in this file has been executed against a browser.
 *   No result here is a capture, a verification or an acceptance.
 *
 * ACTUAL PARTIAL WorldSave / Continue TEST — bounded to ONE question:
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
 * LIFECYCLE UNDER TEST (all shipped code paths, one labelled entry fixture):
 *   0. PREFLIGHT WITH NO BROWSER: root role/readiness binding, an inherited
 *      exclusive heavy-lock receipt, the ACTUAL served index+bundle byte hashes,
 *      a dynamic re-hash of all 99 manifest source files, and a non-empty
 *      capture refusal. Any refusal stops before Chromium is launched.
 *   1. `?story=ch13-return&journeyprobe=1&debug=1&movie=1` — the INITIAL
 *      deep-link prerequisite fixture (labelled). It seeds the ch13-return entry
 *      only; it does NOT seed story:ch13-origin-landed and NOTHING here preseeds
 *      an origin landing. The shipped movie-scripted physical flight must earn
 *      it, and the earned-origin gate refuses everything downstream otherwise:
 *      real activePlanetId handoff, surface/fps control, grounded support, a
 *      measured live frame rate, the latched milestone, and NAMED signed-AV
 *      anchor history (never an object-key count).
 *   2. Earn the partial recording with actual shipped movement/[F] inputs, and
 *      CATCH the capture at the partial checkpoint — before the movie rail can
 *      carry the survey through offer/route-test.
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
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { ART, CAPTURES, RUN_DIR, REPO_ROOT, MAIN } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard, failureRecord } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from '../lib/sourceSnapshot.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
// PINNED bytes of the manual COMMON role's helper (see pinned/pin.json). The
// manual role may keep editing its own live file; this lane never reads it.
import {
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision, preflightDecision,
  identityVerdict, promptOffersF
} from './pinned/commonPassageLogic.pinned.mjs';
import {
  rehashSourceManifest, captureDirDecision, avReading, avAnchorDelta, replayVerdict,
  earnedOriginGate, checkpointPurity, worldIdentityVerdict, overwriteVerdict,
  newActionGate, newAnchorEligibility, continueBootDecision
} from './earnedContinueLogic.mjs';

// ------------------------------------------------------------------ args ---
const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : d;
};
const outName = arg('out', null);
const cliUrl = arg('url', null);
const expectSourceManifestSha = arg('expect-source-manifest', null);
const heavyLockPath = arg('heavy-lock', '/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock');
const heavyLockFdRaw = arg('heavy-lock-fd', null);
const heavyLockFd = heavyLockFdRaw === null ? null : Number(heavyLockFdRaw);
const role = arg('role', 'earned-continue');
const minSamples = Number(arg('min-samples', '4'));
const earnBudgetMs = Number(arg('earn-ms', '120000'));
const walkBudgetMs = Number(arg('walk-ms', '90000'));
const returnBudgetMs = Number(arg('return-ms', '180000'));
const fpsWindowMs = Number(arg('fps-ms', '2000'));
const minFps = Number(arg('min-fps', '15'));
// A NEW capture folder of this role's own; the partial-continue tree is never
// written into by this probe.
const outDir = resolve(CAPTURES, 'earned-continue', outName ?? 'unnamed');

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
  const fail = (m) => { console.error(`[earned-continue self-test] FAIL ${m}`); process.exit(1); };
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
  console.log('[earned-continue self-test] OK');
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
// NON-EMPTY CAPTURE REFUSAL first: prior evidence is never overwritten.
const capDecision = captureDirDecision({
  path: outDir,
  exists: existsSync(outDir),
  entries: existsSync(outDir) ? readdirSync(outDir) : []
});
if (!outName) throw new Error('--out <capture-name> is required (a unique run-local capture folder)');
if (!capDecision.ok) throw new Error(capDecision.problems.join('; '));
assertFreshOutputDir(outDir, { what: 'earned-continue' });
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

// ------------------------------------------------ PREFLIGHT (NO BROWSER) ---
// Nothing below may launch Chromium until every one of these binds. The shared
// heavy lock is NEVER opened here: an ALREADY-acquired exclusive flock must be
// inherited on --heavy-lock-fd (fd 9) by whoever invokes this command.
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const own = readJson(resolve(ART, 'preview-ownership.json'));
const control = readJson(resolve(RUN_DIR, 'verifier-control.json'));
const ready = readJson(resolve(RUN_DIR, 'verification-ready.json'));
const lockReceipt = heavyLockOwnership({ lockPath: heavyLockPath, fd: heavyLockFd, probeContention: false });
const previewUrl = cliUrl ?? null;
// ACTUAL SERVED BYTES, fetched before any browser exists: liveness and title are
// not current-build identity (CLAUDE.md port-takeover incident).
const served = previewUrl
  ? await fetchServedIdentity({ url: previewUrl, bundlePath: own.bundlePath ?? null })
  : null;
const previewBinding = previewBindingDecision({
  ownership: own, url: previewUrl, expectSourceManifestSha, served, requireBundle: true
});
// DYNAMIC source-manifest re-hash from the ACTUAL file bytes (before).
const sourceRehashBefore = rehashSourceManifest({
  manifestPath: resolve(RUN_DIR, 'implementation-source-manifest.json'),
  repoRoot: REPO_ROOT, expectManifestSha: expectSourceManifestSha, label: 'before'
});
const preflight = preflightDecision({
  ready, control, url: previewUrl, out: outName, heavyLock: lockReceipt,
  expectSourceManifestSha,
  liveSourceManifestSha: sourceRehashBefore.manifestSha256,
  previewBinding, role
});
// The CANONICAL CURRENT CONTRACT must still be the one runtime was declared
// ready against; a contract rotation mid-run invalidates the lane.
if (ready?.contractSha256 && control?.contractSha256 && ready.contractSha256 !== control.contractSha256) {
  preflight.launch = false;
  preflight.refusals.push(`contract sha rotated: ready ${ready.contractSha256} != control ${control.contractSha256}`);
}
if (!sourceRehashBefore.intact) {
  preflight.launch = false;
  preflight.refusals.push(`source tree is not intact at the frozen manifest: ${sourceRehashBefore.mismatches.length} mismatch(es), ${sourceRehashBefore.unreadable.length} unreadable`);
}
const preflightRecord = {
  role, url: previewUrl, expectSourceManifestSha,
  heavyLock: lockReceipt, previewBinding, served, sourceRehashBefore,
  captureDir: capDecision, controlAction: control?.action ?? null, controlActiveRole: control?.activeRole ?? null,
  readyContractSha256: ready?.contractSha256 ?? null, decision: preflight
};
writeFileSync(join(outDir, 'preflight.json'), `${JSON.stringify(preflightRecord, null, 2)}\n`);
if (!preflight.launch) {
  throw new Error(`PREFLIGHT-REFUSED (no browser was launched): ${preflight.refusals.join(' | ')}`);
}
if (own.state !== 'running') throw new Error(`root preview is not running (state=${own.state}); this probe never starts one`);
const previewRef = { url: own.url, stop() { /* ROOT owns this preview's lifetime */ } };

const sourceManifest = writeSourceSnapshot({
  entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
  note: 'Exact probe + library bytes of the EARNED return/Continue test (includes the pinned commonPassageLogic snapshot).'
});

// ------------------------------------------------------- page-side readers ---
const cgSnap = (page) => page.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return {
    beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, up: s.up,
    groundOffsetUnits: s.groundOffsetUnits ?? null,
    supported: s.supported, worldBound: s.worldBound, rail: s.rail, railCursor: s.railCursor,
    score: s.score, pendingAnchors: s.pendingAnchors,
    // NESTED diagnostic paths only. `s.anchors` does not exist on this bridge —
    // the flight lane's flat read returned null and measured nothing.
    anchors: s.diagnostic?.anchors ?? null,
    installWatch: s.diagnostic?.installWatch ?? null,
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

/**
 * NAMED signed-AV reading. `readState().av` is `state.signedSceneAv`, an OBJECT
 * of named fields — anchorId, anchorEvent, activationSequence,
 * activationHistoryAnchorIds. The flight lane recorded `Object.keys(av).length`
 * (a constant 7 for this bridge shape); that is not evidence and is only kept
 * here as `rawKeyCountIsNotEvidence`.
 */
const avOf = (st) => avReading(st?.av ?? null);

/** Live rendered frame rate, counted passively with rAF. Mutates nothing. */
const measureFps = (page, ms) => page.evaluate(async (windowMs) => {
  const t0 = performance.now();
  let frames = 0;
  await new Promise((done) => {
    const tick = () => {
      frames++;
      if (performance.now() - t0 >= windowMs) done();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const elapsed = performance.now() - t0;
  return { frames, elapsedMs: Math.round(elapsed), fps: Math.round((frames / elapsed) * 1000 * 10) / 10 };
}, ms);

/** The live systemFlight/spaceFlight identity of the body the runtime is on. */
const worldRead = (st) => ({
  activePlanetId: st?.system?.activePlanetId ?? null,
  locationMode: st?.system?.locationMode ?? null,
  pos: st?.system?.pos ?? null,
  speed: st?.system?.speed ?? null,
  controlMode: st?.spaceFlight?.controlMode ?? null,
  phase: st?.spaceFlight?.phase ?? null
});

// ------------------------------------------------------------------- main ---
const guard = createOwnedSessionGuard({ log: say, label: 'earned-continue' });
const report = {
  schema: 'paravoxia.verifier.earnedContinue.v1',
  probe: 'earned-continue-probe.mjs',
  copiedFrom: 'verifier/probes/partial-continue/partial-continue-probe.mjs',
  role,
  startedAt: new Date(t0).toISOString(),
  question: 'After a PHYSICALLY EARNED ch13 return and Origin landing, does an actual unfinished survey drawing survive the shipped save -> real landing-menu Continue lifecycle on the same world, and is a NEW physical action then accepted with its own named AV anchor?',
  preflight: preflightRecord,
  isAcceptance: false,
  isChapterVerification: false,
  preview: { url: own.url, bundlePath: own.bundlePath, bundleSha256: own.bundleSha256, indexSha256: own.indexSha256, sourceManifestSha256: own.sourceManifestSha256, ownedBy: own.owner },
  probeSource: snapshotRef(sourceManifest),
  prerequisiteFixtures: [], actualInteractions: [], phases: {}, findings: []
};

try {
  // ------------------------------------- PHASE 0: EARN the Origin landing ---
  say('PHASE 0 — boot ch13-return and PHYSICALLY EARN the Origin landing before any drawing or save');
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-return&journeyprobe=1&debug=1&movie=1',
    preview: previewRef, build: false, viewport: { width: 1280, height: 720 }, log: say
  }));
  const page = session.page;
  report.renderer = session.renderer;
  report.headed = session.headed;
  report.entryUrl = session.url;
  report.prerequisiteFixtures.push({
    what: 'INITIAL story deep link ?story=ch13-return',
    effect: 'seedForBeat marks the ch13-return entry milestones (fault-reviewed / return-chosen). It does NOT seed story:ch13-origin-landed, and this probe preseeds no origin landing: the landing must be physically flown.',
    label: 'prerequisite-fixture'
  });
  report.prerequisiteFixtures.push({
    what: 'movie=1 rail',
    effect: 'MOVIE-SCRIPTED PHYSICAL FLIGHT: the shipped ch13-return/ch13-survey rails drive the same virtual controls a player presses. Scripted input, never reported as a zero-rescue movie success.',
    label: 'scripted-input-journey'
  });
  report.prerequisiteFixtures.push({
    what: 'journeyprobe=1&debug=1',
    effect: 'Enables the shipped read-only journey bridge and the debug HUD readout. Telemetry only; no verb, pose, milestone or save is reachable through it.',
    label: 'read-only-telemetry-fixture'
  });
  say(`renderer=${session.renderer} headed=${session.headed}`);
  await waitReady(page, { timeoutMs: 120000 });

  // Browser-side identity, checked once the page exists (title/ANGLE/headed are
  // NOT current-build identity on their own; the served hashes above are).
  const bootUi = await uiProbe(page);
  report.identity = identityVerdict({
    title: bootUi.title, renderer: session.renderer, headed: session.headed,
    indexSha: served?.indexSha256 ?? null, expectIndexSha: own.indexSha256 ?? null, requireIndexSha: true
  });
  if (!report.identity.ok) throw new Error(`IDENTITY-REFUSED: ${report.identity.problems.join('; ')}`);

  const bootState = await readState(page);
  const bootWorld = worldRead(bootState);
  report.phases.boot = { world: bootWorld, beat: bootState?.beat ?? null, objectiveId: bootState?.objectiveId ?? null, av: avOf(bootState) };
  say(`boot: beat=${bootState?.beat} world=${JSON.stringify(bootWorld)}`);

  // Watch the shipped return ladder fly. Nothing is granted, nudged, seeded or
  // teleported; the loop only reads and records what actually fires.
  const ret0 = Date.now();
  const returnLadder = [];
  const avSeries = [];
  let originLanded = false;
  let lastSig = '';
  let rSt = bootState; let rCg = null;
  while (Date.now() - ret0 < returnBudgetMs) {
    rSt = await readState(page);
    rCg = await cgSnap(page);
    const av = avOf(rSt);
    avSeries.push({ atMs: Date.now() - ret0, beat: rSt?.beat ?? null, anchorId: av.anchorId,
      anchorEvent: av.anchorEvent, activationSequence: av.activationSequence, history: av.history,
      firedAnchors: rCg?.anchors ?? null, pendingAnchors: rCg?.pendingAnchors ?? null });
    const ms = rSt?.milestones ?? [];
    const sig = `${rSt?.beat}|${rSt?.objectiveId}|${(rCg?.anchors ?? []).join(',')}|${av.history.join(',')}`;
    if (sig !== lastSig) {
      lastSig = sig;
      returnLadder.push({ atMs: Date.now() - ret0, beat: rSt?.beat ?? null, objectiveId: rSt?.objectiveId ?? null,
        markerLabel: rSt?.markerLabel ?? null, world: worldRead(rSt), firedAnchors: rCg?.anchors ?? null,
        avAnchorId: av.anchorId, avSequence: av.activationSequence, avHistory: av.history,
        originLandedMilestone: ms.includes('story:ch13-origin-landed') });
      say(`  ladder: beat=${rSt?.beat} obj=${rSt?.objectiveId} world=${worldRead(rSt).activePlanetId} avAnchor=${av.anchorId} seq=${av.activationSequence}`);
    }
    emit({ phase: 'earn-return', cg: rCg, beat: rSt?.beat, objectiveId: rSt?.objectiveId, av, world: worldRead(rSt) });
    if (ms.includes('story:ch13-origin-landed')) { originLanded = true; break; }
    await sleep(750);
  }
  const returnMs = Date.now() - ret0;
  const landedState = await readState(page);
  const landedCg = await cgSnap(page);
  const fpsAtLanding = await measureFps(page, fpsWindowMs);
  const shotOrigin = await shot(page, '0000a-origin-landed.png');
  const gate = earnedOriginGate({
    originLandedMilestone: (landedState?.milestones ?? []).includes('story:ch13-origin-landed'),
    bootActivePlanetId: bootWorld.activePlanetId,
    landedActivePlanetId: worldRead(landedState).activePlanetId,
    locationMode: worldRead(landedState).locationMode,
    controlMode: worldRead(landedState).controlMode,
    supported: landedCg?.supported ?? null,
    bodyPose: landedCg?.bodyPose ?? null,
    fps: fpsAtLanding?.fps ?? null, minFps,
    av: landedState?.av ?? null,
    anchors: landedCg?.anchors ?? null
  });
  report.phases.earnedReturn = {
    lane: 'movie-scripted physical flight on the shipped ch13-return rail (scripted input, NOT a zero-rescue claim)',
    returnMs, originLanded, ladder: returnLadder, avSeries,
    fps: fpsAtLanding, cg: landedCg, world: worldRead(landedState),
    milestonesCh13: (landedState?.milestones ?? []).filter((m) => String(m).includes('ch13')),
    beat: landedState?.beat ?? null, objectiveId: landedState?.objectiveId ?? null,
    av: avOf(landedState), frame: shotOrigin, gate,
    note: 'story:ch13-origin-landed is EARNED here by the shipped board/launch/origin ladder. No milestone, pose, progress or save was seeded, forged or granted by this probe.'
  };
  say(`PHASE 0 after ${returnMs}ms: originLanded=${originLanded} world=${worldRead(landedState).activePlanetId} fps=${fpsAtLanding?.fps} gate.ok=${gate.ok}`);
  if (!gate.ok) {
    report.findings.push({ id: 'EC-ORIGIN-ENTRY-NOT-EARNED', detail: gate.problems.join('; '), measured: gate.measured, ladder: returnLadder });
    // FAILED PREREQUISITE STOPS HERE: no drawing, no save, no Continue, no [F].
    throw new Error(`earned Origin entry gate refused — see EC-ORIGIN-ENTRY-NOT-EARNED: ${gate.problems.join('; ')}`);
  }

  // ---------------------------------------------------------- PHASE 1: earn ---
  say('PHASE 1 — earn a real partial drawing on the EARNED Origin');
  const earn0 = Date.now();
  let cg = null; let st = null;
  let lastGrowthAt = Date.now(); let lastSamples = -1;
  let purity = null;
  while (Date.now() - earn0 < earnBudgetMs) {
    cg = await cgSnap(page);
    st = await readState(page);
    const avNow = avOf(st);
    emit({ phase: 'earn', cg, beat: st?.beat, objectiveId: st?.objectiveId, av: avNow });
    avSeries.push({ atMs: Date.now() - ret0, phase: 'earn', beat: st?.beat ?? null, anchorId: avNow.anchorId,
      anchorEvent: avNow.anchorEvent, activationSequence: avNow.activationSequence, history: avNow.history,
      firedAnchors: cg?.anchors ?? null, pendingAnchors: cg?.pendingAnchors ?? null });
    const n = cg?.survey?.samples ?? -1;
    if (n !== lastSamples) { lastSamples = n; lastGrowthAt = Date.now(); }
    // CATCH THE CAPTURE PROMPTLY: the movie rail must not carry the survey
    // through the offer/route-test before the partial checkpoint is saved.
    purity = checkpointPurity({ surveyPhase: cg?.survey?.phase ?? null, samples: n, minSamples,
      milestones: st?.milestones ?? [], firedAnchors: cg?.anchors ?? [] });
    if (purity.catchNow) { say(`catching capture at the partial checkpoint: ${purity.why}`); break; }
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
    world: worldRead(earnedState),
    fps: await measureFps(page, fpsWindowMs),
    checkpointPurity: checkpointPurity({ surveyPhase: cg?.survey?.phase ?? null, samples: cg?.survey?.samples ?? 0,
      minSamples, milestones: earnedState?.milestones ?? [], firedAnchors: cg?.anchors ?? [] }),
    reached: cg?.survey?.phase === 'drawing' && (cg?.survey?.samples ?? 0) >= minSamples
  };
  if (!report.phases.earn.reached) {
    report.findings.push({ id: 'EC-EARN-BLOCKED', detail: `did not reach a >=${minSamples}-sample drawing within ${earnBudgetMs}ms`, state: cg });
    throw new Error('partial drawing not earned — see report.findings EC-EARN-BLOCKED');
  }
  if (!report.phases.earn.checkpointPurity.pure) {
    report.findings.push({ id: 'EC-CHECKPOINT-IMPURE', detail: report.phases.earn.checkpointPurity.impure.join('; ') });
    throw new Error(`the rail ran past the partial checkpoint — ${report.phases.earn.checkpointPurity.impure.join('; ')}`);
  }

  // ------------------------------------------------- PHASE 2: shipped save ---
  say('PHASE 2 — save through the shipped autosave lifecycle (beforeunload -> doSave)');
  const preSaveStorage = await readStorage(page);
  report.phases.save = { beforeNavigation: { keys: preSaveStorage.keys, worldKeys: preSaveStorage.world.map((w) => w.key) } };
  for (const w of preSaveStorage.world) {
    writeFileSync(join(outDir, `worldsave-presave-${w.key.replace(/[^\w.-]/g, '_')}.json`), w.raw);
  }

  report.phases.save.liveWorldAtSave = worldRead(earnedState);
  report.phases.save.storageKeysBeforeNavigation = preSaveStorage.keys.map((k) => k.key);
  // NO story deep link on the Continue boot: re-seeding would destroy the very
  // state under test. Verified, not assumed.
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
  report.phases.save.originLandedMilestoneInSave = (globalParsed?.milestones ?? []).includes('story:ch13-origin-landed');
  // ACTUAL per-world and global bytes, copied out while the browser is still up.
  report.phases.save.globalBytes = savedStorage.global ? savedStorage.global.length : 0;
  report.phases.save.storageKeysAfterNavigation = savedStorage.keys.map((k) => k.key);
  report.phases.save.continueBoot = continueBootDecision({
    url: menuUrl,
    storageKeysBefore: report.phases.save.storageKeysBeforeNavigation,
    storageKeysAfter: report.phases.save.storageKeysAfterNavigation
  });
  say(`saved world blobs: ${JSON.stringify(report.phases.save.actualWorldSaves)}`);
  if (!saved.some((s) => s.hasCommonGround)) {
    report.findings.push({ id: 'EC-SAVE-NO-COMMONGROUND', detail: 'the shipped save wrote no commonGround blob for any world key after an earned partial drawing' });
  }
  if (!report.phases.save.continueBoot.ok) {
    report.findings.push({ id: 'EC-CONTINUE-BOOT-UNCLEAN', detail: report.phases.save.continueBoot.problems.join('; ') });
    throw new Error(`Continue boot is not clean: ${report.phases.save.continueBoot.problems.join('; ')}`);
  }
  if (!report.phases.save.originLandedMilestoneInSave) {
    report.findings.push({ id: 'EC-SAVE-MISSING-ORIGIN-LANDED', detail: 'the earned story:ch13-origin-landed milestone is absent from the ACTUAL global save bytes; a Continue from here could not lawfully resume on Origin' });
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
    report.findings.push({ id: 'EC-CONTINUE-NO-MENU', detail: 'no landing story CTA present on a plain boot', ui: menuUi });
    throw new Error('landing Continue CTA absent — see EC-CONTINUE-NO-MENU');
  }
  if (!/Continue/i.test(menuUi.landingCta ?? '')) {
    report.findings.push({ id: 'EC-CONTINUE-CTA-LABEL', detail: `landing CTA reads ${JSON.stringify(menuUi.landingCta)} after a real mid-chapter save; canContinueStory()/storyEntryPoint() did not see a resumable save`, subtitle: menuUi.landingSubtitle });
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
    report.findings.push({ id: 'EC-SAVE-OVERWRITTEN', detail: 'after Continue the persisted WorldSave no longer carries the earned samples; the empty live chapter state was written over the earned bytes' });
  }

  // ------------------------------------------- PHASE 4: survival + new act ---
  const before = report.phases.earn.cg.survey;
  const after = contCg?.survey ?? null;
  const savedPrimary = report.phases.save.actualWorldSaves.find((s) => s.hasCommonGround)
    ?? report.phases.save.actualWorldSaves[0] ?? {};
  const restoredPrimary = report.phases.continue.storageAfterContinue
    .find((w) => w.key === savedPrimary.key) ?? report.phases.continue.storageAfterContinue[0] ?? {};
  report.phases.survival = {
    beforeSave: before, afterContinue: after,
    samplesSurvived: after ? after.samples === before.samples : false,
    walkedUnitsSurvived: after ? Math.abs((after.walkedUnits ?? -1) - (before.walkedUnits ?? -2)) < 1e-6 : false,
    phaseAfterContinue: after?.phase ?? null,
    // WORLD / ACTOR / KEY-PREFIX identity, from live runtime fields AND the
    // actual stored bytes together — never a file-vs-file comparison alone.
    worldIdentity: worldIdentityVerdict({
      savedKey: savedPrimary.key ?? null, savedWorldId: savedPrimary.worldId ?? null, savedSeed: savedPrimary.seed ?? null,
      liveActivePlanetIdAtSave: report.phases.save.liveWorldAtSave?.activePlanetId ?? null,
      liveActivePlanetIdAfterContinue: worldRead(contSt).activePlanetId,
      restoredKey: restoredPrimary.key ?? null,
      restoredWorldId: savedPrimary.worldId ?? null, restoredSeed: savedPrimary.seed ?? null,
      earnedMilestones: report.phases.earn.milestones ?? [],
      restoredMilestones: contSt?.milestones ?? []
    }),
    overwrite: overwriteVerdict({
      savedSamples: report.phases.save.savedCommonGround?.survey?.working?.samples?.length ?? (before?.samples ?? 0),
      samplesOnDiskAfterContinue: restoredPrimary.savedSamples ?? null,
      savedSha256: savedPrimary.sha256 ?? null, shaAfterContinue: restoredPrimary.sha256 ?? null
    }),
    // NAMED anchors only. An empty restored history is not continuation proof.
    avReplayCheck: replayVerdict({
      earnedHistory: report.phases.earn.av.history ?? [],
      restoredHistory: avOf(contSt).history ?? [],
      restoredPendingAnchors: contCg?.pendingAnchors ?? [],
      installWatchBefore: report.phases.earn.cg?.installWatch ?? null,
      installWatchAfter: contCg?.installWatch ?? null
    }),
    avDeltaAcrossContinue: avAnchorDelta(report.phases.earn.av, avOf(contSt)),
    liveWorldAfterContinue: worldRead(contSt),
    fpsAfterContinue: await measureFps(page, fpsWindowMs)
  };
  for (const [id, v] of [['EC-WORLD-IDENTITY', report.phases.survival.worldIdentity],
    ['EC-SAVE-OVERWRITTEN', report.phases.survival.overwrite]]) {
    if (!v.ok) report.findings.push({ id, detail: v.problems.join('; ') });
  }
  if (!report.phases.survival.avReplayCheck.noReplay) {
    report.findings.push({ id: 'EC-AV-REPLAY', detail: `already-earned anchors re-activated after the restore: ${report.phases.survival.avReplayCheck.replayedAnchorIds.join(', ')}` });
  }

  report.phases.newAction = { attempted: false, reason: null };

  // The earned lane does NOT walk back to W. In this lane the Origin landing
  // was already physically earned and saved, so a lawful Continue must resume in
  // ch13-survey on the SAME body. Resuming anywhere else is the measurement, not
  // something to be walked around: it is recorded and the new action is refused.
  const surveyLive = contCg?.survey?.phase === 'drawing' && contSt?.beat === 'ch13-survey'
    && (contCg?.survey?.samples ?? 0) > 0;
  if (!surveyLive) {
    report.phases.newAction.reason = `the restored survey is not live and unfinished: beat=${contSt?.beat} survey=${JSON.stringify(contCg?.survey)}`;
    report.findings.push({ id: 'EC-CONTINUE-RESUME-POINT', detail: report.phases.newAction.reason });
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

    // The offer itself: the shipped [F] context interact. [F] is pressed ONLY
    // when the shipped primary prompt is literally offering it — no forced
    // click, no dispatched event, no direct verb call, no JS shortcut.
    const beforeOffer = await cgSnap(page);
    const beforeOfferState = await readState(page);
    const offersF = promptOffersF(beforeOfferState?.interactionPrompts ?? null);
    const gateNew = newActionGate({
      beat: contSt?.beat ?? null, surveyPhase: beforeOffer?.survey?.phase ?? null,
      restoredSamples: contCg?.survey?.samples ?? 0, prompts: beforeOfferState?.interactionPrompts ?? null,
      promptOffersF: offersF, arrived
    });
    report.phases.newAction.gate = gateNew;
    if (!gateNew.ok) {
      report.phases.newAction.reason = gateNew.problems.join('; ');
      report.findings.push({ id: 'EC-NEW-ACTION-NOT-OFFERED', detail: report.phases.newAction.reason });
      throw new Error(`the shipped new action is not available to press: ${report.phases.newAction.reason}`);
    }
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
      eligibility: newAnchorEligibility({
        anchorsBefore: beforeOffer?.anchors ?? [], anchorsAfter: afterOffer?.anchors ?? [],
        avBefore: beforeOfferState?.av ?? null, avAfter: afterOfferState?.av ?? null,
        surveyPhaseBefore: beforeOffer?.survey?.phase ?? null, surveyPhaseAfter: afterOffer?.survey?.phase ?? null
      }),
      accepted: (afterOffer?.survey?.phase && afterOffer.survey.phase !== 'drawing')
        || (afterOffer?.anchors ?? []).includes('anc.cg.route-offered'),
      frame: shotOffer
    };
    say(`offer result: phase ${beforeOffer?.survey?.phase} -> ${afterOffer?.survey?.phase}; route-offered anchor present=${(afterOffer?.anchors ?? []).includes('anc.cg.route-offered')}`);
    if (!report.phases.newAction.offer.accepted) {
      report.findings.push({ id: 'EC-NEW-ACTION-REFUSED', detail: 'the [F] span offer on restored state produced no phase change and no anc.cg.route-offered anchor', state: afterOffer });
    }
  }

  // PHASE 5 (secondary quit-to-menu) is DELETED in this copy: the parent probe
  // fell back to a Playwright FORCED click when the pause button was
  // intercepted, and a forced click is not a player action. The primary save
  // under test is the shipped beforeunload autosave in PHASE 2.
  report.phases.quitToMenu = { exercised: false, reason: 'removed: the parent probe\'s fallback used a forced click, which this lane forbids' };

  report.finishedAt = new Date().toISOString();
  report.cleanupPreFinally = guard.describe();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  report.failure = failureRecord({ probe: 'earned-continue-probe.mjs', error });
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(report.failure, null, 2)}\n`);
  say(`FAILED: ${String(error && error.message ? error.message : error)}`);
  process.exitCode = 1;
} finally {
  // OWNED SESSION ONLY. The root preview is never stopped by this probe.
  const receipt = await guard.stopOnce('finally');
  const post = guard.cleanupReceipt({ probe: 'earned-continue-probe.mjs' });
  // DYNAMIC source-manifest re-hash from the ACTUAL file bytes (after), so a
  // mid-capture source change can never be reported as a clean measurement.
  const sourceRehashAfter = rehashSourceManifest({
    manifestPath: resolve(RUN_DIR, 'implementation-source-manifest.json'),
    repoRoot: REPO_ROOT, expectManifestSha: expectSourceManifestSha, label: 'after'
  });
  writeFileSync(join(outDir, 'source-rehash.json'), `${JSON.stringify({
    before: sourceRehashBefore, after: sourceRehashAfter,
    stableAcrossCapture: sourceRehashBefore.manifestSha256 === sourceRehashAfter.manifestSha256
      && sourceRehashBefore.intact && sourceRehashAfter.intact
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'cleanup-receipt.json'), `${JSON.stringify({
    ...post, stopCall: receipt, rootPreviewUntouched: true, rootPreviewUrl: own.url,
    heavyLockOpenedByThisProbe: false, heavyLockInheritedFd: heavyLockFd,
    sourceStableAcrossCapture: sourceRehashBefore.manifestSha256 === sourceRehashAfter.manifestSha256
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'probe-log.txt'), `${log.join('\n')}\n`);
  // POST-FINALLY sweep: whatever the outcome, this process leaves no browser.
  say(`cleanup ${post.state}; source ${sourceRehashAfter.intact ? 'intact' : 'CHANGED'} after capture`);
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
}
