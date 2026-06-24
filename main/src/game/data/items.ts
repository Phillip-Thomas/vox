// --- Item registry (the inventory & crafting vocabulary) ---------------------
//
// An ITEM is "anything that can sit in inventory or be produced by crafting." It
// is the FOURTH concept layered on the existing model:
//   Block   (what a voxel IS)        -> blocks.ts
//   Material(how a voxel RENDERS)    -> types/materials.ts
//   Resource(what you HARVEST)       -> resources.ts
//   Item    (what you HOLD / CRAFT)  -> here
//
// Every Resource is also an Item (kind 'resource'), so the existing harvest ->
// inventory path is just the special case where the produced item happens to be a
// raw resource. RESOURCES stays the generation/economy source of truth (terrain +
// scanner read it); this file PROJECTS each resource into an ItemDefinition so the
// whole game speaks one inventory vocabulary with no duplicated economy numbers.
//
// Crafted items (refined materials, components, the Maw tool line, Carapace suits,
// upgrade modules) are DATA here; the crafting/tech systems (later phases) consume
// them. Phase 1 only wires `tool` items into the live tool tier (loadoutSystem).
//
// Naming is Paravoxia-native on purpose (Maw / Carapace / Survey Lens / Charge
// Cell) — deliberately NOT borrowed from other voxel/survival games.

import type { HazardId } from './planetArchetypes.ts';
import { ALL_RESOURCE_IDS, RESOURCES, type ResourceDefinition, type ResourceId } from './resources.ts';

export type ItemKind =
  | 'resource'    // raw harvested (projected from RESOURCES)
  | 'refined'     // smelted/processed single materials
  | 'component'   // assembled multi-material parts
  | 'tool'        // the Maw line — sets effective mining tier when owned
  | 'suit'        // the Carapace line — hazard protection
  | 'module'      // ship/scanner/jetpack upgrade modules
  | 'consumable'  // one-shot items (charge cells, repair kits) — future
  | 'light'       // light sources (carried torch, placed campfire)
  | 'placeable';  // crafting stations / structures — future (needs StationId)

/** Ids for items NOT in the terrain RESOURCES registry — crafted goods AND
 *  primitive-harvested materials (e.g. `wood` from trees). The `kind` field still
 *  classifies them (wood is kind 'resource'); this union just means "id not minted
 *  by the terrain economy". */
export type CraftedItemId =
  // primitive — the crash-landing starter, its fuel, foraged wood, and stone tools
  | 'faulty_maw' | 'biofuel' | 'wood' | 'stone_hatchet' | 'stone_pickaxe'
  // primitive light sources
  | 'torch' | 'campfire'
  // primitive forage + survival
  | 'berry' | 'root' | 'waterskin'
  // refined materials
  | 'refined_alloy' | 'silica_pane' | 'biocomposite'
  | 'cryo_cell' | 'thermal_ceramic' | 'charge_cell' | 'void_core'
  // components
  | 'logic_wafer' | 'strut_frame'
  // tools — the Maw line (matter-collapse field cutters)
  | 'iron_maw' | 'frost_maw' | 'arc_maw' | 'void_maw'
  // suits — the Carapace line (hazard protection)
  | 'thermal_carapace' | 'filter_carapace' | 'shielded_carapace'
  // modules — personal & ship upgrades
  | 'survey_lens_2' | 'survey_lens_3' | 'survey_lens_4'
  | 'lift_cell' | 'range_coil';

export type ItemId = ResourceId | CraftedItemId;

/** What a harvest target is made of, for picking the right tool. Trees are 'wood',
 *  rock/ore/crystal/ice voxels are 'stone', everything else (soil/grass/organic) is
 *  'soft'. A tool's `harvestSpeed` per class is how the Hatchet (fast wood) and
 *  Pickaxe (slow stone) specialize. */
export type HarvestClass = 'wood' | 'stone' | 'soft';

