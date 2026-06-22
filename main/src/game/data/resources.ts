// --- Resource registry (game economy source of truth) ------------------------
//
// A ResourceDefinition is what the player HARVESTS and CRAFTS with — deliberately
// SEPARATE from how a voxel renders (MaterialType) and from what a voxel IS
// (BlockId). A basalt block might yield `stone` + trace `basalt_glass`; a crystal
// crust might yield `silica` or `charged_crystal` depending on biome/depth.
//
// Rarity is CONTEXTUAL, never one global number: `baseFrequency` is the abundance
// when a resource is eligible at all, then `biomeAffinity` / `archetypeAffinity` /
// `depthBands` gate WHERE it appears. The terrain generator, scanner, and crafting
// all read these same definitions (no one-off resource logic in rendering code).
//
// First content pack: small + balanced (prove the structure, not fill the universe).

import type { BiomeId } from './biomes.ts';
import type { ArchetypeId } from './planetArchetypes.ts';

export type ResourceId =
  | 'stone'          // tier 0 — ubiquitous building basic
  | 'silica'         // tier 1 — glass/electronics base
  | 'copper_ore'     // tier 1 — early metal
  | 'iron_trace'     // tier 1 — structural metal
  | 'resin'          // tier 2 — organic binder (lush)
  | 'biofiber'       // tier 2 — organic textile (lush/forest)
  | 'frost_crystal'  // tier 2 — coolant (frozen/high altitude)
  | 'basalt_glass'   // tier 3 — heat material (volcanic)
  | 'charged_crystal'// tier 3 — energy cell (crystal)
  | 'gold_trace'     // tier 3 — conductor (metallic)
  | 'void_glass';    // tier 4 — exotic anomaly material (deep/anomaly)

export type ResourceTier = 0 | 1 | 2 | 3 | 4 | 5;
export type ResourceCategory = 'mineral' | 'metal' | 'organic' | 'crystal' | 'exotic';
/** Vertical band a resource can occur in (radial: surface skin → core-ward). */
export type DepthBand = 'surface' | 'shallow' | 'mid' | 'deep';

export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  tier: ResourceTier;
  category: ResourceCategory;
  /** Relative abundance (0..1) WHEN eligible. Not a global rarity — context gates it. */
  baseFrequency: number;
  /** Per-local-biome multiplier (absent = neutral 1; 0 = excluded). */
  biomeAffinity?: Partial<Record<BiomeId, number>>;
  /** Per-planet-archetype multiplier (absent = neutral 1; 0 = excluded). */
  archetypeAffinity?: Partial<Record<ArchetypeId, number>>;
  /**
   * When true, `archetypeAffinity` is a WHITELIST: the resource only occurs on
   * the archetypes it explicitly lists (unlisted → excluded). Use for thematic
   * exotics so they don't leak everywhere at the neutral default.
   */
  exclusive?: boolean;
  /** Depth bands where it can spawn. */
  depthBands: DepthBand[];
  /** Typical vein/cluster size hint for vein builders. */
  clusterSize: number;
  /** Minimum tool tier required to harvest. */
  toolTier: number;
  /** Inclusive yield range per harvested node [min, max]. */
  yield: [number, number];
  /** Scanner tier required to reveal this on a planet manifest (0 = always shown). */
  scanLevel: number;
}

