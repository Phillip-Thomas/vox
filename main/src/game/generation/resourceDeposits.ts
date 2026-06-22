import type { PlanetProfile } from '../PlanetProfile';
import { BLOCKS, type BlockId } from '../data/blocks';
import { ALL_BIOME_IDS, BIOMES, type BiomeId } from '../data/biomes';
import {
  ALL_RESOURCE_IDS,
  RESOURCES,
  type DepthBand,
  type ResourceDefinition,
  type ResourceId
} from '../data/resources';
import { seededVoxelUnit } from '../../utils/seededHash';

export interface ResourceDeposit {
  resourceId: ResourceId;
  richness: number;
  scanLevel: number;
}

export interface DepositSampleInput {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
  profile: PlanetProfile;
  localBiome: BiomeId;
  depthBand: DepthBand;
}

const BIOME_CELL_SIZE = 9;
const SALT_BIOME_PATCH = 701;
const SALT_DEPOSIT_EXISTS = 811;
const SALT_DEPOSIT_PICK = 827;
const SALT_DEPOSIT_RICHNESS = 839;

const RESOURCE_DEPOSIT_BLOCK: Partial<Record<ResourceId, BlockId>> = {
  silica: 'sand',
  copper_ore: 'copper_block',
  iron_trace: 'silver_block',
  frost_crystal: 'ice',
  basalt_glass: 'basalt',
  charged_crystal: 'crystal_crust',
  gold_trace: 'gold_block',
  void_glass: 'crystal_crust'
};

export function resourceToDepositBlock(resourceId: ResourceId): BlockId | null {
  return RESOURCE_DEPOSIT_BLOCK[resourceId] ?? null;
}

export function sampleLocalBiomeAt(input: {
  x: number;
  y: number;
  z: number;
  profile: PlanetProfile;
}): BiomeId {
  const bx = Math.floor(input.x / BIOME_CELL_SIZE);
  const by = Math.floor(input.y / BIOME_CELL_SIZE);
  const bz = Math.floor(input.z / BIOME_CELL_SIZE);
  const weights = input.profile.biomeWeights;
  const total = Object.values(weights).reduce((sum, value) => sum + (value ?? 0), 0);
  if (total <= 0) return ALL_BIOME_IDS[0];

  let roll = seededVoxelUnit(bx, by, bz, SALT_BIOME_PATCH, input.profile.seed) * total;
  for (const biomeId of ALL_BIOME_IDS) {
    const weight = weights[biomeId] ?? 0;
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) return biomeId;
  }

  return (Object.keys(weights)[0] as BiomeId | undefined) ?? ALL_BIOME_IDS[0];
}

export function depthBandForRadius(
  distanceFromCenter: number,
  coreRadius: number,
  planetRadius: number
): DepthBand {
  const usableDepth = Math.max(1, planetRadius - coreRadius);
  const depth = Math.min(1, Math.max(0, (planetRadius - distanceFromCenter) / usableDepth));
  if (depth < 0.12) return 'surface';
  if (depth < 0.38) return 'shallow';
  if (depth < 0.7) return 'mid';
  return 'deep';
}

export function resourcePlacementScore(
  profile: PlanetProfile,
  resourceId: ResourceId,
  localBiome?: BiomeId
): number {
  const planetBias = profile.resourceBiases[resourceId] ?? 0;
  if (planetBias <= 0) return 0;
  if (!localBiome) return planetBias;

  const resource = RESOURCES[resourceId];
  const biomeAffinity = resource.biomeAffinity?.[localBiome] ?? 1;
  const biomeModifier = BIOMES[localBiome].resourceModifiers?.[resourceId] ?? 1;
  return planetBias * biomeAffinity * biomeModifier;
}

export function resourceCanOccurOnProfile(profile: PlanetProfile, resourceId: ResourceId): boolean {
  return resourcePlacementScore(profile, resourceId) > 0;
}

function blockAllowsDeposit(blockId: BlockId, resource: ResourceDefinition): boolean {
  if (resource.id === 'stone') return false;

  const tags = BLOCKS[blockId].tags;
  if (resource.category === 'organic') return tags.includes('organic');
  if (resource.id === 'frost_crystal') return tags.includes('ice') || tags.includes('rock');
  if (resource.id === 'silica') return tags.includes('soil') || tags.includes('rock') || tags.includes('crystal');
  if (resource.category === 'metal') return tags.includes('rock') || tags.includes('ore');
  if (resource.category === 'crystal' || resource.category === 'exotic') {
    return tags.includes('rock') || tags.includes('crystal');
  }
  return tags.includes('rock') || tags.includes('soil');
}

function depthWeight(depthBand: DepthBand, resource: ResourceDefinition): number {
  if (!resource.depthBands.includes(depthBand)) return 0;
  if (depthBand === 'surface') return 0.75;
  if (depthBand === 'deep') return 1.15;
  return 1;
}

function placementWeight(input: DepositSampleInput, resourceId: ResourceId): number {
  const resource = RESOURCES[resourceId];
  const depth = depthWeight(input.depthBand, resource);
  if (depth <= 0) return 0;
  if (!blockAllowsDeposit(input.blockId, resource)) return 0;

  const score = resourcePlacementScore(input.profile, resourceId, input.localBiome);
  if (score <= 0) return 0;

  const clusterHint = 0.65 + resource.clusterSize * 0.12;
  return score * depth * clusterHint;
}

export function sampleDepositAt(input: DepositSampleInput): ResourceDeposit | null {
  const candidates: Array<{ id: ResourceId; weight: number }> = [];
  let totalWeight = 0;

  for (const resourceId of ALL_RESOURCE_IDS) {
    const weight = placementWeight(input, resourceId);
    if (weight <= 0) continue;
    candidates.push({ id: resourceId, weight });
    totalWeight += weight;
  }

  if (totalWeight <= 0) return null;

  const depositChance = Math.min(0.3, totalWeight * 0.055);
  if (seededVoxelUnit(input.x, input.y, input.z, SALT_DEPOSIT_EXISTS, input.profile.seed) > depositChance) {
    return null;
  }

  let roll = seededVoxelUnit(input.x, input.y, input.z, SALT_DEPOSIT_PICK, input.profile.seed) * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      const resource = RESOURCES[candidate.id];
      return {
        resourceId: candidate.id,
        richness: 0.75 + seededVoxelUnit(input.x, input.y, input.z, SALT_DEPOSIT_RICHNESS, input.profile.seed) * 0.75,
        scanLevel: resource.scanLevel
      };
    }
  }

  return null;
}