/** Passive effect of an upgrade module (consumed by loadout/ship/scanner systems). */
export interface ModuleEffect {
  /** Absolute scanner level this module confers (loadout takes the max owned). */
  scanLevel?: number;
  /** Multiplier on jetpack fuel capacity. */
  jetpackFuelMul?: number;
  /** Additive warp-range steps. */
  warpRangeAdd?: number;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  kind: ItemKind;
  tier: number;          // 0..5, shares the resource tier scale
  stackable: boolean;
  description: string;
  /** kind 'tool': effective mining tier while this is the best tool owned. */
  toolTier?: number;
  /** kind 'tool': default mining-speed multiplier (>1 faster, <1 slower). Default 1. */
  mineSpeedMul?: number;
  /** kind 'tool': per-material speed overrides (Hatchet→wood, Pickaxe→stone).
   *  Falls back to mineSpeedMul (then 1) for unlisted classes. */
  harvestSpeed?: Partial<Record<HarvestClass, number>>;
  /** kind 'tool': true if the tool runs on Maw charge (the Faulty Maw does). */
  usesCharge?: boolean;
  /** kind 'suit': protection (0..1+) per hazard. */
  hazardProtect?: Partial<Record<HazardId, number>>;
  /** kind 'module': passive upgrade payload. */
  moduleEffect?: ModuleEffect;
  /** kind 'consumable': hunger restored when eaten (0..100 of the vitals scale). */
  foodValue?: number;
  /** kind 'consumable': thirst restored when consumed. */
  waterValue?: number;
}

// --- Resource -> Item projection ---------------------------------------------

const RESOURCE_FLAVOR: Partial<Record<ResourceId, string>> = {
  stone: 'Ubiquitous building basic. Every structure starts here.',
  silica: 'Glassy grit. Smelts into panes and the basis of optics and circuits.',
  copper_ore: 'Soft conductive metal. The first real alloy feedstock.',
  iron_trace: 'Structural metal threaded through rock. Backbone of frames and tools.',
  resin: 'Sticky organic binder tapped from lush growth.',
  biofiber: 'Tough plant fibre. Spun into composite weave.',
  frost_crystal: 'Latent-cold lattice. Bleeds heat — the heart of coolant.',
  basalt_glass: 'Heat-forged volcanic glass. Survives temperatures that melt lesser kit.',
  charged_crystal: 'Self-resonant crystal holding a standing charge.',
  gold_trace: 'Rare flawless conductor for high-load circuitry.',
  void_glass: 'Anomalous matter that should not cohere. It does, barely.'
};

function resourceToItem(def: ResourceDefinition): ItemDefinition {
  return {
    id: def.id,
    name: def.name,
    kind: 'resource',
    tier: def.tier,
    stackable: true,
    description: RESOURCE_FLAVOR[def.id] ?? `${def.category} resource (tier ${def.tier}).`
  };
}

// --- Crafted items ------------------------------------------------------------

