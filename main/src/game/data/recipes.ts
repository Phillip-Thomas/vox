// --- Recipe registry (the crafting tree) -------------------------------------
//
// A Recipe turns input ItemStacks into output ItemStacks at a given station. It is
// pure data — the crafting engine (systems/craftingSystem.ts) consumes it. The
// economy numbers live here, NOT in the UI or the player loop.
//
// First-pass tree (one recipe per crafted item) forms a clean acyclic ladder:
//   raw resources --(smelter)--> refined --(assembler)--> components
//                                                     \--> tools / suits / modules
// Tool upgrades CONSUME the prior tier (Iron Maw -> Frost Maw -> ...), so the Maw
// line reads as "upgrade your tool" and never accumulates dead stock.
//
// `requiredTech` is intentionally absent for now: Phase 3 (the tech tree) adds it
// to gate recipes behind unlocks. The crafting engine already accepts an
// `unlocked` set so wiring it later is additive.

import type { CraftedItemId, ItemStack } from './items.ts';
import type { EraId } from './eras.ts';
import type { StationId } from './stations.ts';

// Everything craftable. Excludes the items that are GRANTED or HARVESTED rather
// than crafted (the Faulty Maw starter, foraged wood), so RECIPES stays complete.
export type RecipeId = Exclude<CraftedItemId, 'faulty_maw' | 'wood'>;

export interface Recipe {
  id: RecipeId;
  outputs: ItemStack[];
  inputs: ItemStack[];
  station: StationId;
  /** Which era this recipe belongs to (gates where it can be crafted). */
  era: EraId;
  /** Future: finer tech node that must be unlocked before this recipe is craftable. */
  requiredTech?: string;
}

/** Terse helper so the table below reads like a crafting sheet. */
function recipe(
  id: RecipeId,
  station: StationId,
  era: EraId,
  inputs: ItemStack[],
  outQty = 1
): Recipe {
  return { id, station, era, inputs, outputs: [{ id, qty: outQty }] };
}

