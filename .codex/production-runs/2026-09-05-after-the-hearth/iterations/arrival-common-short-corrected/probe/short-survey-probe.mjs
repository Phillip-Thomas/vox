/**
 * short-survey-probe.mjs — ORDINARY-INPUT **SHORT** survey witness/revision lane.
 *
 * STATUS AT WRITING: PREPARED, NOT RUN. No browser, preview, build or GPU was
 * used to author this file. It is executable and refuses by default.
 *
 * WHY THIS LANE EXISTS
 * --------------------
 * Every existing capture in this run draws the LONG span. `manual-witness-hold-
 * probe.mjs` hardcodes the 18-waypoint z=14..22 detour (CG_ROUTE_LONG minus its
 * first vertex), and the movie rail does the same, so both complete as
 * `fixed-reference`. The SHORT class is earned only when an offered AND occupied
 * witness holds the end the fixed socket cannot see past the apparatus backing.
 * That is a different physical performance and no existing artefact contains it.
 *
 * WHAT THIS LANE DOES, PHYSICALLY
 * -------------------------------
 *   1. Refuses before any browser unless: verification-ready, verifier-control
 *      activeRole `arrival-common-short-runtime`, an ALREADY-acquired inherited
 *      EXCLUSIVE flock on the shared heavy lock, the CURRENT root-published URL
 *      from verifier/artifacts/preview-ownership.json, the CURRENT frozen
 *      implementation-source-manifest sha, the CURRENT scene-v3 contract sha,
 *      the ACTUAL served index+bundle bytes, and an EMPTY absolute --out.
 *   2. Opens exactly ONE probe-owned browser, in a try/finally, and writes a
 *      POST-FINALLY cleanup receipt. It never stops the root-owned preview.
 *   3. Ordinary shipped input only: a real menu/canvas click for pointer lock,
 *      held WASD, and [F] pressed ONLY where the shipped prompt offers the
 *      authored verb under the authored objective id. No pose/control-state/
 *      progress/milestone/route write, no forged save, no direct predicate call,
 *      no teleport, no forced pointer lock, no synthetic/forced click.
 *   4. Walks to W from ACTUAL live state, offers, walks to S, starts recording,
 *      draws the SHORT span, offers it, and watches W-7744's REAL test.
 *   5. Answers the ACTUAL published hold: an occlusion/range hold is answered by
 *      the authored reference [F] at the marked witness pose plus MAINTAINED
 *      occupancy; a `footing-invalid` hold is answered by an ACTUAL revision (it
 *      is never laundered by occupancy) and the reoffered span then follows the
 *      signed LONG geometry, because that is what the contract leaves available.
 *      The branch is chosen from the hold the runtime actually publishes, never
 *      from an assumption.
 *
 * UNEXECUTED CLI EXAMPLE — placeholders only. This command has NOT been run and
 * MUST NOT be copied verbatim: every value is replaced by the CURRENT
 * root-published facts at release. There is no port, url or sha default.
 *
 *   flock -x 9 </home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock \
 *     node .../verifier/probes/arrival-common-short/short-survey-probe.mjs \
 *       --url <CURRENT_ROOT_PUBLISHED_URL> \
 *       --expect-source-manifest <CURRENT_SOURCE_MANIFEST_SHA256> \
 *       --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock \
 *       --heavy-lock-fd 9 \
 *       --out <ABSOLUTE_FRESH_CAPTURE_DIR>
 *
 * `--self-test` runs the CPU predicate suite and never touches a browser.
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
// PINNED byte copies of the shared helpers (see pin.json). Concurrent roles may
// edit verifier/probes/lib/* while this lane waits; this probe binds to bytes it
// owns, at the SAME directory depth so RUN_DIR/REPO_ROOT resolution is unchanged.
import { ART, RUN_DIR, REPO_ROOT } from './cgContract.pinned.mjs';
import { createOwnedSessionGuard, failureRecord } from './ownedSession.pinned.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from './sourceSnapshot.pinned.mjs';
import {
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision, preflightDecision,
  identityVerdict, mayPressF, promptOffersF, chooseKey, unit2, distXZ, bodyUsable, settled,
  planPulseMs, poseReading, orUnavailable
} from './commonPassageLogic.mjs';
import { entryObserverSource, entryObserverReadSource, attachPassivePageSinks } from './entryObservation.mjs';
import {
  CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG, SHIPPED_SHORT_PREDICATES, EXPECTED_CLASS_FOR,
  classifyDrawnRoute, shortCompletionVerdict, newWitnessOfferVerdict, occupancyRequirementVerdict,
  downstreamPermitted, revisionVerdict, entryLabel, fixtureBootIsClean, closingReceiptVerdict,
  observerFailureIsNotGameplay, OCCUPANCY_RADIUS_UNITS
} from './shortSurveyLogic.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';

const P = [...process.argv.slice(2)];
const arg = (n, d = null) => { const i = P.indexOf(`--${n}`); return i >= 0 && P[i + 1] && !P[i + 1].startsWith('--') ? P[i + 1] : d; };
const flag = (n) => P.includes(`--${n}`);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

if (flag('self-test')) {
  // The pure suite lives beside this file so it can be run with no browser.
  await import('./shortSurveyLogic.mjs');
  console.error('run the pure suite as: node shortSurveyLogic.mjs --self-test  (and selftest.mjs for the lane suite)');
  process.exit(64);
}

// The role name this lane must be RELEASED as. It is not a label this probe may
// award itself: verifier-control.json must already say it.
const ACTIVE_ROLE = 'arrival-common-short-runtime';
/** The scene-v3 contract this lane read its expectations from, by bytes. */
const EXPECT_CONTRACT_SHA256 = '5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54';
const HEAVY_LOCK_DEFAULT = '/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock';

