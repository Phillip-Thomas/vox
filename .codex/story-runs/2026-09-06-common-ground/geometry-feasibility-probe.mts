/**
 * Run-local CPU-only geometry feasibility probe for the Common Ground arena.
 *
 * Read-only. Imports shipped pure modules; never mutates source, never renders,
 * never starts a server. Reproduce with:
 *
 *   cd /home/thomasphillip/Projects/vox/main \
 *     && npx vite-node ../.codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts \
 *     > ../.codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json
 *
 * All geometry is derived from the SAME functions the runtime uses:
 *   createResolvedWorldGenerator  (utils/resolvedWorldGenerator.ts)
 *   createStoryAnchorResolver     (story/world/storyAnchorResolver.ts)
 *   planAgentSurfaceRoute         (utils/agentSurfaceNavigation.ts)
 *   groundedSurfaceRouteLength    (utils/groundedSurfaceMotion.ts)
 * with the worker route options copied verbatim from
 * story/emergentStoryDirector.ts::moveAuditor (lines ~2225-2234).
 *
 * Caveat recorded in the report: this uses the PRISTINE procedural terrain
 * query, not createLiveAgentSurfaceTerrain (which needs voxelSystem/live edits
 * and therefore a running client). Results are source-derived for an unedited
 * world.
 */
import * as THREE from 'three';
import { createResolvedWorldGenerator } from '../../../main/src/utils/resolvedWorldGenerator.ts';
import { createStoryAnchorResolver } from '../../../main/src/story/world/storyAnchorResolver.ts';
import { STORY_SEED, STORY_PRIMARY_WORLD_ID, STORY_COORDINATE } from '../../../main/src/story/world/storyWorldIdentity.ts';
import { planAgentSurfaceRoute, type AgentSurfaceTerrainQuery } from '../../../main/src/utils/agentSurfaceNavigation.ts';
import { groundedSurfaceRouteLength } from '../../../main/src/utils/groundedSurfaceMotion.ts';
import { VOXEL_SCALE, voxelCoordToWorld } from '../../../main/src/utils/cubeGravityConstants.ts';
import { buildTreeProfile } from '../../../main/src/utils/treeProfile.ts';

const PLANET_SIZE = 50; // components/EfficientScene.tsx::planetSize
const UP = new THREE.Vector3(0, 1, 0);

// story/emergentStoryDirector.ts::moveAuditor — verbatim.
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

// chapter-story-treatment.md#proposed-bounded-trace-contract
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

// --- anchors ---------------------------------------------------------------
const tree = resolver.getHeroTreePose(PLANET_SIZE, STORY_SEED);
const pond = resolver.getPondPose(PLANET_SIZE, STORY_SEED);
const relay = resolver.getWreckRelayPose(PLANET_SIZE, STORY_SEED);
const mesa = resolver.getSignalMesaPose(PLANET_SIZE, STORY_SEED);
const pod = resolver.getPodImpactPose(PLANET_SIZE, STORY_SEED);
const pack = resolver.getFieldPackPose(PLANET_SIZE, STORY_SEED, terrain);
const auditPath = resolver.getAuditWorkerPath(PLANET_SIZE, STORY_SEED, terrain);

if (!pond) throw new Error('probe: no pond pose on the pinned story world');

// trunk collider: HeroAppleTree.tsx:190 CuboidCollider args [0.55, h/2, 0.55]
const heroProfile = buildTreeProfile((STORY_SEED ^ 0xede9) >>> 0);
const trunkHeight = Math.max(heroProfile.trunkHeight, 7.2);
const TRUNK_HALF = 0.55;

