// --- PlanetProfile: the deterministic source of truth for one planet ----------
//
// From a coordinate seed we roll a single PlanetProfile that every system reads:
// terrain preset, local biome mix, contextual resource biases, hazards, palette,
// and progression tier. terrain/material/resource generation, the scanner, and
// crafting all consume THIS — no one-off resource logic hidden in rendering.
//
// Phase 1 is ADDITIVE: this wraps the existing planet-wide `buildBiomeProfile`
// (climate/vegetation anchor that grass/trees/fog already use) and ADDS the
// archetype + economy layer alongside it. Nothing here changes terrain output yet.
// NOTE: archetype and the wrapped BiomeProfile are rolled independently from the
// same seed for now; Phase 2 (profile becomes authoritative) reconciles them so
// e.g. a 'frozen' archetype also drives a cold BiomeProfile.
//
// Determinism: ONLY salted `seededUnit(seed, salt)` — no order-dependent random
// streams, so adding fields here never reshuffles existing planets.

import { seededUnit } from '../utils/worldCoordinates.ts';
import { buildBiomeProfile, type BiomeProfile } from '../utils/biomeProfile.ts';
import type { TerrainProfile } from '../config/worldGeneration.ts';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';
import {
  PLANET_ARCHETYPES, ALL_ARCHETYPE_IDS, TOTAL_ARCHETYPE_WEIGHT,
  type ArchetypeId, type HazardId
} from './data/planetArchetypes.ts';
import { BIOMES, type BiomeId } from './data/biomes.ts';
import { RESOURCES, ALL_RESOURCE_IDS, type ResourceId } from './data/resources.ts';

const SALT_ARCHETYPE = 101;

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

function pickArchetype(seed: number): ArchetypeId {
  const roll = seededUnit(seed, SALT_ARCHETYPE) * TOTAL_ARCHETYPE_WEIGHT;
  let acc = 0;
  for (const id of ALL_ARCHETYPE_IDS) {
    acc += PLANET_ARCHETYPES[id].weight;
    if (roll <= acc) return id;
  }
  return ALL_ARCHETYPE_IDS[ALL_ARCHETYPE_IDS.length - 1];
}

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
  biomeWeights: Partial<Record<BiomeId, number>>
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

    const bias = res.baseFrequency * archAff * archBias * biomeFactor;
    if (bias > 0) out[rid] = bias;
  }
  return out;
}

/** Build the deterministic PlanetProfile for a coordinate seed. Pure. */
export function buildPlanetProfile(seed: number): PlanetProfile {
  const s = seed | 0;
  const archetype = pickArchetype(s);
  const arch = PLANET_ARCHETYPES[archetype];
  const biome = buildBiomeProfile(s);
  const biomeWeights = normalizeBiomeWeights(arch.biomeWeights);
  const resourceBiases = computeResourceBiases(archetype, biomeWeights);

  return {
    schemaVersion: GENERATION_SCHEMA_VERSION,
    seed: s,
    archetype,
    archetypeName: arch.name,
    biome,
    terrainProfile: arch.terrainProfile,
    biomeWeights,
    resourceBiases,
    hazards: arch.hazards,
    palette: {
      vegetationHue: biome.hue,
      saturation: biome.saturation,
      temperature: biome.temperature,
      alien: biome.alien
    },
    progressionTier: arch.progressionTier,
    traits: arch.traits
  };
}
