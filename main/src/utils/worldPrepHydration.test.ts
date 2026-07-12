import { afterEach, describe, expect, it } from 'vitest';
import { createPlanetIdentity } from '../game/starSystem.ts';
import { MaterialType } from '../types/materials.ts';
import {
  clearWorldGenCache,
  getWorldArrivalCandidate,
  getWorldGen,
  getWorldTerrainData,
  hasWorldGenCacheEntry,
  hydrateWorldGenCacheFromPackedPayload
} from './worldGenCache.ts';
import {
  createWorldPrepRequest,
  packWorldPrepSemanticData
} from './worldPrepProtocol.ts';

afterEach(() => clearWorldGenCache());

describe('packed world cache hydration', () => {
  it('publishes a complete legacy cache entry without a generator rescan', async () => {
    const identity = createPlanetIdentity({ system: { x: 4, y: -2 }, slot: 1 });
    const request = createWorldPrepRequest({
      requestId: 'hydrate-p1',
      worldId: identity.worldId,
      seed: identity.seed,
      planetSize: 8,
      activationEpoch: 7
    });
    const payload = packWorldPrepSemanticData(request, {
      voxels: [
        {
          position: [4, 5, -4],
          blockId: 'stone',
          material: MaterialType.STONE,
          colorId: MaterialType.STONE,
          deposit: null
        },
        {
          position: [4, 4, -4],
          blockId: 'dirt',
          material: MaterialType.DIRT,
          colorId: MaterialType.DIRT,
          deposit: null
        }
      ],
      exposedVoxelIndices: [0],
      waterVoxels: [{ position: [3, 4, -4], isTopSurface: true }],
      waterCells: [[3, 4, -4], [3, 3, -4]],
      waterFaces: [{ position: [3, 4, -4], faceDir: 2 }],
      arrivalCandidate: [4, 5, -4]
    });

    const hydrated = await hydrateWorldGenCacheFromPackedPayload(payload, {
      validateHash: true,
      yieldControl: () => Promise.resolve()
    });

    expect(hasWorldGenCacheEntry(8, identity.seed, identity.worldId)).toBe(true);
    expect(hasWorldGenCacheEntry(8, identity.seed, '8,9:p2')).toBe(false);
    const terrain = getWorldTerrainData(8, identity.seed);

    expect(getWorldGen(8, identity.seed)).toBe(hydrated);
    expect(terrain.originalTerrain).toHaveLength(2);
    expect(terrain.initialVoxels).toHaveLength(1);
    expect(terrain.initialTerrainMeshData.count).toBe(1);
    expect(terrain.originalTerrainByCoord.get('4,5,-4')).toMatchObject({
      blockId: 'stone',
      material: MaterialType.STONE
    });
    expect(hydrated.waterVoxels).toEqual([
      { x: 3, y: 4, z: -4, isTopSurface: true }
    ]);
    expect(hydrated.waterFaces).toEqual([
      { x: 3, y: 4, z: -4, faceDir: 2 }
    ]);
    expect(hydrated.allWaterVoxels).toEqual([
      { x: 3, y: 4, z: -4 },
      { x: 3, y: 3, z: -4 }
    ]);
    expect(hydrated.generator.isWaterVoxel(3, 3, -4)).toBe(true);
    expect(hydrated.generator.isWaterVoxel(0, 0, 0)).toBe(false);
    expect(getWorldArrivalCandidate(8, identity.seed)).toEqual({ x: 4, y: 5, z: -4 });
  });

  it('does not reuse the default worker arrival for a custom preference', async () => {
    const identity = createPlanetIdentity({ system: { x: 1, y: 1 }, slot: 1 });
    const request = createWorldPrepRequest({
      requestId: 'hydrate-arrival',
      worldId: identity.worldId,
      seed: identity.seed,
      planetSize: 8,
      activationEpoch: 2
    });
    const payload = packWorldPrepSemanticData(request, {
      voxels: [
        { position: [4, 5, -4], blockId: 'stone', material: MaterialType.STONE, colorId: MaterialType.STONE, deposit: null },
        { position: [-3, 6, 2], blockId: 'stone', material: MaterialType.STONE, colorId: MaterialType.STONE, deposit: null }
      ],
      exposedVoxelIndices: [0, 1],
      waterVoxels: [],
      waterCells: [],
      waterFaces: [],
      arrivalCandidate: [4, 5, -4]
    });
    await hydrateWorldGenCacheFromPackedPayload(payload);

    expect(getWorldArrivalCandidate(8, identity.seed, { x: -3, z: 2 }))
      .toEqual({ x: -3, y: 6, z: 2 });
  });
});
