#!/usr/bin/env node
/**
 * entry-input-discriminator.mjs — ONE bounded, owned, headed diagnostic.
 *
 * QUESTION (and the only question): when an ordinary real canvas click does not
 * take pointer lock at ?story=ch13-survey, does the SHIPPED authored handler
 *   main/src/components/CameraControls.tsx handleClick
 * actually CALL element.requestPointerLock() and get REJECTED (browser/OS layer),
 * or does it RETURN EARLY for one of its own game conditions
 *   event.target !== canvas | document.pointerLockElement | !allowsMousePointerLock(event)
 * where allowsMousePointerLock (main/src/utils/mobileInput.ts) is false when
 * touchActive, or event.pointerType is not 'mouse', or
 * sourceCapabilities.firesTouchEvents === true.
 *
 * The prior common-manual-runtime report asserted "allowsMousePointerLock passed"
 * and blamed browser/OS. That was NOT measured: pointerType, sourceCapabilities,
 * touch facts and the handler's own console.warn were never observed. This probe
 * observes exactly those, and nothing else.
 *
 * DISCRIMINATOR (read off the recorded evidence, not inferred):
 *   D1 requestPointerLock WAS called and rejected  <= a 'pointerlockerror' event
 *      and/or the authored console.warn 'Pointer lock request failed:' appears
 *      after a trusted canvas click.
 *   D2 the authored handler RETURNED EARLY         <= a trusted click whose
 *      target IS the canvas, with no lock, no pointerlockerror and no authored
 *      warn; then the recorded pointerType / sourceCapabilities / touch-control
 *      DOM say WHICH clause returned.
 *   D3 the click never reached the canvas handler  <= observed click target is
 *      not the canvas, or no click event at all.
 *
 * LANE: observer-only. Read-only listeners are attached before the click; they
 * never preventDefault/stopPropagation and never write game state. NO direct
 * requestPointerLock call, NO synthetic/dispatched click, NO handler patch, NO
 * overlay hiding, NO gate relaxation, NO progress or menu writes.
 *
 * BOUND: at most TWO real canvas clicks in this ONE session, plus (diagnostic
 * only) at most ONE ordinary 100ms W pulse to measure whether the KEYBOARD path
 * is independently enabled. A W pulse here is NOT accepted manual input and
 * proves no playability and no chapter progress.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { ART, RUN_DIR, REPO_ROOT } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard, failureRecord } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from '../lib/sourceSnapshot.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';
import {
  heavyLockOwnership, fetchServedIdentity, previewBindingDecision,
  preflightDecision, identityVerdict, bodyUsable, settled, orUnavailable
} from './commonPassageLogic.pinned.mjs';

const ROLE = 'entry-discriminator';
const P = [...process.argv.slice(2)];
const arg = (n, d = null) => { const i = P.indexOf(`--${n}`); return i >= 0 && P[i + 1] && !P[i + 1].startsWith('--') ? P[i + 1] : d; };
const flag = (n) => P.includes(`--${n}`);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const shaFile = (p) => (existsSync(p) ? sha(readFileSync(p)) : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

const t0 = Date.now();
const outArg = arg('out', null);
const outDir = outArg ? (isAbsolute(outArg) ? outArg : resolve(RUN_DIR, outArg)) : null;
const say = (m) => console.log(`[eid] ${new Date().toISOString()} +${Date.now() - t0}ms ${m}`);

// The exact shipped files this diagnostic reasons about; bytes recorded before AND after.
const WATCHED = [
  'main/src/components/CameraControls.tsx',
  'main/src/utils/mobileInput.ts',
  'main/src/components/mobile/TouchControls.tsx',
  'main/src/App.tsx'
];
const watchedShas = () => Object.fromEntries(WATCHED.map((r) => [r, shaFile(resolve(REPO_ROOT, r))]));

// ---------------------------------------------------------------- preflight ----
const ready = readJson(resolve(RUN_DIR, 'verification-ready.json'));
const control = readJson(resolve(RUN_DIR, 'verifier-control.json'));
const heavyLock = heavyLockOwnership({
  lockPath: arg('heavy-lock', process.env.PARAVOXIA_HEAVY_LOCK ?? null),
  fd: arg('heavy-lock-fd', null) === null ? null : Number.parseInt(String(arg('heavy-lock-fd', null)), 10),
  probeContention: flag('probe-lock-contention')
});
const previewOwnership = readJson(resolve(ART, 'preview-ownership.json'));
const URL_ARG = arg('url', null);
const served = URL_ARG ? await fetchServedIdentity({ url: URL_ARG, bundlePath: previewOwnership?.bundlePath ?? null }) : null;
const previewBinding = previewBindingDecision({
  ownership: previewOwnership, url: URL_ARG,
  expectSourceManifestSha: arg('expect-source-manifest', null), served
});
const pre = preflightDecision({
  ready, control, url: URL_ARG, out: outArg, heavyLock, previewBinding, role: ROLE,
  expectSourceManifestSha: arg('expect-source-manifest', null),
  liveSourceManifestSha: shaFile(resolve(RUN_DIR, 'implementation-source-manifest.json'))
});

const report = {
  schema: 'paravoxia.verifier.entryInputDiscriminator.v1',
  probe: 'entry-input-discriminator.mjs', role: ROLE,
  question: 'Does the authored CameraControls handleClick CALL requestPointerLock and get rejected, or RETURN EARLY on a game condition?',
  startedAt: new Date().toISOString(),
  lane: 'observer-only diagnostic; at most two real canvas clicks and one diagnostic W pulse; no game-state writes',
  notAcceptance: 'This is NOT manual playability, NOT a COMMON passage, NOT chapter approval. Historical passes are evidence of earlier success, not current acceptance.',
  heavyLock: heavyLock && { lockPath: heavyLock.lockPath, fd: heavyLock.fd, owned: heavyLock.owned, procLock: heavyLock.procLock, ancestors: heavyLock.ancestors, contentionProbe: heavyLock.contentionProbe, problems: heavyLock.problems },
  servedIdentity: served, previewBinding,
  control: control && { activeRole: control.activeRole, action: control.action, sourceManifestSha256: control.sourceManifestSha256 },
  readiness: ready && { ready: ready.ready, contractSha256: ready.contractSha256, sourceManifestSha256: ready.sourceManifestSha256 },
  sourceBytesBefore: watchedShas(),
  sourceManifestBefore: shaFile(resolve(RUN_DIR, 'implementation-source-manifest.json')),
  gates: [], observations: {}, clicks: [], consoleWarnErrors: [], pageErrors: [],
  pointerLockEvents: [], wPulse: null, discriminator: null, verdict: 'INCOMPLETE'
};
const gate = (name, ok, detail) => {
  report.gates.push({ name, ok, detail, at: new Date().toISOString() });
  say(`GATE ${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail).slice(0, 260)}`);
  return ok;
};

if (!pre.launch) {
  const refusal = { ...report, launched: false, verdict: 'REFUSED-PREREQUISITE', refusals: pre.refusals };
  if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'refusal.json'), JSON.stringify(refusal, null, 1)); }
  console.error(JSON.stringify(refusal.refusals, null, 1));
  say(`REFUSED before any browser launch: ${pre.refusals.join(' | ')}`);
  process.exit(3);
}
assertFreshOutputDir(outDir, { what: 'entry-input diagnostic capture' });
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------- page-side probes ----
// Read-only. Nothing here calls requestPointerLock, dispatches an event,
// mutates game state, or interferes with the authored listeners.
const OBSERVER = () => {
  const w = window;
  if (w.__entryDiag) return 'already-installed';
  const rec = { clicks: [], lockEvents: [], installedAt: Date.now() };
  w.__entryDiag = rec;
  const canvas = () => document.querySelector('canvas');
  const describe = (el) => (el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.').slice(0, 40) : ''}` : null);
  const snapClick = (e, phase) => {
    const s = e;
    rec.clicks.push({
      phase, t: Date.now(), type: e.type,
      isTrusted: e.isTrusted,
      target: describe(e.target), targetIsCanvas: e.target === canvas(),
      currentTarget: describe(e.currentTarget),
      pointerType: 'pointerType' in s ? s.pointerType : '<absent>',
      sourceCapabilities: s.sourceCapabilities === undefined ? '<absent>'
        : s.sourceCapabilities === null ? null
        : { firesTouchEvents: s.sourceCapabilities.firesTouchEvents },
      buttons: e.buttons, button: e.button, detail: e.detail,
      clientX: e.clientX, clientY: e.clientY,
      pointerLockElementAtEvent: document.pointerLockElement ? describe(document.pointerLockElement) : null,
      // the exact predicate the shipped allowsMousePointerLock evaluates, minus
      // its module-private touchActive (which no page API exposes)
      allowsExceptTouchActive: (!('pointerType' in s) || !s.pointerType || s.pointerType === 'mouse')
        && (s.sourceCapabilities === undefined || s.sourceCapabilities === null || s.sourceCapabilities.firesTouchEvents !== true)
    });
  };
  // capture phase on window: runs BEFORE the canvas's own click listener
  window.addEventListener('click', (e) => snapClick(e, 'capture-before-canvas-handler'), true);
  // bubble phase on document: runs AFTER the canvas's own click listener
  document.addEventListener('click', (e) => snapClick(e, 'bubble-after-canvas-handler'), false);
  document.addEventListener('pointerlockchange', () => rec.lockEvents.push({ t: Date.now(), type: 'pointerlockchange', lockEl: document.pointerLockElement ? describe(document.pointerLockElement) : null }));
  document.addEventListener('pointerlockerror', (e) => rec.lockEvents.push({ t: Date.now(), type: 'pointerlockerror', lockEl: document.pointerLockElement ? describe(document.pointerLockElement) : null, detail: String(e && e.type) }));
  return 'installed';
};

const READ_DIAG = () => {
  const rec = window.__entryDiag ?? { clicks: [], lockEvents: [] };
  return { clicks: rec.clicks, lockEvents: rec.lockEvents };
};

const TOUCH_FACTS = () => {
  const canvas = document.querySelector('canvas');
  const mm = (q) => { try { return window.matchMedia(q).matches; } catch { return '<unavailable>'; } };
  const testids = [...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
  return {
    navigatorMaxTouchPoints: navigator.maxTouchPoints,
    ontouchstartInWindow: 'ontouchstart' in window,
    innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    matchMedia: { pointerCoarse: mm('(pointer: coarse)'), pointerFine: mm('(pointer: fine)'), hoverNone: mm('(hover: none)') },
    // isTouchDevice() in main/src/utils/mobileInput.ts, recomputed from the SAME facts
    isTouchDeviceRecomputed: ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 820,
    // shipped touch UI DOM: TouchControls calls setTouchActive(true) while mounted
    touchJoystickMounted: !!document.querySelector('[data-testid="touch-joystick"]'),
    touchActionClusterMounted: !!document.querySelector('[data-testid="touch-action-cluster"]'),
    touchTestIds: testids.filter((id) => id && id.startsWith('touch-')),
    allTestIdsSample: testids.slice(0, 40),
    canvas: canvas ? (() => {
      const r = canvas.getBoundingClientRect();
      const cs = getComputedStyle(canvas);
      const el = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
      return {
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        pointerEvents: cs.pointerEvents, touchAction: cs.touchAction, cursor: cs.cursor,
        tabIndex: canvas.tabIndex,
        elementFromPointCentre: el ? { tag: el.tagName.toLowerCase(), isCanvas: el === canvas, cls: String(el.className || '').slice(0, 60), pointerEvents: getComputedStyle(el).pointerEvents, zIndex: getComputedStyle(el).zIndex } : null
      };
    })() : null,
    document: {
      title: document.title, hasFocus: document.hasFocus(), visibilityState: document.visibilityState,
      activeElement: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
      pointerLockElement: document.pointerLockElement ? document.pointerLockElement.tagName.toLowerCase() : null,
      pointerLockElementIsCanvas: !!canvas && document.pointerLockElement === canvas,
      requestPointerLockPresent: !!(canvas && typeof canvas.requestPointerLock === 'function'),
      // a page-level user-activation reading; not a gate
      userActivation: navigator.userActivation ? { isActive: navigator.userActivation.isActive, hasBeenActive: navigator.userActivation.hasBeenActive } : '<absent>'
    },
    policy: window.__storyInputPolicy ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode } : null,
    autopilotPresent: !!window.__autopilot,
    movieFlag: new URLSearchParams(location.search).get('movie'),
    href: location.href,
    // any ordinary shipped recovery/resume UI a player could click instead
    visibleDialogs: [...document.querySelectorAll('button, [role="button"], dialog, [aria-modal="true"]')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; })
      .slice(0, 25).map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || '').trim().slice(0, 60), testid: el.getAttribute('data-testid') }))
  };
};

const CG = () => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return { beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, supported: s.supported, worldBound: s.worldBound, groundOffsetUnits: s.groundOffsetUnits };
};

// ------------------------------------------------------------------- session ----
const guard = createOwnedSessionGuard({ log: say, label: ROLE });
let page = null;
let exitCode = 0;
try {
  const beforeSnapshot = writeSourceSnapshot({
    entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
    note: 'Exact bytes of this diagnostic and its pinned libraries at launch.'
  });
  report.probeSnapshotBefore = snapshotRef(beforeSnapshot);

  const previewRef = { url: URL_ARG, stop() { /* root owns the preview; never touched */ } };
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1', preview: previewRef, build: false,
    viewport: { width: 1280, height: 720 }, log: say
  }));
  page = session.page;
  report.entryUrl = session.url; report.renderer = session.renderer; report.headed = session.headed;
  report.viewportRequested = { width: 1280, height: 720 };

  page.on('console', (m) => {
    const type = m.type();
    if (type !== 'warning' && type !== 'error') return;
    report.consoleWarnErrors.push({ t: new Date().toISOString(), type, text: m.text().slice(0, 400) });
  });
  page.on('pageerror', (e) => report.pageErrors.push({ t: new Date().toISOString(), text: String(e).slice(0, 400) }));

  await waitReady(page, { timeoutMs: 120000 });
  await page.bringToFront();

  const t = await page.evaluate(TOUCH_FACTS);
  const ident = identityVerdict({
    title: t.document.title, renderer: session.renderer, headed: session.headed,
    indexSha: served?.indexSha256 ?? null, expectIndexSha: previewOwnership?.indexSha256 ?? null
  });
  if (!ident.ok) { gate('identity-paravoxia-on-hardware', false, ident.problems); throw new Error(`identity: ${ident.problems.join('; ')}`); }
  gate('identity-paravoxia-on-hardware', true, { title: t.document.title, renderer: session.renderer, headed: session.headed, indexSha: served?.indexSha256 });
  gate('manual-lane', t.movieFlag !== '1' && t.autopilotPresent === false, { movieFlag: t.movieFlag, autopilotPresent: t.autopilotPresent });

  // world bound + settled + supported + free policy, exactly as the manual lane waits
  let cg = null; const tw = Date.now();
  while (Date.now() - tw < 120000) { cg = await page.evaluate(CG); if (cg?.worldBound && bodyUsable(cg.bodyPose ?? cg.bodyCentre ?? []).ok) break; await sleep(400); }
  gate('world-bound-and-noninitial-body', !!cg?.worldBound, { worldBound: cg?.worldBound ?? null, bodyPose: cg?.bodyPose ?? null });
  const samples = []; const ts = Date.now(); let sr = { ok: false, spread: null };
  while (Date.now() - ts < 60000) {
    const s = await page.evaluate(CG);
    const p = s?.bodyPose ?? s?.bodyCentre ?? null;
    if (p && bodyUsable(p).ok) samples.push(p);
    sr = settled(samples);
    if (sr.ok && s?.supported === true) break;
    await sleep(250);
  }
  cg = await page.evaluate(CG);
  gate('settled-actually-supported-body', sr.ok && cg?.supported === true, { spread: sr.spread, supported: orUnavailable(cg?.supported), bodyPose: cg?.bodyPose });
  const pol = await page.evaluate(() => (window.__storyInputPolicy ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode } : null));
  gate('policy-permits-movement', !!pol && pol.moveSpeedScale > 0 && pol.lookMode !== 'side', pol ?? 'unavailable');

  // ---- observers BEFORE any real click ------------------------------------
  const installed = await page.evaluate(OBSERVER);
  gate('observers-installed-before-click', installed === 'installed', { installed });
  report.observations.beforeClick = await page.evaluate(TOUCH_FACTS);
  writeFileSync(join(outDir, 'frame-before-click.png'), await page.screenshot());

  // ---- at most TWO real canvas clicks -------------------------------------
  const r = report.observations.beforeClick.canvas?.rect;
  if (!r || r.width < 10) throw new Error('canvas rect unavailable');
  const cx = Math.round(r.x + r.width / 2); const cy = Math.round(r.y + r.height / 2);
  let locked = false;
  for (let attempt = 1; attempt <= 2 && !locked; attempt += 1) {
    const warnsBefore = report.consoleWarnErrors.length;
    await page.bringToFront();
    await page.mouse.move(cx, cy);
    await page.mouse.click(cx, cy);
    const tp = Date.now(); let lockState = null;
    while (Date.now() - tp < 3000) {
      lockState = await page.evaluate(() => { const c = document.querySelector('canvas'); return { isCanvas: !!c && document.pointerLockElement === c, el: document.pointerLockElement ? document.pointerLockElement.tagName.toLowerCase() : null }; });
      if (lockState.isCanvas) break;
      await sleep(150);
    }
    locked = lockState?.isCanvas === true;
    const diag = await page.evaluate(READ_DIAG);
    const rec = {
      attempt, at: new Date().toISOString(), waitedMs: Date.now() - tp,
      clientPoint: [cx, cy], locked,
      pointerLockElement: lockState?.el ?? null,
      observedClickEvents: diag.clicks.slice(-4),
      lockEventsSoFar: diag.lockEvents,
      newConsoleWarnErrors: report.consoleWarnErrors.slice(warnsBefore),
      stateAfter: await page.evaluate(TOUCH_FACTS)
    };
    report.clicks.push(rec);
    report.pointerLockEvents = diag.lockEvents;
    say(`CLICK ${attempt}: locked=${locked} clickEvents=${diag.clicks.length} lockEvents=${diag.lockEvents.length} newWarns=${rec.newConsoleWarnErrors.length}`);
    writeFileSync(join(outDir, `frame-after-click-${attempt}.png`), await page.screenshot());
    if (!locked) await sleep(1200);
  }

  // ---- ONE diagnostic W pulse (NOT accepted manual input, NOT playability) --
  const before = await page.evaluate(CG);
  await page.keyboard.down('KeyW');
  await sleep(100);
  await page.keyboard.up('KeyW');
  await sleep(600);
  const after = await page.evaluate(CG);
  const d = (a, b) => (Array.isArray(a) && Array.isArray(b) ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) : null);
  const pa = before?.bodyPose ?? before?.bodyCentre ?? null; const pb = after?.bodyPose ?? after?.bodyCentre ?? null;
  report.wPulse = {
    purpose: 'DIAGNOSTIC ONLY — measures whether the keyboard path is independently enabled. Not accepted manual input, not playability, no chapter progress.',
    heldMs: 100, before: pa, after: pb,
    displacement: d(pa, pb),
    displacementXZ: (pa && pb) ? Math.hypot(pb[0] - pa[0], pb[2] - pa[2]) : null,
    pointerLockAtPulse: (await page.evaluate(() => { const c = document.querySelector('canvas'); return !!c && document.pointerLockElement === c; }))
  };
  say(`W-PULSE (diagnostic): dispXZ=${report.wPulse.displacementXZ} locked=${report.wPulse.pointerLockAtPulse}`);
  writeFileSync(join(outDir, 'frame-after-w-pulse.png'), await page.screenshot());
  report.observations.afterAll = await page.evaluate(TOUCH_FACTS);
  report.observations.rawDiag = await page.evaluate(READ_DIAG);

  // ---- discriminate, from recorded evidence only ---------------------------
  const clickEvents = report.observations.rawDiag.clicks;
  const trustedOnCanvas = clickEvents.filter((c) => c.isTrusted === true && c.targetIsCanvas === true);
  const authoredWarn = report.consoleWarnErrors.filter((c) => /Pointer lock request failed/i.test(c.text));
  const lockErrors = report.observations.rawDiag.lockEvents.filter((e) => e.type === 'pointerlockerror');
  const lockChanges = report.observations.rawDiag.lockEvents.filter((e) => e.type === 'pointerlockchange');
  const anyLocked = report.clicks.some((c) => c.locked);
  const tf = report.observations.afterAll;
  let branch; let cause;
  if (anyLocked) {
    branch = 'LOCK-SUCCEEDED';
    cause = 'An ordinary real canvas click took pointer lock in this session.';
  } else if (trustedOnCanvas.length === 0) {
    branch = 'D3-CLICK-NEVER-REACHED-CANVAS';
    cause = 'No trusted click event was observed with the canvas as target.';
  } else if (authoredWarn.length > 0 || lockErrors.length > 0) {
    branch = 'D1-REQUESTPOINTERLOCK-CALLED-AND-REJECTED';
    cause = `The authored handler called requestPointerLock and it failed: ${authoredWarn.map((w) => w.text).join(' | ') || lockErrors.map((e) => e.type).join(',')}`;
  } else {
    const perEvent = trustedOnCanvas.map((c) => ({
      phase: c.phase, pointerType: c.pointerType, sourceCapabilities: c.sourceCapabilities,
      allowsExceptTouchActive: c.allowsExceptTouchActive,
      lockHeldAtEvent: c.pointerLockElementAtEvent
    }));
    const eventClauseFails = trustedOnCanvas.some((c) => c.allowsExceptTouchActive === false);
    branch = 'D2-HANDLER-RETURNED-EARLY';
    cause = eventClauseFails
      ? 'allowsMousePointerLock is FALSE on the observed event itself (pointerType / sourceCapabilities.firesTouchEvents).'
      : (tf.touchJoystickMounted || tf.touchActionClusterMounted)
        ? 'the shipped touch controls are MOUNTED, so mobileInput touchActive is true and allowsMousePointerLock returns false.'
        : 'the event-side clauses of allowsMousePointerLock pass and no touch UI is mounted; the early-return clause is NOT identified by the observed evidence.';
    report.discriminatorDetail = { perEvent, eventClauseFails };
  }
  report.discriminator = {
    branch, cause,
    trustedCanvasClicks: trustedOnCanvas.length,
    allClickEventsObserved: clickEvents.length,
    authoredConsoleWarnCount: authoredWarn.length,
    pointerlockerrorCount: lockErrors.length,
    pointerlockchangeCount: lockChanges.length,
    touchFacts: {
      navigatorMaxTouchPoints: tf.navigatorMaxTouchPoints,
      ontouchstartInWindow: tf.ontouchstartInWindow,
      innerWidth: tf.innerWidth,
      isTouchDeviceRecomputed: tf.isTouchDeviceRecomputed,
      touchJoystickMounted: tf.touchJoystickMounted,
      touchActionClusterMounted: tf.touchActionClusterMounted,
      pointerCoarse: tf.matchMedia.pointerCoarse
    }
  };
  report.verdict = anyLocked ? 'POINTER-LOCK-SUCCEEDED' : 'POINTER-LOCK-FAILED-CAUSE-CLASSIFIED';
  say(`DISCRIMINATOR ${branch} :: ${cause}`);
} catch (error) {
  report.verdict = 'DIAGNOSTIC-ERROR';
  report.failure = failureRecord({ probe: 'entry-input-discriminator.mjs', error, phase: 'diagnostic' });
  say(`ERROR: ${String(error).slice(0, 400)}`);
  exitCode = 2;
} finally {
  try { if (page) writeFileSync(join(outDir, 'frame-final.png'), await page.screenshot()); } catch { /* best effort */ }
  report.sessionCleanup = await guard.stopOnce('probe-finally').catch((e) => ({ stopped: false, error: String(e) }));
  report.sourceBytesAfter = watchedShas();
  report.sourceManifestAfter = shaFile(resolve(RUN_DIR, 'implementation-source-manifest.json'));
  report.sourceUnchanged = JSON.stringify(report.sourceBytesBefore) === JSON.stringify(report.sourceBytesAfter)
    && report.sourceManifestBefore === report.sourceManifestAfter;
  try {
    const afterSnapshot = writeSourceSnapshot({
      entryAbs: new URL(import.meta.url).pathname, outDir: join(outDir, 'after'), repoRoot: REPO_ROOT,
      note: 'Exact bytes of this diagnostic and its pinned libraries after the run.'
    });
    report.probeSnapshotAfter = snapshotRef(afterSnapshot);
  } catch { /* best effort */ }
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(report, null, 1));
  say(`verdict=${report.verdict} out=${outDir}`);
  process.exit(exitCode);
}