export const RECIPES: Record<RecipeId, Recipe> = {
  // Primitive — hand-crafted at the personal Fabricator ----------------------
  // Biofuel powers the Faulty Maw. Made from foraged fibre (mine grass by hand),
  // so the cold open bootstraps with no station and no ore.
  biofuel: recipe('biofuel', 'hand', 'primitive', [
    { id: 'biofiber', qty: 3 }
  ]),
  // Stone tools — biofiber + wood + foraged stone. The Hatchet speeds wood; the
  // Pickaxe is the first tool that can break stone/ore voxels.
  stone_hatchet: recipe('stone_hatchet', 'hand', 'primitive', [
    { id: 'wood', qty: 2 }, { id: 'biofiber', qty: 2 }, { id: 'stone', qty: 1 }
  ]),
  stone_pickaxe: recipe('stone_pickaxe', 'hand', 'primitive', [
    { id: 'wood', qty: 2 }, { id: 'biofiber', qty: 1 }, { id: 'stone', qty: 2 }
  ]),

  // Refined materials (Smelter) ----------------------------------------------
  refined_alloy: recipe('refined_alloy', 'smelter', 'emergent', [
    { id: 'copper_ore', qty: 2 }, { id: 'iron_trace', qty: 1 }
  ]),
  silica_pane: recipe('silica_pane', 'smelter', 'emergent', [
    { id: 'silica', qty: 2 }
  ]),
  biocomposite: recipe('biocomposite', 'smelter', 'emergent', [
    { id: 'biofiber', qty: 2 }, { id: 'resin', qty: 1 }
  ]),
  cryo_cell: recipe('cryo_cell', 'smelter', 'emergent', [
    { id: 'frost_crystal', qty: 1 }, { id: 'silica_pane', qty: 1 }
  ]),
  thermal_ceramic: recipe('thermal_ceramic', 'smelter', 'emergent', [
    { id: 'basalt_glass', qty: 1 }, { id: 'refined_alloy', qty: 1 }
  ]),
  charge_cell: recipe('charge_cell', 'smelter', 'emergent', [
    { id: 'charged_crystal', qty: 1 }, { id: 'refined_alloy', qty: 1 }
  ]),
  void_core: recipe('void_core', 'smelter', 'emergent', [
    { id: 'void_glass', qty: 1 }, { id: 'charge_cell', qty: 1 }
  ]),

  // Components (Assembler) ---------------------------------------------------
  logic_wafer: recipe('logic_wafer', 'assembler', 'emergent', [
    { id: 'silica_pane', qty: 1 }, { id: 'refined_alloy', qty: 1 }
  ]),
  strut_frame: recipe('strut_frame', 'assembler', 'emergent', [
    { id: 'refined_alloy', qty: 2 }, { id: 'biocomposite', qty: 1 }
  ]),

  // Tools — the Maw line (each consumes the prior tier) ----------------------
  iron_maw: recipe('iron_maw', 'assembler', 'emergent', [
    { id: 'strut_frame', qty: 1 }, { id: 'logic_wafer', qty: 1 }
  ]),
  frost_maw: recipe('frost_maw', 'assembler', 'emergent', [
    { id: 'iron_maw', qty: 1 }, { id: 'cryo_cell', qty: 1 }, { id: 'logic_wafer', qty: 1 }
  ]),
  arc_maw: recipe('arc_maw', 'assembler', 'emergent', [
    { id: 'frost_maw', qty: 1 }, { id: 'charge_cell', qty: 1 }, { id: 'gold_trace', qty: 1 }
  ]),
  void_maw: recipe('void_maw', 'assembler', 'emergent', [
    { id: 'arc_maw', qty: 1 }, { id: 'void_core', qty: 1 }
  ]),

  // Suits — the Carapace line (Assembler) ------------------------------------
  thermal_carapace: recipe('thermal_carapace', 'assembler', 'emergent', [
    { id: 'biocomposite', qty: 1 }, { id: 'cryo_cell', qty: 1 }, { id: 'thermal_ceramic', qty: 1 }
  ]),
  filter_carapace: recipe('filter_carapace', 'assembler', 'emergent', [
    { id: 'biocomposite', qty: 1 }, { id: 'logic_wafer', qty: 1 }
  ]),
  shielded_carapace: recipe('shielded_carapace', 'assembler', 'emergent', [
    { id: 'strut_frame', qty: 1 }, { id: 'charge_cell', qty: 1 }
  ]),

  // Modules — survey optics (Survey Console) ---------------------------------
  survey_lens_2: recipe('survey_lens_2', 'survey_console', 'emergent', [
    { id: 'silica_pane', qty: 1 }, { id: 'logic_wafer', qty: 1 }
  ]),
  survey_lens_3: recipe('survey_lens_3', 'survey_console', 'emergent', [
    { id: 'survey_lens_2', qty: 1 }, { id: 'charge_cell', qty: 1 }
  ]),
  survey_lens_4: recipe('survey_lens_4', 'survey_console', 'emergent', [
    { id: 'survey_lens_3', qty: 1 }, { id: 'void_core', qty: 1 }
  ]),

  // Modules — personal & ship (Assembler) ------------------------------------
  lift_cell: recipe('lift_cell', 'assembler', 'emergent', [
    { id: 'strut_frame', qty: 1 }, { id: 'refined_alloy', qty: 1 }
  ]),
  range_coil: recipe('range_coil', 'assembler', 'emergent', [
    { id: 'charge_cell', qty: 1 }, { id: 'logic_wafer', qty: 1 }
  ])
};

export const ALL_RECIPES = Object.values(RECIPES);

export function getRecipe(id: RecipeId): Recipe {
  return RECIPES[id];
}

export function recipesForStation(station: StationId): Recipe[] {
  return ALL_RECIPES.filter(r => r.station === station);
}

export function recipesForEra(era: EraId): Recipe[] {
  return ALL_RECIPES.filter(r => r.era === era);
}
