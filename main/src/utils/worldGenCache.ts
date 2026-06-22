import * as THREE from 'three';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';
import { GENERATION_SCHEMA_VERSION } from '../game/schema';
import { blockToRenderMaterial } from '../game/adapters';
import { markWarpMetric, measureWarpMetric } from './warpMetrics';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { MATERIALS, materialId } from '../types/materials';
import type {
  InitialTerrainMeshData,
  OriginalTerrainData,
  OriginalTerrainMap,
  TerrainVoxel
} from './efficientVoxelSystem';

/**
 * Memoized world-generation, keyed by (size, terrainSeed).
 *
 * The procedural generator runs a full O(R^3) cube scan to produce its voxel
 * positions. Historically that scan happened TWICE per world arrival for the
 * same seed: once in worldArrival.findTopFaceSurfaceVoxel (to pick a spawn
 * site) and once in EfficientPlanet's originalTerrain memo (to build the
 * terrain). This module runs the construction + scan ONCE per seed and shares
 * both the generator and its voxel-position array between callers.
 *
 * Construction is preserved byte-for-byte from the previous inline call sites:
 *   planetRadius      = size / 2
 *   coreRadiusPercent = 0.15
 *   terrainConfig     = createTerrainConfig(terrainSeed, planetRadius)
 * so generator output is identical to before (this is purely caching).
 *
 * Safety: getAllVoxelPositions() returns a fresh array of fresh {x,y,z}
 * objects. Neither existing caller mutates the array or its elements —
 * findTopFaceSurfaceVoxel only reads and builds new objects; EfficientPlanet
 * .map()s into a brand-new array of new objects. So sharing one reference is
 * safe and we cache it directly (no defensive copy).
 */

export interface CachedWorldGen {
  generator: ProceduralWorldGenerator;
  voxels: Array<{ x: number; y: number; z: number }>;
  originalTerrain?: TerrainVoxel[];
  originalTerrainByCoord?: OriginalTerrainMap;
  initialVoxels?: TerrainVoxel[];
  initialTerrainMeshData?: InitialTerrainMeshData;
  waterVoxels?: Array<{ x: number; y: number; z: number; isTopSurface: boolean }>;
  waterFaces?: Array<{ x: number; y: number; z: number; faceDir: number }>;
}

export interface WorldTerrainData {
  originalTerrain: TerrainVoxel[];
  originalTerrainByCoord: OriginalTerrainMap;
  initialVoxels: TerrainVoxel[];
  initialTerrainMeshData: InitialTerrainMeshData;
}

export interface WorldPrewarmOptions {
  terrainData?: boolean;
  waterFaces?: boolean;
  waterVoxels?: boolean;
}

// Tiny LRU: keep the last few seeds so a there-and-back trip stays cached while
// memory stays bounded. A Map preserves insertion order; we delete-and-reinsert
// on hit to mark most-recently-used and evict from the front when over bound.
const MAX_ENTRIES = 3;
const cache = new Map<string, CachedWorldGen>();
const scheduledPrewarms = new Set<string>();
const meshMatrix = new THREE.Matrix4();
const meshPosition = new THREE.Vector3();

function cacheKey(size: number, terrainSeed: number): string {
  // Schema version in the key so a generation change never serves stale cached
  // terrain from an older schema within a session.
  return `v${GENERATION_SCHEMA_VERSION}:${size}:${terrainSeed}`;
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

export function getWorldGen(size: number, terrainSeed: number): CachedWorldGen {
  const key = cacheKey(size, terrainSeed);

  const existing = cache.get(key);
  if (existing) {
    // Mark most-recently-used.
    cache.delete(key);
    cache.set(key, existing);
    markWarpMetric('worldgen:cache_hit', { key, voxels: existing.voxels.length });
    return existing;
  }

  const entry = measureWarpMetric(
    'worldgen:cache_miss_build',
    () => {
      const planetRadius = size / 2;
      const generator = new ProceduralWorldGenerator(
        {
          planetRadius,
          coreRadiusPercent: 0.15
        },
        createTerrainConfig(terrainSeed, planetRadius)
      );
      return {
        generator,
        voxels: generator.getAllVoxelPositions()
      };
    },
    result => ({ key, voxels: result.voxels.length })
  );

  cache.set(key, entry);

  // Evict least-recently-used (front of insertion order) while over bound.
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }

  return entry;
}

export function getWorldWaterVoxels(
  size: number,
  terrainSeed: number
): Array<{ x: number; y: number; z: number; isTopSurface: boolean }> {
  const entry = getWorldGen(size, terrainSeed);
  if (entry.waterVoxels) {
    markWarpMetric('water:voxels_cache_hit', { voxels: entry.waterVoxels.length });
    return entry.waterVoxels;
  }

  entry.waterVoxels = measureWarpMetric(
    'water:voxels_generate',
    () => entry.generator.getExposedWaterVoxels(),
    result => ({ voxels: result.length })
  );
  return entry.waterVoxels;
}

export function getWorldWaterFaces(
  size: number,
  terrainSeed: number
): Array<{ x: number; y: number; z: number; faceDir: number }> {
  const entry = getWorldGen(size, terrainSeed);
  if (entry.waterFaces) {
    markWarpMetric('water:faces_cache_hit', { faces: entry.waterFaces.length });
    return entry.waterFaces;
  }

  entry.waterFaces = measureWarpMetric(
    'water:faces_generate',
    () => entry.generator.getExposedWaterFaces(),
    result => ({ faces: result.length })
  );
  return entry.waterFaces;
}

