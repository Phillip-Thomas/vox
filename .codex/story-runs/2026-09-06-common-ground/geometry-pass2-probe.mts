/**
 * Common Ground — geometry pass 2 (CPU only, read-only).
 *
 * Follow-up to geometry-feasibility-probe.mts. Does NOT modify or re-run the
 * pass-1 artifacts. Two jobs:
 *
 *   PART A  convention audit: voxel coordinate frame, column-top ceiling,
 *           rendered-terrain occluder set, socket heights derived from real
 *           body/prop geometry, DDA vs. the pass-1 point-sampled ray, and the
 *           necessity of pass-1's near-field exemption.
 *   PART B  reference-aware graph search on the SAME endpoints for two route
 *           classes: an outer route that is entirely clear to a fixed
 *           reference, and a shorter route that is occluded to that same
 *           reference and needs exactly one occupied intermediate witness.
 *
 * Node/edge legality replicates agentSurfaceNavigation.ts::cellAt exactly
 * (face 'top', u=x, v=z, height=y) and is then CROSS-CHECKED against the
 * shipped planAgentSurfaceRoute on every edge of the reported routes plus a
 * bounded sample of rejected cells. Occluders are the rendered terrain cube
 * (|coord| <= radiusCells, the same gate the planner uses for clearance) plus
 * the hero trunk collider. No canopy, no fauna, no invented collision.
 *
 * Reproduce (esbuild bundle; vite-node trips the captures/ ENOSPC trap):
 *
 *   cd /home/thomasphillip/Projects/vox/main
 *   TM=$PWD/node_modules/three
 *   ./node_modules/.bin/esbuild \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-pass2-probe.mts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/cg-pass2.mjs \
 *     "--alias:three=$TM/build/three.module.js" \
 *     "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
 *   node /tmp/cg-pass2.mjs > \
 *     ../.codex/story-runs/2026-09-06-common-ground/geometry-pass2.json
 */
import * as THREE from 'three';
import { createResolvedWorldGenerator } from '../../../main/src/utils/resolvedWorldGenerator.ts';
import { createStoryAnchorResolver, AUDIT_WORKER_GROUND_CLEARANCE } from '../../../main/src/story/world/storyAnchorResolver.ts';
import { STORY_SEED, STORY_PRIMARY_WORLD_ID, STORY_COORDINATE } from '../../../main/src/story/world/storyWorldIdentity.ts';
import { planAgentSurfaceRoute, type AgentSurfaceTerrainQuery } from '../../../main/src/utils/agentSurfaceNavigation.ts';
import { groundedSurfaceRouteLength } from '../../../main/src/utils/groundedSurfaceMotion.ts';
import { VOXEL_SCALE, voxelCoordToWorld, PLAYER_EYE_HEIGHT } from '../../../main/src/utils/cubeGravityConstants.ts';
import { buildTreeProfile } from '../../../main/src/utils/treeProfile.ts';

const t0 = Date.now();
const PLANET_SIZE = 50;                                   // EfficientScene.tsx::planetSize
const RADIUS_CELLS = Math.max(1, Math.floor(PLANET_SIZE / VOXEL_SCALE)); // agentSurfaceNavigation.ts:312 => 25
const UP = new THREE.Vector3(0, 1, 0);

// emergentStoryDirector.ts::moveAuditor — verbatim (unchanged from pass 1).
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
const MAX_JETPACK_WATER_DEPTH_CELLS = 2; // resolvedOptions default, used by cellAt's scan window

// chapter-story-treatment.md#proposed-bounded-trace-contract (unchanged, not relaxed)
const MAX_TRACE_POINTS = 128;
const MAX_TRACE_LENGTH = 120;
const SAMPLE_SPACING = 1.0;
const MIN_SAMPLE_SEPARATION = 0.25;

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

const tree = resolver.getHeroTreePose(PLANET_SIZE, STORY_SEED);
const pond = resolver.getPondPose(PLANET_SIZE, STORY_SEED);
const relay = resolver.getWreckRelayPose(PLANET_SIZE, STORY_SEED);
if (!pond) throw new Error('pass2: no pond pose on the pinned story world');
const heroProfile = buildTreeProfile((STORY_SEED ^ 0xede9) >>> 0);
const TRUNK_HEIGHT = Math.max(heroProfile.trunkHeight, 7.2);   // HeroAppleTree.tsx:79
const TRUNK_HALF = 0.55;                                       // HeroAppleTree.tsx:190
// AuditWorker.tsx:63 (constant inlined; the .tsx pulls react-three-fiber, which
// this CPU-only probe must not bundle). Verified by reading the source.
const AUDIT_WORKER_BOOT_SOLE_Y = -0.05;

