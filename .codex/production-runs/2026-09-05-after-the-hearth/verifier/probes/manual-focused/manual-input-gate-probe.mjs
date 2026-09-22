/**
 * manual-input-gate-probe.mjs — bounded manual-focused input-gate discriminator.
 *
 * ROLE: manual-focused verifier (fresh commission 2026-09-06T15:09Z).
 * QUESTION (step 2 only): in ORDINARY manual play (no movie=1, no autopilot),
 * does an actual key-down reach the shipped input gate and produce grounded
 * horizontal movement, and does key-up stop it?
 *
 * SOURCE GATES this probe asserts BEFORE calling anything movement
 * (read from frozen source, not guessed):
 *   main/src/components/EfficientPlayer.tsx:1565-1571
 *     active = (controlsActive.current || isTouchActive() || isAutopilotDriving())
 *              && !isPhysicalBoardingInputLocked()
 *     -> desktop manual REQUIRES POINTER LOCK. Keys without lock are ignored.
 *   main/src/components/CameraControls.tsx:100-114
 *     pointer lock is requested by a REAL click whose target is gl.domElement
 *     (allowsMousePointerLock), and controlsActive follows pointerlockchange.
 *   main/src/story/storyInputPolicy.ts  -> window.__storyInputPolicy
 *     moveSpeedScale 0 freezes the feet even when `active`; lookMode 'side'
 *     kills W/S. ch13-survey authors SANDBOX_POLICY (beats/ch13/ch13-survey.ts:13).
 *   main/src/story/StoryDirectorDriver.tsx:130-138 -> window.__paravoxiaCommonGround
 *     bodyCentre/bodyPose/up/supported/worldBound (commonGroundDirector.ts:1808+).
 *   main/src/story/JourneyRuntimeProbeBridge.tsx:274-282 + journeyInputRuntime.ts
 *     window-boundary keydown receipts (passive; gameplay never reads them).
 *
 * NOT DONE HERE: no forced click dispatch, no synthetic pointerlock, no control
 * or pose or milestone mutation, no game-source edit, no movie nudges.
 * Fail-fast: a failed prerequisite STOPS the run and is reported as a bounded
 * INCONCLUSIVE or an evidenced input block — never papered over.
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { ART, CAPTURES, REPO_ROOT } from '../lib/cgContract.mjs';
import { createOwnedSessionGuard, failureRecord } from '../lib/ownedSession.mjs';
import { assertFreshOutputDir, writeSourceSnapshot, snapshotRef } from '../lib/sourceSnapshot.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../../main/tools/lib/evidence.mjs';

// ------------------------------------------------------------- pure guards ---
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Split a displacement into the component along `up` and the component in the tangent plane. */
export function splitByUp(from, to, up) {
  const u = Math.hypot(up[0], up[1], up[2]) < 1e-9 ? [0, 1, 0]
    : (() => { const m = Math.hypot(up[0], up[1], up[2]); return [up[0] / m, up[1] / m, up[2] / m]; })();
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const v = dot3(d, u);
  const h = [d[0] - v * u[0], d[1] - v * u[1], d[2] - v * u[2]];
  const hMag = Math.hypot(h[0], h[1], h[2]);
  return { vertical: v, horizontal: hMag, hUnit: hMag < 1e-9 ? null : [h[0] / hMag, h[1] / hMag, h[2] / hMag] };
}

/** A body is usable only if finite, NOT the uninitialised origin, and not a bare zero array. */
export function bodyUsable(p) {
  if (!Array.isArray(p) || p.length !== 3) return { ok: false, why: 'not-a-3-vector' };
  if (!p.every((n) => Number.isFinite(n))) return { ok: false, why: 'non-finite' };
  if (Math.hypot(p[0], p[1], p[2]) < 1e-6) return { ok: false, why: 'uninitialised-origin-000' };
  return { ok: true, why: null };
}

