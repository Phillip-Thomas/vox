// --- Crafting (recipe -> inventory) ------------------------------------------
//
// Same shape as harvestingSystem: a pure check (`canCraft`) plus a side-effecting
// bank (`craft`) that consumes inputs and adds outputs to the inventory. No RNG,
// no rendering knowledge. The context says which stations are reachable and which
// tech is unlocked, so the engine never reads global player state directly —
// callers (the crafting UI) pass it in, which keeps this fully testable.

import type { Recipe } from '../data/recipes.ts';
import type { StationId } from '../data/stations.ts';
import { addItem, hasItems, removeItem } from './inventorySystem.ts';

export interface CraftContext {
  /** Stations the player can currently use (see stations.getAccessibleStations). */
  stations: StationId[];
  /** Unlocked tech ids (Phase 3). Absent → no recipe is tech-gated. */
  unlocked?: Set<string>;
}

export type CraftBlock = 'station' | 'tech' | 'materials';

export interface CraftCheck {
  ok: boolean;
  blockedBy?: CraftBlock;
}

/** Station + tech satisfied — i.e. the recipe should be shown/attemptable. */
export function recipeReady(recipe: Recipe, ctx: CraftContext): boolean {
  if (!ctx.stations.includes(recipe.station)) return false;
  if (recipe.requiredTech && !ctx.unlocked?.has(recipe.requiredTech)) return false;
  return true;
}

/** Full check including whether the inventory can pay the inputs. */
export function canCraft(recipe: Recipe, ctx: CraftContext): CraftCheck {
  if (!ctx.stations.includes(recipe.station)) return { ok: false, blockedBy: 'station' };
  if (recipe.requiredTech && !ctx.unlocked?.has(recipe.requiredTech)) return { ok: false, blockedBy: 'tech' };
  if (!hasItems(recipe.inputs)) return { ok: false, blockedBy: 'materials' };
  return { ok: true };
}

/**
 * Perform the craft if allowed: atomically consume inputs and bank outputs.
 * Returns the same CraftCheck shape; on failure nothing is consumed.
 */
export function craft(recipe: Recipe, ctx: CraftContext): CraftCheck {
  const check = canCraft(recipe, ctx);
  if (!check.ok) return check;
  // hasItems already guaranteed every input is fully covered, so these all succeed.
  for (const stack of recipe.inputs) removeItem(stack.id, stack.qty);
  for (const stack of recipe.outputs) addItem(stack.id, stack.qty);
  return { ok: true };
}