// ---------------------------------------------------------------------------
// PART A — conventions, measured against the shipped functions
// ---------------------------------------------------------------------------
// A1. voxelCoordToWorld(x,y,z) = coord * VOXEL_SCALE  => voxel CENTRE.
//     Occupancy AABB is [c*S - S/2, c*S + S/2]; the exact inverse is round(w/S).
const a1 = (() => {
  const probe = voxelCoordToWorld(-13, 25, 11);
  const back = { x: Math.round(probe.x / VOXEL_SCALE), y: Math.round(probe.y / VOXEL_SCALE), z: Math.round(probe.z / VOXEL_SCALE) };
  return {
    convention: 'voxel coordinate maps to voxel CENTRE; occupancy AABB is centre +/- VOXEL_SCALE/2',
    sample: { coord: [-13, 25, 11], world: v3(probe), inverseRound: back },
    inverseIsExact: back.x === -13 && back.y === 25 && back.z === 11,
    groundedPoseOffsetAboveSupportCentre: AUDIT_WORKER_GROUND_CLEARANCE,
    groundedPoseOffsetAboveSupportTopFace: r2(AUDIT_WORKER_GROUND_CLEARANCE - VOXEL_SCALE / 2)
  };
})();

// A2. Socket heights derived from REAL geometry, expressed above the grounded
//     pose (the pose planAgentSurfaceRoute emits: support centre + 1.05).
const SOCKETS = {
  // AuditWorker.tsx: torso group y=1.3, visor mesh y=+0.55 => 1.85 above the
  // model root; the root sits at the grounded pose, sole at pose-0.05.
  workerVisor: 1.85,
  // torso centre (chest-mounted instrument plate)
  workerChest: 1.30,
  // straight-held arms, mesh centre y = 1.3 - 0.05
  workerHand: 1.25,
  // shipped player eye offset above a grounded pose
  // (cubeGravityConstants.ts + story/autopilotInteractionGaze.test.ts)
  playerEye: PLAYER_EYE_HEIGHT,
  // pass-1 probe's unsourced value, kept only for the A/B comparison
  pass1Assumed: 1.6
};
const REFERENCE_SOCKET_CANDIDATES = [0.6, 1.0, PLAYER_EYE_HEIGHT, 1.85];
const ACTOR_SOCKET = SOCKETS.workerVisor;
const REFERENCE_SOCKET = 1.85; // primary: matches the visor plane, level sightline

// A3. Column top: the planner scans h from RADIUS_CELLS down and treats a
//     support as exposed at h === RADIUS_CELLS. Pass 1 scanned to
//     floor(PLANET_SIZE/2)+6 = 31.
const PASS1_TOP_LIMIT = Math.floor(PLANET_SIZE / 2) + 6;
function shippedColumnTop(vx: number, vz: number): number | null {
  for (let h = RADIUS_CELLS; h >= 0; h--) {
    if (!terrain.isSolidVoxel(vx, h, vz)) continue;
    if (h < RADIUS_CELLS && terrain.isSolidVoxel(vx, h + 1, vz)) continue;
    return h;
  }
  return null;
}
function pass1ColumnTop(vx: number, vz: number): number | null {
  for (let y = PASS1_TOP_LIMIT; y >= 0; y--) if (terrain.isSolidVoxel(vx, y, vz)) return y;
  return null;
}

