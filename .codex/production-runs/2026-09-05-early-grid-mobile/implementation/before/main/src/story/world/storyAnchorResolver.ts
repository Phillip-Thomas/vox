import * as THREE from 'three';
import { VOXEL_SCALE, voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';
import { FACE_NORMALS } from '../../utils/surfaceControls.ts';
import { planAgentSurfaceRoute, type AgentSurfaceTerrainQuery } from '../../utils/agentSurfaceNavigation.ts';
import { findValidSpawnSite, type SpawnTerrainQuery } from '../../utils/spawnValidation.ts';
import { STORY_PRIMARY_WORLD_ID } from './storyWorldIdentity.ts';
import type { StoryPropPose, FieldPackSafePose, PondPose } from './storyAnchorTypes.ts';

export const MESA_HEIGHT = 3;
export const AUDIT_WORKER_GROUND_CLEARANCE = VOXEL_SCALE / 2 + 0.05;
export const DEBRIS_MAX = 6;
type SurfaceVoxel = { x: number; y: number; z: number };
export interface StoryAnchorTerrain {
  generator: SpawnTerrainQuery;
  voxels: ReadonlyArray<SurfaceVoxel>;
  validatedArrivalCandidate?: SurfaceVoxel;
  topFaceColumns?: ReadonlyMap<string, SurfaceVoxel>;
}

/** The unchanged anchor algorithms with an explicit, worker-safe terrain source. */
export function createStoryAnchorResolver(source: StoryAnchorTerrain) {
  const getWorldGen = (_size: number, _seed: number, _worldId?: string) => source;
  let arrival = source.validatedArrivalCandidate;
  let topColumns = source.topFaceColumns;
  const findTopFaceSurfaceVoxel = (size: number, seed: number, preferred = { x: 4, z: -4 }, _worldId?: string): SurfaceVoxel => {
    if (preferred.x === 4 && preferred.z === -4) {
      if (!arrival) {
        const site = findValidSpawnSite(source.generator, size, new THREE.Vector3(preferred.x * VOXEL_SCALE, size, preferred.z * VOXEL_SCALE), {
          kind: 'ship', face: 'top', requirePlayerEgress: true, maxSearchRadius: Math.floor(size / VOXEL_SCALE) * 2
        });
        if (!site) throw new Error(`No dry, level arrival pad exists for terrain seed ${seed}.`);
        arrival = { ...site.supportVoxel };
      }
      return { ...arrival };
    }
    if (!topColumns) {
      const columns = new Map<string, SurfaceVoxel>();
      for (const voxel of source.voxels) {
        if (voxel.y < 0) continue;
        const key = `${voxel.x},${voxel.z}`;
        const current = columns.get(key);
        if (!current || voxel.y > current.y) columns.set(key, voxel);
      }
      topColumns = columns;
    }
    let best: SurfaceVoxel | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    for (const voxel of topColumns.values()) {
      const dx = voxel.x - preferred.x;
      const dz = voxel.z - preferred.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < bestDistanceSq || (distanceSq === bestDistanceSq && best && voxel.y > best.y)) {
        best = voxel;
        bestDistanceSq = distanceSq;
      }
    }
    return best ? { ...best } : { x: 0, y: Math.floor(size / 2), z: 0 };
  };
  const rangeInclusive = (a: number, b: number): number[] => {
    const out: number[] = [];
    for (let v = a; v <= b; v++) out.push(v);
    return out;
  };

function surfacePoseNear(
  planetSize: number,
  terrainSeed: number,
  voxelOffsetX: number,
  voxelOffsetZ: number,
  lift: number
): StoryPropPose {
  const arrival = findTopFaceSurfaceVoxel(
    planetSize,
    terrainSeed,
    { x: 4, z: -4 },
    STORY_PRIMARY_WORLD_ID
  );
  const voxel = findTopFaceSurfaceVoxel(planetSize, terrainSeed, {
    x: arrival.x + voxelOffsetX,
    z: arrival.z + voxelOffsetZ
  }, STORY_PRIMARY_WORLD_ID);
  const center = voxelCoordToWorld(voxel.x, voxel.y, voxel.z);
  // This helper samples the TOP cube face explicitly. Its normal is therefore
  // grid +Y everywhere on that face — never the spherical/radial direction to
  // the planet centre. Radial up increasingly tilts props (most visibly the
  // arriving auditor) as their X/Z offset approaches a cube edge.
  const up = FACE_NORMALS.top.clone();
  return { position: center.clone().addScaledVector(up, lift), up };
}

/** Height of the signal mesa the iso era teaches height on (voxel steps). */


/** The mesa's ground pose — the stepped voxel rise the iso era teaches height on. */
function getSignalMesaPose(planetSize: number, terrainSeed: number): StoryPropPose {
  // The mesa deliberately leaves the work row AFTER NAV VIEW unlocks the second
  // ground axis. This keeps the 2D strip readable and makes the overhead reveal
  // mechanically meaningful instead of merely changing the camera angle.
  return surfacePoseNear(planetSize, terrainSeed, 14, -8, 0.5);
}

/**
 * The signal mesa's SUMMIT — the top of the iso-era climb. The ch1-iso→ch1-lift
 * gate and the 'SIGNAL SOURCE' marker key on this. (This is exactly where the
 * anomaly stone used to sit; the stone has since moved across a gravity edge to
 * the adjacent face, so the summit is now the mesa's own landmark.)
 */
function getSignalMesaSummit(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, 14, -8, 0.5 + MESA_HEIGHT + 0.9);
}

