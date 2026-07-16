// --- PlanetProfile: the deterministic source of truth for one planet ----------
//
// From a coordinate seed we roll a single PlanetProfile that every system reads:
// terrain preset, local biome mix, contextual resource biases, hazards, palette,
// and progression tier. terrain/material/resource generation, the scanner, and
// crafting all consume THIS — no one-off resource logic hidden in rendering.
//
// Generic planets resolve their archetype from the seed. Authored canonical
// identities resolve the archetype first and build climate/biome from that same
// decision, preventing a pinned surface from retaining a contradictory seed roll.
//
// Determinism: ONLY salted `seededUnit(seed, salt)` — no order-dependent random
// streams, so adding fields here never reshuffles existing planets.

import {
  buildBiomeProfileForArchetype,
  type BiomeProfile,
  type BiomeProfileOverrides
} from '../utils/biomeProfile.ts';
import type { TerrainProfile } from '../config/worldGeneration.ts';
import { fnv1a32 } from '../utils/worldCoordinates.ts';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';
import {
  canonicalPlanetWorldId,
  parsePlanetWorldId,
  planetSeedForAddress
} from './starSystem.ts';
import {
  PLANET_ARCHETYPES, archetypeForSeed,
  type ArchetypeId, type HazardId
} from './data/planetArchetypes.ts';
import { BIOMES, type BiomeId } from './data/biomes.ts';
import { RESOURCES, ALL_RESOURCE_IDS, type ResourceId } from './data/resources.ts';

export interface PlanetPalette {
  /** Primary vegetation hue (0..1 sRGB), cohered across grass/trees. */
  vegetationHue: number;
  saturation: number;
  temperature: number;
  alien: boolean;
}

export interface PlanetProfile {
  schemaVersion: number;
  seed: number;
  archetype: ArchetypeId;
  archetypeName: string;
  /** Planet-wide climate/vegetation anchor (existing system, wrapped). */
  biome: BiomeProfile;
  terrainProfile: TerrainProfile;
  /** Normalized local-biome mix (sums to ~1). */
  biomeWeights: Partial<Record<BiomeId, number>>;
  /** Effective per-resource planet bias (affinity × archetype × biome mix × baseFrequency). */
  resourceBiases: Partial<Record<ResourceId, number>>;
  hazards: HazardId[];
  palette: PlanetPalette;
  progressionTier: number;
  traits: string[];
}

export type PlanetThermalBehavior = 'standard' | 'nonlethal';

/** Canonical identity plus the fully constructed profile consumed by generation. */
export interface ResolvedPlanetProfile {
  worldId?: string;
  identitySeed: number;
  profileId: string;
  profileVersion: number;
  profileHash: string;
  thermalBehavior: PlanetThermalBehavior;
  profile: PlanetProfile;
}

export interface PlanetProfileFingerprintSource {
  worldId?: string;
  identitySeed: number;
  profileId: string;
  profileVersion: number;
  thermalBehavior: PlanetThermalBehavior;
  profile: PlanetProfile;
}

export const TIDEGARDEN_WORLD_ID = '-1,-1:p1';
export const TIDEGARDEN_SEED = 1600321158;
export const TIDEGARDEN_PROFILE_ID = 'story:tidegarden';
export const TIDEGARDEN_PROFILE_VERSION = 1;
export const PLANET_PROFILE_FINGERPRINT_VERSION = 1;

const TIDEGARDEN_BIOME_WEIGHTS: Partial<Record<BiomeId, number>> = {
  forest: 4,
  grassland: 3,
  coast: 4,
  highland: 1
};

const TIDEGARDEN_BIOME: BiomeProfileOverrides = {
  lushness: 0.75,
  aridity: 0.2,
  temperature: 0.56,
  hue: 0.5,
  grassHue: 0.4,
  leafHue: 0.6,
  saturation: 0.72,
  alien: true
};