// --- terrain helpers -------------------------------------------------------
function columnTop(vx: number, vz: number): number | null {
  const limit = Math.floor(PLANET_SIZE / 2) + 6;
  for (let y = limit; y >= 0; y--) if (terrain.isSolidVoxel(vx, y, vz)) return y;
  return null;
}
function dryStandable(vx: number, vz: number): { y: number; world: THREE.Vector3 } | null {
  const y = columnTop(vx, vz);
  if (y === null) return null;
  if (terrain.isWaterVoxel(vx, y + 1, vz)) return null;
  if (terrain.isWaterVoxel(vx, y + 2, vz)) return null;
  if (terrain.isHazardousVoxel!(vx, y, vz)) return null;
  // worker clearanceCells = 2
  if (terrain.isSolidVoxel(vx, y + 1, vz) || terrain.isSolidVoxel(vx, y + 2, vz)) return null;
  return { y, world: voxelCoordToWorld(vx, y, vz).addScaledVector(UP, VOXEL_SCALE / 2 + 0.05) };
}
const toVoxel = (p: THREE.Vector3) => ({ x: Math.round(p.x / VOXEL_SCALE), z: Math.round(p.z / VOXEL_SCALE) });

// --- occlusion truth (terrain voxels + trunk collider box) -----------------
const EYE = 1.6;
function trunkBlocks(a: THREE.Vector3, b: THREE.Vector3): boolean {
  // 2D segment vs axis-aligned square around the trunk, with a height gate.
  const t = tree.position;
  if (Math.min(a.y, b.y) > t.y + trunkHeight) return false;
  const steps = Math.ceil(a.distanceTo(b) / 0.2);
  for (let i = 0; i <= steps; i++) {
    const p = a.clone().lerp(b, i / steps);
    if (Math.abs(p.x - t.x) <= TRUNK_HALF && Math.abs(p.z - t.z) <= TRUNK_HALF
      && p.y >= t.y && p.y <= t.y + trunkHeight) return true;
  }
  return false;
}
function terrainBlocks(a: THREE.Vector3, b: THREE.Vector3): boolean {
  const steps = Math.ceil(a.distanceTo(b) / 0.35);
  for (let i = 1; i < steps; i++) {
    const p = a.clone().lerp(b, i / steps);
    const vx = Math.round(p.x / VOXEL_SCALE);
    const vy = Math.round(p.y / VOXEL_SCALE);
    const vz = Math.round(p.z / VOXEL_SCALE);
    if (terrain.isSolidVoxel(vx, vy, vz)) return true;
  }
  return false;
}
/**
 * Near-field exemption: inside one voxel of the reference the eye ray leaves
 * through the reference's own support column, which the DDA reports as a hit.
 * That is a probe artifact, not an occluder, so it is reported separately.
 */
const NEAR_FIELD = 3.0;
function witnessLine(a: THREE.Vector3, b: THREE.Vector3) {
  const ea = a.clone().addScaledVector(UP, EYE);
  const eb = b.clone().addScaledVector(UP, EYE);
  const horizontal = Math.hypot(ea.x - eb.x, ea.z - eb.z);
  const distance = +ea.distanceTo(eb).toFixed(2);
  if (horizontal < NEAR_FIELD) return { clear: true, nearField: true, byTerrain: false, byTrunk: false, distance };
  const byTerrain = terrainBlocks(ea, eb);
  const byTrunk = trunkBlocks(ea, eb);
  return { clear: !byTerrain && !byTrunk, nearField: false, byTerrain, byTrunk, distance };
}