/**
 * The smooth anomaly stone: on the cube face ADJACENT to the arrival (top) face —
 * a few voxels DOWN past the top→right (+X) edge, so after the first-person lift
 * the player must traverse a dynamic-gravity edge to reach it. Oriented to the
 * +X face normal (cube gravity, not the spherical normal). Deterministic.
 */
function getAnomalyStonePose(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseOnAdjacentFace(planetSize, terrainSeed);
}

/**
 * A surface pose on the cube face ADJACENT to the arrival (top) face, reached by
 * crossing exactly one gravity edge. We cross the top→right (+X) edge — the mesa
 * already leans that way — then step EDGE_DROP voxels down the +X face so the
 * point is unambiguously on the neighbour (dominant axis = X). The crossing is a
 * short walk from the mesa summit (~13 voxels) yet forces one face transition.
 * Deterministic from planetSize/terrainSeed; `up` is the +X face normal.
 */
function surfacePoseOnAdjacentFace(planetSize: number, terrainSeed: number): StoryPropPose {
  const EDGE_DROP = 6; // voxels below the top edge — well clear of the edge hysteresis
  const arrival = findTopFaceSurfaceVoxel(
    planetSize,
    terrainSeed,
    { x: 4, z: -4 },
    STORY_PRIMARY_WORLD_ID
  );
  const { voxels } = getWorldGen(
    planetSize,
    terrainSeed,
    STORY_PRIMARY_WORLD_ID
  );
  const solid = new Set<string>();
  let radius = 0;
  for (const v of voxels) {
    solid.add(`${v.x},${v.y},${v.z}`);
    radius = Math.max(radius, Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  }
  const y = radius - EDGE_DROP; // down the +X face, past the top edge
  const z = arrival.z - 8;      // continue from the post-NAV mesa toward the edge
  // Outermost solid voxel along +X in this column = the +X face's flat surface.
  let surfX = radius;
  while (surfX > 0 && !solid.has(`${surfX},${y},${z}`)) surfX--;
  const up = FACE_NORMALS.right.clone(); // +X face normal — NOT the spherical up
  const center = voxelCoordToWorld(surfX, y, z);
  // Lift out along the face normal so the stone rests ON the surface (the voxel
  // centre sits one half-extent inside; the extra clears the squashed icosahedron).
  return { position: center.clone().addScaledVector(up, 1.6), up };
}

/**
 * Triangulation waypoints for the top-down era: an ORDERED route from the work
 * strip toward the signal mesa. Offsets are (along, depth) voxel units in the
 * side plane's frame, mirroring the supply pods.
 */
function getNavWaypointPoses(
  planetSize: number,
  terrainSeed: number,
  terrain: AgentSurfaceTerrainQuery = proceduralAgentTerrain(planetSize, terrainSeed)
): StoryPropPose[] {
  // The first fix steps visibly off the old work line; the remaining dogleg
  // teaches both overhead axes and ends short of the mesa's isometric climb.
  const offsets: Array<[number, number]> = [[6, 2], [11, -3], [10, -7]];
  const NAV_BEACON_LIFT = 0.6;
  const spawnTerrain = spawnTerrainFromAgent(terrain);
  return offsets.map(([x, z]) => {
    const raw = surfacePoseNear(planetSize, terrainSeed, x, z, NAV_BEACON_LIFT);
    // Dry-landing guarantee: a triangulation beacon dropped in (or just behind)
    // water strands the top-down autopilot at the shoreline — it steers toward a
    // fix it can never stand on. Nudge each fix to the nearest validated dry pad
    // on the same top face, using the shared spawn/terrain sampler (isWaterVoxel
    // aware) rather than a bespoke route planner. The A* authority then always
    // has a dry or jetpack-reachable target. If the bounded search finds no dry
    // pad we keep the raw pose (never worse than before the guarantee).
    const site = findValidSpawnSite(spawnTerrain, planetSize, raw.position, {
      kind: 'player',
      face: 'top',
      maxSearchRadius: 8
    });
    if (!site) return raw;
    return {
      position: voxelCoordToWorld(
        site.supportVoxel.x,
        site.supportVoxel.y,
        site.supportVoxel.z
      ).addScaledVector(site.up, NAV_BEACON_LIFT),
      up: site.up.clone()
    };
  });
}

/**
 * The raster era's side plane: anchored at the spawn, travelling along ONE
 * world axis (±X or ±Z, whichever points more toward the signal mesa). Fully
 * grid-aligned on purpose — the camera looks square at a single cube face, so
 * the view reads as a true 2D elevation, never an isometric corner.
 * depthAxis = travel × up; the side camera hangs at +depth. Deterministic.
 */
function getStorySidePlane(planetSize: number, terrainSeed: number): {
  origin: THREE.Vector3;
  travelAxis: THREE.Vector3;
  depthAxis: THREE.Vector3;
  up: THREE.Vector3;
} {
  const arrival = findTopFaceSurfaceVoxel(
    planetSize,
    terrainSeed,
    { x: 4, z: -4 },
    STORY_PRIMARY_WORLD_ID
  );
  const originCenter = voxelCoordToWorld(arrival.x, arrival.y, arrival.z);
  // Voxel-grid-aligned up (the arrival site is on the top face): a side-scroller
  // wants a level horizon and grid-square blocks, not the spherical normal.
  const up = new THREE.Vector3(0, 1, 0);
  // The mesa summit is the on-face landmark the strip travels toward (the anomaly
  // stone now sits across a gravity edge, so it can't define the flat side plane).
  const mesa = getSignalMesaSummit(planetSize, terrainSeed);
  const toMesa = mesa.position.clone().sub(originCenter);
  // Snap to the dominant world axis: -x/+x (or -z/+z) travel, one cube face on screen.
  const travelAxis = Math.abs(toMesa.x) >= Math.abs(toMesa.z)
    ? new THREE.Vector3(Math.sign(toMesa.x) || 1, 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(toMesa.z) || 1);
  const depthAxis = travelAxis.clone().cross(up).normalize();
  const origin = originCenter.clone().addScaledVector(up, 1);
  return { origin, travelAxis, depthAxis, up };
}

/**
 * The crash pod's impact site — the single source of truth shared by the voxel
 * DescentPod (which lands its smoking wreck here) and the post-awakening hi-fi
 * ship it converts into (which perches its crashed hull here). Deterministic per
 * seed; the position is the pod's ground contact point (the descent adds its own
 * small hull lift on top).
 */
function getPodImpactPose(planetSize: number, terrainSeed: number): StoryPropPose {
  const plane = getStorySidePlane(planetSize, terrainSeed);
  return { position: plane.origin.clone().addScaledVector(plane.travelAxis, -5), up: plane.up.clone() };
}

/**
 * Supply pods for the last profile-era recovery run. The physical 2D strip has
 * one authoritative traversable row, so every pod that gates NAV VIEW is on
 * that row. Offsets are along the strip in voxel units; the next beat reveals
 * the broader terrain from overhead after the recovery is complete.
 */
function getSupplyPodPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
  const plane = getStorySidePlane(planetSize, terrainSeed);
  const alongX = Math.abs(plane.travelAxis.x) > 0.5;
  // Distinct from the debris offsets so the recovered hull remains readable.
  // Keep the whole recovery inside the pinned world's verified dry plateau;
  // farther ends of this row descend into the shoreline and are not walkable.
  const offsets = [-12, 1, 13];
  return offsets.map(offset =>
    surfacePoseNear(
      planetSize,
      terrainSeed,
      alongX ? offset * Math.sign(plane.travelAxis.x) : 0,
      alongX ? 0 : offset * Math.sign(plane.travelAxis.z),
      0.7
    )
  );
}

