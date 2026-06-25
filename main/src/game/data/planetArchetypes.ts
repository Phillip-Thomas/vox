// --- Planet archetype registry -----------------------------------------------
//
// The high-level identity of a planet. Instead of "random terrain + colours",
// each planet rolls one archetype that controls its terrain preset, the MIX of
// local biomes it presents, its climate centre, emphasized resource families,
// hazards, and 1-2 memorable signature traits. This is what makes "where do I
// warp?" a decision.
//
// Type-only references (BiomeId, ResourceId, TerrainProfile) — no runtime cycle.

import { coordinateToSeed, seededUnit, type WorldCoordinate } from '../../utils/worldCoordinates.ts';
import { createLocalSimulationRng } from '../rng.ts';
import type { TerrainProfile } from '../../config/worldGeneration.ts';
import type { BiomeId } from './biomes.ts';
import type { ResourceId } from './resources.ts';

export type ArchetypeId =
  | 'verdant' | 'arid' | 'frozen' | 'volcanic' | 'oceanic'
  | 'crystal' | 'metallic' | 'fungal' | 'anomaly';

export type HazardId =
  | 'none' | 'toxic_fog' | 'extreme_cold' | 'extreme_heat'
  | 'radiation' | 'magnetic_storm' | 'low_oxygen';

export interface PlanetArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  /** Relative selection weight when rolling a planet's archetype. */
  weight: number;
  terrainProfile: TerrainProfile;
  /** Climate centre (0..1) informing the planet's overall mood. */
  climateBias: { lushness: number; aridity: number; temperature: number };
  /** Local biomes this archetype can present, with relative weights. */
  biomeWeights: Partial<Record<BiomeId, number>>;
  /** Extra per-resource multiplier on top of each resource's own affinity. */
  resourceBias?: Partial<Record<ResourceId, number>>;
  hazards: HazardId[];
  /** Memorable signature traits (scan + identity). */
  traits: string[];
  /** Progression tier this archetype tends to reward. */
  progressionTier: number;
}

export const PLANET_ARCHETYPES: Record<ArchetypeId, PlanetArchetypeDefinition> = {
  verdant: {
    id: 'verdant', name: 'Lush Garden', weight: 18, terrainProfile: 'hills',
    climateBias: { lushness: 0.85, aridity: 0.15, temperature: 0.55 },
    biomeWeights: { forest: 5, grassland: 4, coast: 2, highland: 1 },
    resourceBias: { resin: 1.4, biofiber: 1.4 },
    hazards: ['none'], traits: ['giant trees', 'dense canopy'], progressionTier: 1
  },
  arid: {
    id: 'arid', name: 'Arid Mesa', weight: 16, terrainProfile: 'mountains',
    climateBias: { lushness: 0.2, aridity: 0.85, temperature: 0.7 },
    biomeWeights: { mesa: 5, coast: 2, highland: 2, cave: 1 },
    resourceBias: { silica: 1.3, copper_ore: 1.3 },
    hazards: ['extreme_heat', 'low_oxygen'], traits: ['canyon strata', 'dust storms'], progressionTier: 1
  },
  frozen: {
    id: 'frozen', name: 'Frozen Ridge', weight: 12, terrainProfile: 'mountains',
    climateBias: { lushness: 0.25, aridity: 0.4, temperature: 0.08 },
    biomeWeights: { highland: 5, grassland: 1, cave: 2, volcanic_scar: 1 },
    resourceBias: { frost_crystal: 1.6 },
    hazards: ['extreme_cold'], traits: ['snow caps', 'ice sheets'], progressionTier: 2
  },
  volcanic: {
    id: 'volcanic', name: 'Volcanic Basalt', weight: 11, terrainProfile: 'mountains',
    climateBias: { lushness: 0.15, aridity: 0.5, temperature: 0.9 },
    biomeWeights: { volcanic_scar: 5, mesa: 2, cave: 3 },
    resourceBias: { basalt_glass: 1.5, iron_trace: 1.2 },
    hazards: ['extreme_heat', 'toxic_fog'], traits: ['lava flows', 'ash plains'], progressionTier: 2
  },
  oceanic: {
    id: 'oceanic', name: 'Oceanic Isles', weight: 12, terrainProfile: 'islands',
    climateBias: { lushness: 0.6, aridity: 0.3, temperature: 0.6 },
    biomeWeights: { coast: 5, grassland: 3, forest: 2 },
    resourceBias: { silica: 1.3, biofiber: 1.1 },
    hazards: ['none'], traits: ['glowing oceans', 'archipelagos'], progressionTier: 1
  },
  crystal: {
    id: 'crystal', name: 'Crystal Wastes', weight: 8, terrainProfile: 'valleys',
    climateBias: { lushness: 0.2, aridity: 0.6, temperature: 0.4 },
    biomeWeights: { crystal_field: 5, mesa: 2, cave: 3 },
    resourceBias: { charged_crystal: 1.6, silica: 1.2 },
    hazards: ['radiation'], traits: ['floating crystals', 'refractive light'], progressionTier: 3
  },
  metallic: {
    id: 'metallic', name: 'Metallic Moon', weight: 8, terrainProfile: 'balanced',
    climateBias: { lushness: 0.1, aridity: 0.7, temperature: 0.45 },
    biomeWeights: { mesa: 3, cave: 4, highland: 2 },
    resourceBias: { iron_trace: 1.6, copper_ore: 1.4, gold_trace: 1.4 },
    hazards: ['magnetic_storm', 'low_oxygen'], traits: ['magnetic storms', 'metal ridges'], progressionTier: 3
  },
  fungal: {
    id: 'fungal', name: 'Fungal Bloom', weight: 7, terrainProfile: 'hills',
    climateBias: { lushness: 0.7, aridity: 0.35, temperature: 0.55 },
    biomeWeights: { forest: 4, grassland: 3, cave: 2 },
    resourceBias: { resin: 1.5, biofiber: 1.3 },
    hazards: ['toxic_fog'], traits: ['spore clouds', 'bioluminescence'], progressionTier: 2
  },
  anomaly: {
    id: 'anomaly', name: 'Exotic Anomaly', weight: 4, terrainProfile: 'valleys',
    climateBias: { lushness: 0.3, aridity: 0.5, temperature: 0.5 },
    biomeWeights: { crystal_field: 3, cave: 4, mesa: 1 },
    resourceBias: { void_glass: 2.0, charged_crystal: 1.4 },
    hazards: ['radiation', 'magnetic_storm'], traits: ['reality distortion', 'void rifts'], progressionTier: 4
  }
};

