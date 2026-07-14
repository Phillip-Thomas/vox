import * as THREE from 'three';
import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import {
  coordinateToSeed,
  type WorldCoordinate
} from '../../utils/worldCoordinates.ts';
import { findTopFaceSurfaceVoxel } from '../../utils/worldArrival.ts';
import { VOXEL_SCALE, voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';
import { FACE_NORMALS } from '../../utils/surfaceControls.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import {
  planAgentSurfaceRoute,
  type AgentSurfaceTerrainQuery
} from '../../utils/agentSurfaceNavigation.ts';
import { findValidSpawnSite, type SpawnTerrainQuery } from '../../utils/spawnValidation.ts';

// --- The story world ------------------------------------------------------------
//
// Story mode plays on ONE pinned planet so every prop pose, quota resource, and
// scripted vantage is deterministic and art-directable. Verdant specifically:
// trees, grass, biofiber, loose stone, no hazards — everything Ch1's quota and
// Ch3's campfire need — and the hero apple tree reads against a green world.
//
// The coordinate is found by a deterministic outward ring scan (not a seeded rng)
// so the pin survives rng-implementation changes; asserted in storyWorld.test.ts.

function findStoryCoordinate(): WorldCoordinate {
  for (let radius = 1; radius <= 100; radius++) {
    for (let x = -radius; x <= radius; x++) {
      for (const y of x === -radius || x === radius
        ? rangeInclusive(-radius, radius)
        : [-radius, radius]) {
        if (archetypeForSeed(coordinateToSeed(x, y)) === 'verdant') return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

function rangeInclusive(a: number, b: number): number[] {
  const out: number[] = [];
  for (let v = a; v <= b; v++) out.push(v);
  return out;
}

export const STORY_COORDINATE: WorldCoordinate = findStoryCoordinate();

export const STORY_SEED = coordinateToSeed(STORY_COORDINATE.x, STORY_COORDINATE.y);

export function isStoryWorld(coordinate: WorldCoordinate): boolean {
  return coordinate.x === STORY_COORDINATE.x && coordinate.y === STORY_COORDINATE.y;
}

export function isStoryWorldSeed(seed: number): boolean {
  return seed === STORY_SEED;
}

// --- deterministic prop poses -----------------------------------------------------
//
// Props are placed RELATIVE TO the (deterministic) arrival site, not the other
// way around — the spawn code never changes, and mid-story reloads (which spawn
// at the saved pose) still find the props where they were.

export interface StoryPropPose {
  position: THREE.Vector3;
  up: THREE.Vector3;
}

function surfacePoseNear(
  planetSize: number,
  terrainSeed: number,
  voxelOffsetX: number,
  voxelOffsetZ: number,
  lift: number
): StoryPropPose {
  const arrival = findTopFaceSurfaceVoxel(planetSize, terrainSeed);
  const voxel = findTopFaceSurfaceVoxel(planetSize, terrainSeed, {
    x: arrival.x + voxelOffsetX,
    z: arrival.z + voxelOffsetZ
  });
  const center = voxelCoordToWorld(voxel.x, voxel.y, voxel.z);
  // This helper samples the TOP cube face explicitly. Its normal is therefore
  // grid +Y everywhere on that face — never the spherical/radial direction to
  // the planet centre. Radial up increasingly tilts props (most visibly the
  // arriving auditor) as their X/Z offset approaches a cube edge.
  const up = FACE_NORMALS.top.clone();
  return { position: center.clone().addScaledVector(up, lift), up };
}

/** Height of the signal mesa the iso era teaches height on (voxel steps). */
export const MESA_HEIGHT = 3;

/** The mesa's ground pose — the stepped voxel rise the iso era teaches height on. */
export function getSignalMesaPose(planetSize: number, terrainSeed: number): StoryPropPose {
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
export function getSignalMesaSummit(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, 14, -8, 0.5 + MESA_HEIGHT + 0.9);
}

/**
 * The smooth anomaly stone: on the cube face ADJACENT to the arrival (top) face —
 * a few voxels DOWN past the top→right (+X) edge, so after the first-person lift
 * the player must traverse a dynamic-gravity edge to reach it. Oriented to the
 * +X face normal (cube gravity, not the spherical normal). Deterministic.
 */
export function getAnomalyStonePose(planetSize: number, terrainSeed: number): StoryPropPose {
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
  const arrival = findTopFaceSurfaceVoxel(planetSize, terrainSeed);
  const { voxels } = getWorldGen(planetSize, terrainSeed);
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
export function getNavWaypointPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
  // The first fix steps visibly off the old work line; the remaining dogleg
  // teaches both overhead axes and ends short of the mesa's isometric climb.
  const offsets: Array<[number, number]> = [[6, 2], [11, -3], [10, -7]];
  return offsets.map(([x, z]) => surfacePoseNear(planetSize, terrainSeed, x, z, 0.6));
}

/**
 * The raster era's side plane: anchored at the spawn, travelling along ONE
 * world axis (±X or ±Z, whichever points more toward the signal mesa). Fully
 * grid-aligned on purpose — the camera looks square at a single cube face, so
 * the view reads as a true 2D elevation, never an isometric corner.
 * depthAxis = travel × up; the side camera hangs at +depth. Deterministic.
 */
export function getStorySidePlane(planetSize: number, terrainSeed: number): {
  origin: THREE.Vector3;
  travelAxis: THREE.Vector3;
  depthAxis: THREE.Vector3;
  up: THREE.Vector3;
} {
  const arrival = findTopFaceSurfaceVoxel(planetSize, terrainSeed);
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
export function getPodImpactPose(planetSize: number, terrainSeed: number): StoryPropPose {
  const plane = getStorySidePlane(planetSize, terrainSeed);
  return { position: plane.origin.clone().addScaledVector(plane.travelAxis, -5), up: plane.up.clone() };
}

/**
 * Supply pods for the last profile-era recovery run. The physical 2D strip has
 * one authoritative traversable row, so every pod that gates NAV VIEW is on
 * that row. Offsets are along the strip in voxel units; the next beat reveals
 * the broader terrain from overhead after the recovery is complete.
 */
export function getSupplyPodPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
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
export function getHeroTreePose(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, -16, 14, 0.95);
}

// --- the first day alive / chapter 4 -------------------------------------------------

/**
 * Live world anchors for the director/autopilot (the anomalyStoneHandle
 * pattern, computed once per mount by StoryWorldProps — the director never
 * needs planetSize/terrainSeed itself).
 */
export const storyAnchors: {
  pond: PondPose | null;
  auditPath: StoryPropPose[] | null;
  /** The live story world's seed (forage probes need it). */
  terrainSeed: number | null;
  /** Rendered cube radius in world units (shared agent navigation needs it). */
  planetSize: number | null;
} = { pond: null, auditPath: null, terrainSeed: null, planetSize: null };

export interface PondPose {
  /** A point on the water surface at the pond's near edge (drink/marker goal). */
  surface: THREE.Vector3;
  /** The last land column before the water — a dry approach point. */
  shore: THREE.Vector3;
  /** The pond floor beneath the deepest found column (ch4-dive's kit rests here). */
  floor: THREE.Vector3;
  up: THREE.Vector3;
  /** Water depth (voxels) at the found column. */
  depth: number;
}

const pondCache = new Map<string, PondPose | null>();

/**
 * Deterministic nearest-water scan on the top face: ring-search outward from the
 * arrival column for a flooded cell above ground (prefer depth ≥ 2 — the dive
 * needs a floor below the surface). Cached per size:seed; asserted in
 * storyWorld.test.ts (the pinned world must keep its pond within reach).
 */
export function getPondPose(planetSize: number, terrainSeed: number): PondPose | null {
  const key = `${planetSize}:${terrainSeed}`;
  const cached = pondCache.get(key);
  if (cached !== undefined) return cached;

  const gen = getWorldGen(planetSize, terrainSeed).generator;
  const arrival = findTopFaceSurfaceVoxel(planetSize, terrainSeed);

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
      const ground = findTopFaceSurfaceVoxel(planetSize, terrainSeed, candidate);
      if (gen.isWaterVoxel(ground.x, ground.y + 1, ground.z)) continue;
      if (gen.isWaterVoxel(ground.x, ground.y + 2, ground.z)) continue;
      return voxelCoordToWorld(ground.x, ground.y, ground.z)
        .addScaledVector(FACE_NORMALS.top, 1.05);
    }
    return null;
  };

  const waterAt = (ox: number, oz: number): { voxel: { x: number; y: number; z: number }; depth: number } | null => {
    const ground = findTopFaceSurfaceVoxel(planetSize, terrainSeed, {
      x: arrival.x + ox,
      z: arrival.z + oz
    });
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

/**
 * The wreck relay: the network's re-established voice, planted at the crash
 * strip's impact site (the DescentPod's landmark) — chapter 4's set-piece anchor.
 */
export function getWreckRelayPose(planetSize: number, terrainSeed: number): StoryPropPose {
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
export const AUDIT_WORKER_GROUND_CLEARANCE = VOXEL_SCALE / 2 + 0.05;

function proceduralAgentTerrain(planetSize: number, terrainSeed: number): AgentSurfaceTerrainQuery {
  const generator = getWorldGen(planetSize, terrainSeed).generator;
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
export function getAuditWorkerPath(
  planetSize: number,
  terrainSeed: number,
  terrain: AgentSurfaceTerrainQuery = proceduralAgentTerrain(planetSize, terrainSeed)
): StoryPropPose[] {
  const arrival = findTopFaceSurfaceVoxel(planetSize, terrainSeed);
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
export const DEBRIS_MAX = 6;

/**
 * Hull-debris scatter along the raster travel strip: deterministic poses on
 * both sides of the spawn so the 2D act has ground to cover. Offsets are in
 * voxel units along the strip's dominant axis (the side plane is axis-aligned).
 */
export function getDebrisPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
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
