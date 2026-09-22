/**
 * Common Ground — STAGED-POSE qualification (CPU only, read-only).
 *
 * Shell COPY of head-geometry-qualification.mts (preserved untouched) with the
 * MINIMAL staged-pose patches commissioned by the Cinematography Director:
 *   (i)  a worker-held reference pose H = (-40, 51.05, 12), distinct from and
 *        adjacent to the comparison start E = (-42, 51.05, 12). Terra's E->C
 *        comparison is witnessed from the worker socket at H + 1.85, NOT at
 *        E + 1.85, so the worker is out of her body when she starts.
 *   (ii) the two positioning legs are measured as real dry body paths on the
 *        live-source planner/solid guard: E->H before the comparison, and
 *        H->E after she completes and occupies the existing far reference
 *        T = (-44, 51.05, 12). The returning worker on H->E must be supported
 *        from Terra's socket at T + 1.35 with body clearance >= 1 throughout.
 *   (iii) positioning legs NEVER count as common proof. The final independent
 *        test is unchanged: the FULL E->C traversal witnessed from the separate
 *        far Terra socket at T + 1.35.
 * Everything else — solids, contact rule, ranges, LOS, dryness, clearance
 * predicates, thresholds, short/long survey routes, witness tests — is
 * inherited verbatim. Metrics that H changes are reported as changed, not as
 * "byte-identical".
 *
 * NOTE ON PROVENANCE: the previous study proved full-range LOS from a socket
 * held at E. It did NOT prove near-body clearance between the worker and the
 * player. That is a NEW property measured here for the first time.
 *
 * Inherited from head-geometry-qualification.mts, itself a copy of
 * selected-geometry-qualification.mts (preserved, byte-identical) with
 * exactly two changes commissioned by the Cinematography Director:
 *   (a) the literal HEAD CAP solid, world AABB
 *       lo(-34.20, 52.25, 19.80) hi(-33.80, 52.35, 20.20), i.e. the stand
 *       footprint raised from the stand cap (grounded+1.20) to the fixed
 *       reference plane (grounded+1.30). The fixed socket (-34, 52.35, 20)
 *       lies ON its exposed top surface; nothing is modelled above that plane
 *       (etched flat mark only).
 *   (b) the GENERAL surface-contact rule for reference rays, symmetric at both
 *       endpoints and applied to EVERY box with no object-specific exemption:
 *       endpoint-only contact is harmless iff the adjacent open segment stays
 *       outside the solid; any interior crossing blocks.
 * Walk collision stays inclusive (segmentHitsBox); only the ray test uses the
 * open-segment predicate. All other constants, thresholds, paths, grounding
 * and predicates are unchanged.
 *
 * Exactly ONE candidate. No search, no fallback scan, no winner selection.
 * Candidate = geometry-instrument.json ranges[range=12].top3[0]:
 *   fixed apparatus R grounded (-34, 51.05, 20), yaw 90 (quarter turn k=1),
 *   S(-26,51.05,12)  E(-42,51.05,12)  C(-48,51.05,12)
 *   intermediate witness SHIFTED by commission to W(-34,51.05,10) (was z=11)
 *   Terra final witness fixed at the existing JSON pose (-44,51.05,12)
 *
 * Adds the commissioned literal STAND + BRACKET solids (entirely below
 * grounded+1.20, i.e. below every ray socket) and includes them, with NO
 * exemption, in the walk mask, the walked-segment test and every ray.
 *
 * Nothing here is shipped behaviour. Finite reference range, the opaque
 * backing, the stand and the bracket do not exist in the runtime. No source,
 * canon, validator, signature, worldgen, render, GPU, browser or server is
 * touched. No threshold is added or relaxed.
 *
 * Terrain / DDA / trace / socket / pose conventions inherited VERBATIM from
 * geometry-instrument-probe.mts (itself from geometry-arena / geometry-pass2).
 *
 * Reproduce (exact):
 *   cd /home/thomasphillip/Projects/vox/main
 *   TM=$PWD/node_modules/three
 *   ./node_modules/.bin/esbuild \
 *     ../.codex/story-runs/2026-09-06-common-ground/staged-geometry-qualification.mts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/cg-staged.mjs \
 *     "--alias:three=$TM/build/three.module.js" \
 *     "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
 *   node /tmp/cg-staged.mjs > \
 *     ../.codex/story-runs/2026-09-06-common-ground/staged-geometry-qualification.json
 */
import * as THREE from 'three';
import { createResolvedWorldGenerator } from '../../../main/src/utils/resolvedWorldGenerator.ts';
import { createStoryAnchorResolver, AUDIT_WORKER_GROUND_CLEARANCE } from '../../../main/src/story/world/storyAnchorResolver.ts';
import { STORY_SEED, STORY_PRIMARY_WORLD_ID, STORY_COORDINATE } from '../../../main/src/story/world/storyWorldIdentity.ts';
import { type AgentSurfaceTerrainQuery } from '../../../main/src/utils/agentSurfaceNavigation.ts';
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

// --- unchanged caps / thresholds (verbatim; none added, none relaxed) -------
const MAX_TRACE_POINTS = 128;
const MAX_TRACE_LENGTH = 120;
const SAMPLE_SPACING = 1.0;
const MIN_SAMPLE_SEPARATION = 0.25;
const MIN_EXTRA_UNITS = 12;
const MIN_LENGTH_RATIO = 1.25;
const MIN_UNSUPPORTED_SPAN = 6;
const BODY_RADIUS = PLAYER_CAPSULE_RADIUS;            // 0.5
const BODY_BODY_CLEARANCE = BODY_RADIUS * 2;          // 1.0
const TERRA_LATERAL_MIN = 2.0;
const OCCUPY_R = 1.25, OCCUPY_Y = 0.6;
const RELEASE_R = 1.75, RELEASE_Y = 0.9;
const MAX_TOPFACE_CELL = 24;
const RANGE = 12;                                      // nominated range, unchanged
const CPU_BUDGET_SECONDS = 60;
/** Reporting-only densification of walked segments (not a threshold). */
const SEGMENT_DENSE_SPACING = 0.25;

// --- sockets, measured from current source ---------------------------------
const WORKER_SOCKET = 1.85;          // AuditWorker torso 1.30 + visor 0.55
const PLAYER_SOCKET = PLAYER_EYE_HEIGHT; // 1.35
const FIXED_APPARATUS_SOCKET = 1.30; // the ACTUAL fixed reference plate height
const WORKER_BODY_HEIGHT = 2.01;
const PLAYER_BODY_HEIGHT = PLAYER_STANDING_HEIGHT; // 3.6

