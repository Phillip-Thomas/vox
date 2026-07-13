import type { ItemId } from './items.ts';

/** Gameplay identities for the five procedural flora archetypes. */
export const FLORA_HARVEST_KINDS = ['cactus', 'fan', 'flower', 'seedhead', 'shrub'] as const;
export type FloraHarvestKind = typeof FLORA_HARVEST_KINDS[number];

export interface FloraHarvestDefinition {
  /** Player-facing target name; the inventory item may use a more specific part name. */
  label: string;
  /** Explicit semantic alias for callers that distinguish the plant from its drop. */
  plantName: string;
  itemId: ItemId;
  /** Inclusive deterministic yield range. */
  quantity: readonly [min: number, max: number];
}

/**
 * Canonical flora-to-inventory vocabulary. Keep this independent of rendering so
 * recipes, commands, persistence and picking can share stable gameplay ids.
 */
export const FLORA_HARVEST: Record<FloraHarvestKind, FloraHarvestDefinition> = {
  cactus: { label: 'Cactus', plantName: 'Cactus', itemId: 'cactus_pulp', quantity: [1, 2] },
  fan: { label: 'Fan Plant', plantName: 'Fan Plant', itemId: 'fan_frond', quantity: [1, 2] },
  flower: { label: 'Wild Flower', plantName: 'Wild Flower', itemId: 'wild_bloom', quantity: [1, 2] },
  seedhead: { label: 'Seedhead', plantName: 'Seedhead', itemId: 'seedpod', quantity: [2, 3] },
  shrub: { label: 'Berry Shrub', plantName: 'Berry Shrub', itemId: 'berry', quantity: [1, 2] }
};

export function floraHarvestDefinition(kind: FloraHarvestKind): FloraHarvestDefinition {
  return FLORA_HARVEST[kind];
}

export function isFloraHarvestKind(value: string): value is FloraHarvestKind {
  return value in FLORA_HARVEST;
}