const t0 = Date.now();
const say = (m) => console.log(`[short] ${new Date().toISOString()} +${Date.now() - t0}ms ${m}`);
const outArg = arg('out', null);
if (outArg !== null && !isAbsolute(outArg)) { console.error(`--out must be an ABSOLUTE path; got ${outArg}`); process.exit(64); }
const outDir = outArg;
const URL_ARG = arg('url', null);
const BUDGET = {
  ready: Number(arg('ready-ms', '120000')),
  leg: Number(arg('leg-ms', '90000')),
  draw: Number(arg('draw-ms', '420000')),
  test: Number(arg('test-ms', '300000')),
  hold: Number(arg('hold-ms', '180000')),
  stall: Number(arg('stall-ms', '20000'))
};

// ---------------------------------------------------------------- preflight ----
// Pure, file-driven, BEFORE any browser exists. NOTHING below opens the heavy
// lock: an already-acquired exclusive flock must be INHERITED on the given fd.
const ready = readJson(resolve(RUN_DIR, 'verification-ready.json'));
const control = readJson(resolve(RUN_DIR, 'verifier-control.json'));
const manifestPath = resolve(RUN_DIR, 'implementation-source-manifest.json');
const liveManifestSha = (() => { try { return sha(readFileSync(manifestPath)); } catch { return null; } })();
const contractPath = resolve(RUN_DIR, 'scene-contract.json');
const liveContractSha = (() => { try { return sha(readFileSync(contractPath)); } catch { return null; } })();
const lockPath = arg('heavy-lock', process.env.PARAVOXIA_HEAVY_LOCK ?? HEAVY_LOCK_DEFAULT);
const lockFdArg = arg('heavy-lock-fd', process.env.PARAVOXIA_HEAVY_LOCK_FD ?? null);
const heavyLock = heavyLockOwnership({
  lockPath, fd: lockFdArg === null ? null : Number.parseInt(String(lockFdArg), 10),
  probeContention: flag('probe-lock-contention')
});
const previewOwnership = readJson(resolve(ART, 'preview-ownership.json'));
const served = URL_ARG ? await fetchServedIdentity({ url: URL_ARG, bundlePath: previewOwnership?.bundlePath ?? null }) : null;
const previewBinding = previewBindingDecision({
  ownership: previewOwnership, url: URL_ARG,
  expectSourceManifestSha: arg('expect-source-manifest', null), served, requireBundle: true
});
const pre = preflightDecision({
  ready, control, role: ACTIVE_ROLE, url: URL_ARG, out: outArg, heavyLock, previewBinding,
  expectSourceManifestSha: arg('expect-source-manifest', null), liveSourceManifestSha: liveManifestSha
});
// The scene-v3 survey contract this lane quoted must still be the served one.
if (liveContractSha !== EXPECT_CONTRACT_SHA256) {
  pre.launch = false;
  pre.refusals.push(`scene-contract.json is ${liveContractSha}, not the scene-v3 bytes this lane was written against (${EXPECT_CONTRACT_SHA256})`);
}
if (heavyLock?.lockPath && heavyLock.lockPath !== HEAVY_LOCK_DEFAULT) {
  pre.refusals.push(`--heavy-lock ${heavyLock.lockPath} is not the shared heavy lock ${HEAVY_LOCK_DEFAULT}`);
  pre.launch = false;
}
if (!pre.launch) {
  const refusal = {
    schema: 'paravoxia.verifier.arrivalCommonShort.refusal.v1', probe: 'short-survey-probe.mjs',
    role: ACTIVE_ROLE, at: new Date().toISOString(), launched: false, browserLaunched: false,
    verdict: 'REFUSED-PREREQUISITE', refusals: pre.refusals,
    heavyLock: { lockPath: heavyLock.lockPath, fd: heavyLock.fd, owned: heavyLock.owned, problems: heavyLock.problems, procLock: heavyLock.procLock },
    previewBinding, liveManifestSha, liveContractSha
  };
  console.error(JSON.stringify(refusal, null, 1));
  if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'refusal.json'), `${JSON.stringify(refusal, null, 1)}\n`); }
  say(`REFUSED before any browser launch: ${pre.refusals.join(' | ')}`);
  process.exit(3);
}

assertFreshOutputDir(outDir, { what: 'arrival-common-short capture' });
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
const emit = (rec) => appendFileSync(tracePath, `${JSON.stringify({ atMs: Date.now() - t0, at: new Date().toISOString(), ...rec })}\n`);
writeFileSync(join(outDir, 'preflight.json'), `${JSON.stringify({
  role: ACTIVE_ROLE, url: URL_ARG, heavyLock, previewBinding, served, liveManifestSha, liveContractSha,
  controlAction: control?.action ?? null, controlActiveRole: control?.activeRole ?? null, decision: pre
}, null, 1)}\n`);

const sourceManifest = writeSourceSnapshot({
  entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
  note: 'Exact bytes of the SHORT survey probe and every helper it imports, including the pinned copies.'
});

const report = {
  schema: 'paravoxia.verifier.arrivalCommonShort.v1',
  probe: 'short-survey-probe.mjs', role: ACTIVE_ROLE, startedAt: new Date(t0).toISOString(),
  lane: 'MANUAL SHORT — ordinary held keys and authored [F] only; no movie=1, no autopilot, no teleport, no forced click, no state write',
  issuedRoute: 'SHORT',
  shippedPredicateSnapshot: SHIPPED_SHORT_PREDICATES,
  fixture: null, sourceSnapshot: snapshotRef(sourceManifest), url: URL_ARG, budgets: BUDGET,
  gates: [], legs: [], steps: [], fPresses: [], stalls: [], observations: {},
  verdict: 'INCOMPLETE', stoppedAt: null
};
const gate = (name, ok, detail, { required = true } = {}) => {
  const g = { name, ok: ok === true, required, detail, at: new Date().toISOString() };
  report.gates.push(g); emit({ gate: g });
  say(`GATE ${g.ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail).slice(0, 260)}`);
  return g.ok;
};
/** No dependent physical act is attempted while a required gate is failed. */
const permit = (action) => {
  const d = downstreamPermitted(report.gates, { action });
  if (!d.permitted) { emit({ refusedAction: action, ...d }); say(`REFUSED ${action}: ${d.why}`); }
  return d;
};

