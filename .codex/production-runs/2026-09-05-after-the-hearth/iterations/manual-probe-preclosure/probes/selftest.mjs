#!/usr/bin/env node
/**
 * selftest.mjs — bounded static self-tests for the COMMON-passage harness logic.
 * No browser, no GPU, no game import, no game test files. `node selftest.mjs`.
 */
import {
  bodyUsable, settled, directionsDistinct, chooseKey, keyReceipt, preflightDecision,
  identityVerdict, promptOffersF, mayPressF, legVerdict, makeProgressTracker,
  passageVerdict, recoveryVerdict, clearanceBetween, poseReading, unit2, distXZ,
  CG_ROUTE_COMMON, CG_COMMON_ROUTE_UNITS, EARLY_TURN_POINT, CG_POSES
} from './commonPassageLogic.mjs';

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
const goodArgs = { url: 'http://127.0.0.1:41111/', out: 'verifier/captures/common-manual-focused/run-1', heavyLockHeld: true, expectSourceManifestSha: 'abc', liveSourceManifestSha: 'abc' };
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
t('missing external heavy lock refuses', () => {
  const d = preflightDecision({ ready: { ready: true }, control: { action: 'release' }, ...goodArgs, heavyLockHeld: false });
  no(d.launch); ok(d.refusals.some((r) => /heavy lock/.test(r)));
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
t('liveness is not identity', () => {
  no(identityVerdict({ title: 'Some Other App', renderer: 'ANGLE (NVIDIA GB10)', headed: true }).ok);
  no(identityVerdict({ title: 'Paravoxia', renderer: 'SwiftShader', headed: true }).ok);
  no(identityVerdict({ title: 'Paravoxia', renderer: 'ANGLE (NVIDIA)', headed: false }).ok);
  ok(identityVerdict({ title: 'Paravoxia', renderer: 'ANGLE (NVIDIA GB10)', headed: true }).ok);
});

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

console.log(`${failures === 0 ? 'OK' : 'FAIL'} common-passage selftest: ${ran - failures}/${ran} passed`);
process.exit(failures === 0 ? 0 : 1);
