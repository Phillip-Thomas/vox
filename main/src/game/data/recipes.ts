// --- Recipe registry (the crafting tree) -------------------------------------
//
// The hand-authored economy lives in shared/economyCatalog.json. This module is
// the client compatibility surface: existing gameplay systems keep importing the
// same types/functions while the data itself is generated for both runtimes.

import { ECONOMY_CATALOG } from './generatedEconomyCatalog.ts';
import type { ItemStack } from './items.ts';
import type { EraId } from './eras.ts';
import type { StationId } from './stations.ts';

export type RecipeId = (typeof ECONOMY_CATALOG.recipes)[number]['id'];

export interface Recipe {
  id: RecipeId;
  outputs: ItemStack[];
  inputs: ItemStack[];
  station: StationId;
  /** Which era this recipe belongs to (gates where it can be crafted). */
  era: EraId;
  /** Future: finer tech node that must be unlocked before this recipe is craftable. */
  requiredTech?: string;
  /** Durable one-time receipt for a story device that remains unique after placement. */
  uniqueReceipt?: string;
}

type CatalogRecipe = (typeof ECONOMY_CATALOG.recipes)[number] & {
  requiredTech?: string;
  uniqueReceipt?: string;
};

function bindRecipe(definition: CatalogRecipe): Recipe {
  return {
    id: definition.id,
    station: definition.station,
    era: definition.era,
    inputs: definition.inputs.map(stack => ({ ...stack })),
    outputs: definition.outputs.map(stack => ({ ...stack })),
    ...(definition.requiredTech ? { requiredTech: definition.requiredTech } : {}),
    ...(definition.uniqueReceipt ? { uniqueReceipt: definition.uniqueReceipt } : {})
  };
}

export const RECIPES = Object.fromEntries(
  ECONOMY_CATALOG.recipes.map(definition => [definition.id, bindRecipe(definition)])
) as Record<RecipeId, Recipe>;

export const ALL_RECIPES = Object.values(RECIPES);

export function getRecipe(id: RecipeId): Recipe {
  return RECIPES[id];
}

export function recipesForStation(station: StationId): Recipe[] {
  return ALL_RECIPES.filter(recipe => recipe.station === station);
}

export function recipesForEra(era: EraId): Recipe[] {
  return ALL_RECIPES.filter(recipe => recipe.era === era);
}
