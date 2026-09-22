/**
 * CPU-only selftest for the continue-controller-closure private helpers.
 * Imports the SAME bytes a runtime would import. No browser, GPU, or game
 * source. Node only: `node liveCalibration.selftest.mjs`.
 */
import {
  SPAN_OFFER_CONTRACT, tiltDeg, stampedCalibration, keysNeedingRecalibration,
  recalibrationDecision, accumulateDirected, dirsFromEntries,
  signedSpanOfferAuthorization, gateInputsFromAuthorization
} from './liveCalibration.mjs';
import { chooseKey3d, groundedActionGate } from './tangentSteering3d.mjs';
import { newActionGate } from './earnedContinueLogic.mjs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

// --- REPLAY OF THE ACTUAL attempt-1 THRASH ---------------------------------
// Real ups recorded in verifier/captures/earned-continue-3d/attempt-1/probe-log.txt
const UP_R1 = [0.8819740995662241, 0.47129787575836607, 1.6540883815253548e-9];
const UP_R2 = [0.4908086254793641, 0.87126740622788, 1.2958197468425566e-9];
const UP_X = [0.9999999999999989, 3.106609220766023e-8, -3.871073461024746e-8];

ok(Math.abs(tiltDeg(UP_R1, UP_R2) - 32.49) < 0.05,
  `attempt-1 round 1->2 tilt should be the measured 32.49 deg, got ${tiltDeg(UP_R1, UP_R2)}`);
ok(tiltDeg(UP_R1, UP_R2) > 12, 'that within-round tilt exceeds the 12 deg staleness threshold (the thrash trigger)');

// Basis stamped at UP_R1; current up is UP_R2 right after the round's own walk.
const entriesR1 = {
  KeyW: stampedCalibration({ key: 'KeyW', from: [0, 0, 0], to: [-0.2655, 0.02563, 1.960], upAtSample: UP_R1 }),
  KeyS: stampedCalibration({ key: 'KeyS', from: [0, 0, 0], to: [0.4204, 0.3650, -1.696], upAtSample: UP_R1 }),
  KeyA: stampedCalibration({ key: 'KeyA', from: [0, 0, 0], to: [0.4212, -0.5977, -0.2212], upAtSample: UP_R1 }),
  KeyD: stampedCalibration({ key: 'KeyD', from: [0, 0, 0], to: [-0.6213, 1.4559, -0.0109], upAtSample: UP_R1 })
};
ok(Object.values(entriesR1).every((e) => e.usable && e.dir3d), 'all four ordinary keys calibrate as usable 3D directions');

// THE FIX: with only the calibration's own ~1.9u of induced motion, no recalibration.
const d1 = recalibrationDecision({ entries: entriesR1, currentUp: UP_R2, unitsSinceLastCalibration: 1.878, calibrationsSoFar: 1 });
ok(d1.recalibrate === false, `calibration-induced tilt must NOT re-trigger calibration (got ${d1.reason})`);
ok(d1.reason === 'basis-fresh', `the 32.49 deg smooth change keeps the retained basis usable (got ${d1.reason})`);
ok(d1.anyUsableNow === true, 'usable keys are retained through the smooth face change rather than dropped');
ok(keysNeedingRecalibration(entriesR1, UP_R2).retained.length === 4, 'all four measured directions still project usably in the new plane');

// A genuinely stale basis (a quarter turn away) with only calibration-induced
// motion is STILL refused while usable keys remain: this is the thrash breaker.
const UP_FAR = [0, 1, 0]; // 61.9 deg from UP_R1: stale, but the stored dirs still project usably
const dNear = recalibrationDecision({ entries: entriesR1, currentUp: UP_FAR, unitsSinceLastCalibration: 1.878, calibrationsSoFar: 1 });
ok(dNear.recalibrate === false, 'a stale basis alone does not authorize recalibration without real progress');
ok(/directed motion/.test(dNear.reason), `refusal cites insufficient directed motion (got ${dNear.reason})`);

// After real progress, that stale basis DOES recalibrate.
const d2 = recalibrationDecision({ entries: entriesR1, currentUp: UP_FAR, unitsSinceLastCalibration: 12.0, calibrationsSoFar: 1 });
ok(d2.recalibrate === true, 'a stale basis after meaningful directed motion does recalibrate');
ok(d2.keys.length > 0 && d2.keys.length <= 4, 'only the keys that actually went stale are re-measured');

// Hard cap: attempt-1 ran 21 recalibrations; the cap forbids that outright.
const d3 = recalibrationDecision({ entries: entriesR1, currentUp: UP_FAR, unitsSinceLastCalibration: 40, calibrationsSoFar: 6, maxCalibrations: 6 });
ok(d3.recalibrate === false && /cap/.test(d3.reason), 'recalibration count is hard-capped (21 rounds is unreachable)');

// A truly degenerate basis (no usable key) still recalibrates regardless of distance.
const dead = { KeyW: { ...entriesR1.KeyW, dir3d: null, usable: false } };
const d4 = recalibrationDecision({ entries: dead, currentUp: UP_R2, unitsSinceLastCalibration: 0, calibrationsSoFar: 1 });
ok(d4.recalibrate === true && d4.anyUsableNow === false, 'no usable key in the current plane always authorizes one recalibration');

