import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import fixtures from './fixtures/anchors-before-worker.json';
import * as story from './storyWorld.ts';
import { buildTopFaceColumns, clearWorldGenCache, getWorldGen, hydrateWorldGenCacheFromPackedPayload } from '../../utils/worldGenCache.ts';
import { buildPackedWorldPrepPayload, createWorldPrepRequest, validatePackedWorldPrepPayload, WORLD_PREP_PROTOCOL_VERSION } from '../../utils/worldPrepProtocol.ts';
import { clonePreparedAnchor, packPreparedStoryAnchors, unpackPreparedStoryAnchors } from './preparedStoryAnchors.ts';
import { createStoryAnchorResolver, type PreparedStoryAnchors } from './storyAnchorResolver.ts';

const names = ['getSignalMesaPose', 'getSignalMesaSummit', 'getAnomalyStonePose', 'getNavWaypointPoses',
  'getStorySidePlane', 'getPodImpactPose', 'getSupplyPodPoses', 'getHeroTreePose', 'getFieldPackPose',
  'getPondPose', 'getKeelMemoryPose', 'getWreckRelayPose', 'getAuditWorkerPath', 'getDebrisPoses'] as const;
const readAnchors = (size: number, seed: number) => Object.fromEntries(names.map(name => [name, story[name](size, seed)])) as PreparedStoryAnchors;
afterEach(clearWorldGenCache);

describe('worker story anchors', () => {
  for (const fixture of fixtures) {
    it(`preserves legacy anchors except the commissioned first pickup and all worker Float64 bytes at size ${fixture.size}`, async () => {
      const cold = readAnchors(fixture.size, fixture.seed);
      // Keep the historical capture intact. The signed early tutorial moves
      // only debris 0 to two voxels (four world units) ahead of the first frame;
      // every other coordinate still compares against the original capture.
      const expected = structuredClone(fixture.values);
      const plane = expected.getStorySidePlane;
      expected.getDebrisPoses[0].position.x = plane.origin.x + 4 * plane.travelAxis.x;
      expected.getDebrisPoses[0].position.z = plane.origin.z + 4 * plane.travelAxis.z;
      expect(JSON.parse(JSON.stringify(cold))).toEqual(expected);
      const expectedBytes = new Uint8Array(packPreparedStoryAnchors(cold).buffer);
      clearWorldGenCache();
      const payload = buildPackedWorldPrepPayload(createWorldPrepRequest({
        worldId: story.STORY_PRIMARY_WORLD_ID, seed: fixture.seed, planetSize: fixture.size,
        requestId: `anchors:${fixture.size}`, activationEpoch: 0
      }));
      expect(WORLD_PREP_PROTOCOL_VERSION).toBe(4);
      validatePackedWorldPrepPayload(payload);
      expect(new Uint8Array(payload.buffers.storyAnchors.buffer)).toEqual(expectedBytes);
      const hydrated = await hydrateWorldGenCacheFromPackedPayload(payload, { yieldControl: async () => {} });
      expect(hydrated.preparedStoryAnchors).toBeDefined();
      expect([...hydrated.topFaceColumns!]).toEqual([...buildTopFaceColumns(hydrated.voxels)]);
      const indexedResolver = createStoryAnchorResolver(hydrated);
      const indexed = Object.fromEntries(names.map(name => [name, indexedResolver[name](fixture.size, fixture.seed)])) as PreparedStoryAnchors;
      expect(new Uint8Array(packPreparedStoryAnchors(indexed).buffer)).toEqual(expectedBytes);
      const guardedResolver = createStoryAnchorResolver({
        ...hydrated,
        voxels: new Proxy(hydrated.voxels, { get(target, key, receiver) {
          if (key === Symbol.iterator) throw new Error('Redundant anchor-column scan');
          return Reflect.get(target, key, receiver);
        } })
      });
      expect(guardedResolver.getHeroTreePose(fixture.size, fixture.seed)).toEqual(cold.getHeroTreePose);
      expect(guardedResolver.getAuditWorkerPath(fixture.size, fixture.seed)).toEqual(cold.getAuditWorkerPath);
      // Public queries must be served entirely from the prepared answer.
      hydrated.generator.shouldVoxelExist = () => { throw new Error('Main-thread rescan'); };
      expect(new Uint8Array(packPreparedStoryAnchors(readAnchors(fixture.size, fixture.seed)).buffer)).toEqual(expectedBytes);
      const consumer = story.getAnomalyStonePose(fixture.size, fixture.seed);
      consumer.position.set(999, 999, 999);
      expect(story.getAnomalyStonePose(fixture.size, fixture.seed)).toEqual(cold.getAnomalyStonePose);
      // Edited terrain retains authority, including the absence of safe support.
      const emptyTerrain = { isSolidVoxel: () => false, isWaterVoxel: () => false };
      expect(story.getFieldPackPose(fixture.size, fixture.seed, emptyTerrain)).toBeNull();
      expect(story.getAuditWorkerPath(fixture.size, fixture.seed, emptyTerrain)).toEqual([]);
    }, 60_000);
  }

  it('preserves signed zero and rejects malformed transport without publishing it', () => {
    const anchors = readAnchors(40, story.STORY_SEED);
    anchors.getAnomalyStonePose.up.x = -0;
    const packed = packPreparedStoryAnchors(anchors);
    const unpacked = unpackPreparedStoryAnchors(packed)!;
    expect(Object.is(unpacked.getAnomalyStonePose.up.x, -0)).toBe(true);
    expect(() => unpackPreparedStoryAnchors(packed.subarray(0, packed.length - 1))).toThrow();
    const invalid = packed.slice(); invalid[1] = NaN;
    expect(() => unpackPreparedStoryAnchors(invalid)).toThrow();
    expect(unpackPreparedStoryAnchors(new Float64Array())).toBeNull();
    expect(clonePreparedAnchor(unpacked.getSignalMesaPose).position).toBeInstanceOf(THREE.Vector3);
    expect(getWorldGen(40, story.STORY_SEED, story.STORY_PRIMARY_WORLD_ID).preparedStoryAnchors).toBeUndefined();
  });
});