// --- trace sampling rule ---------------------------------------------------
function traceSamples(points: THREE.Vector3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  if (points.length === 0) return out;
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
      const step = Math.max(0.05, remaining);
      travelled += step;
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

function plan(from: THREE.Vector3, to: THREE.Vector3) {
  return planAgentSurfaceRoute(terrain, PLANET_SIZE, from, to, WORKER_ROUTE_OPTIONS);
}

interface Leg { mode: string; reason: string; waypoints: THREE.Vector3[]; visited: number }
function legOf(from: THREE.Vector3, to: THREE.Vector3): Leg {
  const r = plan(from, to);
  return { mode: r.mode, reason: r.reason, waypoints: r.waypoints, visited: r.visitedCells };
}

function evaluateRoute(name: string, legs: Leg[], reference: THREE.Vector3) {
  const waypoints: THREE.Vector3[] = [];
  for (const leg of legs) {
    for (const w of leg.waypoints) {
      if (waypoints.length && waypoints[waypoints.length - 1].distanceTo(w) < 1e-4) continue;
      waypoints.push(w.clone());
    }
  }
  const length = groundedSurfaceRouteLength(waypoints.map(position => ({ position })), UP);
  const samples = traceSamples(waypoints);
  const los = samples.map(p => witnessLine(p, reference));
  const blocked = los.filter(l => !l.clear);
  const firstBlockedIndex = los.findIndex(l => !l.clear);
  const nearField = los.filter(l => l.nearField).length;
  return {
    name,
    legs: legs.map(l => ({ mode: l.mode, reason: l.reason, waypoints: l.waypoints.length, visitedCells: l.visited })),
    walkable: legs.every(l => l.mode === 'walk'),
    waypointCount: waypoints.length,
    walkedLength: +length.toFixed(2),
    lengthWithinBudget: length <= MAX_TRACE_LENGTH,
    traceSampleCount: samples.length,
    pointsWithinBudget: samples.length <= MAX_TRACE_POINTS,
    witnessReference: v3(reference),
    witnessNearFieldExemptSamples: nearField,
    witnessClearSamples: samples.length - blocked.length,
    witnessBlockedSamples: blocked.length,
    witnessBlockedByTerrain: blocked.filter(b => b.byTerrain).length,
    witnessBlockedByTrunk: blocked.filter(b => b.byTrunk).length,
    firstBlockedSampleIndex: firstBlockedIndex,
    firstBlockedSamplePosition: firstBlockedIndex >= 0 ? v3(samples[firstBlockedIndex]) : null,
    maxWitnessDistance: +Math.max(...los.map(l => l.distance)).toFixed(2),
    endpoints: { start: v3(waypoints[0]), end: v3(waypoints[waypoints.length - 1]) }
  };
}

// --- endpoints -------------------------------------------------------------
// Start reference: the dry standable column beside the wreck relay (the
// treatment's "wreck/relay as the approach").
function nearestDry(seed: THREE.Vector3, maxRadius = 8, minDistance = 0) {
  const s = toVoxel(seed);
  for (let r = 0; r <= maxRadius; r++) {
    let best: { d: number; p: THREE.Vector3 } | null = null;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const hit = dryStandable(s.x + dx, s.z + dz);
      if (!hit) continue;
      if (hit.world.distanceTo(seed) < minDistance) continue;
      const d = hit.world.distanceTo(seed);
      if (!best || d < best.d) best = { d, p: hit.world };
    }
    if (best) return best.p;
  }
  return null;
}

const relayStand = nearestDry(relay.position);
const endRef = nearestDry(pond.shore);
// The reference must stand CLEAR of the trunk collider, otherwise every witness
// line trivially intersects the trunk box it originates inside.
const treeStand = nearestDry(tree.position, 8, 3);
if (!relayStand || !endRef || !treeStand) throw new Error('probe: could not resolve dry endpoints');
// chapter-story-treatment.md#arena-and-the-initial-contradiction:
// the arena is tree <-> pond shore; the wreck/relay is only the approach.
const startRef = treeStand;

// --- Route A: shortest planner answer (the "shorter bend" candidate) -------
const routeA = evaluateRoute('A-direct-shorter', [legOf(startRef, endRef)], startRef);