// Node legality — replica of agentSurfaceNavigation.ts::cellAt for face 'top'.
interface Cell { u: number; v: number; h: number; world: THREE.Vector3 }
const cellCache = new Map<string, Cell | null>();
function cellAt(u: number, v: number): Cell | null {
  const key = `${u},${v}`;
  const hit = cellCache.get(key);
  if (hit !== undefined) return hit;
  const h = shippedColumnTop(u, v);
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
// Line of sight — Amanatides & Woo DDA over voxel AABBs, rendered cube only,
// plus the hero trunk collider box. No canopy, no fauna, no new collision.
// ---------------------------------------------------------------------------
interface LosResult { clear: boolean; blockedBy: 'terrain' | 'trunk' | null; voxel: [number, number, number] | null; distance: number; selfColumnHit: boolean }
function trunkHit(a: THREE.Vector3, b: THREE.Vector3): boolean {
  const t = tree.position;
  const lo = { x: t.x - TRUNK_HALF, y: t.y, z: t.z - TRUNK_HALF };
  const hi = { x: t.x + TRUNK_HALF, y: t.y + TRUNK_HEIGHT, z: t.z + TRUNK_HALF };
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
  const isExempt = (x: number, y: number, z: number) =>
    exempt.some(e => e[0] === x && e[1] === y && e[2] === z);
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
// pass-1 ray: 0.35-unit point sampling, no rendered-cube gate, endpoints excluded
function pass1Ray(a: THREE.Vector3, b: THREE.Vector3): boolean {
  const steps = Math.ceil(a.distanceTo(b) / 0.35);
  for (let i = 1; i < steps; i++) {
    const p = a.clone().lerp(b, i / steps);
    if (terrain.isSolidVoxel(Math.round(p.x / VOXEL_SCALE), Math.round(p.y / VOXEL_SCALE), Math.round(p.z / VOXEL_SCALE))) return true;
  }
  return false;
}

/** Socket above a grounded pose, with its own support column exempted. */
function socket(cell: Cell, height: number) {
  return {
    point: cell.world.clone().addScaledVector(UP, height),
    exempt: [[cell.u, cell.h, cell.v], [cell.u, cell.h + 1, cell.v]] as Array<[number, number, number]>
  };
}
function witness(from: Cell, fromHeight: number, to: Cell, toHeight: number): LosResult {
  const a = socket(from, fromHeight);
  const b = socket(to, toHeight);
  return los(a.point, b.point, [...a.exempt, ...b.exempt]);
}

// ---------------------------------------------------------------------------
// Trace sampling rule — IDENTICAL to pass 1. No decimation, no relaxed caps.
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
// PART B — reference-aware graph search
// ---------------------------------------------------------------------------
// Endpoints: identical for both route classes, and identical to pass 1.
function nearestDryCell(seed: THREE.Vector3, maxRadius = 8, minDistance = 0): Cell | null {
  const su = Math.round(seed.x / VOXEL_SCALE);
  const sv = Math.round(seed.z / VOXEL_SCALE);
  for (let r = 0; r <= maxRadius; r++) {
    let best: { d: number; c: Cell } | null = null;
    for (let du = -r; du <= r; du++) for (let dv = -r; dv <= r; dv++) {
      if (Math.max(Math.abs(du), Math.abs(dv)) !== r) continue;
      const c = cellAt(su + du, sv + dv);
      if (!c) continue;
      const d = c.world.distanceTo(seed);
      if (d < minDistance) continue;
      if (!best || d < best.d) best = { d, c };
    }
    if (best) return best.c;
  }
  return null;
}
const startCell = nearestDryCell(tree.position, 8, 3);   // >=3 units clear of the trunk box
const endCell = nearestDryCell(pond.shore);
const relayCell = nearestDryCell(relay.position);
if (!startCell || !endCell || !relayCell) throw new Error('pass2: endpoints unresolved');

// Bounded node field around the corridor.
const MARGIN_CELLS = 14;
const uLo = Math.min(startCell.u, endCell.u) - MARGIN_CELLS;
const uHi = Math.max(startCell.u, endCell.u) + MARGIN_CELLS;
const vLo = Math.min(startCell.v, endCell.v) - MARGIN_CELLS;
const vHi = Math.max(startCell.v, endCell.v) + MARGIN_CELLS;
const nodes: Cell[] = [];
const nodeIndex = new Map<string, number>();
for (let u = uLo; u <= uHi; u++) for (let v = vLo; v <= vHi; v++) {
  const c = cellAt(u, v);
  if (!c) continue;
  nodeIndex.set(`${u},${v}`, nodes.length);
  nodes.push(c);
}
const NEIGHBORS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function edges(i: number): number[] {
  const c = nodes[i];
  const out: number[] = [];
  for (const [du, dv] of NEIGHBORS) {
    const j = nodeIndex.get(`${c.u + du},${c.v + dv}`);
    if (j === undefined) continue;
    if (Math.abs(nodes[j].h - c.h) > WORKER_ROUTE_OPTIONS.maxSlopeCells) continue;
    out.push(j);
  }
  return out;
}
/** Deterministic BFS (unit-cost 4-grid; cost order matches the planner's g). */
function bfs(fromIdx: number, toIdx: number, allowed: Uint8Array | null): Cell[] | null {
  const prev = new Int32Array(nodes.length).fill(-1);
  const seen = new Uint8Array(nodes.length);
  if (allowed && (!allowed[fromIdx] || !allowed[toIdx])) return null;
  const queue = [fromIdx];
  seen[fromIdx] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === toIdx) {
      const path: Cell[] = [];
      for (let n = cur; n !== -1; n = prev[n]) path.push(nodes[n]);
      return path.reverse();
    }
    for (const nx of edges(cur)) {
      if (seen[nx]) continue;
      if (allowed && !allowed[nx]) continue;
      seen[nx] = 1;
      prev[nx] = cur;
      queue.push(nx);
    }
  }
  return null;
}
const startIdx = nodeIndex.get(`${startCell.u},${startCell.v}`)!;
const endIdx = nodeIndex.get(`${endCell.u},${endCell.v}`)!;

// DEFECT GUARD: agentSurfaceNavigation only knows terrain voxels. The hero
// trunk is a separate CuboidCollider, so the grid can hand back a cell whose
// standing pose lies INSIDE the trunk box. Ban those cells and report them.
const trunkAllowed = new Uint8Array(nodes.length).fill(1);
const trunkFootprintCells: Array<Record<string, unknown>> = [];
for (let i = 0; i < nodes.length; i++) {
  const c = nodes[i];
  const insideXZ = Math.abs(c.world.x - tree.position.x) <= TRUNK_HALF && Math.abs(c.world.z - tree.position.z) <= TRUNK_HALF;
  const underTrunkTop = c.world.y <= tree.position.y + TRUNK_HEIGHT;
  if (insideXZ && underTrunkTop) {
    trunkAllowed[i] = 0;
    trunkFootprintCells.push({ cell: [c.u, c.v], supportVoxel: [c.u, c.h, c.v], world: v3(c.world) });
  }
}
function andTrunk(mask: Uint8Array | null): Uint8Array {
  const out = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) out[i] = (mask ? mask[i] : 1) && trunkAllowed[i] ? 1 : 0;
  return out;
}

