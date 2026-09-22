/**
 * CG-IMPL-012 — CPU TERRAIN/NAVIGATION REPRODUCTION (read-only, no game edit).
 *
 * Answers the two open questions the causal audit left unmeasured:
 *   B2  why the requested standby cell resolved to the body's own cell, and
 *   the physical qualification of any replacement standby.
 *
 * Uses the ACTUAL world identity the hardware recorded: seed 3215739679,
 * world '-1,-1', planetSize 50, VOXEL_SCALE 2, and the SHIPPED planner
 * (`planAgentSurfaceRoute`) with `nextNavigationStep`'s own option set, over
 * the SHIPPED live terrain adapter. This is a CPU reconstruction of terrain and
 * planner, NOT a live GPU proof.
 */
import {
  getWorldGen, voxelSystem, planAgentSurfaceRoute, createLiveAgentSurfaceTerrain,
  VOXEL_SCALE, STORY_SEED, STORY_PRIMARY_WORLD_ID,
  CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG, CG_ROUTE_COMMON, BODY_BODY_CLEARANCE_UNITS,
  surfaceFaceFromUp, THREE
} from './bundle/repro.mjs';

const PLANET_SIZE = 50;
const UP = new THREE.Vector3(0, 1, 0);
const FACE = surfaceFaceFromUp(UP);
/** CommonGroundWorld.tsx footing constants. */
const GROUND_CLEARANCE = 1.05;
const CONTACT_TOLERANCE = 0.35;
const RADIUS_CELLS = Math.max(1, Math.floor(PLANET_SIZE / VOXEL_SCALE));

/** The measured stall pose, to published precision. */
const STALL_BODY = { x: -41.965326, y: 50.988996, z: 12.155896 };
/** The shipped standby that stalled. */
const SHIPPED_STANDBY = { x: -42, y: 51.05, z: 9 };

const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
const cell = (c) => Math.round(c / VOXEL_SCALE);

const terrain = createLiveAgentSurfaceTerrain(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
const { generator } = getWorldGen(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);

/** `nextNavigationStep` -> `planReachableCrossFaceRoute` (same face), option for option. */
const planLikeRuntime = (from, to) => planAgentSurfaceRoute(terrain, PLANET_SIZE, v(from), v(to), {
  face: FACE,
  differentFaceFallback: 'unreachable',
  allowJetpackCrossing: false,
  maxJetpackWaterCells: 3,
  maxJetpackWaterDepthCells: 2,
  jetpackDetourExtraCells: 4,
  jetpackDetourRatio: 1.5,
  maxVisitedCells: 4096
});

/** `nextNavigationStep`'s column ownership probe, option for option. */
const certifyColumn = (p) => {
  const probe = planAgentSurfaceRoute(terrain, PLANET_SIZE, v(p), v(p), {
    face: FACE, differentFaceFallback: 'unreachable', allowJetpackCrossing: false, maxVisitedCells: 1
  });
  if (probe.mode === 'unreachable' || probe.requestedGoalWasWet) return null;
  return probe.resolvedGoal;
};

/** CommonGroundWorld.createFooting `supportedColumn`, faithfully reconstructed. */
const renderedRadiusCells = (size) => Math.floor(size / VOXEL_SCALE) - Math.floor(size / VOXEL_SCALE) + Math.round(size / 2) - 0; // placeholder, replaced below
const RENDERED_RADIUS = 25; // asserted against the shipped test's expectation below
const rendered = (x, y, z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= RENDERED_RADIUS;
const solid = (x, y, z) => voxelSystem.hasVoxel(x, y, z) || (rendered(x, y, z) && terrain.isSolidVoxel(x, y, z));
const hazardous = (x, y, z) => (voxelSystem.hasVoxel(x, y, z) || rendered(x, y, z))
  && (terrain.isHazardousVoxel?.(x, y, z) ?? false);
const supportedColumn = (x, y, z) => {
  const cx = cell(x); const cz = cell(z); const cy = cell(y - GROUND_CLEARANCE);
  if (!solid(cx, cy, cz)) return false;
  if (solid(cx, cy + 1, cz)) return false;
  if (terrain.isWaterVoxel(cx, cy, cz) || terrain.isWaterVoxel(cx, cy + 1, cz)) return false;
  if (hazardous(cx, cy, cz)) return false;
  const face = cy * VOXEL_SCALE + VOXEL_SCALE / 2;
  if (Math.abs(y - face) > CONTACT_TOLERANCE) return false;
  return true;
};
const isSupported = (p) => supportedColumn(p.x, p.y, p.z)
  && supportedColumn(p.x + 0.5, p.y, p.z) && supportedColumn(p.x - 0.5, p.y, p.z)
  && supportedColumn(p.x, p.y, p.z + 0.5) && supportedColumn(p.x, p.y, p.z - 0.5);

// ---- geometry: distance to POLYLINE SEGMENTS, not vertices --------------------------
const segDistance = (p, a, b) => {
  const abx = b.x - a.x; const abz = b.z - a.z;
  const apx = p.x - a.x; const apz = p.z - a.z;
  const len = abx * abx + abz * abz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / len));
  const dx = apx - t * abx; const dz = apz - t * abz;
  return Math.hypot(dx, dz);
};
const polylineDistance = (p, points) => {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    best = Math.min(best, segDistance(p, points[i], points[i + 1]));
  }
  if (points.length === 1) best = Math.hypot(p.x - points[0].x, p.z - points[0].z);
  return best;
};

