import type { BlockId } from '../game/data/blocks.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { getWorldGen } from './worldGenCache.ts';
import type { AgentSurfaceTerrainQuery } from './agentSurfaceNavigation.ts';

/** Live-world adapter for the pure agent planner. Purposeful NPCs and movie
 * mode share this exact occupancy/water contract; passive fauna can keep its
 * cheaper local wander until it has an authored destination. */
export interface LiveAgentSurfaceTerrain extends AgentSurfaceTerrainQuery {
  revision: string;
}

export function createLiveAgentSurfaceTerrain(
  planetSize: number,
  terrainSeed: number
): LiveAgentSurfaceTerrain {
  const generator = getWorldGen(planetSize, terrainSeed).generator;
  const liveBlock = (x: number, y: number, z: number): BlockId | null =>
    voxelSystem.getVoxel(x, y, z)?.blockId ?? null;
  return {
    // `hasVoxel` catches placed blocks and currently exposed generated terrain;
    // the generator branch catches buried terrain, minus live/persisted digs.
    isSolidVoxel: (x, y, z) => voxelSystem.hasVoxel(x, y, z)
      || (generator.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z)),
    // ProceduralWorldGenerator owns both its initial ocean and dynamic refills.
    isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
    isHazardousVoxel: (x, y, z) =>
      (liveBlock(x, y, z) ?? generator.generateBlockForPosition(x, y, z)) === 'lava',
    revision: `${voxelSystem.getWorldId()}:${voxelSystem.getEditVersion()}:${generator.getWaterEditVersion()}`
  };
}