export const RESOURCES: Record<ResourceId, ResourceDefinition> = {
  stone: {
    id: 'stone', name: 'Stone', tier: 0, category: 'mineral',
    baseFrequency: 1.0, depthBands: ['surface', 'shallow', 'mid', 'deep'],
    clusterSize: 1, toolTier: 0, yield: [1, 2], scanLevel: 0
  },
  silica: {
    id: 'silica', name: 'Silica', tier: 1, category: 'mineral',
    baseFrequency: 0.45,
    archetypeAffinity: { arid: 1.6, oceanic: 1.4, crystal: 1.3, volcanic: 0.8 },
    biomeAffinity: { coast: 1.6, mesa: 1.4, crystal_field: 1.3 },
    depthBands: ['surface', 'shallow', 'mid'], clusterSize: 3, toolTier: 0, yield: [1, 3], scanLevel: 0
  },
  copper_ore: {
    id: 'copper_ore', name: 'Copper Ore', tier: 1, category: 'metal',
    baseFrequency: 0.30,
    archetypeAffinity: { arid: 1.5, volcanic: 1.4, metallic: 1.8, verdant: 0.6 },
    depthBands: ['shallow', 'mid'], clusterSize: 4, toolTier: 1, yield: [1, 3], scanLevel: 1
  },
  iron_trace: {
    id: 'iron_trace', name: 'Iron Trace', tier: 1, category: 'metal',
    baseFrequency: 0.28,
    archetypeAffinity: { metallic: 1.9, volcanic: 1.3, arid: 1.1 },
    depthBands: ['shallow', 'mid', 'deep'], clusterSize: 4, toolTier: 1, yield: [1, 2], scanLevel: 1
  },
  resin: {
    id: 'resin', name: 'Resin', tier: 2, category: 'organic',
    baseFrequency: 0.35,
    archetypeAffinity: { verdant: 1.7, fungal: 1.4, oceanic: 1.1, arid: 0.2, frozen: 0.1 },
    biomeAffinity: { forest: 1.8, grassland: 1.1 },
    depthBands: ['surface'], clusterSize: 2, toolTier: 0, yield: [1, 2], scanLevel: 1
  },
  biofiber: {
    id: 'biofiber', name: 'Biofiber', tier: 2, category: 'organic',
    baseFrequency: 0.32,
    archetypeAffinity: { verdant: 1.6, fungal: 1.5, oceanic: 1.0, frozen: 0.1, volcanic: 0.1 },
    biomeAffinity: { forest: 1.6, grassland: 1.3 },
    depthBands: ['surface'], clusterSize: 2, toolTier: 0, yield: [1, 3], scanLevel: 1
  },
  frost_crystal: {
    id: 'frost_crystal', name: 'Frost Crystal', tier: 2, category: 'crystal',
    baseFrequency: 0.30, exclusive: true,
    archetypeAffinity: { frozen: 1.9, crystal: 1.1, verdant: 0.2 },
    biomeAffinity: { highland: 1.5, cave: 1.2 },
    depthBands: ['surface', 'shallow'], clusterSize: 3, toolTier: 2, yield: [1, 2], scanLevel: 2
  },
  basalt_glass: {
    id: 'basalt_glass', name: 'Basalt Glass', tier: 3, category: 'mineral',
    baseFrequency: 0.18, exclusive: true,
    archetypeAffinity: { volcanic: 2.0, metallic: 0.7 },
    biomeAffinity: { volcanic_scar: 2.0, cave: 1.2 },
    depthBands: ['shallow', 'mid'], clusterSize: 3, toolTier: 2, yield: [1, 2], scanLevel: 2
  },
  charged_crystal: {
    id: 'charged_crystal', name: 'Charged Crystal', tier: 3, category: 'crystal',
    baseFrequency: 0.14, exclusive: true,
    archetypeAffinity: { crystal: 2.0, anomaly: 1.6, metallic: 0.8 },
    biomeAffinity: { crystal_field: 2.0, cave: 1.4 },
    depthBands: ['shallow', 'mid', 'deep'], clusterSize: 2, toolTier: 2, yield: [1, 1], scanLevel: 2
  },
  gold_trace: {
    id: 'gold_trace', name: 'Gold Trace', tier: 3, category: 'metal',
    baseFrequency: 0.10,
    archetypeAffinity: { metallic: 2.0, volcanic: 1.2, arid: 1.0 },
    depthBands: ['mid', 'deep'], clusterSize: 2, toolTier: 3, yield: [1, 1], scanLevel: 3
  },
  void_glass: {
    id: 'void_glass', name: 'Void Glass', tier: 4, category: 'exotic',
    baseFrequency: 0.05, exclusive: true,
    archetypeAffinity: { anomaly: 2.2, crystal: 1.1 },
    biomeAffinity: { cave: 1.8 },
    depthBands: ['deep'], clusterSize: 1, toolTier: 4, yield: [1, 1], scanLevel: 4
  }
};

export const ALL_RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

export function getResource(id: ResourceId): ResourceDefinition {
  return RESOURCES[id];
}

/** Tier-0 resources are the always-available critical-path basics. */
export const TIER0_RESOURCES: ResourceId[] = ALL_RESOURCE_IDS.filter(id => RESOURCES[id].tier === 0);