export const ALL_ARCHETYPE_IDS = Object.keys(PLANET_ARCHETYPES) as ArchetypeId[];

export function getArchetype(id: ArchetypeId): PlanetArchetypeDefinition {
  return PLANET_ARCHETYPES[id];
}

export const TOTAL_ARCHETYPE_WEIGHT = ALL_ARCHETYPE_IDS.reduce(
  (sum, id) => sum + PLANET_ARCHETYPES[id].weight,
  0
);

const SALT_ARCHETYPE = 101;

/** Deterministic weighted archetype for a planet seed. Shared so PlanetProfile
 *  and the biome anchor agree on a planet's identity (climate reconciliation). */
export function archetypeForSeed(seed: number): ArchetypeId {
  const roll = seededUnit(seed | 0, SALT_ARCHETYPE) * TOTAL_ARCHETYPE_WEIGHT;
  let acc = 0;
  for (const id of ALL_ARCHETYPE_IDS) {
    acc += PLANET_ARCHETYPES[id].weight;
    if (roll <= acc) return id;
  }
  return ALL_ARCHETYPE_IDS[ALL_ARCHETYPE_IDS.length - 1];
}

// --- Crash-landing start -----------------------------------------------------
//
// A fresh game must crash you somewhere SURVIVABLE that has the Primitive era's
// necessities: trees (wood), grass (biofiber), stone, and no early hazard. These
// archetypes qualify (lush, treed, hazards 'none'). Exploration/travel afterwards
// is unconstrained — only the very first planet is pinned hospitable.
export const STARTING_ARCHETYPES: ArchetypeId[] = ['verdant', 'oceanic'];

export function isHospitableStart(seed: number): boolean {
  return STARTING_ARCHETYPES.includes(archetypeForSeed(seed));
}

/**
 * Pick a starting-world coordinate whose planet is a hospitable starting archetype.
 * Tries random coordinates (so fresh sessions vary) then falls back to an
 * exhaustive scan, so it ALWAYS returns a survivable crash site. Deterministic
 * given `rand`.
 */
export function findHospitableStart(rand?: () => number): WorldCoordinate {
  const next = rand ?? createLocalSimulationRng('hospitable-start').next;
  const range = 100;
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(next() * (range * 2 + 1)) - range;
    const y = Math.floor(next() * (range * 2 + 1)) - range;
    if (isHospitableStart(coordinateToSeed(x, y))) return { x, y };
  }
  // Fallback scan (the random pass effectively always succeeds — ~31% per try).
  for (let x = -range; x <= range; x++) {
    for (let y = -range; y <= range; y++) {
      if (isHospitableStart(coordinateToSeed(x, y))) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}
