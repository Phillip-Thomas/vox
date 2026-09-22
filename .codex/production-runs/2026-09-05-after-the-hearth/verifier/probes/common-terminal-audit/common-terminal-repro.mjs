/**
 * CG COMMON TERMINAL-WAYPOINT REPRODUCTION (read-only, no game edit, CPU only).
 *
 * Question: why does the COMMON rail stall at railCursor 3, requested goal
 * (-44.6, 51.05, 16), arriveRadius 0.35, with movement ~0.001 over 20.2 s?
 *
 * PROVENANCE
 * - Shipped planner + shipped live terrain come from the EXISTING run bundle
 *   ../handoff-standby-repair/bundle/repro.mjs
 *   sha256 a093c75f2023a03f720af4ac3a37fd6f4d7e459f4c9323e901a477650ed8ab00
 *   (built by the CG-IMPL-012 repro; re-used here byte-for-byte, not rebuilt).
 *   It re-exports getWorldGen / voxelSystem / planAgentSurfaceRoute /
 *   createLiveAgentSurfaceTerrain / CG_POSES / CG_ROUTE_* / VOXEL_SCALE /
 *   STORY_SEED / STORY_PRIMARY_WORLD_ID / surfaceFaceFromUp / THREE.
 * - The bundle does NOT export terminalExactGoalHandoff /
 *   exactGoalFootprintColumns / railGoal. Those are TRANSCRIBED below verbatim
 *   from the frozen sources (hashes printed in the report). A transcription is
 *   INFERENCE about equivalence; the planner/terrain calls it makes are EVIDENCE.
 *
 * LIMITATION (explicit): this is a CPU reconstruction of the world at
 * seed 3215739679, world '-1,-1', planetSize 50, VOXEL_SCALE 2. It reproduces
 * GENERATED terrain only. It cannot see live persisted/player-edited voxels
 * (voxelSystem is empty in this process), so any column certified here could
 * still differ in the live capture. It is NOT a GPU/browser proof.
 */
import {
  planAgentSurfaceRoute, createLiveAgentSurfaceTerrain,
  VOXEL_SCALE, STORY_SEED, STORY_PRIMARY_WORLD_ID,
  CG_ROUTE_LONG, CG_ROUTE_COMMON, surfaceFaceFromUp, THREE
} from '../handoff-standby-repair/bundle/repro.mjs';

const PLANET_SIZE = 50;
const PLAYER_CAPSULE_RADIUS = 0.5;               // main/src/utils/cubeGravityConstants.ts
const CG_RAIL_CORNER_OVERSHOOT = 0.6;            // main/src/story/commonGroundDirector.ts:2130
const CG_RAIL_ROUTE_ARRIVE = 0.35;               // commonGroundDirector.ts:1937
const NAVIGATION_STEER_DEAD_ZONE = 0.2;          // autopilot/primitives.ts:1616

/** MEASURED live pose, journey-common-2 final sample (trace.ndjson). */
const MEASURED = {
  bodyCentre: [-43.88100051879883, 52.788719177246094, 15.937448501586914],
  bodyPose:   [-43.84527201840541, 50.989073802662645, 15.93744833817136],
  up:         [-0.019849166885233416, 0.9998029858796952, 9.07864191988541e-08],
  railTarget: [-44.6, 51.05, 16],
  railCursor: 3,
  terraUnits: 5.845336820616744
};

const v = (p) => Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(p.x, p.y, p.z);
const UP_LIVE = v(MEASURED.up).normalize();
const FACE = surfaceFaceFromUp(UP_LIVE);
const terrain = createLiveAgentSurfaceTerrain(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);

