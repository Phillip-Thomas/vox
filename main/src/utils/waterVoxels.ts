import { getWorldWaterFaces, getWorldWaterVoxels } from './worldGenCache';

export interface WaterVoxel {
  x: number;
  y: number;
  z: number;
  /** Outward (further-from-center) neighbour is air -> this is the ocean top. */
  isTopSurface: boolean;
}

/** One exposed water-surface quad: a voxel coord + which face touches air. */
export interface WaterFace {
  x: number;
  y: number;
  z: number;
  /** Face index: 0=+x 1=-x 2=+y 3=-y 4=+z 5=-z. */
  faceDir: number;
}

/**
 * Unit (cube-coordinate) outward normals for the 6 face directions, indexed by
 * `faceDir`. The renderer rotates a +Z PlaneGeometry to align with these and
 * offsets the quad to the cell's face centre. Order matches
 * `ProceduralWorldGenerator.getExposedWaterFaces`.
 */
export const FACE_NORMALS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
] as const;

/**
 * Build the exposed water-surface voxels for a planet of the given size + seed.
 *
 * Uses the IDENTICAL world/terrain config that EfficientPlanet uses to build the
 * solid terrain (same `createTerrainConfig`, same coreRadiusPercent, same
 * planetRadius = size / 2), so the ocean lines up exactly with the land it
 * floods. The generator classifies each empty cell at/below sea level as water
 * and returns only the air-exposed surface voxels.
 */
export function buildWaterVoxels(size: number, terrainSeed: number): WaterVoxel[] {
  return getWorldWaterVoxels(size, terrainSeed);
}

/**
 * Build the exposed water SURFACE as a flat list of air-facing FACES (quads),
 * not volumetric cubes. One entry per exposed water face — overwhelmingly the
 * outward/top faces that form the continuous ocean sheet, plus any coastal side
 * faces that touch air. Rendering these as flat quads eliminates the
 * hollow-glass-box artifact (a flat quad has no interior) and tiles seamlessly.
 */
export function buildWaterFaces(size: number, terrainSeed: number): WaterFace[] {
  return getWorldWaterFaces(size, terrainSeed);
}