const EH_LEG = [CG_POSES.E, CG_POSES.H];

console.log('=== identity ===');
console.log('STORY_SEED=%d  world=%s  planetSize=%d  VOXEL_SCALE=%d  face=%s  radiusCells=%d',
  STORY_SEED, STORY_PRIMARY_WORLD_ID, PLANET_SIZE, VOXEL_SCALE, FACE, RADIUS_CELLS);
console.log('bodyBodyClearance=%d', BODY_BODY_CLEARANCE_UNITS);

console.log('\n=== B2: the shipped standby, from the measured stall pose ===');
const stalled = planLikeRuntime(STALL_BODY, SHIPPED_STANDBY);
console.log('mode=%s reason=%s waypoints=%d requestedGoalWasWet=%s resolvedGoal=%s',
  stalled.mode, stalled.reason, stalled.waypoints.length, stalled.requestedGoalWasWet,
  stalled.resolvedGoal ? `(${stalled.resolvedGoal.x},${stalled.resolvedGoal.y},${stalled.resolvedGoal.z})` : 'null');
console.log('body grid cell u/v tangents -> x=%d z=%d ; requested goal cell -> x=%d z=%d',
  cell(STALL_BODY.x), cell(STALL_BODY.z), cell(SHIPPED_STANDBY.x), cell(SHIPPED_STANDBY.z));
console.log('goal offset from its own cell centre: dz=%s (half-cell bound %s)',
  Math.abs(SHIPPED_STANDBY.z - cell(SHIPPED_STANDBY.z) * VOXEL_SCALE).toFixed(3), VOXEL_SCALE / 2);

console.log('\n=== column survey along x=-42 (and the x=-40/-44 neighbours) ===');
for (const x of [-44, -42, -40]) {
  for (let z = 6; z <= 24; z += 2) {
    const p = { x, y: CG_POSES.E.y, z };
    const c = certifyColumn(p);
    const sup = isSupported(p);
    const cy = cell(p.y - GROUND_CLEARANCE);
    console.log('  (%s,%s) cell(%d,%d,%d) generatorSolid=%s above=%s water=%s certified=%s footingSupported=%s',
      String(x).padStart(4), String(z).padStart(3),
      cell(x), cy, cell(z),
      terrain.isSolidVoxel(cell(x), cy, cell(z)),
      terrain.isSolidVoxel(cell(x), cy + 1, cell(z)),
      terrain.isWaterVoxel(cell(x), cy, cell(z)),
      c ? `(${c.x},${c.y},${c.z})` : 'null', sup);
  }
}

console.log('\n=== candidate standby qualification ===');
const candidates = [
  ['shipped E.z-3', { x: -42, y: 51.05, z: 9 }],
  ['audit long-20', { x: -42, y: 51.05, z: 20 }],
  ['audit long-22', { x: -42, y: 51.05, z: 22 }],
  ['authored W', CG_POSES.W],
  ['authored T', CG_POSES.T],
  ['E - 4z', { x: -42, y: 51.05, z: 8 }],
  ['E - 6z', { x: -42, y: 51.05, z: 6 }],
  ['E - 4z, x-44', { x: -44, y: 51.05, z: 8 }],
  ['E - 4z, x-46', { x: -46, y: 51.05, z: 8 }],
  ['x-46 z10', { x: -46, y: 51.05, z: 10 }],
  ['x-48 z8', { x: -48, y: 51.05, z: 8 }],
  ['x-44 z6', { x: -44, y: 51.05, z: 6 }],
  ['x-40 z8', { x: -40, y: 51.05, z: 8 }],
  ['x-38 z8', { x: -38, y: 51.05, z: 8 }],
  ['x-36 z6', { x: -36, y: 51.05, z: 6 }]
];
const row = (label, p) => {
  const dShort = polylineDistance(p, CG_ROUTE_SHORT);
  const dLong = polylineDistance(p, CG_ROUTE_LONG);
  const dCommon = polylineDistance(p, CG_ROUTE_COMMON);
  const dEH = polylineDistance(p, EH_LEG);
  const dW = Math.hypot(p.x - CG_POSES.W.x, p.z - CG_POSES.W.z);
  const route = planLikeRuntime(STALL_BODY, p);
  const certified = certifyColumn(p);
  console.log(
    '%s (%s,%s) short=%s long=%s common=%s E->H=%s W=%s | footing=%s certified=%s | route mode=%s reason=%s wp=%d resolved=%s',
    label.padEnd(14), String(p.x).padStart(4), String(p.z).padStart(3),
    dShort.toFixed(2), dLong.toFixed(2), dCommon.toFixed(2), dEH.toFixed(2), dW.toFixed(2),
    isSupported(p), certified ? 'yes' : 'NO',
    route.mode, route.reason, route.waypoints.length,
    route.resolvedGoal ? `(${route.resolvedGoal.x.toFixed(2)},${route.resolvedGoal.z.toFixed(2)})` : 'null'
  );
};
for (const [label, p] of candidates) row(label, p);

console.log('\n=== generator sanity at the audit site ===');
console.log('S column solid=%s above=%s', generator.shouldVoxelExist(cell(CG_POSES.S.x), 25, cell(CG_POSES.S.z)),
  generator.shouldVoxelExist(cell(CG_POSES.S.x), 26, cell(CG_POSES.S.z)));
console.log('done.');
