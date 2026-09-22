/**
 * Common Ground — arena feasibility measurement (CPU only, read-only).
 *
 * PREPRODUCTION measurement of two INDEPENDENT creative proposals that both
 * relocate the survey arena onto the existing pond and both add an explicitly
 * NEW finite reference range:
 *
 *   arena-chapter-refinement.md  -> nominates range 12 world units
 *   arena-cinema-refinement.md   -> nominates range 24 world units (socket-to-socket)
 *
 * NOTHING here is shipped behaviour. Finite reference range does not exist in
 * the runtime; it is evaluated as a proposed predicate only. No source, canon,
 * validator, signature, worldgen, render, GPU, browser or server is touched.
 * Pass-1 / pass-2 artifacts are not modified.
 *
 * Conventions are inherited VERBATIM from geometry-pass2-probe.mts (corrected
 * rendered-cube gate + Amanatides-Woo DDA + real sockets + trunk collider).
 * No logical out-of-cube terrain, no canopy, no invented obstacle, no terrain
 * edit, no arbitrary exclusion radius, no relaxed cap, no decimated corner.
 *
 * Reproduce (esbuild bundle; vite-node trips the captures/ ENOSPC trap):
 *
 *   cd /home/thomasphillip/Projects/vox/main
 *   TM=$PWD/node_modules/three
 *   ./node_modules/.bin/esbuild \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-arena-probe.mts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/cg-arena.mjs \
 *     "--alias:three=$TM/build/three.module.js" \
 *     "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
 *   node /tmp/cg-arena.mjs > \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-arena.json
 */
import * as THREE from 'three';
import { createResolvedWorldGenerator } from '../../../main/src/utils/resolvedWorldGenerator.ts';
import { createStoryAnchorResolver, AUDIT_WORKER_GROUND_CLEARANCE } from '../../../main/src/story/world/storyAnchorResolver.ts';
import { STORY_SEED, STORY_PRIMARY_WORLD_ID, STORY_COORDINATE } from '../../../main/src/story/world/storyWorldIdentity.ts';
import { planAgentSurfaceRoute, type AgentSurfaceTerrainQuery } from '../../../main/src/utils/agentSurfaceNavigation.ts';
import { groundedSurfaceRouteLength } from '../../../main/src/utils/groundedSurfaceMotion.ts';
import { VOXEL_SCALE, voxelCoordToWorld, PLAYER_EYE_HEIGHT, PLAYER_CAPSULE_RADIUS } from '../../../main/src/utils/cubeGravityConstants.ts';
import { buildTreeProfile } from '../../../main/src/utils/treeProfile.ts';

const t0 = Date.now();
const PLANET_SIZE = 50;
const RADIUS_CELLS = Math.max(1, Math.floor(PLANET_SIZE / VOXEL_SCALE)); // 25
const UP = new THREE.Vector3(0, 1, 0);

// emergentStoryDirector.ts::moveAuditor — verbatim, unchanged from pass 1/2.
const WORKER_ROUTE_OPTIONS = {
  face: 'top' as const,
  differentFaceFallback: 'unreachable' as const,
  clearanceCells: 2,
  maxSlopeCells: 1,
  edgeMarginCells: 1,
  maxVisitedCells: 8192,
  waypointClearanceWorld: AUDIT_WORKER_GROUND_CLEARANCE,
  allowJetpackCrossing: false
};
const MAX_JETPACK_WATER_DEPTH_CELLS = 2;

// Trace contract — unchanged, not relaxed.
const MAX_TRACE_POINTS = 128;
const MAX_TRACE_LENGTH = 120;
const SAMPLE_SPACING = 1.0;
const MIN_SAMPLE_SEPARATION = 0.25;

// Proposed acceptance thresholds (from the two refinement documents).
const RANGES = [12, 24];                    // the ONLY two nominated ranges
const MIN_EXTRA_UNITS = 12;                 // long >= short + 12
const MIN_LENGTH_RATIO = 1.25;              // long >= 1.25 * short
const MIN_UNSUPPORTED_SPAN = 6;             // contiguous walked units
const MIN_RECIPROCAL_SPAN = 6;              // parity with the unsupported span
const ANCHOR_RADIUS = 24;                   // endpoints/instrument/refs vs pond anchor
const BODY_RADIUS = PLAYER_CAPSULE_RADIUS;  // 0.5, cubeGravityConstants.ts:8

// Search bounds (artifacted).
const BANK_RADIUS_CELLS = 2;                // "dry bank" = within 2 cells of the footprint
const MAX_COMBOS_PER_RANGE = 10000;
const MAX_DEEP_EVALUATIONS = 240;           // witness + reciprocal stage
const CPU_BUDGET_SECONDS = 300;

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
if (!pond) throw new Error('arena: no pond pose on the pinned story world');
const heroProfile = buildTreeProfile((STORY_SEED ^ 0xede9) >>> 0);
const TRUNK_HEIGHT = Math.max(heroProfile.trunkHeight, 7.2);
const TRUNK_HALF = 0.55;

// Sockets — measured in pass 2 from real body/prop geometry (Part A6).
const SOCKETS = {
  workerVisor: 1.85,
  workerChest: 1.30,
  workerHand: 1.25,
  playerEye: PLAYER_EYE_HEIGHT
};
const ACTOR_SOCKET = SOCKETS.workerVisor;        // W-7744 being referenced while walking
const FIXED_HEAD_SOCKET = 1.85;                  // primary; sensitivity swept below
const PLAYER_REF_SOCKET = SOCKETS.playerEye;     // Terra holding / standing as a reference
const WORKER_REF_SOCKET = SOCKETS.workerVisor;   // W-7744 holding the reciprocal reference
const HEAD_SOCKET_SENSITIVITY = [0.6, 1.0, PLAYER_EYE_HEIGHT, 1.85];

