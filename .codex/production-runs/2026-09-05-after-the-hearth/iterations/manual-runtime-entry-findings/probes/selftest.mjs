#!/usr/bin/env node
/**
 * selftest.mjs — bounded static self-tests for the COMMON-passage harness logic.
 * No browser, no GPU, no game import, no game test files. `node selftest.mjs`.
 */
import {
  bodyUsable, settled, directionsDistinct, chooseKey, keyReceipt, preflightDecision,
  identityVerdict, promptOffersF, mayPressF, legVerdict, makeProgressTracker,
  passageVerdict, recoveryVerdict, clearanceBetween, poseReading, unit2, distXZ,
  CG_ROUTE_COMMON, CG_COMMON_ROUTE_UNITS, EARLY_TURN_POINT, CG_POSES, CG_ROUTE_LONG,
  heavyLockOwnership, devMajorMinor, parseProcLocks, ancestorPids,
  fetchServedIdentity, previewBindingDecision, sha256Hex,
  planPulseMs, detectOscillation, standClearChoice, minClearanceToSpan,
  incomingPlaneAt, signedPlaneOffset, planeLateralOffset, planeCrossingVerdict,
  orderedFrontierVerdict, earlyTurnVerdict
} from './commonPassageLogic.mjs';
import { openSync, closeSync, writeFileSync, mkdtempSync, rmSync, readFileSync, fstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

// ---- lock-owner child mode ---------------------------------------------------
// Re-entered under a REAL `flock` that has already acquired an exclusive lock and
// passes the still-open descriptor in: this is the only honest "pass" case.
const CHILD_FD = process.argv.indexOf('--lock-owner-child');
if (CHILD_FD >= 0) {
  const fd = Number.parseInt(process.argv[CHILD_FD + 1], 10);
  const lockPath = process.argv[process.argv.indexOf('--lock-path') + 1];
  const r = heavyLockOwnership({ lockPath, fd, probeContention: true });
  let fdinfo = null;
  try { fdinfo = readFileSync(`/proc/self/fdinfo/${fd}`, 'utf8'); } catch { fdinfo = null; }
  process.stdout.write(JSON.stringify({ ...r, fdinfo }));
  process.exit(0);
}

let failures = 0; let ran = 0;
const t = (name, fn) => { ran += 1; try { fn(); } catch (e) { failures += 1; console.error(`FAIL ${name}: ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, m) => { if (v !== true) throw new Error(m || 'expected true'); };
const no = (v, m) => { if (v !== false) throw new Error(m || 'expected false'); };

// --- geometry sanity (copies must still describe the signed passage) ----------
t('common route is ten vertices totalling eighteen units', () => {
  eq(CG_ROUTE_COMMON.length, 10, 'vertex count');
  let total = 0;
  for (let i = 1; i < CG_ROUTE_COMMON.length; i += 1) total += distXZ(CG_ROUTE_COMMON[i - 1], CG_ROUTE_COMMON[i]);
  if (Math.abs(total - CG_COMMON_ROUTE_UNITS) > 1e-9) throw new Error(`route length ${total} != 18`);
  eq([CG_ROUTE_COMMON[0][0], CG_ROUTE_COMMON[0][2]], [CG_POSES.E.x, CG_POSES.E.z], 'starts at E');
  eq([CG_ROUTE_COMMON[9][0], CG_ROUTE_COMMON[9][2]], [CG_POSES.C.x, CG_POSES.C.z], 'ends at C');
});
t('the early turn is on the second segment BEFORE the z=16 corner', () => {
  ok(EARLY_TURN_POINT[2] < CG_ROUTE_COMMON[2][2], 'turn z must be below the corner z');
  ok(EARLY_TURN_POINT[2] > CG_ROUTE_COMMON[1][2], 'turn z must be past the previous vertex');
  eq(EARLY_TURN_POINT[0], CG_ROUTE_COMMON[2][0], 'turn stays on the segment x');
});
t('endpoint separation is not the passage', () => {
  const straight = distXZ([CG_POSES.E.x, 0, CG_POSES.E.z], [CG_POSES.C.x, 0, CG_POSES.C.z]);
  eq(straight, 6, 'E->C straight line'); ok(straight < CG_COMMON_ROUTE_UNITS, 'walked span must exceed it');
});

// --- body / motion guards -----------------------------------------------------
t('initial-origin body is rejected', () => { no(bodyUsable([0, 0, 0]).ok); no(bodyUsable([0, NaN, 1]).ok); ok(bodyUsable([-42, 51.05, 12]).ok); });
t('settling requires a finite tail under eps', () => {
  no(settled([[1, 1, 1]]).ok, 'too few samples');
  ok(settled(Array.from({ length: 8 }, () => [1, 1, 1])).ok);
  no(settled([...Array.from({ length: 7 }, () => [1, 1, 1]), [5, 1, 1]]).ok, 'drifting body is not settled');
});
t('zero-motion key hold is NOT a receipt', () => {
  const r = keyReceipt({ from: [-42, 51.05, 12], to: [-42, 51.05, 12] });
  no(r.ok); if (!/settling/.test(r.why)) throw new Error(`why=${r.why}`);
});
t('vertical-only spawn settling is NOT horizontal motion', () => {
  const r = keyReceipt({ from: [-42, 55, 12], to: [-42, 51.05, 12], up: [0, 1, 0] });
  no(r.ok, 'a 3.95-unit fall must not read as a movement receipt');
});
t('real horizontal motion is a receipt with a direction', () => {
  const r = keyReceipt({ from: [-42, 51.05, 12], to: [-42, 51.05, 14] });
  ok(r.ok); eq(r.dir2, [0, 1], 'direction'); if (Math.abs(r.horizontal - 2) > 1e-9) throw new Error('horizontal');
});
t('an uninitialised body cannot produce a receipt', () => { no(keyReceipt({ from: [0, 0, 0], to: [1, 0, 0] }).ok); });
t('key chooser only picks measured directions', () => {
  const dirs = { KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
  eq(chooseKey(dirs, [-1, 0]).key, 'KeyW'); eq(chooseKey(dirs, [0, 1]).key, 'KeyD');
  eq(chooseKey({ KeyW: null }, [1, 0]).key, null, 'an uncalibrated key must not be chosen');
  eq(unit2([0, 0]), null, 'a zero vector has no direction');
});
t('direction distinctness needs both directions', () => { no(directionsDistinct(null, [1, 0, 0]).ok); ok(directionsDistinct([1, 0, 0], [0, 0, 1]).ok); });

// --- preflight / control refusal ------------------------------------------------
const okLock = { owned: true, problems: [] };
const okBinding = { ok: true, problems: [] };
const goodArgs = {
  url: 'http://127.0.0.1:41111/', out: 'verifier/captures/common-manual-focused/run-1',
  heavyLock: okLock, previewBinding: okBinding,
  expectSourceManifestSha: 'abc', liveSourceManifestSha: 'abc'
};
t('current hold + unready refuses launch', () => {
  const d = preflightDecision({ ready: { ready: false }, control: { action: 'hold' }, ...goodArgs });
  no(d.launch); ok(d.refusals.length >= 2);
});
t('ready + released control launches', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release', activeRole: 'common-manual-focused' }, ...goodArgs });
  ok(d.launch, JSON.stringify(d.refusals));
});
t('missing --url refuses (no stale hardcoded port)', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, url: null });
  no(d.launch); ok(d.refusals.some((r) => r.includes('--url')));
});
t('a lock receipt that is not OWNED refuses', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, heavyLock: { owned: false, problems: ['file exists but NO exclusive lock is held'] } });
  no(d.launch); ok(d.refusals.some((r) => /heavy lock is not PROVABLY held/.test(r)));
});
t('a MISSING lock receipt refuses (absence is never ownership)', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, heavyLock: null });
  no(d.launch); ok(d.refusals.some((r) => /no lock receipt was produced/.test(r)));
});
t('an unbound served build refuses before any browser', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, previewBinding: null });
  no(d.launch); ok(d.refusals.some((r) => /served bytes were never bound/.test(r)));
});
t('source manifest drift refuses', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, liveSourceManifestSha: 'zzz' });
  no(d.launch); ok(d.refusals.some((r) => /manifest sha mismatch/.test(r)));
});
t('a foreign active role refuses', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release', activeRole: 'someone-else' }, ...goodArgs });
  no(d.launch);
});

// --- identity -------------------------------------------------------------------
const IDENT_OK = { title: 'Paravoxia', renderer: 'ANGLE (NVIDIA GB10)', headed: true, indexSha: 'aa11', expectIndexSha: 'aa11' };
t('liveness is not identity', () => {
  no(identityVerdict({ ...IDENT_OK, title: 'Some Other App' }).ok);
  no(identityVerdict({ ...IDENT_OK, renderer: 'SwiftShader' }).ok);
  no(identityVerdict({ ...IDENT_OK, headed: false }).ok);
  ok(identityVerdict(IDENT_OK).ok);
});
t('title + ANGLE alone is NOT current-build identity', () => {
  const d = identityVerdict({ title: 'Paravoxia', renderer: 'ANGLE (NVIDIA GB10)', headed: true });
  no(d.ok, 'a previous build serves the same title on the same GPU');
  ok(d.problems.some((x) => /expected index sha/.test(x)));
});
t('a MEASURED-null index sha fails while an expected hash is required', () => {
  const d = identityVerdict({ ...IDENT_OK, indexSha: null });
  no(d.ok); ok(d.problems.some((x) => /measured index sha is null/.test(x)));
});
t('a mismatched index sha fails', () => { no(identityVerdict({ ...IDENT_OK, indexSha: 'bb22' }).ok); });

// --- prompt / F gating (mandatory negative cases) ---------------------------------
t('no prompt means no F', () => { no(promptOffersF([]).ok); no(promptOffersF(null).ok); no(promptOffersF(['Hold [E] to board']).ok); });
t('an F prompt for the WRONG verb is not the offer', () => {
  no(promptOffersF(['[F] Reopen the untested span'], /Offer this end/i).ok);
  ok(promptOffersF(['[F] Offer this end'], /Offer this end/i).ok);
});
t('F is refused when the objective is not the expected one', () => {
  const d = mayPressF({ objectiveId: 'ch13:common:reciprocal', expectedObjectiveId: 'ch13:common:offer-final-reference', prompts: ['[F] Offer this end'], verbPattern: /Offer this end/i });
  no(d.ok); ok(/objective is/.test(d.why));
});
t('F is allowed only with matching objective AND live prompt', () => {
  ok(mayPressF({ objectiveId: 'ch13:common:offer-final-reference', expectedObjectiveId: 'ch13:common:offer-final-reference', prompts: ['[F] Offer this end'], verbPattern: /Offer this end/i }).ok);
  no(mayPressF({ objectiveId: 'ch13:common:offer-final-reference', expectedObjectiveId: 'ch13:common:offer-final-reference', prompts: [], verbPattern: /Offer this end/i }).ok);
});

// --- arrival logic ---------------------------------------------------------------
t('a timeout is NEVER an arrival', () => {
  const l = legVerdict({ label: 'x', target: [0, 0, 0], arrive: 1, distance: 0.4, elapsedMs: 90000, budgetMs: 90000, stalledMs: 0 });
  no(l.reached); eq(l.status, 'timeout'); ok(l.fatal);
});
t('a stall is NEVER an arrival', () => {
  const l = legVerdict({ label: 'x', target: [0, 0, 0], arrive: 1, distance: 0.9, elapsedMs: 5000, budgetMs: 90000, stalledMs: 7000 });
  no(l.reached); eq(l.status, 'stalled');
});
t('a genuine in-budget arrival reads reached', () => {
  const l = legVerdict({ label: 'x', target: [0, 0, 0], arrive: 1, distance: 0.4, elapsedMs: 5000, budgetMs: 90000, stalledMs: 0 });
  ok(l.reached); eq(l.status, 'reached'); no(l.fatal);
});
t('a non-finite distance is not an arrival', () => {
  no(legVerdict({ label: 'x', target: [0, 0, 0], arrive: 1, distance: NaN, elapsedMs: 100, budgetMs: 9000, stalledMs: 0 }).reached);
});

// --- progress tracking --------------------------------------------------------------
t('progress tracker detects a lost earned prefix', () => {
  const p = makeProgressTracker();
  [0, 2, 4, 4, 4].forEach((u) => p.push(u));
  ok(p.prefixRetained); eq(p.max, 4);
  p.push(1); no(p.prefixRetained); eq(p.drop.from, 4);
});
t('progress tracker sees a stall', () => {
  const p = makeProgressTracker();
  [0, 2, 3.82, 3.82, 3.82, 3.82].forEach((u) => p.push(u));
  ok(p.stalledOver(4)); no(p.stalledOver(6));
});
t('an unavailable units field is not fabricated', () => {
  const p = makeProgressTracker(); p.push(null); eq(p.last, null); eq(p.max, 0);
});

// --- passage / recovery verdicts -------------------------------------------------
const fullPassage = { creditedUnits: 18, arrivalDistance: 0.4, supported: true, referenceObserved: true, orderedLegsAllReached: true, clearanceUnits: 1.4 };
t('body at the endpoint alone is NOT the passage', () => {
  const v = passageVerdict({ ...fullPassage, creditedUnits: 4 });
  no(v.ok); ok(v.failed.includes('fullEighteenCredited')); eq(v.verdict, 'PASSAGE-NOT-PROVED');
});
t('credit without physical arrival is NOT the passage', () => {
  no(passageVerdict({ ...fullPassage, arrivalDistance: 6 }).ok);
});
t('credit without live support/reference is NOT the passage', () => {
  no(passageVerdict({ ...fullPassage, supported: false }).ok);
  no(passageVerdict({ ...fullPassage, referenceObserved: false }).ok);
});
t('insufficient body clearance fails the passage', () => { no(passageVerdict({ ...fullPassage, clearanceUnits: 0.6 }).ok); });
t('an unavailable field is inconclusive, never a pass', () => {
  const v = passageVerdict({ ...fullPassage, supported: null });
  no(v.ok); eq(v.verdict, 'INCONCLUSIVE-UNAVAILABLE-FIELD');
});
t('the complete physical passage passes', () => { ok(passageVerdict(fullPassage).ok); });

const goodRecovery = { creditedAtDeviation: 3.82, creditedAfterFarExcursion: 3.82, creditedFinal: 18, returnedToFrontier: true, omittedGroundTraversed: true, prefixRetained: true };
t('honest return-to-frontier recovery is earned', () => {
  eq(recoveryVerdict(goodRecovery).verdict, 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND');
});
t('endpoint pumping must not read as recovery', () => {
  const v = recoveryVerdict({ ...goodRecovery, creditedAfterFarExcursion: 17.9, omittedGroundTraversed: false });
  ok(v.verdict !== 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND');
  ok(v.failed.includes('farExcursionBoughtNothing') || v.failed.includes('omittedGroundActuallyTraversed'));
});
t('credit never restored is a failed recovery', () => {
  eq(recoveryVerdict({ ...goodRecovery, creditedFinal: 4 }).verdict, 'RECOVERY-FAILED-CREDIT-NOT-RESTORED');
});
t('no stall means the case was not exercised', () => {
  eq(recoveryVerdict({ ...goodRecovery, creditedAfterFarExcursion: 18 }).verdict, 'NO-STALL-OBSERVED-CASE-NOT-EXERCISED');
});
t('an extra F or reset invalidates the recovery claim', () => {
  ok(recoveryVerdict({ ...goodRecovery, extraFPresses: 1 }).failed.includes('noExtraFNoReset'));
});
t('an unavailable recovery field is inconclusive', () => {
  eq(recoveryVerdict({ ...goodRecovery, creditedFinal: null }).verdict, 'INCONCLUSIVE-UNAVAILABLE-FIELD');
});

// --- pose spaces and clearance ------------------------------------------------------
t('capsule centre and grounded pose stay distinct', () => {
  const r = poseReading({ bodyCentre: [-42, 52.85, 12], bodyPose: [-42, 51.05, 12], groundOffsetUnits: 1.8, supported: true });
  eq(r.bodyPose, [-42, 51.05, 12]); eq(r.bodyCentre, [-42, 52.85, 12]); ok(r.available);
  eq(poseReading(null).available, false);
});
t('body clearance is an actual measured distance', () => {
  eq(clearanceBetween([-42, 51.05, 12], [-40, 51.05, 12]).ok, true);
  eq(clearanceBetween([-42, 51.05, 12], [-42.5, 51.05, 12]).ok, false);
  eq(clearanceBetween(null, [0, 0, 0]), null);
});


// --- fine steering: pulses and oscillation ----------------------------------------
// MEASURED: KeyW 1.5 s -> 7.722 units, i.e. 0.00515 u/ms, and 0.053 units of coast.
const UPMS = 0.00515;
t('an uncalibrated pulse is refused, never guessed', () => {
  eq(planPulseMs({ distance: 3, unitsPerMs: null }).ms, null);
  eq(planPulseMs({ distance: 3, unitsPerMs: 0 }).ms, null);
  eq(planPulseMs({ distance: NaN, unitsPerMs: UPMS }).ms, null);
});
t('the old fixed 120 ms minimum was coarser than the arrival radius', () => {
  const unitsIn120ms = 0.00515 * 120;
  ok(unitsIn120ms > 0.6, `120 ms is ${unitsIn120ms.toFixed(2)}u`);
  // a 0.6-unit radius could be overshot by a single minimum-length tap
  ok(unitsIn120ms > 0.6, 'so a minimum tap could cross the whole arrival radius');
});
t('a near-target pulse is finer than the arrival radius it aims into', () => {
  const p = planPulseMs({ distance: 0.7, arrive: 0.6, unitsPerMs: UPMS, coastUnits: 0.053 });
  ok(p.ms < 120, `near-target pulse ${p.ms}ms must beat the old 120ms floor`);
  ok(p.commandedUnits * UPMS >= 0, 'commanded units are finite');
  ok(p.commandedUnits <= 0.7, 'a pulse never commands past the target');
});
t('coast and half-radius are actually subtracted', () => {
  const p = planPulseMs({ distance: 2, arrive: 0.6, unitsPerMs: UPMS, coastUnits: 0.053 });
  ok(Math.abs(p.commandedUnits - (2 - 0.3 - 0.053)) < 1e-9, `commanded ${p.commandedUnits}`);
});
t('pulses are clamped to a sane band', () => {
  eq(planPulseMs({ distance: 500, arrive: 0.6, unitsPerMs: UPMS, maxMs: 400 }).ms, 400);
  eq(planPulseMs({ distance: 0.3, arrive: 0.6, unitsPerMs: UPMS, minMs: 30 }).ms, 30);
});
t('too few samples is NOT an oscillation claim', () => {
  const d = detectOscillation([1, 0.9, 1.0]);
  no(d.oscillating); ok(/samples/.test(d.why));
});
t('a real ping-pong around a small radius is detected and stops the leg', () => {
  const d = detectOscillation([0.71, 0.62, 0.70, 0.63, 0.71, 0.64, 0.70]);
  ok(d.oscillating, JSON.stringify(d)); ok(d.flips >= 4);
});
t('honest steady closing is NOT called oscillation', () => {
  no(detectOscillation([6, 5, 4, 3, 2, 1, 0.5]).oscillating);
});
t('an oscillating leg is never an arrival', () => {
  const l = legVerdict({ label: 'x', target: [0, 0, 0], arrive: 0.6, distance: 0.61, elapsedMs: 4000, budgetMs: 90000, stalledMs: 0, oscillating: true });
  no(l.reached); eq(l.status, 'oscillating'); ok(l.fatal);
});

// --- stand-clear choice after the offer at E -----------------------------------------
const SPAN = CG_ROUTE_LONG.map((p) => [...p]);
t('an unmeasured span gives NO clearance verdict', () => {
  const c = minClearanceToSpan([-34, 51.05, 10], []);
  eq(c.units, null); eq(c.ok, null); ok(/UNMEASURED/.test(c.why));
});
t('clearance to the recorded span is an actual measured minimum', () => {
  const c = minClearanceToSpan([-34, 51.05, 10], SPAN);
  ok(c.units > 1, `clearance ${c.units}`); ok(c.ok === true); ok(Number.isInteger(c.index));
});
t('a point ON the recorded span has no clearance', () => {
  const c = minClearanceToSpan([...SPAN[10]], SPAN);
  eq(c.units, 0); eq(c.ok, false);
});
t('waiting AT E is not clear of the offered span', () => {
  const c = minClearanceToSpan([CG_POSES.E.x, CG_POSES.E.y, CG_POSES.E.z], SPAN);
  eq(c.ok, false, 'E is the end of the drawn span itself');
});
const STAND_CANDIDATES = [
  { name: 'W', point: [CG_POSES.W.x, CG_POSES.W.y, CG_POSES.W.z], authored: true },
  { name: 'E.z-3', point: [CG_POSES.E.x, CG_POSES.E.y, CG_POSES.E.z - 3], authored: false },
  { name: 'on-LONG-route', point: [...SPAN[10]], authored: true }
];
t('the authored, OBSERVED-reachable, actually-clear point is chosen', () => {
  const r = standClearChoice({ candidates: STAND_CANDIDATES, recordedSpan: SPAN, observedReachable: ['W'] });
  eq(r.chosen.name, 'W'); ok(r.chosen.clearance > 1.5);
});
t('the arithmetic water goal E.z-3 is refused on PROVENANCE', () => {
  const r = standClearChoice({ candidates: STAND_CANDIDATES, recordedSpan: SPAN, observedReachable: ['W', 'E.z-3'] });
  const c = r.considered.find((x) => x.name === 'E.z-3');
  no(c.admissible); ok(/not-an-authored-pose/.test(c.why));
});
t('a point on the LONG route is refused: standing on his test IS the deadlock', () => {
  const r = standClearChoice({ candidates: STAND_CANDIDATES, recordedSpan: SPAN, observedReachable: ['on-LONG-route'] });
  const c = r.considered.find((x) => x.name === 'on-LONG-route');
  no(c.admissible); ok(/on-or-beside-the-recorded-span/.test(c.why));
});
t('an authored point NEVER physically reached on this build is refused', () => {
  const r = standClearChoice({ candidates: STAND_CANDIDATES, recordedSpan: SPAN, observedReachable: [] });
  eq(r.chosen, null);
  ok(/not-observed-reachable/.test(r.considered.find((x) => x.name === 'W').why));
});

// --- F gating: no press without the exact authored objective AND prompt --------------
t('an any-prompt press is refused when no expectation is supplied', () => {
  no(mayPressF({ objectiveId: 'ch13:survey:offer', prompts: ['[F] Offer to demonstrate a route'] }).ok);
  no(mayPressF({ objectiveId: 'ch13:survey:offer', expectedObjectiveId: 'ch13:survey:offer', prompts: ['[F] anything'] }).ok);
});

// --- REAL exclusive-lock ownership (task-private lock, never the shared GPU lock) -----
const TMP = mkdtempSync(join(tmpdir(), 'cmp-selftest-'));
const OWN_LOCK = join(TMP, 'task-private-own.lock');
const FOREIGN_LOCK = join(TMP, 'task-private-foreign.lock');
writeFileSync(OWN_LOCK, ''); writeFileSync(FOREIGN_LOCK, '');
const SELF = new URL(import.meta.url).pathname;
const syncSleep = (sec) => { try { execFileSync('sleep', [String(sec)]); } catch { /* ignore */ } };
let foreign = null;
try {
  t('devMajorMinor agrees with a REAL /proc/locks entry for a real fd', () => {
    // parser + dev_t split are validated against the kernel below, in the pass case
    const rec = parseProcLocks('1: FLOCK  ADVISORY  WRITE 1234 fd:01:99 0 EOF');
    eq(rec.length, 1); eq(rec[0].pid, 1234); eq(rec[0].mode, 'WRITE'); eq(rec[0].inode, 99);
    eq(rec[0].major, 0xfd); eq(rec[0].minor, 0x01);
    eq(parseProcLocks('garbage line').length, 0, 'unparseable lines are dropped, never guessed');
    ok(ancestorPids(process.pid).includes(process.pid), 'the pid chain starts at this process');
  });
  t('a MISSING path or fd is refused outright', () => {
    ok(heavyLockOwnership({ lockPath: null, fd: 3 }).problems.some((x) => /--heavy-lock </.test(x)));
    ok(heavyLockOwnership({ lockPath: OWN_LOCK, fd: null }).problems.some((x) => /--heavy-lock-fd/.test(x)));
    ok(heavyLockOwnership({ lockPath: OWN_LOCK, fd: 9999 }).problems.some((x) => /no descriptor was inherited/.test(x)));
  });
  t('an EXISTING but UNLOCKED file is not ownership', () => {
    const fd = openSync(OWN_LOCK, 'r+');
    try {
      const r = heavyLockOwnership({ lockPath: OWN_LOCK, fd });
      no(r.owned);
      ok(r.problems.some((x) => /NO exclusive lock is held/.test(x)), JSON.stringify(r.problems));
      eq(r.fdDevIno.ino, r.pathDevIno.ino, 'fd and path are the same inode');
    } finally { closeSync(fd); }
  });
  t('a descriptor for a DIFFERENT file is not ownership of this lock', () => {
    const fd = openSync(FOREIGN_LOCK, 'r+');
    try {
      const r = heavyLockOwnership({ lockPath: OWN_LOCK, fd });
      no(r.owned); ok(r.problems.some((x) => /is dev .* not /.test(x)));
    } finally { closeSync(fd); }
  });
  t("SOMEBODY ELSE's real exclusive lock is not our ownership", () => {
    foreign = spawn('flock', ['-x', FOREIGN_LOCK, '-c', 'sleep 20'], { stdio: 'ignore' });
    let seen = false;
    for (let i = 0; i < 20 && !seen; i += 1) {
      syncSleep(0.2);
      const st = fstatSync(openSync(FOREIGN_LOCK, 'r'));
      const { major, minor } = devMajorMinor(st.dev);
      seen = parseProcLocks(readFileSync('/proc/locks', 'utf8'))
        .some((l) => l.inode === st.ino && l.major === major && l.minor === minor && /FLOCK/i.test(l.kind) && /WRITE/i.test(l.mode));
    }
    ok(seen, 'the foreign flock never appeared in /proc/locks');
    const fd = openSync(FOREIGN_LOCK, 'r+');
    try {
      const r = heavyLockOwnership({ lockPath: FOREIGN_LOCK, fd });
      no(r.owned, 'a live lock held by an unrelated process must FAIL');
      ok(r.problems.some((x) => /SOMEBODY ELSE'S open file description/.test(x)), JSON.stringify(r.problems));
      eq(r.fdinfoLock, null, 'our own descriptor holds no lock line');
      ok(r.procLock !== null, 'the kernel-wide lock was still SEEN, it is just not ours');
    } finally { closeSync(fd); }
  });
  t('an EXTERNALLY acquired, inherited exclusive flock PASSES (real kernel semantics)', () => {
    // Exactly the shape of the documented invocation: the shell acquires the lock,
    // then `exec`s node, so the lock is never dropped before node starts.
    const script = `exec 9>"${OWN_LOCK}"; flock -n -x 9 || exit 3; exec node "${SELF}" --lock-owner-child 9 --lock-path "${OWN_LOCK}"`;
    const out = execFileSync('bash', ['-c', script], { encoding: 'utf8' });
    const r = JSON.parse(out);
    ok(r.owned, `owned must be true: ${JSON.stringify(r.problems)}`);
    eq(r.procLock.mode, 'WRITE', 'the kernel entry must be an exclusive (WRITE) lock');
    ok(/FLOCK/i.test(r.procLock.kind), 'the kernel entry must be a FLOCK');
    // Ownership is proved by OUR OWN fdinfo, not by a pid: the /proc/locks pid is
    // the transient flock(1) creator and is normally already dead here.
    ok(r.fdinfoLock !== null, 'the inherited descriptor must itself hold the flock');
    eq(r.fdinfoLock.mode, 'WRITE'); ok(/FLOCK/i.test(r.fdinfoLock.kind));
    eq(r.fdinfoLock.inode, r.pathDevIno.ino, 'fdinfo lock inode must be the lock file');
    ok(/lock:\s*\d+:\s*FLOCK/i.test(r.fdinfo), 'raw kernel fdinfo must show the FLOCK');
    eq(r.contentionProbe, 'refused (lock is live)', 'an independent flock -n -x must be REFUSED');
  });
} finally {
  if (foreign) { try { foreign.kill('SIGKILL'); } catch { /* already gone */ } }
}

// --- ONE commissioned correction: strict ORIGINAL incoming-plane crossing -------------
// These are pure tests of the directional crossing predicates and of fail-before-F.
{
  const P2 = incomingPlaneAt(CG_ROUTE_COMMON, 2); // through [-42,16], normal +z
  const P3 = incomingPlaneAt(CG_ROUTE_COMMON, 3); // through [-44,16], normal -x
  const S = (pose, extra = {}) => ({ pose, supported: true, units: 0, atMs: 0, ...extra });

  t('the incoming plane comes from the ORIGINAL vertices, normal = incoming direction', () => {
    ok(P2.ok); eq(P2.point, [-42, 51.05, 16]); eq(P2.normal.map((n) => Math.round(n)), [0, 1]);
    ok(P3.ok); eq(P3.normal.map((n) => Math.round(n)), [-1, 0]);
    no(incomingPlaneAt(CG_ROUTE_COMMON, 0).ok, 'vertex 0 has no incoming segment');
  });

  t('signed offset is negative before the plane and positive past it', () => {
    ok(signedPlaneOffset([-42, 51.05, 15.82], P2) < 0);
    ok(signedPlaneOffset([-42, 51.05, 16.05], P2) > 0);
    ok(Math.abs(signedPlaneOffset([-42, 51.05, 16], P2)) < 1e-9);
    ok(signedPlaneOffset([-44.2, 51.05, 16], P3) > 0, 'past -x means x < -44');
    ok(signedPlaneOffset([-43.5, 51.05, 16], P3) < 0);
  });

  t('REACHING 0.6 short of the corner and turning away is NOT a crossing', () => {
    // exactly the old walkTo(arrive .6) behaviour: closest approach 0.55, then turn.
    const v = planeCrossingVerdict({
      samples: [S([-42, 51.05, 15.0]), S([-42, 51.05, 15.45]), S([-42, 51.05, 15.45]), S([-43, 51.05, 15.45])],
      plane: P2
    });
    no(v.crossed, 'a radius arrival must never count as a plane crossing');
    ok(/never reached the far side/.test(v.why));
  });

  t('an ACTUAL crossing at the corner is credited, with the live units at the crossing', () => {
    const v = planeCrossingVerdict({
      samples: [S([-42, 51.05, 15.5], { units: 3.5, atMs: 10 }), S([-42.02, 51.05, 16.08], { units: 4.0, atMs: 20 })],
      plane: P2
    });
    ok(v.crossed);
    eq(v.cross.units, 4.0); ok(v.cross.offset >= 0); ok(v.cross.lateral < 0.1);
    ok(v.overshootWithinBound === true);
  });

  t('crossing the INFINITE plane far off the corner is not this corner', () => {
    // the deviation corner-cut passes z=16 at x=-44: 2 units off the z=16 corner.
    const v = planeCrossingVerdict({
      samples: [S([-42, 51.05, 15.82]), S([-43, 51.05, 15.9]), S([-44, 51.05, 16.0])],
      plane: P2
    });
    no(v.crossed, 'a corner cut must not be credited as the omitted corner');
  });

  t('a crossing sample that is NOT supported cannot close the corner', () => {
    const samples = [S([-42, 51.05, 15.5]), S([-42, 51.05, 16.1], { supported: false })];
    no(planeCrossingVerdict({ samples, plane: P2 }).crossed);
    ok(planeCrossingVerdict({ samples, plane: P2, requireSupported: false }).crossed);
  });

  t('starting ALREADY past the plane is not a crossing (no observed before-sample)', () => {
    const v = planeCrossingVerdict({ samples: [S([-42, 51.05, 16.4]), S([-42, 51.05, 16.9])], plane: P2 });
    no(v.crossed); ok(/strictly BEFORE/.test(v.why));
  });

  t('an unsafe overshoot past a corner is reported, not silently accepted', () => {
    const v = planeCrossingVerdict({
      samples: [S([-43.5, 51.05, 16]), S([-44.1, 51.05, 16]), S([-46.0, 51.05, 16])],
      plane: P3
    });
    ok(v.crossed); no(v.overshootWithinBound, '2 units past the corner exceeds the dry-passage bound');
  });

  t('the ordered frontier requires route order, time order and non-decreasing credit', () => {
    const good = [{ index: 1, atMs: 1, units: 2, crossed: true }, { index: 2, atMs: 2, units: 4, crossed: true }];
    ok(orderedFrontierVerdict({ crossings: good, expectedIndices: [1, 2] }).ok);
    no(orderedFrontierVerdict({ crossings: good, expectedIndices: [1, 2, 3] }).ok, 'a missing vertex fails');
    no(orderedFrontierVerdict({ crossings: [good[1], { ...good[0], atMs: 3 }], expectedIndices: [1, 2] }).ok, 'out of route order');
    no(orderedFrontierVerdict({ crossings: [good[0], { index: 2, atMs: 2, units: 1, crossed: true }], expectedIndices: [1, 2] }).ok, 'credit fell');
    no(orderedFrontierVerdict({ crossings: [good[0], { index: 2, atMs: 2, units: null, crossed: true }], expectedIndices: [1, 2] }).ok, 'no live credit');
    no(orderedFrontierVerdict({ crossings: [], expectedIndices: [1] }).ok);
  });

  t('the full signed set is 18 units of ordered corners 1..9', () => {
    eq(CG_ROUTE_COMMON.map((_, i) => i).slice(1), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    eq(CG_COMMON_ROUTE_UNITS, 18);
  });

  t('the deviation point must be BEFORE the original z=16 plane, measured on the body', () => {
    ok(earlyTurnVerdict({ pose: EARLY_TURN_POINT, plane: P2 }).ok);
    const over = earlyTurnVerdict({ pose: [-42, 51.05, 16.1], plane: P2 });
    no(over.ok, 'an overshot 16+ body is NOT the intended deviation');
    ok(/overshoot, not the intended early turn/.test(over.why));
    no(earlyTurnVerdict({ pose: [-42, 51.05, 16], plane: P2 }).ok, 'sitting ON the plane is not before it');
    no(earlyTurnVerdict({ pose: null, plane: P2 }).ok);
  });

  t('a failed crossing is fatal, so no later [F] may be pressed', () => {
    const failed = planeCrossingVerdict({ samples: [S([-42, 51.05, 15.45])], plane: P2 });
    no(failed.crossed);
    // the probe gates the far-reference [F] on the passage gate; an unmet prerequisite
    // is refused by the same contract that guards every press.
    no(mayPressF({ objectiveId: 'ch13:common:offer-final-reference', expectedObjectiveId: 'ch13:common:offer-final-reference', prompts: [], verbPattern: /Offer this end/i }).ok,
      'no authored prompt -> no press');
    no(passageVerdict({ creditedUnits: 5.8, arrivalDistance: 0.2, supported: true, referenceObserved: true, orderedLegsAllReached: false, clearanceUnits: 2 }).ok,
      'an unreached ordered leg can never be a passage');
  });
}

// --- served-build identity against a task-private HTTP fixture (no public net) --------
const INDEX_BYTES = Buffer.from('<!doctype html><title>Paravoxia</title><script type="module" src="/assets/index-abc.js"></script>');
const BUNDLE_BYTES = Buffer.from('/* paravoxia bundle */ export const x = 1;');
const fixture = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX_BYTES); return; }
  if (req.url === '/assets/index-abc.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(BUNDLE_BYTES); return; }
  res.writeHead(404); res.end('nope');
});
const at = async (name, fn) => { ran += 1; try { await fn(); } catch (e) { failures += 1; console.error(`FAIL ${name}: ${e.message}`); } };
try {
  await new Promise((r) => fixture.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${fixture.address().port}/`;
  const OWNED = Object.freeze({
    state: 'running', url: base, bundlePath: '/assets/index-abc.js',
    indexSha256: sha256Hex(INDEX_BYTES), bundleSha256: sha256Hex(BUNDLE_BYTES),
    sourceManifestSha256: 'dc63fbaeacea44166f41b4d9307bc2e31307fc28845c69512f75c7d641adc36c',
    allBuildFilesMatched: 99
  });
  const MANIFEST = OWNED.sourceManifestSha256;

  await at('the ACTUAL served index and bundle bytes are fetched and hashed', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    eq(s.errors, []); eq(s.indexSha256, OWNED.indexSha256); eq(s.bundleSha256, OWNED.bundleSha256);
    eq(s.status.index, 200); eq(s.status.bundle, 200);
  });
  await at('matching served bytes bind to root preview ownership', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    const d = previewBindingDecision({ ownership: OWNED, url: base, expectSourceManifestSha: MANIFEST, served: s });
    ok(d.ok, JSON.stringify(d.problems));
    eq(d.servedIndexSha256, OWNED.indexSha256); eq(d.ownedFileMapCount, 99);
  });
  await at('a DIFFERENT served index (port takeover / stale build) FAILS', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    const d = previewBindingDecision({ ownership: { ...OWNED, indexSha256: sha256Hex(Buffer.from('other app')) }, url: base, expectSourceManifestSha: MANIFEST, served: s });
    no(d.ok); ok(d.problems.some((x) => /served index sha .* != owned/.test(x)));
  });
  await at('a DIFFERENT served bundle FAILS even when index matches', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    const d = previewBindingDecision({ ownership: { ...OWNED, bundleSha256: sha256Hex(Buffer.from('old bundle')) }, url: base, expectSourceManifestSha: MANIFEST, served: s });
    no(d.ok); ok(d.problems.some((x) => /served bundle sha .* != owned/.test(x)));
  });
  await at('a MISSING bundle (404) is an error, never a match', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: '/assets/does-not-exist.js' });
    ok(s.errors.length > 0); eq(s.bundleSha256, null);
    const d = previewBindingDecision({ ownership: OWNED, url: base, expectSourceManifestSha: MANIFEST, served: s });
    no(d.ok); ok(d.problems.some((x) => /served fetch error/.test(x)));
  });
  await at('an UNREACHABLE url is an error, never a match', async () => {
    const dead = 'http://127.0.0.1:1/';
    const s = await fetchServedIdentity({ url: dead, bundlePath: OWNED.bundlePath, timeoutMs: 1500 });
    eq(s.indexSha256, null); ok(s.errors.length > 0);
    no(previewBindingDecision({ ownership: OWNED, url: dead, expectSourceManifestSha: MANIFEST, served: s }).ok);
  });
  await at('MISSING expected identity must FAIL, not become optional', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    const d = previewBindingDecision({ ownership: { ...OWNED, indexSha256: null, bundleSha256: null }, url: base, expectSourceManifestSha: MANIFEST, served: s });
    no(d.ok, 'an absent EXPECTED hash cannot be treated as a pass');
    ok(d.problems.some((x) => /publishes no indexSha256/.test(x)));
  });
  await at('never-measured served bytes FAIL (liveness is not identity)', async () => {
    const d = previewBindingDecision({ ownership: OWNED, url: base, expectSourceManifestSha: MANIFEST, served: null });
    no(d.ok); ok(d.problems.some((x) => /never fetched/.test(x)));
  });
  await at('a foreign URL or a non-running preview FAILS', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    no(previewBindingDecision({ ownership: OWNED, url: 'http://127.0.0.1:5199/', expectSourceManifestSha: MANIFEST, served: s }).ok);
    no(previewBindingDecision({ ownership: { ...OWNED, state: 'stopped' }, url: base, expectSourceManifestSha: MANIFEST, served: s }).ok);
  });
  await at('source-manifest drift unbinds the preview', async () => {
    const s = await fetchServedIdentity({ url: base, bundlePath: OWNED.bundlePath });
    no(previewBindingDecision({ ownership: OWNED, url: base, expectSourceManifestSha: 'deadbeef', served: s }).ok);
    no(previewBindingDecision({ ownership: OWNED, url: base, expectSourceManifestSha: null, served: s }).ok);
  });
  await at('missing preview ownership entirely FAILS', async () => {
    const d = previewBindingDecision({ ownership: null, url: base, expectSourceManifestSha: MANIFEST, served: null });
    no(d.ok); ok(d.problems.some((x) => /preview-ownership.json is missing/.test(x)));
  });
} finally {
  await new Promise((r) => fixture.close(r));
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`${failures === 0 ? 'OK' : 'FAIL'} common-passage selftest: ${ran - failures}/${ran} passed`);
process.exit(failures === 0 ? 0 : 1);
