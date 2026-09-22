/**
 * CG-IMPL-012 — candidate standby qualification against the ACTUAL geometry.
 *
 * Clearance is measured from POLYLINE SEGMENTS, never vertices, for:
 *   - the ACTUAL recorded offered route (witness-2 hardware trace, 57 body
 *     samples between `after-F-at-S` and `at-E-after-draw`),
 *   - the authored LONG and SHORT survey routes,
 *   - CG_ROUTE_COMMON (which is ALSO his independent-test leg),
 *   - his positioning legs E->H / H->E, and his inspection pose W.
 * Footing uses the shipped `createFooting` rule over the real generator; the
 * planner is the shipped `planAgentSurfaceRoute` with `nextNavigationStep`'s
 * option set. CPU reconstruction, not a live GPU proof.
 */
import { readFileSync } from 'node:fs';
import {
  planAgentSurfaceRoute, createLiveAgentSurfaceTerrain, VOXEL_SCALE,
  STORY_SEED, STORY_PRIMARY_WORLD_ID, CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG,
  CG_ROUTE_COMMON, BODY_BODY_CLEARANCE_UNITS, surfaceFaceFromUp, THREE
} from './bundle/repro.mjs';

const PLANET_SIZE = 50;
const UP = new THREE.Vector3(0, 1, 0);
const FACE = surfaceFaceFromUp(UP);
const GROUND_CLEARANCE = 1.05;
const CONTACT_TOLERANCE = 0.35;
const RENDERED = 25;
/** commonGroundDirector CG_RAIL_POSE_ARRIVE. */
const POSE_ARRIVE = 0.6;
/** The rule this repair adopts: her stop radius plus BOTH bodies' clearance. */
const REQUIRED = BODY_BODY_CLEARANCE_UNITS + POSE_ARRIVE + BODY_BODY_CLEARANCE_UNITS;

const terrain = createLiveAgentSurfaceTerrain(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
const cell = (c) => Math.round(c / VOXEL_SCALE);
const v = (p) => new THREE.Vector3(p.x, p.y, p.z);
const rendered = (x, y, z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= RENDERED;
const solid = (x, y, z) => rendered(x, y, z) && terrain.isSolidVoxel(x, y, z);
const supportedColumn = (x, y, z) => {
  const cx = cell(x); const cz = cell(z); const cy = cell(y - GROUND_CLEARANCE);
  if (!solid(cx, cy, cz)) return false;
  if (solid(cx, cy + 1, cz)) return false;
  if (terrain.isWaterVoxel(cx, cy, cz) || terrain.isWaterVoxel(cx, cy + 1, cz)) return false;
  if (terrain.isHazardousVoxel?.(cx, cy, cz)) return false;
  return Math.abs(y - (cy * VOXEL_SCALE + VOXEL_SCALE / 2)) <= CONTACT_TOLERANCE;
};
const isSupported = (p) => supportedColumn(p.x, p.y, p.z)
  && supportedColumn(p.x + 0.5, p.y, p.z) && supportedColumn(p.x - 0.5, p.y, p.z)
  && supportedColumn(p.x, p.y, p.z + 0.5) && supportedColumn(p.x, p.y, p.z - 0.5);
const plan = (from, to) => planAgentSurfaceRoute(terrain, PLANET_SIZE, v(from), v(to), {
  face: FACE, differentFaceFallback: 'unreachable', allowJetpackCrossing: false,
  maxJetpackWaterCells: 3, maxJetpackWaterDepthCells: 2, jetpackDetourExtraCells: 4,
  jetpackDetourRatio: 1.5, maxVisitedCells: 4096
});

const segDistance = (p, a, b) => {
  const abx = b.x - a.x; const abz = b.z - a.z;
  const apx = p.x - a.x; const apz = p.z - a.z;
  const len = abx * abx + abz * abz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / len));
  return Math.hypot(apx - t * abx, apz - t * abz);
};
const spanDistance = (p, span) => {
  if (span.length === 0) return Infinity;
  if (span.length === 1) return Math.hypot(p.x - span[0].x, p.z - span[0].z);
  let best = Infinity;
  for (let i = 0; i < span.length - 1; i += 1) best = Math.min(best, segDistance(p, span[i], span[i + 1]));
  return best;
};

