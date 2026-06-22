import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  clearWorldGenCache,
  getWorldGen,
  getWorldTerrainData,
  getWorldWaterFaces,
  getWorldWaterVoxels,
  prewarmWorldGen
} from './worldGenCache';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { MATERIALS, materialId } from '../types/materials';
import { blockToRenderMaterial } from '../game/adapters';
import type {
  InitialTerrainMeshData,
  OriginalTerrainData,
  OriginalTerrainMap,
  TerrainVoxel
} from './efficientVoxelSystem';

interface SurfaceVoxel {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_SITE = { x: 4, z: -4 };
const meshMatrix = new THREE.Matrix4();
const meshPosition = new THREE.Vector3();

/**
 * Replicates the old findTopFaceSurfaceVoxel column-scan logic inline so the
 * test can compare the cached path against a fresh, independent generator scan.
 */
function scanTopFaceSurfaceVoxel(
  voxels: Array<{ x: number; y: number; z: number }>,
  planetRadius: number,
  preferred = DEFAULT_SITE
): SurfaceVoxel {
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

function freshScan(size: number, seed: number) {
  return freshGenerator(size, seed).getAllVoxelPositions();
}

function freshGenerator(size: number, seed: number) {
  const planetRadius = size / 2;
  return new ProceduralWorldGenerator(
    {
      planetRadius,
      coreRadiusPercent: 0.15
    },
    createTerrainConfig(seed, planetRadius)
  );
}

function coordKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function isVoxelExposedInTerrain(x: number, y: number, z: number, terrainPositions: { has(key: string): boolean }) {
  const neighbors = [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1]
  ];

  return neighbors.some(([nx, ny, nz]) => !terrainPositions.has(coordKey(nx, ny, nz)));
}

function buildOriginalTerrainMap(terrain: TerrainVoxel[]): OriginalTerrainMap {
  const terrainByCoord = new Map<string, OriginalTerrainData>();
  for (const voxel of terrain) {
    terrainByCoord.set(coordKey(voxel.x, voxel.y, voxel.z), {
      blockId: voxel.blockId,
      deposit: voxel.deposit ?? null,
      material: voxel.material,
      color: voxel.color.clone()
    });
  }
  return terrainByCoord;
}

function computeInitialFaceMask(x: number, y: number, z: number, terrainPositions: { has(key: string): boolean }) {
  let mask = 0;
  if (terrainPositions.has(coordKey(x + 1, y, z))) mask |= 1 << 0;
  if (terrainPositions.has(coordKey(x - 1, y, z))) mask |= 1 << 1;
  if (terrainPositions.has(coordKey(x, y + 1, z))) mask |= 1 << 2;
  if (terrainPositions.has(coordKey(x, y - 1, z))) mask |= 1 << 3;
  if (terrainPositions.has(coordKey(x, y, z + 1))) mask |= 1 << 4;
  if (terrainPositions.has(coordKey(x, y, z - 1))) mask |= 1 << 5;
  return mask;
}

function buildInitialTerrainMeshData(
  initialVoxels: TerrainVoxel[],
  terrainPositions: OriginalTerrainMap
): InitialTerrainMeshData {
  const count = initialVoxels.length;
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const instanceData = new Float32Array(count * 2);

  for (let slot = 0; slot < count; slot++) {
    const voxel = initialVoxels[slot];
    meshMatrix.identity();
    meshMatrix.setPosition(voxelCoordToWorld(voxel.x, voxel.y, voxel.z, meshPosition));
    meshMatrix.toArray(matrices, slot * 16);
    voxel.color.toArray(colors, slot * 3);
    instanceData[slot * 2] = materialId(voxel.material);
    instanceData[slot * 2 + 1] = computeInitialFaceMask(voxel.x, voxel.y, voxel.z, terrainPositions);
  }

  return { count, matrices, colors, instanceData };
}

function freshTerrainData(size: number, seed: number): {
  originalTerrain: TerrainVoxel[];
  originalTerrainByCoord: OriginalTerrainMap;
  initialVoxels: TerrainVoxel[];
  initialTerrainMeshData: InitialTerrainMeshData;
} {
  const generator = freshGenerator(size, seed);
  const voxels = generator.getAllVoxelPositions();
  const originalTerrain = voxels.map(position => {
    const blockId = generator.generateBlockForPosition(position.x, position.y, position.z);
    const deposit = generator.generateDepositForPosition(position.x, position.y, position.z);
    const material = blockToRenderMaterial(blockId);
    return {
      ...position,
      blockId,
      deposit,
      material,
      color: MATERIALS[material].color.clone()
    };
  });
  const originalTerrainByCoord = buildOriginalTerrainMap(originalTerrain);
  const terrainPositions = originalTerrainByCoord;
  const initialVoxels = originalTerrain.filter(voxel => isVoxelExposedInTerrain(voxel.x, voxel.y, voxel.z, terrainPositions));
  const initialTerrainMeshData = buildInitialTerrainMeshData(initialVoxels, originalTerrainByCoord);

  return { originalTerrain, originalTerrainByCoord, initialVoxels, initialTerrainMeshData };
}

describe('worldGenCache', () => {
  it('returns the SAME voxel array reference on repeat calls with the same (size, seed)', () => {
    clearWorldGenCache();
    const first = getWorldGen(50, 12345);
    const second = getWorldGen(50, 12345);
    expect(second.voxels).toBe(first.voxels);
    expect(second.generator).toBe(first.generator);
  });

  it('produces a different entry for a different seed', () => {
    clearWorldGenCache();
    const a = getWorldGen(50, 12345);
    const b = getWorldGen(50, 54321);
    expect(b.voxels).not.toBe(a.voxels);
  });

  it('memoizes derived water arrays on the cached world entry', () => {
    clearWorldGenCache();
    const firstFaces = getWorldWaterFaces(24, 12345);
    const secondFaces = getWorldWaterFaces(24, 12345);
    const firstVoxels = getWorldWaterVoxels(24, 12345);
    const secondVoxels = getWorldWaterVoxels(24, 12345);

    expect(secondFaces).toBe(firstFaces);
    expect(secondVoxels).toBe(firstVoxels);
  });

  it('memoizes derived terrain arrays on the cached world entry', () => {
    clearWorldGenCache();
    const first = getWorldTerrainData(24, 12345);
    const second = getWorldTerrainData(24, 12345);

    expect(second.originalTerrain).toBe(first.originalTerrain);
    expect(second.originalTerrainByCoord).toBe(first.originalTerrainByCoord);
    expect(second.initialVoxels).toBe(first.initialVoxels);
    expect(second.initialTerrainMeshData).toBe(first.initialTerrainMeshData);
  });

  it('prewarms the exact same terrain and water data used by normal cached access', () => {
    const size = 24;
    const seed = 12345;
    clearWorldGenCache();

    const prewarmed = prewarmWorldGen(size, seed, { terrainData: true, waterFaces: true, waterVoxels: true });
    const fresh = freshGenerator(size, seed);
    const freshVoxels = fresh.getAllVoxelPositions();
    const freshWaterFaces = fresh.getExposedWaterFaces();
    const freshWaterVoxels = fresh.getExposedWaterVoxels();
    const freshTerrain = freshTerrainData(size, seed);

    expect(prewarmed.voxels).toEqual(freshVoxels);
    expect(prewarmed.originalTerrain).toEqual(freshTerrain.originalTerrain);
    expect(prewarmed.originalTerrainByCoord).toEqual(freshTerrain.originalTerrainByCoord);
    expect(prewarmed.initialVoxels).toEqual(freshTerrain.initialVoxels);
    expect(prewarmed.initialTerrainMeshData).toEqual(freshTerrain.initialTerrainMeshData);
    expect(prewarmed.waterFaces).toEqual(freshWaterFaces);
    expect(prewarmed.waterVoxels).toEqual(freshWaterVoxels);
    expect(getWorldGen(size, seed)).toBe(prewarmed);
    expect(getWorldTerrainData(size, seed).originalTerrain).toBe(prewarmed.originalTerrain);
    expect(getWorldTerrainData(size, seed).originalTerrainByCoord).toBe(prewarmed.originalTerrainByCoord);
    expect(getWorldTerrainData(size, seed).initialVoxels).toBe(prewarmed.initialVoxels);
    expect(getWorldTerrainData(size, seed).initialTerrainMeshData).toBe(prewarmed.initialTerrainMeshData);
    expect(getWorldWaterFaces(size, seed)).toBe(prewarmed.waterFaces);
    expect(getWorldWaterVoxels(size, seed)).toBe(prewarmed.waterVoxels);
  });

  it.each([12345, 54321, 13579])(
    'cached terrain data is byte-equivalent to fresh materialization for seed %i',
    (seed) => {
      clearWorldGenCache();
      const size = 24;
      const cached = getWorldTerrainData(size, seed);
      const fresh = freshTerrainData(size, seed);

      expect(cached.originalTerrain).toEqual(fresh.originalTerrain);
      expect(cached.originalTerrainByCoord).toEqual(fresh.originalTerrainByCoord);
      expect(cached.initialVoxels).toEqual(fresh.initialVoxels);
      expect(cached.initialTerrainMeshData).toEqual(fresh.initialTerrainMeshData);
    }
  );

  it.each([12345, 54321, 13579])(
    'cached path yields the identical top-face surface voxel as a fresh scan for seed %i',
    (seed) => {
      clearWorldGenCache();
      const size = 50;
      const planetRadius = size / 2;

      const cached = getWorldGen(size, seed);
      const cachedTop = scanTopFaceSurfaceVoxel(cached.voxels, planetRadius);

      const fresh = freshScan(size, seed);
      const freshTop = scanTopFaceSurfaceVoxel(fresh, planetRadius);

      // Voxel sets must match byte-for-byte (caching changes nothing).
      expect(cached.voxels).toEqual(fresh);
      expect(cachedTop).toEqual(freshTop);
    }
  );
});