let pageSinks = null;
/** The runtime free-recorder's own count at offer/freeze. Never inferred. */
let recorderAtOfferFreeze = null;
/**
 * Both counts, recorded SEPARATELY and never conflated:
 *   recordedAtOfferFreeze — the runtime's free recorder at the offer (the only
 *                           quantity the accepted slot count is comparable to)
 *   walkedWaypointLegs    — this probe's commanded legs (CG_ROUTE_SHORT has 9
 *                           vertices => 8 legs). Reported, not compared.
 */
const recorderCountRecord = (fin) => ({
  recordedAtOfferFreeze: recorderAtOfferFreeze?.recordedSamples ?? null,
  offerFreeze: recorderAtOfferFreeze,
  recordedAtCompletion: fin?.survey?.samples ?? null,
  acceptedAtCompletion: fin?.survey?.acceptedSamples ?? null,
  walkedWaypointLegs: report.drawn?.sampleCount ?? null,
  commandedRouteVertices: CG_ROUTE_SHORT.length,
  freezeHeldBetweenOfferAndCompletion:
    recorderAtOfferFreeze?.recordedSamples != null && fin?.survey?.samples != null
      ? recorderAtOfferFreeze.recordedSamples === fin.survey.samples : null,
  note: 'accepted-vs-recorded is the only equality tested; waypoint legs are a different unit and are reported only'
});
const guard = createOwnedSessionGuard({ log: say, label: 'arrival-common-short session' });
let page = null;

const stop = async (name, detail) => {
  report.verdict = report.verdict === 'INCOMPLETE' ? 'STOPPED-PREREQUISITE' : report.verdict;
  report.stoppedAt = name; report.stopDetail = detail ?? null;
  if (page) {
    const png = await page.screenshot().catch(() => null);
    if (png) writeFileSync(join(outDir, `stop-${name}.png`), png);
    report.stopState = { cg: await cgSnap(page).catch(() => null), state: await readState(page).catch(() => null) };
  }
  throw Object.assign(new Error(`stopped at ${name}: ${JSON.stringify(detail).slice(0, 260)}`), { gateStop: true });
};

// ------------------------------------------------------------ page readers ----
// READ-ONLY. Nothing here calls a game predicate, a commit or a setter.
const cgSnap = (p) => p.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  const d = s.diagnostic ?? {};
  return {
    beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose ?? null, up: s.up,
    groundOffsetUnits: s.groundOffsetUnits ?? null,
    supported: s.supported, worldBound: s.worldBound, rail: s.rail ?? null, railCursor: s.railCursor ?? null,
    holdReason: d.holdReason ?? null, anchors: d.anchors ?? [], survey: d.survey ?? null,
    common: d.common ?? null, pendingAnchors: s.pendingAnchors ?? [],
    worker: d.worker ? { leg: d.worker.leg, travelled: d.worker.travelled, held: d.worker.held, position: d.worker.position } : null
  };
});
const controlProbe = (p) => p.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return {
    pointerLockIsCanvas: !!canvas && document.pointerLockElement === canvas,
    hasFocus: document.hasFocus(), autopilotPresent: !!window.__autopilot,
    policy: window.__storyInputPolicy ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode } : null,
    canvasRect: canvas ? (({ x, y, width, height }) => ({ x, y, width, height }))(canvas.getBoundingClientRect()) : null,
    title: document.title
  };
});
const uxRead = async (p) => {
  const st = await readState(p).catch(() => null);
  return {
    objectiveId: st?.objectiveId ?? null, markerLabel: st?.markerLabel ?? null,
    hudText: st?.hudText ?? null, prompts: st?.interactionPrompts ?? []
  };
};

const snapStep = async (label) => {
  const cg = await cgSnap(page); const ux = await uxRead(page);
  const rec = {
    label, beat: cg?.beat ?? null, body: cg?.bodyCentre ?? null, supported: cg?.supported ?? null,
    // ROOT-AUTHORIZED CORRECTION (1): the runtime's own grounded FOOT pose is
    // retained per step, with bodyCentre / up / groundOffsetUnits kept SEPARATELY
    // as their own measurements. Nothing here derives one from the other.
    bodyPose: cg?.bodyPose ?? null, bodyCentre: cg?.bodyCentre ?? null,
    up: cg?.up ?? null, groundOffsetUnits: cg?.groundOffsetUnits ?? null,
    holdReason: cg?.holdReason ?? null, anchors: cg?.anchors ?? [], survey: cg?.survey ?? null, ux
  };
  report.steps.push(rec); emit({ phase: 'state', ...rec });
  say(`[${label}] obj=${ux.objectiveId} marker=${orUnavailable(ux.markerLabel)} phase=${rec.survey?.phase} samples=${rec.survey?.samples} hold=${rec.holdReason} class=${orUnavailable(rec.survey?.acceptedClass)}`);
  const png = await page.screenshot().catch(() => null);
  if (png) { writeFileSync(join(outDir, `${label}.png`), png); rec.frame = { file: `${label}.png`, sha256: sha(png) }; }
  return rec;
};

