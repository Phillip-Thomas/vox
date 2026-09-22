/**
 * FOCUSED ground-frame test mandated by producer-earned-continue-3d-prep-review.
 * It imports the SAME module bytes the probe imports; no mirrored re-derivation.
 */
import { groundFrame, groundTargetArrival, groundedActionGate } from './tangentSteering3d.mjs';

let checks = 0; const fails = [];
const ok = (name, cond, detail) => { checks++; if (!cond) fails.push(`${name}${detail ? ` :: ${detail}` : ''}`); };

const E = [-42, 51.05, 12];
const R = 1.2;                       // existing radius, NEVER widened
const CENTRE = [-42, 52.85, 12];     // producer-specified
const FOOT = [-42, 51.05, 12];       // producer-specified
const UP = [0, 1, 0];

// --- 1. the mandated case: this centre/foot/up MUST arrive at E ---------------
const a = groundTargetArrival({ bodyCentre: CENTRE, bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8, target: E, arriveUnits: R });
ok('mandated-arrival', a.arrived === true, `arrived=${a.arrived} distFoot=${a.distFootToTarget}`);
ok('mandated-foot-distance-zero', Math.abs(a.distFootToTarget) < 1e-9, String(a.distFootToTarget));
ok('mandated-offset-is-1.8', Math.abs(a.frame.observedOffsetUnits - 1.8) < 1e-9, String(a.frame.observedOffsetUnits));
ok('mandated-offset-along-up', a.frame.offsetConsistentWithUp === true);
ok('mandated-matches-published-offset', a.frame.matchesPublishedOffset === true);
// the exact defect being corrected: the OLD centre-based number does NOT arrive
ok('centre-would-have-failed', a.distCentreToTarget_diagnosticOnly > R,
  `centre dist ${a.distCentreToTarget_diagnosticOnly} must exceed radius ${R} — this is the prepared probe's impossible gate`);
ok('radius-not-widened', a.arriveUnits === 1.2);

// --- 2. the earned-1 +X-face body, where the offset lies along world X --------
const xf = groundFrame({ bodyCentre: [52.78897476196289, 17.5, -20], bodyPose: [50.98897476196318, 17.499999674973967, -19.99999902356783], up: [0.9999999999998366, 1.8057e-07, -5.4246e-07], groundOffsetUnits: 1.8 });
ok('plusX-offset-1.8', Math.abs(xf.observedOffsetUnits - 1.8) < 1e-5, String(xf.observedOffsetUnits));
ok('plusX-offset-along-up', xf.offsetConsistentWithUp === true, `offAxis=${xf.offsetOffAxisUnits}`);
ok('plusX-face', xf.face === '+X', String(xf.face));

// --- 3. WRONG FOOT must not authorize F --------------------------------------
const wrongFoot = groundedActionGate({ bodyCentre: [-42, 62.85, 12], bodyPose: [-42, 61.05, 12], up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, promptOffersF: true });
ok('wrong-foot-refused', wrongFoot.ok === false);
ok('wrong-foot-reason', wrongFoot.problems.some((p) => p.includes('outside the existing')), JSON.stringify(wrongFoot.problems));

// --- 4. UNSUPPORTED must not authorize F -------------------------------------
const unsup = groundedActionGate({ bodyCentre: CENTRE, bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: false, promptOffersF: true });
ok('unsupported-refused', unsup.ok === false);
ok('unsupported-reason', unsup.problems.some((p) => p.includes('audit-plane support is not true')), JSON.stringify(unsup.problems));

// --- 5. STALE BEAT must not authorize F --------------------------------------
const stale = groundedActionGate({ bodyCentre: CENTRE, bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-return', expectBeat: 'ch13-survey', auditSupported: true, promptOffersF: true });
ok('stale-beat-refused', stale.ok === false);
ok('stale-beat-reason', stale.problems.some((p) => p.includes('stale beat never authorizes')), JSON.stringify(stale.problems));

// --- 6. no prompt must not authorize F ---------------------------------------
const noPrompt = groundedActionGate({ bodyCentre: CENTRE, bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, promptOffersF: false });
ok('no-prompt-refused', noPrompt.ok === false);

// --- 7. missing foot pose refuses rather than falling back to centre ----------
const noFoot = groundedActionGate({ bodyCentre: FOOT, bodyPose: null, up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, promptOffersF: true });
ok('no-foot-refused', noFoot.ok === false);
ok('no-foot-reason', noFoot.problems.some((p) => p.includes('cannot be judged from bodyCentre')), JSON.stringify(noFoot.problems));

// --- 8. off-audit-plane is a DECLARED GAP, not a physics verdict --------------
const offPlane = groundedActionGate({ bodyCentre: [52.85, 17.5, -20], bodyPose: [51.05, 17.5, -20], up: [1, 0, 0], groundOffsetUnits: 1.8,
  target: [51.05, 17.5, -20], arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: false, promptOffersF: true });
ok('off-plane-refused', offPlane.ok === false);
ok('off-plane-is-gap-not-verdict', offPlane.problems.some((p) => p.includes('UNVERIFIABLE')), JSON.stringify(offPlane.problems));
ok('off-plane-audit-not-meaningful', offPlane.footing.auditSupportedIsMeaningfulHere === false);
ok('off-plane-physics-unavailable', offPlane.footing.physicsGroundedAvailable === false);

// --- 9. the FULL pass, all conditions held ------------------------------------
const pass = groundedActionGate({ bodyCentre: CENTRE, bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8,
  target: E, arriveUnits: R, beat: 'ch13-survey', expectBeat: 'ch13-survey', auditSupported: true, promptOffersF: true });
ok('full-pass', pass.ok === true, JSON.stringify(pass.problems));

// --- 10. mismatched frames (offset not along up) refuse -----------------------
const badFrame = groundTargetArrival({ bodyCentre: [-40.2, 51.05, 12], bodyPose: FOOT, up: UP, groundOffsetUnits: 1.8, target: E, arriveUnits: R });
ok('bad-frame-flagged', badFrame.frame.offsetConsistentWithUp === false, `offAxis=${badFrame.frame.offsetOffAxisUnits}`);

console.log(`groundFrame.selftest: ${checks} checks, ${fails.length} failed`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