/** The hero apple tree: farther out, opposite direction — a committed walk. */
function getHeroTreePose(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, -16, 14, 0.95);
}

/**
 * The field pack torn from W-7744 during A4. This is a validated prop spawn, not
 * a decorative offset: it needs a level dry footprint and clear humanoid
 * approach because the kit is the sole causal source of the Maw repair.
 */
function getFieldPackPose(
  planetSize: number,
  terrainSeed: number,
  terrain: AgentSurfaceTerrainQuery = proceduralAgentTerrain(planetSize, terrainSeed)
): FieldPackSafePose | null {
  const tree = getHeroTreePose(planetSize, terrainSeed);
  const preferred = tree.position.clone().add(new THREE.Vector3(7, 0, -5));
  const site = findValidSpawnSite(
    spawnTerrainFromAgent(terrain),
    planetSize,
    preferred,
    { kind: 'player', face: 'top', maxSearchRadius: 10 }
  );
  if (!site) return null;
  return {
    position: voxelCoordToWorld(
      site.supportVoxel.x,
      site.supportVoxel.y,
      site.supportVoxel.z
    ).addScaledVector(site.up, VOXEL_SCALE / 2 + 0.18),
    up: site.up.clone(),
    supportVoxel: Object.freeze({ ...site.supportVoxel }),
    relocated: site.relocated
  };
}

