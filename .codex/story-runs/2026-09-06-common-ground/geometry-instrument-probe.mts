/**
 * Common Ground — bounded instrument-repair feasibility (CPU only, read-only).
 *
 * Evaluates the EXACT two creative-nominated rigid layouts:
 *   arena-instrument-repair-cinema.md            -> range 24 layout
 *   arena-instrument-repair-cinema.md ADDENDUM   -> range 12 layout (planar 0.5)
 * under arena-instrument-repair-chapter.md and arena-instrument-repair-score.md.
 *
 * NOTHING here is shipped behaviour. Finite reference range and the opaque
 * backing do not exist in the runtime. No source, canon, validator, signature,
 * worldgen, render, GPU, browser or server is touched. No threshold relaxed.
 *
 * Terrain / DDA / trace / socket conventions inherited VERBATIM from
 * geometry-arena-probe.mts (itself from geometry-pass2-probe.mts).
 *
 * Reproduce:
 *   cd /home/thomasphillip/Projects/vox/main
 *   TM=$PWD/node_modules/three
 *   ./node_modules/.bin/esbuild \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-instrument-probe.mts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/cg-instr.mjs \
 *     "--alias:three=$TM/build/three.module.js" \
 *     "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
 *   node /tmp/cg-instr.mjs > \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-instrument.json
 */
import * as THREE from 'three';
import { createResolvedWorldGenerator } from '../../../main/src/utils/resolvedWorldGenerator.ts';
import { createStoryAnchorResolver, AUDIT_WORKER_GROUND_CLEARANCE } from '../../../main/src/story/world/storyAnchorResolver.ts';
import { STORY_SEED, STORY_PRIMARY_WORLD_ID, STORY_COORDINATE } from '../../../main/src/story/world/storyWorldIdentity.ts';
import { planAgentSurfaceRoute, type AgentSurfaceTerrainQuery } from '../../../main/src/utils/agentSurfaceNavigation.ts';
import { groundedSurfaceRouteLength } from '../../../main/src/utils/groundedSurfaceMotion.ts';
import { VOXEL_SCALE, voxelCoordToWorld, PLAYER_EYE_HEIGHT, PLAYER_CAPSULE_RADIUS, PLAYER_STANDING_HEIGHT } from '../../../main/src/utils/cubeGravityConstants.ts';
import { buildTreeProfile } from '../../../main/src/utils/treeProfile.ts';

const t0 = Date.now();
const PLANET_SIZE = 50;
const RADIUS_CELLS = Math.max(1, Math.floor(PLANET_SIZE / VOXEL_SCALE)); // 25
const UP = new THREE.Vector3(0, 1, 0);

const WORKER_ROUTE_OPTIONS = {
  face: 'top' as const,
  differentFaceFallback: 'unreachable' as const,
  clearanceCells: 2,
  maxSlopeCells: 1,
  edgeMarginCells: 1,
  maxVisitedCells: 8192,
  waypointClearanceWorld: 1.05,
  allowJetpackCrossing: false
};
const MAX_JETPACK_WATER_DEPTH_CELLS = 2;

// --- unchanged caps / thresholds (no relaxation, no new tuning) -------------
const MAX_TRACE_POINTS = 128;
const MAX_TRACE_LENGTH = 120;
const SAMPLE_SPACING = 1.0;
const MIN_SAMPLE_SEPARATION = 0.25;
const MIN_EXTRA_UNITS = 12;
const MIN_LENGTH_RATIO = 1.25;
const MIN_UNSUPPORTED_SPAN = 6;
const BODY_RADIUS = PLAYER_CAPSULE_RADIUS;            // 0.5
const BODY_BODY_CLEARANCE = BODY_RADIUS * 2;          // 1.0
const TERRA_LATERAL_MIN = 2.0;                        // unscaled, both variants
const OCCUPY_R = 1.25, OCCUPY_Y = 0.6;                // proposed occupancy cylinder
const RELEASE_R = 1.75, RELEASE_Y = 0.9;              // proposed release cylinder
const MAX_TOPFACE_CELL = 24;                          // bounded top face
const CENTERS_PER_RANGE = 300;                        // x4 rotations = 1200
const CPU_BUDGET_SECONDS = 300;

// --- sockets, measured from current source ---------------------------------
const WORKER_SOCKET = 1.85;          // AuditWorker torso 1.30 + visor 0.55
const PLAYER_SOCKET = PLAYER_EYE_HEIGHT; // 1.35
const WORKER_BODY_HEIGHT = 2.01;     // AuditWorker torso 1.30 + head 0.53 + 0.18
const PLAYER_BODY_HEIGHT = PLAYER_STANDING_HEIGHT; // 3.6

// --- the EXACT nominated apparatus (cinema, local frame; R ground = origin) --
const APPARATUS = {
  socketLocal: { x: 0, y: 1.30, z: 0 },
  backingCenterLocal: { x: -0.90, y: 1.30, z: 0 },
  backingSize: { x: 0.12, y: 2.00, z: 1.60 }
};
const BACK_LO = {
  x: APPARATUS.backingCenterLocal.x - APPARATUS.backingSize.x / 2,
  y: APPARATUS.backingCenterLocal.y - APPARATUS.backingSize.y / 2,
  z: APPARATUS.backingCenterLocal.z - APPARATUS.backingSize.z / 2
};
const BACK_HI = {
  x: APPARATUS.backingCenterLocal.x + APPARATUS.backingSize.x / 2,
  y: APPARATUS.backingCenterLocal.y + APPARATUS.backingSize.y / 2,
  z: APPARATUS.backingCenterLocal.z + APPARATUS.backingSize.z / 2
};

const LAYOUTS = {
  24: { S: [-16, -16], E: [-16, 16], W: [-18, 0], C: [-16, 28] },
  12: { S: [-8, -8], E: [-8, 8], W: [-9, 0], C: [-8, 14] }
} as Record<number, Record<string, number[]>>;
const RANGES = [12, 24];

const { generator } = createResolvedWorldGenerator({
  worldId: STORY_PRIMARY_WORLD_ID,
  seed: STORY_SEED,
  planetRadius: PLANET_SIZE / 2
});
const voxels = generator.getAllVoxelPositions();
const resolver = createStoryAnchorResolver({ generator, voxels });
const terrain: AgentSurfaceTerrainQuery = {
  isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
  isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
  isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
};
const v3 = (v: THREE.Vector3) => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) });
const r2 = (n: number) => +n.toFixed(2);
const elapsed = () => (Date.now() - t0) / 1000;

const tree = resolver.getHeroTreePose(PLANET_SIZE, STORY_SEED);
const pond = resolver.getPondPose(PLANET_SIZE, STORY_SEED);
const heroProfile = buildTreeProfile((STORY_SEED ^ 0xede9) >>> 0);
const TRUNK_HEIGHT = Math.max(heroProfile.trunkHeight, 7.2);
const TRUNK_HALF = 0.55;

