// --- Local biome registry ----------------------------------------------------
//
// A BiomeDefinition is a LOCAL region within a planet (coast, highland, cave,
// volcanic scar, ...), not the planet-wide climate anchor (that's the existing
// `BiomeProfile` in utils/biomeProfile). A planet's archetype presents a weighted
// MIX of these so worlds are explorable, not uniform — a frozen planet can still
// have a volcanic scar; a lush one a dry highland.
//
// Each biome contributes candidate surface BLOCKS and per-resource MODIFIERS that
// stack on top of a resource's own affinity. References are TYPE-only (BlockId,
// ResourceId) so there's no runtime import cycle.

import type { BlockId } from './blocks.ts';
import type { ResourceId } from './resources.ts';

export type BiomeId =
  | 'grassland' | 'forest' | 'mesa' | 'coast'
  | 'highland' | 'cave' | 'volcanic_scar' | 'crystal_field';

export interface BiomeClimateWindow {
  lushness?: [number, number];
  aridity?: [number, number];
  temperature?: [number, number];
}

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  /** Preferred climate window (used for spatial blending / selection). */
  climate: BiomeClimateWindow;
  /** Candidate surface blocks (first = dominant). */
  surfaceBlocks: BlockId[];
  /** Local multiplier on resource frequency (absent = neutral 1; 0 = excluded). */
  resourceModifiers?: Partial<Record<ResourceId, number>>;
  tags: string[];
}

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  grassland: {
    id: 'grassland', name: 'Grassland',
    climate: { lushness: [0.35, 0.8], aridity: [0, 0.5] },
    surfaceBlocks: ['grass', 'dirt'],
    resourceModifiers: { biofiber: 1.3, resin: 1.1 },
    tags: ['open', 'temperate']
  },
  forest: {
    id: 'forest', name: 'Forest',
    climate: { lushness: [0.55, 1], aridity: [0, 0.4] },
    surfaceBlocks: ['grass', 'dirt', 'wood'],
    resourceModifiers: { resin: 1.8, biofiber: 1.6 },
    tags: ['dense', 'canopy']
  },
  mesa: {
    id: 'mesa', name: 'Mesa',
    climate: { aridity: [0.5, 1], temperature: [0.4, 1] },
    surfaceBlocks: ['sand', 'stone', 'dirt'],
    resourceModifiers: { silica: 1.5, copper_ore: 1.3 },
    tags: ['dry', 'rocky']
  },
  coast: {
    id: 'coast', name: 'Coast',
    climate: { aridity: [0, 0.7] },
    surfaceBlocks: ['sand', 'stone'],
    resourceModifiers: { silica: 1.7 },
    tags: ['water-edge', 'low']
  },
  highland: {
    id: 'highland', name: 'Highland',
    climate: { temperature: [0, 0.5] },
    surfaceBlocks: ['stone', 'dirt', 'ice'],
    resourceModifiers: { frost_crystal: 1.5, iron_trace: 1.2 },
    tags: ['high', 'exposed']
  },
  cave: {
    id: 'cave', name: 'Cave',
    climate: {},
    surfaceBlocks: ['stone', 'basalt', 'crystal_crust'],
    resourceModifiers: { charged_crystal: 1.5, basalt_glass: 1.3, void_glass: 1.8, copper_ore: 1.2 },
    tags: ['subsurface', 'dark']
  },
  volcanic_scar: {
    id: 'volcanic_scar', name: 'Volcanic Scar',
    climate: { temperature: [0.6, 1] },
    surfaceBlocks: ['basalt', 'stone', 'lava'],
    resourceModifiers: { basalt_glass: 2.0, iron_trace: 1.3, frost_crystal: 0 },
    tags: ['hot', 'hazard']
  },
  crystal_field: {
    id: 'crystal_field', name: 'Crystal Field',
    climate: {},
    surfaceBlocks: ['crystal_crust', 'stone'],
    resourceModifiers: { charged_crystal: 2.0, silica: 1.4 },
    tags: ['exotic', 'reflective']
  }
};

export const ALL_BIOME_IDS = Object.keys(BIOMES) as BiomeId[];

export function getBiome(id: BiomeId): BiomeDefinition {
  return BIOMES[id];
}
