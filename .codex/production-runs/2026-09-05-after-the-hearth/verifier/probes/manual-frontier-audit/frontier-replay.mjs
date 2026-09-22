// READ-ONLY CPU replay. Imports the ACTUAL frozen game function
// routeProgressUnits + CG_ROUTE_COMMON (type-stripped by node, bytes unmodified)
// and replays the ACTUAL captured deviation-1 poses. No clone, no mirror.
// Node >= 22 strips TS types natively; no build, no browser, no GPU.
import { routeProgressUnits } from '../../../../../../main/src/story/commonGroundRoute.ts';
import { CG_ROUTE_COMMON } from '../../../../../../main/src/story/commonGroundState.ts';

const R = CG_ROUTE_COMMON;
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const P = (a) => ({ x: a[0], y: a[1], z: a[2] });

// True polyline arc of a pose (the projection the game would credit if the
// ceiling were infinite). Same projection maths as routeProgressUnits.
function trueArc(body) {
  let travelled = 0, best = 0;
  for (let i = 1; i < R.length; i += 1) {
    const f = R[i - 1], t = R[i];
    const seg = d3(f, t);
    const dx = t.x - f.x, dy = t.y - f.y, dz = t.z - f.z;
    const u = Math.max(0, Math.min(1,
      ((body.x - f.x) * dx + (body.y - f.y) * dy + (body.z - f.z) * dz) / (seg * seg)));
    const c = { x: f.x + dx * u, y: f.y + dy * u, z: f.z + dz * u };
    const arc = travelled + seg * u;
    if (arc > best && d3(body, c) <= 2.5) best = arc;
    travelled += seg;
  }
  return best;
}

// Dense 60 Hz interpolation between captured pulse-end poses at the measured
// calibration speed (unitsPerMs 0.005014681287175485). Straight-line between
// consecutive captured poses is the probe's own commanded single-key motion.
function replay(poses, start) {
  let units = start;
  const FRAME = 1 / 60, SPEED = 0.005014681287175485 * 1000; // units/s
  const log = [];
  for (let i = 1; i < poses.length; i += 1) {
    const a = poses[i - 1], b = poses[i];
    const dist = d3(a, b);
    if (dist <= 0) { log.push([b, units]); continue; }
    const steps = Math.max(1, Math.ceil(dist / (SPEED * FRAME)));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
      units = routeProgressUnits(R, p, units, dist / steps);
    }
    log.push([b, units]);
  }
  return { units, log };
}

// ---- A: the ACTUAL captured deviation-1 poses, vertex-2 crossing -> C -------
const actual = [
  [-41.98711676438763, 50.98935546021358, 15.978460145514124], // before v2 plane
  [-41.98701021524752, 50.98928679338384, 16.164333162946104], // v2 crossed (+0.164 z)
  [-44.02885911508145, 50.98904556872934, 16.16433316293273],  // v3 crossed
  [-44.02740537770492, 50.98997164351348, 18.067622721393803], // v4
  [-46.038019377923106, 50.990677362781994, 18.067622721627515], // v5
  [-48.12637046420422, 50.99289073143024, 18.067622724214402], // v6
  [-48.11517557022695, 50.99453032449954, 15.923545675718966], // v7
  [-48.106119852713476, 50.994009485617845, 13.9393700877852], // v8
  [-48.09786331039085, 50.994860157154605, 11.953863115733554] // v9 = C
].map(P);

// ---- B: same poses, single change: the v2 overshoot is on the INCOMING side
// (z <= 16 at the corner) exactly as the PASSING movie run measured
// (journey-common-1 elapsedMs 45265: z 15.926 while x already -43.889).
const corrected = actual.map((p, i) => (i === 1 ? { ...p, z: 15.978460145514124 } : p));
// and the v3 leg is walked at that z, crossing z=16 only after x passes -44:
corrected[2] = { ...corrected[2], z: 15.978460145514124 };

const startUnits = 4.008321486093145; // captured live credit at the v2 crossing
const A = replay(actual, startUnits);
const B = replay(corrected, startUnits);

const rep = {
  schema: 'paravoxia.audit.manualFrontier.cpuReplay.v1',
  cpuOnly: true, browser: false, gpu: false, mutatesGameSource: false,
  functionsUsed: ['routeProgressUnits (main/src/story/commonGroundRoute.ts)',
    'CG_ROUTE_COMMON (main/src/story/commonGroundState.ts)'],
  limitation: 'Captured poses are pulse-END samples only; intra-pulse frames are ' +
    'linearly interpolated at the measured calibration speed. Real per-frame ' +
    'displacement (and any support/reference gating in the director) is NOT ' +
    'reproduced. This replay tests the credit predicate only.',
  trueArcAtCapturedPoses: actual.map(p => Number(trueArc(p).toFixed(6))),
  A_actualCapturedPoses: { startUnits, finalUnits: A.units,
    perVertex: A.log.map(([p, u]) => Number(u.toFixed(6))) },
  B_sameRunOnlyCornerResidualOnIncomingSide: { startUnits, finalUnits: B.units,
    perVertex: B.log.map(([p, u]) => Number(u.toFixed(6))) },
  liveObservedFinalUnits: 6,
  cornerArcJumpAtVertex3: Number((trueArc(actual[2]) - 6).toFixed(6))
};
console.log(JSON.stringify(rep, null, 1));