// --- Route B: outer detour around the far side of the tree ------------------
// Deterministic detour selection: ring of dry standable columns at radius 8-14
// voxels from the tree, on the opposite side of the straight start->end line,
// choosing the candidate that yields the longest fully-walkable route still
// inside the 120-unit / 128-point budget.
const straight = endRef.clone().sub(startRef).setY(0).normalize();
const sideNormal = new THREE.Vector3().crossVectors(UP, straight).normalize();
const detourCandidates: Array<{ p: THREE.Vector3; offset: number; radius: number }> = [];
const tv = toVoxel(tree.position);
for (let r = 6; r <= 14; r++) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const hit = dryStandable(tv.x + dx, tv.z + dz);
    if (!hit) continue;
    const offset = hit.world.clone().sub(startRef).dot(sideNormal);
    detourCandidates.push({ p: hit.world, offset, radius: r });
  }
}
detourCandidates.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset));

let routeB: ReturnType<typeof evaluateRoute> | null = null;
let detourUsed: THREE.Vector3 | null = null;
let detoursTried = 0;
const rejections = { notWalkable: 0, overLengthBudget: 0, overPointBudget: 0, notLonger: 0, witnessBroken: 0 };
let bestRejected: ReturnType<typeof evaluateRoute> | null = null;
for (const candidate of detourCandidates.slice(0, 60)) {
  detoursTried++;
  const leg1 = legOf(startRef, candidate.p);
  if (leg1.mode !== 'walk') { rejections.notWalkable++; continue; }
  const leg2 = legOf(candidate.p, endRef);
  if (leg2.mode !== 'walk') { rejections.notWalkable++; continue; }
  const evaluated = evaluateRoute('B-outer-detour', [leg1, leg2], startRef);
  if (!evaluated.lengthWithinBudget) { rejections.overLengthBudget++; if (!bestRejected) bestRejected = evaluated; continue; }
  if (!evaluated.pointsWithinBudget) { rejections.overPointBudget++; if (!bestRejected) bestRejected = evaluated; continue; }
  if (evaluated.walkedLength <= routeA.walkedLength * 1.15) { rejections.notLonger++; continue; }
  if (evaluated.witnessBlockedSamples > 0) rejections.witnessBroken++;
  // Keep the longest budget-legal walkable detour; prefer zero witness breaks.
  const better = !routeB
    || (routeB.witnessBlockedSamples > 0 && evaluated.witnessBlockedSamples === 0)
    || (routeB.witnessBlockedSamples === 0) === (evaluated.witnessBlockedSamples === 0)
      && evaluated.walkedLength > routeB.walkedLength;
  if (better) { routeB = evaluated; detourUsed = candidate.p; }
}

// --- occlusion census: can this corridor's terrain occlude a witness line? --
const corridorMin = { x: Math.min(startRef.x, endRef.x) - 20, z: Math.min(startRef.z, endRef.z) - 20 };
const corridorMax = { x: Math.max(startRef.x, endRef.x) + 20, z: Math.max(startRef.z, endRef.z) + 20 };
let censusDry = 0, censusBlockedTerrain = 0, censusBlockedTrunk = 0;
const blockedExamples: unknown[] = [];
for (let wx = corridorMin.x; wx <= corridorMax.x; wx += VOXEL_SCALE) {
  for (let wz = corridorMin.z; wz <= corridorMax.z; wz += VOXEL_SCALE) {
    const hit = dryStandable(Math.round(wx / VOXEL_SCALE), Math.round(wz / VOXEL_SCALE));
    if (!hit) continue;
    censusDry++;
    const line = witnessLine(hit.world, startRef);
    if (line.byTerrain) { censusBlockedTerrain++; if (blockedExamples.length < 5) blockedExamples.push({ from: v3(hit.world), distance: line.distance }); }
    if (line.byTrunk) censusBlockedTrunk++;
  }
}