function corners(path: Cell[]): THREE.Vector3[] {
  return path.map(c => c.world.clone());
}
function measure(path: Cell[]) {
  const pts = corners(path);
  const length = groundedSurfaceRouteLength(pts.map(position => ({ position })), UP);
  const samples = traceSamples(pts);
  return { pts, length, samples };
}
function evaluate(path: Cell[], ref: Cell, refHeight = REFERENCE_SOCKET) {
  const { pts, length, samples } = measure(path);
  const refSocket = socket(ref, refHeight);
  const lines = samples.map(p => {
    const a = p.clone().addScaledVector(UP, ACTOR_SOCKET);
    const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
    const sh = shippedColumnTop(su, sv);
    const exempt: Array<[number, number, number]> = sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
    return los(a, refSocket.point, [...exempt, ...refSocket.exempt]);
  });
  const blocked = lines.map((l, i) => ({ l, i })).filter(x => !x.l.clear);
  return {
    waypointCount: pts.length,
    walkedLength: r2(length),
    lengthWithinBudget: length <= MAX_TRACE_LENGTH,
    traceSampleCount: samples.length,
    pointsWithinBudget: samples.length <= MAX_TRACE_POINTS,
    witnessClearSamples: samples.length - blocked.length,
    witnessBlockedSamples: blocked.length,
    blockedByTerrain: blocked.filter(b => b.l.blockedBy === 'terrain').length,
    blockedByTrunk: blocked.filter(b => b.l.blockedBy === 'trunk').length,
    selfColumnHits: lines.filter(l => l.selfColumnHit).length,
    maxWitnessDistance: r2(Math.max(...lines.map(l => l.distance))),
    firstBlockedSample: blocked.length ? { index: blocked[0].i, position: v3(samples[blocked[0].i]) } : null,
    lastBlockedSample: blocked.length ? { index: blocked[blocked.length - 1].i, position: v3(samples[blocked[blocked.length - 1].i]) } : null,
    _samples: samples,
    _blockedIdx: blocked.map(b => b.i),
    _path: path
  };
}

// Fixed reference candidates: dry columns in the established tree/inspection
// corridor. Bounded, deterministic, reported rather than authored.
const refCandidates = nodes
  .filter(c => {
    const d = c.world.distanceTo(tree.position);
    return d >= 3 && d <= 24;
  })
  .sort((a, b) => (a.world.distanceTo(tree.position) - b.world.distanceTo(tree.position)) || (a.u - b.u) || (a.v - b.v))
  .slice(0, 96);

const shortPathTrunkTraversable = bfs(startIdx, endIdx, null);
const shortPath = bfs(startIdx, endIdx, trunkAllowed);
if (!shortPath || !shortPathTrunkTraversable) throw new Error('pass2: no route between the arena endpoints');
const shortPathCrossesTrunk = shortPathTrunkTraversable.some(c =>
  Math.abs(c.world.x - tree.position.x) <= TRUNK_HALF && Math.abs(c.world.z - tree.position.z) <= TRUNK_HALF);

interface Solution {
  reference: Cell;
  outer: ReturnType<typeof evaluate>;
  shorter: ReturnType<typeof evaluate>;
  clearNodeCount: number;
}
const solutions: Solution[] = [];
const refRejections = { startOrEndNotClearToReference: 0, noClearChain: 0, outerOverLength: 0, outerOverPoints: 0, outerNotLonger: 0, shorterNotOccluded: 0 };
for (const ref of refCandidates) {
  const allowed = new Uint8Array(nodes.length);
  let clearCount = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (witness(nodes[i], ACTOR_SOCKET, ref, REFERENCE_SOCKET).clear) { allowed[i] = 1; clearCount++; }
  }
  if (!allowed[startIdx] || !allowed[endIdx]) { refRejections.startOrEndNotClearToReference++; continue; }
  const outerPath = bfs(startIdx, endIdx, andTrunk(allowed));
  if (!outerPath) { refRejections.noClearChain++; continue; }
  const outer = evaluate(outerPath, ref);
  const shorter = evaluate(shortPath, ref);
  if (!outer.lengthWithinBudget) { refRejections.outerOverLength++; continue; }
  if (!outer.pointsWithinBudget) { refRejections.outerOverPoints++; continue; }
  if (outer.walkedLength <= shorter.walkedLength) { refRejections.outerNotLonger++; continue; }
  if (shorter.witnessBlockedSamples === 0) { refRejections.shorterNotOccluded++; continue; }
  solutions.push({ reference: ref, outer, shorter, clearNodeCount: clearCount });
}
// Deterministic ordering: shortest qualifying outer route first.
solutions.sort((a, b) => (a.outer.walkedLength - b.outer.walkedLength)
  || (a.reference.u - b.reference.u) || (a.reference.v - b.reference.v));