const CRAFTED_ITEMS: Record<CraftedItemId, ItemDefinition> = {
  // Primitive — crash-landing starter ----------------------------------------
  faulty_maw: {
    id: 'faulty_maw', name: 'Faulty Maw', kind: 'tool', tier: 0, stackable: false,
    toolTier: 0, mineSpeedMul: 1, usesCharge: true,
    description: 'Your damaged Maw. Drained and barely holding together — it cuts only soft matter, and only while fuelled. Repair it to cut stone and ore.'
  },
  biofuel: {
    id: 'biofuel', name: 'Biofuel', kind: 'consumable', tier: 0, stackable: true,
    description: 'A wad of pressed plant fibre that burns hot. Loads charge into the Maw.'
  },
  wood: {
    id: 'wood', name: 'Wood', kind: 'resource', tier: 0, stackable: true,
    description: 'Harvested from trees. The backbone of primitive tools and structures.'
  },
  stone_hatchet: {
    id: 'stone_hatchet', name: 'Stone Hatchet', kind: 'tool', tier: 0, stackable: false,
    toolTier: 0, harvestSpeed: { wood: 2.5, soft: 1, stone: 0.6 },
    description: 'A knapped stone blade lashed to a haft. Chops wood far faster than bare cutting.'
  },
  stone_pickaxe: {
    id: 'stone_pickaxe', name: 'Stone Pickaxe', kind: 'tool', tier: 1, stackable: false,
    toolTier: 1, harvestSpeed: { stone: 0.5, soft: 0.8, wood: 0.5 },
    description: 'A heavy stone head for breaking rock. Slow, but the only way to mine stone and ore before the Maw is repaired.'
  },
  torch: {
    id: 'torch', name: 'Torch', kind: 'light', tier: 0, stackable: true,
    description: 'A resin-soaked brand. Carried with you — a small pool of warm light in the dark.'
  },
  campfire: {
    id: 'campfire', name: 'Campfire', kind: 'light', tier: 0, stackable: true,
    description: 'A stacked fire ring. Placed where you stand and stays put, casting a bright, wide glow.'
  },
  // Primitive forage + survival ----------------------------------------------
  berry: {
    id: 'berry', name: 'Wildberries', kind: 'consumable', tier: 0, stackable: true,
    foodValue: 12, waterValue: 6,
    description: 'A handful of tart wild berries. Eases hunger and a little thirst — forbidden, organic, alive.'
  },
  root: {
    id: 'root', name: 'Starch Root', kind: 'consumable', tier: 0, stackable: true,
    foodValue: 24,
    description: 'A fibrous tuber dug from the soil. Filling, if earthy.'
  },
  waterskin: {
    id: 'waterskin', name: 'Waterskin', kind: 'consumable', tier: 0, stackable: false,
    description: 'A stitched fibre pouch. Fill it at water, then drink anywhere — carry the wet with you.'
  },
  // Refined materials --------------------------------------------------------
  refined_alloy: {
    id: 'refined_alloy', name: 'Refined Alloy', kind: 'refined', tier: 1, stackable: true,
    description: 'Copper and iron cooked into a workable structural alloy.'
  },
  silica_pane: {
    id: 'silica_pane', name: 'Silica Pane', kind: 'refined', tier: 1, stackable: true,
    description: 'Clarified silica sheet — feedstock for optics and circuitry.'
  },
  biocomposite: {
    id: 'biocomposite', name: 'Biocomposite', kind: 'refined', tier: 2, stackable: true,
    description: 'Biofibre set in resin into a light, tough panel.'
  },
  cryo_cell: {
    id: 'cryo_cell', name: 'Cryo Cell', kind: 'refined', tier: 2, stackable: true,
    description: 'Sealed coolant unit built around a frost crystal.'
  },
  thermal_ceramic: {
    id: 'thermal_ceramic', name: 'Thermal Ceramic', kind: 'refined', tier: 3, stackable: true,
    description: 'Basalt-glass ceramic that shrugs off extreme heat.'
  },
  charge_cell: {
    id: 'charge_cell', name: 'Charge Cell', kind: 'refined', tier: 3, stackable: true,
    description: 'A charged crystal racked in alloy — portable energy storage.'
  },
  void_core: {
    id: 'void_core', name: 'Void Core', kind: 'refined', tier: 4, stackable: true,
    description: 'A stabilised sliver of anomaly matter. Powers the impossible.'
  },
  // Components ---------------------------------------------------------------
  logic_wafer: {
    id: 'logic_wafer', name: 'Logic Wafer', kind: 'component', tier: 2, stackable: true,
    description: 'Etched silica-and-metal wafer. The brain of every device.'
  },
  strut_frame: {
    id: 'strut_frame', name: 'Strut Frame', kind: 'component', tier: 2, stackable: true,
    description: 'Alloy lattice braced with composite — the chassis of bigger builds.'
  },
  // Tools — the Maw line -----------------------------------------------------
  iron_maw: {
    id: 'iron_maw', name: 'Iron Maw', kind: 'tool', tier: 1, stackable: false, toolTier: 1,
    mineSpeedMul: 1.2,
    description: 'The repaired Maw: a resonant field-cutter that collapses voxel bonds. Self-powered — no fuel needed — and cleaves stone and base metals.'
  },
  frost_maw: {
    id: 'frost_maw', name: 'Frost Maw', kind: 'tool', tier: 2, stackable: false, toolTier: 2,
    description: 'A coolant-tempered Maw that bites through basalt, ice, and crystal crust.'
  },
  arc_maw: {
    id: 'arc_maw', name: 'Arc Maw', kind: 'tool', tier: 3, stackable: false, toolTier: 3,
    description: 'A charge-driven Maw whose arc-field shears dense precious veins.'
  },
  void_maw: {
    id: 'void_maw', name: 'Void Maw', kind: 'tool', tier: 4, stackable: false, toolTier: 4,
    description: 'A void-core Maw that unmakes even anomalous matter.'
  },
  // Suits — the Carapace line ------------------------------------------------
  thermal_carapace: {
    id: 'thermal_carapace', name: 'Thermal Carapace', kind: 'suit', tier: 2, stackable: false,
    hazardProtect: { extreme_cold: 1, extreme_heat: 1 },
    description: 'Insulated shell that holds body temperature against searing heat or deep cold.'
  },
  filter_carapace: {
    id: 'filter_carapace', name: 'Filter Carapace', kind: 'suit', tier: 2, stackable: false,
    hazardProtect: { toxic_fog: 1, low_oxygen: 1 },
    description: 'Sealed, rebreather-fed shell for toxic air and thin atmospheres.'
  },
  shielded_carapace: {
    id: 'shielded_carapace', name: 'Shielded Carapace', kind: 'suit', tier: 3, stackable: false,
    hazardProtect: { radiation: 1, magnetic_storm: 1 },
    description: 'Charge-shielded shell that turns aside radiation and magnetic storms.'
  },
  // Modules — personal & ship upgrades ---------------------------------------
  survey_lens_2: {
    id: 'survey_lens_2', name: 'Survey Lens II', kind: 'module', tier: 2, stackable: false,
    moduleEffect: { scanLevel: 2 },
    description: 'Sharper scanning optics. Reveals tier-2 deposits on a planet survey.'
  },
  survey_lens_3: {
    id: 'survey_lens_3', name: 'Survey Lens III', kind: 'module', tier: 3, stackable: false,
    moduleEffect: { scanLevel: 3 },
    description: 'Deep-survey optics. Reveals tier-3 deposits on a planet survey.'
  },
  survey_lens_4: {
    id: 'survey_lens_4', name: 'Survey Lens IV', kind: 'module', tier: 4, stackable: false,
    moduleEffect: { scanLevel: 4 },
    description: 'Anomaly-grade optics. Reveals even tier-4 exotics on a survey.'
  },
  lift_cell: {
    id: 'lift_cell', name: 'Lift Cell', kind: 'module', tier: 2, stackable: false,
    moduleEffect: { jetpackFuelMul: 1.5 },
    description: 'Extra jetpack reservoir. Longer hang time before you fall.'
  },
  range_coil: {
    id: 'range_coil', name: 'Range Coil', kind: 'module', tier: 3, stackable: false,
    moduleEffect: { warpRangeAdd: 1 },
    description: 'Tuned warp coil. Extends the reach of an interstellar jump.'
  }
};

// Complete registry: every resource (projected) + every crafted item.
export const ITEMS: Record<ItemId, ItemDefinition> = {
  ...(Object.fromEntries(
    ALL_RESOURCE_IDS.map(id => [id, resourceToItem(RESOURCES[id])])
  ) as Record<ResourceId, ItemDefinition>),
  ...CRAFTED_ITEMS
};

export const ALL_ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function getItem(id: ItemId): ItemDefinition {
  return ITEMS[id];
}

export function isItemId(id: string): id is ItemId {
  return id in ITEMS;
}

/** Items that restore hunger when eaten, richest-first (so "eat best" is a head pick). */
export const EDIBLE_ITEM_IDS: ItemId[] = ALL_ITEM_IDS
  .filter(id => (ITEMS[id].foodValue ?? 0) > 0)
  // foodValue DESC, then id ASC so the "eat best" pick is deterministic across builds.
  .sort((a, b) => (ITEMS[b].foodValue ?? 0) - (ITEMS[a].foodValue ?? 0) || a.localeCompare(b));

/** A quantity of one item — the shared currency for inventory, recipes, costs. */
export interface ItemStack {
  id: ItemId;
  qty: number;
}
