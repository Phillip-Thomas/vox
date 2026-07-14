import { describe, expect, it } from 'vitest';
import { createLiveAgentSurfaceTerrain } from './agentSurfaceNavigationRuntime.ts';
import { STORY_SEED } from '../story/world/storyWorld.ts';

describe('live agent surface terrain adapter', () => {
  it('publishes stable occupancy, water, hazard, and revision queries', () => {
    const terrain = createLiveAgentSurfaceTerrain(50, STORY_SEED);
    expect(typeof terrain.revision).toBe('string');
    expect(terrain.revision.split(':')).toHaveLength(3);
    expect(typeof terrain.isSolidVoxel(0, 0, 0)).toBe('boolean');
    expect(typeof terrain.isWaterVoxel(0, 30, 0)).toBe('boolean');
    expect(typeof terrain.isHazardousVoxel?.(0, 0, 0)).toBe('boolean');
  });
});