// --- Intermediate witness feasibility for the shorter route ----------------
// If route A has blocked samples, does a single dry standable position exist
// that sees BOTH the blocked span and the start reference?
let intermediateWitness: unknown = null;
if (routeA.firstBlockedSampleIndex >= 0 && routeA.firstBlockedSamplePosition) {
  const blockedPoint = new THREE.Vector3(
    routeA.firstBlockedSamplePosition.x,
    routeA.firstBlockedSamplePosition.y,
    routeA.firstBlockedSamplePosition.z
  );
  const mid = blockedPoint.clone().add(startRef).multiplyScalar(0.5);
  const mv = toVoxel(mid);
  let found: { p: THREE.Vector3; toStart: number; toBlocked: number } | null = null;
  for (let r = 0; r <= 10 && !found; r++) {
    for (let dx = -r; dx <= r && !found; dx++) for (let dz = -r; dz <= r && !found; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const hit = dryStandable(mv.x + dx, mv.z + dz);
      if (!hit) continue;
      const a = witnessLine(hit.world, startRef);
      const b = witnessLine(hit.world, blockedPoint);
      if (a.clear && b.clear) found = { p: hit.world, toStart: a.distance, toBlocked: b.distance };
    }
  }
  intermediateWitness = found
    ? { exists: true, position: v3(found.p), distanceToStartReference: found.toStart, distanceToBlockedSpan: found.toBlocked }
    : { exists: false };
}

const report = {
  probe: 'common-ground geometry feasibility',
  generatedAt: new Date().toISOString(),
  derivation: 'source-derived (pristine procedural terrain; no live voxel edits, no render, no GPU)',
  world: {
    planetSize: PLANET_SIZE,
    storyCoordinate: STORY_COORDINATE,
    storySeed: STORY_SEED,
    worldId: STORY_PRIMARY_WORLD_ID,
    voxelScale: VOXEL_SCALE,
    voxelCount: voxels.length
  },
  workerRouteOptions: WORKER_ROUTE_OPTIONS,
  traceContract: { maxPoints: MAX_TRACE_POINTS, maxLengthUnits: MAX_TRACE_LENGTH, sampleSpacing: SAMPLE_SPACING, minSeparation: MIN_SAMPLE_SEPARATION },
  anchors: {
    heroTree: { position: v3(tree.position), up: v3(tree.up), trunkHeight: +trunkHeight.toFixed(3), trunkColliderHalfExtentXZ: TRUNK_HALF },
    pond: { surface: v3(pond.surface), shore: v3(pond.shore), floor: v3(pond.floor), depthVoxels: pond.depth },
    wreckRelay: { position: v3(relay.position) },
    signalMesa: { position: v3(mesa.position) },
    podImpact: { position: v3(pod.position) },
    fieldPack: pack ? { position: v3(pack.position), supportVoxel: pack.supportVoxel, relocated: pack.relocated } : null,
    auditWorkerPathPoints: auditPath ? auditPath.length : 0
  },
  derivedEndpoints: {
    arenaStartReferenceAtTree: v3(startRef),
    approachReferenceNearRelay: v3(relayStand),
    relayToTreeDistance: +relayStand.distanceTo(treeStand).toFixed(2),
    endReferenceOnPondShore: v3(endRef),
    dryStandNearTree: v3(treeStand),
    straightStartToEndDistance: +startRef.distanceTo(endRef).toFixed(2),
    treeToStartDistance: +tree.position.distanceTo(startRef).toFixed(2),
    treeToEndDistance: +tree.position.distanceTo(endRef).toFixed(2),
    directStartEndWitnessLine: witnessLine(startRef, endRef)
  },
  routeA,
  routeB,
  routeBDetour: detourUsed ? v3(detourUsed) : null,
  routeBDetourCandidatesTried: detoursTried,
  routeBDetourCandidatePool: detourCandidates.length,
  routeBRejections: rejections,
  routeBFirstRejectedExample: bestRejected,
  intermediateWitnessForRouteA: intermediateWitness,
  corridorOcclusionCensus: {
    boundsWorld: { min: corridorMin, max: corridorMax },
    dryStandableColumns: censusDry,
    columnsWithTerrainBlockedWitnessToStart: censusBlockedTerrain,
    columnsWithTrunkBlockedWitnessToStart: censusBlockedTrunk,
    examples: blockedExamples
  }
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
