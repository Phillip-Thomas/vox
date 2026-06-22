import { buildPlanetProfile, type PlanetProfile } from '../PlanetProfile';
import { type BiomeId } from '../data/biomes';
import { ALL_RESOURCE_IDS, RESOURCES, type ResourceId } from '../data/resources';
import type { ArchetypeId, HazardId } from '../data/planetArchetypes';
import { GENERATION_SCHEMA_VERSION } from '../schema';
import { resourceCanOccurOnProfile, resourcePlacementScore } from './resourceDeposits';

export interface PlanetManifest {
  schemaVersion: number;
  seed: number;
  archetype: ArchetypeId;
  traits: string[];
  hazards: HazardId[];
  commonResources: ResourceId[];
  rareResources: ResourceId[];
  hiddenResources: ResourceId[];
  dominantBiomes: BiomeId[];
}

export function buildPlanetManifest(profileOrSeed: PlanetProfile | number): PlanetManifest {
  const profile = typeof profileOrSeed === 'number'
    ? buildPlanetProfile(profileOrSeed)
    : profileOrSeed;

  const eligible = ALL_RESOURCE_IDS
    .filter(resourceId => resourceCanOccurOnProfile(profile, resourceId))
    .sort((a, b) => {
      const sa = resourcePlacementScore(profile, a);
      const sb = resourcePlacementScore(profile, b);
      return sb - sa || RESOURCES[a].tier - RESOURCES[b].tier || a.localeCompare(b);
    });

  const commonResources: ResourceId[] = [];
  const rareResources: ResourceId[] = [];
  const hiddenResources: ResourceId[] = [];

  for (const resourceId of eligible) {
    const resource = RESOURCES[resourceId];
    const score = resourcePlacementScore(profile, resourceId);
    if (resource.scanLevel >= 3) hiddenResources.push(resourceId);
    else if (score >= 0.22 || resource.tier === 0) commonResources.push(resourceId);
    else rareResources.push(resourceId);
  }

  const dominantBiomes = (Object.entries(profile.biomeWeights) as [BiomeId, number][])
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([biomeId]) => biomeId);

  return {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    seed: profile.seed,
    archetype: profile.archetype,
    traits: [...profile.traits],
    hazards: [...profile.hazards],
    commonResources,
    rareResources,
    hiddenResources,
    dominantBiomes
  };
}
