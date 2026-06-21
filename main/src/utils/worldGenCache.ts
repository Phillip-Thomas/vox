import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';
import { markWarpMetric, measureWarpMetric } from './warpMetrics';

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
}

// Tiny LRU: keep the last few seeds so a there-and-back trip stays cached while
// memory stays bounded. A Map preserves insertion order; we delete-and-reinsert
// on hit to mark most-recently-used and evict from the front when over bound.
const MAX_ENTRIES = 3;
const cache = new Map<string, CachedWorldGen>();

function cacheKey(size: number, terrainSeed: number): string {
  return `${size}:${terrainSeed}`;
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

/** Test/diagnostic helper: drop all memoized generators. */
export function clearWorldGenCache(): void {
  cache.clear();
}