// --- intermediate witness for the shorter route's occluded bend -------------
const witnessRejections = { tooCloseToFixedReference: 0, cannotSeeOccludedSpan: 0, unreachable: 0, accepted: 0 };
function findWitnesses(sol: Solution, limit = 3) {
  const blockedPts = sol.shorter._blockedIdx.map(i => sol.shorter._samples[i]);
  if (!blockedPts.length) return [];
  const results: Array<Record<string, unknown>> = [];
  for (const w of nodes) {
    if (w.world.distanceTo(sol.reference.world) < 4) { witnessRejections.tooCloseToFixedReference++; continue; } // must be a DISTINCT reference
    const wSock = socket(w, REFERENCE_SOCKET);
    let ok = true;
    let maxD = 0;
    for (const p of blockedPts) {
      const a = p.clone().addScaledVector(UP, ACTOR_SOCKET);
      const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
      const sh = shippedColumnTop(su, sv);
      const exempt: Array<[number, number, number]> = sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
      const line = los(a, wSock.point, [...exempt, ...wSock.exempt]);
      if (!line.clear) { ok = false; break; }
      maxD = Math.max(maxD, line.distance);
    }
    if (!ok) { witnessRejections.cannotSeeOccludedSpan++; continue; }
    // The player must be able to stand there and offer it: reachable from the
    // shorter route under the same worker-legal grid.
    const wIdx = nodeIndex.get(`${w.u},${w.v}`)!;
    const reach = bfs(startIdx, wIdx, trunkAllowed);
    if (!reach) { witnessRejections.unreachable++; continue; }
    witnessRejections.accepted++;
    const { length: reachLen } = measure(reach);
    const minToTrace = Math.min(...blockedPts.map(p => w.world.distanceTo(p)));
    results.push({
      position: v3(w.world),
      supportVoxel: [w.u, w.h, w.v],
      maxLineOfReferenceDistance: r2(maxD),
      minDistanceToOccludedSpan: r2(minToTrace),
      distanceToFixedReference: r2(w.world.distanceTo(sol.reference.world)),
      walkedDistanceFromStartReference: r2(reachLen),
      coversAllOccludedSamples: true,
      _score: maxD
    });
  }
  results.sort((a, b) => (a.minDistanceToOccludedSpan as number) - (b.minDistanceToOccludedSpan as number));
  const clean = (r: Record<string, unknown>) => { const { _score, ...rest } = r; return rest; };
  const nearest = results[0];
  const farthest = results[results.length - 1];
  const mid = results[Math.floor(results.length / 2)];
  // deterministic: a clearly-positioned witness = the one standing OFF the
  // occluded span (>= 4 units) with the shortest walk from the start reference
  const offSpan = results.filter(r => (r.minDistanceToOccludedSpan as number) >= 4)
    .sort((a, b) => (a.walkedDistanceFromStartReference as number) - (b.walkedDistanceFromStartReference as number));
  return {
    acceptedCount: results.length,
    nearest: nearest ? clean(nearest) : null,
    median: mid ? clean(mid) : null,
    farthest: farthest ? clean(farthest) : null,
    clearlyPositionedOffSpan: offSpan.length ? clean(offSpan[0]) : null,
    firstN: results.slice(0, limit).map(clean)
  };
}

// --- shipped-planner cross validation --------------------------------------
function planLeg(a: THREE.Vector3, b: THREE.Vector3) {
  return planAgentSurfaceRoute(terrain, PLANET_SIZE, a, b, WORKER_ROUTE_OPTIONS);
}
function validateEdges(path: Cell[]) {
  let ok = 0; const failures: unknown[] = [];
  for (let i = 1; i < path.length; i++) {
    const r = planLeg(path[i - 1].world, path[i].world);
    const endsAtGoal = r.waypoints.length > 0 && r.waypoints[r.waypoints.length - 1].distanceTo(path[i].world) < 1e-3;
    if (r.mode === 'walk' && r.reason === 'dry-surface-path' && endsAtGoal) ok++;
    else if (r.mode === 'direct' && r.reason === 'already-at-resolved-goal') ok++;
    else if (failures.length < 5) failures.push({ from: v3(path[i - 1].world), to: v3(path[i].world), mode: r.mode, reason: r.reason });
  }
  return { edges: path.length - 1, plannerAccepted: ok, failures };
}
/** Straight runs between direction changes, re-planned by the shipped planner. */
function validateCornerLegs(path: Cell[]) {
  const cornerIdx = [0];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    if ((b.u - a.u) !== (c.u - b.u) || (b.v - a.v) !== (c.v - b.v)) cornerIdx.push(i);
  }
  cornerIdx.push(path.length - 1);
  let ok = 0; const failures: unknown[] = [];
  for (let i = 1; i < cornerIdx.length; i++) {
    const a = path[cornerIdx[i - 1]], b = path[cornerIdx[i]];
    const r = planLeg(a.world, b.world);
    const straightSame = r.mode === 'walk' && r.waypoints.length === Math.abs(b.u - a.u) + Math.abs(b.v - a.v) + 1;
    if (straightSame) ok++; else if (failures.length < 5) failures.push({ from: v3(a.world), to: v3(b.world), mode: r.mode, reason: r.reason, waypoints: r.waypoints.length });
  }
  return { legs: cornerIdx.length - 1, plannerAgreedStraight: ok, failures };
}

