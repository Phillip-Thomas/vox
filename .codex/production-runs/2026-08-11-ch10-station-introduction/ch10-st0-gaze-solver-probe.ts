/*
 * D-A3 solver probe. Pure, headless, deterministic: it drives the SHIPPED
 * `solveSurfaceGaze` with exactly the input the ST-0 glance hands it, before
 * and after the repair, and reports the pitch the camera is actually asked for.
 *
 * The defect it characterises: a goal 240 m along the ST-0 ray has ~217 m of
 * tangential range, so `direct` is false, pitch collapses to the seeded scan,
 * and travel mode then clamps it to +15° anyway. The dot is never framed.
 *
 * Run: npx vite-node .codex/production-runs/.../ch10-st0-gaze-solver-probe.ts
 * from `main/` (it resolves the runtime module relative to this file).
 */
import * as THREE from 'three';
import { solveSurfaceGaze } from '../../../main/src/utils/surfaceGaze.ts';

const up = new THREE.Vector3(0, 1, 0);
// A player standing on the +Y face, well away from any cube edge.
const eye = new THREE.Vector3(40, 512, -25);
const forward = new THREE.Vector3(0, 0, -1);

/** ST-0's apparent direction at a given elevation, capped at the ruling's +25°. */
function aim(elevationDeg: number): THREE.Vector3 {
  const capRadians = (25 * Math.PI) / 180;
  const direction = new THREE.Vector3(
    Math.cos(THREE.MathUtils.degToRad(elevationDeg)) * Math.cos(0.7),
    Math.sin(THREE.MathUtils.degToRad(elevationDeg)),
    Math.cos(THREE.MathUtils.degToRad(elevationDeg)) * Math.sin(0.7)
  ).normalize();
  const rise = THREE.MathUtils.clamp(direction.dot(up), -1, 1);
  if (Math.asin(rise) <= capRadians) return direction;
  // The repaired cap: rebuild the ray from its own tangent at exactly the cap.
  const tangent = direction.clone().addScaledVector(up, -rise).normalize();
  return tangent
    .multiplyScalar(Math.cos(capRadians))
    .addScaledVector(up, Math.sin(capRadians))
    .normalize();
}

interface Row {
  elevationDeg: number;
  reach: number;
  mode: 'travel' | 'inspect';
  direct: boolean;
  solvedPitchDeg: number;
  aimPitchDeg: number;
  errorDeg: number;
}

const rows: Row[] = [];
for (const elevationDeg of [5, 10, 18, 27]) {
  for (const [reach, mode] of [[240, 'travel'], [10, 'inspect']] as const) {
    const direction = aim(elevationDeg);
    const goal = eye.clone().addScaledVector(direction, reach);
    const result = solveSurfaceGaze({
      eye,
      viewerUp: up,
      currentForward: forward,
      goal,
      routeDirection: goal.clone().sub(eye),
      subjectLift: 0,
      mode,
      elapsed: 3.2,
      seed: 7744
    });
    const solvedPitchDeg = THREE.MathUtils.radToDeg(result.pitch);
    const aimPitchDeg = THREE.MathUtils.radToDeg(Math.asin(direction.dot(up)));
    rows.push({
      elevationDeg,
      reach,
      mode,
      direct: result.direct,
      solvedPitchDeg: Math.round(solvedPitchDeg * 100) / 100,
      aimPitchDeg: Math.round(aimPitchDeg * 100) / 100,
      errorDeg: Math.round(Math.abs(solvedPitchDeg - aimPitchDeg) * 100) / 100
    });
  }
}

const repaired = rows.filter(row => row.reach === 10);
const shipped = rows.filter(row => row.reach === 240);
console.log(JSON.stringify({
  probe: 'ch10-st0-gaze-solver',
  rows,
  verdict: {
    shippedWorstErrorDeg: Math.max(...shipped.map(row => row.errorDeg)),
    repairedWorstErrorDeg: Math.max(...repaired.map(row => row.errorDeg)),
    repairedAllDirect: repaired.every(row => row.direct),
    repairedNeverAboveCap: repaired.every(row => row.solvedPitchDeg <= 25.001)
  }
}, null, 2));
