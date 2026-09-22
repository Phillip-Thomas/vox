#!/usr/bin/env node
/**
 * CPU-ONLY CASES FOR THE 3D TANGENT STEERING HELPER (no browser, no GPU, no
 * preview, no game). Run:
 *
 *   node verifier/probes/earned-continue-3d/tangentSteering3d.selftest.mjs
 *
 * These cases import the SAME module bytes the probe imports. Nothing here
 * re-implements the helper and then asserts the two agree — a mirrored
 * implementation would pass while the real steering stayed broken.
 *
 * The numeric inputs are the ACTUAL recorded values from
 * verifier/captures/arrival-common-earned/earned-1/summary.json where such a
 * value exists (the after-Continue up vector, the after-Continue body position,
 * the survey end target, the ch13-survey earned-phase up vector). Synthetic
 * displacements are used ONLY where the earned-1 run measured nothing, because
 * its A/D calibration produced null — that missing measurement is the defect
 * under repair, so it cannot be quoted as data.
 */
import {
  projectToTangent, tangentBasis, faceLabel, basisStale, calibrationSample,
  chooseKey3d, burstProgress3d, stallVerdict, footingReading, unit3, norm3
} from './tangentSteering3d.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ACTUAL earned-1 values.
const UP_PLUS_X = [0.9999999999998366, 1.805700191262614e-07, -5.424623164024718e-07]; // after Continue
const UP_PLUS_Y = [-1.7721862386513084e-05, 0.9999999998429635, 9.34748281698692e-08]; // at earn
const BODY_AFTER_CONTINUE = [52.78897476196289, 17.5, -20];
const SURVEY_END_E = [-42, 51.05, 12];

console.log('CASE 1 — face identification from the ACTUAL recorded up vectors');
check('after-Continue up is the +X face', faceLabel(UP_PLUS_X) === '+X', faceLabel(UP_PLUS_X));
check('earn-phase up is the +Y face', faceLabel(UP_PLUS_Y) === '+Y', faceLabel(UP_PLUS_Y));

console.log('CASE 2 — on +X, the tangent plane is spanned by world Y and Z');
const bx = tangentBasis(UP_PLUS_X);
check('basis exists on +X', !!bx);
check('basis u is orthogonal to up on +X', near(bx.u[0] * bx.up[0] + bx.u[1] * bx.up[1] + bx.u[2] * bx.up[2], 0, 1e-9));
check('basis v is orthogonal to u on +X', near(bx.u[0] * bx.v[0] + bx.u[1] * bx.v[1] + bx.u[2] * bx.v[2], 0, 1e-9));
check('a pure world-X move has ~zero tangent component on +X',
  norm3(projectToTangent([2.5, 0, 0], UP_PLUS_X).tangent) < 1e-5);
check('a pure world-Y move is FULLY tangent on +X (the XZ version dropped this)',
  near(norm3(projectToTangent([0, 2.5, 0], UP_PLUS_X).tangent), 2.5, 1e-4));

console.log('CASE 3 — REQUIRED: an A/D key that moves only in world Y on +X is a NON-ZERO measurement');
// Synthetic displacement: earned-1 measured none, because its XZ threshold
// rejected exactly this motion. Magnitude 2.23 mirrors the W calibration burst.
const keyA = calibrationSample({ key: 'KeyA', from: BODY_AFTER_CONTINUE, to: [52.78897476196289, 17.5 + 2.23, -20], up: UP_PLUS_X });
const keyD = calibrationSample({ key: 'KeyD', from: BODY_AFTER_CONTINUE, to: [52.78897476196289, 17.5 - 2.23, -20], up: UP_PLUS_X });
check('KeyA is usable on +X (3D tangent magnitude, not XZ)', keyA.usable === true, JSON.stringify(keyA.movedTangentUnits));
check('KeyD is usable on +X', keyD.usable === true);
check('KeyA 3D magnitude is non-zero', keyA.moved3dUnits > 2.2);
check('KeyA XZ magnitude really is ~zero (this is WHY earned-1 recorded null)',
  Math.hypot(keyA.moved3d[0], keyA.moved3d[2]) < 1e-6);