// Bounded check that the replica's REJECTIONS agree with the shipped planner:
// sample rejected cells adjacent to an accepted one and confirm the planner
// will not resolve a walk that terminates on them.
function validateRejections(limit = 60) {
  let checked = 0, agreed = 0; const disagreements: unknown[] = [];
  for (let u = uLo; u <= uHi && checked < limit; u += 3) {
    for (let v = vLo; v <= vHi && checked < limit; v += 3) {
      if (cellAt(u, v)) continue;
      let neighbour: Cell | null = null;
      for (const [du, dv] of NEIGHBORS) { const c = cellAt(u + du, v + dv); if (c) { neighbour = c; break; } }
      if (!neighbour) continue;
      const target = voxelCoordToWorld(u, pass1ColumnTop(u, v) ?? neighbour.h, v).addScaledVector(UP, AUDIT_WORKER_GROUND_CLEARANCE);
      const r = planLeg(neighbour.world, target);
      const landed = r.waypoints.length ? r.waypoints[r.waypoints.length - 1] : null;
      const landedOnRejected = !!landed && Math.round(landed.x / VOXEL_SCALE) === u && Math.round(landed.z / VOXEL_SCALE) === v;
      checked++;
      if (!landedOnRejected) agreed++;
      else if (disagreements.length < 5) disagreements.push({ cell: [u, v], mode: r.mode, reason: r.reason, landed: v3(landed!) });
    }
  }
  return { checked, agreed, disagreements };
}

// --- A/B: pass-1 ray & socket conventions vs. this pass ---------------------
function conventionDelta(sol: Solution | null) {
  const sample = (sol ? sol.outer._samples : traceSamples(corners(shortPath))).filter((_, i) => i % 2 === 0);
  const ref = sol ? sol.reference : startCell;
  const refPoint = socket(ref, REFERENCE_SOCKET).point;
  let ddaBlocked = 0, pass1Blocked = 0, disagree = 0, outsideCubeOnly = 0, selfColumn = 0;
  for (const p of sample) {
    const a = p.clone().addScaledVector(UP, ACTOR_SOCKET);
    const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
    const sh = shippedColumnTop(su, sv);
    const exempt: Array<[number, number, number]> = sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
    const d = los(a, refPoint, [...exempt, ...socket(ref, REFERENCE_SOCKET).exempt]);
    const p1a = p.clone().addScaledVector(UP, SOCKETS.pass1Assumed);
    const p1b = ref.world.clone().addScaledVector(UP, SOCKETS.pass1Assumed);
    const p1 = pass1Ray(p1a, p1b);
    if (!d.clear) ddaBlocked++;
    if (p1) pass1Blocked++;
    if (d.selfColumnHit) selfColumn++;
    if ((!d.clear) !== p1) disagree++;
    if (d.blockedBy === 'terrain' && d.voxel && Math.max(Math.abs(d.voxel[0]), Math.abs(d.voxel[1]), Math.abs(d.voxel[2])) > RADIUS_CELLS) outsideCubeOnly++;
  }
  return { comparedLines: sample.length, ddaBlocked, pass1PointSampledBlocked: pass1Blocked, disagreements: disagree, blockersOutsideRenderedCube: outsideCubeOnly, linesHittingOwnSupportColumn: selfColumn };
}

// Column-top ceiling delta over the node field.
const topDelta = (() => {
  let differing = 0, columns = 0;
  for (let u = uLo; u <= uHi; u++) for (let v = vLo; v <= vHi; v++) {
    const s = shippedColumnTop(u, v);
    const p = pass1ColumnTop(u, v);
    if (s === null && p === null) continue;
    columns++;
    if (s !== p) differing++;
  }
  return { columnsCompared: columns, columnsWhereCeilingDiffers: differing, pass1ScanCeiling: PASS1_TOP_LIMIT, shippedScanCeiling: RADIUS_CELLS };
})();

