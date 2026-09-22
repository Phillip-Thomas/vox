#!/usr/bin/env node
/**
 * common-passage-probe.mjs — ONE bounded manual COMMON-passage probe.
 *
 * NOT RUN by its author. Prepared under a verifier control hold and
 * verification-ready=false; it refuses to launch a browser while either holds.
 *
 * WHAT IT EARNS, IN ORDER, THROUGH ORDINARY INPUT ONLY
 *   phase A  readiness + identity + real canvas click + pointer lock + key receipts
 *   phase B  survey: walk to W, [F]; walk to S, [F]; draw the authored long route
 *            to E; [F] offer the span; answer the authored witness hold at W with
 *            the authored [F]; wait for anc.cg.route-tested and beat ch13-common
 *   phase C  reciprocal: W-7744 holds H; Terra walks the ordered E->C common route
 *            (10 vertices, 18 units) with live credited-progress sampling
 *              --mode reference  : clean ordered route, no deviation
 *              --mode deviation  : early turn at z 15.82 BEFORE the z=16 corner,
 *                                  far-end excursion (must buy nothing), ordinary
 *                                  return to the unfinished frontier, physical
 *                                  traversal of the omitted ground, no extra F,
 *                                  no reset
 *   phase D  far reference: walk to T, verify objective + [F] Offer this end, press F
 *   phase E  release: hold occupancy at T while W walks H->E and tests all 18 units;
 *            assert workerUnits >= 18, committed, complete/handback anchors
 *
 * LANE: manual. No movie=1, no autopilot, no teleport, no forced click, no rail
 * target derivation, no pose/progress/anchor writes, no geometry or tolerance
 * change, no saved-proof grant. Every metre is a held key; every arrival is a
 * measured distance; a failed leg STOPS the probe before any later F or action and
 * is never labelled arrived.
 *
 * FIXTURE LABEL: entry is `?story=ch13-survey`, a deep labelled fixture. It is NOT
 * full-story continuity, NOT an earned Continue, and NOT first-time naive UX; the
 * route waypoints were read from frozen chapter source.
 *
 * ARRIVAL LANE COPY (2026-09-06). Byte-copied from
 * verifier/probes/common-manual-focused/common-passage-probe.mjs, which was NOT
 * edited. Differences: activeRole is `arrival-common-manual`, shared verifier
 * helpers are PINNED into this folder, `--out` must be ABSOLUTE, and a PASSIVE
 * entry observation (console/pageerror, pointerlockchange/error, click
 * isTrusted/pointerType/sourceCapabilities/target/currentTarget, focus/touch/
 * policy state) is recorded around the UNCHANGED ordinary-click gate.
 *
 * UNEXECUTED CLI EXAMPLE — placeholders only; this command has NOT been run and
 * MUST NOT be copied verbatim. Every value below is a placeholder that the
 * runtime owner replaces with the CURRENT root-published facts at release; the
 * old 38007 port and the old dc63fba… manifest are NOT defaults here.
 *
 *   flock -x <ABS_HEAVY_LOCK_PATH> -c '\
 *     node verifier/probes/arrival-common-manual/common-passage-probe.mjs \
 *       --mode reference \
 *       --url <CURRENT_ROOT_PUBLISHED_URL> \
 *       --expect-source-manifest <CURRENT_SOURCE_MANIFEST_SHA256> \
 *       --expect-index-sha <CURRENT_SERVED_INDEX_SHA256> \
 *       --heavy-lock <ABS_HEAVY_LOCK_PATH> --heavy-lock-fd <INHERITED_FD> \
 *       --out <ABSOLUTE_FRESH_CAPTURE_DIR>'
 *
 * The probe refuses to launch unless verifier-control.json has released
 * activeRole `arrival-common-manual`, verification-ready.json is ready, the
 * heavy lock is a PROVEN inherited exclusive flock, and the CURRENT served
 * index/bundle bytes bind to the CURRENT source manifest.
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
// PINNED copies of the shared verifier helpers (see pin.json in this folder).
// Concurrent roles may edit verifier/probes/lib/* while this lane runs; this
// probe binds to bytes it owns. They sit at the SAME directory depth as the
// originals, so cgContract's RUN_DIR/REPO_ROOT resolution is unchanged.
import { ART, RUN_DIR, REPO_ROOT } from './cgContract.pinned.mjs';
import { createOwnedSessionGuard, failureRecord } from './ownedSession.pinned.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from './sourceSnapshot.pinned.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
import {
  entryObserverSource, entryObserverReadSource, summariseClickObservation,
  entryObservationVerdict, attachPassivePageSinks
} from './entryObservation.mjs';
import {
  CG_POSES, CG_ROUTE_COMMON, CG_ROUTE_LONG, CG_COMMON_ROUTE_UNITS, EARLY_TURN_POINT,
  CG_F_CONTRACT, BODY_BODY_CLEARANCE_UNITS,
  bodyUsable, settled, directionsDistinct, chooseKey, unit2, distXZ, dist3, keyReceipt,
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision,
  preflightDecision, identityVerdict, promptOffersF, mayPressF, legVerdict, makeProgressTracker,
  planPulseMs, detectOscillation, standClearChoice, minClearanceToSpan,
  passageVerdict, recoveryVerdict, clearanceBetween, poseReading, orUnavailable, clickPointFromRect,
  incomingPlaneAt, signedPlaneOffset, planeLateralOffset, planeCrossingVerdict,
  orderedFrontierVerdict, earlyTurnVerdict, PLANE_LATERAL_LIMIT_UNITS, PLANE_MAX_OVERSHOOT_UNITS
} from './commonPassageLogic.mjs';

const P = [...process.argv.slice(2)];
const arg = (n, d = null) => { const i = P.indexOf(`--${n}`); return i >= 0 && P[i + 1] && !P[i + 1].startsWith('--') ? P[i + 1] : d; };
const flag = (n) => P.includes(`--${n}`);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

const MODE = arg('mode', 'reference');
if (!['reference', 'deviation'].includes(MODE)) { console.error(`unknown --mode ${MODE}`); process.exit(64); }

const t0 = Date.now();
const outArg = arg('out', null);
// ABSOLUTE --out is REQUIRED (arrival lane): a relative capture path resolves
// against RUN_DIR here but against the shell's cwd in an operator's head, and a
// mismatch silently writes evidence somewhere nobody reads. Refuse instead.
if (outArg !== null && !isAbsolute(outArg)) {
  console.error(`--out must be an ABSOLUTE path; got ${outArg}`);
  process.exit(64);
}
const outDir = outArg;
const say = (m) => console.log(`[cmp] ${new Date().toISOString()} +${Date.now() - t0}ms ${m}`);

// ---------------------------------------------------------------- preflight ----
// Pure, file-driven, BEFORE any browser exists.
const ready = readJson(resolve(RUN_DIR, 'verification-ready.json'));
const control = readJson(resolve(RUN_DIR, 'verifier-control.json'));
const lockPath = arg('heavy-lock', process.env.PARAVOXIA_HEAVY_LOCK ?? null);
// The lock must be an ALREADY-acquired exclusive flock inherited as a descriptor.
// A path that merely exists proves nothing; see heavyLockOwnership.
const lockFdArg = arg('heavy-lock-fd', process.env.PARAVOXIA_HEAVY_LOCK_FD ?? null);
const heavyLock = heavyLockOwnership({
  lockPath,
  fd: lockFdArg === null ? null : Number.parseInt(String(lockFdArg), 10),
  probeContention: flag('probe-lock-contention')
});

// Bind the ACTUAL served bytes to root's published preview ownership BEFORE any
// browser exists: title/liveness is not current-build identity.
const previewOwnership = readJson(resolve(ART, 'preview-ownership.json'));
const served = arg('url', null)
  ? await fetchServedIdentity({ url: arg('url', null), bundlePath: previewOwnership?.bundlePath ?? null })
  : null;
const previewBinding = previewBindingDecision({
  ownership: previewOwnership,
  url: arg('url', null),
  expectSourceManifestSha: arg('expect-source-manifest', null),
  served
});

const ACTIVE_ROLE = 'arrival-common-manual';
const pre = preflightDecision({
  ready, control,
  role: ACTIVE_ROLE,
  url: arg('url', null),
  out: outArg,
  heavyLock,
  previewBinding,
  expectSourceManifestSha: arg('expect-source-manifest', null),
  liveSourceManifestSha: (readJson(resolve(RUN_DIR, 'implementation-source-manifest.json')) ? sha(readFileSync(resolve(RUN_DIR, 'implementation-source-manifest.json'))) : null)
});
if (!pre.launch) {
  const refusal = {
    schema: 'paravoxia.verifier.commonPassage.refusal.v1',
    probe: 'common-passage-probe.mjs', mode: MODE,
    at: new Date().toISOString(), launched: false, verdict: 'REFUSED-PREREQUISITE',
    refusals: pre.refusals,
    heavyLock: { lockPath: heavyLock.lockPath, fd: heavyLock.fd, owned: heavyLock.owned, problems: heavyLock.problems, procLock: heavyLock.procLock, contentionProbe: heavyLock.contentionProbe },
    previewBinding
  };
  console.error(JSON.stringify(refusal, null, 1));
  if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'refusal.json'), JSON.stringify(refusal, null, 1)); }
  say(`REFUSED before any browser launch: ${pre.refusals.join(' | ')}`);
  process.exit(3);
}

assertFreshOutputDir(outDir, { what: 'arrival-common-manual capture' });
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
const emit = (rec) => appendFileSync(tracePath, `${JSON.stringify({ atMs: Date.now() - t0, at: new Date().toISOString(), ...rec })}\n`);

const URL_ARG = arg('url');
const BUDGET = {
  ready: Number(arg('ready-ms', '120000')),
  leg: Number(arg('leg-ms', '90000')),
  survey: Number(arg('survey-ms', '420000')),
  common: Number(arg('common-ms', '480000')),
  release: Number(arg('release-ms', '300000')),
  witnessWatch: Number(arg('watch-ms', '120000'))
};

const report = {
  schema: 'paravoxia.verifier.commonPassage.v1',
  probe: 'common-passage-probe.mjs', role: 'arrival-common-manual', mode: MODE,
  startedAt: new Date(t0).toISOString(),
  lane: 'MANUAL — ordinary held keys only; no movie=1, no autopilot, no teleport, no forced click, no rail-derived target',
  fixture: 'LABELLED FIXTURE: deep entry ?story=ch13-survey. Not full-story continuity, not an earned Continue, not first-time naive UX.',
  privateKnowledge: 'Route waypoints were read from frozen chapter source; this run cannot support any first-time-usability claim.',
  url: URL_ARG, budgets: BUDGET,
  gates: [], legs: [], steps: [], fPresses: [],
  verdict: 'INCOMPLETE', stoppedAt: null,
  reciprocal: null, recovery: null, release: null
};
const gate = (name, ok, detail) => {
  const g = { name, ok: ok === true, detail, at: new Date().toISOString() };
  report.gates.push(g); emit({ gate: g });
  say(`GATE ${g.ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail).slice(0, 280)}`);
  return g.ok;
};

const guard = createOwnedSessionGuard({ log: say, label: 'arrival-common-manual session' });
let page = null;
let logStreamEnded = false;

const stop = async (name, detail) => {
  report.verdict = report.verdict === 'INCOMPLETE' ? 'STOPPED-PREREQUISITE' : report.verdict;
  report.stoppedAt = name; report.stopDetail = detail ?? null;
  if (page) {
    const png = await page.screenshot().catch(() => null);
    if (png) writeFileSync(join(outDir, `stop-${name}.png`), png);
    report.stopState = {
      cg: await cgSnap(page).catch(() => null),
      state: await readState(page).catch(() => null),
      control: await controlProbe(page).catch(() => null)
    };
  }
  throw Object.assign(new Error(`stopped at ${name}: ${JSON.stringify(detail).slice(0, 280)}`), { gateStop: true });
};

// ------------------------------------------------------------ page readers ----
const cgSnap = (p) => p.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  const d = s.diagnostic ?? {};
  return {
    beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, up: s.up,
    groundOffsetUnits: s.groundOffsetUnits, supported: s.supported, worldBound: s.worldBound,
    rail: s.rail, railCursor: s.railCursor,
    holdReason: d.holdReason ?? null, anchors: d.anchors ?? [],
    survey: d.survey ?? null, common: d.common ?? null,
    worker: d.worker ? { leg: d.worker.leg, travelled: d.worker.travelled, held: d.worker.held, position: d.worker.position } : null,
    pendingAnchors: s.pendingAnchors ?? []
  };
});
const controlProbe = (p) => p.evaluate(() => {
  const canvas = document.querySelector('canvas');
  return {
    title: document.title,
    pointerLockIsCanvas: !!canvas && document.pointerLockElement === canvas,
    hasFocus: document.hasFocus(),
    // DIAGNOSTICS ONLY (they gate nothing): why an ordinary click did or did not lock.
    pointerLockElement: document.pointerLockElement
      ? `${document.pointerLockElement.tagName.toLowerCase()}${document.pointerLockElement.id ? `#${document.pointerLockElement.id}` : ''}`
      : null,
    activeElement: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
    visibility: document.visibilityState,
    elementAtCanvasCentre: (() => {
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { tag: el.tagName.toLowerCase(), isCanvas: el === canvas, cls: (el.className || '').toString().slice(0, 60), pointerEvents: cs.pointerEvents, zIndex: cs.zIndex };
    })(),
    policy: window.__storyInputPolicy
      ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode }
      : null,
    autopilotPresent: !!window.__autopilot,
    movieFlag: new URLSearchParams(location.search).get('movie'),
    canvasRect: canvas ? (({ x, y, width, height }) => ({ x, y, width, height }))(canvas.getBoundingClientRect()) : null,
    hotkeyActivations: (() => { try { return window.__paravoxiaJourneyProbe?.snapshot?.()?.input?.hotkeyActivations ?? null; } catch { return null; } })()
  };
});
const workerPos = (s) => (s?.worker?.position ? [s.worker.position.x, s.worker.position.y, s.worker.position.z] : null);
const poseOf = (s) => poseReading(s).bodyPose ?? s?.bodyCentre ?? null;

const snapState = async (label) => {
  const st = await readState(page).catch(() => null);
  const s = await cgSnap(page).catch(() => null);
  const pr = poseReading(s);
  const wp = workerPos(s);
  const rec = {
    label, beat: st?.beat ?? null, objectiveId: st?.objectiveId ?? null, markerLabel: st?.markerLabel ?? null,
    hudText: st?.hudText ?? null, prompts: st?.interactionPrompts ?? [],
    anchors: s?.anchors ?? [], holdReason: s?.holdReason ?? null,
    bodyCentre: pr.bodyCentre, bodyPose: pr.bodyPose, groundOffsetUnits: pr.groundOffsetUnits,
    supported: pr.supported, survey: s?.survey ?? null, common: s?.common ?? null,
    worker: s?.worker ?? null,
    bodyClearance: pr.bodyPose && wp ? clearanceBetween(pr.bodyPose, wp) : null,
    rail: s?.rail ?? null, railCursor: s?.railCursor ?? null
  };
  report.steps.push(rec); emit({ phase: 'state', ...rec });
  say(`[${label}] obj=${orUnavailable(rec.objectiveId)} common=${JSON.stringify(rec.common)} pose=${JSON.stringify(rec.bodyPose)} supported=${orUnavailable(rec.supported)}`);
  const png = await page.screenshot().catch(() => null);
  if (png) writeFileSync(join(outDir, `${String(report.steps.length).padStart(3, '0')}-${label}.png`), png);
  return rec;
};

// ------------------------------------------------------------------ main ------
try {
  const previewOwn = previewOwnership;
  report.previewOwnership = previewOwn
    ? { state: previewOwn.state ?? null, url: previewOwn.url ?? null, bundlePath: previewOwn.bundlePath ?? null, indexSha256: previewOwn.indexSha256 ?? null, bundleSha256: previewOwn.bundleSha256 ?? null }
    : 'unavailable';
  report.heavyLock = { lockPath: heavyLock.lockPath, fd: heavyLock.fd, owned: heavyLock.owned, procLock: heavyLock.procLock, ancestors: heavyLock.ancestors, contentionProbe: heavyLock.contentionProbe };
  report.servedIdentity = served;
  report.previewBinding = previewBinding;
  const previewRef = { url: URL_ARG, stop() { /* the shared preview is owned externally by root */ } };

  const beforeSnapshot = writeSourceSnapshot({
    entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
    note: 'Exact bytes of this probe and its libraries at launch (before-run binding).'
  });
  report.probeSnapshotBefore = snapshotRef(beforeSnapshot);

  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1', preview: previewRef, build: false,
    viewport: { width: 1280, height: 720 }, log: say
  }));
  page = session.page; report.entryUrl = session.url; report.renderer = session.renderer; report.headed = session.headed;
  // PASSIVE entry observation (added for the arrival lane). Console/pageerror
  // sinks are attached FIRST so anything emitted during readiness is captured.
  // Nothing here requests pointer lock, forces a click, patches a handler,
  // injects key state or edits focus/permission policy; no retry or timeout
  // changes, because the prior 16:31 failure cause is UNKNOWN, not diagnosed.
  const pageSinks = attachPassivePageSinks(page, { max: 400 });
  let observerInstall = null;
  try { observerInstall = await page.evaluate(entryObserverSource()); }
  catch (e) { observerInstall = { installed: false, error: String(e?.message ?? e) }; }
  emit({ phase: 'entry-observer-install', observerInstall });
  say(`entry observer install: ${JSON.stringify(observerInstall)}`);
  await waitReady(page, { timeoutMs: BUDGET.ready });
  await page.bringToFront();

  let ctl = await controlProbe(page);
  const ident = identityVerdict({
    title: ctl.title, renderer: session.renderer, headed: session.headed,
    // MEASURED served index bytes, bound to root's published expected hash.
    indexSha: served?.indexSha256 ?? null,
    expectIndexSha: arg('expect-index-sha', previewOwnership?.indexSha256 ?? null)
  });
  if (!gate('browser-identity-is-paravoxia-on-hardware', ident.ok, { title: ctl.title, renderer: session.renderer, headed: session.headed, indexSha: served?.indexSha256 ?? null, problems: ident.problems }))
    await stop('browser-identity-is-paravoxia-on-hardware', ident);
  if (!gate('manual-lane', ctl.movieFlag !== '1' && ctl.autopilotPresent === false, { movieFlag: ctl.movieFlag, autopilotPresent: ctl.autopilotPresent }))
    await stop('manual-lane', ctl);

  // ---- A. finite, NON-initial, settled, supported body + world ready ---------
  let cg = null; const tw = Date.now();
  while (Date.now() - tw < BUDGET.ready) { cg = await cgSnap(page); if (cg?.worldBound && bodyUsable(poseOf(cg) ?? []).ok) break; await sleep(400); }
  if (!gate('world-bound-and-noninitial-body', !!cg?.worldBound && bodyUsable(poseOf(cg) ?? []).ok, { worldBound: cg?.worldBound ?? 'unavailable', bodyPose: cg?.bodyPose ?? 'unavailable', bodyCentre: cg?.bodyCentre ?? 'unavailable' }))
    await stop('world-bound-and-noninitial-body', cg);

  const settleSamples = []; const ts = Date.now(); let sr = { ok: false, spread: null };
  while (Date.now() - ts < 60000) {
    const s = await cgSnap(page); const p = poseOf(s);
    if (p && bodyUsable(p).ok) settleSamples.push(p);
    sr = settled(settleSamples);
    if (sr.ok && s?.supported === true) break;
    await sleep(250);
  }
  cg = await cgSnap(page);
  if (!gate('settled-actually-supported-body', sr.ok && cg?.supported === true, { spread: sr.spread, supported: orUnavailable(cg?.supported), bodyPose: cg?.bodyPose, bodyCentre: cg?.bodyCentre, groundOffsetUnits: cg?.groundOffsetUnits }))
    await stop('settled-actually-supported-body', { sr, cg });

  if (!gate('policy-permits-movement', !!ctl.policy && ctl.policy.moveSpeedScale > 0 && ctl.policy.lookMode !== 'side', ctl.policy ?? 'unavailable'))
    await stop('policy-permits-movement', ctl.policy);

  // real shipped-canvas click AFTER readiness (never a forced/synthetic dispatch)
  const r = ctl.canvasRect;
  if (!r) await stop('canvas-rect-available', 'unavailable');
  // An ordinary player clicks the world to take the controls, and clicks again if
  // nothing happened. Up to 3 REAL clicks; the GATE below is unchanged and the
  // refusal reason is recorded so a failure is diagnosable instead of bare.
  const lockAttempts = [];
  // OWNED HARNESS CORRECTION (after reference-1). reference-1 aimed every click at
  // `r`, a canvas rectangle sampled BEFORE this loop, and the browser reported the
  // resulting click target as a <p> while a LIVE elementFromPoint at the live rect
  // centre reported the canvas. A stale rectangle can aim an ordinary click off the
  // canvas, and the shipped handler only locks for a click whose target IS the
  // canvas. So: re-measure the canvas rect immediately before each click, refuse an
  // implausible rect instead of clicking blind, and record the element stack AT the
  // intended point. Still one ordinary trusted click per attempt: no
  // requestPointerLock, no synthetic dispatch, no handler patch, no gate change.
  const elementStackAt = (p, x, y) => p.evaluate(([px, py]) => {
    const canvas = document.querySelector('canvas');
    const describe = (el) => (el ? {
      tag: el.tagName ? el.tagName.toLowerCase() : null, isCanvas: el === canvas,
      id: el.id || null, cls: (el.className || '').toString().slice(0, 60),
      pointerEvents: getComputedStyle(el).pointerEvents, zIndex: getComputedStyle(el).zIndex,
      text: (el.textContent || '').trim().slice(0, 60)
    } : null);
    const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(px, py) : [];
    return {
      point: [px, py],
      elementFromPoint: describe(document.elementFromPoint(px, py)),
      stack: Array.from(stack).slice(0, 6).map(describe),
      canvasRectLive: canvas ? (({ x, y, width, height }) => ({ x, y, width, height }))(canvas.getBoundingClientRect()) : null,
      devicePixelRatio: window.devicePixelRatio, innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      canvasCount: document.querySelectorAll('canvas').length
    };
  }, [x, y]);
  for (let attempt = 1; attempt <= 3 && ctl.pointerLockIsCanvas !== true; attempt += 1) {
    await page.bringToFront();
    const liveCtl = await controlProbe(page);
    const aim = clickPointFromRect(liveCtl.canvasRect, { width: 1280, height: 720 });
    const beforeStack = aim.ok ? await elementStackAt(page, aim.x, aim.y) : null;
    if (!aim.ok) {
      const rec = {
        attempt, clicked: false, aim, staleRectBeforeLoop: r,
        why: `refused to click: ${aim.why}`, pointerLockIsCanvas: liveCtl.pointerLockIsCanvas
      };
      lockAttempts.push(rec); emit({ phase: 'pointer-lock-attempt', ...rec });
      say(`POINTER-LOCK attempt ${attempt}: NOT CLICKED (${aim.why})`);
      await sleep(1200);
      continue;
    }
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.click(aim.x, aim.y);
    const tp = Date.now();
    while (Date.now() - tp < 5000) { ctl = await controlProbe(page); if (ctl.pointerLockIsCanvas) break; await sleep(200); }
    const rec = {
      attempt, clicked: true, aim, staleRectBeforeLoop: r, beforeStack,
      waitedMs: Date.now() - tp, pointerLockIsCanvas: ctl.pointerLockIsCanvas,
      pointerLockElement: ctl.pointerLockElement, hasFocus: ctl.hasFocus, visibility: ctl.visibility,
      activeElement: ctl.activeElement, elementAtCanvasCentre: ctl.elementAtCanvasCentre
    };
    lockAttempts.push(rec); emit({ phase: 'pointer-lock-attempt', ...rec });
    say(`POINTER-LOCK attempt ${attempt}: locked=${ctl.pointerLockIsCanvas} at-centre=${JSON.stringify(ctl.elementAtCanvasCentre)} lockEl=${orUnavailable(ctl.pointerLockElement)}`);
    if (ctl.pointerLockIsCanvas !== true) await sleep(1200);
  }
  report.pointerLockAttempts = lockAttempts;

  // READ the passive observation. Purely descriptive: it records what the
  // browser actually reported (click isTrusted/pointerType/sourceCapabilities/
  // target/currentTarget, pointerlockchange/error, console warn/error/pageerror,
  // focus/touch/policy state) or marks it UNMEASURED. It gates NOTHING; the
  // pointer-lock gate below is byte-unchanged.
  let entryObservation = null;
  try {
    const raw = await page.evaluate(entryObserverReadSource());
    entryObservation = {
      installed: raw?.installed ?? false,
      clicks: (raw?.clicks ?? []).map(summariseClickObservation),
      pointerLockChanges: raw?.pointerLockChanges ?? [],
      pointerLockErrors: raw?.pointerLockErrors ?? [],
      focusState: raw?.focusState ?? null,
      touchState: raw?.touchState ?? null,
      policyState: raw?.policyState ?? null,
      consoleWarnings: pageSinks.consoleWarnings, consoleErrors: pageSinks.consoleErrors,
      pageErrors: pageSinks.pageErrors, consoleDropped: pageSinks.dropped
    };
    entryObservation.verdict = entryObservationVerdict(entryObservation);
  } catch (e) {
    entryObservation = { installed: false, readError: String(e?.message ?? e), note: 'entry observation FAILED TO READ: all click/lock metadata is UNMEASURED for this session' };
  }
  report.entryObservation = entryObservation;
  emit({ phase: 'entry-observation', entryObservation });
  say(`entry observation: ${JSON.stringify(entryObservation.verdict ?? entryObservation)}`);

  if (!gate('pointer-lock-and-focus', ctl.pointerLockIsCanvas === true && ctl.hasFocus === true, { pointerLockIsCanvas: ctl.pointerLockIsCanvas, hasFocus: ctl.hasFocus, attempts: lockAttempts }))
    await stop('pointer-lock-and-focus', { ...ctl, attempts: lockAttempts });

  // ---- key receipts: horizontal motion with direction, not spawn settling ----
  const hold = async (code, ms) => {
    const b = await cgSnap(page); await page.keyboard.down(code);
    const th = Date.now(); while (Date.now() - th < ms) await sleep(60);
    await page.keyboard.up(code);
    const heldMs = Date.now() - th;
    // Measured post-release drift: the pose AT key-up vs the pose once settled.
    const atUp = await cgSnap(page);
    await sleep(200);
    const a = await cgSnap(page);
    const rc = keyReceipt({ from: poseOf(b), to: poseOf(a), up: b?.up ?? [0, 1, 0] });
    const pUp = poseOf(atUp); const pEnd = poseOf(a);
    const coastUnits = pUp && pEnd ? distXZ(pUp, pEnd) : null;
    return {
      code, ms, heldMs, from: poseOf(b), to: pEnd, supportedAfter: a?.supported ?? null,
      coastUnits, unitsPerMs: rc.ok && heldMs > 0 ? rc.horizontal / heldMs : null, ...rc
    };
  };
  const dirs = {}; const calib = [];
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const h = await hold(code, 700); calib.push(h); emit({ phase: 'calibrate', ...h });
    dirs[code] = h.ok ? h.dir2 : null;
    say(`calib ${code}: horizontal=${h.horizontal === null ? 'unavailable' : h.horizontal.toFixed(3)} dir=${JSON.stringify(h.dir2)} ok=${h.ok}`);
  }
  report.calibration = calib;
  const live = Object.values(dirs).filter(Boolean);
  const spread = live.length >= 2
    ? directionsDistinct([live[0][0], 0, live[0][1]], [live[live.length - 1][0], 0, live[live.length - 1][1]], 25)
    : { ok: false, why: 'fewer than two live directions' };
  if (!gate('four-key-receipts-with-distinct-directions', live.length === 4 && spread.ok, { live: live.length, spreadDeg: spread.deg ?? 'unavailable', dirs }))
    await stop('four-key-receipts-with-distinct-directions', { dirs, calib });

  // ---- live steering calibration (never a hardcoded 120 ms tap) --------------
  // A fixed 120 ms minimum is ~0.6 units at the measured ~5.15 u/s and is coarser
  // than the 0.25-0.6 unit arrival radii this route needs, so it can ping-pong
  // across a target forever while stallMs keeps resetting. Pulses are therefore
  // planned from ACTUAL measured speed and ACTUAL measured coast.
  const speeds = calib.filter((h) => Number.isFinite(h.unitsPerMs) && h.unitsPerMs > 0).map((h) => h.unitsPerMs);
  const coasts = calib.filter((h) => Number.isFinite(h.coastUnits)).map((h) => h.coastUnits);
  const STEER = {
    unitsPerMs: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    coastUnits: coasts.length ? Math.max(...coasts) : null,
    minMs: Number(arg('pulse-min-ms', '30')),
    maxMs: Number(arg('pulse-max-ms', '400')),
    deadTimeMs: Number(arg('pulse-dead-ms', '0')),
    source: 'measured from the four live calibration holds in this session'
  };
  report.steering = STEER;
  if (!gate('steering-is-calibrated-from-measured-motion',
    Number.isFinite(STEER.unitsPerMs) && STEER.unitsPerMs > 0 && Number.isFinite(STEER.coastUnits),
    { ...STEER, unitsPerSecond: STEER.unitsPerMs === null ? 'unavailable' : STEER.unitsPerMs * 1000 }))
    await stop('steering-is-calibrated-from-measured-motion', STEER);

  // ---------------------------------------------------- ordinary walk helper --
  /** Held-key walk to a world point. Returns a leg; NEVER reports arrival on timeout/stall. */
  const walkTo = async (label, target, { arrive = 1.0, budgetMs = BUDGET.leg, sample = null } = {}) => {
    const t = Date.now(); const start = poseOf(await cgSnap(page)); let last = start; let stallMs = 0; let travelled = 0;
    let distance = start ? distXZ(start, target) : NaN;
    const distances = []; let osc = { oscillating: false, why: null, flips: null, improvement: null };
    let noKey = false;
    while (Date.now() - t < budgetMs) {
      const s = await cgSnap(page); const p = poseOf(s);
      if (!p) { await sleep(200); continue; }
      distance = distXZ(p, target);
      if (sample) await sample(s, p);
      if (distance <= arrive) break;
      distances.push(distance);
      // Stop honestly on a real oscillation instead of burning the leg budget in it.
      osc = detectOscillation(distances);
      if (osc.oscillating) { emit({ phase: 'oscillation', label, distance, ...osc }); break; }
      const want = unit2([target[0] - p[0], target[2] - p[2]]);
      const pick = chooseKey(dirs, want ?? [1, 0]);
      if (!pick.key) { noKey = true; break; }
      const pulse = planPulseMs({
        distance, arrive, unitsPerMs: STEER.unitsPerMs, coastUnits: STEER.coastUnits,
        minMs: STEER.minMs, maxMs: STEER.maxMs, deadTimeMs: STEER.deadTimeMs
      });
      if (pulse.ms === null) { noKey = true; emit({ phase: 'pulse-unplannable', label, why: pulse.why }); break; }
      await page.keyboard.down(pick.key);
      await sleep(pulse.ms);
      await page.keyboard.up(pick.key);
      await sleep(110);
      const s2 = await cgSnap(page); const q = poseOf(s2) ?? p;
      const step = distXZ(last ?? q, q); travelled += step;
      // A stall is judged against the pulse actually commanded, not a fixed step.
      const expected = Math.max(0.02, (pulse.commandedUnits ?? 0) * 0.25);
      stallMs = step < expected ? stallMs + 700 : 0; last = q;
      emit({ phase: 'step', label, key: pick.key, pulseMs: pulse.ms, commandedUnits: pulse.commandedUnits, clamped: pulse.clamped, pose: q, bodyCentre: s2?.bodyCentre ?? null, supported: s2?.supported ?? null, distance: distXZ(q, target), step });
      if (stallMs >= 7000) break;
    }
    const sEnd = await cgSnap(page); const pEnd = poseOf(sEnd);
    const leg = legVerdict({
      label, target, arrive, distance: pEnd ? distXZ(pEnd, target) : NaN,
      elapsedMs: Date.now() - t, budgetMs, stalledMs: stallMs, travelled,
      oscillating: osc.oscillating
    });
    leg.oscillation = osc; leg.noSteeringKey = noKey; leg.pulseSamples = distances.length;
    leg.from = start; leg.to = pEnd; leg.supportedAtEnd = sEnd?.supported ?? null;
    report.legs.push(leg); emit({ phase: 'leg', ...leg });
    say(`LEG ${label} ${leg.status} d=${Number.isFinite(leg.distance) ? leg.distance.toFixed(2) : 'unavailable'} travelled=${travelled.toFixed(2)}`);
    return leg;
  };
  // ------------------------------------- strict ORIGINAL-plane crossing walk --
  /**
   * ONE commissioned correction. Used ONLY at intended-completed COMMON vertices;
   * ordinary approximate navigation to W/S/T/E and the deviation's own excursion
   * legs keep using walkTo above and are deliberately NOT plane-gated.
   *
   * Ordinary held keys and the same live calibration. The difference is the
   * TERMINATION CONDITION: not "within 0.6 of the vertex" but "the actual body was
   * observed before the ORIGINAL incoming plane and then past it, at this corner,
   * supported". Each pulse is additionally capped by the remaining distance TO the
   * plane so the body does not blast past a corner into water: at corners 3/6 and
   * terminal 9 the pulses become short feedback nudges through the plane and stop
   * the moment the crossing is real.
   */
  report.planeCrossings = [];
  const walkThroughPlane = async (label, index, { budgetMs = BUDGET.leg, sample = null, route = CG_ROUTE_COMMON } = {}) => {
    const plane = incomingPlaneAt(route, index);
    const vertex = route[index];
    const t = Date.now();
    const planeSamples = [];
    const distances = [];
    let osc = { oscillating: false, why: null, flips: null, improvement: null };
    let noKey = false; let stallMs = 0; let travelled = 0; let last = null;
    if (!plane.ok) { await stop(`plane-unusable-${label}`, plane); }
    while (Date.now() - t < budgetMs) {
      const s = await cgSnap(page); const p = poseOf(s);
      if (!p) { await sleep(200); continue; }
      if (sample) await sample(s, p);
      const offset = signedPlaneOffset(p, plane);
      const lateral = planeLateralOffset(p, plane);
      planeSamples.push({
        atMs: Date.now() - t0, pose: p, supported: s?.supported ?? null,
        units: s?.common?.terraUnits ?? null, offset, lateral
      });
      const v = planeCrossingVerdict({ samples: planeSamples, plane });
      if (v.crossed) break;
      // Aim just past the corner, and never command more than the distance left to the plane.
      const aim = [vertex[0] + plane.normal[0] * 0.15, vertex[1], vertex[2] + plane.normal[1] * 0.15];
      const toAim = distXZ(p, aim);
      const toPlane = Math.max(0, -offset) + 0.15;
      const commandDistance = Math.min(toAim, toPlane);
      distances.push(toAim);
      osc = detectOscillation(distances);
      if (osc.oscillating) { emit({ phase: 'oscillation', label, distance: toAim, ...osc }); break; }
      const want = unit2([aim[0] - p[0], aim[2] - p[2]]);
      const pick = chooseKey(dirs, want ?? [1, 0]);
      if (!pick.key) { noKey = true; break; }
      const pulse = planPulseMs({
        distance: commandDistance, arrive: 0.1, unitsPerMs: STEER.unitsPerMs, coastUnits: STEER.coastUnits,
        minMs: STEER.minMs, maxMs: STEER.maxMs, deadTimeMs: STEER.deadTimeMs
      });
      if (pulse.ms === null) { noKey = true; emit({ phase: 'pulse-unplannable', label, why: pulse.why }); break; }
      await page.keyboard.down(pick.key);
      await sleep(pulse.ms);
      await page.keyboard.up(pick.key);
      await sleep(110);
      const s2 = await cgSnap(page); const q = poseOf(s2) ?? p;
      const step = distXZ(last ?? q, q); travelled += step;
      const expected = Math.max(0.02, (pulse.commandedUnits ?? 0) * 0.25);
      stallMs = step < expected ? stallMs + 700 : 0; last = q;
      emit({
        phase: 'plane-step', label, vertexIndex: index, key: pick.key, pulseMs: pulse.ms,
        commandedUnits: pulse.commandedUnits, pose: q, supported: s2?.supported ?? null,
        offset: signedPlaneOffset(q, plane), lateral: planeLateralOffset(q, plane),
        terraUnits: s2?.common?.terraUnits ?? null, step
      });
      if (stallMs >= 7000) break;
    }
    const sEnd = await cgSnap(page); const pEnd = poseOf(sEnd);
    if (pEnd) {
      planeSamples.push({
        atMs: Date.now() - t0, pose: pEnd, supported: sEnd?.supported ?? null,
        units: sEnd?.common?.terraUnits ?? null,
        offset: signedPlaneOffset(pEnd, plane), lateral: planeLateralOffset(pEnd, plane)
      });
    }
    const verdict = planeCrossingVerdict({ samples: planeSamples, plane });
    const leg = {
      label, kind: 'original-incoming-plane-crossing', vertexIndex: index, vertex,
      plane: { point: plane.point, normal: plane.normal, from: plane.from },
      crossed: verdict.crossed, why: verdict.why,
      before: verdict.before ? { pose: verdict.before.pose, offset: verdict.before.offset, units: verdict.before.units } : null,
      cross: verdict.cross ? { atMs: verdict.cross.atMs, pose: verdict.cross.pose, offset: verdict.cross.offset, lateral: verdict.cross.lateral, units: verdict.cross.units, supported: verdict.cross.supported } : null,
      maxOffsetObserved: verdict.maxOffsetObserved, overshootWithinBound: verdict.overshootWithinBound,
      lateralLimit: PLANE_LATERAL_LIMIT_UNITS, maxOvershoot: PLANE_MAX_OVERSHOOT_UNITS,
      elapsedMs: Date.now() - t, budgetMs, travelled, samples: planeSamples.length,
      oscillation: osc, noSteeringKey: noKey, stalledMs: stallMs,
      endPose: pEnd, supportedAtEnd: sEnd?.supported ?? null,
      terraUnitsAtEnd: sEnd?.common?.terraUnits ?? null,
      // A crossing is an arrival ONLY when the body actually passed the original plane.
      reached: verdict.crossed === true,
      status: verdict.crossed ? 'crossed' : osc.oscillating ? 'oscillating' : stallMs >= 7000 ? 'stalled' : 'not-crossed',
      fatal: verdict.crossed !== true
    };
    report.legs.push(leg); emit({ phase: 'plane-leg', ...leg });
    say(`PLANE ${label} v${index} ${leg.status} offset=${leg.cross ? leg.cross.offset.toFixed(3) : (pEnd ? String(signedPlaneOffset(pEnd, plane)?.toFixed(3)) : 'unavailable')} units=${orUnavailable(leg.terraUnitsAtEnd)}`);
    return leg;
  };
  /** A crossing that did not happen STOPS the probe before any later action or F. */
  const mustCross = async (leg) => {
    if (leg.crossed !== true) {
      gate(`original-plane-crossed-${leg.label}`, false, leg);
      await stop(`plane-${leg.label}`, leg);
    }
    if (leg.overshootWithinBound === false) {
      gate(`plane-overshoot-bounded-${leg.label}`, false, leg);
      await stop(`plane-overshoot-${leg.label}`, leg);
    }
    gate(`original-plane-crossed-${leg.label}`, true, {
      vertexIndex: leg.vertexIndex, offset: leg.cross?.offset, lateral: leg.cross?.lateral,
      units: leg.cross?.units, maxOffsetObserved: leg.maxOffsetObserved
    });
    report.planeCrossings.push({
      index: leg.vertexIndex, label: leg.label, atMs: leg.cross?.atMs ?? null,
      units: leg.cross?.units ?? null, offset: leg.cross?.offset ?? null,
      lateral: leg.cross?.lateral ?? null, crossed: true
    });
    return leg;
  };

  /** A failed leg is fatal: it stops the probe BEFORE any later F or action. */
  const mustReach = async (leg) => { if (!leg.reached) { gate(`leg-reached-${leg.label}`, false, leg); await stop(`leg-${leg.label}`, leg); } gate(`leg-reached-${leg.label}`, true, { distance: leg.distance, travelled: leg.travelled }); return leg; };

  /** [F] only after the exact current objective/prompt has been checked. */
  // `contractKey` names an entry of CG_F_CONTRACT, i.e. an EXACT authored objective
  // id and prompt verb quoted from frozen source. There is no any-prompt press:
  // an unknown key, a wrong live objective or a missing authored verb all stop.
  const pressF = async (why, { contractKey = null, requires = [] } = {}) => {
    const contract = contractKey ? CG_F_CONTRACT[contractKey] ?? null : null;
    if (!contract) {
      const bad = { why, contractKey, allowed: false, reason: `no CG_F_CONTRACT entry for ${JSON.stringify(contractKey)} — an any-prompt press is not an authored offer` };
      report.fPresses.push(bad); emit({ phase: 'f-decision', ...bad });
      gate(`f-offered-${why}`, false, bad); await stop(`f-offer-${why}`, bad);
    }
    // Every named prerequisite gate must already have PASSED before this press.
    const unmet = requires.filter((n) => !report.gates.some((g) => g.name === n && g.ok));
    if (unmet.length) {
      const bad = { why, contractKey, allowed: false, reason: `unmet prerequisite gate(s): ${unmet.join(', ')}`, requires };
      report.fPresses.push(bad); emit({ phase: 'f-decision', ...bad });
      gate(`f-prerequisites-${why}`, false, bad); await stop(`f-prerequisites-${why}`, bad);
    }
    const st = await readState(page);
    const s = await cgSnap(page);
    const decision = mayPressF({ objectiveId: st?.objectiveId ?? null, expectedObjectiveId: contract.objectiveId, prompts: st?.interactionPrompts ?? null, verbPattern: contract.verb });
    const rec = { why, contractKey, expectedObjectiveId: contract.objectiveId, expectedVerb: String(contract.verb), objectiveId: st?.objectiveId ?? null, prompts: st?.interactionPrompts ?? [], allowed: decision.ok, reason: decision.why, matchedPrompt: decision.prompt, common: s?.common ?? null };
    report.fPresses.push(rec); emit({ phase: 'f-decision', ...rec });
    if (!decision.ok) { gate(`f-offered-${why}`, false, rec); await stop(`f-offer-${why}`, rec); }
    gate(`f-offered-${why}`, true, { objectiveId: rec.objectiveId, prompt: rec.matchedPrompt });
    await page.keyboard.down('KeyF'); await sleep(80); await page.keyboard.up('KeyF'); await sleep(1400);
    emit({ phase: 'input', key: 'KeyF', why });
    say(`pressed [F] (${why})`);
    return rec;
  };

  // ---- B. earn the survey, then the survey/common transition ----------------
  await snapState('after-calibration');
  await mustReach(await walkTo('to-W-offer', [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z], { arrive: 1.2 }));
  await snapState('at-W');
  await pressF('W-demonstrate-route', { contractKey: 'W-offer-route' });
  await snapState('after-F-at-W');

  await mustReach(await walkTo('to-S', [CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z], { arrive: 1.0 }));
  const atS = await snapState('at-S');
  await pressF('S-begin-recording', { contractKey: 'S-begin-recording' });
  const started = await snapState('after-F-at-S');
  if (!gate('survey-actually-started', (started.anchors ?? []).includes('anc.cg.survey-started'), { anchors: started.anchors, survey: started.survey, before: atS.objectiveId }))
    await stop('survey-actually-started', started);

  const surveyT0 = Date.now();
  // The ACTUAL walked span, recorded from her own sampled poses, is what a later
  // clearance measurement is taken against — not the authored vertex list.
  const drawnSpan = [];
  const sampleDrawn = async (_s, p) => { if (Array.isArray(p)) drawnSpan.push([p[0], p[1], p[2]]); };
  for (let i = 0; i < CG_ROUTE_LONG.length; i += 1) {
    if (Date.now() - surveyT0 > BUDGET.survey) await stop('survey-budget', { i, budgetMs: BUDGET.survey });
    await mustReach(await walkTo(`draw-${i}`, CG_ROUTE_LONG[i], { arrive: 0.8, budgetMs: 45000, sample: sampleDrawn }));
  }
  const atE = await snapState('at-E-after-draw');
  report.drawnSpanSamples = drawnSpan.length;
  // The drawing gate is a PREREQUISITE, not a note: no offer without a real drawing.
  if (!gate('a-real-drawing-was-recorded',
    (atE.survey?.samples ?? 0) > 0 && (atE.survey?.lengthUnits ?? 0) > 0 && drawnSpan.length > 0,
    { survey: atE.survey ?? 'unavailable', ownRecordedPoses: drawnSpan.length }))
    await stop('a-real-drawing-was-recorded', atE.survey ?? 'unavailable');
  await pressF('E-offer-the-walked-span', { contractKey: 'E-offer-span', requires: ['a-real-drawing-was-recorded', 'survey-actually-started'] });
  await snapState('after-F-at-E');

  // ---- stand clear of the offered span, by ordinary controls -----------------
  // Standing at E can BLOCK W's test (`standingOnHisTest` holds his leg on any
  // offered sample within one XZ unit of her body) and a clean long route may raise
  // no witness hold at all, so waiting at E can deadlock the run against itself.
  // Candidates must be AUTHORED poses that were OBSERVED reached in this session.
  const reachedLegNames = new Set(report.legs.filter((l) => l.reached).map((l) => l.label));
  const observedReachable = [];
  if (reachedLegNames.has('to-W-offer')) observedReachable.push('W');
  if (reachedLegNames.has('to-S')) observedReachable.push('S');
  const standChoice = standClearChoice({
    candidates: [
      // W: authored pose, and physically reached by ordinary keys earlier in THIS run.
      { name: 'W', point: [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z], authored: true },
      { name: 'S', point: [CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z], authored: true },
      // Refused on provenance: an unobserved arithmetic water goal.
      { name: 'E.z-3', point: [CG_POSES.E.x, CG_POSES.E.y, CG_POSES.E.z - 3], authored: false },
      // Refused because standing on his test IS the deadlock.
      { name: 'on-LONG-route', point: [...CG_ROUTE_LONG[10]], authored: true }
    ],
    recordedSpan: drawnSpan,
    observedReachable
  });
  report.standClear = standChoice;
  if (!gate('a-clear-authored-observed-stand-point-exists', !!standChoice.chosen, standChoice))
    await stop('a-clear-authored-observed-stand-point-exists', standChoice);
  const standPoint = standChoice.chosen.point;
  await mustReach(await walkTo(`stand-clear-at-${standChoice.chosen.name}`, standPoint, { arrive: 1.0, budgetMs: 60000 }));
  const atStand = await snapState(`standing-clear-at-${standChoice.chosen.name}`);
  // Clearance is measured from her ACTUAL occupied body against the recorded span.
  const standClearance = minClearanceToSpan(atStand.bodyPose ?? [], drawnSpan);
  report.standClearance = { at: standChoice.chosen.name, bodyPose: atStand.bodyPose ?? 'unavailable', ...standClearance, requiredUnits: BODY_BODY_CLEARANCE_UNITS };
  if (!gate('occupied-body-is-actually-clear-of-the-offered-span', standClearance.ok === true, report.standClearance))
    await stop('occupied-body-is-actually-clear-of-the-offered-span', report.standClearance);

  // witness hold: answer the authored hold with the authored verb at the authored point
  const twt = Date.now(); let tested = false; let witnessTried = false;
  while (Date.now() - twt < BUDGET.witnessWatch) {
    const s = await cgSnap(page); const st = await readState(page);
    emit({ phase: 'witness-watch', ms: Date.now() - twt, holdReason: s?.holdReason ?? null, survey: s?.survey ?? null, anchors: s?.anchors ?? [], objectiveId: st?.objectiveId ?? null, prompts: st?.interactionPrompts ?? [] });
    if ((s?.anchors ?? []).includes('anc.cg.route-tested')) { tested = true; break; }
    if (st?.objectiveId === 'ch13:survey:witness' && !witnessTried) {
      witnessTried = true;
      await mustReach(await walkTo('to-witness-point', [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z], { arrive: 1.0, budgetMs: 60000 }));
      await snapState('at-witness-point');
      await pressF('authored-witness-offer', { contractKey: 'witness-hold-this-end' });
      await snapState('after-witness-F');
      continue;
    }
    if ((s?.survey?.witnessOffered === true) && promptOffersF(st?.interactionPrompts ?? [], /Offer/i).ok) {
      await pressF('witness-prompt-during-test', { contractKey: 'witness-hold-this-end' });
    }
    await sleep(2000);
  }
  if (!gate('W-actually-tested-the-route', tested, { routeTested: tested, watchMs: Date.now() - twt }))
    await stop('W-actually-tested-the-route', { tested });

  const entered = await snapState('entered-common');
  if (!gate('beat-is-ch13-common-with-reciprocal-objective', entered.beat === 'ch13-common' && entered.objectiveId === 'ch13:common:reciprocal',
    { beat: orUnavailable(entered.beat), objectiveId: orUnavailable(entered.objectiveId) }))
    await stop('beat-is-ch13-common-with-reciprocal-objective', entered);

  // ---- C. H reference held by W, then Terra's ordered eighteen units --------
  const th = Date.now(); let held = null;
  while (Date.now() - th < 90000) {
    const s = await cgSnap(page);
    if (s?.common?.stage === 'holding-h' && (s.anchors ?? []).includes('anc.cg.reciprocal-reference')) { held = s; break; }
    await sleep(500);
  }
  if (!gate('W-holds-the-H-reference', !!held, { stage: orUnavailable((await cgSnap(page))?.common?.stage), anchors: (await cgSnap(page))?.anchors ?? 'unavailable' }))
    await stop('W-holds-the-H-reference', held);
  const hPos = workerPos(held);
  gate('H-reference-body-is-at-H', !!hPos && dist3(hPos, [CG_POSES.H.x, CG_POSES.H.y, CG_POSES.H.z]) <= 0.5,
    { workerPosition: orUnavailable(hPos), H: CG_POSES.H, distance: hPos ? dist3(hPos, [CG_POSES.H.x, CG_POSES.H.y, CG_POSES.H.z]) : 'unavailable' });

  const terra = makeProgressTracker({ name: 'terraUnits' });
  let clearanceMin = Infinity; let supportedAll = true; let creditGrewWhileWalking = false;
  const sampleCommon = async (s, p) => {
    const u = s?.common?.terraUnits ?? null;
    const before = terra.max;
    terra.push(u, { pose: p, supported: s?.supported ?? null, stage: s?.common?.stage ?? null });
    if (Number.isFinite(u) && u > before + 1e-6) creditGrewWhileWalking = true;
    if (s?.supported !== true) supportedAll = false;
    const wp = workerPos(s);
    if (p && wp) clearanceMin = Math.min(clearanceMin, dist3(p, wp));
    emit({ phase: 'common-sample', terraUnits: u, pose: p, bodyCentre: s?.bodyCentre ?? null, supported: s?.supported ?? null, worker: wp, holdReason: s?.holdReason ?? null });
  };

  const commonT0 = Date.now();
  const overCommonBudget = () => Date.now() - commonT0 > BUDGET.common;
  await mustReach(await walkTo('to-E-common-start', CG_ROUTE_COMMON[0], { arrive: 0.8, sample: sampleCommon }));
  await snapState('at-E-common-start');

  let deviation = null;
  if (MODE === 'deviation') {
    // 1. walk the first segment normally, then TURN EARLY at z 15.82 (before z=16).
    await mustCross(await walkThroughPlane('common-1', 1, { sample: sampleCommon }));
    await mustReach(await walkTo('early-turn-point-z15.82', EARLY_TURN_POINT, { arrive: 0.25, sample: sampleCommon }));
    const atTurn = await snapState('at-early-turn-z15.82');
    const creditedAtDeviation = atTurn.common?.terraUnits ?? null;
    // The early turn must be a REAL early turn: the ACTUAL body still before the
    // original z=16 plane. An overshoot to 16+ is not the intended deviation.
    const plane2 = incomingPlaneAt(CG_ROUTE_COMMON, 2);
    const early = earlyTurnVerdict({ pose: atTurn.bodyPose, plane: plane2 });
    report.earlyTurn = { ...early, pose: atTurn.bodyPose, plane: { point: plane2.point, normal: plane2.normal }, creditedAtDeviation };
    if (!gate('deviation-body-is-actually-before-the-original-z16-plane', early.ok, report.earlyTurn))
      await stop('deviation-body-is-actually-before-the-original-z16-plane', report.earlyTurn);
    // 2. cut the corner: go straight to the NEXT vertex, omitting the z=16 corner.
    await mustReach(await walkTo('corner-cut-to-vertex-3', CG_ROUTE_COMMON[3], { arrive: 0.8, sample: sampleCommon }));
    await snapState('after-corner-cut');
    // 3. far excursion: complete the remaining vertices to C. This MUST buy nothing.
    for (let i = 4; i < CG_ROUTE_COMMON.length; i += 1) {
      if (overCommonBudget()) await stop('common-budget', { phase: 'far-excursion', i });
      await mustReach(await walkTo(`excursion-${i}`, CG_ROUTE_COMMON[i], { arrive: 0.8, sample: sampleCommon }));
    }
    const atCNoCredit = await snapState('at-C-after-corner-cut');
    const creditedAfterFarExcursion = atCNoCredit.common?.terraUnits ?? null;
    gate('endpoint-and-far-ground-bought-no-omitted-credit',
      Number.isFinite(creditedAfterFarExcursion) && creditedAfterFarExcursion + 1e-6 < CG_COMMON_ROUTE_UNITS,
      { creditedAtDeviation, creditedAfterFarExcursion, required: CG_COMMON_ROUTE_UNITS });
    // 4. ORDINARY return to the actual unfinished frontier, back along the route.
    for (let i = CG_ROUTE_COMMON.length - 2; i >= 3; i -= 1) {
      if (overCommonBudget()) await stop('common-budget', { phase: 'return', i });
      await mustReach(await walkTo(`return-${i}`, CG_ROUTE_COMMON[i], { arrive: 0.8, sample: sampleCommon }));
    }
    await mustReach(await walkTo('return-to-frontier-z15.82', EARLY_TURN_POINT, { arrive: 0.4, sample: sampleCommon }));
    const atFrontier = await snapState('at-unfinished-frontier');
    // 5. physically traverse the OMITTED ground: through the z=16 corner, forward.
    // Strict: the omitted ground counts only if the body actually crosses the
    // ORIGINAL z=16 incoming plane at that corner, not if it reaches a radius.
    await mustCross(await walkThroughPlane('omitted-corner-vertex-2', 2, { sample: sampleCommon }));
    const atCorner = await snapState('traversed-omitted-corner');
    deviation = {
      earlyTurnPoint: EARLY_TURN_POINT, creditedAtDeviation, creditedAfterFarExcursion,
      creditedAtFrontier: atFrontier.common?.terraUnits ?? null,
      creditedAfterOmittedCorner: atCorner.common?.terraUnits ?? null,
      returnedToFrontier: true, omittedGroundTraversed: true
    };
    emit({ phase: 'deviation', ...deviation });
  } else {
    await mustCross(await walkThroughPlane('common-1', 1, { sample: sampleCommon }));
    await mustCross(await walkThroughPlane('common-2', 2, { sample: sampleCommon }));
  }

  // ordered remainder of the route to C, in signed order, in both modes:
  // every ORIGINAL incoming corner plane physically crossed, in order.
  for (let i = 3; i < CG_ROUTE_COMMON.length; i += 1) {
    if (overCommonBudget()) await stop('common-budget', { phase: 'ordered-remainder', i });
    await mustCross(await walkThroughPlane(`common-${i}`, i, { sample: sampleCommon }));
  }
  const frontier = orderedFrontierVerdict({
    crossings: report.planeCrossings,
    expectedIndices: CG_ROUTE_COMMON.map((_, i) => i).slice(1)
  });
  report.orderedFrontier = frontier;
  if (!gate('all-original-incoming-planes-crossed-in-order', frontier.ok, frontier))
    await stop('all-original-incoming-planes-crossed-in-order', frontier);
  const atC = await snapState('at-C');
  const fBeforeC = report.fPresses.length;

  const creditedFinal = atC.common?.terraUnits ?? null;
  const passage = passageVerdict({
    creditedUnits: creditedFinal,
    arrivalDistance: atC.bodyPose ? distXZ(atC.bodyPose, [CG_POSES.C.x, CG_POSES.C.y, CG_POSES.C.z]) : null,
    arriveRadius: 1.0,
    supported: atC.supported,
    referenceObserved: creditGrewWhileWalking,
    orderedLegsAllReached: report.legs.filter((l) => /^common-|^excursion-|^return-|^omitted-|^early-turn/.test(l.label)).every((l) => l.reached),
    clearanceUnits: Number.isFinite(clearanceMin) ? clearanceMin : null,
    extraFPresses: 0, resetsObserved: terra.prefixRetained ? 0 : 1
  });
  report.reciprocal = {
    mode: MODE, creditedFinal, required: CG_COMMON_ROUTE_UNITS,
    comparisonProved: atC.common?.comparisonProved ?? 'unavailable',
    anchors: atC.anchors, prefixRetained: terra.prefixRetained, prefixDrop: terra.drop,
    minBodyClearanceUnits: Number.isFinite(clearanceMin) ? clearanceMin : 'unavailable',
    supportedThroughout: supportedAll, creditGrewWhileWalking, passage,
    samples: terra.samples.length
  };
  gate('terra-full-eighteen-unit-ordered-passage', passage.ok, passage);
  gate('reciprocal-crossed-anchor', (atC.anchors ?? []).includes('anc.cg.reciprocal-crossed'), { anchors: atC.anchors });

  if (MODE === 'deviation') {
    const rec = recoveryVerdict({
      creditedAtDeviation: deviation.creditedAtDeviation,
      creditedAfterFarExcursion: deviation.creditedAfterFarExcursion,
      creditedFinal,
      returnedToFrontier: deviation.returnedToFrontier,
      omittedGroundTraversed: deviation.omittedGroundTraversed,
      prefixRetained: terra.prefixRetained,
      extraFPresses: report.fPresses.length - fBeforeC,
      resetsObserved: 0
    });
    report.recovery = { ...deviation, ...rec };
    gate('early-corner-recovery-through-omitted-ground', rec.verdict === 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND', rec);
  }
  if (!passage.ok) await stop('terra-full-eighteen-unit-ordered-passage', passage);

  // ---- D. the far reference T: exact objective + prompt, then ordinary F -----
  await mustReach(await walkTo('to-T-far-reference', [CG_POSES.T.x, CG_POSES.T.y, CG_POSES.T.z], { arrive: 0.9 }));
  const atT = await snapState('at-T');
  await pressF('offer-the-far-reference', { contractKey: 'T-offer-final-reference', requires: ['terra-full-eighteen-unit-ordered-passage'] });
  const afterT = await snapState('after-F-at-T');
  const offered = afterT.common?.finalReferenceOffered === true && afterT.common?.finalReferenceOccupied === true;
  if (!gate('far-reference-offered-and-occupied', offered, { common: afterT.common ?? 'unavailable', anchors: afterT.anchors, distanceToT: atT.bodyPose ? dist3(atT.bodyPose, [CG_POSES.T.x, CG_POSES.T.y, CG_POSES.T.z]) : 'unavailable' }))
    await stop('far-reference-offered-and-occupied', afterT);

  // ---- E. W's own eighteen units while Terra actually holds T ---------------
  const worker = makeProgressTracker({ name: 'workerUnits' });
  const tr = Date.now(); let vacated = 0; let committed = false; let occupiedAll = true;
  while (Date.now() - tr < BUDGET.release) {
    const s = await cgSnap(page); const st = await readState(page);
    const wu = s?.common?.workerUnits ?? null;
    worker.push(wu, { stage: s?.common?.stage ?? null });
    if (s?.common?.finalReferenceOccupied !== true) occupiedAll = false;
    if ((s?.anchors ?? []).includes('anc.cg.reference-vacated')) vacated += 1;
    const p = poseOf(s); const wp = workerPos(s);
    if (p && wp) clearanceMin = Math.min(clearanceMin, dist3(p, wp));
    emit({ phase: 'release-sample', ms: Date.now() - tr, workerUnits: wu, stage: s?.common?.stage ?? null, occupied: s?.common?.finalReferenceOccupied ?? null, committed: s?.common?.committed ?? null, objectiveId: st?.objectiveId ?? null, pose: p, worker: wp, supported: s?.supported ?? null });
    if (s?.common?.committed === true) { committed = true; break; }
    await sleep(1500);
  }
  const done = await snapState('after-release');
  report.release = {
    workerUnitsFinal: worker.last, workerUnitsMax: worker.max, required: CG_COMMON_ROUTE_UNITS,
    committed, occupancyHeldThroughout: occupiedAll, vacatedEvents: vacated,
    anchors: done.anchors, objectiveId: orUnavailable(done.objectiveId),
    minBodyClearanceUnits: Number.isFinite(clearanceMin) ? clearanceMin : 'unavailable',
    samples: worker.samples.length, elapsedMs: Date.now() - tr
  };
  gate('worker-second-pass-full-eighteen-units', Number.isFinite(worker.max) && worker.max + 1e-6 >= CG_COMMON_ROUTE_UNITS,
    { workerUnitsMax: worker.max, required: CG_COMMON_ROUTE_UNITS });
  gate('chapter-commit-anchors', committed && (done.anchors ?? []).includes('anc.cg.complete') && (done.anchors ?? []).includes('anc.cg.handback'),
    { committed, anchors: done.anchors });

  const allGatesPassed = report.gates.every((g) => g.ok);
  report.verdict = !allGatesPassed ? 'GATES-FAILED'
    : MODE === 'deviation'
      ? (report.recovery?.verdict === 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND'
        ? 'COMMON-PASSAGE-AND-EARLY-CORNER-RECOVERY-OBSERVED' : 'RECOVERY-NOT-PROVED')
      : 'COMMON-PASSAGE-OBSERVED-CLEAN-ROUTE';
  report.finalCg = await cgSnap(page).catch(() => null);
  report.finalState = await readState(page).catch(() => null);
} catch (err) {
  if (!err.gateStop) { report.verdict = 'ERROR'; report.error = String(err).slice(0, 400); }
  report.failure = failureRecord({ probe: 'common-passage-probe.mjs', error: err, phase: report.stoppedAt ?? 'capture' });
  say(`STOP: ${String(err).slice(0, 300)}`);
} finally {
  await guard.stopOnce('probe-finally').catch((e) => say(`guard stop error: ${String(e).slice(0, 200)}`));
  report.cleanup = guard.cleanupReceipt({ probe: 'common-passage-probe.mjs' });
  try {
    report.probeSnapshotAfter = snapshotRef(writeSourceSnapshot({
      entryAbs: new URL(import.meta.url).pathname, outDir: join(outDir, 'after'), repoRoot: REPO_ROOT,
      note: 'Exact bytes of this probe and its libraries after the run (after-run binding).'
    }));
  } catch (e) { report.probeSnapshotAfter = `unavailable: ${String(e).slice(0, 120)}`; }
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - t0;
  report.gatesFailed = report.gates.filter((g) => !g.ok).map((g) => g.name);
  report.summary = {
    verdict: report.verdict, mode: MODE, stoppedAt: report.stoppedAt,
    gatesPassed: report.gates.filter((g) => g.ok).length, gatesFailed: report.gatesFailed.length,
    consistent: report.gatesFailed.length === 0
      ? report.verdict.startsWith('COMMON-PASSAGE')
      : !report.verdict.startsWith('COMMON-PASSAGE')
  };
  const body = JSON.stringify(report, null, 1);
  writeFileSync(join(outDir, 'summary.json'), body);
  writeFileSync(join(outDir, 'summary.sha256'), `${sha(body)}  summary.json\n`);
  // The log stream is closed by process exit AFTER this final say (the flight
  // probe's ERR_STREAM_WRITE_AFTER_END bug was writing its last line too late).
  say(`verdict=${report.verdict} gatesFailed=${report.gatesFailed.join(',') || 'none'} out=${outDir}`);
  logStreamEnded = true;
}
process.exitCode = report.verdict.startsWith('COMMON-PASSAGE') && logStreamEnded ? 0 : 2;