/* --- transcribed from commonGroundDirector.ts (legDirection/routeTurnsAt/railGoal) --- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function legDirection(route, i) {
  if (i <= 0 || i >= route.length) return null;
  const f = route[i - 1], t = route[i], L = dist(f, t);
  if (!(L > 0)) return null;
  return { x: (t.x - f.x) / L, y: (t.y - f.y) / L, z: (t.z - f.z) / L };
}
function routeTurnsAt(route, i) {
  const a = legDirection(route, i), b = legDirection(route, i + 1);
  if (!a || !b) return false;
  return a.x * b.x + a.y * b.y + a.z * b.z < 0.999;
}
function railGoal(route, i, terminalOvershoot) {
  const p = route[i], d = legDirection(route, i);
  if (!d) return p;
  const o = i === route.length - 1 ? terminalOvershoot : (routeTurnsAt(route, i) ? CG_RAIL_CORNER_OVERSHOOT : 0);
  if (!(o > 0)) return p;
  return { x: p.x + d.x * o, y: p.y + d.y * o, z: p.z + d.z * o };
}

/* --- transcribed from autopilot/primitives.ts --- */
function tangentAxes(up) {
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
    .filter(a => Math.abs(a.dot(up)) < 0.5);
}
function exactGoalFootprintColumns(terminal, goal, up) {
  const t = goal.clone().sub(terminal);
  t.addScaledVector(up, -t.dot(up));
  const reach = VOXEL_SCALE / 2 - PLAYER_CAPSULE_RADIUS;
  const overlapped = [];
  for (const axis of tangentAxes(up)) {
    const c = t.dot(axis);
    if (Math.abs(c) <= reach) continue;
    overlapped.push(axis.clone().multiplyScalar(Math.sign(c) * VOXEL_SCALE));
  }
  const cols = overlapped.map(o => terminal.clone().add(o));
  if (overlapped.length === 2) cols.push(terminal.clone().add(overlapped[0]).add(overlapped[1]));
  return cols;
}
/** nextNavigationStep's own certifyColumn, option for option (SHIPPED planner). */
const certifyColumn = (p) => {
  const probe = planAgentSurfaceRoute(terrain, PLANET_SIZE, p.clone(), p.clone(), {
    face: FACE, differentFaceFallback: 'unreachable', allowJetpackCrossing: false, maxVisitedCells: 1
  });
  if (probe.mode === 'unreachable' || probe.requestedGoalWasWet) return null;
  return probe.resolvedGoal;
};
function terminalExactGoalHandoff({ route, cursor, goal, action, up }) {
  const refuse = (r) => ({ handoff: false, refusal: r });
  const terminal = route.waypoints[route.waypoints.length - 1];
  if (!terminal || cursor !== route.waypoints.length - 1) return refuse('not-terminal-waypoint');
  if (action === 'jetpack' || route.waterCrossing !== null) return refuse('water-leg');
  if (route.requestedGoalWasWet
    || (route.reason !== 'dry-surface-path' && route.reason !== 'already-at-resolved-goal')) {
    return refuse('goal-substituted-for-safety');
  }
  const t = goal.clone().sub(terminal);
  t.addScaledVector(up, -t.dot(up));
  for (const axis of tangentAxes(up)) {
    if (Math.abs(t.dot(axis)) > VOXEL_SCALE / 2) return refuse('goal-outside-terminal-cell');
  }
  for (const column of exactGoalFootprintColumns(terminal, goal, up)) {
    const resolved = certifyColumn(column);
    if (!resolved) return refuse('footprint-not-certified');
    const rise = resolved.clone().sub(terminal).dot(up);
    if (Math.abs(rise) > VOXEL_SCALE / 2) return refuse('footprint-height-mismatch');
  }
  return { handoff: true, refusal: null };
}

/** nextNavigationStep -> planReachableCrossFaceRoute, same face, runtime options. */
const planLikeRuntime = (from, to) => planAgentSurfaceRoute(terrain, PLANET_SIZE, v(from), v(to), {
  face: FACE, differentFaceFallback: 'unreachable', allowJetpackCrossing: false,
  maxJetpackWaterCells: 3, maxJetpackWaterDepthCells: 2,
  jetpackDetourExtraCells: 4, jetpackDetourRatio: 1.5, maxVisitedCells: 4096
});

const P3 = (x) => x === null ? null : [+x.x.toFixed(4), +x.y.toFixed(4), +x.z.toFixed(4)];

function evaluate(label, from, goalPoint) {
  const goal = v(goalPoint);
  const route = planLikeRuntime(from, goalPoint);
  const wps = route.waypoints ?? [];
  const terminal = wps[wps.length - 1] ?? null;
  const out = {
    label,
    from: P3(v(from)), goal: P3(goal),
    routeMode: route.mode, routeReason: route.reason,
    requestedGoalWasWet: route.requestedGoalWasWet ?? null,
    waterCrossing: route.waterCrossing ?? null,
    waypointCount: wps.length,
    terminalWaypoint: P3(terminal),
    resolvedGoal: P3(route.resolvedGoal ?? null)
  };
  if (!terminal) return out;
  out.footprintColumns = exactGoalFootprintColumns(terminal, goal, UP_LIVE).map(P3);
  out.footprintCertification = exactGoalFootprintColumns(terminal, goal, UP_LIVE).map(c => {
    const r = certifyColumn(c);
    return {
      column: P3(c), certified: !!r, resolved: P3(r),
      riseFromTerminal: r ? +r.clone().sub(terminal).dot(UP_LIVE).toFixed(4) : null
    };
  });
  const h = terminalExactGoalHandoff({
    route: { ...route, waypoints: wps }, cursor: wps.length - 1, goal, action: 'walk', up: UP_LIVE
  });
  out.handoff = h.handoff; out.refusal = h.refusal;
  // What the body can actually reach with / without the handoff.
  const steerTarget = h.handoff
    ? (() => { const w = terminal.clone(); const o = goal.clone().sub(w);
        o.addScaledVector(UP_LIVE, -o.dot(UP_LIVE)); return w.add(o); })()
    : terminal.clone();
  const tan = (a, b) => { const d = a.clone().sub(b); d.addScaledVector(UP_LIVE, -d.dot(UP_LIVE)); return d.length(); };
  const parkTan = NAVIGATION_STEER_DEAD_ZONE;
  const bestGoalDistance = Math.max(0, tan(goal, steerTarget) - parkTan);
  out.steerTarget = P3(steerTarget);
  out.closestApproachToGoalWhileSteering = +bestGoalDistance.toFixed(4);
  out.arriveRadius = CG_RAIL_ROUTE_ARRIVE;
  out.arrivalSatisfiable = bestGoalDistance <= CG_RAIL_ROUTE_ARRIVE;
  return out;
}

