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
import { LP_A, SITES, SINK_INSTALL, DRAIN, chainReturns, BUNDLE } from './creditCallLogpoints.mjs';
import { entryObserverSource, entryObserverReadSource, attachPassivePageSinks } from './entryObservation.mjs';
import {
  CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG, OCCUPANCY_VERTICAL_UNITS, SHIPPED_SHORT_PREDICATES, EXPECTED_CLASS_FOR,
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
const ACTIVE_ROLE = 'common-physical-discriminator';
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
    schema: 'paravoxia.verifier.arrivalCommonShort.refusal.v1', probe: 'common-physical-discriminator-probe.mjs',
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
  schema: 'paravoxia.verifier.commonPhysicalDiscriminator.v1',
  probe: 'common-physical-discriminator-probe.mjs', role: ACTIVE_ROLE, startedAt: new Date(t0).toISOString(),
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


  // ================= COMMON PHYSICAL DISCRIMINATOR STAGE =====================
  // Ordinary-input only. No teleport, no state setters, no movie assistance.
  const D = report.discriminator = {
    schema: 'paravoxia.verifier.commonPhysicalDiscriminator.stage.v1',
    prerequisiteVerdict: report.verdict ?? null,
    approach: null, atE: null, arming: null, vertices: [], records: null, analysis: null,
    clearanceChain: {
      bodyBodyClearanceInCreditChain: false,
      note: 'Body-body clearance is ABSENT from the pwe/Kme credit chain. Measured separately below; never fabricated as true.',
      measuredSeparately: null
    },
    stoppedAt: null
  };
  const rawCommon = async () => page.evaluate(`(()=>{try{const s=globalThis.__paravoxiaCommonGround&&globalThis.__paravoxiaCommonGround.snapshot();if(!s)return null;const d=s.diagnostic||{};return JSON.parse(JSON.stringify({beat:s.beat!==undefined?s.beat:(d.beat!==undefined?d.beat:null),common:d.common!==undefined?d.common:null,worker:d.worker!==undefined?d.worker:null,anchors:d.anchors!==undefined?d.anchors:(s.anchors||null),shape:{hasDiagnostic:!!s.diagnostic,keys:Object.keys(d)}}));}catch(e){return null;}})()`).catch(() => null);
  const footOf = async () => { const s = await cgSnap(page); return { foot: Array.isArray(s?.bodyPose) ? [...s.bodyPose] : null, bodyCentre: Array.isArray(s?.bodyCentre) ? [...s.bodyCentre] : null, up: Array.isArray(s?.up) ? [...s.up] : null, supported: s?.supported ?? null, groundOffsetUnits: s?.groundOffsetUnits ?? null }; };

  let drained_ = false;
  let cdpRef = null; let bpIds = []; let pausedRef = () => null;
  const drainAndAnalyse = async () => {
    if (drained_) return; drained_ = true;
      // ---- D. drain the bounded sink; chain ACTUAL returns --------------------
      // INSTRUMENTATION OFF FIRST. The retained pure function is invoked below;
    // if the logpoints were still armed, its own calls would append into the very
    // array being replayed and pollute the actual-input evidence.
    D.teardown = { removedBreakpoints: [], debuggerDisabled: false, pausedAfterWalk: pausedRef() };
    for (const id of bpIds) {
      const r = await cdpRef.send('Debugger.removeBreakpoint', { breakpointId: id }).then(() => 'removed').catch((e) => String(e).slice(0, 120));
      D.teardown.removedBreakpoints.push({ breakpointId: id, result: r });
    }
    await cdpRef.send('Debugger.disable').then(() => { D.teardown.debuggerDisabled = true; }).catch(() => {});
    // FREEZE the raw records into a separate immutable copy before ANY replay.
    const frozen = await page.evaluate(`(()=>{const s=globalThis.__cgXi;if(!s)return null;s.frozen=JSON.parse(JSON.stringify(s.rec));s.frozenCount=s.frozen.length;s.frozenDrop=s.drop;return s.frozenCount;})()`).catch(() => null);
    D.teardown.frozenRecordCount = frozen;
    const drained = await page.evaluate(DRAIN).catch(() => null);
      const parsed = drained ? JSON.parse(drained) : null;
      const calls = (parsed?.rec ?? []).filter((r) => r.k === 'call');
      const guards = (parsed?.rec ?? []).filter((r) => r.k === 'guard');
      const chained = chainReturns(calls);
      D.records = { count: parsed?.count ?? 0, dropped: parsed?.dropped ?? null, calleeCalls: calls.length, callerGuards: guards.length,
        pairing: { calleeMinusCaller: calls.length - guards.length,
          note: 'ACTUAL callee entry implies the walked/support + reference guard passed. An ABSENT call does NOT identify which guard failed.' } };
      writeFileSync(join(outDir, 'credit-records.raw.json'), JSON.stringify(parsed, null, 1));
      writeFileSync(join(outDir, 'credit-records.chained.json'), JSON.stringify(chained, null, 1));
      const gains = chained.filter((c) => c.arcGain != null);
      const positiveDisp = calls.filter((c) => c.disp > 0).length;
      const plateau = chained.length ? chained[chained.length - 1].prev : null;
      D.analysis = {
        calleeEntered: calls.length > 0,
        positiveDisplacementCalls: positiveDisp,
        lastObservedPrev: plateau,
        finalCallReturn: 'MISSING-final-call (never interpolated)',
        totalActualGain: gains.length ? gains.reduce((a, c) => a + c.arcGain, 0) : null,
        refusedByCeilingCount: chained.filter((c) => c.refusedByCeiling === true).length,
        plateauAtSix: plateau != null ? Math.abs(plateau - 6) < 1e-6 : null,
        numericGapToRouteUnits: plateau != null ? 18 - plateau : null,
        zeroGainLabel: 'QUALIFIED: an observed arcGain of 0 is an ACCOUNTING OBSERVATION, not a proven ceiling cause. Causality is claimed ONLY from the actual function replay below.',
      causalStatement: calls.length === 0
          ? 'NO callee record: the credit call was never reached on the measured leg. Which physical guard refused is NOT identified by absence.'
          : null
      };
      // ACTUAL replay of the REAL callee on the REAL captured arguments. This calls
    // the function captured by reference from its own scope, with the exact args
    // recorded at its own entry. Nothing is interpolated and no 60Hz is guessed.
    D.replay = await page.evaluate(`(()=>{try{const s=globalThis.__cgXi;if(!s||!s.fn)return {ok:false,why:'callee reference was never captured'};if(!s.frozen)return {ok:false,why:'records were not frozen before replay'};
      const src=s.frozen||[];const out=[];for(const r of src){if(r.k!=='call')continue;
        const foot={x:r.foot[0],y:r.foot[1],z:r.foot[2]};
        let v=null,err=null;try{v=s.fn(s.route,foot,r.prev,r.disp,r.corridor);}catch(e){err=String(e).slice(0,120);}
        out.push({n:r.n,prev:r.prev,disp:r.disp,foot:r.foot,replayReturned:v,err:err,
          gainOnReplay:(typeof v==='number')?v-r.prev:null,ceiling:r.prev+r.disp});}
      return {ok:true,n:out.length,replayedFrom:'frozen pre-teardown copy',liveGrewDuringReplay:s.rec.length-s.frozenCount,rows:out.slice(0,400)};}catch(e){return {ok:false,why:String(e).slice(0,200)};}})()`).catch((e) => ({ ok: false, why: String(e).slice(0, 200) }));
    if (D.replay?.ok) {
      const rows = D.replay.rows ?? [];
      const positive = rows.filter((r) => r.disp > 0);
      D.replay.summary = {
        replayedCalls: rows.length,
        positiveDisplacementCalls: positive.length,
        positiveWithZeroReplayGain: positive.filter((r) => r.gainOnReplay === 0).length,
        maxReplayGain: rows.length ? Math.max(...rows.map((r) => r.gainOnReplay ?? 0)) : null,
        interpretation: 'A positive ACTUAL displacement that the REAL function returns with zero gain is a falsifiable causal result about the projection, measured on real captured points.'
      };
      D.replay.summary.instrumentationOffBeforeReplay = D.teardown.debuggerDisabled === true;
      writeFileSync(join(outDir, 'credit-replay.json'), JSON.stringify(D.replay, null, 1));
    }
    // Body-body clearance measured SEPARATELY (absent from the credit chain).
      D.clearanceChain.measuredSeparately = { atFinalPose: (await footOf()), method: 'probe-measured distance only; no predicate call, no fabricated clearance=true' };
      emit({ phase: 'analysis', ...D.analysis });
      gate('callee-credit-call-actually-entered-on-measured-leg', calls.length > 0, D.analysis, { required: false });
  };

  try {
    if (!(report.verdict === 'SHORT-HELD-REFERENCE-PROVEN')) {
      D.stoppedAt = 'prerequisite-not-met';
      gate('common-prerequisite-held-reference-proven', false, { verdict: report.verdict });
      throw Object.assign(new Error('prerequisite'), { gateStop: true, stageOnly: true });
    }
    gate('common-prerequisite-held-reference-proven', true, { verdict: report.verdict });
    D.commonAfterHold = await rawCommon();
    await snapStep('common-stage-entry');

    // ---- A. grounded approach to E, AVOIDING walking through H(-40,12) ------
    // Candidate qualified path (reversed known LONG tail): S(-26,12) ->
    // (-26,22) -> (-42,22) -> E(-42,12). Support is VERIFIED, never assumed.
    const APPROACH = [
      ['approach-S', [CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z]],
      ['approach-N', [-26, CG_POSES.S.y, 22]],
      ['approach-W22', [-42, CG_POSES.S.y, 22]],
      ['approach-E', [CG_POSES.E.x, CG_POSES.E.y, CG_POSES.E.z]]
    ];
    const legsA = [];
    for (const [label, tgt] of APPROACH) {
      const leg = await walkTo(label, tgt, { arrive: 0.9, budgetMs: 70000 });
      const pose = await footOf();
      const near = pose.foot ? Math.hypot(pose.foot[0] - CG_POSES.H.x, pose.foot[2] - CG_POSES.H.z) : null;
      legsA.push({ label, target: tgt, reached: leg.reached, finalDistance: leg.finalDistance, pose, distanceToH: near });
      emit({ phase: 'approach-leg', label, reached: leg.reached, pose, distanceToH: near });
      if (!leg.reached) break;
    }
    D.approach = { route: 'S -> (-26,22) -> (-42,22) -> E(-42,12) [reversed qualified LONG tail]', legs: legsA,
      avoidedH: legsA.every((l) => l.distanceToH == null || l.distanceToH > 1.5) };
    const eLeg = legsA[legsA.length - 1];
    const ePose = await footOf();
    D.atE = { pose: ePose, common: await rawCommon(), reached: eLeg?.label === 'approach-E' && eLeg.reached === true,
      footYSigned: ePose.foot ? ePose.foot[1] : null };
    await snapStep('at-E-grounded');
    const eOk = D.atE.reached === true && ePose.supported === true && Array.isArray(ePose.foot)
      && Math.abs(ePose.foot[1] - 51.05) < 0.25
      && Math.hypot(ePose.foot[0] - CG_POSES.E.x, ePose.foot[2] - CG_POSES.E.z) <= 1.0;
    if (!gate('grounded-supported-E-reached-by-ordinary-keys', eOk, D.atE)) {
      D.stoppedAt = 'E-prerequisite-failed';
      throw Object.assign(new Error('E prerequisite'), { gateStop: true, stageOnly: true });
    }

    // ---- A2. ACTUAL common-stage prerequisite, read from the real provider ---
    // The previous holding may finish during the approach, so it is CHECKED here,
    // never assumed from the earlier held-reference verdict.
    let pre2 = null; const tP2 = Date.now();
    while (Date.now() - tP2 < 20000) {
      pre2 = await rawCommon();
      const anc = pre2?.anchors ?? [];
      if (pre2?.beat === 'ch13-common' && pre2?.common?.stage === 'holding-h'
        && anc.some((a) => String(a).includes('reciprocal-reference'))) break;
      await sleep(700);
    }
    const wk = pre2?.worker ?? null;
    // commonGroundActorPosition publishes an actual CommonGroundPoint OBJECT
    // {x,y,z} (commonGroundActor.ts:304, getCommonGroundDiagnostic:1785). Read the
    // real finite components; never guess a wk.atH boolean.
    const wp = wk && wk.position && typeof wk.position === 'object' ? wk.position : null;
    const wpOk = !!wp && [wp.x, wp.y, wp.z].every(Number.isFinite);
    const wHoriz = wpOk ? Math.hypot(wp.x - CG_POSES.H.x, wp.z - CG_POSES.H.z) : null;
    const wVert = wpOk ? Math.abs(wp.y - CG_POSES.H.y) : null;
    const workerAtH = wpOk ? (wHoriz <= OCCUPANCY_RADIUS_UNITS && wVert <= OCCUPANCY_VERTICAL_UNITS) : null;
    D.commonStagePrerequisite = {
      beat: pre2?.beat ?? null, stage: pre2?.common?.stage ?? null,
      anchors: pre2?.anchors ?? null, worker: wk, workerPosition: wp, workerPositionFinite: wpOk,
      workerHorizontalToH: wHoriz, workerVerticalToH: wVert, workerAtH,
      hBounds: { radius: OCCUPANCY_RADIUS_UNITS, vertical: OCCUPANCY_VERTICAL_UNITS },
      providerShape: pre2?.shape ?? null,
      required: { beat: 'ch13-common', stage: 'holding-h', anchor: 'reciprocal-reference', workerAtH: true }
    };
    const stageOk = pre2?.beat === 'ch13-common' && pre2?.common?.stage === 'holding-h'
      && (pre2?.anchors ?? []).some((a) => String(a).includes('reciprocal-reference'))
      && workerAtH === true;
    if (!gate('actual-common-stage-holding-h-with-reciprocal-reference-and-worker-atH', stageOk, D.commonStagePrerequisite)) {
      D.stoppedAt = 'common-stage-prerequisite-failed';
      throw Object.assign(new Error('common stage prerequisite'), { gateStop: true, stageOnly: true });
    }

    // ---- B. arm bounded LP-A (callee) and LP-B (caller) ---------------------
    const cdp = await page.context().newCDPSession(page); cdpRef = cdp;
    let pausedCount = 0; pausedRef = () => pausedCount; const pausedEvents = [];
    cdp.on('Debugger.paused', (ev) => { pausedCount += 1; if (pausedEvents.length < 5) pausedEvents.push({ reason: ev.reason }); cdp.send('Debugger.resume').catch(() => {}); });
    const scripts = new Map();
    cdp.on('Debugger.scriptParsed', (ev) => { if (ev.url && ev.url.includes('index-BiDWGouH')) scripts.set(ev.url, ev.scriptId); });
    // Debugger.enable replays scriptParsed for ALREADY-parsed scripts. NO reload:
    // a reload would destroy the earned COMMON state this leg depends on.
    await cdp.send('Debugger.enable');
    await sleep(600);
    const sinkState = await page.evaluate(SINK_INSTALL);
    const bundleUrl = new URL(BUNDLE.path, URL_ARG).toString();
    const urlRegex = 'index-BiDWGouH\\.js$';
    const rx = new RegExp(urlRegex);
    D.urlBinding = {
      bundleUrl, urlRegex,
      matchesActualBundle: rx.test(bundleUrl),
      rejectsWrongBundle: !rx.test(new URL('/assets/index-WRONGBUNDLE.js', URL_ARG).toString()),
      escapeCheck: urlRegex.indexOf('\\\\.') === -1
    };
    if (!gate('bundle-url-regex-actually-matches-and-rejects', D.urlBinding.matchesActualBundle === true && D.urlBinding.rejectsWrongBundle === true && D.urlBinding.escapeCheck === true, D.urlBinding)) {
      D.stoppedAt = 'url-binding-failed';
      throw Object.assign(new Error('url binding'), { gateStop: true, stageOnly: true });
    }
    // ONE breakpoint at the exact callee site. CDP can refuse a duplicate exact
    // location, so the function capture and the LP-A record share a single
    // condition. Still no call, no predicate, no game mutation; ends in false.
    const LP_A_COMBINED = LP_A.condition.replace(
      `const s=globalThis.__cgXi;if(!s)return false;`,
      `const s=globalThis.__cgXi;if(!s)return false;if(!s.fn&&typeof pwe!=='undefined'){s.fn=pwe;s.route=e;}`);
    if (LP_A_COMBINED === LP_A.condition) throw Object.assign(new Error('LP-A combine failed'), { gateStop: true, stageOnly: true });
    const bpA = await cdp.send('Debugger.setBreakpointByUrl', {
      lineNumber: SITES.creditEntry.lineNumber, columnNumber: SITES.creditEntry.columnNumber,
      url: bundleUrl, condition: LP_A_COMBINED
    }).catch((e) => ({ error: String(e).slice(0, 200) }));
    const LP_B_CONDITION = `(()=>{try{const s=globalThis.__cgXi;if(!s)return false;`
      + `s.push({k:'guard',n:s.rec.length,t:performance.now(),`
      + `prevFoot:(g&&g.x!==undefined)?[g.x,g.y,g.z]:null,`
      + `curFoot:(i&&i.x!==undefined)?[i.x,i.y,i.z]:null,`
      + `delta:I,terra:(t&&t.terraUnits!==undefined)?t.terraUnits:null});`
      + `}catch(_){}return false;})()`;
    const bpB = await cdp.send('Debugger.setBreakpointByUrl', {
      lineNumber: 7839, columnNumber: 219885, url: bundleUrl, condition: LP_B_CONDITION
    }).catch((e) => ({ error: String(e).slice(0, 200) }));
    D.arming = {
      bundle: BUNDLE.path, bundleSha256: BUNDLE.sha256, sinkState,
      lpA: { site: SITES.creditEntry, breakpointId: bpA?.breakpointId ?? null, locations: bpA?.locations ?? null, error: bpA?.error ?? null, pausesExecution: false },
      lpB: { site: { lineNumber: 7839, columnNumber: 219885 }, breakpointId: bpB?.breakpointId ?? null, locations: bpB?.locations ?? null, error: bpB?.error ?? null, pausesExecution: false },
      condition: { lpACombined: LP_A_COMBINED, lpB: LP_B_CONDITION,
        combinedNote: 'function capture + record share ONE condition at the exact callee site to avoid a duplicate-location refusal' },
      note: 'Instrumentation deopt changes frame distribution; ACTUAL deltas remain actual.'
    };
    bpIds = [bpA?.breakpointId, bpB?.breakpointId].filter(Boolean);
    emit({ phase: 'arming', ...D.arming });
    const wantScriptId = scripts.get(bundleUrl) ?? [...scripts.values()][0] ?? null;
    const exact = (bp, ln, col) => {
      const locs = bp?.locations ?? [];
      // An UNOBSERVED scriptId is a FAILURE, never a pass.
      if (!wantScriptId) return false;
      return locs.length > 0 && locs.every((l) => l.lineNumber === ln && l.columnNumber === col
        && l.scriptId === wantScriptId);
    };
    D.arming.scriptId = wantScriptId;
    D.arming.parsedScripts = [...scripts.entries()].map(([u, id]) => ({ url: u, scriptId: id }));
    D.arming.exactResolution = {
      lpA: exact(bpA, SITES.creditEntry.lineNumber, SITES.creditEntry.columnNumber),
      lpB: exact(bpB, 7839, 219885),
      lpALocations: bpA?.locations ?? null, lpBLocations: bpB?.locations ?? null
    };
    D.arming.pausedObserved = { count: pausedCount, events: pausedEvents,
      note: 'OBSERVED, not assumed: every condition ends in false so the debugger should never pause.' };
    const armedOk = !!bpA?.breakpointId && !!bpB?.breakpointId
      && D.arming.exactResolution.lpA === true && D.arming.exactResolution.lpB === true
      && pausedCount === 0;
    if (!gate('LP-A-and-LP-B-armed-without-relocation', armedOk, D.arming)) {
      D.stoppedAt = 'arming-failed';
      throw Object.assign(new Error('arming'), { gateStop: true, stageOnly: true });
    }

    // ---- C. walk ORIGINAL COMMON vertices 1..4 with ordinary WASD pulses ----
    const CG_ROUTE_COMMON = [
      [-42, 51.05, 12], [-42, 51.05, 14], [-42, 51.05, 16],
      [-44, 51.05, 16], [-44, 51.05, 18]
    ];
    const OVERSHOOT_AIM = 0.15; const OVERSHOOT_MAX = 0.35;
    const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
    for (let vi = 1; vi <= 4; vi += 1) {
      const prev = CG_ROUTE_COMMON[vi - 1]; const v = CG_ROUTE_COMMON[vi];
      const inc = unit2([v[0] - prev[0], v[2] - prev[2]]);
      const planeS = (p) => dot2([p[0] - v[0], p[2] - v[2]], inc); // >0 == PAST the incoming plane
      const rec = { vertex: vi, target: v, incomingDir: inc, pulses: [], crossed: false, finalS: null, finalFoot: null, supported: null, commonBefore: await rawCommon() };
      const t0v = Date.now();
      while (Date.now() - t0v < 60000) {
        const pose = await footOf(); const p = pose.foot ?? pose.bodyCentre;
        if (!p) break;
        const s = planeS(p); rec.finalS = s; rec.finalFoot = p; rec.supported = pose.supported;
        if (s >= 0.05 && s <= OVERSHOOT_MAX) { rec.crossed = true; break; }
        if (s > OVERSHOOT_MAX) { rec.crossed = true; rec.overshootExceeded = true; break; }
        // Aim at the AIM POINT (vertex + incoming * 0.15), so a body that is past
        // the vertex but short of the required positive overshoot keeps moving
        // FORWARD along the incoming direction instead of steering backwards.
        const aimPt = [v[0] + inc[0] * OVERSHOOT_AIM, v[1], v[2] + inc[1] * OVERSHOOT_AIM];
        const want = unit2([aimPt[0] - p[0], aimPt[2] - p[2]]) ?? inc;
        const remain = OVERSHOOT_AIM - s;
        const pick = chooseKey(dirs, want);
        if (!pick.key) { rec.stopReason = 'no-directional-key'; break; }
        const planned = planPulseMs({ distance: Math.abs(remain), arrive: 0.02, unitsPerMs, coastUnits });
        // ORDINARY pulse floor: >=30ms. Never sub-frame precision input.
        const ms = Math.max(30, Math.min(planned.ms ?? 60, 400));
        const before = p;
        await page.keyboard.down(pick.key); await sleep(ms); await page.keyboard.up(pick.key); await sleep(120);
        const after = (await footOf()).foot;
        // Clamped-pulse displacement is compared, NOT full remaining command distance.
        const clampedDisplacement = after && before ? distXZ(before, after) : null;
        rec.pulses.push({ key: pick.key, ms, before, after, clampedDisplacement, sBefore: s, sAfter: after ? planeS(after) : null });
        if (rec.pulses.length > 120) { rec.stopReason = 'pulse-budget'; break; }
      }
      rec.commonAfter = await rawCommon();
      rec.poseAfter = await footOf();
      D.vertices.push(rec);
      emit({ phase: 'vertex', vertex: vi, crossed: rec.crossed, finalS: rec.finalS, supported: rec.supported, common: rec.commonAfter });
      say(`VERTEX ${vi} crossed=${rec.crossed} s=${rec.finalS == null ? 'unavailable' : rec.finalS.toFixed(3)} supported=${rec.supported} terra=${rec.commonAfter?.common?.terraUnits ?? 'unavailable'}`);
      const vOk = rec.crossed === true && rec.finalS != null && rec.finalS > 0
        && rec.finalS <= OVERSHOOT_MAX && rec.supported === true;
      gate(`vertex-${vi}-crossed-with-bounded-positive-overshoot`, vOk,
        { finalS: rec.finalS, supported: rec.supported, pulses: rec.pulses.length });
      if (!vOk) {
        // Later vertices DEPEND on this one; walking them would not be a real leg.
        D.stoppedAt = `vertex-${vi}-bound-or-support-failed`;
        rec.stoppedDependentWalk = true;
        say(`STOPPING dependent walk after vertex ${vi}`);
        break;
      }
    }

    await drainAndAnalyse();
  } catch (stageErr) {
    if (!stageErr.stageOnly) { D.stageError = String(stageErr).slice(0, 300); }
    say(`DISCRIMINATOR STAGE STOP: ${D.stoppedAt ?? String(stageErr).slice(0, 160)}`);
    // No missing evidence from a throw: if anything was ARMED, drain and retain it.
    if (D.arming?.lpA?.breakpointId) {
      try { await drainAndAnalyse(); } catch (e2) { D.drainError = String(e2).slice(0, 200); }
    }
  }
  // ================= END DISCRIMINATOR STAGE =================================

  report.finalCg = await cgSnap(page);
  report.finalUx = await uxRead(page);
  // Raw passive observer records, kept verbatim as corroboration only.
  report.observations.rawInputObservation = await page.evaluate(entryObserverReadSource()).catch(() => null);
  report.observations.pageSinks = pageSinks;
} catch (err) {
  if (!err.gateStop) { report.verdict = 'ERROR'; report.error = String(err).slice(0, 400); }
  report.failure = failureRecord({ probe: 'common-physical-discriminator-probe.mjs', error: err, phase: report.stoppedAt ?? 'capture' });
  say(`STOP: ${String(err).slice(0, 300)}`);
} finally {
  await guard.stopOnce('probe-finally');
  const cleanup = guard.cleanupReceipt({ probe: 'common-physical-discriminator-probe.mjs' });
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
