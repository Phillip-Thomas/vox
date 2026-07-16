import { afterEach, describe, expect, it } from 'vitest';
import { createPlanetIdentity } from '../game/starSystem.ts';
import {
  TIDEGARDEN_SEED,
  TIDEGARDEN_WORLD_ID,
  resolvePlanetProfile
} from '../game/PlanetProfile.ts';
import { MaterialType } from '../types/materials.ts';
import {
  clearWorldGenCache,
  getWorldArrivalCandidate,
  getWorldGen,
  getPreparedWorldRenderData,
  getPreparedWorldTerrainMeshData,
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
    const resolution = resolvePlanetProfile({ worldId: identity.worldId, seed: identity.seed });

    expect(hasWorldGenCacheEntry(8, identity.seed, identity.worldId)).toBe(true);
    expect(hasWorldGenCacheEntry(8, identity.seed, '8,9:p2')).toBe(false);
    expect(getPreparedWorldTerrainMeshData(8, identity.seed, identity.worldId)?.count).toBe(1);
    expect(getPreparedWorldTerrainMeshData(8, identity.seed, '8,9:p2')).toBeNull();
    expect(getPreparedWorldRenderData(8, identity.seed, identity.worldId)).toMatchObject({
      waterFaces: [{ x: 3, y: 4, z: -4, faceDir: 2 }]
    });
    expect(getPreparedWorldRenderData(8, identity.seed, '8,9:p2')).toBeNull();
    const terrain = getWorldTerrainData(8, identity.seed, identity.worldId);

    expect(getWorldGen(8, identity.seed, identity.worldId)).toBe(hydrated);
    expect(hasWorldGenCacheEntry(8, identity.seed)).toBe(false);
    expect(hydrated.profileId).toBe(resolution.profileId);
    expect(hydrated.profileVersion).toBe(resolution.profileVersion);
    expect(hydrated.profileHash).toBe(resolution.profileHash);
    expect(hydrated.generator.getPlanetProfile()).toEqual(resolution.profile);
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
    expect(getWorldArrivalCandidate(8, identity.seed, { x: 4, z: -4 }, identity.worldId))
      .toEqual({ x: 4, y: 5, z: -4 });

  });

  it('hydrates Tidegarden with its exact resolved profile and rejects a stale hash', async () => {
    const request = createWorldPrepRequest({
      requestId: 'hydrate-tidegarden',
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED,
      planetSize: 8,
      activationEpoch: 4
    });
    const payload = packWorldPrepSemanticData(request, {
      voxels: [{
        position: [4, 5, -4],
        blockId: 'grass',
        material: MaterialType.GRASS,
        colorId: MaterialType.GRASS,
        deposit: null
      }],
      exposedVoxelIndices: [0],
      waterVoxels: [],
      waterCells: [],
      waterFaces: [],
      arrivalCandidate: [4, 5, -4]
    });
    await expect(hydrateWorldGenCacheFromPackedPayload({
      ...payload,
      profileHash: 'pf1-stale'
    })).rejects.toThrow(/stale planet profile/);

    const hydrated = await hydrateWorldGenCacheFromPackedPayload(payload);
    const resolution = resolvePlanetProfile({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED
    });
    expect(hydrated.profileHash).toBe(resolution.profileHash);
    expect(hydrated.generator.getPlanetProfile()).toEqual(resolution.profile);
    expect(hydrated.generator.getPlanetProfile().archetype).toBe('verdant');
    expect(hydrated.generator.getPlanetProfile().biome.alien).toBe(true);
    expect(hasWorldGenCacheEntry(8, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)).toBe(true);
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

    expect(getWorldArrivalCandidate(8, identity.seed, { x: -3, z: 2 }, identity.worldId))
      .toEqual({ x: -3, y: 6, z: 2 });
  });
});
