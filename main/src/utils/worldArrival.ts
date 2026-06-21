import * as THREE from 'three';
import { getWorldGen } from './worldGenCache';
import {
  PLAYER_CENTER_CLEARANCE,
  voxelCoordToWorld
} from './cubeGravityConstants';

export type ArrivalMode = 'surface' | 'approach';

export interface SurfaceVoxel {
  x: number;
  y: number;
  z: number;
}

export interface WorldArrivalPose {
  surfaceVoxel: SurfaceVoxel;
  playerSurfacePosition: THREE.Vector3;
  approachPosition: THREE.Vector3;
  shipPosition: THREE.Vector3;
}

const DEFAULT_SITE = { x: 4, z: -4 };
const APPROACH_ALTITUDE = 30;
const EXTRA_PLAYER_CLEARANCE = 1;
const SHIP_SURFACE_CLEARANCE = 1.35;

export function findTopFaceSurfaceVoxel(
  size: number,
  terrainSeed: number,
  preferred = DEFAULT_SITE
): SurfaceVoxel {
  const planetRadius = size / 2;
  const { voxels } = getWorldGen(size, terrainSeed);
  const topByColumn = new Map<string, SurfaceVoxel>();

  for (const voxel of voxels) {
    if (voxel.y < 0) continue;
    const key = `${voxel.x},${voxel.z}`;
    const current = topByColumn.get(key);
    if (!current || voxel.y > current.y) {
      topByColumn.set(key, { x: voxel.x, y: voxel.y, z: voxel.z });
    }
  }

  let best: SurfaceVoxel | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const voxel of topByColumn.values()) {
    const dx = voxel.x - preferred.x;
    const dz = voxel.z - preferred.z;
    const distanceSq = dx * dx + dz * dz;
    if (
      distanceSq < bestDistanceSq ||
      (distanceSq === bestDistanceSq && best && voxel.y > best.y)
    ) {
      best = voxel;
      bestDistanceSq = distanceSq;
    }
  }

  return best ?? { x: 0, y: Math.floor(planetRadius), z: 0 };
}

export function createWorldArrivalPose(size: number, terrainSeed: number): WorldArrivalPose {
  const surfaceVoxel = findTopFaceSurfaceVoxel(size, terrainSeed);
  const surfaceCenter = voxelCoordToWorld(surfaceVoxel.x, surfaceVoxel.y, surfaceVoxel.z);
  // Outward normal at the surface site (not a hardcoded +Y) so arrival/ship poses
  // are correct regardless of which face the site is on.
  const up = surfaceCenter.lengthSq() > 1e-6
    ? surfaceCenter.clone().normalize()
    : new THREE.Vector3(0, 1, 0);
  const playerSurfacePosition = surfaceCenter
    .clone()
    .addScaledVector(up, PLAYER_CENTER_CLEARANCE + EXTRA_PLAYER_CLEARANCE);

  return {
    surfaceVoxel,
    playerSurfacePosition,
    approachPosition: playerSurfacePosition.clone().addScaledVector(up, APPROACH_ALTITUDE),
    shipPosition: surfaceCenter.clone().addScaledVector(up, SHIP_SURFACE_CLEARANCE)
  };
}