const recorded = JSON.parse(readFileSync(new URL('./offered-route-witness2.json', import.meta.url), 'utf8'))
  .map(([x, y, z]) => ({ x, y, z }));

const SPANS = [
  ['recorded-offer', recorded],
  ['long', CG_ROUTE_LONG],
  ['short', CG_ROUTE_SHORT],
  ['common', CG_ROUTE_COMMON],
  ['E->H', [CG_POSES.E, CG_POSES.H]],
  ['W pose', [CG_POSES.W]],
  ['R base', [CG_POSES.R]],
  ['T pose', [CG_POSES.T]]
];

const STARTS = [
  ['stall E', { x: -41.965326, y: 50.988996, z: 12.155896 }],
  ['at W', CG_POSES.W],
  ['at S', CG_POSES.S],
  ['at C', CG_POSES.C]
];

const CANDIDATES = [
  ['shipped (-42,9)', { x: -42, y: 51.05, z: 9 }],
  ['audit (-42,20)', { x: -42, y: 51.05, z: 20 }],
  ['audit (-42,22)', { x: -42, y: 51.05, z: 22 }],
  ['authored W', CG_POSES.W],
  ['authored T', CG_POSES.T],
  ['(-40,8)', { x: -40, y: 51.05, z: 8 }],
  ['(-38,8)', { x: -38, y: 51.05, z: 8 }],
  ['(-36,6)', { x: -36, y: 51.05, z: 6 }],
  ['(-38,16)', { x: -38, y: 51.05, z: 16 }],
  ['(-36,16)', { x: -36, y: 51.05, z: 16 }],
  ['(-30,8)', { x: -30, y: 51.05, z: 8 }],
  ['(-46,22)', { x: -46, y: 51.05, z: 22 }],
  ['(-48,22)', { x: -48, y: 51.05, z: 22 }],
  ['(-44,24)', { x: -44, y: 51.05, z: 24 }]
];

console.log('required clearance = bodyClearance(%s) + poseArrive(%s) + bodyClearance(%s) = %s',
  BODY_BODY_CLEARANCE_UNITS, POSE_ARRIVE, BODY_BODY_CLEARANCE_UNITS, REQUIRED.toFixed(2));
console.log('recorded offered polyline: %d samples, x[%s..%s] z[%s..%s]',
  recorded.length,
  Math.min(...recorded.map(p => p.x)).toFixed(2), Math.max(...recorded.map(p => p.x)).toFixed(2),
  Math.min(...recorded.map(p => p.z)).toFixed(2), Math.max(...recorded.map(p => p.z)).toFixed(2));

for (const [label, p] of CANDIDATES) {
  const distances = SPANS.map(([name, span]) => [name, spanDistance(p, span)]);
  const worst = Math.min(...distances.map(([, d]) => d));
  const footed = isSupported(p);
  const reach = STARTS.map(([name, s]) => {
    const r = plan(s, p);
    const arrives = r.mode === 'walk' && r.waypoints.length > 1
      && r.resolvedGoal != null
      && Math.hypot(r.resolvedGoal.x - p.x, r.resolvedGoal.z - p.z) < 1e-6;
    return `${name}:${arrives ? 'walk' : `${r.mode}/${r.reason}`}`;
  });
  const verdict = footed && worst >= REQUIRED ? 'QUALIFIES' : 'rejected';
  console.log('\n%s  footing=%s  minSpanClearance=%s  -> %s',
    label.padEnd(16), footed, worst.toFixed(2), verdict);
  console.log('   ' + distances.map(([n, d]) => `${n}=${d.toFixed(2)}`).join('  '));
  console.log('   reach ' + reach.join('  '));
}
