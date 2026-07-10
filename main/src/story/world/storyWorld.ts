import * as THREE from 'three';
import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import {
  coordinateToSeed,
  type WorldCoordinate
} from '../../utils/worldCoordinates.ts';
import { findTopFaceSurfaceVoxel } from '../../utils/worldArrival.ts';
import { voxelCoordToWorld } from '../../utils/cubeGravityConstants.ts';

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
  const up = center.lengthSq() > 1e-6 ? center.clone().normalize() : new THREE.Vector3(0, 1, 0);
  return { position: center.clone().addScaledVector(up, lift), up };
}

/** The smooth anomaly stone: a short deviation from the quota grounds (~30u walk). */
export function getAnomalyStonePose(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, 14, -8, 1.5);
}

/**
 * The raster era's side plane: anchored at the spawn, travelling along ONE
 * world axis (±X or ±Z, whichever points more toward the anomaly stone). Fully
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
  const stone = getAnomalyStonePose(planetSize, terrainSeed);
  const toStone = stone.position.clone().sub(originCenter);
  // Snap to the dominant world axis: -x/+x (or -z/+z) travel, one cube face on screen.
  const travelAxis = Math.abs(toStone.x) >= Math.abs(toStone.z)
    ? new THREE.Vector3(Math.sign(toStone.x) || 1, 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(toStone.z) || 1);
  const depthAxis = travelAxis.clone().cross(up).normalize();
  const origin = originCenter.clone().addScaledVector(up, 1);
  return { origin, travelAxis, depthAxis, up };
}

/** The hero apple tree: farther out, opposite direction — a committed walk. */
export function getHeroTreePose(planetSize: number, terrainSeed: number): StoryPropPose {
  return surfacePoseNear(planetSize, terrainSeed, -16, 14, 0.95);
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
