import { describe, expect, it } from 'vitest';
import { clearWorldGenCache, getWorldGen } from './worldGenCache';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';

interface SurfaceVoxel {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_SITE = { x: 4, z: -4 };

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
  const planetRadius = size / 2;
  const generator = new ProceduralWorldGenerator(
    {
      planetRadius,
      coreRadiusPercent: 0.15
    },
    createTerrainConfig(seed, planetRadius)
  );
  return generator.getAllVoxelPositions();
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