// --- A/D MUST BE NON-ZERO ON +X (the original XZ bug, kept closed) ---------
const adOnX = {
  KeyA: stampedCalibration({ key: 'KeyA', from: [0, 0, 0], to: [-0.00007, -2.231, 0], upAtSample: UP_X }),
  KeyD: stampedCalibration({ key: 'KeyD', from: [0, 0, 0], to: [-0.0007, 2.230, 0], upAtSample: UP_X })
};
ok(adOnX.KeyA.usable && adOnX.KeyD.usable, 'A/D are usable non-zero 3D directions on the +X face');
ok(adOnX.KeyA.movedTangentUnits > 2 && adOnX.KeyD.movedTangentUnits > 2, 'their tangent magnitude is the real ~2.23u, not a dropped null');
const pick = chooseKey3d(dirsFromEntries(adOnX), [0, -1, 0], UP_X);
ok(pick.key === 'KeyA', `lateral steering on +X selects a lateral key (got ${pick.key})`);

// --- PROPER +Y FRAME -------------------------------------------------------
const UP_Y = [0, 1, 0];
const yEntries = {
  KeyW: stampedCalibration({ key: 'KeyW', from: [0, 0, 0], to: [0, 0, 2], upAtSample: UP_Y }),
  KeyA: stampedCalibration({ key: 'KeyA', from: [0, 0, 0], to: [2, 0, 0], upAtSample: UP_Y })
};
ok(yEntries.KeyW.faceAtSample === '+Y' && yEntries.KeyA.usable, 'a proper +Y frame calibrates normally');
ok(keysNeedingRecalibration(yEntries, UP_Y).stale.length === 0, 'a fresh +Y basis needs no recalibration');
ok(accumulateDirected(0, [0, 0, 0], [3, 4, 0]) === 5, 'directed distance accumulates from real foot displacement');

// --- DEFECT 2: unrelated F|Drink must be REFUSED ---------------------------
const live = { objectiveId: SPAN_OFFER_CONTRACT.actionId, beat: 'ch13-survey', surveyPhase: 'drawing', footArrived: true };
const drink = signedSpanOfferAuthorization({ ...live, prompts: ['[F] Drink'] });
ok(drink.ok === false && drink.promptOffersF === false, 'an unrelated "[F] Drink" prompt is NOT an offered span action');
ok(typeof drink.promptOffersF === 'boolean', 'the gate input is a boolean, never the promptOffersF object');

// The neighbouring authored verb for a DIFFERENT action must also be refused.
const wrongVerb = signedSpanOfferAuthorization({ ...live, prompts: ['[F] Offer this end'] });
ok(wrongVerb.ok === false, '"Offer this end" (story-ch13-hold-witness) does not satisfy the span-offer gate');

const good = signedSpanOfferAuthorization({ ...live, prompts: ['[F] Offer the walked span'] });
ok(good.ok === true && good.promptOffersF === true, 'the authored span-offer prompt with the bound objective/beat/phase authorizes');
ok(good.matchedPrompt === '[F] Offer the walked span', 'the matched prompt is recorded verbatim');

// Binding: objective, beat, phase, and FOOT arrival each independently refuse.
ok(signedSpanOfferAuthorization({ ...live, objectiveId: 'story-ch13-hold-witness', prompts: ['[F] Offer the walked span'] }).ok === false, 'a later unrelated objective refuses');
ok(signedSpanOfferAuthorization({ ...live, beat: 'ch13-return', prompts: ['[F] Offer the walked span'] }).ok === false, 'a stale/other beat refuses');
ok(signedSpanOfferAuthorization({ ...live, surveyPhase: 'offered', prompts: ['[F] Offer the walked span'] }).ok === false, 'a generic phase change is not the authored phase');
ok(signedSpanOfferAuthorization({ ...live, footArrived: false, prompts: ['[F] Offer the walked span'] }).ok === false, 'no FOOT arrival evidence -> refusal');

// --- MAIN-CALL ADAPTATION at both real gate sites --------------------------
const E = [-42, 51.05, 12];
const badGateNew = newActionGate({ beat: 'ch13-survey', surveyPhase: 'drawing', restoredSamples: 4, arrived: true, prompts: ['[F] Drink'], ...gateInputsFromAuthorization(drink) });
ok(badGateNew.ok === false, 'newActionGate refuses the Drink prompt once fed the signed boolean');
const goodGateNew = newActionGate({ beat: 'ch13-survey', surveyPhase: 'drawing', restoredSamples: 4, arrived: true, prompts: good.matchedPrompt ? [good.matchedPrompt] : [], ...gateInputsFromAuthorization(good) });
ok(goodGateNew.ok === true, 'newActionGate accepts only the signed authored offer');

const foot = [-42, 51.05, 12]; const centre = [-42, 52.85, 12];
const gGood = groundedActionGate({ bodyCentre: centre, bodyPose: foot, up: [0, 1, 0], groundOffsetUnits: 1.8, target: E, arriveUnits: 1.2, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, ...gateInputsFromAuthorization(good) });
ok(gGood.ok === true, 'groundedActionGate accepts on FOOT arrival + live up + signed offer');
ok(gGood.arrival.distFootToTarget < 1e-9, 'arrival is decided on the FOOT in full XYZ, never a centre fallback');
const gBad = groundedActionGate({ bodyCentre: centre, bodyPose: foot, up: [0, 1, 0], groundOffsetUnits: 1.8, target: E, arriveUnits: 1.2, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, ...gateInputsFromAuthorization(drink) });
ok(gBad.ok === false, 'groundedActionGate refuses when the offer is not signed');

// The object itself must never reach a gate.
let threw = false;
try { gateInputsFromAuthorization({ promptOffersF: { ok: false, matched: null } }); } catch { threw = true; }
ok(threw, 'passing an object-shaped result into a gate is a hard error');

console.log(`liveCalibration.selftest: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log('  FAIL:', f);
process.exit(fails.length ? 1 : 0);