/** ~20s stall diagnosis: what the world says while nothing is moving. */
const diagnoseStall = async (where, extra = {}) => {
  const cg = await cgSnap(page).catch(() => null);
  const ctl = await controlProbe(page).catch(() => null);
  const rec = {
    where, at: new Date().toISOString(), stallBudgetMs: BUDGET.stall,
    body: cg?.bodyCentre ?? null, supported: cg?.supported ?? null, worldBound: cg?.worldBound ?? null,
    holdReason: cg?.holdReason ?? null, survey: cg?.survey ?? null, worker: cg?.worker ?? null,
    pointerLockIsCanvas: ctl?.pointerLockIsCanvas ?? null, hasFocus: ctl?.hasFocus ?? null,
    policy: ctl?.policy ?? null, ux: await uxRead(page).catch(() => null), ...extra
  };
  report.stalls.push(rec); emit({ phase: 'stall-diagnosis', ...rec });
  say(`STALL at ${where}: hold=${rec.holdReason} supported=${rec.supported} lock=${rec.pointerLockIsCanvas} focus=${rec.hasFocus}`);
  return rec;
};

// ------------------------------------------------------------ ordinary walk ----
let dirs = {}; let unitsPerMs = null; let coastUnits = 0;

const holdKey = async (code, ms) => {
  const b = await cgSnap(page);
  await page.keyboard.down(code);
  const th = Date.now(); while (Date.now() - th < ms) await sleep(50);
  await page.keyboard.up(code); await sleep(150);
  const a = await cgSnap(page);
  return { code, ms, from: b?.bodyCentre ?? null, to: a?.bodyCentre ?? null, supported: a?.supported ?? null };
};

/** Walk to `target` with ordinary held keys; arrival is asserted by measurement. */
const walkTo = async (label, target, { arrive = 1.0, budgetMs = BUDGET.leg } = {}) => {
  const p0 = (await cgSnap(page))?.bodyCentre ?? null;
  const t = Date.now(); let last = p0; let stallMs = 0; let travelled = 0; let diagnosed = false;
  while (Date.now() - t < budgetMs) {
    const s = await cgSnap(page); const p = s?.bodyCentre ?? null;
    if (!p) break;
    const d = distXZ(p, target);
    if (d <= arrive) {
      const leg = { label, target, arrive, reached: true, finalDistance: d, elapsedMs: Date.now() - t, travelled, from: p0, to: p };
      report.legs.push(leg); emit({ phase: 'leg', ...leg }); say(`LEG ${label} REACHED d=${d.toFixed(2)}`); return leg;
    }
    const want = unit2([target[0] - p[0], target[2] - p[2]]) ?? [1, 0];
    const pick = chooseKey(dirs, want);
    if (!pick.key) break;
    const pulse = planPulseMs({ distance: d, arrive, unitsPerMs, coastUnits });
    // An unavailable calibration plans NO pulse; the leg stops honestly.
    if (pulse.ms == null) { emit({ phase: 'pulse-refused', label, why: pulse.why }); break; }
    const ms = pulse.ms;
    await page.keyboard.down(pick.key); await sleep(Math.max(60, ms)); await page.keyboard.up(pick.key); await sleep(110);
    const q = (await cgSnap(page))?.bodyCentre ?? p;
    const step = distXZ(last ?? q, q); travelled += step; last = q;
    emit({ phase: 'step', label, key: pick.key, ms, pos: q, distance: distXZ(q, target), step });
    stallMs = step < 0.05 ? stallMs + Math.max(60, ms) + 110 : 0;
    if (stallMs >= BUDGET.stall && !diagnosed) { diagnosed = true; await diagnoseStall(`walk:${label}`, { target, stallMs }); }
    if (stallMs >= BUDGET.stall * 1.5) break;
  }
  const p = (await cgSnap(page))?.bodyCentre ?? null;
  const leg = { label, target, arrive, reached: false, finalDistance: p ? distXZ(p, target) : null,
    elapsedMs: Date.now() - t, travelled, from: p0, to: p, stalled: stallMs >= BUDGET.stall };
  report.legs.push(leg); emit({ phase: 'leg', ...leg }); say(`LEG ${label} NOT REACHED d=${orUnavailable(leg.finalDistance)}`);
  return leg;
};

/**
 * [F] ONLY where the shipped prompt offers the authored verb under the authored
 * objective id. An any-prompt press is not an authored offer and is refused.
 */
const pressAuthoredF = async (name, { expectedObjectiveId, verbPattern }) => {
  const p = permit(`press F (${name})`);
  if (!p.permitted) return { pressed: false, refused: p.why };
  const ux = await uxRead(page);
  const may = mayPressF({ objectiveId: ux.objectiveId, expectedObjectiveId, prompts: ux.prompts, verbPattern });
  const rec = { name, at: new Date().toISOString(), expectedObjectiveId, verb: String(verbPattern),
    objectiveId: ux.objectiveId, prompts: ux.prompts, may };
  if (!may.ok) {
    rec.pressed = false; report.fPresses.push(rec); emit({ phase: 'f-refused', ...rec });
    say(`F REFUSED (${name}): ${may.why}`); return rec;
  }
  await page.keyboard.down('KeyF'); await sleep(80); await page.keyboard.up('KeyF'); await sleep(1300);
  rec.pressed = true; report.fPresses.push(rec); emit({ phase: 'f-pressed', ...rec });
  say(`pressed [F] (${name}) on "${may.prompt}"`);
  return rec;
};