const pondCache = new Map<string, PondPose | null>();

/**
 * Deterministic nearest-water scan on the top face: ring-search outward from the
 * arrival column for a flooded cell above ground (prefer depth ≥ 2 — the dive
 * needs a floor below the surface). Cached per size:seed; asserted in
 * storyWorld.test.ts (the pinned world must keep its pond within reach).
 */
function getPondPose(
  planetSize: number,
  terrainSeed: number,
  worldId?: string
): PondPose | null {
  const resolvedWorldId = worldId ?? STORY_PRIMARY_WORLD_ID;
  const key = `${planetSize}:${terrainSeed}:${resolvedWorldId}`;
  const cached = pondCache.get(key);
  if (cached !== undefined) return cached;

  const gen = getWorldGen(planetSize, terrainSeed, resolvedWorldId).generator;
  const arrival = findTopFaceSurfaceVoxel(
    planetSize,
    terrainSeed,
    { x: 4, z: -4 },
    resolvedWorldId
  );

  const dryShoreNear = (waterX: number, waterZ: number): THREE.Vector3 | null => {
    const candidates: Array<{ x: number; z: number; radius: number; arrivalDistance: number }> = [];
    for (let radius = 1; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = waterX + dx;
          const z = waterZ + dz;
          candidates.push({
            x,
            z,
            radius,
            arrivalDistance: (x - arrival.x) ** 2 + (z - arrival.z) ** 2
          });
        }
      }
    }
    // Nearest shoreline first; ties prefer the arrival side so the authored walk
    // approaches the pond instead of circling behind it.
    candidates.sort((a, b) => a.radius - b.radius
      || a.arrivalDistance - b.arrivalDistance
      || a.x - b.x
      || a.z - b.z);
    for (const candidate of candidates) {
      const ground = findTopFaceSurfaceVoxel(
        planetSize,
        terrainSeed,
        candidate,
        resolvedWorldId
      );
      if (gen.isWaterVoxel(ground.x, ground.y + 1, ground.z)) continue;
      if (gen.isWaterVoxel(ground.x, ground.y + 2, ground.z)) continue;
      return voxelCoordToWorld(ground.x, ground.y, ground.z)
        .addScaledVector(FACE_NORMALS.top, 1.05);
    }
    return null;
  };

  const waterAt = (ox: number, oz: number): { voxel: { x: number; y: number; z: number }; depth: number } | null => {
    const ground = findTopFaceSurfaceVoxel(
      planetSize,
      terrainSeed,
      {
        x: arrival.x + ox,
        z: arrival.z + oz
      },
      resolvedWorldId
    );
    if (!gen.isWaterVoxel(ground.x, ground.y + 1, ground.z)) return null;
    let depth = 1;
    while (depth < 8 && gen.isWaterVoxel(ground.x, ground.y + 1 + depth, ground.z)) depth++;
    return { voxel: { x: ground.x, y: ground.y, z: ground.z }, depth };
  };

  let shallow: PondPose | null = null;
  for (let radius = 3; radius <= 60; radius += 1) {
    // Ring perimeter, stepped by 2 to keep the scan cheap; determinism holds
    // because the iteration order is fixed.
    for (let x = -radius; x <= radius; x += 2) {
      for (const z of Math.abs(x) === radius ? rangeInclusive(-radius, radius).filter(v => v % 2 === 0) : [-radius, radius]) {
        const hit = waterAt(x, z);
        if (!hit) continue;
        // This is explicitly a top-face scan. Radial up tilts the authored point
        // toward the cube corner and can round an apparently dry shore into water.
        const up = FACE_NORMALS.top.clone();
        const surfaceVoxelY = hit.voxel.y + hit.depth;
        const surface = voxelCoordToWorld(hit.voxel.x, surfaceVoxelY, hit.voxel.z).addScaledVector(up, 0.5);
        const floor = voxelCoordToWorld(hit.voxel.x, hit.voxel.y, hit.voxel.z).addScaledVector(up, 0.6);
        const shore = dryShoreNear(hit.voxel.x, hit.voxel.z);
        if (!shore) continue;
        const pose: PondPose = { surface, shore, floor, up, depth: hit.depth };
        if (hit.depth >= 2) {
          pondCache.set(key, pose);
          return pose;
        }
        if (!shallow) shallow = pose;
      }
    }
  }
  pondCache.set(key, shallow);
  return shallow;
}

