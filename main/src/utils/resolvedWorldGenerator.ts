import {
  resolvePlanetProfile,
  type ResolvedPlanetProfile
} from '../game/PlanetProfile.ts';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator.ts';
import { createTerrainConfigFromProfile } from './terrainConfig.ts';

export interface ResolvedWorldGeneratorInput {
  worldId?: string;
  seed: number;
  planetRadius: number;
  coreRadiusPercent?: number;
}

export interface ResolvedWorldGenerator {
  resolution: ResolvedPlanetProfile;
  generator: ProceduralWorldGenerator;
}

/**
 * Single construction seam for canonical world generation. Terrain config and
 * the live generator receive the same resolved profile, preventing hydration or
 * collision queries from silently rebuilding the seed's generic archetype.
 */
export function createResolvedWorldGenerator(
  input: ResolvedWorldGeneratorInput
): ResolvedWorldGenerator {
  const resolution = resolvePlanetProfile({
    worldId: input.worldId,
    seed: input.seed
  });
  const terrainConfig = createTerrainConfigFromProfile(
    resolution.profile,
    input.planetRadius
  );
  const generator = new ProceduralWorldGenerator(
    {
      planetRadius: input.planetRadius,
      coreRadiusPercent: input.coreRadiusPercent ?? 0.15
    },
    terrainConfig,
    resolution.profile
  );
  return { resolution, generator };
}