// ------------------------------------------------------------------- capture ----
try {
  const entryUrl = `${URL_ARG}${URL_ARG.includes('?') ? '&' : '?'}story=ch13-survey&journeyprobe=1&debug=1`;
  report.fixture = entryLabel(entryUrl);
  say(report.fixture.claim);

  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1',
    preview: { url: previewOwnership.url, stop() { /* ROOT owns this preview's lifetime */ } },
    build: false, viewport: { width: 1280, height: 720 }, log: say
  }));
  page = session.page;
  report.renderer = session.renderer; report.headed = session.headed; report.entryUrl = session.url;
  report.fixture = entryLabel(session.url ?? entryUrl);

  // Passive Window/Document input observer: corroboration only. Its failure is
  // an INSTRUMENTATION limitation and is never read as a gameplay failure.
  let observerOk = false;
  try {
    pageSinks = attachPassivePageSinks(page);
    await page.evaluate(entryObserverSource());
    observerOk = (await page.evaluate(entryObserverReadSource())) != null;
  } catch (e) { say(`passive input observer did not attach: ${String(e).slice(0, 160)}`); }
  report.observations.inputObserver = observerFailureIsNotGameplay({ observerOk, gameplayEvidence: null });

  await waitReady(page, { timeoutMs: BUDGET.ready });
  await page.bringToFront();

  const ctl0 = await controlProbe(page);
  const identity = identityVerdict({
    title: ctl0.title, renderer: session.renderer, headed: session.headed,
    indexSha: served?.indexSha256 ?? null, expectIndexSha: previewOwnership?.indexSha256 ?? null, requireIndexSha: true
  });
  report.identity = identity;
  if (!gate('current-build-identity-and-hardware-angle', identity.ok, identity)) await stop('current-build-identity-and-hardware-angle', identity);

  // The fixture must not BOOT with what this lane is supposed to earn.
  // HARNESS CORRECTION (proven by the PRESERVED short-1 attempt): the boot read
  // landed at +1953ms, before window.__paravoxiaCommonGround published ANYTHING
  // (cgSnap returned null: beat/body/supported/anchors/survey all null), and the
  // gate scored "diagnostic not published yet" as an unclean fixture. Wait,
  // bounded by the EXISTING ready budget and with NO input of any kind, for the
  // diagnostic to exist, then apply the UNCHANGED predicate. Nothing is
  // loosened and no game predicate is touched: a fixture that actually boots
  // with samples, a tested prefix, an accepted class, a held/occupied witness,
  // a tail revision or a survey anchor still fails this gate exactly as before.
  const tBoot = Date.now();
  while (Date.now() - tBoot < BUDGET.ready) {
    const s = await cgSnap(page);
    if (s && s.survey) break;
    await sleep(400);
  }
  const boot = await snapStep('boot');
  const clean = fixtureBootIsClean({ survey: boot.survey, anchors: boot.anchors });
  report.observations.fixtureBoot = clean;
  if (!gate('fixture-boot-seeds-no-short-completion', clean.ok, clean)) await stop('fixture-boot-seeds-no-short-completion', clean);

  // Physical prerequisites, in the order the shipped gate requires them.
  let cg = null; const tW = Date.now();
  while (Date.now() - tW < BUDGET.ready) { cg = await cgSnap(page); if (cg?.worldBound && bodyUsable(cg.bodyCentre).ok) break; await sleep(400); }
  if (!gate('world-bound-and-body', !!cg?.worldBound && bodyUsable(cg?.bodyCentre ?? null).ok, poseReading(cg))) await stop('world-bound-and-body', cg);
  const samples = []; const tS = Date.now(); let sr = { ok: false };
  while (Date.now() - tS < 60000) {
    const s = await cgSnap(page); if (s && bodyUsable(s.bodyCentre).ok) samples.push(s.bodyCentre);
    sr = settled(samples); if (sr.ok && s?.supported === true) break; await sleep(250);
  }
  cg = await cgSnap(page);
  if (!gate('settled-grounded-body', sr.ok && cg?.supported === true, { spread: sr.spread, supported: cg?.supported })) await stop('settled-grounded-body', sr);
  let ctl = await controlProbe(page);
  if (!gate('policy-permits-movement', !!ctl.policy && ctl.policy.moveSpeedScale > 0 && ctl.policy.lookMode !== 'side', ctl.policy)) await stop('policy-permits-movement', ctl.policy);
  // Pointer lock through a REAL canvas click. Never forced, never synthesised.
  const r = ctl.canvasRect;
  await page.mouse.click(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
  const tL = Date.now(); while (Date.now() - tL < 5000) { ctl = await controlProbe(page); if (ctl.pointerLockIsCanvas) break; await sleep(200); }
  if (!gate('pointer-lock-active-via-ordinary-click', ctl.pointerLockIsCanvas, { pointerLockIsCanvas: ctl.pointerLockIsCanvas, hasFocus: ctl.hasFocus }))
    await stop('pointer-lock-active-via-ordinary-click', ctl);
  gate('manual-lane-no-autopilot', ctl.autopilotPresent === false, { autopilotPresent: ctl.autopilotPresent });

  // Calibrate each ordinary key by MEASURING what it actually does.
  const calib = [];
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const h = await holdKey(code, 700); calib.push(h); emit({ phase: 'calibrate', ...h });
    const moved = h.from && h.to ? distXZ(h.from, h.to) : 0;
    dirs[code] = moved >= 0.5 && h.from && h.to ? unit2([h.to[0] - h.from[0], h.to[2] - h.from[2]]) : null;
    if (moved >= 0.5) unitsPerMs = Math.max(unitsPerMs ?? 0, moved / h.ms);
  }
  report.calibration = { calib, dirs, unitsPerMs };
  if (!gate('four-key-calibration-is-directional', Object.values(dirs).filter(Boolean).length === 4, { dirs }))
    await stop('four-key-calibration-is-directional', { calib, dirs });

  // ---- 1. walk to W from ACTUAL live state --------------------------------
  const live = await cgSnap(page);
  const railTarget = Array.isArray(live?.rail?.target) ? [...live.rail.target] : null;
  const W = railTarget ?? [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z];
  report.targetW = { value: W, source: railTarget ? 'live shipped marker target (the game’s own published stand)' : 'CG_POSES.W quoted from frozen source' };
  const legW = await walkTo('to-W', W, { arrive: 1.5 });
  const atW = await snapStep('at-W');
  if (!gate('arrived-at-W', legW.reached === true, { finalDistance: legW.finalDistance, travelled: legW.travelled })) await stop('arrived-at-W', legW);
  const fOffer = await pressAuthoredF('offer-a-route', { expectedObjectiveId: 'ch13:survey:offer', verbPattern: /demonstrate a route/i });
  const afterOffer = await snapStep('after-F-offer');
  if (!gate('survey-opened-by-authored-F', fOffer.pressed === true && (afterOffer.anchors ?? []).includes('anc.cg.demonstration-opened'),
    { pressed: fOffer.pressed, why: fOffer.may?.why ?? null, anchors: afterOffer.anchors })) await stop('survey-opened-by-authored-F', afterOffer);

  // ---- 2. walk to S and begin recording ------------------------------------
  const S = [CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z];
  const legS = await walkTo('to-S', S, { arrive: 1.0 });
  await snapStep('at-S');
  if (!gate('arrived-at-survey-start', legS.reached === true, legS)) await stop('arrived-at-survey-start', legS);
  const fStart = await pressAuthoredF('begin-recording', { expectedObjectiveId: 'ch13:survey:start', verbPattern: /begin recording/i });
  const started = await snapStep('after-F-start');
  if (!gate('survey-actually-started', fStart.pressed === true && (started.anchors ?? []).includes('anc.cg.survey-started'),
    { pressed: fStart.pressed, why: fStart.may?.why ?? null, anchors: started.anchors })) await stop('survey-actually-started', started);

  // ---- 3. DRAW THE SHORT SPAN ----------------------------------------------
  // The signed short route, walked with ordinary keys. Its samples are recorded
  // by the shipped tracer; this lane writes nothing into the trace.
  const drawnPositions = [];
  const drawLegs = [];
  for (let i = 1; i < CG_ROUTE_SHORT.length; i += 1) {
    const wp = [...CG_ROUTE_SHORT[i]];
    const leg = await walkTo(`short-${i}`, wp, { arrive: 0.7, budgetMs: 60000 });
    const s = await cgSnap(page);
    if (s?.bodyCentre) drawnPositions.push([...s.bodyCentre]);
    drawLegs.push({ i, target: wp, reached: leg.reached, finalDistance: leg.finalDistance, survey: s?.survey ?? null });
    emit({ phase: 'draw-leg', i, target: wp, reached: leg.reached, survey: s?.survey ?? null });
    if (!leg.reached) { report.drawStop = { why: 'leg-not-reached', i, leg }; break; }
  }
  report.drawLegs = drawLegs;
  const atE = await snapStep('at-E-after-short-draw');
  report.drawn = classifyDrawnRoute({ samples: drawnPositions, walkedUnits: atE.survey?.walkedUnits ?? null, issued: 'SHORT' });
  emit({ phase: 'classification', ...report.drawn });
  if (!gate('the-body-actually-walked-the-SHORT-span', report.drawn.actual === 'SHORT' && report.drawn.agrees, report.drawn))
    await stop('the-body-actually-walked-the-SHORT-span', report.drawn);
  if (!gate('a-real-trace-was-recorded', (atE.survey?.samples ?? 0) >= 2 && (atE.survey?.lengthUnits ?? 0) > 0, atE.survey))
    await stop('a-real-trace-was-recorded', atE.survey);

  // ---- 4. offer the walked span --------------------------------------------
  const fSpan = await pressAuthoredF('offer-the-walked-span', { expectedObjectiveId: 'ch13:survey:offer-span', verbPattern: /offer .*span/i });
  const offered = await snapStep('after-F-offer-span');
  if (!gate('span-offered', fSpan.pressed === true && (offered.anchors ?? []).includes('anc.cg.route-offered'),
    { pressed: fSpan.pressed, why: fSpan.may?.why ?? null, anchors: offered.anchors })) await stop('span-offered', offered);

  // ROOT-AUTHORIZED CORRECTION (2). The quantity comparable to the accepted
  // slot's sample count is the runtime FREE RECORDER's own count at the moment
  // the offer freezes it (diagnostic survey.samples = survey.working.samples
  // .length), read here from the shipped diagnostic. This lane's walked
  // WAYPOINT-LEG count is a different unit and is recorded separately, never
  // compared for equality.
  recorderAtOfferFreeze = {
    recordedSamples: offered.survey?.samples ?? null,
    lengthUnits: offered.survey?.lengthUnits ?? null,
    walkedUnits: offered.survey?.walkedUnits ?? null,
    phase: offered.survey?.phase ?? null,
    at: 'after-F-offer-span (anc.cg.route-offered)'
  };
  emit({ phase: 'recorder-freeze', ...recorderAtOfferFreeze });

  // ---- 5. W-7744's REAL test of the short span ------------------------------
  // The shipped test either completes (fixed reference alone) or publishes a
  // hold. Which one happens is MEASURED, never assumed: the shipped unit suite
  // expects the short span to hold on the apparatus backing, and if it does not,
  // that disagreement is the finding.
  const watch = [];
  const watchTest = async (label, budgetMs, until) => {
    const t = Date.now(); let diagnosed = false; let lastKey = null;
    while (Date.now() - t < budgetMs) {
      const s = await cgSnap(page); const ux = await uxRead(page);
      const rec = { label, ms: Date.now() - t, holdReason: s?.holdReason ?? null, survey: s?.survey ?? null,
        anchors: s?.anchors ?? [], worker: s?.worker ?? null, body: s?.bodyCentre ?? null,
        witnessOccupied: s?.survey?.witnessOccupied ?? null, objectiveId: ux.objectiveId, prompts: ux.prompts };
      watch.push(rec); emit({ phase: 'watch', ...rec });
      if (until(rec)) return rec;
      const key = `${rec.holdReason}|${rec.survey?.testedPrefix}|${rec.worker?.travelled}`;
      if (key === lastKey) { if (!diagnosed && Date.now() - t > BUDGET.stall) { diagnosed = true; await diagnoseStall(`watch:${label}`, { last: rec }); } }
      else { lastKey = key; diagnosed = false; }
      await sleep(1500);
    }
    return watch[watch.length - 1] ?? null;
  };
  const firstOutcome = await watchTest('short-first-test', BUDGET.test,
    (r) => (r.anchors ?? []).includes('anc.cg.route-tested') || r.holdReason != null);
  report.firstTestOutcome = firstOutcome;
  await snapStep('first-test-outcome');
  const holdReason = firstOutcome?.holdReason ?? null;
  report.observations.holdAgreesWithShippedPredicate = {
    holdReason,
    expectedByShippedSuite: SHIPPED_SHORT_PREDICATES.shortHoldReasons,
    agrees: holdReason != null && SHIPPED_SHORT_PREDICATES.shortHoldReasons.includes(holdReason)
  };
  gate('short-span-holds-as-the-shipped-suite-expects', report.observations.holdAgreesWithShippedPredicate.agrees,
    report.observations.holdAgreesWithShippedPredicate, { required: false });

  if (holdReason === 'footing-invalid') {
    // UNSAFE FOOTING IS NEVER REPAIRED BY OCCUPANCY. The authored repair is an
    // actual revision, and the reoffered span then follows the signed LONG
    // geometry because that is what remains demonstrable.
    report.branch = 'revision-to-long';
    const before = (await cgSnap(page))?.survey ?? null;
    const ux = await uxRead(page);
    report.observations.revisionMarker = ux;
    // The revise objective's own marker names the last tested point; walk to it.
    const tgt = Array.isArray((await cgSnap(page))?.rail?.target) ? [...(await cgSnap(page)).rail.target] : null;
    if (!gate('revision-marker-publishes-the-last-tested-point', !!tgt, { marker: ux.markerLabel, target: tgt }))
      await stop('revision-marker-publishes-the-last-tested-point', ux);
    const legR = await walkTo('to-last-tested-point', tgt, { arrive: 1.0 });
    await snapStep('at-last-tested-point');
    if (!gate('arrived-at-last-tested-point', legR.reached === true, legR)) await stop('arrived-at-last-tested-point', legR);
    const fRevise = await pressAuthoredF('reopen-the-untested-span', { expectedObjectiveId: 'ch13:survey:revise', verbPattern: /reopen/i });
    const afterRevise = await snapStep('after-F-revise');
    report.revision = revisionVerdict({ before, after: afterRevise.survey, anchors: afterRevise.anchors });
    if (!gate('an-actual-revision-was-committed', fRevise.pressed === true && report.revision.ok, report.revision))
      await stop('an-actual-revision-was-committed', report.revision);
    // Redraw along the signed LONG geometry from where the body actually stands.
    for (let i = 0; i < CG_ROUTE_LONG.length; i += 1) {
      const here = (await cgSnap(page))?.bodyCentre; const wp = [...CG_ROUTE_LONG[i]];
      if (here && distXZ(here, wp) < 1.0) continue;
      const leg = await walkTo(`long-${i}`, wp, { arrive: 0.7, budgetMs: 60000 });
      if (!leg.reached) { report.drawStop = { why: 'long-leg-not-reached', i, leg }; break; }
    }
    const afterLong = await snapStep('at-E-after-long-redraw');
    report.redrawn = classifyDrawnRoute({ samples: [(afterLong.body ?? [0, 0, 0])], walkedUnits: afterLong.survey?.walkedUnits ?? null, issued: 'LONG' });
    const fSpan2 = await pressAuthoredF('offer-the-revised-span', { expectedObjectiveId: 'ch13:survey:offer-span', verbPattern: /offer .*span/i });
    gate('revised-span-offered', fSpan2.pressed === true, { pressed: fSpan2.pressed, why: fSpan2.may?.why ?? null });
    const secondOutcome = await watchTest('revised-test', BUDGET.test, (r) => (r.anchors ?? []).includes('anc.cg.route-tested') || r.holdReason != null);
    report.secondTestOutcome = secondOutcome;
    report.verdict = (secondOutcome?.anchors ?? []).includes('anc.cg.route-tested')
      ? 'SHORT-NOT-DEMONSTRABLE-REVISED-TO-LONG' : 'SHORT-NOT-PROVEN';
  } else if (holdReason != null) {
    // ---- 6. the authored reference [F] and MAINTAINED occupancy -----------
    report.branch = 'witness-held';
    const beforeWitness = (await cgSnap(page))?.survey ?? null;
    const anchorsBefore = (await cgSnap(page))?.anchors ?? [];
    const uxHold = await uxRead(page);
    report.observations.holdUx = uxHold;
    // The witness objective's own marker publishes the pose to stand at. It is
    // read from live state, never assumed to be W.
    const cgH = await cgSnap(page);
    const witnessTarget = Array.isArray(cgH?.rail?.target) ? [...cgH.rail.target] : [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z];
    report.witnessTarget = { value: witnessTarget, source: Array.isArray(cgH?.rail?.target) ? 'live shipped witness marker' : 'CG_POSES.W quoted from frozen source' };
    const legWit = await walkTo('to-witness-point', witnessTarget, { arrive: Math.min(1.0, OCCUPANCY_RADIUS_UNITS) });
    const atWit = await snapStep('at-witness-point');
    if (!gate('arrived-inside-the-occupancy-cylinder', legWit.reached === true && (legWit.finalDistance ?? 9) <= OCCUPANCY_RADIUS_UNITS,
      { finalDistance: legWit.finalDistance, occupancyRadius: OCCUPANCY_RADIUS_UNITS })) await stop('arrived-inside-the-occupancy-cylinder', legWit);
    const fWitness = await pressAuthoredF('offer-this-end', { expectedObjectiveId: 'ch13:survey:witness', verbPattern: /offer this end/i });
    const afterWitness = await snapStep('after-F-witness');
    report.witnessOffer = newWitnessOfferVerdict({
      before: beforeWitness, after: afterWitness.survey, anchorsBefore, anchorsAfter: afterWitness.anchors, pressed: fWitness.pressed === true
    });
    if (!gate('a-NEW-authored-reference-was-offered-by-this-F', report.witnessOffer.isNewOffer, report.witnessOffer))
      await stop('a-NEW-authored-reference-was-offered-by-this-F', report.witnessOffer);

    // REMAIN. Occupancy is live and independent of the offer; the body does not
    // move again until the test completes or the budget ends.
    // ROOT-AUTHORIZED CORRECTION (1). The witness marker publishes a GROUND
    // pose, and commonGroundDirector evaluates occupancy as
    // nextOccupancy(body = commonGroundPlayerPose(), pose) — i.e. on the
    // PROJECTED FOOT pose, which the diagnostic already publishes as `bodyPose`.
    // That published foot pose is what is compared. The body CENTRE, the up
    // vector and the ground offset are recorded SEPARATELY as their own
    // measurements and are NOT used to synthesise a foot pose: if the runtime
    // did not publish one, the frame is 'unavailable' and the gate fails.
    const standFoot = Array.isArray(atWit.bodyPose) && atWit.bodyPose.every(Number.isFinite)
      ? [...atWit.bodyPose] : null;
    const standPoint = standFoot;
    const standPointFrame = standFoot ? 'foot' : 'unavailable';
    report.standFrame = {
      standPointFoot: standFoot,
      standPointFrame,
      bodyCentre: Array.isArray(atWit.bodyCentre) ? [...atWit.bodyCentre] : null,
      up: Array.isArray(atWit.up) ? [...atWit.up] : null,
      groundOffsetUnits: atWit.groundOffsetUnits ?? null,
      witnessPoseIsGroundFrame: true,
      source: 'window.__paravoxiaCommonGround.snapshot().bodyPose — published by the runtime, not derived here',
      derivedByProbe: false
    };
    const completed = await watchTest('held-test', BUDGET.hold, (r) => (r.anchors ?? []).includes('anc.cg.route-tested'));
    const occSeries = watch.filter((w) => w.label === 'held-test');
    report.occupancy = occupancyRequirementVerdict({
      samples: occSeries.map((w) => ({ witnessOccupied: w.witnessOccupied })),
      standPoint, standPointFrame, witnessPose: witnessTarget
    });
    gate('the-reference-was-actually-held-throughout', report.occupancy.ok, report.occupancy);
    const fin = await snapStep('after-held-test');
    report.recorderCounts = recorderCountRecord(fin);
    report.completion = shortCompletionVerdict({
      drawn: report.drawn, acceptedClass: fin.survey?.acceptedClass ?? null,
      acceptedSamples: fin.survey?.acceptedSamples ?? 0, anchors: fin.anchors ?? [], phase: fin.survey?.phase ?? null,
      recordedSamples: report.recorderCounts.recordedAtOfferFreeze
    });
    gate('SHORT-completed-as-the-held-reference-class', report.completion.ok, report.completion);
    report.verdict = report.completion.ok ? 'SHORT-HELD-REFERENCE-PROVEN' : report.completion.verdict;
    report.observations.completedOutcome = completed;
  } else {
    // The span completed with the fixed reference alone. That is a real
    // observation and it CONTRADICTS the shipped short-route expectation; it is
    // reported as a finding, never as a SHORT held-reference proof.
    report.branch = 'completed-without-a-witness';
    const fin = await snapStep('completed-without-witness');
    report.recorderCounts = recorderCountRecord(fin);
    report.completion = shortCompletionVerdict({
      drawn: report.drawn, acceptedClass: fin.survey?.acceptedClass ?? null,
      acceptedSamples: fin.survey?.acceptedSamples ?? 0, anchors: fin.anchors ?? [], phase: fin.survey?.phase ?? null,
      recordedSamples: report.recorderCounts.recordedAtOfferFreeze
    });
    gate('SHORT-completed-as-the-held-reference-class', report.completion.ok, report.completion);
    report.verdict = report.completion.ok ? 'SHORT-HELD-REFERENCE-PROVEN' : 'SHORT-COMPLETED-WITHOUT-HELD-REFERENCE-FINDING';
  }

  report.finalCg = await cgSnap(page);
  report.finalUx = await uxRead(page);
  // Raw passive observer records, kept verbatim as corroboration only.
  report.observations.rawInputObservation = await page.evaluate(entryObserverReadSource()).catch(() => null);
  report.observations.pageSinks = pageSinks;
} catch (err) {
  if (!err.gateStop) { report.verdict = 'ERROR'; report.error = String(err).slice(0, 400); }
  report.failure = failureRecord({ probe: 'short-survey-probe.mjs', error: err, phase: report.stoppedAt ?? 'capture' });
  say(`STOP: ${String(err).slice(0, 300)}`);
} finally {
  await guard.stopOnce('probe-finally');
  const cleanup = guard.cleanupReceipt({ probe: 'short-survey-probe.mjs' });
  report.cleanup = cleanup;
  report.closing = closingReceiptVerdict({
    cleanup, identity: report.identity ?? null,
    controlActiveRole: control?.activeRole ?? null, expectedRole: ACTIVE_ROLE
  });
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - t0;
  report.watchSamples = undefined;
  const body = JSON.stringify(report, null, 1);
  writeFileSync(join(outDir, 'summary.json'), body);
  writeFileSync(join(outDir, 'summary.sha256'), `${sha(body)}  summary.json\n`);
  say(`verdict=${report.verdict} out=${outDir}`);
}
process.exit(report.verdict === 'SHORT-HELD-REFERENCE-PROVEN' ? 0 : 2);
