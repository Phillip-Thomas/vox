import * as THREE from 'three';
import { getWorldArrivalCandidate } from './worldGenCache';
import {
  PLAYER_CENTER_CLEARANCE,
  voxelCoordToWorld
} from './cubeGravityConstants';
import { FACE_NORMALS } from './surfaceControls';

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
  return getWorldArrivalCandidate(size, terrainSeed, preferred);
}

export function createWorldArrivalPose(size: number, terrainSeed: number): WorldArrivalPose {
  const surfaceVoxel = findTopFaceSurfaceVoxel(size, terrainSeed);
  const surfaceCenter = voxelCoordToWorld(surfaceVoxel.x, surfaceVoxel.y, surfaceVoxel.z);
  // findTopFaceSurfaceVoxel is explicitly a TOP-face query. Its support normal
  // stays +Y across the whole flat face; radial up would incorrectly tilt and
  // laterally displace the player/parked ship more as the site approaches an edge.
  const up = FACE_NORMALS.top.clone();
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
