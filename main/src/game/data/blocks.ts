// --- Block registry (voxel identity) -----------------------------------------
//
// A BlockDefinition answers "what IS this voxel" — distinct from MaterialType
// ("how does it RENDER") and ResourceId ("what did the player OBTAIN"). The block
// owns the PROJECTION to rendering (`renderMaterial`) and the default DROPS. This
// is the seam that lets the economy grow without giving MaterialType gameplay
// meaning: terrain will eventually emit BlockIds, render via `blockToRenderMaterial`
// (see adapters), and harvest via `drops`.
//
// Phase 1 is additive: the core blocks map 1:1 onto today's MaterialTypes so the
// existing generator output is reproducible through the adapter. Biome blocks that
// don't have a dedicated material yet (basalt/ice/crystal_crust) reuse an existing
// render material as a PLACEHOLDER — real materials are a later phase and must be
// APPENDED to MATERIAL_ORDER (never reordered — ids are baked into the shader).

import { MaterialType } from '../../types/materials.ts';
import type { ResourceId } from './resources.ts';

export type BlockId =
  | 'stone' | 'dirt' | 'grass' | 'sand' | 'lava' | 'wood'
  | 'copper_block' | 'gold_block' | 'silver_block'
  | 'basalt' | 'ice' | 'crystal_crust';

export type BlockTag = 'surface' | 'soil' | 'rock' | 'ore' | 'organic' | 'liquid' | 'crystal' | 'ice';

export interface BlockDefinition {
  id: BlockId;
  name: string;
  /** Projection to the render layer. MaterialType stays render-only. */
  renderMaterial: MaterialType;
  hardness: number;
  /** Minimum tool tier required to break/harvest. */
  toolTier: number;
  /** Default resources yielded on harvest (drop tables can refine later). */
  drops: ResourceId[];
  tags: BlockTag[];
}

export const BLOCKS: Record<BlockId, BlockDefinition> = {
  stone: {
    id: 'stone', name: 'Stone', renderMaterial: MaterialType.STONE,
    // toolTier 1: the Faulty Maw (tier 0) can't cut stone — you need a Stone Pick
    // or the Repaired Maw. Soft blocks (dirt/sand/grass/wood) stay tier 0.
    hardness: 1.5, toolTier: 1, drops: ['stone'], tags: ['rock']
  },
  dirt: {
    id: 'dirt', name: 'Dirt', renderMaterial: MaterialType.DIRT,
    hardness: 0.5, toolTier: 0, drops: [], tags: ['soil']
  },
  grass: {
    id: 'grass', name: 'Grass', renderMaterial: MaterialType.GRASS,
    hardness: 0.5, toolTier: 0, drops: ['biofiber'], tags: ['surface', 'soil', 'organic']
  },
  sand: {
    id: 'sand', name: 'Sand', renderMaterial: MaterialType.SAND,
    hardness: 0.4, toolTier: 0, drops: ['silica'], tags: ['surface', 'soil']
  },
  lava: {
    id: 'lava', name: 'Lava', renderMaterial: MaterialType.LAVA,
    hardness: 100, toolTier: 99, drops: [], tags: ['liquid']
  },
  wood: {
    id: 'wood', name: 'Wood', renderMaterial: MaterialType.WOOD,
    hardness: 0.8, toolTier: 0, drops: ['resin', 'biofiber'], tags: ['organic']
  },
  copper_block: {
    id: 'copper_block', name: 'Copper Deposit', renderMaterial: MaterialType.COPPER,
    hardness: 2.2, toolTier: 1, drops: ['copper_ore'], tags: ['rock', 'ore']
  },
  gold_block: {
    id: 'gold_block', name: 'Gold Deposit', renderMaterial: MaterialType.GOLD,
    hardness: 2.6, toolTier: 3, drops: ['gold_trace'], tags: ['rock', 'ore']
  },
  silver_block: {
    id: 'silver_block', name: 'Iron Deposit', renderMaterial: MaterialType.SILVER,
    hardness: 2.4, toolTier: 1, drops: ['iron_trace'], tags: ['rock', 'ore']
  },
  // --- Biome-identity blocks (Phase 2 materials) -----------------------------
  basalt: {
    id: 'basalt', name: 'Basalt', renderMaterial: MaterialType.BASALT,
    hardness: 2.0, toolTier: 2, drops: ['stone', 'basalt_glass'], tags: ['rock']
  },
  ice: {
    id: 'ice', name: 'Ice', renderMaterial: MaterialType.ICE,
    hardness: 0.6, toolTier: 2, drops: ['frost_crystal'], tags: ['surface', 'ice']
  },
  crystal_crust: {
    id: 'crystal_crust', name: 'Crystal Crust', renderMaterial: MaterialType.CRYSTAL,
    hardness: 2.8, toolTier: 2, drops: ['silica', 'charged_crystal'], tags: ['rock', 'crystal']
  }
};

export const ALL_BLOCK_IDS = Object.keys(BLOCKS) as BlockId[];

export function getBlock(id: BlockId): BlockDefinition {
  return BLOCKS[id];
}

// Canonical block per render material — the inverse projection used by the
// legacy adapter (multiple blocks can share a render material, e.g. basalt→STONE,
// so we pin the ORIGINAL block for each MaterialType).
export const CANONICAL_BLOCK_FOR_MATERIAL: Record<MaterialType, BlockId> = {
  [MaterialType.STONE]: 'stone',
  [MaterialType.DIRT]: 'dirt',
  [MaterialType.GRASS]: 'grass',
  [MaterialType.SAND]: 'sand',
  [MaterialType.LAVA]: 'lava',
  [MaterialType.WOOD]: 'wood',
  [MaterialType.COPPER]: 'copper_block',
  [MaterialType.GOLD]: 'gold_block',
  [MaterialType.SILVER]: 'silver_block',
  [MaterialType.BASALT]: 'basalt',
  [MaterialType.ICE]: 'ice',
  [MaterialType.CRYSTAL]: 'crystal_crust'
};