const APPARATUS = {
  socketLocal: { x: 0, y: FIXED_APPARATUS_SOCKET, z: 0 },
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

// --- COMMISSIONED literal below-socket solids (local frame, R ground = 0) ---
// Cap: grounded + 1.20 = below the LOWEST ray socket (fixed plate at 1.30).
const SOLID_CAP_LOCAL_Y = 1.20;
// Head-support post: directly under the fixed socket column, 0.40 x 0.40.
const STAND_LOCAL = { lo: { x: -0.20, y: 0.00, z: -0.20 }, hi: { x: 0.20, y: SOLID_CAP_LOCAL_Y, z: 0.20 } };
// Bracket tie: from the backing plane (x = -0.96, the board's outer face) to
// inside the post; 0.40 vertical thickness, top flush with the post cap.
const BRACKET_LOCAL = { lo: { x: -0.96, y: 0.80, z: -0.20 }, hi: { x: -0.10, y: SOLID_CAP_LOCAL_Y, z: 0.20 } };
// COMMISSIONED HEAD CAP: stand footprint, from the stand cap up to the fixed
// reference plane. Its top face IS the exposed surface the socket sits on.
const HEAD_CAP_TOP_LOCAL_Y = FIXED_APPARATUS_SOCKET;  // 1.30, no new threshold
const CAP_LOCAL = { lo: { x: -0.20, y: SOLID_CAP_LOCAL_Y, z: -0.20 }, hi: { x: 0.20, y: HEAD_CAP_TOP_LOCAL_Y, z: 0.20 } };

const CANDIDATE = {
  centreCell: [-17, 25, 10] as [number, number, number],
  centreWorldXZ: [-34, 20] as [number, number],
  quarterTurns: 1,
  yawDegrees: 90,
  S: [-26, 12] as [number, number],
  E: [-42, 12] as [number, number],
  C: [-48, 12] as [number, number],
  H: [-40, 12] as [number, number],   // STAGED worker-held reference, adjacent to E
  W: [-34, 10] as [number, number],   // COMMISSION SHIFT (nominal was z = 11)
  WNominal: [-34, 11] as [number, number],
  terra: [-44, 12] as [number, number]
};

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

// --- terrain conventions (verbatim) ----------------------------------------
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

// --- line of sight (verbatim DDA + boxes) ----------------------------------
type Box = { lo: Record<'x' | 'y' | 'z', number>; hi: Record<'x' | 'y' | 'z', number> };
type NamedBox = Box & { name: string };
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
/**
 * Parametric slab interval of the INFINITE line through a,b against the box,
 * unclamped. null when the line misses the box entirely. A zero-length
 * interval means the segment only grazes/touches the box.
 */
function boxInterval(a: THREE.Vector3, b: THREE.Vector3, lo: Box['lo'], hi: Box['hi']): { tmin: number; tmax: number } | null {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  let tmin = -Infinity, tmax = Infinity;
  for (const ax of ['x', 'y', 'z'] as const) {
    const dd = d[ax];
    if (dd === 0) { if (a[ax] < lo[ax] || a[ax] > hi[ax]) return null; continue; }
    let t1 = (lo[ax] - a[ax]) / dd;
    let t2 = (hi[ax] - a[ax]) / dd;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return { tmin, tmax };
}
/**
 * GENERAL surface-contact rule for reference rays (symmetric at both
 * endpoints, no per-object exemption, NO spatial epsilon):
 * blocked iff the OPEN segment (0,1) spends positive parameter length inside
 * the box. Contact confined to t=0 or t=1 (an endpoint resting on a face) is
 * harmless. Exact arithmetic only, so a 0.12-thick slab still blocks.
 * Documented consequence: a segment lying IN a face plane (tangency) yields a
 * positive-length interval from the other two slabs and therefore BLOCKS.
 */
function segmentCrossesBoxOpen(a: THREE.Vector3, b: THREE.Vector3, lo: Box['lo'], hi: Box['hi']): boolean {
  const iv = boxInterval(a, b, lo, hi);
  if (!iv) return false;
  return Math.min(iv.tmax, 1) > Math.max(iv.tmin, 0);
}
function segmentTouchesBoxAtEndpointOnly(a: THREE.Vector3, b: THREE.Vector3, lo: Box['lo'], hi: Box['hi']): boolean {
  const iv = boxInterval(a, b, lo, hi);
  if (!iv) return false;
  if (Math.min(iv.tmax, 1) > Math.max(iv.tmin, 0)) return false;
  return Math.min(iv.tmax, 1) >= Math.max(iv.tmin, 0);
}
function trunkBox(inflate = 0): Box {
  const t = tree.position;
  return {
    lo: { x: t.x - TRUNK_HALF - inflate, y: t.y - inflate, z: t.z - TRUNK_HALF - inflate },
    hi: { x: t.x + TRUNK_HALF + inflate, y: t.y + TRUNK_HEIGHT + inflate, z: t.z + TRUNK_HALF + inflate }
  };
}
function los(a: THREE.Vector3, b: THREE.Vector3, exempt: Array<[number, number, number]>, boxes: NamedBox[]) {
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
  if (segmentCrossesBoxOpen(a, b, tb.lo, tb.hi)) return { clear: false, blockedBy: 'trunk', distance: r2(distance) };
  for (const bx of boxes) {
    if (segmentCrossesBoxOpen(a, b, bx.lo, bx.hi)) return { clear: false, blockedBy: bx.name, distance: r2(distance) };
  }
  return { clear: true, blockedBy: null as string | null, distance: r2(distance) };
}
function exemptAt(p: THREE.Vector3): Array<[number, number, number]> {
  const su = Math.round(p.x / VOXEL_SCALE), sv = Math.round(p.z / VOXEL_SCALE);
  const sh = columnTop(su, sv);
  return sh === null ? [] : [[su, sh, sv], [su, sh + 1, sv]];
}
interface Support { distance: number; inRange: boolean; clear: boolean; blockedBy: string | null; supported: boolean }
function supportPoint(actorGround: THREE.Vector3, actorH: number, refSocket: THREE.Vector3,
  refGround: THREE.Vector3, range: number, boxes: NamedBox[]): Support {
  const a = actorGround.clone().addScaledVector(UP, actorH);
  const distance = a.distanceTo(refSocket);
  if (distance > range) return { distance: r2(distance), inRange: false, clear: false, blockedBy: 'out-of-range', supported: false };
  const l = los(a, refSocket, [...exemptAt(actorGround), ...exemptAt(refGround)], boxes);
  return { distance: r2(distance), inRange: true, clear: l.clear, blockedBy: l.blockedBy, supported: l.clear };
}

// --- trace sampling (verbatim, undecimated) --------------------------------
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
/** Reporting-only: dense points covering the whole walked polyline (segments). */
function densePoints(points: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [points[0].clone()];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.ceil(len / SEGMENT_DENSE_SPACING));
    for (let s = 1; s <= n; s++) out.push(a.clone().lerp(b, s / n));
  }
  return out;
}

