import * as THREE from 'three';
import { getWorldArrivalCandidate, getWorldGen } from './worldGenCache';
import {
  PLAYER_CENTER_CLEARANCE,
  VOXEL_SCALE,
  voxelCoordToWorld
} from './cubeGravityConstants';
import { FACE_NORMALS } from './surfaceControls';
import { findValidSpawnSite } from './spawnValidation.ts';

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
// This pose is measured from the voxel centre, not its exposed contact plane.
const SHIP_SURFACE_CLEARANCE = VOXEL_SCALE / 2 + 2.5;

export function findTopFaceSurfaceVoxel(
  size: number,
  terrainSeed: number,
  preferred = DEFAULT_SITE,
  worldId?: string
): SurfaceVoxel {
  // Only the canonical arrival needs the strict shared player/ship contract.
  // Callers that supply a custom column (pond scans, prop placement) still need
  // the literal terrain surface even when it is wet or sloped.
  if (preferred.x === DEFAULT_SITE.x && preferred.z === DEFAULT_SITE.z) {
    const entry = getWorldGen(size, terrainSeed, worldId);
    if (entry.validatedArrivalCandidate) return { ...entry.validatedArrivalCandidate };
    const preferredWorld = new THREE.Vector3(
      preferred.x * VOXEL_SCALE,
      size,
      preferred.z * VOXEL_SCALE
    );
    const site = findValidSpawnSite(entry.generator, size, preferredWorld, {
      kind: 'ship',
      face: 'top',
      requirePlayerEgress: true,
      // The preference is off-centre; two radii cover every valid top-face pad.
      maxSearchRadius: Math.floor(size / VOXEL_SCALE) * 2
    });
    if (site) {
      entry.validatedArrivalCandidate = { ...site.supportVoxel };
      return { ...site.supportVoxel };
    }
    // Never silently turn a validation miss into a submerged/embedded spawn.
    // The bounded search covers the complete rendered top face; a miss is a
    // generation-contract failure and must surface as such.
    throw new Error(`No dry, level arrival pad exists for terrain seed ${terrainSeed}.`);
  }
  return getWorldArrivalCandidate(size, terrainSeed, preferred, worldId);
}

export function createWorldArrivalPose(
  size: number,
  terrainSeed: number,
  worldId?: string
): WorldArrivalPose {
  const surfaceVoxel = findTopFaceSurfaceVoxel(size, terrainSeed, DEFAULT_SITE, worldId);
  return createWorldArrivalPoseFromSurfaceVoxel(surfaceVoxel);
}

export function createWorldArrivalPoseFromSurfaceVoxel(surfaceVoxel: SurfaceVoxel): WorldArrivalPose {
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