const solutionTable = solutions.map(s => ({
  fixedReference: v3(s.reference.world),
  supportVoxel: [s.reference.u, s.reference.h, s.reference.v],
  distanceToTree: r2(s.reference.world.distanceTo(tree.position)),
  referenceClearNodes: s.clearNodeCount,
  outerLength: s.outer.walkedLength,
  outerSamples: s.outer.traceSampleCount,
  outerBlocked: s.outer.witnessBlockedSamples,
  shorterLength: s.shorter.walkedLength,
  shorterSamples: s.shorter.traceSampleCount,
  shorterBlocked: s.shorter.witnessBlockedSamples,
  shorterBlockedByTerrain: s.shorter.blockedByTerrain,
  shorterBlockedByTrunk: s.shorter.blockedByTrunk,
  detourExtraUnits: r2(s.outer.walkedLength - s.shorter.walkedLength)
}));
// Terrain occlusion is the legible class (pass 1 measured the 1.1-unit trunk as
// a sub-degree knife edge). Report the best terrain-occluded candidate too.
const terrainOccluded = solutions.filter(s => s.shorter.blockedByTerrain > 0);
const renderedCeilingCheck = (() => {
  let columnsWithLogicalVoxelsAboveCube = 0;
  const examples: unknown[] = [];
  for (let u = uLo; u <= uHi; u++) for (let v = vLo; v <= vHi; v++) {
    const p1 = pass1ColumnTop(u, v);
    if (p1 !== null && p1 > RADIUS_CELLS) {
      columnsWithLogicalVoxelsAboveCube++;
      if (examples.length < 5) examples.push({ cell: [u, v], pass1Top: p1, shippedTop: shippedColumnTop(u, v), solidAt26: terrain.isSolidVoxel(u, 26, v), solidAt27: terrain.isSolidVoxel(u, 27, v) });
    }
  }
  return {
    note: 'generator.shouldVoxelExist is not clipped to the rendered cube; agentSurfaceNavigation gates it with insideRenderedTerrain, pass 1\'s ray did not',
    columnsWithLogicalVoxelsAboveCube,
    examples
  };
})();
const best = solutions[0] ?? null;
const bestTerrain = terrainOccluded[0] ?? null;
const witnesses = best ? findWitnesses(best) : [];
const witnessesTerrain = bestTerrain && bestTerrain !== best ? findWitnesses(bestTerrain) : witnesses;
// Socket sensitivity for the reported solution (does the answer survive other
// plausible socket heights?).
const socketSensitivity = best
  ? REFERENCE_SOCKET_CANDIDATES.map(hRef => {
    const outer = evaluate(best.outer._path, best.reference, hRef);
    const shorter = evaluate(shortPath, best.reference, hRef);
    return {
      referenceSocketHeight: hRef,
      actorSocketHeight: ACTOR_SOCKET,
      outerFullyClear: outer.witnessBlockedSamples === 0,
      outerBlockedSamples: outer.witnessBlockedSamples,
      shorterBlockedSamples: shorter.witnessBlockedSamples,
      distinctionHolds: outer.witnessBlockedSamples === 0 && shorter.witnessBlockedSamples > 0
    };
  })
  : [];

const strip = (e: ReturnType<typeof evaluate> | null) => {
  if (!e) return null;
  const { _samples, _blockedIdx, _path, ...rest } = e;
  return { ...rest, occludedSampleIndices: _blockedIdx.slice(0, 40), occludedSampleCount: _blockedIdx.length };
};