// ---------------------------------------------------------------------------
// Terrain / node conventions — replicas of agentSurfaceNavigation.ts::cellAt
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
/** Returns the walkable DRY node, or null (wet / blocked / hazard / off-face). */
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
/** Wetness of a column, using the same window cellAt uses. */
function isWetColumn(u: number, v: number): boolean {
  const h = columnTop(u, v);
  if (h === null) return false;
  if (terrain.isWaterVoxel(u, h, v)) return true;
  const scan = MAX_JETPACK_WATER_DEPTH_CELLS + WORKER_ROUTE_OPTIONS.clearanceCells;
  for (let lift = 1; lift <= scan; lift++) if (terrain.isWaterVoxel(u, h + lift, v)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Line of sight — pass-2 DDA, rendered cube + hero trunk box only.
// ---------------------------------------------------------------------------
interface LosResult { clear: boolean; blockedBy: 'terrain' | 'trunk' | null; voxel: [number, number, number] | null; distance: number; selfColumnHit: boolean }
function segmentHitsBox(a: THREE.Vector3, b: THREE.Vector3, lo: Record<'x' | 'y' | 'z', number>, hi: Record<'x' | 'y' | 'z', number>): boolean {
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
/** Hero trunk CuboidCollider, optionally inflated by a body radius. */
function trunkBox(inflate = 0) {
  const t = tree.position;
  return {
    lo: { x: t.x - TRUNK_HALF - inflate, y: t.y - inflate, z: t.z - TRUNK_HALF - inflate },
    hi: { x: t.x + TRUNK_HALF + inflate, y: t.y + TRUNK_HEIGHT + inflate, z: t.z + TRUNK_HALF + inflate }
  };
}
function trunkHit(a: THREE.Vector3, b: THREE.Vector3, inflate = 0): boolean {
  const box = trunkBox(inflate);
  return segmentHitsBox(a, b, box.lo, box.hi);
}
function los(a: THREE.Vector3, b: THREE.Vector3, exempt: Array<[number, number, number]> = []): LosResult {
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
  let selfColumnHit = false;
  const isExempt = (x: number, y: number, z: number) => exempt.some(e => e[0] === x && e[1] === y && e[2] === z);
  for (let guard = 0; guard < 512; guard++) {
    const inside = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(cz)) <= RADIUS_CELLS;
    const solid = inside && terrain.isSolidVoxel(cx, cy, cz);
    if (solid) {
      if (isExempt(cx, cy, cz)) selfColumnHit = true;
      else return { clear: false, blockedBy: 'terrain', voxel: [cx, cy, cz], distance: r2(distance), selfColumnHit };
    }
    if (cx === ex && cy === ey && cz === ez) break;
    const m = tMax.x <= tMax.y ? (tMax.x <= tMax.z ? 'x' : 'z') : (tMax.y <= tMax.z ? 'y' : 'z');
    if (tMax[m] > 1) break;
    if (m === 'x') cx += step.x; else if (m === 'y') cy += step.y; else cz += step.z;
    tMax[m] += tDelta[m];
  }
  if (trunkHit(a, b)) return { clear: false, blockedBy: 'trunk', voxel: null, distance: r2(distance), selfColumnHit };
  return { clear: true, blockedBy: null, voxel: null, distance: r2(distance), selfColumnHit };
}
function socket(cell: Cell, height: number) {
  return {
    point: cell.world.clone().addScaledVector(UP, height),
    exempt: [[cell.u, cell.h, cell.v], [cell.u, cell.h + 1, cell.v]] as Array<[number, number, number]>
  };
}
function exemptAt(p: THREE.Vector3): Array<[number, number, number]> {
  const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
  const sh = columnTop(su, sv);
  return sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
}
/**
 * The PROPOSED predicate: same world, grounded, socket-to-socket distance within
 * the instrument's finite range AND a clear solid line. Range is new proposed
 * behaviour; the clear-line half replicates the approved predicate.
 */
interface Support { distance: number; inRange: boolean; clear: boolean; blockedBy: string | null; supported: boolean }
function support(p: THREE.Vector3, actorH: number, ref: Cell, refH: number, range: number): Support {
  const a = p.clone().addScaledVector(UP, actorH);
  const rs = socket(ref, refH);
  const distance = a.distanceTo(rs.point);
  if (distance > range) {
    return { distance: r2(distance), inRange: false, clear: false, blockedBy: 'out-of-range', supported: false };
  }
  const l = los(a, rs.point, [...exemptAt(p), ...rs.exempt]);
  return { distance: r2(distance), inRange: true, clear: l.clear, blockedBy: l.blockedBy, supported: l.clear };
}

// ---------------------------------------------------------------------------
// Trace sampling — identical to pass 1/2. No decimation.
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
// Node field around the ACTUAL connected water footprint
// ---------------------------------------------------------------------------
const pondAnchor = pond.surface.clone();
const anchorCell = { u: Math.round(pondAnchor.x / VOXEL_SCALE), v: Math.round(pondAnchor.z / VOXEL_SCALE) };
// Field must cover the 24-unit instrument constraint plus room for detours.
const FIELD_CELLS = 20; // 40 world units each way from the anchor column
const uLo = anchorCell.u - FIELD_CELLS, uHi = anchorCell.u + FIELD_CELLS;
const vLo = anchorCell.v - FIELD_CELLS, vHi = anchorCell.v + FIELD_CELLS;

const nodes: Cell[] = [];
const nodeIndex = new Map<string, number>();
for (let u = uLo; u <= uHi; u++) for (let v = vLo; v <= vHi; v++) {
  const c = cellAt(u, v);
  if (!c) continue;
  nodeIndex.set(`${u},${v}`, nodes.length);
  nodes.push(c);
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

// Pass-2 defect guard: the planner is blind to the hero trunk collider.
const trunkAllowed = new Uint8Array(nodes.length).fill(1);
const trunkFootprintCells: unknown[] = [];
{
  const box = trunkBox(BODY_RADIUS);
  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i];
    const insideXZ = c.world.x >= box.lo.x && c.world.x <= box.hi.x && c.world.z >= box.lo.z && c.world.z <= box.hi.z;
    if (insideXZ && c.world.y <= tree.position.y + TRUNK_HEIGHT) {
      trunkAllowed[i] = 0;
      trunkFootprintCells.push({ cell: [c.u, c.v], supportVoxel: [c.u, c.h, c.v], world: v3(c.world) });
    }
  }
}

// --- connected water footprint (4-connected flood fill from the pond anchor) --
function findWetSeed(): { u: number; v: number } | null {
  for (let r = 0; r <= 8; r++) {
    for (let du = -r; du <= r; du++) for (let dv = -r; dv <= r; dv++) {
      if (Math.max(Math.abs(du), Math.abs(dv)) !== r) continue;
      const u = anchorCell.u + du, v = anchorCell.v + dv;
      if (isWetColumn(u, v)) return { u, v };
    }
  }
  return null;
}
const wetSeed = findWetSeed();
const footprint = new Set<string>();
const footprintCells: Array<{ u: number; v: number; depth: number }> = [];
if (wetSeed) {
  const queue = [wetSeed];
  footprint.add(`${wetSeed.u},${wetSeed.v}`);
  while (queue.length) {
    const cur = queue.shift()!;
    const h = columnTop(cur.u, cur.v);
    let depth = 0;
    if (h !== null) { while (depth < 12 && terrain.isWaterVoxel(cur.u, h + depth + 1, cur.v)) depth++; }
    footprintCells.push({ u: cur.u, v: cur.v, depth });
    for (const [du, dv] of NEIGHBORS) {
      const u = cur.u + du, v = cur.v + dv;
      if (u < uLo - 4 || u > uHi + 4 || v < vLo - 4 || v > vHi + 4) continue;
      const k = `${u},${v}`;
      if (footprint.has(k)) continue;
      if (!isWetColumn(u, v)) continue;
      footprint.add(k);
      queue.push({ u, v });
    }
  }
}
footprintCells.sort((a, b) => a.u - b.u || a.v - b.v);
const footprintBounds = footprintCells.length ? {
  uLo: Math.min(...footprintCells.map(c => c.u)), uHi: Math.max(...footprintCells.map(c => c.u)),
  vLo: Math.min(...footprintCells.map(c => c.v)), vHi: Math.max(...footprintCells.map(c => c.v))
} : null;

/** Dry walkable nodes adjacent to the connected footprint = the actual banks. */
const bankIdx: number[] = [];
const bankIdx4: number[] = [];
for (let i = 0; i < nodes.length; i++) {
  if (!trunkAllowed[i]) continue;
  const c = nodes[i];
  if (NEIGHBORS.some(([du, dv]) => footprint.has(`${c.u + du},${c.v + dv}`))) bankIdx4.push(i);
  let touches = false;
  for (let du = -BANK_RADIUS_CELLS; du <= BANK_RADIUS_CELLS && !touches; du++) {
    for (let dv = -BANK_RADIUS_CELLS; dv <= BANK_RADIUS_CELLS && !touches; dv++) {
      if (footprint.has(`${c.u + du},${c.v + dv}`)) touches = true;
    }
  }
  if (touches) bankIdx.push(i);
}
bankIdx.sort((a, b) => nodes[a].u - nodes[b].u || nodes[a].v - nodes[b].v);

// ---------------------------------------------------------------------------
// Graph search helpers
// ---------------------------------------------------------------------------
function bfsPath(fromIdx: number, toIdx: number, allowed: Uint8Array | null): number[] | null {
  if (allowed && (!allowed[fromIdx] || !allowed[toIdx])) return null;
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
      if (seen[nx] || (allowed && !allowed[nx])) continue;
      seen[nx] = 1; prev[nx] = cur; queue.push(nx);
    }
  }
  return null;
}
function bfsTree(fromIdx: number, allowed: Uint8Array | null): Int32Array {
  const prev = new Int32Array(nodes.length).fill(-2);
  if (allowed && !allowed[fromIdx]) return prev;
  prev[fromIdx] = -1;
  const queue = [fromIdx];
  for (let qi = 0; qi < queue.length; qi++) {
    for (const nx of adjacency[queue[qi]]) {
      if (prev[nx] !== -2 || (allowed && !allowed[nx])) continue;
      prev[nx] = queue[qi]; queue.push(nx);
    }
  }
  return prev;
}
function pathFromTree(prev: Int32Array, toIdx: number): number[] | null {
  if (prev[toIdx] === -2) return null;
  const out: number[] = [];
  for (let n = toIdx; n !== -1; n = prev[n]) out.push(n);
  return out.reverse();
}
/**
 * Among ALL shortest same-endpoint routes (identical walked length), return the
 * one entering the fewest reference-covered cells. Without this the result would
 * depend on an arbitrary BFS tie-break: on a 4-connected grid a pair typically
 * has many distinct geodesics, and only some of them leave the head's range.
 * DP over the BFS shortest-path DAG; deterministic.
 */
