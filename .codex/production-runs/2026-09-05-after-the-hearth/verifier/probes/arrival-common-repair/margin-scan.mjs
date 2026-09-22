// EXPLORATION ONLY — constant selection, not proof.
//
// Reuses the frozen handoff-standby bundle byte-for-byte (shipped planner,
// shipped Origin terrain, shipped routes). The handoff/footprint arithmetic is
// TRANSCRIBED here for a parameter scan; the binding proof lives in the vitest
// suites that import the real `terminalExactGoalHandoff` /
// `exactGoalFootprintColumns` / `applyTerminalExactGoal`.
import {
  CG_ROUTE_COMMON, CG_ROUTE_LONG, STORY_PRIMARY_WORLD_ID, STORY_SEED, THREE,
  VOXEL_SCALE, createLiveAgentSurfaceTerrain, planAgentSurfaceRoute, surfaceFaceFromUp
} from '../handoff-standby-repair/bundle/repro.mjs';

const PLANET = 50;
const CLEARANCE = 1.8;
const CAPSULE_RADIUS = 0.5;
const REACH = VOXEL_SCALE / 2 - CAPSULE_RADIUS;
const DEAD_ZONE = 0.2;

const terrain = createLiveAgentSurfaceTerrain(PLANET, STORY_SEED, STORY_PRIMARY_WORLD_ID);

function up(p, sharpness = 22, radius = 50) {
  const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z);
  const cube = Math.max(ax, ay, az), k = sharpness / radius;
  const wx = Math.exp(k * (ax - cube)), wy = Math.exp(k * (ay - cube)), wz = Math.exp(k * (az - cube));
  const s = wx + wy + wz;
  return new THREE.Vector3(
    (wx / s) * Math.sign(p.x || 1), (wy / s) * Math.sign(p.y || 1), (wz / s) * Math.sign(p.z || 1)
  ).normalize();
}
function tangentAxes(u) {
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
    .filter(a => Math.abs(a.dot(u)) < 0.5);
}
function plan(from, goal, u) {
  return planAgentSurfaceRoute(terrain, PLANET, from, goal, {
    face: surfaceFaceFromUp(u), differentFaceFallback: 'unreachable', allowJetpackCrossing: false,
    maxJetpackWaterCells: 3, maxJetpackWaterDepthCells: 2, jetpackDetourExtraCells: 4,
    jetpackDetourRatio: 1.5, maxVisitedCells: 4096
  });
}
function certify(column, u) {
  const probe = planAgentSurfaceRoute(terrain, PLANET, column, column, {
    face: surfaceFaceFromUp(u), differentFaceFallback: 'unreachable', allowJetpackCrossing: false,
    maxVisitedCells: 1
  });
  if (probe.mode === 'unreachable' || probe.requestedGoalWasWet) return null;
  return probe.resolvedGoal;
}
function legDir(route, i) {
  const a = route[i - 1], b = route[i];
  const v = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  return v.length() > 0 ? v.normalize() : null;
}
function turnsAt(route, i) {
  const a = legDir(route, i), b = i + 1 < route.length ? legDir(route, i + 1) : null;
  return a && b ? a.dot(b) < 0.999 : false;
}
function railGoal(route, i, over) {
  const p = route[i], d = legDir(route, i);
  if (!d) return new THREE.Vector3(p.x, p.y, p.z);
  const o = i === route.length - 1 ? over : (turnsAt(route, i) ? over : 0);
  return new THREE.Vector3(p.x + d.x * o, p.y + d.y * o, p.z + d.z * o);
}

/** Worst tangential footprint offset seen while the body walks the leg into `i`. */
function scanVertex(route, i, over, label) {
  const goal = railGoal(route, i, over);
  const prev = route[i - 1], here = route[i];
  const d = legDir(route, i);
  let worstTang = 0, worstAt = null, refusals = new Set();
  // Sample the approach: from 2.5 units before the vertex to the goal itself.
  for (let s = -2.5; s <= over + 1e-9; s += 0.05) {
    const feet = new THREE.Vector3(here.x + d.x * s, here.y + d.y * s, here.z + d.z * s);
    if (s < -Math.hypot(here.x - prev.x, here.z - prev.z)) continue;
    let u = up(feet);
    const centre = feet.clone().addScaledVector(u, CLEARANCE);
    u = up(centre);
    const route2 = plan(centre, goal, u);
    if (route2.mode === 'unreachable') { refusals.add('unreachable'); continue; }
    const terminal = route2.waypoints[route2.waypoints.length - 1];
    const diff = goal.clone().sub(terminal);
    diff.addScaledVector(u, -diff.dot(u));
    let maxComponent = 0;
    const columns = [];
    for (const axis of tangentAxes(u)) {
      const c = diff.dot(axis);
      maxComponent = Math.max(maxComponent, Math.abs(c));
      if (Math.abs(c) > REACH) columns.push(terminal.clone().add(axis.clone().multiplyScalar(Math.sign(c) * VOXEL_SCALE)));
    }
    if (maxComponent > worstTang) { worstTang = maxComponent; worstAt = s; }
    if (maxComponent > VOXEL_SCALE / 2) refusals.add('goal-outside-terminal-cell');
    for (const col of columns) {
      const resolved = certify(col, u);
      if (!resolved) refusals.add(`not-certified@${col.x},${col.z}`);
    }
  }
  return { label, i, over, worstTang: +worstTang.toFixed(4), worstAt, refusals: [...refusals] };
}

const overs = process.argv.slice(2).map(Number);
for (const over of (overs.length ? overs : [0.6, 0.3, 0.25, 0.2])) {
  console.log(`\n=== overshoot ${over} (reach ${REACH}, dead zone ${DEAD_ZONE})`);
  for (let i = 1; i < CG_ROUTE_COMMON.length; i += 1) {
    console.log(JSON.stringify(scanVertex(CG_ROUTE_COMMON, i, over, 'COMMON')));
  }
  for (const i of [1, 2, 6, 13, 18]) {
    console.log(JSON.stringify(scanVertex(CG_ROUTE_LONG, i, over, 'LONG')));
  }
}