const report = {
  probe: 'common-ground geometry pass 2 (reference-aware)',
  generatedAt: new Date().toISOString(),
  supersedes: null,
  relationToPass1: 'independent follow-up; pass-1 artifacts unmodified',
  derivation: 'source-derived (pristine procedural terrain; no live voxel edits, no render, no GPU, no server)',
  world: {
    planetSize: PLANET_SIZE, radiusCells: RADIUS_CELLS, storyCoordinate: STORY_COORDINATE,
    storySeed: STORY_SEED, worldId: STORY_PRIMARY_WORLD_ID, voxelScale: VOXEL_SCALE, voxelCount: voxels.length
  },
  workerRouteOptions: WORKER_ROUTE_OPTIONS,
  traceContract: { maxPoints: MAX_TRACE_POINTS, maxLengthUnits: MAX_TRACE_LENGTH, sampleSpacing: SAMPLE_SPACING, minSeparation: MIN_SAMPLE_SEPARATION, capsRelaxed: false, cornersDecimated: false },
  conventionAudit: {
    voxelFrame: a1,
    socketHeightsAboveGroundedPose: { ...SOCKETS, bootSoleLocalY: AUDIT_WORKER_BOOT_SOLE_Y, chosenActorSocket: ACTOR_SOCKET, chosenReferenceSocket: REFERENCE_SOCKET, referenceSocketCandidates: REFERENCE_SOCKET_CANDIDATES },
    columnTopCeiling: topDelta,
    occluderSet: {
      terrain: 'solid voxels with max(|x|,|y|,|z|) <= radiusCells (the planner\'s insideRenderedTerrain gate)',
      structure: 'hero trunk CuboidCollider 1.1 x 1.1 x ' + r2(TRUNK_HEIGHT) + ' (HeroAppleTree.tsx:190)',
      excluded: ['canopy instances (no collider)', 'fauna/grass', 'player-built StructureField pieces (not procedural)', 'logical voxels outside the rendered cube']
    },
    rayCasting: { method: 'Amanatides-Woo DDA over voxel AABBs (centre +/- 1.0)', pass1Method: '0.35-unit point sampling, round() to voxel, no rendered-cube gate' },
    nearFieldHandling: { pass1: 'blanket 3.0-unit horizontal exemption, counted separately', pass2: 'exempt only the two endpoint support columns (support voxel and the voxel above it)' }
  },
  endpoints: {
    sharedByBothRouteClasses: true,
    startReferenceAtTree: { world: v3(startCell.world), supportVoxel: [startCell.u, startCell.h, startCell.v], distanceToTrunkAxis: r2(startCell.world.distanceTo(tree.position)) },
    endReferenceOnPondShore: { world: v3(endCell.world), supportVoxel: [endCell.u, endCell.h, endCell.v] },
    approachReferenceNearRelay: { world: v3(relayCell.world), supportVoxel: [relayCell.u, relayCell.h, relayCell.v] },
    straightDistance: r2(startCell.world.distanceTo(endCell.world)),
    heroTree: { position: v3(tree.position), trunkHeight: r2(TRUNK_HEIGHT), trunkColliderHalfExtentXZ: TRUNK_HALF },
    pondShore: v3(pond.shore)
  },
  plannerTrunkBlindness: {
    finding: 'planAgentSurfaceRoute knows terrain voxels only; the hero trunk CuboidCollider is invisible to it',
    trunkFootprintCellsInsideNodeField: trunkFootprintCells,
    unrestrictedShortestRouteWalksThroughTrunk: shortPathCrossesTrunk,
    consequence: 'without this guard the shorter route\'s only witness break is the actor standing INSIDE the trunk box, which no reference can see and which is not a legible occlusion',
    guardApplied: 'cells whose grounded pose lies inside the trunk XZ box below the trunk top are banned from both route classes'
  },
  nodeField: { boundsCells: { uLo, uHi, vLo, vHi }, walkableDryNodes: nodes.length,
    supportHeightHistogram: (() => { const h: Record<string, number> = {}; for (const c of nodes) h[String(c.h)] = (h[String(c.h)] ?? 0) + 1; return h; })(),
    reliefNote: 'a single dominant support height means the arena corridor is the flat cube-face plateau: no terrain relief is available to occlude a level sightline', connectivity: '4-neighbour, |dh| <= maxSlopeCells (matches agentSurfaceNavigation NEIGHBORS)' },
  referenceCandidatesEvaluated: refCandidates.length,
  referenceRejections: refRejections,
  qualifyingSolutions: solutions.length,
  solution: best ? {
    fixedReference: { world: v3(best.reference.world), supportVoxel: [best.reference.u, best.reference.h, best.reference.v], socketHeight: REFERENCE_SOCKET, socketWorld: v3(socket(best.reference, REFERENCE_SOCKET).point), distanceToTree: r2(best.reference.world.distanceTo(tree.position)), referenceClearNodes: best.clearNodeCount },
    outerRoute: strip(best.outer),
    outerRouteWaypoints: best.outer._path.map(c => v3(c.world)),
    shorterRoute: strip(best.shorter),
    shorterRouteWaypoints: shortPath.map(c => v3(c.world)),
    intermediateWitnessCandidates: witnesses,
    savedWitnessRequirementIsDistinct: best.outer.witnessBlockedSamples === 0 && best.shorter.witnessBlockedSamples > 0
  } : null,
  solutionTable,
  terrainOccludedSolution: bestTerrain ? {
    fixedReference: { world: v3(bestTerrain.reference.world), supportVoxel: [bestTerrain.reference.u, bestTerrain.reference.h, bestTerrain.reference.v], socketHeight: REFERENCE_SOCKET, socketWorld: v3(socket(bestTerrain.reference, REFERENCE_SOCKET).point), distanceToTree: r2(bestTerrain.reference.world.distanceTo(tree.position)) },
    outerRoute: strip(bestTerrain.outer),
    outerRouteWaypoints: bestTerrain.outer._path.map(c => v3(c.world)),
    shorterRoute: strip(bestTerrain.shorter),
    intermediateWitnessCandidates: witnessesTerrain,
    plannerCrossValidation: { outerRouteEdges: validateEdges(bestTerrain.outer._path), outerRouteCornerLegs: validateCornerLegs(bestTerrain.outer._path) }
  } : null,
  witnessSearchRejections: witnessRejections,
  renderedCeilingCheck,
  alternateSolutions: solutions.slice(1, 5).map(s => ({
    fixedReference: v3(s.reference.world),
    outerLength: s.outer.walkedLength,
    outerSamples: s.outer.traceSampleCount,
    outerBlocked: s.outer.witnessBlockedSamples,
    shorterBlocked: s.shorter.witnessBlockedSamples
  })),
  socketSensitivity,
  plannerCrossValidation: best ? {
    outerRouteEdges: validateEdges(best.outer._path),
    outerRouteCornerLegs: validateCornerLegs(best.outer._path),
    shorterRouteEdges: validateEdges(shortPath),
    shorterRouteCornerLegs: validateCornerLegs(shortPath),
    rejectedCellSample: validateRejections()
  } : { shorterRouteEdges: validateEdges(shortPath), rejectedCellSample: validateRejections() },
  conventionDeltaVsPass1: conventionDelta(best),
  budgetBoundReached: best ? {
    outerWalkedLength: best.outer.walkedLength,
    outerTraceSamples: best.outer.traceSampleCount,
    lengthHeadroomUnits: r2(MAX_TRACE_LENGTH - best.outer.walkedLength),
    pointHeadroomSamples: MAX_TRACE_POINTS - best.outer.traceSampleCount,
    bindingBound: best.outer.traceSampleCount / MAX_TRACE_POINTS >= best.outer.walkedLength / MAX_TRACE_LENGTH ? 'points' : 'length'
  } : null,
  cpuSeconds: r2((Date.now() - t0) / 1000)
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