const report = { schema: 'paravoxia.audit.commonTerminalRepro.v1', results: [] };

// 0. The rail goal the director actually publishes at COMMON cursor 3.
const commonGoal3 = railGoal(CG_ROUTE_COMMON, 3, CG_RAIL_CORNER_OVERSHOOT);
report.railGoalReproduced = {
  cursor: 3, vertex: CG_ROUTE_COMMON[3], turnsAtVertex: routeTurnsAt(CG_ROUTE_COMMON, 3),
  goal: commonGoal3, measuredRailTarget: MEASURED.railTarget,
  matchesMeasured: Math.abs(commonGoal3.x - MEASURED.railTarget[0]) < 1e-9
    && Math.abs(commonGoal3.y - MEASURED.railTarget[1]) < 1e-9
    && Math.abs(commonGoal3.z - MEASURED.railTarget[2]) < 1e-9
};
report.measuredGeometry = {
  bodyPoseToGoal: +dist({ x: MEASURED.bodyPose[0], y: MEASURED.bodyPose[1], z: MEASURED.bodyPose[2] },
    { x: MEASURED.railTarget[0], y: MEASURED.railTarget[1], z: MEASURED.railTarget[2] }).toFixed(4),
  bodyPoseToSnappedVertex: +dist({ x: MEASURED.bodyPose[0], y: MEASURED.bodyPose[1], z: MEASURED.bodyPose[2] },
    CG_ROUTE_COMMON[3]).toFixed(4),
  terraUnitsShortOfVertex3: +(6 - MEASURED.terraUnits).toFixed(6),
  deadZone: NAVIGATION_STEER_DEAD_ZONE, arriveRadius: CG_RAIL_ROUTE_ARRIVE
};

// 1. The COMMON stall, from the MEASURED body pose.
report.results.push(evaluate('common-cursor3-from-measured-pose',
  { x: MEASURED.bodyPose[0], y: MEASURED.bodyPose[1], z: MEASURED.bodyPose[2] }, commonGoal3));
// 2. Same goal, approached from the previous vertex (plan-time geometry).
report.results.push(evaluate('common-cursor3-from-vertex2', CG_ROUTE_COMMON[2], commonGoal3));
// 3. Every COMMON turn vertex.
for (let i = 1; i < CG_ROUTE_COMMON.length; i += 1) {
  if (!routeTurnsAt(CG_ROUTE_COMMON, i) && i !== CG_ROUTE_COMMON.length - 1) continue;
  report.results.push(evaluate(`common-vertex-${i}`, CG_ROUTE_COMMON[i - 1],
    railGoal(CG_ROUTE_COMMON, i, CG_RAIL_CORNER_OVERSHOOT)));
}
// 4. Every SURVEY (LONG) turn vertex — the legs that DID pass.
for (let i = 1; i < CG_ROUTE_LONG.length; i += 1) {
  if (!routeTurnsAt(CG_ROUTE_LONG, i) && i !== CG_ROUTE_LONG.length - 1) continue;
  report.results.push(evaluate(`survey-long-vertex-${i}`, CG_ROUTE_LONG[i - 1],
    railGoal(CG_ROUTE_LONG, i, CG_RAIL_ROUTE_ARRIVE)));
}

report.limitation = 'CPU generated-terrain reconstruction; live persisted/player-edited voxels absent (voxelSystem empty in this process). No GPU/browser measurement. Transcribed pure functions are inference about equivalence.';
console.log(JSON.stringify(report, null, 1));