check('KeyA direction points along +Y', near(keyA.dir3d[1], 1, 1e-6));
check('KeyA out-of-plane (normal) component is ~zero on +X', Math.abs(keyA.movedNormalUnits) < 1e-4);

console.log('CASE 4 — REQUIRED: on +X, steering toward E selects the world-Y key, not W/S');
// W/S on +X were MEASURED by earned-1 as moving in world Z: KeyW dir XZ
// [-6.53e-05, 0.99999999] i.e. +Z, KeyS the opposite.
const keyW = calibrationSample({ key: 'KeyW', from: BODY_AFTER_CONTINUE, to: [52.789730072021484, 17.499588012695312, -17.769309997558594], up: UP_PLUS_X });
const keyS = calibrationSample({ key: 'KeyS', from: BODY_AFTER_CONTINUE, to: [52.78897476196289, 17.5, -22.23], up: UP_PLUS_X });
check('KeyW measured direction is essentially +Z', near(unit3(keyW.moved3d)[2], 1, 1e-3));
const dirs = { KeyW: keyW.dir3d, KeyS: keyS.dir3d, KeyA: keyA.dir3d, KeyD: keyD.dir3d };
// E is at y=51.05 while the body sits at y=17.5: the needed tangent motion on
// the +X face is dominantly +Y, which no XZ steering could ever request.
const wantToE = [SURVEY_END_E[0] - BODY_AFTER_CONTINUE[0], SURVEY_END_E[1] - BODY_AFTER_CONTINUE[1], SURVEY_END_E[2] - BODY_AFTER_CONTINUE[2]];
const pick = chooseKey3d(dirs, wantToE, UP_PLUS_X);
check('the wanted tangent direction on +X is dominantly +Y',
  Math.abs(pick.want[1]) > Math.abs(pick.want[2]), JSON.stringify(pick.want));
check('projection selects the +Y key (KeyA) on the +X face', pick.key === 'KeyA', `picked ${pick.key} score ${pick.score}`);
check('all four keys are scored, none silently dropped', pick.scored.filter((s) => s.score !== null).length === 4);
check('the -X-facing world-X component is correctly discarded as out-of-plane',
  Math.abs(pick.want[0]) < 1e-5);

console.log('CASE 5 — on +Y, the SAME helper selects an XZ key (no +X-specific special case)');
const yW = calibrationSample({ key: 'KeyW', from: [-27.99, 50.99, 16.03], to: [-27.99, 50.99, 18.03], up: UP_PLUS_Y });
const yA = calibrationSample({ key: 'KeyA', from: [-27.99, 50.99, 16.03], to: [-29.99, 50.99, 16.03], up: UP_PLUS_Y });
check('KeyW is usable on +Y', yW.usable === true);
check('KeyA is usable on +Y', yA.usable === true);
const pickY = chooseKey3d({ KeyW: yW.dir3d, KeyA: yA.dir3d }, [-14.01, 0.06, -4.03], UP_PLUS_Y);
check('on +Y a westward target selects the westward key', pickY.key === 'KeyA', `picked ${pickY.key}`);
check('on +Y the world-Y component is discarded as out-of-plane', Math.abs(pickY.want[1]) < 1e-4);

console.log('CASE 6 — a face change marks the basis stale and forces recalibration');
const s1 = basisStale(UP_PLUS_Y, UP_PLUS_Y);
check('an unchanged up is not stale', s1.stale === false, JSON.stringify(s1));
const s2 = basisStale(UP_PLUS_Y, UP_PLUS_X);
check('+Y -> +X is stale', s2.stale === true);
check('the face change is named, not inferred from a tilt threshold', s2.faceChanged === true && s2.faceBefore === '+Y' && s2.faceAfter === '+X');
check('the tilt across that change is ~90 deg', near(s2.tiltDeg, 90, 0.01), String(s2.tiltDeg));
const tilted = unit3([Math.sin(0.35), Math.cos(0.35), 0]); // ~20 deg off +Y, same face
const s3 = basisStale(UP_PLUS_Y, tilted);
check('a 20 deg tilt inside the same face is still stale (rounded-edge slide)', s3.stale === true && s3.faceChanged === false, JSON.stringify(s3));