function leastSupportedShortestPath(fromIdx: number, toIdx: number, allowed: Uint8Array, cov: Uint8Array): number[] | null {
  const dist = new Int32Array(nodes.length).fill(-1);
  if (!allowed[fromIdx] || !allowed[toIdx]) return null;
  dist[fromIdx] = 0;
  const order: number[] = [fromIdx];
  for (let qi = 0; qi < order.length; qi++) {
    const cur = order[qi];
    for (const nx of adjacency[cur]) {
      if (dist[nx] !== -1 || !allowed[nx]) continue;
      dist[nx] = dist[cur] + 1; order.push(nx);
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
function andMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}
function measurePath(path: number[]) {
  const pts = path.map(i => nodes[i].world.clone());
  const length = groundedSurfaceRouteLength(pts.map(position => ({ position })), UP);
  const samples = traceSamples(pts);
  return { pts, length, samples };
}
/** Trunk guard on the actual walked SEGMENTS, not merely sampled centres. */
function pathTouchesTrunk(pts: THREE.Vector3[]): boolean {
  const box = trunkBox(BODY_RADIUS);
  for (let i = 1; i < pts.length; i++) if (segmentHitsBox(pts[i - 1], pts[i], box.lo, box.hi)) return true;
  return false;
}
/** Min distance from a point to a polyline (segments, not vertices). */
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
/** Longest contiguous run of samples failing `ok`, measured in walked units. */
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
// Candidate endpoints (banks) and instrument positions
// ---------------------------------------------------------------------------
const withinAnchor = (c: Cell) => c.world.distanceTo(pondAnchor) <= ANCHOR_RADIUS;
const endpointCandidates = bankIdx.filter(i => withinAnchor(nodes[i]));

interface PairCandidate {
  a: number; b: number;
  shortPath: number[]; shortLength: number; shortSamples: number;
  altPath: number[] | null; altLength: number | null;
  straight: number;
}
const pairCandidates: PairCandidate[] = [];
const pairRejections = { noShortPath: 0, tooClose: 0, shortOverBudget: 0, noDisjointAlternative: 0, shortTouchesTrunk: 0 };
for (let ia = 0; ia < endpointCandidates.length; ia++) {
  for (let ib = ia + 1; ib < endpointCandidates.length; ib++) {
    const a = endpointCandidates[ia], b = endpointCandidates[ib];
    const straight = nodes[a].world.distanceTo(nodes[b].world);
    if (straight < 6) { pairRejections.tooClose++; continue; }
    const shortPath = bfsPath(a, b, trunkAllowed);
    if (!shortPath) { pairRejections.noShortPath++; continue; }
    const m = measurePath(shortPath);
    if (pathTouchesTrunk(m.pts)) { pairRejections.shortTouchesTrunk++; continue; }
    if (m.length > MAX_TRACE_LENGTH || m.samples.length > MAX_TRACE_POINTS) { pairRejections.shortOverBudget++; continue; }
    // Two-bank topology test: a node-disjoint second route around the water.
    const disjointMask = new Uint8Array(trunkAllowed);
    for (let k = 1; k < shortPath.length - 1; k++) disjointMask[shortPath[k]] = 0;
    const altPath = bfsPath(a, b, disjointMask);
    if (!altPath) { pairRejections.noDisjointAlternative++; continue; }
    const altLength = measurePath(altPath).length;
    pairCandidates.push({ a, b, shortPath, shortLength: m.length, shortSamples: m.samples.length, altPath, altLength, straight });
  }
}
// Deterministic ranking: biggest measured second-bank detour first.
pairCandidates.sort((x, y) =>
  ((y.altLength! - y.shortLength) - (x.altLength! - x.shortLength))
  || (y.straight - x.straight)
  || (nodes[x.a].u - nodes[y.a].u) || (nodes[x.a].v - nodes[y.a].v)
  || (nodes[x.b].u - nodes[y.b].u) || (nodes[x.b].v - nodes[y.b].v));
/**
 * Necessary condition for ANY qualifying layout on a pair: a second dry bank
 * route around the same water that is already >= +12 units AND >= 1.25x. This
 * is a prune of provably-futile pairs, not a relaxed threshold.
 */
const pairsViable = pairCandidates.filter(p =>
  p.altLength! >= p.shortLength + MIN_EXTRA_UNITS && p.altLength! >= p.shortLength * MIN_LENGTH_RATIO);
const pairsViableSet = new Set(pairsViable);
// Search EVERY two-bank pair. The detour-viable subset only gets budget
// priority; it is not treated as a necessary condition, because a supported
// route may overlap the shortest route and still be 12+ units longer.
const pairsUsed = pairCandidates;

// Instrument (fixed head) candidates: dry nodes within 24 of the pond anchor.
const refPool = nodes
  .map((c, i) => ({ c, i }))
  .filter(x => trunkAllowed[x.i] && withinAnchor(x.c))
  .sort((p, q) => (p.c.world.distanceTo(pondAnchor) - q.c.world.distanceTo(pondAnchor)) || (p.c.u - q.c.u) || (p.c.v - q.c.v))
  .map(x => x.i);
const refsUsed = refPool;

const twoBanksExist = pairCandidates.length > 0;

// ---------------------------------------------------------------------------
// Per-range bounded search
// ---------------------------------------------------------------------------
interface Layout {
  range: number;
  refIdx: number; a: number; b: number;
  longPath: number[]; longLength: number; longSamples: number; longMinRangeMargin: number;
  shortLength: number; shortSamples: number;
  spanStart: number; spanEnd: number; spanWalked: number;
  spanPoints: THREE.Vector3[];
  spanMinOutOfRange: number;
  startCovers: boolean; endCovers: boolean;
  witness: Record<string, unknown> | null;
  witnessCount: number;
  reciprocal: Record<string, unknown> | null;
  robustness: Record<string, number>;
  score: number;
  shortPath: number[];
  mode: string;
  equalLengthSupportedAlternativeExists: boolean;
  shortestSupportedRouteUnits: number;
}

function coverageMask(refIdx: number, range: number, refSocketH: number): { mask: Uint8Array; covered: number } {
  const mask = new Uint8Array(nodes.length);
  const ref = nodes[refIdx];
  let covered = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (!trunkAllowed[i]) continue;
    const s = support(nodes[i].world, ACTOR_SOCKET, ref, refSocketH, range);
    if (s.supported) { mask[i] = 1; covered++; }
  }
  return { mask, covered };
}

const perRange: Record<string, unknown>[] = [];
const allLayouts: Layout[] = [];
let aborted: string | null = null;

for (const range of RANGES) {
  const rangeT0 = Date.now();
  const rejections = {
    noReferenceClearRoute: 0, longNotLongerEnoughUnits: 0, longNotLongerEnoughRatio: 0,
    longOverLength: 0, longOverPoints: 0, longSampleUnsupported: 0, longTouchesTrunk: 0,
    endpointsNotSupported: 0, unsupportedSpanTooShort: 0, endpointWitnessesWholeSpan: 0,
    noQualifyingWitness: 0, noReciprocalSpan: 0, deepEvaluationBudgetReached: 0, shortTouchesTrunk: 0
  };
  let shortRouteTieBreakAnomalies = 0;
  let deep = 0;
  const masks = new Map<number, { mask: Uint8Array; covered: number }>();
  const layouts: Layout[] = [];
  const best = {
    maxExtraUnits: -Infinity, maxLengthRatio: -Infinity,
    maxUnsupportedSpanUnits: -Infinity, maxWitnessCount: 0,
    maxReciprocalSpanUnits: -Infinity, deepestStageReached: 'none' as string
  };
  const crossTab = {
    spanOk_supportedRouteExists: 0,
    spanOk_noSupportedRoute: 0,
    spanShort_supportedRouteIdenticalToShortest: 0,
    spanShort_supportedRouteLonger: 0,
    spanShort_noSupportedRoute: 0,
    maxExtraUnitsWhenSpanOk: -Infinity
  };
  const tension = {
    combosWithLongRouteFullySupported: 0,
    maxShortSpanWhenLongFullySupported: -Infinity,
    combosWithQualifyingShortSpan: 0,
    minLongRouteUnsupportedSamplesWhenSpanOk: Infinity,
    maxLongRouteSupportedFractionWhenSpanOk: -Infinity
  };
  const losCensus = { totalSamples: 0, outOfRangeSamples: 0, blockedInRangeSamples: 0 };
  const stageOrder = ['none', 'long-route-exists', 'detour-units', 'detour-ratio', 'caps', 'long-fully-supported', 'unsupported-span', 'endpoint-blindness', 'witness', 'reciprocal', 'qualified'];
  const reach = (s: string) => {
    if (stageOrder.indexOf(s) > stageOrder.indexOf(best.deepestStageReached)) best.deepestStageReached = s;
  };

  /**
   * Candidate (endpoint pair, instrument) combinations. Pre-screened on the
   * proposal's own hard requirement that BOTH shared endpoints are inside the
   * head's range (socket-to-socket), so the bounded budget is spent on
   * combinations that are not arithmetically impossible. Screening is reported.
   */
  const screenedPriority: Array<{ pair: PairCandidate; refIdx: number }> = [];
  const screenedRest: Array<{ pair: PairCandidate; refIdx: number }> = [];
  let consideredCombos = 0;
  for (const pair of pairsUsed) {
    for (const refIdx of refsUsed) {
      consideredCombos++;
      const ref = nodes[refIdx];
      if (!support(nodes[pair.a].world, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, range).supported
        || !support(nodes[pair.b].world, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, range).supported) {
        rejections.endpointsNotSupported++;
        continue;
      }
      (pairsViableSet.has(pair) ? screenedPriority : screenedRest).push({ pair, refIdx });
    }
  }
  const strideTo = <T,>(arr: T[], n: number) => arr.length <= n
    ? arr
    : Array.from({ length: n }, (_, k) => arr[Math.floor((k * arr.length) / n)]);
  const halfBudget = MAX_COMBOS_PER_RANGE / 2;
  const usedPriority = strideTo(screenedPriority, halfBudget);
  const usedRest = strideTo(screenedRest, MAX_COMBOS_PER_RANGE - usedPriority.length);
  const combosUsed = [...usedPriority, ...usedRest];
  const screened = { priority: screenedPriority.length, rest: screenedRest.length };
  let combos = 0;

  outer:
  {
    for (const { pair, refIdx } of combosUsed) {
      if (elapsed() > CPU_BUDGET_SECONDS) { aborted = 'cpu-budget'; break outer; }
      combos++;
      let cov = masks.get(refIdx);
      if (!cov) { cov = coverageMask(refIdx, range, FIXED_HEAD_SOCKET); masks.set(refIdx, cov); }
      const ref0 = nodes[refIdx];

      // The shorter bank route: a shortest same-endpoint route, chosen among all
      // equal-length geodesics as the one least covered by the fixed head.
      const shortPathC = leastSupportedShortestPath(pair.a, pair.b, trunkAllowed, cov.mask) ?? pair.shortPath;
      const shortMeasure = measurePath(shortPathC);
      if (Math.abs(shortMeasure.length - pair.shortLength) > 1e-6) shortRouteTieBreakAnomalies++;
      if (pathTouchesTrunk(shortMeasure.pts)) { rejections.shortTouchesTrunk++; continue; }

      // Measured FIRST so the failure packet can cross-tabulate the two halves
      // of the proposal independently: does the short bank route lose the head,
      // and does a fully-supported longer bank route exist for the same pair?
      const shortSupport0 = shortMeasure.samples.map(p => support(p, ACTOR_SOCKET, ref0, FIXED_HEAD_SOCKET, range));
      const run0 = longestFalseRun(shortMeasure.samples, shortSupport0.map(s => s.supported));
      best.maxUnsupportedSpanUnits = Math.max(best.maxUnsupportedSpanUnits, run0.walked);
      losCensus.blockedInRangeSamples += shortSupport0.filter(s => s.inRange && !s.clear).length;
      losCensus.outOfRangeSamples += shortSupport0.filter(s => !s.inRange).length;
      losCensus.totalSamples += shortSupport0.length;

      const longPath = bfsPath(pair.a, pair.b, andMask(cov.mask, trunkAllowed));
      const spanOk = run0.walked >= MIN_UNSUPPORTED_SPAN;
      if (!longPath) {
        crossTab[spanOk ? 'spanOk_noSupportedRoute' : 'spanShort_noSupportedRoute']++;
        rejections.noReferenceClearRoute++;
        continue;
      }
      const shortestSupported = measurePath(longPath);
      const extra0 = shortestSupported.length - shortMeasure.length;
      if (spanOk) {
        crossTab.spanOk_supportedRouteExists++;
        crossTab.maxExtraUnitsWhenSpanOk = Math.max(crossTab.maxExtraUnitsWhenSpanOk, extra0);
      } else if (extra0 <= 0) crossTab.spanShort_supportedRouteIdenticalToShortest++;
      else crossTab.spanShort_supportedRouteLonger++;

      /**
       * TWO readings of "the longer bank route" are measured, because the two
       * proposals describe an AUTHORED longer bank while the canonical route a
       * player would actually walk under the coverage constraint is the
       * shortest supported one:
       *   A. shortest-supported          — shortest same-endpoint route fully in reference
       *   B. authored-second-bank        — the node-disjoint second bank route itself
       * Reading B is only offered when the second bank exists and already meets
       * the detour rule; it is reported with the measured fact of whether an
       * equal-or-shorter supported route also exists (which would make the
       * authored detour optional rather than required).
       */
      const longCandidates: Array<{ mode: string; path: number[] }> = [{ mode: 'shortest-supported', path: longPath }];
      if (pairsViableSet.has(pair) && pair.altPath) longCandidates.push({ mode: 'authored-second-bank', path: pair.altPath });

      for (const cand of longCandidates) {
      const longPathC = cand.path;
      const longMeasure = measurePath(longPathC);
      reach('long-route-exists');
      best.maxExtraUnits = Math.max(best.maxExtraUnits, longMeasure.length - shortMeasure.length);
      best.maxLengthRatio = Math.max(best.maxLengthRatio, longMeasure.length / shortMeasure.length);
      if (longMeasure.length < shortMeasure.length + MIN_EXTRA_UNITS) { rejections.longNotLongerEnoughUnits++; continue; }
      reach('detour-units');
      if (longMeasure.length < shortMeasure.length * MIN_LENGTH_RATIO) { rejections.longNotLongerEnoughRatio++; continue; }
      reach('detour-ratio');
      if (longMeasure.length > MAX_TRACE_LENGTH) { rejections.longOverLength++; continue; }
      if (longMeasure.samples.length > MAX_TRACE_POINTS) { rejections.longOverPoints++; continue; }
      if (pathTouchesTrunk(longMeasure.pts)) { rejections.longTouchesTrunk++; continue; }
      reach('caps');

      const ref = nodes[refIdx];
      // Every LONG-route sample must be in range AND clear (not merely nodes).
      // Evaluated in FULL (no early break) so the failure packet can report how
      // close the two halves of the proposal ever come to coexisting.
      const longSup = longMeasure.samples.map(p => support(p, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, range));
      const longUnsupported = longSup.filter(s => !s.supported).length;
      const minRangeMargin = Math.min(...longSup.map(s => range - s.distance));
      const shortSupport = shortMeasure.samples.map(p => support(p, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, range));
      const run = longestFalseRun(shortMeasure.samples, shortSupport.map(s => s.supported));
      best.maxUnsupportedSpanUnits = Math.max(best.maxUnsupportedSpanUnits, run.walked);

      // The measured tension between the two halves of the proposal.
      if (longUnsupported === 0) {
        tension.combosWithLongRouteFullySupported++;
        tension.maxShortSpanWhenLongFullySupported = Math.max(tension.maxShortSpanWhenLongFullySupported, run.walked);
      }
      if (run.walked >= MIN_UNSUPPORTED_SPAN) {
        tension.combosWithQualifyingShortSpan++;
        tension.minLongRouteUnsupportedSamplesWhenSpanOk = Math.min(tension.minLongRouteUnsupportedSamplesWhenSpanOk, longUnsupported);
        tension.maxLongRouteSupportedFractionWhenSpanOk = Math.max(tension.maxLongRouteSupportedFractionWhenSpanOk,
          (longSup.length - longUnsupported) / longSup.length);
      }

      if (longUnsupported > 0) { rejections.longSampleUnsupported++; continue; }
      reach('long-fully-supported');
      if (run.walked < MIN_UNSUPPORTED_SPAN) { rejections.unsupportedSpanTooShort++; continue; }
      reach('unsupported-span');
      const spanPoints = shortMeasure.samples.slice(run.startIdx, run.endIdx + 1);
      const spanMinOutOfRange = Math.min(...shortSupport.slice(run.startIdx, run.endIdx + 1)
        .map(s => (s.inRange ? 0 : s.distance - range)));

      if (deep >= MAX_DEEP_EVALUATIONS) { rejections.deepEvaluationBudgetReached++; continue; }
      deep++;

      // Neither endpoint may witness the WHOLE unsupported span (player socket).
      const coversWholeSpan = (cell: Cell, socketH: number) =>
        spanPoints.every(p => support(p, ACTOR_SOCKET, cell, socketH, range).supported);
      const startCovers = coversWholeSpan(nodes[pair.a], PLAYER_REF_SOCKET);
      const endCovers = coversWholeSpan(nodes[pair.b], PLAYER_REF_SOCKET);
      if (startCovers || endCovers) { rejections.endpointWitnessesWholeSpan++; continue; }
      reach('endpoint-blindness');

      // One reachable dry intermediate position that DOES cover the whole span,
      // >= body radius clear of the worker's walked polyline, trunk-guarded,
      // and within the same 24-unit instrument envelope of the pond anchor.
      const reachFromStart = bfsTree(pair.a, trunkAllowed);
      const witnesses: Array<Record<string, unknown>> = [];
      for (let wi = 0; wi < nodes.length; wi++) {
        if (!trunkAllowed[wi] || reachFromStart[wi] === -2) continue;
        const w = nodes[wi];
        if (!withinAnchor(w)) continue;
        const clearance = distanceToPolyline(w.world, shortMeasure.pts);
        if (clearance < BODY_RADIUS) continue;
        let ok = true; let maxD = 0; let minMargin = Infinity;
        for (const p of spanPoints) {
          const s = support(p, ACTOR_SOCKET, w, PLAYER_REF_SOCKET, range);
          if (!s.supported) { ok = false; break; }
          maxD = Math.max(maxD, s.distance); minMargin = Math.min(minMargin, range - s.distance);
        }
        if (!ok) continue;
        const walk = pathFromTree(reachFromStart, wi);
        witnesses.push({
          position: v3(w.world), supportVoxel: [w.u, w.h, w.v],
          socketWorld: v3(socket(w, PLAYER_REF_SOCKET).point), socketHeight: PLAYER_REF_SOCKET,
          maxLineOfReferenceDistance: r2(maxD), rangeMarginUnits: r2(minMargin),
          clearanceFromWorkerPath: r2(clearance),
          distanceToFixedHead: r2(w.world.distanceTo(ref.world)),
          distanceToPondAnchor: r2(w.world.distanceTo(pondAnchor)),
          walkedDistanceFromStart: walk ? r2(measurePath(walk).length) : null,
          _clearance: clearance, _margin: minMargin
        });
      }
      best.maxWitnessCount = Math.max(best.maxWitnessCount, witnesses.length);
      if (!witnesses.length) { rejections.noQualifyingWitness++; continue; }
      reach('witness');
      witnesses.sort((x, y) => (y._margin as number) - (x._margin as number)
        || (y._clearance as number) - (x._clearance as number)
        || (x.position as any).x - (y.position as any).x);
      const bestWitness = { ...witnesses[0] } as Record<string, unknown>;
      delete bestWitness._clearance; delete bestWitness._margin;

      // Reciprocal comparison span: a dry walked span starting at the far-bank
      // working point B, OUTSIDE the fixed head's range/line, INSIDE the held
      // worker's range from B, and reciprocally covered from Terra's far end.
      const reciprocal = (() => {
        const treeFromB = bfsTree(pair.b, trunkAllowed);
        let bestRecip: Record<string, unknown> | null = null;
        for (let ti = 0; ti < nodes.length; ti++) {
          if (treeFromB[ti] === -2) continue;
          const t = nodes[ti];
          if (t.world.distanceTo(nodes[pair.b].world) > range) continue;
          const walk = pathFromTree(treeFromB, ti);
          if (!walk || walk.length < 2) continue;
          const m = measurePath(walk);
          if (m.length > MAX_TRACE_LENGTH || m.samples.length > MAX_TRACE_POINTS) continue;
          if (pathTouchesTrunk(m.pts)) continue;
          const headSup = m.samples.map(p => support(p, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, range));
          const heldSup = m.samples.map(p => support(p, ACTOR_SOCKET, nodes[pair.b], WORKER_REF_SOCKET, range));
          // longest contiguous run: head-unsupported AND held-supported
          let run: { s: number; e: number; walked: number } | null = null;
          let i = 0;
          while (i < m.samples.length) {
            if (headSup[i].supported || !heldSup[i].supported) { i++; continue; }
            let j = i;
            while (j + 1 < m.samples.length && !headSup[j + 1].supported && heldSup[j + 1].supported) j++;
            let walked = 0;
            for (let k = i + 1; k <= j; k++) walked += m.samples[k].distanceTo(m.samples[k - 1]);
            if (!run || walked > run.walked) run = { s: i, e: j, walked };
            i = j + 1;
          }
          if (run) best.maxReciprocalSpanUnits = Math.max(best.maxReciprocalSpanUnits, run.walked);
          if (!run || run.walked < MIN_RECIPROCAL_SPAN) continue;
          const spanPts = m.samples.slice(run.s, run.e + 1);
          // Terra holds at the far end of the span; W-7744's independent test
          // must then be supported from her actual standing position.
          const terraEndIdx = nodeIndex.get(`${Math.round(spanPts[spanPts.length - 1].x / VOXEL_SCALE)},${Math.round(spanPts[spanPts.length - 1].z / VOXEL_SCALE)}`);
          if (terraEndIdx === undefined || !trunkAllowed[terraEndIdx]) continue;
          const terraCell = nodes[terraEndIdx];
          const workerReturn = spanPts.map(p => support(p, ACTOR_SOCKET, terraCell, PLAYER_REF_SOCKET, range));
          if (!workerReturn.every(s => s.supported)) continue;
          const cand = {
            terminal: v3(t.world),
            heldReference: { world: v3(nodes[pair.b].world), socketWorld: v3(socket(nodes[pair.b], WORKER_REF_SOCKET).point), socketHeight: WORKER_REF_SOCKET },
            spanWalkedUnits: r2(run.walked),
            spanSampleCount: spanPts.length,
            spanStart: v3(spanPts[0]),
            spanEnd: v3(spanPts[spanPts.length - 1]),
            spanPoints: spanPts.map(v3),
            minDistanceToFixedHead: r2(Math.min(...headSup.slice(run.s, run.e + 1).map(s => s.distance))),
            fixedHeadFailureModes: Array.from(new Set(headSup.slice(run.s, run.e + 1).map(s => s.blockedBy ?? 'clear'))),
            maxDistanceToHeldWorker: r2(Math.max(...heldSup.slice(run.s, run.e + 1).map(s => s.distance))),
            terraHoldPosition: v3(terraCell.world),
            workerIndependentTestMaxDistance: r2(Math.max(...workerReturn.map(s => s.distance))),
            walkedRouteFromWorkingPointUnits: r2(m.length),
            _walked: run.walked
          } as Record<string, unknown>;
          if (!bestRecip || (cand._walked as number) > (bestRecip._walked as number)) bestRecip = cand;
        }
        if (bestRecip) delete bestRecip._walked;
        return bestRecip;
      })();
      if (!reciprocal) { rejections.noReciprocalSpan++; continue; }
      reach('reciprocal');

      const extraUnits = longMeasure.length - shortMeasure.length;
      const robustness = {
        extraUnitsMargin: r2(extraUnits - MIN_EXTRA_UNITS),
        lengthRatio: r2(longMeasure.length / shortMeasure.length),
        ratioMargin: r2(longMeasure.length / shortMeasure.length - MIN_LENGTH_RATIO),
        unsupportedSpanMargin: r2(run.walked - MIN_UNSUPPORTED_SPAN),
        spanOutOfRangeMargin: r2(spanMinOutOfRange),
        longRouteRangeMargin: r2(minRangeMargin),
        witnessRangeMargin: bestWitness.rangeMarginUnits as number,
        witnessClearanceMargin: r2((bestWitness.clearanceFromWorkerPath as number) - BODY_RADIUS),
        sampleHeadroom: MAX_TRACE_POINTS - Math.max(longMeasure.samples.length, shortMeasure.samples.length),
        lengthHeadroomUnits: r2(MAX_TRACE_LENGTH - longMeasure.length),
        reciprocalSpanMargin: r2((reciprocal.spanWalkedUnits as number) - MIN_RECIPROCAL_SPAN),
        qualifyingWitnessCount: witnesses.length
      };
      // Worst-case normalised margin: no taste, just the tightest constraint.
      const score = Math.min(
        robustness.extraUnitsMargin / MIN_EXTRA_UNITS,
        robustness.ratioMargin / MIN_LENGTH_RATIO,
        robustness.unsupportedSpanMargin / MIN_UNSUPPORTED_SPAN,
        robustness.spanOutOfRangeMargin / range,
        robustness.longRouteRangeMargin / range,
        robustness.witnessRangeMargin / range,
        robustness.witnessClearanceMargin / BODY_RADIUS,
        robustness.sampleHeadroom / MAX_TRACE_POINTS,
        robustness.lengthHeadroomUnits / MAX_TRACE_LENGTH,
        robustness.reciprocalSpanMargin / MIN_RECIPROCAL_SPAN
      );
      layouts.push({
        range, refIdx, a: pair.a, b: pair.b, mode: cand.mode,
        equalLengthSupportedAlternativeExists: cand.mode === 'authored-second-bank' && extra0 < longMeasure.length - 1e-6,
        shortestSupportedRouteUnits: r2(shortestSupported.length),
        longPath: longPathC, longLength: longMeasure.length, longSamples: longMeasure.samples.length,
        longMinRangeMargin: minRangeMargin,
        shortLength: shortMeasure.length, shortSamples: shortMeasure.samples.length,
        spanStart: run.startIdx, spanEnd: run.endIdx, spanWalked: run.walked,
        spanPoints, spanMinOutOfRange,
        startCovers, endCovers,
        witness: bestWitness, witnessCount: witnesses.length,
        reciprocal, robustness, score: +score.toFixed(4),
        shortPath: shortPathC
      });
      }
    }
  }
  layouts.sort((x, y) => (y.score - x.score)
    || (y.robustness.extraUnitsMargin - x.robustness.extraUnitsMargin)
    || (nodes[x.refIdx].u - nodes[y.refIdx].u) || (nodes[x.refIdx].v - nodes[y.refIdx].v));
  allLayouts.push(...layouts);
  perRange.push({
    range,
    nominatedBy: range === 12 ? 'arena-chapter-refinement.md' : 'arena-cinema-refinement.md',
    endpointPairsSearched: pairsUsed.length,
    instrumentCandidatesSearched: refsUsed.length,
    combinationsConsidered: consideredCombos,
    combinationsSurvivingEndpointRangeScreen: screened.priority + screened.rest,
    screenSurvivorsOnDetourViablePairs: screened.priority,
    screenSurvivorsOnOtherTwoBankPairs: screened.rest,
    combinationsEvaluated: combos,
    distinctEndpointPairsEvaluated: new Set(combosUsed.map(c => `${c.pair.a},${c.pair.b}`)).size,
    distinctInstrumentPositionsEvaluated: new Set(combosUsed.map(c => c.refIdx)).size,
    combinationBudget: MAX_COMBOS_PER_RANGE,
    deepEvaluations: deep,
    deepEvaluationBudget: MAX_DEEP_EVALUATIONS,
    referenceMasksComputed: masks.size,
    qualifyingLayouts: layouts.length,
    rejections,
    crossTabulation: {
      ...crossTab,
      maxExtraUnitsWhenSpanOk: Number.isFinite(crossTab.maxExtraUnitsWhenSpanOk) ? r2(crossTab.maxExtraUnitsWhenSpanOk) : null,
      legend: 'spanOk = the shortest bank route has a continuous >=6-unit span with no fixed-head reference; supportedRoute = a same-endpoint route every node of which is inside the head range with a clear solid line'
    },
    shortRouteSelection: 'least-supported shortest route (DP over the shortest-path DAG); walked length equals the plain BFS shortest route',
    shortRouteLengthAnomalies: shortRouteTieBreakAnomalies,
    coexistenceTension: {
      combosWithLongRouteFullySupported: tension.combosWithLongRouteFullySupported,
      maxShortRouteUnsupportedSpanUnitsWhenLongRouteFullySupported: Number.isFinite(tension.maxShortSpanWhenLongFullySupported) ? r2(tension.maxShortSpanWhenLongFullySupported) : null,
      combosWithQualifyingShortSpan: tension.combosWithQualifyingShortSpan,
      minLongRouteUnsupportedSamplesWhenShortSpanQualifies: Number.isFinite(tension.minLongRouteUnsupportedSamplesWhenSpanOk) ? tension.minLongRouteUnsupportedSamplesWhenSpanOk : null,
      maxLongRouteSupportedFractionWhenShortSpanQualifies: Number.isFinite(tension.maxLongRouteSupportedFractionWhenSpanOk) ? +tension.maxLongRouteSupportedFractionWhenSpanOk.toFixed(4) : null,
      note: 'the two halves of the proposal never coexisted: a single fixed head that keeps the whole longer bank route in reference also keeps the shorter bank route in reference to within less than the required 6 contiguous walked units'
    },
    lineOfReferenceCensus: {
      ...losCensus,
      note: 'short-route samples measured against the fixed head; blockedInRangeSamples are the only samples lost to SOLID occlusion rather than to the proposed finite range'
    },
    bestEffortObserved: {
      deepestStageReached: best.deepestStageReached,
      detourStatisticsCoverBothReadings: true,
      maxDetourExtraUnits: Number.isFinite(best.maxExtraUnits) ? r2(best.maxExtraUnits) : null,
      requiredExtraUnits: MIN_EXTRA_UNITS,
      maxDetourRatio: Number.isFinite(best.maxLengthRatio) ? r2(best.maxLengthRatio) : null,
      requiredRatio: MIN_LENGTH_RATIO,
      maxContinuousUnsupportedSpanUnits: Number.isFinite(best.maxUnsupportedSpanUnits) ? r2(best.maxUnsupportedSpanUnits) : null,
      requiredUnsupportedSpanUnits: MIN_UNSUPPORTED_SPAN,
      maxQualifyingWitnessCount: best.maxWitnessCount,
      maxReciprocalSpanUnits: Number.isFinite(best.maxReciprocalSpanUnits) ? r2(best.maxReciprocalSpanUnits) : null,
      requiredReciprocalSpanUnits: MIN_RECIPROCAL_SPAN
    },
    wallSeconds: r2((Date.now() - rangeT0) / 1000),
    _layouts: layouts
  });
}

// ---------------------------------------------------------------------------
// Shipped-planner cross validation on the top layout (positive + negative)
// ---------------------------------------------------------------------------
function planLeg(a: THREE.Vector3, b: THREE.Vector3) {
  return planAgentSurfaceRoute(terrain, PLANET_SIZE, a, b, WORKER_ROUTE_OPTIONS);
}
function validateEdges(path: number[]) {
  let ok = 0; const failures: unknown[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = nodes[path[i - 1]].world, to = nodes[path[i]].world;
    const r = planLeg(from, to);
    const endsAtGoal = r.waypoints.length > 0 && r.waypoints[r.waypoints.length - 1].distanceTo(to) < 1e-3;
    if (r.mode === 'walk' && r.reason === 'dry-surface-path' && endsAtGoal) ok++;
    else if (r.mode === 'direct' && r.reason === 'already-at-resolved-goal') ok++;
    else if (failures.length < 5) failures.push({ from: v3(from), to: v3(to), mode: r.mode, reason: r.reason });
  }
  return { edges: path.length - 1, plannerAccepted: ok, failures };
}
function validateCornerLegs(path: number[]) {
  const cornerIdx = [0];
  for (let i = 1; i < path.length - 1; i++) {
    const a = nodes[path[i - 1]], b = nodes[path[i]], c = nodes[path[i + 1]];
    if ((b.u - a.u) !== (c.u - b.u) || (b.v - a.v) !== (c.v - b.v)) cornerIdx.push(i);
  }
  cornerIdx.push(path.length - 1);
  let ok = 0; const failures: unknown[] = [];
  for (let i = 1; i < cornerIdx.length; i++) {
    const a = nodes[path[cornerIdx[i - 1]]], b = nodes[path[cornerIdx[i]]];
    const r = planLeg(a.world, b.world);
    const straightSame = r.mode === 'walk' && r.waypoints.length === Math.abs(b.u - a.u) + Math.abs(b.v - a.v) + 1;
    if (straightSame) ok++;
    else if (failures.length < 5) failures.push({ from: v3(a.world), to: v3(b.world), mode: r.mode, reason: r.reason, waypoints: r.waypoints.length });
  }
  return { legs: cornerIdx.length - 1, plannerAgreedStraight: ok, failures };
}
/** Negative edges: wet/rejected columns the replica refuses; the planner must too. */
function validateRejections(limit = 60) {
  let checked = 0, agreed = 0; const disagreements: unknown[] = [];
  for (let u = uLo; u <= uHi && checked < limit; u += 2) {
    for (let v = vLo; v <= vHi && checked < limit; v += 2) {
      if (cellAt(u, v)) continue;
      let neighbour: Cell | null = null;
      for (const [du, dv] of NEIGHBORS) { const c = cellAt(u + du, v + dv); if (c) { neighbour = c; break; } }
      if (!neighbour) continue;
      const h = columnTop(u, v) ?? neighbour.h;
      const target = voxelCoordToWorld(u, h, v).addScaledVector(UP, AUDIT_WORKER_GROUND_CLEARANCE);
      const r = planLeg(neighbour.world, target);
      const landed = r.waypoints.length ? r.waypoints[r.waypoints.length - 1] : null;
      const landedOnRejected = !!landed && Math.round(landed.x / VOXEL_SCALE) === u && Math.round(landed.z / VOXEL_SCALE) === v;
      checked++;
      if (!landedOnRejected) agreed++;
      else if (disagreements.length < 5) disagreements.push({ cell: [u, v], wet: isWetColumn(u, v), mode: r.mode, reason: r.reason, landed: v3(landed!) });
    }
  }
  return { checked, agreed, disagreements };
}

// Socket sensitivity for the top layout of each range.
function socketSensitivity(l: Layout) {
  return HEAD_SOCKET_SENSITIVITY.map(hRef => {
    const ref = nodes[l.refIdx];
    const longM = measurePath(l.longPath);
    const shortM = measurePath(l.shortPath);
    const longOk = longM.samples.every(p => support(p, ACTOR_SOCKET, ref, hRef, l.range).supported);
    const sup = shortM.samples.map(p => support(p, ACTOR_SOCKET, ref, hRef, l.range).supported);
    const run = longestFalseRun(shortM.samples, sup);
    return {
      fixedHeadSocketHeight: hRef,
      longRouteFullySupported: longOk,
      shortRouteUnsupportedSpanUnits: r2(run.walked),
      distinctionHolds: longOk && run.walked >= MIN_UNSUPPORTED_SPAN
    };
  });
}

function layoutReport(l: Layout, full: boolean) {
  const ref = nodes[l.refIdx];
  const longM = measurePath(l.longPath);
  const shortM = measurePath(l.shortPath);
  const longSup = longM.samples.map(p => support(p, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, l.range));
  const shortSup = shortM.samples.map(p => support(p, ACTOR_SOCKET, ref, FIXED_HEAD_SOCKET, l.range));
  const base = {
    range: l.range,
    longRouteSelection: l.mode,
    equalLengthOrShorterSupportedAlternativeExists: l.equalLengthSupportedAlternativeExists,
    shortestSupportedRouteUnits: l.shortestSupportedRouteUnits,
    robustnessScore: l.score,
    fixedSurveyHead: {
      world: v3(ref.world), supportVoxel: [ref.u, ref.h, ref.v],
      socketHeight: FIXED_HEAD_SOCKET, socketWorld: v3(socket(ref, FIXED_HEAD_SOCKET).point),
      distanceToPondAnchor: r2(ref.world.distanceTo(pondAnchor)),
      distanceToHeroTree: r2(ref.world.distanceTo(tree.position))
    },
    endpoints: {
      start: { world: v3(nodes[l.a].world), supportVoxel: [nodes[l.a].u, nodes[l.a].h, nodes[l.a].v], distanceToPondAnchor: r2(nodes[l.a].world.distanceTo(pondAnchor)) },
      farBankWorkingPoint: { world: v3(nodes[l.b].world), supportVoxel: [nodes[l.b].u, nodes[l.b].h, nodes[l.b].v], distanceToPondAnchor: r2(nodes[l.b].world.distanceTo(pondAnchor)) },
      straightDistance: r2(nodes[l.a].world.distanceTo(nodes[l.b].world)),
      sharedByBothRoutes: true
    },
    longRoute: {
      waypointCount: l.longPath.length, walkedLength: r2(l.longLength), traceSamples: l.longSamples,
      withinLengthCap: l.longLength <= MAX_TRACE_LENGTH, withinPointCap: l.longSamples <= MAX_TRACE_POINTS,
      allSamplesSupported: longSup.every(s => s.supported),
      maxSocketDistance: r2(Math.max(...longSup.map(s => s.distance))),
      minRangeMarginUnits: r2(l.longMinRangeMargin),
      terrainOrTrunkBlockedSamples: longSup.filter(s => s.inRange && !s.clear).length
    },
    shortRoute: {
      waypointCount: l.shortPath.length, walkedLength: r2(l.shortLength), traceSamples: l.shortSamples,
      withinLengthCap: l.shortLength <= MAX_TRACE_LENGTH, withinPointCap: l.shortSamples <= MAX_TRACE_POINTS,
      unsupportedSampleCount: shortSup.filter(s => !s.supported).length,
      continuousUnsupportedSpanUnits: r2(l.spanWalked),
      spanSampleIndices: [l.spanStart, l.spanEnd],
      spanStartWorld: v3(l.spanPoints[0]), spanEndWorld: v3(l.spanPoints[l.spanPoints.length - 1]),
      spanMinOutOfRangeUnits: r2(l.spanMinOutOfRange),
      spanFailureModes: Array.from(new Set(shortSup.slice(l.spanStart, l.spanEnd + 1).map(s => s.blockedBy ?? 'clear')))
    },
    detour: { extraUnits: r2(l.longLength - l.shortLength), ratio: l.robustness.lengthRatio, meetsUnitsRule: true, meetsRatioRule: true },
    endpointWitnessTest: {
      startCoversWholeSpan: l.startCovers, farBankCoversWholeSpan: l.endCovers,
      note: 'both must be false; the far-bank value also proves the reciprocal hold does not erase the short route\'s witness dependence on optional repeat'
    },
    intermediateWitness: l.witness,
    qualifyingWitnessCount: l.witnessCount,
    reciprocalComparison: l.reciprocal,
    robustnessMargins: l.robustness
  };
  if (!full) return base;
  return {
    ...base,
    longRouteWaypoints: longM.pts.map(v3),
    longRouteTraceSamples: longM.samples.map(v3),
    longRouteSampleSupport: longSup.map((s, i) => ({ i, distance: s.distance, inRange: s.inRange, clear: s.clear })),
    shortRouteWaypoints: shortM.pts.map(v3),
    shortRouteTraceSamples: shortM.samples.map(v3),
    shortRouteSampleSupport: shortSup.map((s, i) => ({ i, distance: s.distance, inRange: s.inRange, clear: s.clear, blockedBy: s.blockedBy })),
    unsupportedSpanPoints: l.spanPoints.map(v3),
    socketSensitivity: socketSensitivity(l),
    plannerCrossValidation: {
      longRouteEdges: validateEdges(l.longPath),
      longRouteCornerLegs: validateCornerLegs(l.longPath),
      shortRouteEdges: validateEdges(l.shortPath),
      shortRouteCornerLegs: validateCornerLegs(l.shortPath),
      rejectedCellSample: validateRejections()
    }
  };
}

const ranked = [...allLayouts].sort((x, y) => (y.score - x.score)
  || (y.robustness.extraUnitsMargin - x.robustness.extraUnitsMargin)
  || (x.range - y.range));

const report = {
  probe: 'common-ground arena feasibility (pond footprint + proposed finite reference range)',
  generatedAt: new Date().toISOString(),
  status: 'PREPRODUCTION MEASUREMENT — proposed rules, not shipped behaviour',
  evaluates: ['arena-chapter-refinement.md (range 12)', 'arena-cinema-refinement.md (range 24)'],
  selectsWinner: false,
  derivation: 'source-derived, pristine procedural terrain; no render, GPU, browser, server or live voxel edit',
  conventionsInheritedFrom: 'geometry-pass2-probe.mts (rendered-cube gate + Amanatides-Woo DDA + measured sockets + trunk collider)',
  world: {
    planetSize: PLANET_SIZE, radiusCells: RADIUS_CELLS, storyCoordinate: STORY_COORDINATE,
    storySeed: STORY_SEED, worldId: STORY_PRIMARY_WORLD_ID, voxelScale: VOXEL_SCALE, voxelCount: voxels.length
  },
  workerRouteOptions: WORKER_ROUTE_OPTIONS,
  proposedPredicate: {
    note: 'finite reference range does NOT exist in the runtime; measured here as a proposed predicate only',
    rangeMeasuredBetween: 'socket-to-socket (actor socket to reference socket)',
    actorSocketAboveGroundedPose: ACTOR_SOCKET,
    fixedHeadSocket: FIXED_HEAD_SOCKET,
    playerHeldOrStandingReferenceSocket: PLAYER_REF_SOCKET,
    workerHeldReferenceSocket: WORKER_REF_SOCKET,
    socketProvenance: 'pass-2 Part A6, measured from AuditWorker.tsx / cubeGravityConstants.ts',
    clearSolidVisibility: 'rendered-cube terrain voxels + hero trunk CuboidCollider; canopy/fauna/player structures excluded'
  },
  acceptanceThresholds: {
    minExtraUnits: MIN_EXTRA_UNITS, minLengthRatio: MIN_LENGTH_RATIO,
    minContinuousUnsupportedSpanUnits: MIN_UNSUPPORTED_SPAN,
    minReciprocalSpanUnits: MIN_RECIPROCAL_SPAN,
    maxTracePoints: MAX_TRACE_POINTS, maxTraceLengthUnits: MAX_TRACE_LENGTH,
    anchorRadiusUnits: ANCHOR_RADIUS, witnessBodyRadiusClearance: BODY_RADIUS,
    capsRelaxed: false, cornersDecimated: false
  },
  pondTopology: {
    pondAnchorWorld: v3(pondAnchor), pondAnchorCell: [anchorCell.u, anchorCell.v],
    pondShoreWorld: v3(pond.shore), pondDepthAtAnchor: pond.depth,
    wetSeedCell: wetSeed ? [wetSeed.u, wetSeed.v] : null,
    connectedFootprintCells: footprintCells.length,
    footprintBoundsCells: footprintBounds,
    footprintWorldExtent: footprintBounds ? {
      x: [footprintBounds.uLo * VOXEL_SCALE, footprintBounds.uHi * VOXEL_SCALE],
      z: [footprintBounds.vLo * VOXEL_SCALE, footprintBounds.vHi * VOXEL_SCALE]
    } : null,
    maxDepthCells: footprintCells.length ? Math.max(...footprintCells.map(c => c.depth)) : 0,
    footprint: footprintCells.map(c => [c.u, c.v, c.depth]),
    dryBankNodesTouchingFootprint4Neighbour: bankIdx4.length,
    dryBankNodesWithin2CellsOfFootprint: bankIdx.length,
    bankNodesWithinAnchorRadius: endpointCandidates.length,
    twoBanksExist,
    twoBankEvidence: twoBanksExist ? {
      definition: 'a same-endpoint node-disjoint second dry route exists around the connected footprint',
      pairsWithDisjointAlternative: pairCandidates.length,
      largestMeasuredSecondBankDetourUnits: r2(pairCandidates[0].altLength! - pairCandidates[0].shortLength),
      example: {
        a: v3(nodes[pairCandidates[0].a].world), b: v3(nodes[pairCandidates[0].b].world),
        shortestUnits: r2(pairCandidates[0].shortLength), disjointAlternativeUnits: r2(pairCandidates[0].altLength!)
      }
    } : null,
    abortedForFutileSearch: !twoBanksExist
  },
  nodeField: {
    boundsCells: { uLo, uHi, vLo, vHi },
    walkableDryNodes: nodes.length,
    supportHeightHistogram: (() => { const h: Record<string, number> = {}; for (const c of nodes) h[String(c.h)] = (h[String(c.h)] ?? 0) + 1; return h; })(),
    connectivity: '4-neighbour, |dh| <= maxSlopeCells (matches agentSurfaceNavigation NEIGHBORS)',
    trunkGuardedNodes: trunkFootprintCells.length,
    trunkFootprintCells
  },
  searchBounds: {
    endpointPairsWithTwoBankRoutes: pairCandidates.length,
    endpointPairsMeetingDetourRuleOnTheSecondBank: pairsViable.length,
    endpointPairsSearched: pairsUsed.length,
    pairRejections,
    secondBankDetourCensus: pairCandidates.slice(0, 25).map(p => ({
      a: v3(nodes[p.a].world), b: v3(nodes[p.b].world),
      shortestUnits: r2(p.shortLength), disjointAlternativeUnits: r2(p.altLength!),
      extraUnits: r2(p.altLength! - p.shortLength), ratio: r2(p.altLength! / p.shortLength)
    })),
    instrumentCandidatesInPool: refPool.length, instrumentCandidatesUsed: refsUsed.length,
    referenceSelection: 'exhaustive over every dry node within the 24-unit pond-anchor envelope',
    combinationBudgetPerRange: MAX_COMBOS_PER_RANGE,
    cpuBudgetSeconds: CPU_BUDGET_SECONDS,
    abortedEarly: aborted
  },
  perRange: perRange.map(r => { const { _layouts, ...rest } = r as any; return rest; }),
  qualifyingLayoutsTotal: ranked.length,
  rankedLayouts: ranked.slice(0, 40).map((l, i) => ({ rank: i + 1, ...layoutReport(l, i < 2) })),
  plannerCrossValidationRepresentative: pairCandidates.length ? {
    note: 'no layout qualified, so the cross-check is run on the largest measured two-bank pair: its shortest dry route (positive edges), its node-disjoint second bank route (positive edges), and a sample of replica-rejected columns (negative edges)',
    pair: { a: v3(nodes[pairCandidates[0].a].world), b: v3(nodes[pairCandidates[0].b].world) },
    shortestRouteEdges: validateEdges(pairCandidates[0].shortPath),
    shortestRouteCornerLegs: validateCornerLegs(pairCandidates[0].shortPath),
    secondBankRouteEdges: validateEdges(pairCandidates[0].altPath!),
    secondBankRouteCornerLegs: validateCornerLegs(pairCandidates[0].altPath!),
    rejectedCellSample: validateRejections()
  } : null,
  stagesNeverReached: allLayouts.length ? [] : ['intermediate witness', 'reciprocal comparison span', 'ranking'],
  rankingBasis: 'worst-case normalised margin across every proposed constraint (extra units, ratio, span, out-of-range depth, in-range depth, witness margin, witness clearance, sample/length headroom, reciprocal span). No taste input; ties broken by extra-units margin then coordinates.',
  plannerCrossValidationNote: 'full positive/negative planner cross-validation is embedded in the top two ranked layouts',
  limitations: {
    liveWorldEdit: 'pristine procedural terrain only (generator.shouldVoxelExist / isWaterVoxel / lava). createLiveAgentSurfaceTerrain and player voxel edits can invalidate any span; live-edit confirmation still needs a running client and a contracted story-scoped debug hook',
    plannerTrunkBlindness: 'planAgentSurfaceRoute knows terrain voxels only; the hero trunk CuboidCollider is invisible to it (pass-2 Part B). Guarded here; still a shipped defect',
    notVisual: 'no render, GPU, readability, night/mobile/reduced-motion/lowest-tier evidence',
    notExhaustive: 'bounded deterministic search over the stated pair/reference caps',
    hysteresisNotSimulated: 'offer/occupancy hysteresis, hold/recovery and cylinder tolerances are not simulated; only world-space socket distance and solid line are tested'
  },
  cpuSeconds: r2(elapsed())
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
