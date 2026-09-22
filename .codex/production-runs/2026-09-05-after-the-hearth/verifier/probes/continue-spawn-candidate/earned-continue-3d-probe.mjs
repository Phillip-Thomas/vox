#!/usr/bin/env node
/**
 * ============================ earned-continue-3d ============================
 * PRIVATE CONTINUATION COPY (PREPARED, NEVER YET RUN). Byte-copied from
 * verifier/probes/arrival-common-earned/earned-continue-probe.mjs, which is left
 * UNTOUCHED along with every capture under
 * verifier/captures/arrival-common-earned/. activeRole is
 * `earned-continue-3d-runtime`.
 *
 * TWO CHANGES, AND ONLY TWO:
 *
 * (A) THE STEERING WAS WRONG, NOT THE GAME. earned-1's walk phase calibrated the
 *     ordinary movement keys in a hard-coded XZ plane. After the real Continue
 *     the body sat on the +X cube face (live up = (0.99999999999984, 1.81e-07,
 *     -5.42e-07)) while the survey end E = [-42, 51.05, 12] lies on the +Y face.
 *     There A/D move the body in world Y, so their XZ displacement fell under the
 *     0.05 threshold and both were recorded as
 *     `calibratedKeyDirections.KeyA/KeyD = null`. With no lateral control the
 *     walk burned 144 bursts over 90 387 ms and finished 94.79 units from E.
 *     That is a probe defect. IT IS NOT EVIDENCE OF A GAME RESTORE FAILURE and
 *     nothing in this file treats it as one.
 *     The planar steering is replaced by real 3D local-tangent control
 *     (tangentSteering3d.mjs): target delta and measured key displacement are
 *     both projected onto the tangent plane of the LIVE published up, all three
 *     coordinates are tracked, arrival uses 3D distance, and the basis is
 *     recalibrated whenever the face/up changes. Audit-plane footing
 *     (`supported`, legitimately false off the audit plane) and actual physics
 *     grounding are reported SEPARATELY; the shipped bridge publishes no
 *     grounded flag, so that stays a declared gap. One bounded route attempt
 *     only: a measured stall stops with telemetry and never with a forced action.
 *
 * (B) THE PLAYER POSE WAS NEVER RETAINED. The pose is not inside the WorldSave:
 *     persistence.ts savePlayerPose/loadPlayerPose use a separate per-world key
 *     `pvx.v1.world.<worldId>.player`. earned-1 listed that key and its 171-byte
 *     length and kept no contents. poseObservation.mjs now retains the RAW BYTES
 *     at pre-navigation, post-beforeunload/menu boot, immediately before the
 *     Continue click, and after the real Continue — plus a PASSIVE CDP
 *     DOMStorage event stream across the real navigation, so a shipped-save
 *     write can be told apart from an early menu-boot overwrite WITHOUT
 *     monkeypatching localStorage and without changing any game value. If CDP
 *     DOMStorage does not attach, that is retained as an observation gap.
 *
 * EVERYTHING ELSE IS UNCHANGED: the earned Origin gate, checkpoint purity, the
 * actual WorldSave equality/actor/world/milestone/no-replay gates, the real
 * beforeunload save, the real landing Continue click with no deep link, no
 * reseed and no forced action. A restore alone is NOT a pass: `requiredGates`
 * additionally requires an ACTUAL accepted [F] action on the restored state.
 *
 * The XZ helpers `unit`/`chooseKey`/`projectedProgress` remain below ONLY so the
 * inherited `--self-test` keeps exercising the original bytes; the walk no
 * longer calls them, and `finalDistXZToE_diagnosticOnly` exists purely to keep
 * the earned-1 number comparable.
 * ===========================================================================
 *
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
 * ARRIVAL LANE COPY (2026-09-06). Byte-copied from
 * verifier/probes/earned-continue/, which was NOT edited. Differences:
 * activeRole is `arrival-common-earned`; the shared verifier helpers are PINNED
 * into this folder; `--out` must be an ABSOLUTE capture directory; the earned
 * Origin gate is TIGHTENED (exact signed Origin `-1,-1` plus
 * anc.cg.origin-landed in BOTH the named signed-AV activation history AND the
 * chapter fired-anchor history); and a PASSIVE entry observation (console/
 * pageerror, pointerlockchange/error, click isTrusted/pointerType/
 * sourceCapabilities/target/currentTarget, focus/touch/policy state) is
 * recorded. Continue still proves itself from ACTUAL save bytes, with no deep
 * reseed, a real new action and an explicit no-replay check.
 *
 * HISTORY QUALIFICATION (producer-earned-continue-prep-review.json,
 * "qualifications"): the WHY-A-COPY-EXISTS narrative above is INHERITED prose
 * from the original probe and its run-4 / run-5 attribution was NOT accepted by
 * the producer (run-5 retained 1305 bytes and lawfully resumed at the departure
 * body because the FIXTURE lacked origin-landed; a separate later repair fixed a
 * bootstrap overwrite). Nothing in this lane's assertions depends on that
 * narrative, and no claim here re-states it as established.
 *
 * UNEXECUTED CLI EXAMPLE — placeholders only. This command has NOT been run and
 * MUST NOT be copied verbatim: the old 38007 port and the old dc63fba… manifest
 * are examples of the SHAPE, never defaults. The runtime owner substitutes the
 * CURRENT root-published URL, source-manifest sha and served index/bundle hashes
 * (re-hashed at release, not remembered from preparation).
 *
 *   flock -x <ABS_HEAVY_LOCK_PATH> -c '\
 *     node verifier/probes/earned-continue-3d/earned-continue-3d-probe.mjs \
 *       --url <CURRENT_ROOT_PUBLISHED_URL> \
 *       --expect-source-manifest <CURRENT_SOURCE_MANIFEST_SHA256> \
 *       --heavy-lock <ABS_HEAVY_LOCK_PATH> --heavy-lock-fd <INHERITED_FD> \
 *       --role arrival-common-earned \
 *       --out <ABSOLUTE_FRESH_CAPTURE_DIR>'
 *
 *   CPU-only self-checks (no browser, no GPU):
 *     node verifier/probes/earned-continue-3d/selftest.mjs
 *     node verifier/probes/earned-continue-3d/earned-continue-3d-probe.mjs --self-test
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
 *      a dynamic re-hash of EVERY path the CURRENT
 *      root-published manifest lists (the count is whatever that manifest says
 *      at release; no historical file count is assumed here), and a non-empty
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
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
// PINNED copies of the shared verifier helpers (see pin.json in this folder).
// Other roles may edit verifier/probes/lib/* concurrently; this lane binds to
// bytes it owns. They sit at the SAME directory depth as the originals, so
// cgContract's RUN_DIR/REPO_ROOT/CAPTURES resolution is unchanged.
import { ART, CAPTURES, RUN_DIR, REPO_ROOT, MAIN } from './cgContract.pinned.mjs';
import { createOwnedSessionGuard, failureRecord } from './ownedSession.pinned.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from './sourceSnapshot.pinned.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
// PINNED bytes of the manual COMMON role's helper (see pinned/pin.json). The
// manual role may keep editing its own live file; this lane never reads it.
import {
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision, preflightDecision,
  identityVerdict, promptOffersF
} from './pinned/commonPassageLogic.pinned.mjs';
import {
  rehashSourceManifest, captureDirDecision, avReading, avAnchorDelta, replayVerdict,
  earnedOriginGate, SIGNED_ORIGIN_PLANET_ID, ORIGIN_LANDED_ANCHOR_ID,
  checkpointPurity, worldIdentityVerdict, overwriteVerdict,
  newActionGate, newAnchorEligibility, continueBootDecision
} from './earnedContinueLogic.mjs';
import {
  entryObserverSource, entryObserverReadSource, summariseClickObservation,
  entryObservationVerdict, attachPassivePageSinks
} from './entryObservation.mjs';
// NEW IN THIS COPY (see the 3D-STEERING REPAIR note in the header):
import {
  tangentBasis, faceLabel, basisStale, calibrationSample, chooseKey3d,
  burstProgress3d, stallVerdict, footingReading, dist3 as dist3d, unit3,
  // PRE-GPU CORRECTION (producer-earned-continue-3d-prep-review): ground
  // targets are decided on the published FOOT (bodyPose), not bodyCentre.
  groundFrame, groundTargetArrival, groundedActionGate
} from './tangentSteering3d.mjs';
import {
  SPAN_OFFER_CONTRACT, signedSpanOfferAuthorization, gateInputsFromAuthorization,
  recalibrationDecision, accumulateDirected, stampedCalibration, dirsFromEntries,
  faceChangeRetention,
  // PRE-GPU CORRECTION C4: bounded ordinary calibration, total dir clearing,
  // and a usable-key census over ALL live entries (not the last partial round).
  CALIBRATION_BOUNDS, applyRetainedDirs, usableEntryCensus,
  // PREFLIGHT FAULT 2: the directed path may not substitute a world up.
  liveUpReading, directedBurstMeasurement
} from './liveCalibration.mjs';
// PRE-GPU CORRECTIONS C1/C2/C3 (producer-continue-controller-wire-review.json).
import {
  spanOfferAcceptance, ROUTE_OFFERED_ANCHOR_ID,
  readContinueFrame, CONTINUE_FRAME_READER_SOURCE, CONTINUE_CAPTURE,
  isValidRuntimeReading, continueCaptureDecision, continueCaptureCompleteness,
  summariseContinueFrames,
  // PREFLIGHT FAULT 1/3: the ACTUAL failure-safe harvest the selftest drives.
  makeContinueSamplerHarvest
} from './continueClosure.mjs';
import {
  samplePoses, posesDiff, attachDomStorageObserver, classifyPoseWrites, spawnVsSavedPose
} from './poseObservation.mjs';

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
const ACTIVE_ROLE = 'continue-candidate-runtime';
const role = arg('role', ACTIVE_ROLE);
const minSamples = Number(arg('min-samples', '4'));
const earnBudgetMs = Number(arg('earn-ms', '120000'));
const walkBudgetMs = Number(arg('walk-ms', '90000'));
const returnBudgetMs = Number(arg('return-ms', '180000'));
const fpsWindowMs = Number(arg('fps-ms', '2000'));
const minFps = Number(arg('min-fps', '15'));
// A NEW capture folder of this role's own; the partial-continue tree is never
// written into by this probe.
// ABSOLUTE --out is REQUIRED (arrival lane): a bare capture NAME resolved
// silently against a helper-derived captures root, which is exactly the kind of
// implicit path that writes evidence where nobody looks. The operator now states
// the absolute directory; `CAPTURES` remains only as the documented convention.
if (outName !== null && !isAbsolute(outName)) {
  throw new Error(`--out must be an ABSOLUTE capture directory path; got ${outName} (convention: ${resolve(CAPTURES, 'earned-continue-3d', '<run-name>')})`);
}
const outDir = outName;

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
  const fail = (m) => { console.error(`[earned-continue-3d self-test] FAIL ${m}`); process.exit(1); };
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
  console.log('[earned-continue-3d self-test] OK');
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
  path: outDir ?? '(no --out)',
  exists: outDir ? existsSync(outDir) : false,
  entries: outDir && existsSync(outDir) ? readdirSync(outDir) : []
});
if (!outName) throw new Error('--out <capture-name> is required (a unique run-local capture folder)');
if (!capDecision.ok) throw new Error(capDecision.problems.join('; '));
assertFreshOutputDir(outDir, { what: 'earned-continue-3d' });
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
  const calibrations = [];
  let basisUp = null;
  let recalibrations = 0;
  // PER-KEY LIVE UP (liveCalibration). Each direction is stamped with the up
  // measured at ITS OWN post-burst snapshot — never a pre-round latch. This is
  // the measured fix for the 32.49deg within-round rotation that made the
  // whole-basis latch re-trigger calibration 21 times.
  const entries = {};
  let unitsSinceCalib = 0;

  // 3D CALIBRATION. The FULL displacement of each ordinary key is measured and
  // retained; usability is decided on the tangent magnitude in the LIVE local
  // frame, never on a hard-coded XZ pair. On the +X face this is exactly what
  // makes A/D a real, non-zero measurement instead of a dropped null.
  const runCalibration = async (why, onlyKeys = null) => {
    const s0 = await cgSnap(page);
    basisUp = s0?.up ?? null;
    const basis = basisUp ? tangentBasis(basisUp) : null;
    log(`calibrating (${why}) on face ${faceLabel(basisUp ?? [0, 0, 0])} up=${JSON.stringify(basisUp)}`);
    const round = { why, at: new Date().toISOString(), up: basisUp, face: faceLabel(basisUp ?? [0, 0, 0]), basis, keys: [] };
    // PARTIAL RECALIBRATION: only keys that actually went stale are re-measured.
    const keysThisRound = Array.isArray(onlyKeys) && onlyKeys.length ? onlyKeys : keys;
    round.keysRecalibrated = keysThisRound;
    for (const key of keysThisRound) {
      // GROUND FRAME: calibrate on the FOOT, the same frame the ground target
      // lives in. Centre displacement is retained beside it, and is only ever
      // read as equivalent when `up` did not move during the sample.
      // PER-KEY LIVE UP, BEFORE AND AFTER. The pre-burst up is recorded for the
      // frame-stability record only; DIRECTION and USABILITY are decided from
      // the key's own post-burst stamp below, never from the pre-round basis.
      const s_b = await cgSnap(page);
      const b = s_b?.bodyPose; const bCentre = s_b?.bodyCentre; const upBefore = s_b?.up ?? null;
      // C4: short ordinary press + controlled settle. 450+350 walked the body
      // several units per key across a curved face, which is what made the basis
      // stale inside its own round.
      await page.keyboard.down(key); await sleep(CALIBRATION_BOUNDS.pressMs);
      await page.keyboard.up(key); await sleep(CALIBRATION_BOUNDS.settleMs);
      const s_a = await cgSnap(page);
      const a = s_a?.bodyPose; const aCentre = s_a?.bodyCentre; const upAfter = s_a?.up ?? null;
      if (!b || !a) {
        const gap = { key, usable: false, reason: 'no published foot pose (bodyPose) at calibration; refusing to substitute bodyCentre' };
        dirs[key] = null; entries[key] = null;
        round.keys.push(gap); journey.push({ step: 'calibrate', ...gap });
        log(`calibrate ${key}: REFUSED — ${gap.reason}`);
        continue;
      }
      if (!upAfter) {
        // NO WORLD-UP GUESS. Without a published up there is no tangent plane and
        // therefore no measured direction; the key is cleared, not invented.
        const gap = { key, usable: false, upBefore, upAtSample: null,
          reason: 'no published up at this key\'s post-burst snapshot; refusing to substitute a world-up guess' };
        dirs[key] = null; entries[key] = null;
        round.keys.push(gap); journey.push({ step: 'calibrate', ...gap });
        log(`calibrate ${key}: REFUSED — ${gap.reason}`);
        continue;
      }
      const sample = calibrationSample({ key, from: b, to: a, up: upAfter });
      // Frame-consistency record: with up unchanged, foot and centre displace
      // identically. A divergence means the frames did NOT match for this sample.
      const upStable = upBefore ? !basisStale(upBefore, upAfter, { maxTiltDeg: 0.5 }).stale : null;
      sample.frame = 'foot (bodyPose)';
      sample.centreFrom = bCentre ? [...bCentre] : null;
      sample.centreTo = aCentre ? [...aCentre] : null;
      sample.centreMoved3dUnits = (bCentre && aCentre) ? dist3d(bCentre, aCentre) : null;
      sample.upStableDuringSample = upStable;
      sample.centreEquivalentToFootHere = upStable && sample.centreMoved3dUnits != null
        && Math.abs(sample.centreMoved3dUnits - sample.moved3dUnits) <= 1e-3;
      sample.groundFrameAfter = groundFrame({ bodyCentre: aCentre, bodyPose: a, up: upAfter, groundOffsetUnits: s_a?.groundOffsetUnits ?? null });
      // THE DECISION. Direction and usability both come from this key's own
      // post-burst stamp against its own live up — never from the pre-round
      // basis, which the prior round used to decide usability before rounding up.
      const stamped = stampedCalibration({ key, from: b, to: a, upAtSample: upAfter });
      entries[key] = stamped.usable ? stamped : null;
      sample.upBefore = upBefore;
      sample.upAtSample = upAfter;
      sample.stampedUsable = stamped.usable;
      sample.pressMs = CALIBRATION_BOUNDS.pressMs;
      sample.settleMs = CALIBRATION_BOUNDS.settleMs;
      sample.usabilityDecidedBy = 'per-key post-burst stamp (stampedCalibration.usable)';
      // CLEARED, not left stale, when this key is not usable now.
      dirs[key] = stamped.usable ? stamped.dir3d : null;
      round.keys.push(sample);
      journey.push({ step: 'calibrate', ...sample });
      log(`calibrate ${key}: 3d=${sample.moved3dUnits.toFixed(3)} tangent=${sample.movedTangentUnits.toFixed(3)} normal=${sample.movedNormalUnits.toFixed(3)} usable=${sample.stampedUsable} dir3d=${JSON.stringify(stamped.dir3d)}`);
    }
    unitsSinceCalib = 0;
    round.usableKeysThisRound = round.keys.filter((k) => k.stampedUsable).map((k) => k.key);
    // A/D MUST produce non-zero 3D motion. On +X they move in world Y; the old
    // XZ calibration recorded null and the walk then had no lateral control.
    //
    // C4: the LIVE census, over every stamped entry. A partial round that only
    // re-measured W says nothing about A/D, and the prior per-round count
    // reported "0 lateral keys usable" in exactly that case.
    round.census = usableEntryCensus(entries, keys);
    round.lateralKeysUsableLive = round.census.lateralUsableCount;
    round.lateralKeysUsableThisRoundOnly_diagnostic = round.keys.filter((k) => (k.key === 'KeyA' || k.key === 'KeyD') && k.stampedUsable).length;
    round.bounds = CALIBRATION_BOUNDS;
    calibrations.push(round);
    return round;
  };
  if (calibrate) await runCalibration('initial');

  const t = Date.now();
  let cur = await cgSnap(page);
  let bursts = 0; let stopReason = 'budget-exhausted';
  const progressWindow = [];
  let stall = null;
  while (Date.now() - t < budgetMs) {
    if (stopWhen && await stopWhen(cur)) { stopReason = 'stop-condition'; break; }
    // FULL 3D distance on the FOOT — the frame the ground target lives in.
    // No coordinate is dropped and the radius is unchanged.
    const arrivalNow = groundTargetArrival({
      bodyCentre: cur.bodyCentre, bodyPose: cur.bodyPose, up: cur.up,
      groundOffsetUnits: cur.groundOffsetUnits, target, arriveUnits
    });
    if (!arrivalNow.usable) {
      stopReason = 'no-foot-pose (bodyPose unpublished; refusing to steer a ground target from bodyCentre)';
      journey.push({ step: 'no-foot-pose', burst: bursts, arrival: arrivalNow });
      break;
    }
    const dTo = arrivalNow.distFootToTarget;
    if (arrivalNow.arrived) { stopReason = 'arrived'; break; }
    if (minDistToTarget && dTo <= minDistToTarget) { stopReason = 'hold-off-distance'; break; }
    // FACE/UP CHANGE. Decided by liveCalibration.recalibrationDecision on the
    // PER-KEY stamps plus a meaningful-directed-motion guard and a hard cap —
    // not by a single pre-round whole-basis latch. Retained directions that
    // still project usably into the CURRENT plane keep steering.
    // PREFLIGHT FAULT 2. An ACTUAL published live up is REQUIRED here. There is
    // no `?? [0, 1, 0]` any more: without a real reading the key calibration is
    // CLEARED, the round is recorded as UNMEASURED and the route attempt stops
    // rather than inferring anything in a guessed frame.
    const upNow = liveUpReading(cur.up);
    if (!upNow.valid) {
      const clearedKeys = keys.filter((k) => entries[k] || dirs[k]);
      for (const k of keys) { delete entries[k]; dirs[k] = null; }
      stopReason = `no-live-up (${upNow.reason}); key calibration cleared, burst UNMEASURED, refusing to infer progress or direction from a world-up guess`;
      journey.push({ step: 'unmeasured-no-live-up', burst: bursts, when: 'before-burst',
        upReading: upNow, clearedKeys, census: usableEntryCensus(entries, keys),
        measured: false, unmeasured: true, inferenceRefused: true });
      break;
    }
    const staleness = basisStale(basisUp ?? upNow.up, upNow.up);
    const retention = faceChangeRetention(entries, upNow.up);
    const decision = recalibrationDecision({
      entries, currentUp: upNow.up,
      unitsSinceLastCalibration: unitsSinceCalib,
      calibrationsSoFar: calibrations.length
    });
    journey.push({ step: 'calibration-decision', burst: bursts, decision, retention, latchWouldHaveFired: staleness.stale, unitsSinceCalib });
    if (decision.recalibrate) {
      recalibrations++;
      log(`recalibrating (${decision.reason}) keys=${decision.keys.join(',')} after ${unitsSinceCalib.toFixed(2)}u directed motion`);
      await runCalibration(`face-change-${recalibrations}`, decision.keys);
      cur = await cgSnap(page);
      continue;
    }
    // Steer on the RETAINED stamped directions that still project usably now.
    // TOTAL assignment: a key that is no longer usable is CLEARED, not left
    // holding a stale direction for chooseKey3d to pick.
    const retainedDirs = dirsFromEntries(entries);
    const applied = applyRetainedDirs(dirs, entries, keys);
    if (applied.cleared.length) journey.push({ step: 'dirs-cleared', burst: bursts, keys: applied.cleared, census: usableEntryCensus(entries, keys) });
    // Steer from the FOOT toward the ground target: same frame as arrival.
    const foot = cur.bodyPose;
    const want = [target[0] - foot[0], target[1] - foot[1], target[2] - foot[2]];
    const pick = chooseKey3d(dirs, want, upNow.up);
    if (!pick.key) {
      stopReason = `no-usable-key (${pick.reason})`;
      journey.push({ step: 'no-key', burst: bursts, pick, up: cur.up, face: upNow.face });
      break;
    }
    const b = foot;                 // FOOT before the burst
    const bCentre = cur.bodyCentre; // centre retained separately, never gated on
    // Adaptive ordinary pulse: shorter presses when the foot is already close to
    // the ground target, so the last approach is not overshot. This is an
    // ordinary key press of ordinary duration — no sub-frame control, no
    // geometry change, no injected key state.
    const pulseMs = dTo < 3 ? 120 : (dTo < 8 ? 220 : 400);
    await page.keyboard.down(pick.key); await sleep(pulseMs); await page.keyboard.up(pick.key); await sleep(220);
    cur = await cgSnap(page);
    if (!cur?.bodyPose) {
      stopReason = 'no-foot-pose-after-burst (bodyPose unpublished)';
      journey.push({ step: 'no-foot-pose', burst: bursts, after: true });
      break;
    }
    // PREFLIGHT FAULT 2, post-burst half. The up used for progress, for the
    // re-measurement and for the restamp is the ACTUAL live reading taken after
    // this burst. Missing/invalid => UNMEASURED: the pressed key's stamp AND
    // direction are cleared and the attempt stops. A restamp that fails also
    // clears the key, so a stale usable direction can never survive it.
    const upAfter = liveUpReading(cur.up);
    const measurement = directedBurstMeasurement({
      key: pick.key, from: b, to: cur.bodyPose, upReading: upAfter, previousEntry: entries[pick.key]
    });
    if (measurement.clearKey) { delete entries[pick.key]; dirs[pick.key] = null; }
    if (measurement.unmeasured) {
      stopReason = `unmeasured-burst-no-live-up (${upAfter.reason}); ${pick.key} calibration cleared, refusing to infer progress from a world-up guess`;
      journey.push({ step: 'unmeasured-no-live-up', burst: bursts, when: 'after-burst', key: pick.key,
        from: b, to: cur.bodyPose, upReading: upAfter, measurement,
        census: usableEntryCensus(entries, keys),
        measured: false, unmeasured: true, inferenceRefused: true });
      // REAL displacement is still accumulated; only the FRAME-DEPENDENT
      // inference is refused.
      unitsSinceCalib = accumulateDirected(unitsSinceCalib, b, cur.bodyPose);
      break;
    }
    const proj = burstProgress3d({ from: b, to: cur.bodyPose, target, up: upAfter.up });
    const movedSample = measurement.stamp?.sample ?? null;
    if (measurement.usable) dirs[pick.key] = measurement.dir3d;
    // REAL foot displacement only; no motion is invented.
    unitsSinceCalib = accumulateDirected(unitsSinceCalib, b, cur.bodyPose);
    const restamp = measurement.entry ?? measurement.stamp ?? null;
    if (measurement.usable) entries[pick.key] = measurement.entry;
    bursts++;
    progressWindow.push(proj);
    const footing = footingReading({ auditSupported: cur.supported ?? null, up: cur.up ?? null });
    journey.push({ step: 'walk', burst: bursts, key: pick.key, keyScore: pick.score,
      frame: 'foot (bodyPose)', pulseMs,
      from: b, to: cur.bodyPose,
      centreFrom: bCentre, centreTo: cur.bodyCentre,
      up: cur.up, face: upAfter.face, upReading: upAfter,
      measurement: { measured: measurement.measured, usable: measurement.usable, clearKey: measurement.clearKey, reason: measurement.reason },
      restampUsable: restamp?.usable === true, movedTangentUnits: movedSample?.movedTangentUnits ?? null,
      census: usableEntryCensus(entries, keys),
      dist3dToTarget: dist3d(cur.bodyPose, target),
      distCentreToTarget_diagnosticOnly: dist3d(cur.bodyCentre, target),
      groundFrame: groundFrame({ bodyCentre: cur.bodyCentre, bodyPose: cur.bodyPose, up: cur.up, groundOffsetUnits: cur.groundOffsetUnits }),
      alongLeg: proj.alongLeg, lateral: proj.lateral, normal: proj.normal,
      grossTangent: proj.grossTangent, gross3d: proj.gross3d,
      footing, samples: cur.survey?.samples, walked: cur.survey?.walkedUnits });
    // ONE bounded route attempt: a measured stall STOPS with telemetry. It is
    // never answered by a forced action, a setter or a larger timeout.
    stall = stallVerdict(progressWindow);
    if (stall.stalled) {
      stopReason = `stalled: ${stall.reason}`;
      journey.push({ step: 'stall', burst: bursts, ...stall });
      log(`STOPPING on measured stall after ${bursts} bursts: ${stall.reason} (alongSum=${stall.alongSum.toFixed(3)} lateralSum=${stall.lateralSum.toFixed(3)} dist3dGain=${stall.dist3dGain.toFixed(3)})`);
      break;
    }
    if (bursts % 8 === 0) log(`burst ${bursts}: foot=${cur.bodyPose.map((n) => n.toFixed(2))} centre=${cur.bodyCentre.map((n) => n.toFixed(2))} face=${faceLabel(cur.up ?? [0, 1, 0])} dist3dFoot=${dist3d(cur.bodyPose, target).toFixed(2)} samples=${cur.survey?.samples}`);
  }
  return { journey, dirs, bursts, stopReason, ms: Date.now() - t, final: cur,
    calibrations, recalibrations, stall,
    // LIVE usable-key census at the end of the walk, over every stamped entry.
    census: usableEntryCensus(entries, keys),
    calibrationBounds: CALIBRATION_BOUNDS,
    lastFace: faceLabel(cur?.up ?? [0, 1, 0]),
    arriveUnits,
    finalDist3d: cur?.bodyPose ? dist3d(cur.bodyPose, target) : null,
    finalGroundFrame: groundFrame({ bodyCentre: cur?.bodyCentre ?? null, bodyPose: cur?.bodyPose ?? null, up: cur?.up ?? null, groundOffsetUnits: cur?.groundOffsetUnits ?? null }),
    finalDist3dCentre_diagnosticOnly: cur?.bodyCentre ? dist3d(cur.bodyCentre, target) : null,
    steering: 'real 3D local-tangent control from the live published up (tangentSteering3d.mjs); the earned-1 XZ calibration is NOT used',
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
const guard = createOwnedSessionGuard({ log: say, label: 'earned-continue-3d' });
const report = {
  schema: 'paravoxia.verifier.earnedContinue.v1',
  probe: 'earned-continue-3d-probe.mjs',
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
  // PASSIVE entry observation (arrival lane). Sinks are attached before ready so
  // anything emitted during boot is captured. This lane's entry is the shipped
  // movie rail, not a click, but pointer-lock/console/pageerror facts are still
  // recorded so a future entry refusal records its own native reason instead of
  // being inferred. Nothing requests pointer lock, forces a click, patches a
  // handler, injects key state or edits focus/permission policy.
  const pageSinks = attachPassivePageSinks(page, { max: 400 });
  // PASSIVE CDP DOMStorage observation, attached BEFORE anything is saved so the
  // whole lifecycle is ordered in one stream. It reads browser-side events and
  // writes nothing: no game value is changed and localStorage is NOT patched.
  // Unavailability is retained as a declared gap, never worked around.
  const domStorage = await attachDomStorageObserver(page, { say });
  report.observation = {
    domStorage: { available: domStorage.available, error: domStorage.error,
      method: 'CDP DOMStorage.enable + domStorageItemAdded/Updated/Removed/Cleared',
      gap: domStorage.available ? null : 'CDP DOMStorage did not attach; save-write vs early-menu-overwrite ordering is NOT observed on this run' }
  };
  let observerInstall = null;
  try { observerInstall = await page.evaluate(entryObserverSource()); }
  catch (e) { observerInstall = { installed: false, error: String(e?.message ?? e) }; }
  emit({ phase: 'entry-observer-install', observerInstall });
  const readEntryObservation = async (label) => {
    let obs;
    try {
      const raw = await page.evaluate(entryObserverReadSource());
      obs = {
        label, installed: raw?.installed ?? false,
        clicks: (raw?.clicks ?? []).map(summariseClickObservation),
        pointerLockChanges: raw?.pointerLockChanges ?? [],
        pointerLockErrors: raw?.pointerLockErrors ?? [],
        focusState: raw?.focusState ?? null, touchState: raw?.touchState ?? null,
        policyState: raw?.policyState ?? null,
        consoleWarnings: pageSinks.consoleWarnings, consoleErrors: pageSinks.consoleErrors,
        pageErrors: pageSinks.pageErrors, consoleDropped: pageSinks.dropped
      };
      obs.verdict = entryObservationVerdict(obs);
    } catch (e) {
      obs = { label, installed: false, readError: String(e?.message ?? e),
        note: 'entry observation FAILED TO READ: click/lock metadata is UNMEASURED for this session' };
    }
    emit({ phase: 'entry-observation', ...obs });
    return obs;
  };
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
  report.entryObservation = await readEntryObservation('after-ready');
  say(`entry observation: ${JSON.stringify(report.entryObservation.verdict ?? report.entryObservation)}`);

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
    anchors: landedCg?.anchors ?? null,
    // TIGHTENED: the EXACT signed Origin body, and the named landing anchor in
    // BOTH the signed-AV named history AND the chapter's fired-anchor history.
    requireOriginPlanetId: SIGNED_ORIGIN_PLANET_ID,
    requireOriginLandedAnchor: ORIGIN_LANDED_ANCHOR_ID
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
  // SEPARATE PER-WORLD PLAYER POSE. earned-1 listed this key and its length only.
  // Here the RAW BYTES are retained at every lifecycle point.
  const poseBeforeNavigation = await samplePoses(page, 'before-navigation');
  writeFileSync(join(outDir, 'playerpose-before-navigation.json'), `${JSON.stringify(poseBeforeNavigation, null, 2)}\n`);
  say(`player pose keys before navigation: ${JSON.stringify(poseBeforeNavigation.poses.map((p) => ({ key: p.key, bytes: p.bytes, pos: p.pos })))}`);
  domStorage.mark('pre-navigation-save');
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

  domStorage.mark('menu-boot');
  // POSE AFTER the shipped beforeunload save and the menu boot. Any difference
  // from the pre-navigation bytes is what the ordered CDP stream then places in
  // time (shipped save write vs an early menu-boot overwrite).
  const poseAfterBeforeunload = await samplePoses(page, 'after-beforeunload-and-menu-boot');
  writeFileSync(join(outDir, 'playerpose-after-beforeunload-menu-boot.json'), `${JSON.stringify(poseAfterBeforeunload, null, 2)}\n`);
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
  // Pose bytes as they stand at the LAST moment before the real Continue click:
  // anything written between the menu boot and here is a menu-side write.
  const poseAtMenuBeforeContinue = await samplePoses(page, 'menu-immediately-before-continue-click');
  writeFileSync(join(outDir, 'playerpose-menu-before-continue.json'), `${JSON.stringify(poseAtMenuBeforeContinue, null, 2)}\n`);
  // ---- PRODUCER PREFLIGHT FAULT 1 -----------------------------------------
  // The cleanup/harvest callable is DEFINED HERE, BEFORE the sampler is
  // installed and before the click, so that ANY throw from the install, the
  // click or the first post-click read still reaches a real function from the
  // outer `finally`. Previously the assignment sat AFTER the wait loop, so a
  // throw in that region left the hoisted `var` undefined, the `finally`
  // skipped the harvest entirely, the captured frames were lost and the page
  // kept a live rAF sampler installed.
  //
  // Every observation this closure reads (first valid ms, poll ms, stop reason,
  // decision) is declared BEFORE it too, so no read can hit a temporal dead
  // zone. Cleanup (stop + delete) is attempted on EVERY path, including when
  // the harvest read itself throws, and an empty/failed harvest is recorded as
  // such — never as a successful-looking capture.
  var contCg = null; var contSt = null; var contUi = null;
  var firstValidRuntimeMs = null;      // ms since the click, from the poll loop
  var lastPollMsSinceClick = 0;
  var captureDecision = null;
  var captureStopReason = null;
  var harvestedContinueTelemetry = null;
  var harvestContinueSampler = makeContinueSamplerHarvest({
    page,
    observations: () => ({
      firstValidRuntimeMs, lastPollMsSinceClick, captureStopReason, captureDecision
    }),
    onTelemetry: (tel) => {
      try {
        writeFileSync(join(outDir, 'continue-raf-telemetry.json'), `${JSON.stringify(tel, null, 2)}\n`);
      } catch { /* the summary copy in report still carries it */ }
    }
  });
  // ---- PASSIVE per-rAF Continue telemetry, ARMED BEFORE THE CLICK ----------
  // READ-ONLY COPIES of hooks that ALREADY EXIST in the shipped build:
  //   window.__storyBeat            (evidence.mjs pageReadState:111)
  //   window.__paravoxiaCommonGround.snapshot()  (cgSnap:364)
  //   window.__voxelDebug.spawn.{terrainSeed,playerRequested}
  //                                (EfficientScene.tsx:302-313)
  // No setter, no forced world switch, no physics stop, no waitReady while the
  // menu is up. Missing values are retained as null, never back-filled.
  //
  // C2: the per-frame reader is the ACTUAL exported `readContinueFrame` source
  // from continueClosure.mjs, injected verbatim, so the CPU selftest exercises
  // the same function the page runs. `window.__paravoxiaSystem` was a GUESS and
  // is gone: activePlanetId/renderOrigin come from the real journey probe
  // (evidence.mjs:126-140). `worldBound` is a separate boolean and is never
  // reported as a render origin.
  await page.evaluate(({ readerSource, maxFrames }) => {
    const w = window;
    if (w.__voxContinueSampler) return;
    const readFrame = (0, eval)(`(${readerSource})`);
    const rec = {
      t0: performance.now(), frames: [], stopped: false, cap: maxFrames,
      capHit: false, clickMs: null, installError: null, frameErrors: 0
    };
    w.__voxContinueSampler = rec;
    const tick = () => {
      if (rec.stopped) return;
      const ms = Math.round(performance.now() - rec.t0);
      try {
        const fr = readFrame(w, ms);
        if (fr && fr.error != null) rec.frameErrors++;
        rec.frames.push(fr);
      } catch (e) {
        // PER-FRAME catch: the error is RECORDED on a real frame. No missing
        // field is back-filled and no frame is silently lost.
        rec.frameErrors++;
        rec.frames.push({ ms, error: String(e && e.message ? e.message : e).slice(0, 200) });
      }
      if (rec.frames.length < rec.cap) requestAnimationFrame(tick);
      else { rec.capHit = true; rec.stopped = true; }
    };
    requestAnimationFrame(tick);
  }, { readerSource: CONTINUE_FRAME_READER_SOURCE, maxFrames: CONTINUE_CAPTURE.maxFrames });
  report.phases.continue.telemetryArmed = {
    armedBeforeClick: true, mode: 'passive per-rAF copies of existing hooks',
    hooks: ['window.__storyBeat', 'window.__paravoxiaJourneyProbe.snapshot().state.systemFlight (evidence.mjs:126-140)',
      'window.__paravoxiaCommonGround.snapshot()', 'window.__voxelDebug.spawn'],
    readerRef: 'continueClosure.readContinueFrame (source injected verbatim; same function the CPU selftest calls)',
    removedGuessedHook: 'window.__paravoxiaSystem (never published by the shipped build)',
    window: CONTINUE_CAPTURE,
    forbidden: 'no setters, no forced world switch, no physics stop, no waitReady while the menu is up'
  };
  domStorage.mark('continue-click');
  await page.click('button[aria-describedby="landing-story-subtitle"]');
  report.phases.continue.uiActions.push({ action: 'click', selector: 'button[aria-describedby="landing-story-subtitle"]', label: menuUi.landingCta, shippedPath: 'LandingMenu.startOrContinueStory -> beginStory() -> storyEntryPoint()' });
  report.actualInteractions.push({ what: 'clicked the real landing Continue button', label: 'actual-continue-ui' });

  const cont0 = Date.now();
  // Stamp the click INSIDE the sampler's own clock, so pre-click frames stay
  // identifiable (and retained) instead of being discarded.
  await page.evaluate(() => {
    const r = window.__voxContinueSampler;
    if (r && r.clickMs == null) r.clickMs = Math.round(performance.now() - r.t0);
  });
  //
  // C3: the Continue WAIT budget is unchanged at 60 s. What changed is that the
  // first valid runtime reading no longer ENDS the observation: capture is held
  // for at least CONTINUE_CAPTURE.holdAfterFirstValidMs past it (the observed
  // pose change landed ~1 s later), bounded by maxWindowMs. Nothing is filtered
  // at harvest, so a late mount cannot lose its own frames.
  while (true) {
    const msSinceClick = Date.now() - cont0;
    lastPollMsSinceClick = msSinceClick;
    contCg = await cgSnap(page);
    contSt = await readState(page);
    contUi = await uiProbe(page);
    emit({ phase: 'continue', cg: contCg, beat: contSt?.beat, objectiveId: contSt?.objectiveId, av: avOf(contSt), menuPresent: contUi.landingMenuPresent });
    const validNow = isValidRuntimeReading({
      frame: { cgFoot: contCg?.bodyPose ?? null },
      hudPresent: contUi.hudPresent === true, menuPresent: contUi.landingMenuPresent === true
    });
    if (validNow && firstValidRuntimeMs == null) {
      firstValidRuntimeMs = msSinceClick;
      say(`first valid runtime reading (published foot + HUD, no menu) at ${msSinceClick}ms since the Continue click; holding capture ${CONTINUE_CAPTURE.holdAfterFirstValidMs}ms beyond it`);
    }
    if (firstValidRuntimeMs == null && msSinceClick >= CONTINUE_CAPTURE.continueWaitBudgetMs) {
      captureStopReason = 'continue-wait-budget-exhausted (60s, unchanged) with no valid runtime foot+HUD reading';
      break;
    }
    captureDecision = continueCaptureDecision({ msSinceClick, firstValidRuntimeMs });
    if (!captureDecision.keepCapturing) { captureStopReason = captureDecision.reason; break; }
    await sleep(500);
  }
  //
  // Harvest + CLEAN UP the sampler. The callable and every observation it
  // reads were DEFINED BEFORE the install/click (preflight fault 1), so the
  // outer `finally` reaches it even when the click or the first post-click read
  // throws. It is idempotent: the first harvest wins.
  const continueTelemetry = await harvestContinueSampler('continue-capture-window-closed');
  report.phases.continue.telemetry = continueTelemetry;
  report.phases.continue.telemetryCleanedUp = continueTelemetry.cleanedUp;
  if (!continueTelemetry.completeness.complete) {
    report.findings.push({ id: 'EC-CONTINUE-TELEMETRY-INCOMPLETE',
      detail: continueTelemetry.completeness.reason, window: continueTelemetry.window });
  }
  say(`continue telemetry: ${continueTelemetry.summary.frameCount} rAF frames retained (${continueTelemetry.completeness.verdict}), firstFoot=${continueTelemetry.summary.firstFootMs}ms firstFootChange=${continueTelemetry.summary.firstFootChangeMs}ms, beat values ${JSON.stringify(continueTelemetry.summary.transitions.beat)}, planet values ${JSON.stringify(continueTelemetry.summary.transitions.activePlanetId)}`);

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

  // ---- POSE EVIDENCE ACROSS THE WHOLE LIFECYCLE (the earned-1 gap) --------
  const poseAfterContinue = await samplePoses(page, 'after-real-continue');
  writeFileSync(join(outDir, 'playerpose-after-continue.json'), `${JSON.stringify(poseAfterContinue, null, 2)}\n`);
  const poseWrites = classifyPoseWrites(domStorage.events, {
    saveMark: 'pre-navigation-save', menuBootMark: 'menu-boot', continueMark: 'continue-click'
  });
  writeFileSync(join(outDir, 'domstorage-events.json'), `${JSON.stringify({
    available: domStorage.available, error: domStorage.error, events: domStorage.events
  }, null, 2)}\n`);
  const savedPosePrimary = poseBeforeNavigation.poses.find((p) => p.key === 'pvx.v1.world.-1,-1.player')
    ?? poseAfterBeforeunload.poses.find((p) => p.key === 'pvx.v1.world.-1,-1.player') ?? null;
  report.phases.pose = {
    key: 'pvx.v1.world.<worldId>.player',
    shippedPath: 'persistence.ts savePlayerPose/loadPlayerPose (a SEPARATE key; the WorldSave blob carries no pose)',
    beforeNavigation: poseBeforeNavigation,
    afterBeforeunloadAndMenuBoot: poseAfterBeforeunload,
    menuBeforeContinueClick: poseAtMenuBeforeContinue,
    afterContinue: poseAfterContinue,
    diffSaveToMenuBoot: posesDiff(poseBeforeNavigation, poseAfterBeforeunload),
    diffMenuBootToBeforeClick: posesDiff(poseAfterBeforeunload, poseAtMenuBeforeContinue),
    diffBeforeClickToAfterContinue: posesDiff(poseAtMenuBeforeContinue, poseAfterContinue),
    domStorageWrites: poseWrites,
    // WHICH SPAWN BRANCH? Only the RESULT is measurable from outside; the branch
    // itself stays a declared gap and no source change is proposed here.
    spawnComparison: spawnVsSavedPose({
      savedPose: savedPosePrimary?.pos ?? null,
      observedBodyPose: contCg?.bodyPose ?? null,
      arrivalFallbackPose: null
    }),
    observationGaps: [
      domStorage.available ? null : 'CDP DOMStorage unavailable: write ORDER (shipped save vs early menu overwrite) not observed',
      'EfficientScene.tsx publishes no marker for resumeIsSafe / findValidSpawnSite / arrivalPose; the validation-fallback BRANCH remains unobserved',
      'the shipped commonGround bridge publishes no physics grounded flag; only audit-plane `supported` is available'
    ].filter(Boolean)
  };
  if (poseWrites.overwriteBeforeContinue) {
    report.findings.push({ id: 'EC3D-POSE-WRITE-BEFORE-CONTINUE',
      detail: 'a pose-key write with a CHANGED value landed in the menu-boot window, before the Continue click; the ordered CDP events are retained verbatim and no cause is asserted',
      writes: poseWrites.writes.filter((w) => w.window === 'menu-boot BEFORE the Continue click') });
  }

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
    say(`walk finished in ${walk.ms}ms after ${walk.bursts} bursts (${walk.stopReason}): dist3dFootToE=${cur?.bodyPose ? dist3d(cur.bodyPose, E).toFixed(3) : 'NO-FOOT-POSE'} (centre ${cur?.bodyCentre ? dist3d(cur.bodyCentre, E).toFixed(3) : 'n/a'}, diagnostic only) face=${walk.lastFace} arrived=${arrived}`);
    for (const j of walk.journey) emit({ phase: 'walk-to-E', ...j });
    const shotAtE = await shot(page, '0004-at-survey-end.png');
    const atE = await readState(page);
    report.phases.newAction.walk = {
      label: walk.label, target: E, bursts: walk.bursts, walkMs: walk.ms, stopReason: walk.stopReason,
      arrived,
      // E is a GROUND target. Arrival is the FOOT. bodyCentre sits ~1.8u along
      // the live up and is retained separately, never gated on.
      finalFoot: cur.bodyPose ?? null,
      finalDist3dToE: cur.bodyPose ? dist3d(cur.bodyPose, E) : null,
      finalBodyCentre: cur.bodyCentre,
      finalGroundFrame: walk.finalGroundFrame,
      groundOffsetUnits: cur.groundOffsetUnits ?? null,
      arriveUnits: walk.arriveUnits,
      // Retained ONLY so the defective numbers remain comparable. Neither is a
      // decision input and neither is ever a distance for arrival.
      finalDist3dCentreToE_diagnosticOnly: dist3d(cur.bodyCentre, E),
      finalDistXZToE_diagnosticOnly: distXZ(cur.bodyCentre, E),
      calibratedKeyDirections3d: walk.dirs,
      calibrations: walk.calibrations,
      recalibrations: walk.recalibrations,
      // LIVE census over all stamped entries, not the last (possibly partial) round.
      usableKeyCensus: walk.census ?? null,
      lateralKeysUsableLive: walk.census?.lateralUsableCount ?? null,
      calibrationBounds: walk.calibrationBounds ?? null,
      lastFace: walk.lastFace,
      stall: walk.stall,
      steering: walk.steering,
      frame: shotAtE, journey: walk.journey,
      promptsAtEnd: atE?.interactionPrompts ?? null, hudText: atE?.hudText ?? null,
      survey: cur.survey,
      footing: footingReading({ auditSupported: cur.supported ?? null, up: cur.up ?? null })
    };
    // A/D producing NON-ZERO 3D motion is a required check of the steering
    // repair itself. If it fails, the walk telemetry is not trustworthy and the
    // route result is reported as such — no forced action follows.
    if ((walk.census?.lateralUsableCount ?? 0) === 0) {
      report.findings.push({ id: 'EC3D-LATERAL-KEYS-DEAD',
        detail: `neither KeyA nor KeyD holds a usable live stamp on face ${walk.lastFace}; the ordinary lateral controls did not move the body at all, so this walk cannot be read as an obstacle result. Counted over ALL live entries, not the last (possibly partial) calibration round.`,
        census: walk.census ?? null,
        calibration: walk.calibrations?.at(-1) ?? null });
    }
    if (walk.stall?.stalled) {
      report.findings.push({ id: 'EC3D-ROUTE-STALLED',
        detail: `the ONE bounded route attempt stopped on measured stall telemetry: ${walk.stall.reason}`,
        stall: walk.stall, lastFace: walk.lastFace,
        finalDist3dToE: cur?.bodyPose ? dist3d(cur.bodyPose, E) : null,
        finalDist3dCentreToE_diagnosticOnly: dist3d(cur.bodyCentre, E) });
    }
    report.actualInteractions.push({ what: `ordinary WASD movement toward E, ${walk.bursts} bursts`, label: 'scripted-input' });

    // The offer itself: the shipped [F] context interact. [F] is pressed ONLY
    // when the shipped primary prompt is literally offering it — no forced
    // click, no dispatched event, no direct verb call, no JS shortcut.
    const beforeOffer = await cgSnap(page);
    const beforeOfferState = await readState(page);
    const beforeOfferUi = await uiProbe(page);
    // SIGNED AUTHORIZATION (liveCalibration.signedSpanOfferAuthorization).
    // promptOffersF() returns an OBJECT; feeding it to a gate was the attempt-1
    // truthiness defect. Both gates below now receive a BOOLEAN only.
    const rawOffersF = promptOffersF(beforeOfferState?.interactionPrompts ?? null, SPAN_OFFER_CONTRACT.verbPattern);
    const preArrival = groundTargetArrival({
      bodyCentre: beforeOffer?.bodyCentre, bodyPose: beforeOffer?.bodyPose, up: beforeOffer?.up,
      groundOffsetUnits: beforeOffer?.groundOffsetUnits, target: E, arriveUnits: 1.2
    });
    const spanAuth = signedSpanOfferAuthorization({
      prompts: beforeOfferState?.interactionPrompts ?? null,
      // HUD objectiveId namespace (readState/uiProbe [data-objective-id]).
      objectiveId: beforeOfferUi?.objectiveId ?? beforeOfferState?.objectiveId ?? null,
      beat: beforeOfferState?.beat ?? null,
      surveyPhase: beforeOffer?.survey?.phase ?? null,
      footArrived: preArrival.usable === true && preArrival.arrived === true,
      arrivalEvidence: preArrival
    });
    const offersF = gateInputsFromAuthorization(spanAuth).promptOffersF;
    report.phases.newAction.signedAuthorization = { ...spanAuth, rawPromptOffersF: rawOffersF, preArrival };
    // CURRENT beat, re-read immediately before [F]. contSt is the post-Continue
    // reading and would be stale by the length of the walk.
    const beatNow = beforeOfferState?.beat ?? null;
    const gateNew = newActionGate({
      beat: beatNow, surveyPhase: beforeOffer?.survey?.phase ?? null,
      restoredSamples: contCg?.survey?.samples ?? 0, prompts: beforeOfferState?.interactionPrompts ?? null,
      promptOffersF: offersF, arrived
    });
    // PRE-GPU CORRECTION: before [F], require the CURRENT published FOOT to be
    // grounded at E within the existing radius, on the CURRENT beat, with the
    // shipped prompt actually offering [F]. Off the audited plane, grounding is
    // reported as UNVERIFIABLE — auditSupported=false is not a physics verdict
    // and is never silently accepted as grounded either.
    const groundedGate = groundedActionGate({
      bodyCentre: beforeOffer?.bodyCentre ?? null,
      bodyPose: beforeOffer?.bodyPose ?? null,
      up: beforeOffer?.up ?? null,
      groundOffsetUnits: beforeOffer?.groundOffsetUnits ?? null,
      target: E, arriveUnits: 1.2,
      beat: beforeOffer?.beat ?? beatNow, expectBeat: 'ch13-survey',
      auditSupported: beforeOffer?.supported ?? null,
      promptOffersF: offersF
    });
    report.phases.newAction.gate = gateNew;
    report.phases.newAction.groundedGate = groundedGate;
    report.phases.newAction.gateHelper = 'tangentSteering3d.groundedActionGate (covered by groundFrame.selftest.mjs, 25 checks)';
    say(`pre-[F] grounded gate: ok=${groundedGate.ok} footDistToE=${groundedGate.arrival.distFootToTarget?.toFixed?.(3) ?? 'n/a'} (centre ${groundedGate.arrival.distCentreToTarget_diagnosticOnly?.toFixed?.(3) ?? 'n/a'}, diagnostic) face=${groundedGate.footing.observedFace} auditMeaningful=${groundedGate.footing.auditSupportedIsMeaningfulHere} offersF=${offersF}${groundedGate.ok ? '' : ' :: ' + groundedGate.problems.join('; ')}`);
    if (!groundedGate.ok) {
      report.phases.newAction.reason = groundedGate.problems.join('; ');
      report.findings.push({ id: 'EC3D-NOT-GROUNDED-AT-E',
        detail: `[F] was NOT pressed: ${report.phases.newAction.reason}`,
        groundedGate });
      throw new Error(`the new action is not lawfully authorized: ${report.phases.newAction.reason}`);
    }
    if (!gateNew.ok) {
      report.phases.newAction.reason = gateNew.problems.join('; ');
      report.findings.push({ id: 'EC-NEW-ACTION-NOT-OFFERED', detail: report.phases.newAction.reason });
      throw new Error(`the shipped new action is not available to press: ${report.phases.newAction.reason}`);
    }
    // The interaction is sampled on rendered frames. Retain the signed arrival
    // and route gates above, but hold the real key long enough to be sampled.
    const inputStarted = performance.now();
    await page.keyboard.down('KeyF');
    try { await sleep(80); } finally { await page.keyboard.up('KeyF'); }
    const inputElapsedMs = performance.now() - inputStarted;
    const fPressed = true;
    report.actualInteractions.push({ what: 'pressed [F] (shipped primary interact) to offer the walked span', label: 'actual-interaction' });
    await sleep(1500);
    const afterOffer = await cgSnap(page);
    const afterOfferState = await readState(page);
    const shotOffer = await shot(page, '0005-after-offer.png');
    report.phases.newAction.offer = {
      input: { method: 'keyboard.down/up', requestedHoldMs: 80, elapsedMs: inputElapsedMs },
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
      // EXACT NEW SIGNED SPAN-OFFER TRANSITION relative to the pre-[F] baseline,
      // decided by the called helper `spanOfferAcceptance`.
      //
      // C1 CORRECTION: the previous condition required
      // `anchorsBefore.slice(0, 19).length === 19`. 19 is the serialized SURVEY
      // POINT count of the earned save — NOT a story-anchor count — so a
      // correctly restored state carrying its real 7 or 8 anchors was refused
      // for a reason unrelated to the action under test. No anchor minimum is
      // asserted here: every ACTUAL pre-[F] anchor must simply survive in order,
      // and `anc.cg.route-offered` must be NEW. A generic phase change, an
      // already-present anchor, or an unrelated new anchor cannot pass.
      // The full WorldSave/point-prefix equality after Continue is a SEPARATE
      // gate (overwriteVerdict -> requiredGates.worldSaveEquality) and is
      // untouched and still required below.
      acceptedCriterion: {
        rule: 'spanOfferAcceptance: signedAuthorizationOk && fPressed && NEW anc.cg.route-offered since the pre-[F] reading && all actual pre-[F] anchors preserved in order',
        anchorId: ROUTE_OFFERED_ANCHOR_ID,
        helper: 'continueClosure.spanOfferAcceptance (covered by continueClosure.selftest.mjs)',
        sourceRef: 'commitCommonGroundSpanOffer (main/src/story/commonGroundDirector.ts:~1172) sets survey phase offered + notes anchor anc.cg.route-offered',
        notAsserted: 'no anchor-count minimum; 19 was a survey POINT count'
      },
      acceptance: spanOfferAcceptance({
        anchorsBefore: beforeOffer?.anchors ?? null,
        anchorsAfter: afterOffer?.anchors ?? null,
        signedAuthorizationOk: spanAuth.ok === true,
        fPressed
      }),
      frame: shotOffer
    };
    report.phases.newAction.offer.accepted = report.phases.newAction.offer.acceptance.accepted;
    say(`offer result: phase ${beforeOffer?.survey?.phase} -> ${afterOffer?.survey?.phase}; route-offered anchor present=${(afterOffer?.anchors ?? []).includes('anc.cg.route-offered')}`);
    if (!report.phases.newAction.offer.accepted) {
      report.findings.push({ id: 'EC-NEW-ACTION-REFUSED',
        detail: `the authorized [F] span offer on restored state was not accepted: ${report.phases.newAction.offer.acceptance.problems.join('; ')}`,
        acceptance: report.phases.newAction.offer.acceptance, state: afterOffer });
    }
  }

  // PHASE 5 (secondary quit-to-menu) is DELETED in this copy: the parent probe
  // fell back to a Playwright FORCED click when the pause button was
  // intercepted, and a forced click is not a player action. The primary save
  // under test is the shipped beforeunload autosave in PHASE 2.
  report.phases.quitToMenu = { exercised: false, reason: 'removed: the parent probe\'s fallback used a forced click, which this lane forbids' };

  // ------------------------------------------------------ CONSOLIDATED GATE ---
  // RESTORE ALONE IS NOT A PASS. Every gate below must hold, INCLUDING an actual
  // accepted [F] action on the restored state. This object decides nothing about
  // acceptance; it states which required conditions were measured to hold.
  const acceptedAction = report.phases.newAction?.offer?.accepted === true;
  const gates = {
    worldSaveEquality: report.phases.survival?.overwrite?.ok === true,
    worldActorIdentity: report.phases.survival?.worldIdentity?.ok === true,
    milestonesPreserved: (report.phases.survival?.worldIdentity?.lostMilestones ?? ['unmeasured']).length === 0,
    noAnchorReplay: report.phases.survival?.avReplayCheck?.noReplay === true,
    actualAcceptedNewAction: acceptedAction
  };
  report.requiredGates = {
    ...gates,
    allHeld: Object.values(gates).every((v) => v === true),
    note: 'A restored survey is NOT sufficient. actualAcceptedNewAction requires the shipped [F] prompt to have been offered under signed authorization, pressed unforced, and to have produced a NEW anc.cg.route-offered anchor with every actual pre-[F] anchor preserved in order. A survey-phase change alone never satisfies it. worldSaveEquality remains the separate full WorldSave/point-prefix equality gate after Continue.'
  };
  report.requiredGates.continueTelemetryComplete =
    report.phases.continue?.telemetry?.completeness?.complete ?? null;
  report.finishedAt = new Date().toISOString();
  report.cleanupPreFinally = guard.describe();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  report.failure = failureRecord({ probe: 'earned-continue-3d-probe.mjs', error });
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(report.failure, null, 2)}\n`);
  say(`FAILED: ${String(error && error.message ? error.message : error)}`);
  process.exitCode = 1;
} finally {
  // C3: STOP AND HARVEST THE SAMPLER ON EVERY PATH, including a FAILED Continue.
  // Idempotent, so a successful run does not harvest twice. If the sampler was
  // never installed the helper does not exist and nothing is invented.
  try {
    if (typeof harvestContinueSampler === 'function') {
      const tel = await harvestContinueSampler('finally');
      report.phases = report.phases ?? {};
      report.phases.continue = report.phases.continue ?? {};
      report.phases.continue.telemetry = tel;
      report.phases.continue.telemetryCleanedUp = tel.cleanedUp;
    }
  } catch (e) { say(`continue sampler harvest note: ${String(e?.message ?? e)}`); }
  // Detach the passive CDP observer before the owned session closes; the events
  // already collected are written out either way.
  try {
    if (typeof domStorage !== 'undefined' && domStorage) {
      report.observation = report.observation ?? {};
      report.observation.domStorageDetach = await domStorage.detach();
      report.observation.domStorageEventCount = domStorage.events.length;
      writeFileSync(join(outDir, 'domstorage-events.json'), `${JSON.stringify({
        available: domStorage.available, error: domStorage.error, events: domStorage.events
      }, null, 2)}\n`);
    }
  } catch (e) { say(`DOMStorage detach note: ${String(e?.message ?? e)}`); }
  // OWNED SESSION ONLY. The root preview is never stopped by this probe.
  const receipt = await guard.stopOnce('finally');
  const post = guard.cleanupReceipt({ probe: 'earned-continue-3d-probe.mjs' });
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