/** Settled = the last `n` samples all sit inside `eps` of each other (3D). */
export function settled(samples, { n = 8, eps = 0.02 } = {}) {
  if (samples.length < n) return { ok: false, why: `only ${samples.length} samples`, spread: null };
  const tail = samples.slice(-n);
  let spread = 0;
  for (let i = 0; i < tail.length; i++) for (let j = i + 1; j < tail.length; j++) spread = Math.max(spread, dist3(tail[i], tail[j]));
  return { ok: spread <= eps, why: spread <= eps ? null : `spread ${spread.toFixed(4)} > ${eps}`, spread };
}

/** Two held directions prove steering, not settling, only if both moved AND they diverge. */
export function directionsDistinct(aUnit, bUnit, minDeg = 25) {
  if (!aUnit || !bUnit) return { ok: false, deg: null, why: 'a held key produced no horizontal direction' };
  const c = Math.max(-1, Math.min(1, dot3(aUnit, bUnit)));
  const deg = (Math.acos(c) * 180) / Math.PI;
  return { ok: deg >= minDeg, deg, why: deg >= minDeg ? null : `only ${deg.toFixed(1)}deg apart` };
}

// ------------------------------------------------------------- self-test ----
if (process.argv.includes('--self-test')) {
  const fail = (m) => { console.error(`[manual-input-gate self-test] FAIL ${m}`); process.exit(1); };
  if (bodyUsable([0, 0, 0]).ok) fail('[0,0,0] must be rejected as uninitialised');
  if (bodyUsable([1, NaN, 2]).ok) fail('non-finite must be rejected');
  if (bodyUsable('nope').ok) fail('non-array must be rejected');
  if (!bodyUsable([-42, 52.7, 12]).ok) fail('a real spawn pose must be accepted');
  const s = splitByUp([0, 50, 0], [0, 48.9, 0], [0, 1, 0]);
  if (Math.abs(s.horizontal) > 1e-9) fail('pure vertical settling must yield zero horizontal');
  if (s.hUnit !== null) fail('pure vertical settling must yield no direction');
  const s2 = splitByUp([0, 50, 0], [3, 49, 4], [0, 1, 0]);
  if (Math.abs(s2.horizontal - 5) > 1e-9) fail('horizontal magnitude wrong');
  if (Math.abs(s2.vertical + 1) > 1e-9) fail('vertical component wrong');
  if (settled([[0, 0, 0]], { n: 8 }).ok) fail('too few samples cannot be settled');
  if (!settled(Array.from({ length: 8 }, (_, i) => [0, 50 + i * 1e-4, 0])).ok) fail('a quiet body must settle');
  if (settled(Array.from({ length: 8 }, (_, i) => [0, 50 - i * 0.3, 0])).ok) fail('a falling body must NOT settle');
  if (!directionsDistinct([1, 0, 0], [0, 0, 1]).ok) fail('perpendicular holds must be distinct');
  if (directionsDistinct([1, 0, 0], [1, 0, 0]).ok) fail('identical holds must not pass');
  if (directionsDistinct(null, [1, 0, 0]).ok) fail('a null direction must fail, not pass');
  console.log('[manual-input-gate self-test] OK');
  process.exit(0);
}

// ------------------------------------------------------------------ setup ---
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const outName = arg('out', 'input-gate-1');
const holdMs = Number(arg('hold-ms', '1500'));
const outDir = resolve(CAPTURES, 'manual-focused', outName);
assertFreshOutputDir(outDir, { what: 'manual-focused input gate' });
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
const t0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`[mig] ${new Date().toISOString()} +${Date.now() - t0}ms ${m}`);
const emit = (rec) => appendFileSync(tracePath, `${JSON.stringify({ atMs: Date.now() - t0, at: new Date().toISOString(), ...rec })}\n`);
const sha = (b) => createHash('sha256').update(b).digest('hex');

const own = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (own.state !== 'running') throw new Error(`root preview not running (state=${own.state}); this probe never starts one`);
const previewRef = { url: own.url, stop() { /* ROOT owns this preview */ } };
const sourceManifest = writeSourceSnapshot({
  entryAbs: new URL(import.meta.url).pathname, outDir, repoRoot: REPO_ROOT,
  note: 'Exact bytes of the manual-focused input-gate probe and its libraries.'
});