/** The Keel Memory rests on the actual pond floor inside the authored medium. */
function getKeelMemoryPose(planetSize: number, terrainSeed: number): StoryPropPose | null {
  const pond = getPondPose(planetSize, terrainSeed);
  if (!pond || pond.depth < 2) return null;
  return {
    position: pond.floor.clone().addScaledVector(pond.up, 0.18),
    up: pond.up.clone()
  };
}

/**
 * The wreck relay: the network's re-established voice, planted at the crash
 * strip's impact site (the DescentPod's landmark) — chapter 4's set-piece anchor.
 */
function getWreckRelayPose(planetSize: number, terrainSeed: number): StoryPropPose {
  const plane = getStorySidePlane(planetSize, terrainSeed);
  const alongX = Math.abs(plane.travelAxis.x) > 0.5;
  // Beside the pod impact point (impact sits at -5 along the travel axis).
  const along = -5 * (alongX ? Math.sign(plane.travelAxis.x) : Math.sign(plane.travelAxis.z));
  return surfacePoseNear(
    planetSize,
    terrainSeed,
    alongX ? along : 2,
    alongX ? 2 : along,
    1.0 // surface poses are voxel centers; the console's base sits ON the ground
  );
}

/** Root clearance above a support voxel centre: one half voxel + contact margin. */


function proceduralAgentTerrain(planetSize: number, terrainSeed: number): AgentSurfaceTerrainQuery {
  const generator = getWorldGen(
    planetSize,
    terrainSeed,
    STORY_PRIMARY_WORLD_ID
  ).generator;
  return {
    isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
    isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
    isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
  };
}

function spawnTerrainFromAgent(terrain: AgentSurfaceTerrainQuery): SpawnTerrainQuery {
  return {
    shouldVoxelExist: terrain.isSolidVoxel,
    isWaterVoxel: terrain.isWaterVoxel,
    // Spawn validation only distinguishes hazardous support from ordinary solid
    // support; retain that semantic without inventing a second terrain query.
    generateBlockForPosition: (x, y, z) =>
      terrain.isHazardousVoxel?.(x, y, z) ? 'lava' : 'stone'
  };
}

/**
 * The auditor's approach: a validated dry humanoid spawn plus a contiguous
 * one-cell surface route down to the wreck relay. The optional terrain query is
 * the live-world adapter at runtime, so player edits and dynamic water are
 * authoritative; tests and static consumers fall back to the pinned generator.
 */
