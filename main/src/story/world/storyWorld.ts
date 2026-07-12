import * as THREE from 'three';
import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import {
  coordinateToSeed,
  type WorldCoordinate
} from '../../utils/worldCoordinates.ts';
import { findTopFaceSurfaceVoxel } from '../../utils/worldArrival.ts';
import { voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';
import { FACE_NORMALS } from '../../utils/surfaceControls.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';

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
  const z = arrival.z - 8;      // the mesa's row — keeps the crossing short
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
  // Raw voxel offsets, same frame as the stone/mesa at (14,-8) — a dogleg off
  // the strip that ENDS SHORT of the mesa: the climb belongs to the iso era.
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
 * Supply pods for the belt-scroll era: deliberately OFF the work line (depth
 * offsets inside the ±3.5 clearance band, both directions) so recovering them
 * demands the first W/S steps. Offsets are (along, depth) in voxel units.
 */
export function getSupplyPodPoses(planetSize: number, terrainSeed: number): StoryPropPose[] {
  // Raw voxel offsets (the strip travels ±X toward the stone); z is the depth
  // axis — ±3 sits inside the ±3.5 clearance band, both directions.
  const offsets: Array<[number, number]> = [[4, 3], [-6, -3], [10, 2]];
  return offsets.map(([x, z]) => surfacePoseNear(planetSize, terrainSeed, x, z, 0.7));
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
} = { pond: null, auditPath: null, terrainSeed: null };

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
        const up = voxelCoordToWorld(hit.voxel.x, hit.voxel.y, hit.voxel.z).normalize();
        const surfaceVoxelY = hit.voxel.y + hit.depth;
        const surface = voxelCoordToWorld(hit.voxel.x, surfaceVoxelY, hit.voxel.z).addScaledVector(up, 0.5);
        const floor = voxelCoordToWorld(hit.voxel.x, hit.voxel.y, hit.voxel.z).addScaledVector(up, 0.6);
        // Shore: step back toward the arrival, horizontally, out of the water.
        const back = new THREE.Vector3(Math.sign(-x) || 1, 0, Math.sign(-z) || 0);
        const shore = surface.clone().addScaledVector(back, 2.2);
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

/**
 * The auditor's approach: surface-snapped samples from beyond the signal mesa's
 * ridge down to the wreck relay. The director walks him along this polyline
 * (arc-length lerp); the samples keep his boots near the terrain.
 */
export function getAuditWorkerPath(planetSize: number, terrainSeed: number): StoryPropPose[] {
  // He comes DOWN THE WORK STRIP — the regulation line the player once walked —
  // from beyond the horizon toward the wreck. (Deliberately clear of the signal
  // mesa prop at (14,-8): terrain snapping knows nothing about props.)
  // Offset one row (z=+3) so he passes BESIDE the worker who stands at the
  // arrival column — close enough to read, never through them — then stands
  // between the site and the relay, clear of the pod wreck at (-5, 0) and of
  // the console at (-5, 2), facing the site.
  const offsets: Array<[number, number]> = [
    [34, 3], [28, 3], [22, 3], [16, 3], [10, 3], [4, 3], [-2, 1]
  ];
  // Lift 1.05: surface poses are voxel CENTERS (top face sits +1.0 above) —
  // his boots belong on the ground, not half a voxel inside it.
  return offsets.map(([x, z]) => surfacePoseNear(planetSize, terrainSeed, x, z, 1.05));
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
  const offsets = [-9, 6, -14, 11, -4, 15]; // interleaved so any count spreads both ways
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