// ------------------------------------------------------ page-side readers ---
const cgSnap = (page) => page.evaluate(() => {
  const s = window.__paravoxiaCommonGround?.snapshot?.();
  if (!s) return null;
  return { beat: s.beat, bodyCentre: s.bodyCentre, bodyPose: s.bodyPose, up: s.up, supported: s.supported,
    worldBound: s.worldBound, rail: s.rail, holdReason: s.diagnostic?.holdReason ?? null,
    survey: s.diagnostic?.survey ?? null, anchors: s.diagnostic?.anchors ?? null };
});
/** Passive observation of the actual control gate. No writes, no dispatch. */
const controlProbe = (page) => page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const el = document.activeElement;
  return {
    hasFocus: document.hasFocus(), visibility: document.visibilityState,
    pointerLockElement: document.pointerLockElement ? document.pointerLockElement.tagName.toLowerCase() : null,
    pointerLockIsCanvas: !!canvas && document.pointerLockElement === canvas,
    activeElement: el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}` : null,
    canvasRect: canvas ? (({ x, y, width, height }) => ({ x, y, width, height }))(canvas.getBoundingClientRect()) : null,
    storyInputPolicy: window.__storyInputPolicy
      ? { moveSpeedScale: window.__storyInputPolicy.moveSpeedScale, lookMode: window.__storyInputPolicy.lookMode,
          allowJump: window.__storyInputPolicy.allowJump ?? null, allowSprint: window.__storyInputPolicy.allowSprint ?? null }
      : null,
    autopilotPresent: !!window.__autopilot,
    keyReceipts: (() => { try { const s = window.__paravoxiaJourneyProbe?.snapshot?.(); const i = s?.input;
      return i ? { hotkeyActivations: i.hotkeyActivations, revision: i.revision, activeElement: i.activeElement ?? null,
        lastCodes: (i.events ?? []).slice(-6).map((e) => e.code ?? e.type) } : null; } catch (e) { return { error: String(e).slice(0, 80) }; } })()
  };
});

const guard = createOwnedSessionGuard({ log: say, label: 'manual-focused input-gate session' });
const report = {
  schema: 'paravoxia.verifier.manualInputGate.v1', probe: 'manual-input-gate-probe.mjs',
  role: 'manual-focused', startedAt: new Date(t0).toISOString(),
  lane: 'MANUAL — no movie=1, no autopilot, ordinary shipped keys only',
  sourceSnapshot: snapshotRef(sourceManifest), previewUrl: own.url, previewIndexSha256: own.indexSha256,
  gates: [], holds: [], verdict: 'INCOMPLETE', stoppedAtGate: null, findings: []
};
const gate = (name, ok, detail) => { const g = { name, ok, detail, at: new Date().toISOString() }; report.gates.push(g); emit({ gate: g });
  say(`GATE ${ok ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(detail).slice(0, 300)}`); return ok; };
const stop = async (page, name, detail) => {
  report.verdict = 'STOPPED-PREREQUISITE'; report.stoppedAtGate = name;
  if (page) { const png = await page.screenshot().catch(() => null);
    if (png) { writeFileSync(join(outDir, `stop-${name}.png`), png); report.stopShot = `stop-${name}.png`; }
    report.stopState = { control: await controlProbe(page).catch(() => null), cg: await cgSnap(page).catch(() => null), state: await readState(page).catch(() => null) }; }
  throw Object.assign(new Error(`prerequisite failed at ${name}: ${JSON.stringify(detail)}`), { gateStop: true });
};

let page = null;
try {
  const session = guard.adopt(await openParavoxia({
    url: '?story=ch13-survey&journeyprobe=1&debug=1', preview: previewRef, build: false,
    viewport: { width: 1280, height: 720 }, log: say
  }));
  page = session.page;
  report.renderer = session.renderer; report.headed = session.headed; report.entryUrl = session.url;
  report.prerequisiteFixture = 'Deep entry ?story=ch13-survey seeds this beat only. It is a labelled fixture, NOT full-story or station continuity.';
  await waitReady(page, { timeoutMs: 120000 });
  await page.bringToFront();
  gate('hardware', /ANGLE/.test(session.renderer) && session.headed === true, { renderer: session.renderer, headed: session.headed });
  if (!/ANGLE/.test(session.renderer) || !session.headed) await stop(page, 'hardware', session.renderer);

  // ---- G1 world bound + a real, non-initial body -------------------------
  let cg = null; const t1 = Date.now();
  while (Date.now() - t1 < 90000) {
    cg = await cgSnap(page);
    if (cg?.worldBound && bodyUsable(cg.bodyCentre).ok) break;
    await sleep(400);
  }
  const usable = bodyUsable(cg?.bodyCentre ?? null);
  if (!gate('world-bound-and-body', !!cg?.worldBound && usable.ok, { worldBound: cg?.worldBound ?? null, bodyCentre: cg?.bodyCentre ?? null, why: usable.why, beat: cg?.beat ?? null, waitedMs: Date.now() - t1 }))
    await stop(page, 'world-bound-and-body', { worldBound: cg?.worldBound ?? null, body: cg?.bodyCentre ?? null, why: usable.why });

  // ---- G2 the body must SETTLE before any key is pressed -----------------
  const settleSamples = []; const t2 = Date.now(); let settleRes = { ok: false, why: 'never sampled' };
  while (Date.now() - t2 < 60000) {
    const s = await cgSnap(page);
    if (s && bodyUsable(s.bodyCentre).ok) settleSamples.push(s.bodyCentre);
    settleRes = settled(settleSamples);
    if (settleRes.ok && s?.supported === true) break;
    await sleep(250);
  }
  const preCg = await cgSnap(page);
  if (!gate('settled-grounded-body', settleRes.ok && preCg?.supported === true, { spread: settleRes.spread, why: settleRes.why, supported: preCg?.supported ?? null, samples: settleSamples.length, body: preCg?.bodyCentre, waitedMs: Date.now() - t2 }))
    await stop(page, 'settled-grounded-body', settleRes);

  // ---- G3 story input policy actually permits feet -----------------------
  let ctl = await controlProbe(page);
  emit({ phase: 'control-before-click', ctl });
  const pol = ctl.storyInputPolicy;
  if (!gate('story-policy-permits-movement', !!pol && pol.moveSpeedScale > 0 && pol.lookMode !== 'side', { policy: pol }))
    await stop(page, 'story-policy-permits-movement', pol);
  gate('no-autopilot-in-this-lane', ctl.autopilotPresent === false || report.entryUrl.indexOf('movie=1') < 0, { autopilotPresent: ctl.autopilotPresent, url: report.entryUrl });

  // ---- G4 real shipped click on the canvas -> real pointer lock ----------
  // CameraControls only locks for a genuine mouse click whose target IS the
  // canvas. This is an ordinary player click, not a dispatched event.
  const r = ctl.canvasRect;
  if (!r || r.width < 10) await stop(page, 'canvas-present', r);
  await page.mouse.click(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
  const t4 = Date.now();
  while (Date.now() - t4 < 5000) { ctl = await controlProbe(page); if (ctl.pointerLockIsCanvas) break; await sleep(200); }
  emit({ phase: 'control-after-click', ctl });
  if (!gate('pointer-lock-active', ctl.pointerLockIsCanvas === true, { pointerLockElement: ctl.pointerLockElement, hasFocus: ctl.hasFocus, activeElement: ctl.activeElement, waitedMs: Date.now() - t4 }))
    await stop(page, 'pointer-lock-active', ctl);

  // ---- G5 held key -> grounded horizontal movement; key up -> cessation --
  const holdTest = async (code) => {
    const before = await cgSnap(page); const kBefore = (await controlProbe(page)).keyReceipts;
    const trail = [];
    await page.keyboard.down(code);
    const th = Date.now();
    while (Date.now() - th < holdMs) { const s = await cgSnap(page); if (s) trail.push({ ms: Date.now() - th, p: s.bodyCentre }); await sleep(100); }
    const held = await cgSnap(page);
    await page.keyboard.up(code);
    await sleep(900);
    const after = await cgSnap(page);
    const kAfter = (await controlProbe(page)).keyReceipts;
    const move = splitByUp(before.bodyCentre, held.bodyCentre, before.up ?? [0, 1, 0]);
    const coast = splitByUp(held.bodyCentre, after.bodyCentre, before.up ?? [0, 1, 0]);
    const rec = { code, holdMs, before: before.bodyCentre, held: held.bodyCentre, afterRelease: after.bodyCentre,
      horizontal: move.horizontal, vertical: move.vertical, hUnit: move.hUnit,
      coastHorizontal: coast.horizontal, supportedBefore: before.supported, supportedHeld: held.supported,
      receiptsBefore: kBefore?.hotkeyActivations ?? null, receiptsAfter: kAfter?.hotkeyActivations ?? null,
      lastCodes: kAfter?.lastCodes ?? null, trail };
    emit({ phase: 'hold', ...rec });
    say(`HOLD ${code}: horiz=${move.horizontal.toFixed(3)} vert=${move.vertical.toFixed(3)} coast=${coast.horizontal.toFixed(3)} receipts ${rec.receiptsBefore}->${rec.receiptsAfter}`);
    report.holds.push(rec);
    return rec;
  };
  const w = await holdTest('KeyW');
  if (!gate('keydown-reaches-window-boundary', (w.receiptsAfter ?? 0) > (w.receiptsBefore ?? 0), { before: w.receiptsBefore, after: w.receiptsAfter, codes: w.lastCodes }))
    await stop(page, 'keydown-reaches-window-boundary', w);
  if (!gate('held-key-produces-horizontal-movement', w.horizontal >= 0.5, { code: 'KeyW', horizontal: w.horizontal, vertical: w.vertical }))
    await stop(page, 'held-key-produces-horizontal-movement', w);
  if (!gate('key-up-stops-movement', w.coastHorizontal <= 0.25, { coastHorizontal: w.coastHorizontal }))
    await stop(page, 'key-up-stops-movement', w);
  const d = await holdTest('KeyD');
  const dist = directionsDistinct(w.hUnit, d.hUnit);
  if (!gate('second-direction-is-steering-not-settling', d.horizontal >= 0.5 && dist.ok, { horizontal: d.horizontal, degreesApart: dist.deg, why: dist.why }))
    await stop(page, 'second-direction-is-steering-not-settling', { d, dist });

  report.verdict = 'INPUT-PROVEN';
  report.findings.push('Actual key-down -> shipped input gate -> grounded horizontal movement, and key-up cessation, proven on hardware in the manual lane after a real canvas click acquired pointer lock.');
  const png = await page.screenshot(); writeFileSync(join(outDir, 'after-input.png'), png);
  report.finalShot = 'after-input.png';
  report.finalCg = await cgSnap(page); report.finalState = await readState(page); report.finalControl = await controlProbe(page);
} catch (err) {
  if (!err.gateStop) { report.verdict = 'ERROR'; report.error = String(err).slice(0, 400); }
  report.failure = failureRecord({ probe: 'manual-input-gate-probe.mjs', error: err, phase: report.stoppedAtGate ?? 'capture' });
  say(`STOP: ${String(err).slice(0, 300)}`);
} finally {
  await guard.stopOnce('probe-finally');
  report.cleanup = guard.cleanupReceipt({ probe: 'manual-input-gate-probe.mjs' });
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - t0;
  const body = JSON.stringify(report, null, 1);
  writeFileSync(join(outDir, 'summary.json'), body);
  writeFileSync(join(outDir, 'summary.sha256'), `${sha(body)}  summary.json\n`);
  say(`verdict=${report.verdict} out=${outDir}`);
}
process.exit(report.verdict === 'INPUT-PROVEN' ? 0 : 2);