function getAuditWorkerPath(
  planetSize: number,
  terrainSeed: number,
  terrain: AgentSurfaceTerrainQuery = proceduralAgentTerrain(planetSize, terrainSeed)
): StoryPropPose[] {
  const arrival = findTopFaceSurfaceVoxel(
    planetSize,
    terrainSeed,
    { x: 4, z: -4 },
    STORY_PRIMARY_WORLD_ID
  );
  // Begin beyond the sunrise ridge but still inside the owned top face. The old
  // +34 request exceeded the cube, collapsed three samples onto the same edge
  // cell, and that cell was flooded in the pinned world.
  const preferredStart = voxelCoordToWorld(arrival.x + 20, arrival.y, arrival.z - 1);
  const spawn = findValidSpawnSite(
    spawnTerrainFromAgent(terrain),
    planetSize,
    preferredStart,
    { kind: 'player', face: 'top', maxSearchRadius: 8 }
  );
  if (!spawn) return [];

  const up = FACE_NORMALS.top;
  const start = voxelCoordToWorld(
    spawn.supportVoxel.x,
    spawn.supportVoxel.y,
    spawn.supportVoxel.z
  ).addScaledVector(up, AUDIT_WORKER_GROUND_CLEARANCE);
  // He finishes between the site and relay, clear of the wreck and console,
  // then turns to face the anomalous worker.
  const goal = surfacePoseNear(
    planetSize,
    terrainSeed,
    -2,
    1,
    AUDIT_WORKER_GROUND_CLEARANCE
  ).position;
  const route = planAgentSurfaceRoute(terrain, planetSize, start, goal, {
    face: 'top',
    differentFaceFallback: 'unreachable',
    clearanceCells: 2,
    maxSlopeCells: 1,
    edgeMarginCells: 1,
    maxVisitedCells: 8192,
    waypointClearanceWorld: AUDIT_WORKER_GROUND_CLEARANCE,
    // W-7744 is walking into frame. A blocked dry route means he waits offstage;
    // it never silently changes his fiction into swimming or jetpacking.
    allowJetpackCrossing: false
  });
  if (route.mode !== 'walk' && route.mode !== 'direct') return [];
  return route.waypoints.map(position => ({ position, up: up.clone() }));
}

/** Max debris pieces the descent can scatter (voyage hull outcome trims it). */


/**
 * Hull-debris scatter along the raster travel strip: deterministic poses on
 * both sides of the spawn so the 2D act has ground to cover. Offsets are in
 * voxel units along the strip's dominant axis (the side plane is axis-aligned).
 */
function getDebrisPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
  const plane = getStorySidePlane(planetSize, terrainSeed);
  const alongX = Math.abs(plane.travelAxis.x) > 0.5;
  const offsets = [-9, 6, -14, 11, -4, 14]; // interleaved, all inside the dry plateau
  return offsets.slice(0, DEBRIS_MAX).map(offset =>
    surfacePoseNear(
      planetSize,
      terrainSeed,
      alongX ? offset * Math.sign(plane.travelAxis.x) : 0,
      alongX ? 0 : offset * Math.sign(plane.travelAxis.z),
      0.8
    )
  );
}

return { getSignalMesaPose, getSignalMesaSummit, getAnomalyStonePose, getNavWaypointPoses, getStorySidePlane, getPodImpactPose, getSupplyPodPoses, getHeroTreePose, getFieldPackPose, getPondPose, getKeelMemoryPose, getWreckRelayPose, getAuditWorkerPath, getDebrisPoses };
}

export type StoryAnchorResolver = ReturnType<typeof createStoryAnchorResolver>;
export type PreparedStoryAnchors = { [K in keyof StoryAnchorResolver]: ReturnType<StoryAnchorResolver[K]> };

export function prepareStoryAnchors(source: StoryAnchorTerrain, size: number, seed: number): PreparedStoryAnchors {
 const resolver = createStoryAnchorResolver(source);
 return {
  getSignalMesaPose: resolver.getSignalMesaPose(size, seed),
  getSignalMesaSummit: resolver.getSignalMesaSummit(size, seed),
  getAnomalyStonePose: resolver.getAnomalyStonePose(size, seed),
  getNavWaypointPoses: resolver.getNavWaypointPoses(size, seed),
  getStorySidePlane: resolver.getStorySidePlane(size, seed),
  getPodImpactPose: resolver.getPodImpactPose(size, seed),
  getSupplyPodPoses: resolver.getSupplyPodPoses(size, seed),
  getHeroTreePose: resolver.getHeroTreePose(size, seed),
  getFieldPackPose: resolver.getFieldPackPose(size, seed),
  getPondPose: resolver.getPondPose(size, seed),
  getKeelMemoryPose: resolver.getKeelMemoryPose(size, seed),
  getWreckRelayPose: resolver.getWreckRelayPose(size, seed),
  getAuditWorkerPath: resolver.getAuditWorkerPath(size, seed),
  getDebrisPoses: resolver.getDebrisPoses(size, seed),
 };
}