export function getWorldTerrainData(
  size: number,
  terrainSeed: number
): WorldTerrainData {
  const entry = getWorldGen(size, terrainSeed);

  if (!entry.originalTerrain) {
    const terrainData = measureWarpMetric(
      'planet:terrain_materialize',
      () => {
        const originalTerrain = entry.voxels.map(position => {
          const blockId = entry.generator.generateBlockForPosition(position.x, position.y, position.z);
          const deposit = entry.generator.generateDepositForPosition(position.x, position.y, position.z);
          const material = blockToRenderMaterial(blockId);
          return {
            ...position,
            blockId,
            deposit,
            material,
            color: MATERIALS[material].color.clone()
          };
        });
        return {
          originalTerrain,
          originalTerrainByCoord: buildOriginalTerrainMap(originalTerrain)
        };
      },
      result => ({ voxels: result.originalTerrain.length })
    );
    entry.originalTerrain = terrainData.originalTerrain;
    entry.originalTerrainByCoord = terrainData.originalTerrainByCoord;
  } else {
    markWarpMetric('planet:terrain_materialize_cache_hit', { voxels: entry.originalTerrain.length });
    if (!entry.originalTerrainByCoord) {
      entry.originalTerrainByCoord = measureWarpMetric(
        'planet:terrain_map_build',
        () => buildOriginalTerrainMap(entry.originalTerrain ?? []),
        result => ({ voxels: result.size })
      );
    }
  }

  if (!entry.initialVoxels) {
    entry.initialVoxels = measureWarpMetric(
      'planet:exposed_filter',
      () => {
        const terrainPositions = entry.originalTerrainByCoord;
        if (!entry.originalTerrain || !terrainPositions) return [];
        return entry.originalTerrain.filter(voxel => isVoxelExposedInTerrain(voxel.x, voxel.y, voxel.z, terrainPositions));
      },
      result => ({ exposed: result.length, original: entry.originalTerrain?.length ?? 0 })
    );
  } else {
    markWarpMetric('planet:exposed_filter_cache_hit', {
      exposed: entry.initialVoxels.length,
      original: entry.originalTerrain.length
    });
  }

  if (!entry.initialTerrainMeshData) {
    const terrainPositions = entry.originalTerrainByCoord;
    entry.initialTerrainMeshData = measureWarpMetric(
      'planet:initial_mesh_data_build',
      () => terrainPositions
        ? buildInitialTerrainMeshData(entry.initialVoxels ?? [], terrainPositions)
        : { count: 0, matrices: new Float32Array(), colors: new Float32Array(), instanceData: new Float32Array() },
      result => ({ instances: result.count })
    );
  } else {
    markWarpMetric('planet:initial_mesh_data_cache_hit', { instances: entry.initialTerrainMeshData.count });
  }

  return {
    originalTerrain: entry.originalTerrain,
    originalTerrainByCoord: entry.originalTerrainByCoord,
    initialVoxels: entry.initialVoxels,
    initialTerrainMeshData: entry.initialTerrainMeshData
  };
}

export function prewarmWorldGen(
  size: number,
  terrainSeed: number,
  options: WorldPrewarmOptions = { waterFaces: true }
): CachedWorldGen {
  return measureWarpMetric(
    'worldgen:prewarm',
    () => {
      const entry = getWorldGen(size, terrainSeed);
      if (options.terrainData) getWorldTerrainData(size, terrainSeed);
      if (options.waterFaces) getWorldWaterFaces(size, terrainSeed);
      if (options.waterVoxels) getWorldWaterVoxels(size, terrainSeed);
      return entry;
    },
    entry => ({
      voxels: entry.voxels.length,
      originalTerrain: entry.originalTerrain?.length ?? null,
      originalTerrainByCoord: entry.originalTerrainByCoord?.size ?? null,
      initialVoxels: entry.initialVoxels?.length ?? null,
      initialTerrainMeshData: entry.initialTerrainMeshData?.count ?? null,
      waterFaces: entry.waterFaces?.length ?? null,
      waterVoxels: entry.waterVoxels?.length ?? null
    })
  );
}

function prewarmKey(size: number, terrainSeed: number, options: WorldPrewarmOptions): string {
  return `${cacheKey(size, terrainSeed)}:${options.terrainData ? 't' : '-'}:${options.waterFaces ? 'f' : '-'}:${options.waterVoxels ? 'v' : '-'}`;
}

function hasPrewarmData(size: number, terrainSeed: number, options: WorldPrewarmOptions): boolean {
  const entry = cache.get(cacheKey(size, terrainSeed));
  if (!entry) return false;
  if (
    options.terrainData &&
    (!entry.originalTerrain || !entry.originalTerrainByCoord || !entry.initialVoxels || !entry.initialTerrainMeshData)
  ) return false;
  if (options.waterFaces && !entry.waterFaces) return false;
  if (options.waterVoxels && !entry.waterVoxels) return false;
  return true;
}

export function scheduleWorldPrewarm(
  size: number,
  terrainSeed: number,
  options: WorldPrewarmOptions = { waterFaces: true }
): void {
  if (typeof window === 'undefined') return;
  if (hasPrewarmData(size, terrainSeed, options)) return;

  const key = prewarmKey(size, terrainSeed, options);
  if (scheduledPrewarms.has(key)) return;
  scheduledPrewarms.add(key);

  const run = () => {
    scheduledPrewarms.delete(key);
    if (hasPrewarmData(size, terrainSeed, options)) return;
    prewarmWorldGen(size, terrainSeed, options);
  };

  const scheduler = window as unknown as {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };
  if (scheduler.requestIdleCallback) {
    scheduler.requestIdleCallback(run, { timeout: 50 });
  } else {
    window.setTimeout(run, 50);
  }
}

/** Test/diagnostic helper: drop all memoized generators. */
export function clearWorldGenCache(): void {
  cache.clear();
  scheduledPrewarms.clear();
}