// --- node field (verbatim) -------------------------------------------------
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
const trunkAllowed = new Uint8Array(nodes.length).fill(1);
{
  const box = trunkBox(BODY_RADIUS);
  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i];
    if (c.world.x >= box.lo.x && c.world.x <= box.hi.x && c.world.z >= box.lo.z && c.world.z <= box.hi.z) trunkAllowed[i] = 0;
  }
}
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
function rot(k: number, x: number, z: number): [number, number] {
  if (k === 0) return [x, z];
  if (k === 1) return [-z, x];
  if (k === 2) return [-x, -z];
  return [z, -x];
}
interface Pose { world: THREE.Vector3; cell: Cell; clear: boolean; minNeighbourDy: number }
function groundedPose(x: number, z: number): Pose | null {
  const u = Math.round(x / VOXEL_SCALE), v = Math.round(z / VOXEL_SCALE);
  if (Math.max(Math.abs(u), Math.abs(v)) > MAX_TOPFACE_CELL) return null;
  const c = cellAt(u, v);
  if (!c) return null;
  const idx = nodeIndex.get(`${u},${v}`);
  if (idx === undefined || !trunkAllowed[idx]) return null;
  let clear = true, maxDy = 0;
  for (const [du, dv] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
    const nx = (u + du) * VOXEL_SCALE, nz = (v + dv) * VOXEL_SCALE;
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

// ===========================================================================
// THE ONE CANDIDATE
// ===========================================================================
const k = CANDIDATE.quarterTurns;
const failures: string[] = [];
const note = (ok: boolean, msg: string) => { if (!ok) failures.push(msg); return ok; };

const Rp = groundedPose(CANDIDATE.centreWorldXZ[0], CANDIDATE.centreWorldXZ[1]);
if (!Rp) { process.stdout.write(JSON.stringify({ fatal: 'candidate R does not ground' }) + '\n'); process.exit(0); }
const poseAt = (xz: [number, number]) => groundedPose(xz[0], xz[1]);
const poses: Record<string, Pose | null> = {
  R: Rp, S: poseAt(CANDIDATE.S), E: poseAt(CANDIDATE.E), C: poseAt(CANDIDATE.C),
  H: poseAt(CANDIDATE.H),
  W: poseAt(CANDIDATE.W), WNominal: poseAt(CANDIDATE.WNominal), T: poseAt(CANDIDATE.terra)
};
const grounding = Object.fromEntries(Object.entries(poses).map(([key, p]) => [key, p ? {
  world: v3(p.world), supportVoxel: [p.cell.u, p.cell.h, p.cell.v],
  matchesRequestedY: Math.abs(p.world.y - 51.05) < 1e-6,
  bodyDiscFullySupported: p.clear, maxNeighbourStepUnits: r2(p.minNeighbourDy),
  groundClearanceUsed: AUDIT_WORKER_GROUND_CLEARANCE
} : null]));
for (const key of ['R', 'S', 'E', 'C', 'H', 'W', 'T']) {
  note(!!poses[key], `pose ${key} does not ground on actual terrain`);
  note(!!poses[key] && poses[key]!.clear, `pose ${key} body disc not fully supported`);
}

// --- world-space solids (quarter turns keep boxes axis-aligned) ------------
const c0 = Rp.world;
function place(local: Box, name: string): NamedBox {
  const a = rot(k, local.lo.x, local.lo.z);
  const b = rot(k, local.hi.x, local.hi.z);
  return {
    name,
    lo: { x: c0.x + Math.min(a[0], b[0]), y: c0.y + local.lo.y, z: c0.z + Math.min(a[1], b[1]) },
    hi: { x: c0.x + Math.max(a[0], b[0]), y: c0.y + local.hi.y, z: c0.z + Math.max(a[1], b[1]) }
  };
}
const backing = place({ lo: BACK_LO, hi: BACK_HI }, 'backing');
const stand = place(STAND_LOCAL, 'stand');
const bracket = place(BRACKET_LOCAL, 'bracket');
const headCap = place(CAP_LOCAL, 'cap');
const SOLIDS: NamedBox[] = [backing, stand, bracket, headCap];   // NO exemption for any
const refSocket = new THREE.Vector3(c0.x, c0.y + FIXED_APPARATUS_SOCKET, c0.z);
const solidCapY = c0.y + SOLID_CAP_LOCAL_Y;
const headCapTopY = c0.y + HEAD_CAP_TOP_LOCAL_Y;

const boxReport = (b: NamedBox) => ({
  name: b.name,
  lo: { x: r2(b.lo.x), y: r2(b.lo.y), z: r2(b.lo.z) },
  hi: { x: r2(b.hi.x), y: r2(b.hi.y), z: r2(b.hi.z) },
  sizeUnits: { x: r2(b.hi.x - b.lo.x), y: r2(b.hi.y - b.lo.y), z: r2(b.hi.z - b.lo.z) },
  nonzeroThickness: (b.hi.x - b.lo.x) > 0 && (b.hi.y - b.lo.y) > 0 && (b.hi.z - b.lo.z) > 0,
  topAtOrBelowCap: b.name === 'backing' ? null : b.name === 'cap' ? b.hi.y <= headCapTopY : b.hi.y <= solidCapY + 1e-9
});
const overlapVolume = (a: Box, b: Box) => {
  const d = (ax: 'x' | 'y' | 'z') => Math.min(a.hi[ax], b.hi[ax]) - Math.max(a.lo[ax], b.lo[ax]);
  return { x: r2(d('x')), y: r2(d('y')), z: r2(d('z')), connected: d('x') > 0 && d('y') > 0 && d('z') > 0 };
};

// --- apparatus footing over the FULL solid footprint (backing+stand+bracket)
let footing = true;
const footLo = { x: Math.min(...SOLIDS.map(b => b.lo.x)), z: Math.min(...SOLIDS.map(b => b.lo.z)) };
const footHi = { x: Math.max(...SOLIDS.map(b => b.hi.x)), z: Math.max(...SOLIDS.map(b => b.hi.z)) };
const footingColumns: Array<[number, number, number | null]> = [];
for (let u = Math.round((footLo.x - 1) / VOXEL_SCALE); u <= Math.round((footHi.x + 1) / VOXEL_SCALE); u++) {
  for (let v = Math.round((footLo.z - 1) / VOXEL_SCALE); v <= Math.round((footHi.z + 1) / VOXEL_SCALE); v++) {
    const cx = u * VOXEL_SCALE, cz = v * VOXEL_SCALE;
    if (cx + 1 < footLo.x || cx - 1 > footHi.x || cz + 1 < footLo.z || cz - 1 > footHi.z) continue;
    const nc = cellAt(u, v);
    footingColumns.push([u, v, nc ? nc.h : null]);
    if (!nc || Math.abs(nc.h - Rp.cell.h) > 0) footing = false;
  }
}
note(footing, 'apparatus footprint (backing+stand+bracket+cap) not on uniform supported dry ground');

// --- walk mask includes ALL solids, inflated by the body radius only -------
const footprints = SOLIDS.map(b => ({
  name: b.name,
  lo: { x: b.lo.x - BODY_RADIUS, z: b.lo.z - BODY_RADIUS },
  hi: { x: b.hi.x + BODY_RADIUS, z: b.hi.z + BODY_RADIUS }
}));
const allowed = new Uint8Array(nodes.length);
for (let i = 0; i < nodes.length; i++) {
  if (!trunkAllowed[i]) continue;
  const n = nodes[i].world;
  const blocked = footprints.some(f => n.x >= f.lo.x && n.x <= f.hi.x && n.z >= f.lo.z && n.z <= f.hi.z);
  allowed[i] = blocked ? 0 : 1;
}
const segBlocked = (pts: THREE.Vector3[]) => {
  const tb = trunkBox(BODY_RADIUS);
  for (let i = 1; i < pts.length; i++) {
    const a = new THREE.Vector3(pts[i - 1].x, 0, pts[i - 1].z);
    const b = new THREE.Vector3(pts[i].x, 0, pts[i].z);
    if (segmentHitsBox(a, b, { ...tb.lo, y: -1 }, { ...tb.hi, y: 1 })) return 'trunk';
    for (const f of footprints) {
      if (segmentHitsBox(a, b, { x: f.lo.x, y: -1, z: f.lo.z }, { x: f.hi.x, y: 1, z: f.hi.z })) return f.name;
    }
  }
  return null;
};
const idxOf = (p: Pose) => nodeIndex.get(`${p.cell.u},${p.cell.v}`)!;
const materialise = (path: number[], from: Pose, to: Pose) => {
  const pts: THREE.Vector3[] = [from.world.clone()];
  for (const i of path) if (pts[pts.length - 1].distanceTo(nodes[i].world) > 1e-6) pts.push(nodes[i].world.clone());
  if (pts[pts.length - 1].distanceTo(to.world) > 1e-6) pts.push(to.world.clone());
  const length = groundedSurfaceRouteLength(pts.map(position => ({ position })), UP);
  return { pts, length, samples: traceSamples(pts), dense: densePoints(pts) };
};
const sup = (ground: THREE.Vector3, actorH: number) => supportPoint(ground, actorH, refSocket, Rp.world, RANGE, SOLIDS);

// --- fixed-valid endpoints -------------------------------------------------
const sS = sup(poses.S!.world, WORKER_SOCKET);
const sE = sup(poses.E!.world, WORKER_SOCKET);
note(sS.supported && sE.supported, 'S/E not fixed-valid against the actual 1.30 socket');

// --- coverage mask ---------------------------------------------------------
const cov = new Uint8Array(nodes.length);
for (let i = 0; i < nodes.length; i++) {
  if (!allowed[i]) continue;
  if (nodes[i].world.distanceTo(refSocket) > RANGE + 2) continue;
  if (sup(nodes[i].world, WORKER_SOCKET).supported) cov[i] = 1;
}

// --- SHORT route -----------------------------------------------------------
const shortPath = leastSupportedShortestPath(idxOf(poses.S!), idxOf(poses.E!), allowed, cov);
note(!!shortPath, 'no short route with all solids in the mask');
const shortM = materialise(shortPath!, poses.S!, poses.E!);
const shortCaps = {
  walkedUnits: r2(shortM.length), lengthCap: MAX_TRACE_LENGTH, withinLengthCap: shortM.length <= MAX_TRACE_LENGTH,
  sampleCount: shortM.samples.length, pointCap: MAX_TRACE_POINTS, withinPointCap: shortM.samples.length <= MAX_TRACE_POINTS,
  segmentIntersectsSolidOrTrunk: segBlocked(shortM.pts)
};
note(shortCaps.withinLengthCap && shortCaps.withinPointCap && shortCaps.segmentIntersectsSolidOrTrunk === null, 'short route violates caps or hits a solid');
const shortSup = shortM.samples.map(p => sup(p, WORKER_SOCKET));
const run = longestFalseRun(shortM.samples, shortSup.map(s => s.supported));
const spanPoints = shortM.samples.slice(run.startIdx, run.endIdx + 1);
const spanReasons = Array.from(new Set(shortSup.slice(run.startIdx, run.endIdx + 1).map(s => s.blockedBy)));
note(run.walked >= MIN_UNSUPPORTED_SPAN, `unsupported short span ${r2(run.walked)} < ${MIN_UNSUPPORTED_SPAN}`);
note(spanReasons.length === 1 && spanReasons[0] === 'backing', `unsupported span not caused solely by the backing: ${spanReasons.join(',')}`);

// --- LONG route ------------------------------------------------------------
const covAllowed = new Uint8Array(nodes.length);
for (let i = 0; i < nodes.length; i++) covAllowed[i] = allowed[i] && cov[i] ? 1 : 0;
const longPath = bfsPath(idxOf(poses.S!), idxOf(poses.E!), covAllowed);
note(!!longPath, 'no fully supported long route');
const longM = materialise(longPath!, poses.S!, poses.E!);
const longSup = longM.samples.map(p => sup(p, WORKER_SOCKET));
const longDenseSup = longM.dense.map(p => sup(p, WORKER_SOCKET));
const longCaps = {
  walkedUnits: r2(longM.length), extraUnits: r2(longM.length - shortM.length),
  lengthRatio: +(longM.length / shortM.length).toFixed(3),
  minExtraUnitsRequired: MIN_EXTRA_UNITS, minLengthRatioRequired: MIN_LENGTH_RATIO,
  sampleCount: longM.samples.length, withinPointCap: longM.samples.length <= MAX_TRACE_POINTS,
  withinLengthCap: longM.length <= MAX_TRACE_LENGTH,
  segmentIntersectsSolidOrTrunk: segBlocked(longM.pts),
  everySampleSupported: longSup.every(s => s.supported),
  everyDensePointSupported: longDenseSup.every(s => s.supported),
  denseSpacingUnits: SEGMENT_DENSE_SPACING, densePointCount: longM.dense.length,
  minRangeMarginUnits: r2(Math.min(...longDenseSup.map(s => RANGE - s.distance))),
  firstUnsupported: longDenseSup.findIndex(s => !s.supported)
};
note(longM.length >= shortM.length + MIN_EXTRA_UNITS, 'long route detour under the 12-unit rule');
note(longM.length >= shortM.length * MIN_LENGTH_RATIO, 'long route detour under the 1.25 ratio rule');
note(longCaps.withinLengthCap && longCaps.withinPointCap && longCaps.segmentIntersectsSolidOrTrunk === null, 'long route violates caps or hits a solid');
note(longCaps.everySampleSupported && longCaps.everyDensePointSupported, 'long route has an unsupported point');

// --- endpoint reference insufficiency --------------------------------------
const coversWholeSpan = (ground: THREE.Vector3, socketH: number) => {
  const s = new THREE.Vector3(ground.x, ground.y + socketH, ground.z);
  const per = spanPoints.map(p => supportPoint(p, WORKER_SOCKET, s, ground, RANGE, SOLIDS));
  return { covers: per.every(x => x.supported), coveredCount: per.filter(x => x.supported).length, total: per.length,
    firstFailReason: per.find(x => !x.supported)?.blockedBy ?? null };
};
const endpointS = coversWholeSpan(poses.S!.world, PLAYER_SOCKET);
const endpointE = coversWholeSpan(poses.E!.world, PLAYER_SOCKET);
note(!endpointS.covers && !endpointE.covers, 'an endpoint reference alone already witnesses the entire unsupported span');

// --- SHIFTED intermediate witness W(-34,51.05,10) --------------------------
function witnessReport(p: Pose | null, label: string) {
  if (!p) return { label, valid: false, reason: 'does not ground' };
  const s = new THREE.Vector3(p.world.x, p.world.y + PLAYER_SOCKET, p.world.z);
  const per = spanPoints.map(q => supportPoint(q, WORKER_SOCKET, s, p.world, RANGE, SOLIDS));
  const clear = distanceToPolyline(p.world, shortM.pts);
  const reachable = !!bfsPath(idxOf(poses.S!), idxOf(p), allowed);
  return {
    label, position: v3(p.world), supportVoxel: [p.cell.u, p.cell.h, p.cell.v],
    socketWorld: v3(s), socketHeight: PLAYER_SOCKET, bodyHeight: PLAYER_BODY_HEIGHT,
    bodyDiscFullySupported: p.clear,
    coversWholeUnsupportedSpan: per.every(x => x.supported),
    coveredSpanSamples: per.filter(x => x.supported).length, spanSamples: per.length,
    firstFailure: per.find(x => !x.supported) ?? null,
    maxLineOfReferenceDistance: r2(Math.max(...per.map(x => x.distance))),
    rangeMarginUnits: r2(RANGE - Math.max(...per.map(x => x.distance))),
    bodyClearanceFromSurveyRoute: r2(clear),
    meetsBodyBodyClearance: clear >= BODY_BODY_CLEARANCE, bodyBodyClearanceRequired: BODY_BODY_CLEARANCE,
    occupancyCylinderMarginUnits: r2(clear - OCCUPY_R),
    releaseCylinderMarginUnits: r2(clear - RELEASE_R),
    releaseCylinderOverlapsRoute: clear < RELEASE_R,
    reachableOnFootFromS: reachable,
    insideAnySolidFootprint: footprints.some(f => p.world.x >= f.lo.x && p.world.x <= f.hi.x && p.world.z >= f.lo.z && p.world.z <= f.hi.z),
    valid: p.clear && per.every(x => x.supported) && clear >= BODY_BODY_CLEARANCE && reachable
  };
}
const wShift = witnessReport(poses.W, 'W shifted (-34,51.05,10)');
const wNominal = witnessReport(poses.WNominal, 'W nominal (-34,51.05,11)');
note((wShift as any).valid === true, 'shifted intermediate witness W(-34,51.05,10) is INVALID');

// --- E -> C common passage; STAGED worker reference held at H ---------------
// Comparison START is E. The worker's REFERENCE POSE is the DISTINCT adjacent
// pose H. Nothing here is "held at E".
const ecPath = bfsPath(idxOf(poses.E!), idxOf(poses.C!), allowed);
note(!!ecPath, 'no E->C route with all solids in the mask');
const ecM = materialise(ecPath!, poses.E!, poses.C!);
const Hp = poses.H!;
const heldH = new THREE.Vector3(Hp.world.x, Hp.world.y + WORKER_SOCKET, Hp.world.z);
const heldSamples = ecM.samples.map(p => supportPoint(p, PLAYER_SOCKET, heldH, Hp.world, RANGE, SOLIDS));
const heldDense = ecM.dense.map(p => supportPoint(p, PLAYER_SOCKET, heldH, Hp.world, RANGE, SOLIDS));
const headSamples = ecM.samples.map(p => sup(p, PLAYER_SOCKET));
/** NEW property (not proved by the previous full-range-LOS study): near-body
 *  clearance between the standing worker at H and the whole player path. */
const playerPathClearanceFromH = Math.min(
  distanceToPolyline(Hp.world, ecM.pts),
  ...ecM.dense.map(p => p.distanceTo(Hp.world))
);
const ecReport = {
  walkedUnits: r2(ecM.length), sampleCount: ecM.samples.length, densePointCount: ecM.dense.length,
  withinLengthCap: ecM.length <= MAX_TRACE_LENGTH, withinPointCap: ecM.samples.length <= MAX_TRACE_POINTS,
  segmentIntersectsSolidOrTrunk: segBlocked(ecM.pts),
  vertices: ecM.pts.map(v3),
  comparisonStartPose: { label: 'E', world: v3(poses.E!.world) },
  workerReferencePose: { label: 'H', world: v3(Hp.world), distinctFromComparisonStart: Hp.world.distanceTo(poses.E!.world) > 1e-9,
    separationFromEUnits: r2(Hp.world.distanceTo(poses.E!.world)) },
  workerReferenceHeldAtH: { socketWorld: v3(heldH), socketHeight: WORKER_SOCKET, source: 'AuditWorker torso 1.30 + visor 0.55',
    note: 'reference socket is H + 1.85; it is NOT held at E' },
  everySampleInRangeOfWorkerH: heldSamples.every(s => s.inRange),
  everySampleUnobstructedFromWorkerH: heldSamples.every(s => s.supported),
  everyDensePointInRangeOfWorkerH: heldDense.every(s => s.inRange),
  everyDensePointUnobstructedFromWorkerH: heldDense.every(s => s.supported),
  samplesVerified: heldSamples.length, densePointsVerified: heldDense.length,
  expectedSampleCount: 31, expectedDensePointCount: 73,
  sampleAndDenseCountsAsCommissioned: heldSamples.length === 31 && heldDense.length === 73,
  maxDistanceFromWorkerH: r2(Math.max(...heldDense.map(s => s.distance))),
  minRangeMarginFromWorkerH: r2(RANGE - Math.max(...heldDense.map(s => s.distance))),
  heldFailures: heldDense.map((s, i) => ({ i, p: v3(ecM.dense[i]), ...s })).filter(s => !s.supported).slice(0, 8),
  playerPathBodyClearanceFromWorkerH: r2(playerPathClearanceFromH),
  meetsBodyBodyClearanceFromWorkerH: playerPathClearanceFromH >= BODY_BODY_CLEARANCE,
  bodyBodyClearanceRequired: BODY_BODY_CLEARANCE,
  workerHOnPlayerPath: playerPathClearanceFromH < BODY_BODY_CLEARANCE,
  unitsOutsideFixedReference: r2(headSamples.reduce((acc, s, i) => acc + (i > 0 && !s.supported ? ecM.samples[i].distanceTo(ecM.samples[i - 1]) : 0), 0))
};
note(ecReport.withinLengthCap && ecReport.withinPointCap && ecReport.segmentIntersectsSolidOrTrunk === null, 'E->C route violates caps or hits a solid');
note(ecReport.sampleAndDenseCountsAsCommissioned, `E->C sample/dense counts are ${heldSamples.length}/${heldDense.length}, not the commissioned 31/73`);
note(ecReport.everySampleInRangeOfWorkerH && ecReport.everySampleUnobstructedFromWorkerH, 'an E->C sample is out of range or obstructed from the worker reference at H');
note(ecReport.meetsBodyBodyClearanceFromWorkerH, `player path passes within ${r2(playerPathClearanceFromH)} of the worker at H (< ${BODY_BODY_CLEARANCE})`);
note(ecReport.workerReferencePose.distinctFromComparisonStart, 'the worker reference pose H is not distinct from the comparison start E');
note(ecReport.unitsOutsideFixedReference > 0, 'the units-outside-fixed-reference measure collapsed to zero');
note(ecReport.everyDensePointInRangeOfWorkerH && ecReport.everyDensePointUnobstructedFromWorkerH, 'an E->C dense segment point is out of range or obstructed from the worker reference at H');

// nonzero reciprocal necessity: head-unsupported AND held-supported
let commonRun: { s: number; e: number; walked: number } | null = null;
{
  let i = 0;
  while (i < ecM.samples.length) {
    if (headSamples[i].supported || !heldSamples[i].supported) { i++; continue; }
    let j = i;
    while (j + 1 < ecM.samples.length && !headSamples[j + 1].supported && heldSamples[j + 1].supported) j++;
    let walked = 0;
    for (let m = i + 1; m <= j; m++) walked += ecM.samples[m].distanceTo(ecM.samples[m - 1]);
    if (!commonRun || walked > commonRun.walked) commonRun = { s: i, e: j, walked };
    i = j + 1;
  }
}
note(!!commonRun && commonRun.walked > 0, 'no nonzero contiguous reciprocal-necessity span on E->C');

// --- Terra fixed witness (-44,51.05,12), socket 1.35 -----------------------
const Tp = poses.T!;
const terraSocket = new THREE.Vector3(Tp.world.x, Tp.world.y + PLAYER_SOCKET, Tp.world.z);
const workerFinal = ecM; // W-7744's own final traversal E->C
const terraSamples = workerFinal.samples.map(p => supportPoint(p, WORKER_SOCKET, terraSocket, Tp.world, RANGE, SOLIDS));
const terraDense = workerFinal.dense.map(p => supportPoint(p, WORKER_SOCKET, terraSocket, Tp.world, RANGE, SOLIDS));
const terraLateral = new THREE.Vector3(Tp.world.x, 0, Tp.world.z).distanceTo(new THREE.Vector3(poses.C!.world.x, 0, poses.C!.world.z));
const terraClear = distanceToPolyline(Tp.world, workerFinal.pts);
const terraReport = {
  position: v3(Tp.world), supportVoxel: [Tp.cell.u, Tp.cell.h, Tp.cell.v],
  socketWorld: v3(terraSocket), socketHeight: PLAYER_SOCKET, bodyHeight: PLAYER_BODY_HEIGHT,
  bodyDiscFullySupported: Tp.clear,
  lateralOffsetFromC: r2(terraLateral), lateralMinRequired: TERRA_LATERAL_MIN, meetsLateralMin: terraLateral >= TERRA_LATERAL_MIN,
  standsAtC: terraLateral < 1e-6,
  everySampleInRange: terraSamples.every(s => s.inRange),
  everySampleUnobstructed: terraSamples.every(s => s.supported),
  everyDensePointInRange: terraDense.every(s => s.inRange),
  everyDensePointUnobstructed: terraDense.every(s => s.supported),
  densePointCount: terraDense.length, denseSpacingUnits: SEGMENT_DENSE_SPACING,
  maxLineOfReferenceDistance: r2(Math.max(...terraDense.map(s => s.distance))),
  rangeMarginUnits: r2(RANGE - Math.max(...terraDense.map(s => s.distance))),
  failures: terraDense.map((s, i) => ({ i, p: v3(workerFinal.dense[i]), ...s })).filter(s => !s.supported).slice(0, 8),
  bodyClearanceFromWorkerFinalRoute: r2(terraClear),
  meetsBodyBodyClearance: terraClear >= BODY_BODY_CLEARANCE,
  occupancyCylinderMarginUnits: r2(terraClear - OCCUPY_R), releaseCylinderMarginUnits: r2(terraClear - RELEASE_R),
  releaseCylinderOverlapsRoute: terraClear < RELEASE_R,
  verticalDeltaToC: r2(Math.abs(Tp.world.y - poses.C!.world.y)),
  occupancyVerticalTolerance: OCCUPY_Y, releaseVerticalTolerance: RELEASE_Y,
  reachableOnFootFromE: !!bfsPath(idxOf(poses.E!), idxOf(Tp), allowed),
  holdCondition: terraClear < RELEASE_R ? 'release cylinder overlaps the arrival route: traversal must HOLD' : 'no hold required at this pose'
};
note(terraReport.everySampleInRange && terraReport.everySampleUnobstructed, 'a worker final-traversal sample is out of range or obstructed from Terra');
note(terraReport.everyDensePointInRange && terraReport.everyDensePointUnobstructed, 'a worker final-traversal dense segment point is out of range or obstructed from Terra');
note(terraReport.meetsLateralMin && terraReport.meetsBodyBodyClearance && !terraReport.standsAtC, 'Terra witness violates lateral/body clearance');

// --- STAGED positioning legs (real dry body paths; NEVER common proof) -----
// Leg 1: worker physically moves E -> H BEFORE Terra starts the comparison.
// Leg 2: after Terra completes and occupies the existing far reference T, the
// worker physically returns H -> E BEFORE the final E->C traversal.
// Both legs are planned on the same live-source node field / solid guard used
// by every other route. Neither leg contributes any common-comparison credit.
function legReport(from: Pose, to: Pose, label: string) {
  const path = bfsPath(idxOf(from), idxOf(to), allowed);
  if (!path) return { label, planned: false, reason: 'no dry route on the live-source planner' } as any;
  const m = materialise(path, from, to);
  const bodyVsSolids = m.dense.map(p => SOLIDS.map(b => {
    const dx = Math.max(b.lo.x - p.x, 0, p.x - b.hi.x);
    const dz = Math.max(b.lo.z - p.z, 0, p.z - b.hi.z);
    const planar = Math.hypot(dx, dz);
    const vertOverlap = Math.min(p.y + WORKER_BODY_HEIGHT, b.hi.y) - Math.max(p.y, b.lo.y) > 0;
    return { solid: b.name, planarGapToSurface: planar, intersects: planar < BODY_RADIUS && vertOverlap };
  })).flat();
  const everyPointDry = m.dense.every(p => {
    const c = cellAt(Math.round(p.x / VOXEL_SCALE), Math.round(p.z / VOXEL_SCALE));
    return !!c;
  });
  return {
    label, planned: true, from: v3(from.world), to: v3(to.world),
    walkedUnits: r2(m.length), vertices: m.pts.map(v3),
    sampleCount: m.samples.length, densePointCount: m.dense.length,
    withinLengthCap: m.length <= MAX_TRACE_LENGTH, withinPointCap: m.samples.length <= MAX_TRACE_POINTS,
    segmentIntersectsSolidOrTrunk: segBlocked(m.pts),
    everyDensePointOnDrySupportedCell: everyPointDry,
    minPlanarGapToAnySolid: r2(Math.min(...bodyVsSolids.map(x => x.planarGapToSurface))),
    anyBodyIntersectsSolid: bodyVsSolids.some(x => x.intersects),
    materialised: m
  };
}
const legEtoH = legReport(poses.E!, Hp, 'positioning leg E -> H (before the comparison)');
const legHtoE = legReport(Hp, poses.E!, 'positioning leg H -> E (after Terra occupies T, before the final E->C)');
for (const leg of [legEtoH, legHtoE]) {
  note(leg.planned === true, `${leg.label}: no dry route on the live-source planner`);
  note(leg.planned && leg.segmentIntersectsSolidOrTrunk === null, `${leg.label}: walked segment hits a solid or the trunk`);
  note(leg.planned && leg.everyDensePointOnDrySupportedCell === true, `${leg.label}: a dense point is not on a dry supported cell`);
  note(leg.planned && leg.anyBodyIntersectsSolid === false, `${leg.label}: the moving worker body intersects a literal solid`);
  note(leg.planned && leg.withinLengthCap && leg.withinPointCap, `${leg.label}: violates a trace cap`);
}
// Leg 2 additionally: the MOVING worker must stay supported from the EXISTING
// far Terra socket (T + 1.35) and never come within one body diameter of her.
const returnM = legHtoE.materialised as ReturnType<typeof materialise>;
const returnFromTerraSamples = returnM.samples.map(p => supportPoint(p, WORKER_SOCKET, terraSocket, Tp.world, RANGE, SOLIDS));
const returnFromTerraDense = returnM.dense.map(p => supportPoint(p, WORKER_SOCKET, terraSocket, Tp.world, RANGE, SOLIDS));
const returnClearanceFromTerra = Math.min(
  distanceToPolyline(Tp.world, returnM.pts),
  ...returnM.dense.map(p => p.distanceTo(Tp.world))
);
const returnLegReport = {
  witnessSocket: { label: 'T (existing far Terra reference)', world: v3(terraSocket), socketHeight: PLAYER_SOCKET },
  everySampleInRangeOfTerra: returnFromTerraSamples.every(s => s.inRange),
  everySampleUnobstructedFromTerra: returnFromTerraSamples.every(s => s.supported),
  everyDensePointInRangeOfTerra: returnFromTerraDense.every(s => s.inRange),
  everyDensePointUnobstructedFromTerra: returnFromTerraDense.every(s => s.supported),
  sampleCount: returnFromTerraSamples.length, densePointCount: returnFromTerraDense.length,
  maxDistanceFromTerra: r2(Math.max(...returnFromTerraDense.map(s => s.distance))),
  rangeMarginUnits: r2(RANGE - Math.max(...returnFromTerraDense.map(s => s.distance))),
  failures: returnFromTerraDense.map((s, i) => ({ i, p: v3(returnM.dense[i]), ...s })).filter(s => !s.supported).slice(0, 8),
  movingWorkerBodyClearanceFromTerra: r2(returnClearanceFromTerra),
  meetsBodyBodyClearance: returnClearanceFromTerra >= BODY_BODY_CLEARANCE,
  bodyBodyClearanceRequired: BODY_BODY_CLEARANCE
};
note(returnLegReport.everySampleInRangeOfTerra && returnLegReport.everySampleUnobstructedFromTerra
  && returnLegReport.everyDensePointInRangeOfTerra && returnLegReport.everyDensePointUnobstructedFromTerra,
  'the returning worker on H->E is out of range or obstructed from the existing far Terra socket');
note(returnLegReport.meetsBodyBodyClearance,
  `the returning worker on H->E comes within ${r2(returnClearanceFromTerra)} of Terra at T (< ${BODY_BODY_CLEARANCE})`);
const stagedLegs = {
  order: ['worker E -> H', 'Terra E -> C comparison witnessed from H + 1.85', 'Terra occupies T (-44,51.05,12)', 'worker H -> E', 'worker final E -> C witnessed from T + 1.35'],
  positioningLegsCountAsCommonProof: false,
  finalTestUsesPositioningLegs: false,
  finalTestPath: 'full E -> C (independent), witnessed from the separate far Terra socket at T + 1.35',
  legEtoH: { ...legEtoH, materialised: undefined },
  legHtoE: { ...legHtoE, materialised: undefined },
  returningWorkerWitnessedFromTerra: returnLegReport
};
note(stagedLegs.positioningLegsCountAsCommonProof === false, 'a positioning leg was credited as common proof');

// --- solid-vs-body / solid-vs-path / solid-vs-ray intersection audit -------
const bodyKeys = ['S', 'E', 'C', 'H', 'W', 'T'] as const;
const bodyIntersections = bodyKeys.map(key => {
  const p = poses[key]!;
  const per = SOLIDS.map(b => {
    const dx = Math.max(b.lo.x - p.world.x, 0, p.world.x - b.hi.x);
    const dz = Math.max(b.lo.z - p.world.z, 0, p.world.z - b.hi.z);
    const planar = Math.hypot(dx, dz);
    const bodyTop = p.world.y + (key === 'W' || key === 'T' ? PLAYER_BODY_HEIGHT : WORKER_BODY_HEIGHT);
    const vertOverlap = Math.min(bodyTop, b.hi.y) - Math.max(p.world.y, b.lo.y) > 0;
    return { solid: b.name, planarGapToSurface: r2(planar), capsuleIntersects: planar < BODY_RADIUS && vertOverlap };
  });
  return { body: key, position: v3(p.world), perSolid: per, anyIntersection: per.some(x => x.capsuleIntersects) };
});
note(!bodyIntersections.some(b => b.anyIntersection), 'a body capsule intersects a literal solid');

const pathIntersections = [
  { path: 'short S->E', hit: segBlocked(shortM.pts) },
  { path: 'long S->E', hit: segBlocked(longM.pts) },
  { path: 'common E->C', hit: segBlocked(ecM.pts) },
  { path: 'positioning leg E->H', hit: segBlocked((legEtoH.materialised as any).pts) },
  { path: 'positioning leg H->E', hit: segBlocked(returnM.pts) }
];
note(!pathIntersections.some(p => p.hit), 'a walked path intersects a literal solid or the trunk');

// Every ray actually cast in this qualification, classified per solid.
type RaySet = { name: string; rays: Array<[THREE.Vector3, THREE.Vector3]> };
const raySets: RaySet[] = [
  { name: 'short-route samples -> fixed 1.30 socket', rays: shortM.samples.map(p => [p.clone().addScaledVector(UP, WORKER_SOCKET), refSocket] as [THREE.Vector3, THREE.Vector3]) },
  { name: 'long-route dense -> fixed 1.30 socket', rays: longM.dense.map(p => [p.clone().addScaledVector(UP, WORKER_SOCKET), refSocket] as [THREE.Vector3, THREE.Vector3]) },
  { name: 'E->C dense -> worker reference socket at H (1.85)', rays: ecM.dense.map(p => [p.clone().addScaledVector(UP, PLAYER_SOCKET), heldH] as [THREE.Vector3, THREE.Vector3]) },
  { name: 'H->E return-leg dense -> existing far Terra socket (1.35)', rays: returnM.dense.map(p => [p.clone().addScaledVector(UP, WORKER_SOCKET), terraSocket] as [THREE.Vector3, THREE.Vector3]) },
  { name: 'worker final dense -> Terra socket (1.35)', rays: workerFinal.dense.map(p => [p.clone().addScaledVector(UP, WORKER_SOCKET), terraSocket] as [THREE.Vector3, THREE.Vector3]) },
  { name: 'unsupported-span samples -> shifted W socket (1.35)', rays: spanPoints.map(p => [p.clone().addScaledVector(UP, WORKER_SOCKET), new THREE.Vector3(poses.W!.world.x, poses.W!.world.y + PLAYER_SOCKET, poses.W!.world.z)] as [THREE.Vector3, THREE.Vector3]) }
];
const rayAudit = raySets.map(rs => {
  const counts: Record<string, number> = { backing: 0, stand: 0, bracket: 0, cap: 0 };
  const inclusive: Record<string, number> = { backing: 0, stand: 0, bracket: 0, cap: 0 };
  const endpointOnly: Record<string, number> = { backing: 0, stand: 0, bracket: 0, cap: 0 };
  let minY = Infinity;
  for (const [a, b] of rs.rays) {
    minY = Math.min(minY, a.y, b.y);
    for (const s of SOLIDS) {
      if (segmentCrossesBoxOpen(a, b, s.lo, s.hi)) counts[s.name]++;
      if (segmentHitsBox(a, b, s.lo, s.hi)) inclusive[s.name]++;
      if (segmentTouchesBoxAtEndpointOnly(a, b, s.lo, s.hi)) endpointOnly[s.name]++;
    }
  }
  return { raySet: rs.name, rayCount: rs.rays.length, minRayEndpointY: r2(minY),
    minRayEndpointAboveStandBracketCap: minY > solidCapY,
    minRayEndpointAtOrAboveHeadCapTop: minY >= headCapTopY,
    hitsPerSolid: counts, inclusiveContactPerSolid: inclusive, endpointOnlyContactPerSolid: endpointOnly };
});
note(rayAudit.every(r => r.hitsPerSolid.stand === 0 && r.hitsPerSolid.bracket === 0),
  'a ray intersects the stand or the bracket (below-socket solids should be geometrically unreachable by socket-to-socket rays)');
note(rayAudit.every(r => r.hitsPerSolid.cap === 0),
  'a ray crosses the head cap interior (only endpoint contact on its exposed top face is permitted)');
note(rayAudit.every(r => r.minRayEndpointAboveStandBracketCap), 'a ray endpoint sits at or below the stand/bracket cap');
note(rayAudit.every(r => r.minRayEndpointAtOrAboveHeadCapTop), 'a ray endpoint sits below the head cap top plane');

// --- contact-rule unit tests (exact, no epsilon) ---------------------------
const CAPB = headCap, BACKB = backing;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const socketOnCap = V(refSocket.x, refSocket.y, refSocket.z);
const contactRuleTests = [
  { id: 'top-contact-exiting', expect: 'clear', why: 'endpoint rests on the cap top face, open segment rises away',
    a: socketOnCap, b: V(refSocket.x, refSocket.y + 1.65, refSocket.z), box: CAPB },
  { id: 'reversed-endpoints', expect: 'clear', why: 'same pair reversed — rule is symmetric at both endpoints',
    a: V(refSocket.x, refSocket.y + 1.65, refSocket.z), b: socketOnCap, box: CAPB },
  { id: 'endpoint-on-face-pointing-inside', expect: 'blocked', why: 'open segment immediately enters the solid',
    a: socketOnCap, b: V(refSocket.x, refSocket.y - 0.05, refSocket.z), box: CAPB },
  { id: 'crossing-head', expect: 'blocked', why: 'interior crossing of the cap',
    a: V(refSocket.x, refSocket.y - 0.05, refSocket.z - 1), b: V(refSocket.x, refSocket.y - 0.05, refSocket.z + 1), box: CAPB },
  { id: 'tangency-along-solid-face', expect: 'blocked', why: 'segment lies IN the cap top plane; documented consequence of the chosen predicate (coplanar grazing blocks)',
    a: V(refSocket.x - 0.5, headCapTopY, refSocket.z), b: V(refSocket.x + 0.5, headCapTopY, refSocket.z), box: CAPB },
  { id: 'backing-cross-0.12-thick', expect: 'blocked', why: 'thin 0.12 slab must still block — no spatial epsilon anywhere',
    a: V(-34, 52.0, BACKB.lo.z - 0.5), b: V(-34, 52.0, BACKB.hi.z + 0.5), box: BACKB }
].map(t => {
  const crosses = segmentCrossesBoxOpen(t.a, t.b, t.box.lo, t.box.hi);
  const iv = boxInterval(t.a, t.b, t.box.lo, t.box.hi);
  const openLen = iv ? Math.max(0, Math.min(iv.tmax, 1) - Math.max(iv.tmin, 0)) : 0;
  return { id: t.id, expected: t.expect, actual: crosses ? 'blocked' : 'clear', pass: (crosses ? 'blocked' : 'clear') === t.expect,
    rationale: t.why, box: t.box.name, a: v3(t.a), b: t.b ? v3(t.b) : null,
    inclusiveSegmentHitsBox: segmentHitsBox(t.a, t.b, t.box.lo, t.box.hi),
    endpointOnlyContact: segmentTouchesBoxAtEndpointOnly(t.a, t.b, t.box.lo, t.box.hi),
    openIntervalLength: +openLen.toFixed(6),
    worldLengthInsideUnits: +(openLen * t.a.distanceTo(t.b)).toFixed(6) };
});
note(contactRuleTests.every(t => t.pass), `contact-rule unit test failed: ${contactRuleTests.filter(t => !t.pass).map(t => t.id).join(',')}`);
const backingThicknessTest = contactRuleTests.find(t => t.id === 'backing-cross-0.12-thick')!;
note(Math.abs(backingThicknessTest.worldLengthInsideUnits - 0.12) < 1e-6,
  `backing crossing length ${backingThicknessTest.worldLengthInsideUnits} != 0.12 — an epsilon has eroded the slab`);

// --- socket metadata disambiguation ---------------------------------------
const genericPoseRSocketY = Rp.world.y + WORKER_SOCKET;
const socketDisambiguation = {
  actualFixedReferenceSocketHeight: FIXED_APPARATUS_SOCKET,
  actualFixedReferenceSocketWorld: v3(refSocket),
  usedByEveryFixedReferencePredicate: true,
  genericPosesRSocketHeightInBroadJson: WORKER_SOCKET,
  genericPosesRSocketWorldInBroadJson: v3(new THREE.Vector3(Rp.world.x, genericPoseRSocketY, Rp.world.z)),
  genericPosesREntryIsMetadataOnly: 'geometry-instrument-probe.mts emits poses.* with the worker socket 1.85 for every key except W; the R entry therefore reports 1.85 as generic per-pose metadata. No predicate reads it — apparatus.socketWorld (1.30) is the fixed reference.',
  verticalDifferenceUnits: r2(genericPoseRSocketY - refSocket.y),
  counterfactualIfGenericSocketWereUsed: (() => {
    const wrong = new THREE.Vector3(Rp.world.x, genericPoseRSocketY, Rp.world.z);
    const sSw = supportPoint(poses.S!.world, WORKER_SOCKET, wrong, Rp.world, RANGE, SOLIDS);
    const covWrong = shortM.samples.map(p => supportPoint(p, WORKER_SOCKET, wrong, Rp.world, RANGE, SOLIDS));
    const runWrong = longestFalseRun(shortM.samples, covWrong.map(s => s.supported));
    return { S_distance: sSw.distance, S_supported: sSw.supported, unsupportedShortSpanUnits: r2(runWrong.walked),
      differsFromMeasured: Math.abs(runWrong.walked - run.walked) > 1e-9 || sSw.distance !== sS.distance };
  })()
};

// --- head connection caveat ------------------------------------------------
const headConnection = {
  fixedSocketWorld: v3(refSocket),
  fixedSocketWorldY: r2(refSocket.y),
  standBracketCapWorldY: r2(solidCapY),
  standTopWorldY: r2(stand.hi.y),
  headCapWorldAabb: { lo: { x: r2(headCap.lo.x), y: r2(headCap.lo.y), z: r2(headCap.lo.z) }, hi: { x: r2(headCap.hi.x), y: r2(headCap.hi.y), z: r2(headCap.hi.z) } },
  headCapTopWorldY: r2(headCapTopY),
  headCapBottomMeetsStandTop: Math.abs(headCap.lo.y - stand.hi.y) === 0,
  headCapSharesStandFootprint: headCap.lo.x === stand.lo.x && headCap.hi.x === stand.hi.x && headCap.lo.z === stand.lo.z && headCap.hi.z === stand.hi.z,
  capTouchesStand: overlapVolume(headCap, stand),
  socketLiesOnCapTopFace: refSocket.y === headCap.hi.y
    && refSocket.x >= headCap.lo.x && refSocket.x <= headCap.hi.x
    && refSocket.z >= headCap.lo.z && refSocket.z <= headCap.hi.z,
  verticalGapCapTopToSocketUnits: r2(refSocket.y - headCap.hi.y),
  geometryAboveSocketPlane: 'none — etched flat mark on the exposed top surface; nothing is modelled above grounded+1.30',
  statement: 'The head is literally connected: backing -> bracket -> stand -> cap is one contiguous solid chain from the dry ground column to the fixed reference plane, and the fixed socket (-34, 52.35, 20) lies exactly ON the cap top face. There is no gap. Reference rays only touch that face at their endpoint; under the general surface-contact rule such endpoint contact is harmless while any interior crossing blocks.',
  bracketTouchesBacking: overlapVolume(bracket, backing),
  bracketTouchesStand: overlapVolume(bracket, stand),
  backingBottomAboveGroundUnits: r2(backing.lo.y - Rp.world.y)
};
note(headConnection.socketLiesOnCapTopFace, 'the fixed socket does not lie on the head cap top face');
note(headConnection.headCapBottomMeetsStandTop, 'the head cap does not meet the stand top');
note(headConnection.headCapSharesStandFootprint, 'the head cap does not share the stand footprint');
note(headConnection.verticalGapCapTopToSocketUnits === 0, 'a vertical gap remains between the cap top and the fixed socket');

const out = {
  probe: 'common-ground STAGED-POSE qualification (exactly one candidate, no search; head-cap probe + staged worker reference pose H)',
  generatedAt: new Date().toISOString(),
  status: 'PREPRODUCTION MEASUREMENT — proposed apparatus, proposed finite range, proposed stand/bracket/cap collision solids; not shipped behaviour',
  stagedPoseChange: {
    workerReferencePose: 'H (-40, 51.05, 12)',
    comparisonStartPose: 'E (-42, 51.05, 12)',
    distinct: true,
    comparisonWitnessSocket: 'H + 1.85 (NOT E + 1.85)',
    metricsChangedByH: ['commonComparisonEtoC.workerReferenceHeldAtH', 'commonComparisonEtoC.maxDistanceFromWorkerH',
      'commonComparisonEtoC.minRangeMarginFromWorkerH', 'commonComparisonEtoC.reciprocalNecessity',
      'intersectionAudit.rays[E->C dense]', 'intersectionAudit.bodies[H]'],
    unchangedMetricsClaim: 'route geometry, solids, contact rule, survey routes and the Terra final test are unchanged; distance/necessity metrics that depend on the reference socket DID change and are not claimed byte-identical'
  },
  provenance: {
    previousStudyProved: 'full-range line of sight from a worker socket held at E',
    previousStudyDidNotProve: 'near-body clearance between the worker and the player',
    newInThisStudy: 'worker/player near-body clearance from the staged pose H, and the two real dry positioning legs E->H and H->E'
  },
  selectsWinner: false,
  ownGeometryProposed: false,
  scope: 'bounded collision layout specification for the already nominated passive apparatus; no new story proposal',
  candidateSource: 'geometry-instrument.json ranges[range=12].top3[0]',
  candidate: CANDIDATE,
  conventionsInheritedFrom: 'geometry-instrument-probe.mts (rendered-cube gate + Amanatides-Woo DDA + measured sockets + trunk collider + undecimated 1.0/0.25 sampling)',
  world: {
    planetSize: PLANET_SIZE, radiusCells: RADIUS_CELLS, storyCoordinate: STORY_COORDINATE,
    storySeed: STORY_SEED, worldId: STORY_PRIMARY_WORLD_ID, voxelScale: VOXEL_SCALE, voxelCount: voxels.length,
    heroTree: v3(tree.position), pondSearchOrigin: pond ? v3(pond.surface) : null,
    dryWalkableNodesOnBoundedTopFace: nodes.length
  },
  thresholds: {
    range: RANGE, minExtraUnits: MIN_EXTRA_UNITS, minLengthRatio: MIN_LENGTH_RATIO,
    minUnsupportedShortSpanUnits: MIN_UNSUPPORTED_SPAN, bodyBodyClearance: BODY_BODY_CLEARANCE,
    terraLateralMinUnits: TERRA_LATERAL_MIN, maxTracePoints: MAX_TRACE_POINTS, maxTraceLength: MAX_TRACE_LENGTH,
    sampleSpacing: SAMPLE_SPACING, cornerSpacing: MIN_SAMPLE_SEPARATION,
    occupancyCylinder: { radius: OCCUPY_R, vertical: OCCUPY_Y }, releaseCylinder: { radius: RELEASE_R, vertical: RELEASE_Y },
    newThresholdsAdded: 'none', relaxationsApplied: 'none',
    denseSegmentSpacingIsReportingOnly: SEGMENT_DENSE_SPACING
  },
  sockets: {
    fixedApparatusPlate: FIXED_APPARATUS_SOCKET, workerVisor: WORKER_SOCKET, playerEye: PLAYER_SOCKET,
    workerBodyHeight: WORKER_BODY_HEIGHT, playerBodyHeight: PLAYER_BODY_HEIGHT, bodyRadius: BODY_RADIUS
  },
  socketDisambiguation,
  grounding,
  solids: {
    localFrame: { backing: { lo: BACK_LO, hi: BACK_HI }, stand: STAND_LOCAL, bracket: BRACKET_LOCAL, cap: CAP_LOCAL, standBracketCapLocalY: SOLID_CAP_LOCAL_Y, headCapTopLocalY: HEAD_CAP_TOP_LOCAL_Y },
    world: SOLIDS.map(boxReport),
    solidCapWorldY: r2(solidCapY),
    headCapTopWorldY: r2(headCapTopY),
    headCapTopEqualsFixedSocketPlane: headCapTopY === refSocket.y,
    standAndBracketEntirelyBelowCap: stand.hi.y <= solidCapY + 1e-9 && bracket.hi.y <= solidCapY + 1e-9,
    capBelowEveryRaySocket: {
      fixedPlate: r2(refSocket.y), workerVisorAtH: r2(heldH.y), playerEyeAtW: r2(poses.W!.world.y + PLAYER_SOCKET),
      playerEyeAtTerra: r2(terraSocket.y), capBelowAll: solidCapY < Math.min(refSocket.y, heldH.y, terraSocket.y)
    },
    exemptions: 'none — backing, stand, bracket and cap are all in the walk mask, the walked-segment test and every ray',
    footprintColumns: footingColumns.length, footprintColumnsUniformHeight: footing
  },
  headConnection,
  contactRule: {
    statement: 'Endpoint-only contact is harmless iff the adjacent open segment remains outside the solid; any interior crossing blocks. Applied symmetrically at BOTH ray endpoints to EVERY box (backing, stand, bracket, cap, trunk) with no object-specific exemption.',
    appliesTo: 'reference rays only (los)',
    walkCollisionRemainsInclusive: 'walk mask, walked-segment test and body-capsule test still use the inclusive segmentHitsBox predicate',
    spatialEpsilonUsed: 'none — exact parametric slab arithmetic; a 0.12-thick slab still blocks',
    tangencyAlongFace: 'a segment lying IN a face plane produces a positive-length open interval from the other two slabs and therefore BLOCKS (documented, conservative)',
    unitTests: contactRuleTests,
    unitTestsAllPass: contactRuleTests.every(t => t.pass)
  },
  fixedValidEndpoints: {
    S: { distance: sS.distance, rangeMargin: r2(RANGE - sS.distance), supported: sS.supported, blockedBy: sS.blockedBy },
    E: { distance: sE.distance, rangeMargin: r2(RANGE - sE.distance), supported: sE.supported, blockedBy: sE.blockedBy }
  },
  surveyRouteShort: {
    ...shortCaps, vertices: shortM.pts.map(v3),
    unsupportedSpanUnits: r2(run.walked), unsupportedSpanSamples: spanPoints.length,
    spanStart: v3(spanPoints[0]), spanEnd: v3(spanPoints[spanPoints.length - 1]),
    spanBlockReasons: spanReasons, spanCausedSolelyByBacking: spanReasons.length === 1 && spanReasons[0] === 'backing'
  },
  surveyRouteLong: { ...longCaps, vertices: longM.pts.map(v3) },
  endpointReferenceInsufficiency: { S: endpointS, E: endpointE, neitherEndpointCoversWholeSpan: !endpointS.covers && !endpointE.covers },
  intermediateWitness: { shifted: wShift, nominalForComparison: wNominal },
  commonComparisonEtoC: {
    ...ecReport,
    reciprocalNecessity: commonRun ? {
      contiguousSpanUnits: r2(commonRun.walked),
      spanStart: v3(ecM.samples[commonRun.s]), spanEnd: v3(ecM.samples[commonRun.e]),
      fractionOfPassage: +(commonRun.walked / ecM.length).toFixed(3), nonzero: commonRun.walked > 0
    } : { contiguousSpanUnits: 0, nonzero: false }
  },
  stagedLegs,
  terraFinalWitness: { ...terraReport, independentOfPositioningLegs: true,
    witnessedPath: 'full E->C worker traversal', witnessSocket: 'separate far Terra T + 1.35' },
  intersectionAudit: { bodies: bodyIntersections, paths: pathIntersections, rays: rayAudit },
  routeIdentityVsBroadProbe: {
    shortWalkedUnits: r2(shortM.length), broadShortWalkedUnits: 16,
    longWalkedUnits: r2(longM.length), broadLongWalkedUnits: 32, selectedCandidateLongWalkedUnits: 36,
    longUnchangedFromSelectedCandidate: r2(longM.length) === 36,
    commonWalkedUnits: r2(ecM.length), broadCommonWalkedUnits: 18,
    sameShortLongCommonRoutes: r2(shortM.length) === 16 && r2(longM.length) === 32 && r2(ecM.length) === 18
  },
  failures,
  verdict: failures.length === 0 ? 'PASS' : 'FAIL',
  cpuSeconds: +elapsed().toFixed(2),
  cpuBudgetSeconds: CPU_BUDGET_SECONDS,
  limits: {
    proposedNotShipped: 'finite reference range, opaque backing, stand, bracket and cap do not exist in the runtime',
    hysteresisNotSimulated: 'offer/occupancy hysteresis, hold/recovery timing and render tiers are not simulated',
    noRenderOrGpu: true, exactlyOneCandidate: true, fallbackScan: false
  }
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
