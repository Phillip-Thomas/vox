import * as THREE from 'three';
import type { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { GENERATION_SCHEMA_VERSION } from '../game/schema';
import { resolvePlanetProfile } from '../game/PlanetProfile.ts';
import { blockToRenderMaterial } from '../game/adapters';
import { markWarpMetric, measureWarpMetric } from './warpMetrics';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { MATERIALS, materialId, type MaterialType } from '../types/materials';
import type {
  InitialTerrainMeshData,
  OriginalTerrainData,
  OriginalTerrainMap,
  TerrainVoxel
} from './efficientVoxelSystem';
import {
  validatePackedWorldPrepPayload,
  type PackedWorldPrepPayload
} from './worldPrepProtocol.ts';
import { createResolvedWorldGenerator } from './resolvedWorldGenerator.ts';

/**
 * Memoized world-generation, keyed by (size, terrainSeed, worldId).
 *
 * The procedural generator runs a full O(R^3) cube scan to produce its voxel
 * positions. Historically that scan happened TWICE per world arrival for the
 * same seed: once in worldArrival.findTopFaceSurfaceVoxel (to pick a spawn
 * site) and once in EfficientPlanet's originalTerrain memo (to build the
 * terrain). This module runs the construction + scan ONCE per seed and shares
 * both the generator and its voxel-position array between callers.
 *
 * Generic seed-only construction remains byte-for-byte compatible with the old
 * inline call sites. Canonical worlds occupy a separate identity-aware entry, so
 * an authored world can never alias (or be aliased by) the seed's generic
 * archetype, regardless of which path is constructed first.
 *
 * Safety: getAllVoxelPositions() returns a fresh array of fresh {x,y,z}
 * objects. Neither existing caller mutates the array or its elements —
 * findTopFaceSurfaceVoxel only reads and builds new objects; EfficientPlanet
 * .map()s into a brand-new array of new objects. So sharing one reference is
 * safe and we cache it directly (no defensive copy).
 */

export interface CachedWorldGen {
  /** Present for canonical worlds so readiness cannot alias a seed collision. */
  worldId?: string;
  profileId: string;
  profileVersion: number;
  /** Stable resolved-profile fingerprint; unlike payload.hash it excludes lease data. */
  profileHash: string;
  generator: ProceduralWorldGenerator;
  voxels: Array<{ x: number; y: number; z: number }>;
  originalTerrain?: TerrainVoxel[];
  originalTerrainByCoord?: OriginalTerrainMap;
  initialVoxels?: TerrainVoxel[];
  initialTerrainMeshData?: InitialTerrainMeshData;
  waterVoxels?: Array<{ x: number; y: number; z: number; isTopSurface: boolean }>;
  allWaterVoxels?: Array<{ x: number; y: number; z: number }>;
  waterFaces?: Array<{ x: number; y: number; z: number; faceDir: number }>;
  arrivalCandidate?: { x: number; y: number; z: number };
  /** Dry, level, ship-clear canonical arrival selected on first world entry. */
  validatedArrivalCandidate?: { x: number; y: number; z: number };
}

export interface WorldPrepHydrationOptions {
  /** Maximum main-thread work between cooperative yields. */
  budgetMs?: number;
  /** Test hook; production defaults to the next animation frame. */
  yieldControl?: () => Promise<void>;
  /** Trusted worker results were hashed before transfer; tests/tools may recheck. */
  validateHash?: boolean;
  /** Cooperative cancellation checked between chunks before cache publication. */
  isCancelled?: () => boolean;
}

export interface WorldTerrainData {
  originalTerrain: TerrainVoxel[];
  originalTerrainByCoord: OriginalTerrainMap;
  initialVoxels: TerrainVoxel[];
  initialTerrainMeshData: InitialTerrainMeshData;
}

export interface PreparedWorldRenderData {
  terrain: InitialTerrainMeshData;
  waterFaces: ReadonlyArray<{ x: number; y: number; z: number; faceDir: number }>;
}

export interface WorldPrewarmOptions {
  worldId?: string;
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

function cacheKey(size: number, terrainSeed: number, worldId?: string): string {
  // Schema version in the key so a generation change never serves stale cached
  // terrain from an older schema within a session. The explicit seed-only token
  // is deliberately distinct from every canonical planet identity.
  return `v${GENERATION_SCHEMA_VERSION}:${size}:${terrainSeed}:${worldId ?? 'seed-only'}`;
}

function canonicalProfileHash(worldId: string, terrainSeed: number): string | null {
  try {
    return resolvePlanetProfile({ worldId, seed: terrainSeed }).profileHash;
  } catch {
    return null;
  }
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

export function getWorldGen(
  size: number,
  terrainSeed: number,
  worldId?: string
): CachedWorldGen {
  const key = cacheKey(size, terrainSeed, worldId);

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
      const { generator, resolution } = createResolvedWorldGenerator({
        worldId,
        seed: terrainSeed,
        planetRadius
      });
      return {
        worldId: resolution.worldId,
        profileId: resolution.profileId,
        profileVersion: resolution.profileVersion,
        profileHash: resolution.profileHash,
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

/**
 * Non-touching residency check used by the same-system activation gate. Requiring
 * a world ID prevents a different canonical planet with the same 32-bit seed from
 * satisfying readiness.
 */
export function hasWorldGenCacheEntry(
  size: number,
  terrainSeed: number,
  worldId?: string
): boolean {
  const entry = cache.get(cacheKey(size, terrainSeed, worldId));
  if (!entry) return false;
  if (worldId === undefined) return true;
  const expectedProfileHash = canonicalProfileHash(worldId, terrainSeed);
  return expectedProfileHash !== null
    && entry.worldId === worldId
    && entry.profileHash === expectedProfileHash;
}

/**
 * Read-only render data for a prepared canonical planet. This does not promote
 * the LRU entry; approach targeting remains the owner of residency decisions.
 */
export function getPreparedWorldTerrainMeshData(
  size: number,
  terrainSeed: number,
  worldId: string
): InitialTerrainMeshData | null {
  const entry = cache.get(cacheKey(size, terrainSeed, worldId));
  const expectedProfileHash = canonicalProfileHash(worldId, terrainSeed);
  if (
    !entry
    || expectedProfileHash === null
    || entry.worldId !== worldId
    || entry.profileHash !== expectedProfileHash
  ) return null;
  return entry.initialTerrainMeshData ?? null;
}

/** Canonical non-touching data used to stage the committed target's render shell. */
export function getPreparedWorldRenderData(
  size: number,
  terrainSeed: number,
  worldId: string
): PreparedWorldRenderData | null {
  const entry = cache.get(cacheKey(size, terrainSeed, worldId));
  const expectedProfileHash = canonicalProfileHash(worldId, terrainSeed);
  if (
    !entry
    || expectedProfileHash === null
    || entry.worldId !== worldId
    || entry.profileHash !== expectedProfileHash
    || !entry.initialTerrainMeshData
    || !entry.waterFaces
  ) return null;
  return {
    terrain: entry.initialTerrainMeshData,
    waterFaces: entry.waterFaces
  };
}

export function getWorldWaterVoxels(
  size: number,
  terrainSeed: number,
  worldId?: string
): Array<{ x: number; y: number; z: number; isTopSurface: boolean }> {
  const entry = getWorldGen(size, terrainSeed, worldId);
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
  terrainSeed: number,
  worldId?: string
): Array<{ x: number; y: number; z: number; faceDir: number }> {
  const entry = getWorldGen(size, terrainSeed, worldId);
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

export function getWorldAllWaterVoxels(
  size: number,
  terrainSeed: number,
  worldId?: string
): Array<{ x: number; y: number; z: number }> {
  const entry = getWorldGen(size, terrainSeed, worldId);
  if (entry.allWaterVoxels) return entry.allWaterVoxels;
  const extent = Math.floor(size / 2) + 6;
  const water: Array<{ x: number; y: number; z: number }> = [];
  for (let x = -extent; x <= extent; x++) {
    for (let y = -extent; y <= extent; y++) {
      for (let z = -extent; z <= extent; z++) {
        if (entry.generator.isWaterVoxel(x, y, z)) water.push({ x, y, z });
      }
    }
  }
  entry.allWaterVoxels = water;
  return water;
}

export function getWorldTerrainData(
  size: number,
  terrainSeed: number,
  worldId?: string
): WorldTerrainData {
  const entry = getWorldGen(size, terrainSeed, worldId);

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

/**
 * Convert a worker-owned packed payload into the exact legacy cache shape in
 * cooperative slices, then publish it atomically. No caller can observe a
 * half-hydrated world and activation performs no generator rescan.
 */
export async function hydrateWorldGenCacheFromPackedPayload(
  payload: PackedWorldPrepPayload,
  options: WorldPrepHydrationOptions = {}
): Promise<CachedWorldGen> {
  if (options.validateHash) validatePackedWorldPrepPayload(payload);
  if (payload.planetSize <= 0 || payload.seed <= 0) {
    throw new Error('Cannot hydrate an invalid world-prep payload.');
  }
  const resolution = resolvePlanetProfile({ worldId: payload.worldId, seed: payload.seed });
  if (
    payload.profileId !== resolution.profileId
    || payload.profileVersion !== resolution.profileVersion
    || payload.profileHash !== resolution.profileHash
  ) {
    throw new Error('Cannot hydrate world-prep data for a stale planet profile.');
  }

  const budgetMs = Math.max(0.25, options.budgetMs ?? 2.5);
  const yieldControl = options.yieldControl ?? yieldForHydration;
  let sliceStartedAt = performanceNow();
  const maybeYield = async () => {
    if (options.isCancelled?.()) throw new Error('World-prep hydration was cancelled.');
    if (performanceNow() - sliceStartedAt < budgetMs) return;
    await yieldControl();
    if (options.isCancelled?.()) throw new Error('World-prep hydration was cancelled.');
    sliceStartedAt = performanceNow();
  };

  const planetRadius = payload.planetSize / 2;
  const { generator } = createResolvedWorldGenerator({
    worldId: payload.worldId,
    seed: payload.seed,
    planetRadius
  });
  const voxelCount = payload.counts.voxels;
  const voxels = new Array<{ x: number; y: number; z: number }>(voxelCount);
  const originalTerrain = new Array<TerrainVoxel>(voxelCount);
  const originalTerrainByCoord = new Map<string, OriginalTerrainData>();
  const buffers = payload.buffers;

  for (let index = 0; index < voxelCount; index++) {
    const offset = index * 3;
    const x = buffers.voxelPositions[offset];
    const y = buffers.voxelPositions[offset + 1];
    const z = buffers.voxelPositions[offset + 2];
    const blockId = requiredPackedLookup(payload.lookups.blocks, buffers.blockIds[index], 'block');
    const material = requiredPackedLookup(payload.lookups.materials, buffers.materialIds[index], 'material');
    const resourceCode = buffers.depositResourceIds[index];
    const deposit = resourceCode === 0
      ? null
      : {
        resourceId: requiredPackedLookup(payload.lookups.resources, resourceCode - 1, 'resource'),
        richness: buffers.depositRichness[index],
        scanLevel: buffers.depositScanLevels[index]
      };
    const color = MATERIALS[material].color.clone();
    const voxel: TerrainVoxel = { x, y, z, blockId, deposit, material, color };
    voxels[index] = { x, y, z };
    originalTerrain[index] = voxel;
    originalTerrainByCoord.set(coordKey(x, y, z), {
      blockId,
      deposit,
      material,
      color: color.clone()
    });
    if ((index & 255) === 255) await maybeYield();
  }

  const exposedCount = payload.counts.exposedVoxels;
  const initialVoxels = new Array<TerrainVoxel>(exposedCount);
  const matrices = new Float32Array(exposedCount * 16);
  const colors = new Float32Array(exposedCount * 3);
  const instanceData = new Float32Array(exposedCount * 2);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (let slot = 0; slot < exposedCount; slot++) {
    const voxelIndex = buffers.exposedVoxelIndices[slot];
    const voxel = originalTerrain[voxelIndex];
    if (!voxel) throw new Error(`Packed exposed voxel index ${voxelIndex} is out of bounds.`);
    initialVoxels[slot] = voxel;
    matrix.identity();
    matrix.setPosition(voxelCoordToWorld(voxel.x, voxel.y, voxel.z, position));
    matrix.toArray(matrices, slot * 16);
    voxel.color.toArray(colors, slot * 3);
    instanceData[slot * 2] = materialId(voxel.material as MaterialType);
    instanceData[slot * 2 + 1] = computeInitialFaceMask(
      voxel.x,
      voxel.y,
      voxel.z,
      originalTerrainByCoord
    );
    if ((slot & 255) === 255) await maybeYield();
  }

  const waterVoxels = new Array<{ x: number; y: number; z: number; isTopSurface: boolean }>(
    payload.counts.waterVoxels
  );
  for (let index = 0; index < waterVoxels.length; index++) {
    const offset = index * 3;
    waterVoxels[index] = {
      x: buffers.waterVoxelPositions[offset],
      y: buffers.waterVoxelPositions[offset + 1],
      z: buffers.waterVoxelPositions[offset + 2],
      isTopSurface: buffers.waterVoxelTopFlags[index] !== 0
    };
    if ((index & 511) === 511) await maybeYield();
  }
  const waterFaces = new Array<{ x: number; y: number; z: number; faceDir: number }>(
    payload.counts.waterFaces
  );
  for (let index = 0; index < waterFaces.length; index++) {
    const offset = index * 3;
    waterFaces[index] = {
      x: buffers.waterFacePositions[offset],
      y: buffers.waterFacePositions[offset + 1],
      z: buffers.waterFacePositions[offset + 2],
      faceDir: buffers.waterFaceDirections[index]
    };
    if ((index & 511) === 511) await maybeYield();
  }
  const allWaterVoxels = new Array<{ x: number; y: number; z: number }>(
    payload.counts.waterCells
  );
  const allWaterKeys = new Set<string>();
  for (let index = 0; index < allWaterVoxels.length; index++) {
    const offset = index * 3;
    allWaterVoxels[index] = {
      x: buffers.waterCellPositions[offset],
      y: buffers.waterCellPositions[offset + 1],
      z: buffers.waterCellPositions[offset + 2]
    };
    const cell = allWaterVoxels[index];
    allWaterKeys.add(coordKey(cell.x, cell.y, cell.z));
    if ((index & 511) === 511) await maybeYield();
  }
  generator.hydratePreparedWaterCells(allWaterVoxels, allWaterKeys);

  const entry: CachedWorldGen = {
    worldId: payload.worldId,
    profileId: payload.profileId,
    profileVersion: payload.profileVersion,
    profileHash: payload.profileHash,
    generator,
    voxels,
    originalTerrain,
    originalTerrainByCoord,
    initialVoxels,
    initialTerrainMeshData: { count: exposedCount, matrices, colors, instanceData },
    waterVoxels,
    allWaterVoxels,
    waterFaces,
    arrivalCandidate: {
      x: buffers.arrivalCandidate[0],
      y: buffers.arrivalCandidate[1],
      z: buffers.arrivalCandidate[2]
    }
  };

  if (options.isCancelled?.()) throw new Error('World-prep hydration was cancelled.');
  const key = cacheKey(payload.planetSize, payload.seed, payload.worldId);
  cache.delete(key);
  cache.set(key, entry);
  trimWorldGenCache();
  return entry;
}

export function getWorldArrivalCandidate(
  size: number,
  terrainSeed: number,
  preferred = { x: 4, z: -4 },
  worldId?: string
): { x: number; y: number; z: number } {
  const entry = getWorldGen(size, terrainSeed, worldId);
  const defaultPreference = preferred.x === 4 && preferred.z === -4;
  if (defaultPreference && entry.arrivalCandidate) return { ...entry.arrivalCandidate };
  const topByColumn = new Map<string, { x: number; y: number; z: number }>();
  for (const voxel of entry.voxels) {
    if (voxel.y < 0) continue;
    const key = `${voxel.x},${voxel.z}`;
    const current = topByColumn.get(key);
    if (!current || voxel.y > current.y) topByColumn.set(key, voxel);
  }
  let best: { x: number; y: number; z: number } | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const voxel of topByColumn.values()) {
    const dx = voxel.x - preferred.x;
    const dz = voxel.z - preferred.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq || (distanceSq === bestDistanceSq && best && voxel.y > best.y)) {
      best = voxel;
      bestDistanceSq = distanceSq;
    }
  }
  const candidate = best ? { ...best } : { x: 0, y: Math.floor(size / 2), z: 0 };
  if (defaultPreference) entry.arrivalCandidate = candidate;
  return { ...candidate };
}

export function prewarmWorldGen(
  size: number,
  terrainSeed: number,
  options: WorldPrewarmOptions = { waterFaces: true }
): CachedWorldGen {
  return measureWarpMetric(
    'worldgen:prewarm',
    () => {
      const entry = getWorldGen(size, terrainSeed, options.worldId);
      if (options.terrainData) getWorldTerrainData(size, terrainSeed, options.worldId);
      if (options.waterFaces) getWorldWaterFaces(size, terrainSeed, options.worldId);
      if (options.waterVoxels) getWorldWaterVoxels(size, terrainSeed, options.worldId);
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
  return `${cacheKey(size, terrainSeed, options.worldId)}:${options.terrainData ? 't' : '-'}:${options.waterFaces ? 'f' : '-'}:${options.waterVoxels ? 'v' : '-'}`;
}

function hasPrewarmData(size: number, terrainSeed: number, options: WorldPrewarmOptions): boolean {
  const entry = cache.get(cacheKey(size, terrainSeed, options.worldId));
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

function trimWorldGenCache(): void {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function requiredPackedLookup<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Packed ${label} lookup index ${index} is out of bounds.`);
  return value;
}

function performanceNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function yieldForHydration(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
}