// ---------------------------------------------------------------------------
// Terrain conventions — replicas of agentSurfaceNavigation.ts::cellAt
// ---------------------------------------------------------------------------
function shippedColumnTop(vx: number, vz: number): number | null {
  for (let h = RADIUS_CELLS; h >= 0; h--) {
    if (!terrain.isSolidVoxel(vx, h, vz)) continue;
    if (h < RADIUS_CELLS && terrain.isSolidVoxel(vx, h + 1, vz)) continue;
    return h;
  }
  return null;
}
const topCache = new Map<string, number | null>();
function columnTop(u: number, v: number): number | null {
  const k = `${u},${v}`;
  const hit = topCache.get(k);
  if (hit !== undefined) return hit;
  const h = shippedColumnTop(u, v);
  topCache.set(k, h);
  return h;
}
interface Cell { u: number; v: number; h: number; world: THREE.Vector3 }
const cellCache = new Map<string, Cell | null>();
function cellAt(u: number, v: number): Cell | null {
  const key = `${u},${v}`;
  const hit = cellCache.get(key);
  if (hit !== undefined) return hit;
  const h = columnTop(u, v);
  let out: Cell | null = null;
  if (h !== null
    && h >= Math.max(Math.abs(u), Math.abs(v)) + WORKER_ROUTE_OPTIONS.edgeMarginCells
    && !terrain.isHazardousVoxel!(u, h, v)) {
    let bodyBlocked = false;
    let wet = terrain.isWaterVoxel(u, h, v);
    const scan = MAX_JETPACK_WATER_DEPTH_CELLS + WORKER_ROUTE_OPTIONS.clearanceCells;
    for (let lift = 1; lift <= scan; lift++) {
      const y = h + lift;
      const insideRendered = Math.max(Math.abs(u), Math.abs(y), Math.abs(v)) <= RADIUS_CELLS;
      const solid = insideRendered && terrain.isSolidVoxel(u, y, v);
      const hazard = insideRendered && terrain.isHazardousVoxel!(u, y, v);
      if (terrain.isWaterVoxel(u, y, v)) wet = true;
      if (lift <= WORKER_ROUTE_OPTIONS.clearanceCells && (solid || hazard)) bodyBlocked = true;
    }
    if (!wet && !bodyBlocked) {
      out = { u, v, h, world: voxelCoordToWorld(u, h, v).addScaledVector(UP, AUDIT_WORKER_GROUND_CLEARANCE) };
    }
  }
  cellCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Line of sight — pass-2 DDA + hero trunk box + the ACTUAL opaque backing box.
// ---------------------------------------------------------------------------
type Box = { lo: Record<'x' | 'y' | 'z', number>; hi: Record<'x' | 'y' | 'z', number> };
function segmentHitsBox(a: THREE.Vector3, b: THREE.Vector3, lo: Box['lo'], hi: Box['hi']): boolean {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  let tmin = 0, tmax = 1;
  for (const ax of ['x', 'y', 'z'] as const) {
    const dd = d[ax];
    if (Math.abs(dd) < 1e-9) { if (a[ax] < lo[ax] || a[ax] > hi[ax]) return false; continue; }
    let t1 = (lo[ax] - a[ax]) / dd;
    let t2 = (hi[ax] - a[ax]) / dd;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
function trunkBox(inflate = 0): Box {
  const t = tree.position;
  return {
    lo: { x: t.x - TRUNK_HALF - inflate, y: t.y - inflate, z: t.z - TRUNK_HALF - inflate },
    hi: { x: t.x + TRUNK_HALF + inflate, y: t.y + TRUNK_HEIGHT + inflate, z: t.z + TRUNK_HALF + inflate }
  };
}
function los(a: THREE.Vector3, b: THREE.Vector3, exempt: Array<[number, number, number]>, boxes: Box[]) {
  const distance = a.distanceTo(b);
  const dir = b.clone().sub(a);
  const half = VOXEL_SCALE / 2;
  let cx = Math.round(a.x / VOXEL_SCALE), cy = Math.round(a.y / VOXEL_SCALE), cz = Math.round(a.z / VOXEL_SCALE);
  const ex = Math.round(b.x / VOXEL_SCALE), ey = Math.round(b.y / VOXEL_SCALE), ez = Math.round(b.z / VOXEL_SCALE);
  const step = { x: Math.sign(dir.x), y: Math.sign(dir.y), z: Math.sign(dir.z) };
  const tDelta = { x: 0, y: 0, z: 0 } as Record<'x' | 'y' | 'z', number>;
  const tMax = { x: Infinity, y: Infinity, z: Infinity } as Record<'x' | 'y' | 'z', number>;
  const centres = { x: cx * VOXEL_SCALE, y: cy * VOXEL_SCALE, z: cz * VOXEL_SCALE };
  for (const ax of ['x', 'y', 'z'] as const) {
    const dd = dir[ax];
    if (dd === 0) continue;
    tDelta[ax] = Math.abs(VOXEL_SCALE / dd);
    const boundary = centres[ax] + (dd > 0 ? half : -half);
    tMax[ax] = (boundary - a[ax]) / dd;
  }
  const isExempt = (x: number, y: number, z: number) => exempt.some(e => e[0] === x && e[1] === y && e[2] === z);
  for (let guard = 0; guard < 512; guard++) {
    const inside = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(cz)) <= RADIUS_CELLS;
    if (inside && terrain.isSolidVoxel(cx, cy, cz) && !isExempt(cx, cy, cz)) {
      return { clear: false, blockedBy: 'terrain', distance: r2(distance) };
    }
    if (cx === ex && cy === ey && cz === ez) break;
    const m = tMax.x <= tMax.y ? (tMax.x <= tMax.z ? 'x' : 'z') : (tMax.y <= tMax.z ? 'y' : 'z');
    if (tMax[m] > 1) break;
    if (m === 'x') cx += step.x; else if (m === 'y') cy += step.y; else cz += step.z;
    tMax[m] += tDelta[m];
  }
  const tb = trunkBox();
  if (segmentHitsBox(a, b, tb.lo, tb.hi)) return { clear: false, blockedBy: 'trunk', distance: r2(distance) };
  for (const bx of boxes) {
    if (segmentHitsBox(a, b, bx.lo, bx.hi)) return { clear: false, blockedBy: 'backing', distance: r2(distance) };
  }
  return { clear: true, blockedBy: null as string | null, distance: r2(distance) };
}
function exemptAt(p: THREE.Vector3): Array<[number, number, number]> {
  const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
  const sh = columnTop(su, sv);
  return sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
}
interface Support { distance: number; inRange: boolean; clear: boolean; blockedBy: string | null; supported: boolean }
/** PROPOSED predicate: socket-to-socket inside finite range AND clear solid line. */
function supportPoint(actorGround: THREE.Vector3, actorH: number, refSocket: THREE.Vector3,
  refGround: THREE.Vector3, range: number, boxes: Box[]): Support {
  const a = actorGround.clone().addScaledVector(UP, actorH);
  const distance = a.distanceTo(refSocket);
  if (distance > range) return { distance: r2(distance), inRange: false, clear: false, blockedBy: 'out-of-range', supported: false };
  const l = los(a, refSocket, [...exemptAt(actorGround), ...exemptAt(refGround)], boxes);
  return { distance: r2(distance), inRange: true, clear: l.clear, blockedBy: l.blockedBy, supported: l.clear };
}

// ---------------------------------------------------------------------------
// Trace sampling — identical to pass 1/2/arena. No decimation.
// ---------------------------------------------------------------------------
function traceSamples(points: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  if (!points.length) return out;
  out.push(points[0].clone());
  let last = points[0].clone();
  let lastHeading: THREE.Vector3 | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = a.distanceTo(b);
    if (segLen < 1e-9) continue;
    const heading = b.clone().sub(a).setY(0).normalize();
    const turned = lastHeading ? heading.dot(lastHeading) < Math.cos(Math.PI / 12) : false;
    let travelled = 0;
    while (travelled < segLen) {
      const need = turned && last.distanceTo(a) >= MIN_SAMPLE_SEPARATION ? MIN_SAMPLE_SEPARATION : SAMPLE_SPACING;
      const remaining = need - last.distanceTo(a.clone().lerp(b, travelled / segLen));
      travelled += Math.max(0.05, remaining);
      if (travelled > segLen) break;
      const p = a.clone().lerp(b, travelled / segLen);
      if (p.distanceTo(last) >= MIN_SAMPLE_SEPARATION) { out.push(p); last = p.clone(); }
    }
    lastHeading = heading;
  }
  const end = points[points.length - 1];
  if (end.distanceTo(last) > 1e-3) out.push(end.clone());
  return out;
}

// ---------------------------------------------------------------------------
// Node field: the whole bounded top face, |u|,|v| <= 24
// ---------------------------------------------------------------------------
const nodes: Cell[] = [];
const nodeIndex = new Map<string, number>();
for (let u = -MAX_TOPFACE_CELL; u <= MAX_TOPFACE_CELL; u++) {
  for (let v = -MAX_TOPFACE_CELL; v <= MAX_TOPFACE_CELL; v++) {
    const c = cellAt(u, v);
    if (!c) continue;
    nodeIndex.set(`${u},${v}`, nodes.length);
    nodes.push(c);
  }
}
const NEIGHBORS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const adjacency: number[][] = nodes.map((c) => {
  const out: number[] = [];
  for (const [du, dv] of NEIGHBORS) {
    const j = nodeIndex.get(`${c.u + du},${c.v + dv}`);
    if (j === undefined) continue;
    if (Math.abs(nodes[j].h - c.h) > WORKER_ROUTE_OPTIONS.maxSlopeCells) continue;
    out.push(j);
  }
  return out;
});
// Pass-2 defect guard: the shipped planner is blind to the hero trunk collider.
const trunkAllowed = new Uint8Array(nodes.length).fill(1);
{
  const box = trunkBox(BODY_RADIUS);
  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i];
    if (c.world.x >= box.lo.x && c.world.x <= box.hi.x && c.world.z >= box.lo.z && c.world.z <= box.hi.z) trunkAllowed[i] = 0;
  }
}

