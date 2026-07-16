import { describe, expect, it } from 'vitest';
import { createLiveAgentSurfaceTerrain } from './agentSurfaceNavigationRuntime.ts';
import { STORY_SEED } from '../story/world/storyWorld.ts';
import { STORY_PRIMARY_WORLD_ID } from '../story/tidegardenRoute.ts';
import {
  clearWorldGenCache,
  getWorldGen,
  hasWorldGenCacheEntry
} from './worldGenCache.ts';

describe('live agent surface terrain adapter', () => {
  it('publishes stable occupancy, water, hazard, and revision queries', () => {
    const terrain = createLiveAgentSurfaceTerrain(50, STORY_SEED);
    expect(typeof terrain.revision).toBe('string');
    expect(terrain.revision.split(':')).toHaveLength(3);
    expect(typeof terrain.isSolidVoxel(0, 0, 0)).toBe('boolean');
    expect(typeof terrain.isWaterVoxel(0, 30, 0)).toBe('boolean');
    expect(typeof terrain.isHazardousVoxel?.(0, 0, 0)).toBe('boolean');
  });

  it('reuses the canonical story generator without creating a seed-only twin', () => {
    const size = 18;
    clearWorldGenCache();
    const canonical = getWorldGen(size, STORY_SEED, STORY_PRIMARY_WORLD_ID);

    const terrain = createLiveAgentSurfaceTerrain(
      size,
      STORY_SEED,
      STORY_PRIMARY_WORLD_ID
    );

    expect(terrain.revision).toContain(canonical.generator.getWaterEditVersion().toString());
    expect(hasWorldGenCacheEntry(size, STORY_SEED, STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(hasWorldGenCacheEntry(size, STORY_SEED)).toBe(false);
  });
});