const TIDEGARDEN_RESOURCE_MULTIPLIERS: Partial<Record<ResourceId, number>> = {
  stone: 1.15,
  silica: 1.4,
  copper_ore: 1.05,
  iron_trace: 1.4,
  resin: 1.2,
  biofiber: 1.2,
  // Tidegarden is explicitly temperate/nonlethal, not a frozen-world variant.
  frost_crystal: 0
};

function normalizeBiomeWeights(raw: Partial<Record<BiomeId, number>>): Partial<Record<BiomeId, number>> {
  const total = Object.values(raw).reduce((s, w) => s + (w ?? 0), 0);
  if (total <= 0) return {};
  const out: Partial<Record<BiomeId, number>> = {};
  for (const [k, w] of Object.entries(raw)) out[k as BiomeId] = (w ?? 0) / total;
  return out;
}

/**
 * Effective per-resource bias for the whole planet — the contextual rarity rolled
 * up: resource baseFrequency × archetype affinity × archetype resourceBias ×
 * (Σ over the planet's local biomes of weight × resource biomeAffinity × biome
 * resourceModifier). 0 means the resource cannot occur here. This is what the
 * scanner manifest and resource placement will both read.
 */
function computeResourceBiases(
  archetype: ArchetypeId,
  biomeWeights: Partial<Record<BiomeId, number>>,
  authoredMultipliers: Partial<Record<ResourceId, number>> = {}
): Partial<Record<ResourceId, number>> {
  const arch = PLANET_ARCHETYPES[archetype];
  const out: Partial<Record<ResourceId, number>> = {};
  for (const rid of ALL_RESOURCE_IDS) {
    const res = RESOURCES[rid];
    // Exclusive resources only occur on archetypes they explicitly list.
    const archAff = res.archetypeAffinity?.[archetype] ?? (res.exclusive ? 0 : 1);
    if (archAff === 0) continue;
    const archBias = arch.resourceBias?.[rid] ?? 1;

    let biomeFactor = 0;
    for (const [bid, w] of Object.entries(biomeWeights)) {
      const weight = w ?? 0;
      if (weight <= 0) continue;
      const biomeAff = res.biomeAffinity?.[bid as BiomeId] ?? 1;
      const biomeMod = BIOMES[bid as BiomeId].resourceModifiers?.[rid] ?? 1;
      biomeFactor += weight * biomeAff * biomeMod;
    }
    // Tier-0 resources are ubiquitous regardless of biome mix (critical path).
    if (res.tier === 0) biomeFactor = Math.max(biomeFactor, 1);

    const authoredMultiplier = authoredMultipliers[rid] ?? 1;
    const bias = res.baseFrequency * archAff * archBias * biomeFactor * authoredMultiplier;
    if (bias > 0) out[rid] = bias;
  }
  return out;
}

/** Build the deterministic PlanetProfile for a coordinate seed. Pure. */
export function buildPlanetProfile(seed: number): PlanetProfile {
  const s = seed | 0;
  const archetype = archetypeForSeed(s);
  return buildPlanetProfileForArchetype(s, archetype);
}

/** Guard identity-aware visual seams against mixing one profile with another seed. */
export function assertPlanetProfileSeed(profile: PlanetProfile, seed: number): void {
  if ((profile.seed >>> 0) !== (seed >>> 0)) {
    throw new Error(
      `Planet profile seed ${profile.seed >>> 0} does not match visual seed ${seed >>> 0}`
    );
  }
}

interface AuthoredProfileOptions {
  archetypeName?: string;
  biomeOverrides?: BiomeProfileOverrides;
  biomeWeights?: Partial<Record<BiomeId, number>>;
  resourceMultipliers?: Partial<Record<ResourceId, number>>;
  hazards?: HazardId[];
  traits?: string[];
}