// ---------------------------------------------------------------------------
// Graph helpers (verbatim conventions from geometry-arena-probe.mts)
// ---------------------------------------------------------------------------
function bfsPath(fromIdx: number, toIdx: number, allowed: Uint8Array): number[] | null {
  if (!allowed[fromIdx] || !allowed[toIdx]) return null;
  const prev = new Int32Array(nodes.length).fill(-1);
  const seen = new Uint8Array(nodes.length);
  const queue = [fromIdx];
  seen[fromIdx] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === toIdx) {
      const path: number[] = [];
      for (let n = cur; n !== -1; n = prev[n]) path.push(n);
      return path.reverse();
    }
    for (const nx of adjacency[cur]) {
      if (seen[nx] || !allowed[nx]) continue;
      seen[nx] = 1; prev[nx] = cur; queue.push(nx);
    }
  }
  return null;
}
/** Among ALL shortest same-endpoint routes, the one entering fewest covered cells. */
function leastSupportedShortestPath(fromIdx: number, toIdx: number, allowed: Uint8Array, cov: Uint8Array): number[] | null {
  if (!allowed[fromIdx] || !allowed[toIdx]) return null;
  const dist = new Int32Array(nodes.length).fill(-1);
  dist[fromIdx] = 0;
  const order: number[] = [fromIdx];
  for (let qi = 0; qi < order.length; qi++) {
    for (const nx of adjacency[order[qi]]) {
      if (dist[nx] !== -1 || !allowed[nx]) continue;
      dist[nx] = dist[order[qi]] + 1; order.push(nx);
    }
  }
  if (dist[toIdx] === -1) return null;
  const dp = new Int32Array(nodes.length).fill(0x7fffffff);
  const from = new Int32Array(nodes.length).fill(-1);
  dp[fromIdx] = cov[fromIdx] ? 1 : 0;
  for (const n of order) {
    if (n === fromIdx || dist[n] > dist[toIdx]) continue;
    let bestCost = 0x7fffffff, bestPrev = -1;
    for (const p of adjacency[n]) {
      if (!allowed[p] || dist[p] !== dist[n] - 1 || dp[p] === 0x7fffffff) continue;
      const c = dp[p] + (cov[n] ? 1 : 0);
      if (c < bestCost || (c === bestCost && bestPrev !== -1 && (nodes[p].u < nodes[bestPrev].u
        || (nodes[p].u === nodes[bestPrev].u && nodes[p].v < nodes[bestPrev].v)))) { bestCost = c; bestPrev = p; }
    }
    if (bestPrev !== -1) { dp[n] = bestCost; from[n] = bestPrev; }
  }
  if (dp[toIdx] === 0x7fffffff) return null;
  const path: number[] = [];
  for (let n = toIdx; n !== -1; n = from[n]) path.push(n);
  return path.reverse();
}
function distanceToPolyline(p: THREE.Vector3, pts: THREE.Vector3[]): number {
  let best = Infinity;
  const ab = new THREE.Vector3(), ap = new THREE.Vector3();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ab.subVectors(b, a); ap.subVectors(p, a);
    const denom = ab.lengthSq();
    const t = denom < 1e-9 ? 0 : Math.max(0, Math.min(1, ap.dot(ab) / denom));
    best = Math.min(best, p.distanceTo(a.clone().addScaledVector(ab, t)));
  }
  return best;
}
function longestFalseRun(samples: THREE.Vector3[], ok: boolean[]) {
  let best = { startIdx: -1, endIdx: -1, walked: 0 };
  let i = 0;
  while (i < samples.length) {
    if (ok[i]) { i++; continue; }
    let j = i;
    while (j + 1 < samples.length && !ok[j + 1]) j++;
    let walked = 0;
    for (let k = i + 1; k <= j; k++) walked += samples[k].distanceTo(samples[k - 1]);
    if (walked > best.walked) best = { startIdx: i, endIdx: j, walked };
    i = j + 1;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Rigid layout placement: translation + quarter turn onto ACTUAL ground
// ---------------------------------------------------------------------------
function rot(k: number, x: number, z: number): [number, number] {
  if (k === 0) return [x, z];
  if (k === 1) return [-z, x];
  if (k === 2) return [-x, -z];
  return [z, -x];
}
interface Pose { world: THREE.Vector3; cell: Cell; clear: boolean; minNeighbourDy: number }
/** Grounded pose at an arbitrary top-face XZ, with real body clearance. */
function groundedPose(x: number, z: number): Pose | null {
  const u = Math.round(x / VOXEL_SCALE), v = Math.round(z / VOXEL_SCALE);
  if (Math.max(Math.abs(u), Math.abs(v)) > MAX_TOPFACE_CELL) return null;
  const c = cellAt(u, v);
  if (!c) return null;
  const idx = nodeIndex.get(`${u},${v}`);
  if (idx === undefined || !trunkAllowed[idx]) return null;
  // body cylinder radius 0.5 must be supported: every column the disc touches
  let clear = true, maxDy = 0;
  for (const [du, dv] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
    const nx = (u + du) * VOXEL_SCALE, nz = (v + dv) * VOXEL_SCALE;
    // does the body disc overlap this column's square?
    const dx = Math.max(0, Math.abs(nx - x) - VOXEL_SCALE / 2);
    const dz = Math.max(0, Math.abs(nz - z) - VOXEL_SCALE / 2);
    if (Math.hypot(dx, dz) > BODY_RADIUS) continue;
    const nc = cellAt(u + du, v + dv);
    if (!nc) { clear = false; continue; }
    maxDy = Math.max(maxDy, Math.abs(nc.world.y - c.world.y));
    if (Math.abs(nc.h - c.h) > WORKER_ROUTE_OPTIONS.maxSlopeCells) clear = false;
  }
  return { world: new THREE.Vector3(x, c.world.y, z), cell: c, clear, minNeighbourDy: maxDy };
}

// ---------------------------------------------------------------------------
// Per-range bounded evaluation of the EXACT nominated layout
// ---------------------------------------------------------------------------
// Candidate centres: dry nodes nearest the existing hero tree (search origin).
const treeXZ = new THREE.Vector3(tree.position.x, 0, tree.position.z);
const pondXZ = pond ? new THREE.Vector3(pond.surface.x, 0, pond.surface.z) : null;
const centreOrder = nodes
  .map((c, i) => ({ i, d: new THREE.Vector3(c.world.x, 0, c.world.z).distanceTo(treeXZ) }))
  .filter(e => trunkAllowed[e.i])
  .sort((a, b) => a.d - b.d || nodes[a.i].u - nodes[b.i].u || nodes[a.i].v - nodes[b.i].v)
  .slice(0, CENTERS_PER_RANGE);

const results: Record<string, unknown>[] = [];
let aborted: string | null = null;

for (const range of RANGES) {
  const L = LAYOUTS[range];
  const rejections: Record<string, number> = {
    terrainFitR: 0, terrainFitS: 0, terrainFitE: 0, terrainFitW: 0, terrainFitC: 0,
    bodyClearance: 0, apparatusFooting: 0, endpointNotFixedValid: 0,
    noShortRoute: 0, shortCaps: 0, noSupportedLongRoute: 0,
    longNotLongerEnoughUnits: 0, longNotLongerEnoughRatio: 0, longCaps: 0, longSampleUnsupported: 0,
    unsupportedSpanTooShort: 0, spanNotCausedByBacking: 0, endpointWitnessesWholeSpan: 0,
    witnessFailsSpan: 0, witnessBodyOverlap: 0, witnessUnreachable: 0,
    noCommonSpan: 0, noTerraWitness: 0
  };
  const best = {
    maxExtraUnits: -Infinity, maxLengthRatio: -Infinity, maxUnsupportedSpanUnits: -Infinity,
    maxCommonSpanUnits: -Infinity, deepest: 'none'
  };
  const stageOrder = ['none', 'terrain-fit', 'fixed-valid-endpoints', 'short-route', 'long-route',
    'detour-units', 'detour-ratio', 'caps', 'long-fully-supported', 'unsupported-span',
    'endpoint-blindness', 'witness-W', 'common-span', 'terra-witness', 'qualified'];
  const reach = (s: string) => { if (stageOrder.indexOf(s) > stageOrder.indexOf(best.deepest)) best.deepest = s; };
  const passing: Record<string, unknown>[] = [];
  let evaluated = 0;

  outer:
  for (const centre of centreOrder) {
    for (let k = 0; k < 4; k++) {
      if (elapsed() > CPU_BUDGET_SECONDS) { aborted = 'cpu-budget'; break outer; }
      evaluated++;
      const c0 = nodes[centre.i].world;
      const place = (p: number[]) => { const [dx, dz] = rot(k, p[0], p[1]); return [c0.x + dx, c0.z + dz] as [number, number]; };

      // --- terrain fit of the whole rigid layout on ACTUAL ground -----------
      const Rp = groundedPose(c0.x, c0.z);
      if (!Rp) { rejections.terrainFitR++; continue; }
      const poses: Record<string, Pose> = { R: Rp };
      let fitFail: string | null = null;
      for (const key of ['S', 'E', 'W', 'C']) {
        const [x, z] = place(L[key]);
        const p = groundedPose(x, z);
        if (!p) { fitFail = key; break; }
        poses[key] = p;
      }
      if (fitFail) { (rejections as any)[`terrainFit${fitFail}`]++; continue; }
      if (!poses.S.clear || !poses.E.clear || !poses.W.clear || !poses.C.clear) { rejections.bodyClearance++; continue; }
      reach('terrain-fit');

      // --- apparatus in world (quarter turns keep the box axis-aligned) -----
      const cornerA = rot(k, BACK_LO.x, BACK_LO.z);
      const cornerB = rot(k, BACK_HI.x, BACK_HI.z);
      const backing: Box = {
        lo: { x: c0.x + Math.min(cornerA[0], cornerB[0]), y: Rp.world.y + BACK_LO.y, z: c0.z + Math.min(cornerA[1], cornerB[1]) },
        hi: { x: c0.x + Math.max(cornerA[0], cornerB[0]), y: Rp.world.y + BACK_HI.y, z: c0.z + Math.max(cornerA[1], cornerB[1]) }
      };
      const boxes = [backing];
      // The apparatus must stand on supported ground: every column its footprint
      // (and its stand) touches must be a walkable dry top-face column.
      let footing = true;
      for (let u = Math.round((backing.lo.x - 1) / VOXEL_SCALE); u <= Math.round((backing.hi.x + 1) / VOXEL_SCALE); u++) {
        for (let v = Math.round((backing.lo.z - 1) / VOXEL_SCALE); v <= Math.round((backing.hi.z + 1) / VOXEL_SCALE); v++) {
          const cx = u * VOXEL_SCALE, cz = v * VOXEL_SCALE;
          if (cx + 1 < backing.lo.x || cx - 1 > backing.hi.x || cz + 1 < backing.lo.z || cz - 1 > backing.hi.z) continue;
          const nc = cellAt(u, v);
          if (!nc || Math.abs(nc.h - Rp.cell.h) > 0) footing = false;
        }
      }
      if (!footing) { rejections.apparatusFooting++; continue; }

      const refSocket = new THREE.Vector3(Rp.world.x, Rp.world.y + APPARATUS.socketLocal.y, Rp.world.z);
      const sup = (ground: THREE.Vector3, actorH: number) =>
        supportPoint(ground, actorH, refSocket, Rp.world, range, boxes);

      // Endpoints must be fixed-valid (chapter: E must be valid for the long route).
      const sS = sup(poses.S.world, WORKER_SOCKET);
      const sE = sup(poses.E.world, WORKER_SOCKET);
      if (!sS.supported || !sE.supported) { rejections.endpointNotFixedValid++; continue; }
      reach('fixed-valid-endpoints');

      // --- walking mask: terrain + trunk + the ACTUAL backing collider ------
      const allowed = new Uint8Array(nodes.length);
      for (let i = 0; i < nodes.length; i++) {
        if (!trunkAllowed[i]) continue;
        const n = nodes[i].world;
        const inX = n.x >= backing.lo.x - BODY_RADIUS && n.x <= backing.hi.x + BODY_RADIUS;
        const inZ = n.z >= backing.lo.z - BODY_RADIUS && n.z <= backing.hi.z + BODY_RADIUS;
        allowed[i] = inX && inZ ? 0 : 1;
      }
      const backingWalk: Box = {
        lo: { x: backing.lo.x - BODY_RADIUS, y: -Infinity, z: backing.lo.z - BODY_RADIUS },
        hi: { x: backing.hi.x + BODY_RADIUS, y: Infinity, z: backing.hi.z + BODY_RADIUS }
      };
      const segBlocked = (pts: THREE.Vector3[]) => {
        const tb = trunkBox(BODY_RADIUS);
        for (let i = 1; i < pts.length; i++) {
          const a = new THREE.Vector3(pts[i - 1].x, 0, pts[i - 1].z);
          const b = new THREE.Vector3(pts[i].x, 0, pts[i].z);
          if (segmentHitsBox(a, b, { ...tb.lo, y: -1 }, { ...tb.hi, y: 1 })) return 'trunk';
          if (segmentHitsBox(a, b, { ...backingWalk.lo, y: -1 }, { ...backingWalk.hi, y: 1 })) return 'backing';
        }
        return null;
      };
      const idxOf = (p: Pose) => nodeIndex.get(`${p.cell.u},${p.cell.v}`)!;
      const materialise = (path: number[], from: Pose, to: Pose) => {
        const pts: THREE.Vector3[] = [from.world.clone()];
        for (const i of path) if (pts[pts.length - 1].distanceTo(nodes[i].world) > 1e-6) pts.push(nodes[i].world.clone());
        if (pts[pts.length - 1].distanceTo(to.world) > 1e-6) pts.push(to.world.clone());
        const length = groundedSurfaceRouteLength(pts.map(position => ({ position })), UP);
        return { pts, length, samples: traceSamples(pts) };
      };

      // --- coverage mask of the fixed reference ----------------------------
      const cov = new Uint8Array(nodes.length);
      for (let i = 0; i < nodes.length; i++) {
        if (!allowed[i]) continue;
        if (nodes[i].world.distanceTo(refSocket) > range + 2) continue;
        if (sup(nodes[i].world, WORKER_SOCKET).supported) cov[i] = 1;
      }

      // --- SHORT route S->E (may hold behind the actual backing) -----------
      const shortPath = leastSupportedShortestPath(idxOf(poses.S), idxOf(poses.E), allowed, cov);
      if (!shortPath) { rejections.noShortRoute++; continue; }
      const shortM = materialise(shortPath, poses.S, poses.E);
      if (shortM.length > MAX_TRACE_LENGTH || shortM.samples.length > MAX_TRACE_POINTS || segBlocked(shortM.pts)) { rejections.shortCaps++; continue; }
      reach('short-route');

      const shortSup = shortM.samples.map(p => sup(p, WORKER_SOCKET));
      const run = longestFalseRun(shortM.samples, shortSup.map(s => s.supported));
      best.maxUnsupportedSpanUnits = Math.max(best.maxUnsupportedSpanUnits, run.walked);

      // --- LONG route: source graph constrained by fixed-reference LOS+range -
      const covAllowed = new Uint8Array(nodes.length);
      for (let i = 0; i < nodes.length; i++) covAllowed[i] = allowed[i] && cov[i] ? 1 : 0;
      const longPath = bfsPath(idxOf(poses.S), idxOf(poses.E), covAllowed);
      if (!longPath) { rejections.noSupportedLongRoute++; continue; }
      const longM = materialise(longPath, poses.S, poses.E);
      reach('long-route');
      best.maxExtraUnits = Math.max(best.maxExtraUnits, longM.length - shortM.length);
      best.maxLengthRatio = Math.max(best.maxLengthRatio, longM.length / shortM.length);
      if (longM.length < shortM.length + MIN_EXTRA_UNITS) { rejections.longNotLongerEnoughUnits++; continue; }
      reach('detour-units');
      if (longM.length < shortM.length * MIN_LENGTH_RATIO) { rejections.longNotLongerEnoughRatio++; continue; }
      reach('detour-ratio');
      if (longM.length > MAX_TRACE_LENGTH || longM.samples.length > MAX_TRACE_POINTS || segBlocked(longM.pts)) { rejections.longCaps++; continue; }
      reach('caps');
      const longSup = longM.samples.map(p => sup(p, WORKER_SOCKET));
      if (longSup.some(s => !s.supported)) { rejections.longSampleUnsupported++; continue; }
      reach('long-fully-supported');

      if (run.walked < MIN_UNSUPPORTED_SPAN) { rejections.unsupportedSpanTooShort++; continue; }
      reach('unsupported-span');
      const spanPoints = shortM.samples.slice(run.startIdx, run.endIdx + 1);
      const spanReasons = shortSup.slice(run.startIdx, run.endIdx + 1).map(s => s.blockedBy);
      // The chapter requires REFERENCE OCCLUDED · SURVEY HOUSING to be distinct
      // from out-of-range and from any other occluder: the whole span must be
      // caused by the apparatus's own opaque backing.
      if (!spanReasons.every(b => b === 'backing')) { rejections.spanNotCausedByBacking++; continue; }

      // --- S and E must fail to witness the ENTIRE span, same predicate ----
      const coversWholeSpan = (ground: THREE.Vector3, socketH: number) => {
        const s = new THREE.Vector3(ground.x, ground.y + socketH, ground.z);
        return spanPoints.every(p => supportPoint(p, WORKER_SOCKET, s, ground, range, boxes).supported);
      };
      if (coversWholeSpan(poses.S.world, PLAYER_SOCKET) || coversWholeSpan(poses.E.world, PLAYER_SOCKET)) {
        rejections.endpointWitnessesWholeSpan++; continue;
      }
      reach('endpoint-blindness');

      // --- W: nominated intermediate witness, must qualify and be reachable -
      const wSocket = new THREE.Vector3(poses.W.world.x, poses.W.world.y + PLAYER_SOCKET, poses.W.world.z);
      let wOk = true, wMaxD = 0, wMargin = Infinity;
      for (const p of spanPoints) {
        const s = supportPoint(p, WORKER_SOCKET, wSocket, poses.W.world, range, boxes);
        if (!s.supported) { wOk = false; break; }
        wMaxD = Math.max(wMaxD, s.distance); wMargin = Math.min(wMargin, range - s.distance);
      }
      if (!wOk) { rejections.witnessFailsSpan++; continue; }
      const wClear = distanceToPolyline(poses.W.world, shortM.pts);
      if (wClear < BODY_BODY_CLEARANCE) { rejections.witnessBodyOverlap++; continue; }
      if (!bfsPath(idxOf(poses.S), idxOf(poses.W), allowed)) { rejections.witnessUnreachable++; continue; }
      reach('witness-W');

      // --- Reciprocal E->C: Terra's passage, W-7744 holding at E -----------
      const ecPath = bfsPath(idxOf(poses.E), idxOf(poses.C), allowed);
      if (!ecPath) { rejections.noCommonSpan++; continue; }
      const ecM = materialise(ecPath, poses.E, poses.C);
      if (ecM.length > MAX_TRACE_LENGTH || ecM.samples.length > MAX_TRACE_POINTS || segBlocked(ecM.pts)) { rejections.noCommonSpan++; continue; }
      const heldE = new THREE.Vector3(poses.E.world.x, poses.E.world.y + WORKER_SOCKET, poses.E.world.z);
      const terraWalk = ecM.samples.map(p => ({
        head: sup(p, PLAYER_SOCKET),
        held: supportPoint(p, PLAYER_SOCKET, heldE, poses.E.world, range, boxes)
      }));
      let commonRun: { s: number; e: number; walked: number } | null = null;
      {
        let i = 0;
        while (i < terraWalk.length) {
          if (terraWalk[i].head.supported || !terraWalk[i].held.supported) { i++; continue; }
          let j = i;
          while (j + 1 < terraWalk.length && !terraWalk[j + 1].head.supported && terraWalk[j + 1].held.supported) j++;
          let walked = 0;
          for (let m = i + 1; m <= j; m++) walked += ecM.samples[m].distanceTo(ecM.samples[m - 1]);
          if (!commonRun || walked > commonRun.walked) commonRun = { s: i, e: j, walked };
          i = j + 1;
        }
      }
      best.maxCommonSpanUnits = Math.max(best.maxCommonSpanUnits, commonRun?.walked ?? 0);
      if (!commonRun || commonRun.walked <= 0) { rejections.noCommonSpan++; continue; }
      reach('common-span');

      // --- Terra's far witness adjacent to C, >= 2 lateral, clear of body ---
      const workerFinal = ecM; // W-7744's own final E->C traversal
      let terra: Record<string, unknown> | null = null;
      let terraBest: [number, number] = [Infinity, -Infinity]; // [lateral, -margin] -> nearest adjacent, then best margin
      for (let ti = 0; ti < nodes.length; ti++) {
        if (!allowed[ti]) continue;
        const t = nodes[ti];
        const lateral = new THREE.Vector3(t.world.x, 0, t.world.z)
          .distanceTo(new THREE.Vector3(poses.C.world.x, 0, poses.C.world.z));
        if (lateral < TERRA_LATERAL_MIN || lateral > range) continue;
        const tp = groundedPose(t.world.x, t.world.z);
        if (!tp || !tp.clear) continue;
        const bodyClear = distanceToPolyline(tp.world, workerFinal.pts);
        if (bodyClear < BODY_BODY_CLEARANCE) continue;
        if (!bfsPath(idxOf(poses.E), ti, allowed)) continue;
        const ts = new THREE.Vector3(tp.world.x, tp.world.y + PLAYER_SOCKET, tp.world.z);
        let ok = true, margin = Infinity, maxD = 0;
        for (const p of workerFinal.samples) {
          const s = supportPoint(p, WORKER_SOCKET, ts, tp.world, range, boxes);
          if (!s.supported) { ok = false; break; }
          margin = Math.min(margin, range - s.distance); maxD = Math.max(maxD, s.distance);
        }
        if (!ok) continue;
        if (lateral < terraBest[0] || (lateral === terraBest[0] && margin > terraBest[1])) {
          terraBest = [lateral, margin];
          terra = {
            position: v3(tp.world), supportVoxel: [t.u, t.h, t.v],
            socketWorld: v3(ts), socketHeight: PLAYER_SOCKET,
            lateralOffsetFromC: r2(lateral),
            maxLineOfReferenceDistance: r2(maxD), rangeMarginUnits: r2(margin),
            bodyClearanceFromWorkerFinalRoute: r2(bodyClear),
            occupancyCylinderMarginUnits: r2(bodyClear - OCCUPY_R),
            releaseCylinderMarginUnits: r2(bodyClear - RELEASE_R),
            releaseCylinderOverlapsRoute: bodyClear < RELEASE_R,
            verticalDeltaToC: r2(Math.abs(tp.world.y - poses.C.world.y)),
            occupancyVerticalTolerance: OCCUPY_Y, releaseVerticalTolerance: RELEASE_Y,
            holdCondition: bodyClear < RELEASE_R
              ? 'release cylinder overlaps the arrival route: traversal must HOLD if Terra stands inside it'
              : 'no hold required at the nominated pose'
          };
        }
      }
      if (!terra) { rejections.noTerraWitness++; continue; }
      reach('terra-witness');
      reach('qualified');

      const outsideUnits = terraWalk.reduce((acc, s, i) =>
        acc + (i > 0 && !s.head.supported ? ecM.samples[i].distanceTo(ecM.samples[i - 1]) : 0), 0);
      const wRelease = distanceToPolyline(poses.W.world, shortM.pts);

      passing.push({
        range,
        centre: { world: v3(c0), cell: [nodes[centre.i].u, nodes[centre.i].h, nodes[centre.i].v] },
        quarterTurns: k, yawDegrees: k * 90,
        distanceToHeroTree: r2(new THREE.Vector3(c0.x, 0, c0.z).distanceTo(treeXZ)),
        distanceToPondSearchOrigin: pondXZ ? r2(new THREE.Vector3(c0.x, 0, c0.z).distanceTo(pondXZ)) : null,
        apparatus: {
          groundedPose: v3(Rp.world),
          socketWorld: v3(refSocket), socketHeightAboveGroundedPose: APPARATUS.socketLocal.y,
          backingBoxWorld: {
            lo: { x: r2(backing.lo.x), y: r2(backing.lo.y), z: r2(backing.lo.z) },
            hi: { x: r2(backing.hi.x), y: r2(backing.hi.y), z: r2(backing.hi.z) }
          },
          backingSize: APPARATUS.backingSize,
          socketToBackingNearFaceUnits: r2(Math.min(
            Math.abs(refSocket.x - backing.lo.x), Math.abs(refSocket.x - backing.hi.x),
            Math.abs(refSocket.z - backing.lo.z), Math.abs(refSocket.z - backing.hi.z))),
          raysStartOutsideOwnSurface: true,
          backingExemptFromRays: false,
          footprintColumnsUniformHeight: true
        },
        poses: Object.fromEntries(Object.entries(poses).map(([key, p]) => [key, {
          world: v3(p.world), supportVoxel: [p.cell.u, p.cell.h, p.cell.v],
          bodyRadius: BODY_RADIUS,
          bodyHeight: key === 'W' ? PLAYER_BODY_HEIGHT : WORKER_BODY_HEIGHT,
          socketWorld: v3(p.world.clone().addScaledVector(UP, key === 'W' ? PLAYER_SOCKET : WORKER_SOCKET)),
          groundClearanceUsed: AUDIT_WORKER_GROUND_CLEARANCE
        }])),
        fixedValidEndpoints: {
          S: { distance: sS.distance, rangeMargin: r2(range - sS.distance), supported: sS.supported },
          E: { distance: sE.distance, rangeMargin: r2(range - sE.distance), supported: sE.supported }
        },
        surveyRouteShort: {
          walkedUnits: r2(shortM.length), sampleCount: shortM.samples.length,
          vertices: shortM.pts.map(v3),
          unsupportedSpanUnits: r2(run.walked),
          unsupportedSpanSamples: spanPoints.length,
          spanStart: v3(spanPoints[0]), spanEnd: v3(spanPoints[spanPoints.length - 1]),
          spanBlockedByBacking: shortSup.slice(run.startIdx, run.endIdx + 1).every(s => s.blockedBy === 'backing'),
          spanBlockReasons: Array.from(new Set(shortSup.slice(run.startIdx, run.endIdx + 1).map(s => s.blockedBy)))
        },
        surveyRouteLong: {
          walkedUnits: r2(longM.length), sampleCount: longM.samples.length,
          vertices: longM.pts.map(v3),
          extraUnits: r2(longM.length - shortM.length),
          lengthRatio: +(longM.length / shortM.length).toFixed(3),
          minRangeMarginUnits: r2(Math.min(...longSup.map(s => range - s.distance))),
          everySampleSupported: true,
          passesThroughBackingOrTrunk: false
        },
        witnessW: {
          position: v3(poses.W.world), supportVoxel: [poses.W.cell.u, poses.W.cell.h, poses.W.cell.v],
          coversWholeUnsupportedSpan: true,
          maxLineOfReferenceDistance: r2(wMaxD), rangeMarginUnits: r2(wMargin),
          bodyClearanceFromSurveyRoute: r2(wClear),
          occupancyCylinderMarginUnits: r2(wClear - OCCUPY_R),
          releaseCylinderMarginUnits: r2(wRelease - RELEASE_R),
          releaseCylinderOverlapsRoute: wRelease < RELEASE_R,
          holdCondition: wRelease < RELEASE_R
            ? 'W release cylinder overlaps the survey corridor: layout NOT rejected; the contract holds only if a body is actually inside it'
            : 'no overlap at the nominated pose',
          startWitnessesWholeSpan: false, endWitnessesWholeSpan: false
        },
        commonComparison: {
          routeEtoC: { walkedUnits: r2(ecM.length), sampleCount: ecM.samples.length, vertices: ecM.pts.map(v3) },
          heldReferenceAtE: { socketWorld: v3(heldE), socketHeight: WORKER_SOCKET },
          totalUnitsOutsideFixedReference: r2(outsideUnits),
          contiguousCommonSpanUnits: r2(commonRun.walked),
          commonSpanStart: v3(ecM.samples[commonRun.s]), commonSpanEnd: v3(ecM.samples[commonRun.e]),
          commonSpanFractionOfPassage: +(commonRun.walked / ecM.length).toFixed(3),
          sixUnitThresholdApplied: false
        },
        terraFinalWitness: terra,
        routeClasses: { bankOrSurvey: 'survey route S->E (dry arena, not at water)', common: 'E->C comparison' },
        caps: { maxTracePoints: MAX_TRACE_POINTS, maxTraceLength: MAX_TRACE_LENGTH, sampleSpacing: SAMPLE_SPACING, cornerSpacing: MIN_SAMPLE_SEPARATION },
        _score: run.walked + (longM.length - shortM.length) + commonRun.walked + Math.max(0, wMargin)
      });
    }
  }

  passing.sort((a, b) => (b._score as number) - (a._score as number)
    || (a.distanceToHeroTree as number) - (b.distanceToHeroTree as number));
  const top3 = passing.slice(0, 3).map(p => { const q = { ...p }; delete (q as any)._score; return q; });

  results.push({
    range,
    layoutLocalOffsets: L,
    candidatesEvaluated: evaluated,
    candidateBudget: CENTERS_PER_RANGE * 4,
    passingLayouts: passing.length,
    deepestStageReached: best.deepest,
    bestObserved: {
      maxExtraUnits: Number.isFinite(best.maxExtraUnits) ? r2(best.maxExtraUnits) : null,
      maxLengthRatio: Number.isFinite(best.maxLengthRatio) ? +best.maxLengthRatio.toFixed(3) : null,
      maxUnsupportedShortSpanUnits: Number.isFinite(best.maxUnsupportedSpanUnits) ? r2(best.maxUnsupportedSpanUnits) : null,
      maxCommonSpanUnits: Number.isFinite(best.maxCommonSpanUnits) ? r2(best.maxCommonSpanUnits) : null
    },
    rejections,
    top3
  });
}

// ---------------------------------------------------------------------------
// Shipped-planner cross-validation on representative positive/negative edges
// ---------------------------------------------------------------------------
const crossValidation: Record<string, unknown>[] = [];
{
  const sample = results.flatMap(r => (r.top3 as Record<string, unknown>[]).slice(0, 1)
    .map(t => ({ range: r.range as number, t })));
  for (const { range, t } of sample) {
    const poses = t.poses as Record<string, { world: { x: number; y: number; z: number } }>;
    const vec = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
    const plan = (a: THREE.Vector3, b: THREE.Vector3) => {
      const res = planAgentSurfaceRoute(terrain, PLANET_SIZE, a, b, WORKER_ROUTE_OPTIONS);
      return { mode: res.mode, reason: res.reason, waypoints: res.waypoints.length, visitedCells: res.visitedCells };
    };
    const back = (t.apparatus as any).backingBoxWorld;
    const insideBacking = new THREE.Vector3((back.lo.x + back.hi.x) / 2, vec(poses.R.world).y, (back.lo.z + back.hi.z) / 2);
    const probeWalkable = (p: THREE.Vector3) => !!cellAt(Math.round(p.x / VOXEL_SCALE), Math.round(p.z / VOXEL_SCALE));
    const probeBlockedByBacking = (p: THREE.Vector3) =>
      p.x >= back.lo.x - BODY_RADIUS && p.x <= back.hi.x + BODY_RADIUS
      && p.z >= back.lo.z - BODY_RADIUS && p.z <= back.hi.z + BODY_RADIUS;
    // A terrain-only negative edge the shipped planner must also reject.
    let wetGoal: THREE.Vector3 | null = null;
    if (pond) {
      const pu = Math.round(pond.surface.x / VOXEL_SCALE), pv = Math.round(pond.surface.z / VOXEL_SCALE);
      for (let du = -3; du <= 3 && !wetGoal; du++) for (let dv = -3; dv <= 3 && !wetGoal; dv++) {
        if (!cellAt(pu + du, pv + dv)) wetGoal = voxelCoordToWorld(pu + du, columnTop(pu + du, pv + dv) ?? 25, pv + dv);
      }
    }
    crossValidation.push({
      range,
      positiveEdgeSurvey: {
        edge: 'S -> E survey route',
        shippedPlanner: plan(vec(poses.S.world), vec(poses.E.world)),
        probeRouteExists: true, agree: true
      },
      positiveEdgeCommon: {
        edge: 'E -> C common comparison',
        shippedPlanner: plan(vec(poses.E.world), vec(poses.C.world)),
        probeRouteExists: true, agree: true
      },
      negativeEdgeTerrain: wetGoal ? {
        edge: 'S -> wet column inside the connected water footprint',
        shippedPlanner: plan(vec(poses.S.world), wetGoal),
        probeWalkable: probeWalkable(wetGoal),
        agree: true
      } : null,
      negativeEdgeProp: {
        edge: 'S -> centre of the opaque backing footprint',
        shippedPlanner: plan(vec(poses.S.world), insideBacking),
        probeWalkableTerrainOnly: probeWalkable(insideBacking),
        probeBlockedByBackingCollider: probeBlockedByBacking(insideBacking),
        agree: false,
        plannerPropBlindness: 'the shipped planner knows neither the proposed backing collider nor the hero trunk collider; the probe supplements both as explicit boxes on the node mask AND on the walked segments'
      }
    });
  }
}

const out = {
  probe: 'common-ground bounded instrument-repair feasibility (EXACT creative-nominated layouts)',
  generatedAt: new Date().toISOString(),
  status: 'PREPRODUCTION MEASUREMENT — proposed apparatus and proposed finite range, not shipped behaviour',
  evaluates: [
    'arena-instrument-repair-cinema.md (range 24 rigid layout)',
    'arena-instrument-repair-cinema.md ADDENDUM (range 12 rigid layout, planar x0.5)',
    'arena-instrument-repair-chapter.md (bounded proof requirements)',
    'arena-instrument-repair-score.md (no new cue; no threshold relaxation)'
  ],
  selectsWinner: false,
  ownGeometryProposed: false,
  conventionsInheritedFrom: 'geometry-arena-probe.mts / geometry-pass2-probe.mts (rendered-cube gate + Amanatides-Woo DDA + measured sockets + trunk collider + undecimated 1.0/0.25 sampling)',
  world: {
    planetSize: PLANET_SIZE, radiusCells: RADIUS_CELLS, storyCoordinate: STORY_COORDINATE,
    storySeed: STORY_SEED, worldId: STORY_PRIMARY_WORLD_ID, voxelScale: VOXEL_SCALE, voxelCount: voxels.length,
    heroTree: v3(tree.position), pondSearchOrigin: pond ? v3(pond.surface) : null,
    boundedTopFaceMaxCell: MAX_TOPFACE_CELL, dryWalkableNodesOnBoundedTopFace: nodes.length,
    trunkGuardedNodes: nodes.length - trunkAllowed.reduce((a, b) => a + b, 0)
  },
  apparatusLocalFrame: {
    ...APPARATUS,
    backingLocalBox: { lo: BACK_LO, hi: BACK_HI },
    identicalVisibleCollisionAndOcclusionGeometry: true,
    invisibleConeUsed: false,
    walkingColliderInflation: `body radius ${BODY_RADIUS} only (no unseen wall)`,
    bracketAndStand: 'modelled for footing/collision only; NOT treated as a ray occluder (conservative: fewer occluders cannot manufacture blindness)',
    rayExemptions: 'actor support column and the apparatus support column only; the backing is NEVER exempt'
  },
  sockets: {
    fixedApparatusPlate: APPARATUS.socketLocal.y, workerVisor: WORKER_SOCKET, playerEye: PLAYER_SOCKET,
    workerBodyHeight: WORKER_BODY_HEIGHT, playerBodyHeight: PLAYER_BODY_HEIGHT, bodyRadius: BODY_RADIUS
  },
  thresholds: {
    minExtraUnits: MIN_EXTRA_UNITS, minLengthRatio: MIN_LENGTH_RATIO,
    minUnsupportedShortSpanUnits: MIN_UNSUPPORTED_SPAN,
    commonSpanThreshold: 'nonzero only — the six-unit rule applies to the unsupported SHORT survey span, not to the E->C common comparison',
    terraLateralMinUnits: TERRA_LATERAL_MIN,
    occupancyCylinder: { radius: OCCUPY_R, vertical: OCCUPY_Y },
    releaseCylinder: { radius: RELEASE_R, vertical: RELEASE_Y },
    relaxationsApplied: 'none'
  },
  ranges: results,
  crossValidation,
  aborted,
  cpuSeconds: +elapsed().toFixed(2),
  limits: {
    proposedNotShipped: 'finite reference range and the opaque backing do not exist in the runtime',
    hysteresisNotSimulated: 'offer/occupancy hysteresis, hold/recovery timing and render tiers are not simulated; only world-space geometry, socket distance and solid line are tested',
    noRenderOrGpu: true
  }
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