console.log('CASE 7 — burst progress keeps all three coordinates');
const prog = burstProgress3d({ from: BODY_AFTER_CONTINUE, to: [52.78897476196289, 19.73, -20], target: SURVEY_END_E, up: UP_PLUS_X });
// The intended tangent leg to E on the +X face is (dy=+33.55, dz=+32) — so a
// 2.23-unit pure +Y burst projects to ~0.72 of its length along that leg. The
// helper is not adjusted to make a round number appear; the expectation states
// the measured geometry.
check('a +Y burst on +X registers POSITIVE along-leg progress', prog.alongLeg > 1.5 && prog.alongLeg < 2.23, String(prog.alongLeg));
check('3D distance to E decreases', prog.dist3dAfter < prog.dist3dBefore);
check('3D distance is not an XZ distance', !near(prog.dist3dBefore, Math.hypot(SURVEY_END_E[0] - BODY_AFTER_CONTINUE[0], SURVEY_END_E[2] - BODY_AFTER_CONTINUE[2]), 1e-3));
const climb = burstProgress3d({ from: [0, 0, 0], to: [3, 0, 0], target: [0, 10, 0], up: [1, 0, 0] });
check('pure motion along up is credited as NORMAL, not along-leg', near(climb.alongLeg, 0) && near(climb.normal, 3));
const side = burstProgress3d({ from: [0, 0, 0], to: [0, 0, 2], target: [0, 10, 0], up: [1, 0, 0] });
check('a pure in-plane sidestep gives zero along-leg and non-zero lateral', near(side.alongLeg, 0) && near(side.lateral, 2));

console.log('CASE 8 — stall telemetry stops the attempt instead of forcing an action');
const noProgress = Array.from({ length: 6 }, () => ({ alongLeg: 0.0, lateral: 1.4, normal: 0, dist3dBefore: 94.79, dist3dAfter: 94.79 }));
const sv = stallVerdict(noProgress);
check('six lateral-only bursts are a stall', sv.stalled === true);
check('the stall reason names lateral-only motion', /lateral-only/.test(sv.reason), sv.reason);
const moving = Array.from({ length: 6 }, (_, i) => ({ alongLeg: 1.9, lateral: 0.1, normal: 0, dist3dBefore: 90 - i * 2, dist3dAfter: 88 - i * 2 }));
check('progressing bursts are not a stall', stallVerdict(moving).stalled === false);
check('short history is never called a stall', stallVerdict(noProgress.slice(0, 3)).stalled === false);

console.log('CASE 9 — audit footing and physics grounding are reported SEPARATELY');
const f1 = footingReading({ auditSupported: false, up: UP_PLUS_X });
check('audit supported=false off the audit plane is flagged as not meaningful there', f1.auditSupportedIsMeaningfulHere === false);
check('observed face is retained', f1.observedFace === '+X');
check('physics grounded is null and marked UNAVAILABLE, never inferred', f1.physicsGrounded === null && f1.physicsGroundedAvailable === false);
const f2 = footingReading({ auditSupported: true, physicsGrounded: true, up: UP_PLUS_Y });
check('on the audit plane, audit support is meaningful', f2.auditSupportedIsMeaningfulHere === true);
check('a supplied physics grounded flag is reported verbatim as available', f2.physicsGrounded === true && f2.physicsGroundedAvailable === true);

console.log('CASE 10 — degenerate inputs refuse rather than fabricate');
check('a zero up vector yields no basis', tangentBasis([0, 0, 0]) === null);
check('a zero up vector is marked degenerate in projection', projectToTangent([1, 2, 3], [0, 0, 0]).upWasDegenerate === true);
check('no measured displacement means no key is chosen', chooseKey3d({ KeyW: null }, [0, 1, 0], UP_PLUS_X).key === null);
check('a key pointing away from the target is refused by the score threshold',
  chooseKey3d({ KeyD: keyD.dir3d }, [0, 10, 0], UP_PLUS_X).key === null);

console.log(failures === 0
  ? '\n[earned-continue-3d tangentSteering3d self-test] OK — all CPU cases passed'
  : `\n[earned-continue-3d tangentSteering3d self-test] FAIL — ${failures} case(s) failed`);
process.exit(failures === 0 ? 0 : 1);