function buildPlanetProfileForArchetype(
  seed: number,
  archetype: ArchetypeId,
  options: AuthoredProfileOptions = {}
): PlanetProfile {
  const s = seed | 0;
  const arch = PLANET_ARCHETYPES[archetype];
  const biome = buildBiomeProfileForArchetype(s, archetype, options.biomeOverrides);
  const biomeWeights = normalizeBiomeWeights(options.biomeWeights ?? arch.biomeWeights);
  const resourceBiases = computeResourceBiases(
    archetype,
    biomeWeights,
    options.resourceMultipliers
  );

  return {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    seed: s,
    archetype,
    archetypeName: options.archetypeName ?? arch.name,
    biome,
    terrainProfile: arch.terrainProfile,
    biomeWeights,
    resourceBiases,
    hazards: options.hazards ?? arch.hazards,
    palette: {
      vegetationHue: biome.hue,
      saturation: biome.saturation,
      temperature: biome.temperature,
      alien: biome.alien
    },
    progressionTier: arch.progressionTier,
    traits: options.traits ?? arch.traits
  };
}

/**
 * Resolve the generation profile from canonical identity. The Tidegarden pin is
 * deliberately an exact world-ID + seed match; p2 and seed-only callers always
 * remain on the procedural path.
 */
export function resolvePlanetProfile(input: {
  worldId?: string;
  seed: number;
}): ResolvedPlanetProfile {
  const identitySeed = input.seed >>> 0;
  if (input.worldId !== undefined) {
    const address = parsePlanetWorldId(input.worldId);
    const canonicalWorldId = canonicalPlanetWorldId(input.worldId);
    if (!address || canonicalWorldId !== input.worldId) {
      throw new Error(`Planet profile requires a canonical world ID: ${input.worldId}`);
    }
    const expectedSeed = planetSeedForAddress(address) >>> 0;
    if (identitySeed !== expectedSeed) {
      throw new Error(
        `Planet profile seed ${identitySeed} does not match canonical world ${input.worldId}`
      );
    }
  }
  const isTidegarden = input.worldId === TIDEGARDEN_WORLD_ID
    && identitySeed === TIDEGARDEN_SEED;
  const profile = isTidegarden
    ? buildPlanetProfileForArchetype(identitySeed, 'verdant', {
      archetypeName: 'Tidegarden v1',
      biomeOverrides: TIDEGARDEN_BIOME,
      biomeWeights: TIDEGARDEN_BIOME_WEIGHTS,
      resourceMultipliers: TIDEGARDEN_RESOURCE_MULTIPLIERS,
      hazards: ['none'],
      traits: ['alien wet hills', 'dense fan canopy', 'braided shallows']
    })
    : buildPlanetProfile(identitySeed);
  const source: PlanetProfileFingerprintSource = {
    worldId: input.worldId,
    identitySeed,
    profileId: isTidegarden ? TIDEGARDEN_PROFILE_ID : 'procedural',
    profileVersion: isTidegarden ? TIDEGARDEN_PROFILE_VERSION : GENERATION_SCHEMA_VERSION,
    thermalBehavior: isTidegarden ? 'nonlethal' : 'standard',
    profile
  };

  return {
    ...source,
    profileHash: createPlanetProfileHash(source)
  };
}

/** Stable, request-independent fingerprint for cache/save generation boundaries. */
export function createPlanetProfileHash(source: PlanetProfileFingerprintSource): string {
  const canonical = stableStringify({
    fingerprintVersion: PLANET_PROFILE_FINGERPRINT_VERSION,
    worldId: source.worldId ?? null,
    identitySeed: source.identitySeed >>> 0,
    profileId: source.profileId,
    profileVersion: source.profileVersion,
    thermalBehavior: source.thermalBehavior,
    profile: source.profile
  });
  return `pf${PLANET_PROFILE_FINGERPRINT_VERSION}-${fnv1a32(canonical).toString(16).padStart(8, '0')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const object = value as Record<string, unknown>;
  const entries = Object.keys(object)
    .filter(key => object[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`);
  return `{${entries.join(',')}}`;
}
