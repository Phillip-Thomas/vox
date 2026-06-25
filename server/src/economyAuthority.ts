import type { JsonObject } from './protocol.js';

export interface ItemStack {
  id: string;
  qty: number;
}

export interface AuthoritativeCommandResolution {
  commandPayload: JsonObject;
  events: Array<{ type: string; payload: JsonObject }>;
  debit: ItemStack[];
  credit: ItemStack[];
  campfireClaim?: {
    campfireId: string;
    position: [number, number, number];
    up: [number, number, number];
    state: JsonObject;
  };
}

export type AuthoritativeCommandError = {
  code: 'validation_failed';
  reason: string;
};

interface Recipe {
  id: string;
  inputs: ItemStack[];
  outputs: ItemStack[];
}

const RECIPES: Record<string, Recipe> = {
  biofuel: recipe('biofuel', [{ id: 'biofiber', qty: 3 }]),
  stone_hatchet: recipe('stone_hatchet', [
    { id: 'wood', qty: 2 },
    { id: 'biofiber', qty: 2 },
    { id: 'stone', qty: 1 }
  ]),
  stone_pickaxe: recipe('stone_pickaxe', [
    { id: 'wood', qty: 2 },
    { id: 'biofiber', qty: 1 },
    { id: 'stone', qty: 2 }
  ]),
  torch: recipe('torch', [
    { id: 'flint', qty: 1 },
    { id: 'biofuel', qty: 1 },
    { id: 'wood', qty: 1 }
  ]),
  campfire: recipe('campfire', [
    { id: 'flint', qty: 2 },
    { id: 'biofuel', qty: 1 },
    { id: 'wood', qty: 3 }
  ]),
  waterskin: recipe('waterskin', [
    { id: 'biofiber', qty: 4 },
    { id: 'wood', qty: 1 }
  ]),
  refined_alloy: recipe('refined_alloy', [
    { id: 'iron_ore', qty: 2 },
    { id: 'copper_ore', qty: 1 }
  ]),
  silica_pane: recipe('silica_pane', [{ id: 'silica', qty: 2 }]),
  biocomposite: recipe('biocomposite', [
    { id: 'biofiber', qty: 2 },
    { id: 'resin', qty: 1 }
  ]),
  cryo_cell: recipe('cryo_cell', [
    { id: 'ice_crystal', qty: 2 },
    { id: 'iron_ore', qty: 1 }
  ]),
  thermal_ceramic: recipe('thermal_ceramic', [
    { id: 'basalt', qty: 2 },
    { id: 'silica', qty: 1 }
  ]),
  charge_cell: recipe('charge_cell', [
    { id: 'charged_crystal', qty: 2 },
    { id: 'copper_ore', qty: 1 }
  ]),
  void_core: recipe('void_core', [
    { id: 'void_shard', qty: 3 },
    { id: 'refined_alloy', qty: 1 }
  ]),
  logic_wafer: recipe('logic_wafer', [
    { id: 'silica_pane', qty: 1 },
    { id: 'refined_alloy', qty: 1 }
  ]),
  strut_frame: recipe('strut_frame', [
    { id: 'refined_alloy', qty: 2 },
    { id: 'biocomposite', qty: 1 }
  ]),
  iron_maw: recipe('iron_maw', [
    { id: 'faulty_maw', qty: 1 },
    { id: 'refined_alloy', qty: 2 },
    { id: 'logic_wafer', qty: 1 }
  ]),
  frost_maw: recipe('frost_maw', [
    { id: 'iron_maw', qty: 1 },
    { id: 'cryo_cell', qty: 2 },
    { id: 'logic_wafer', qty: 1 }
  ]),
  arc_maw: recipe('arc_maw', [
    { id: 'iron_maw', qty: 1 },
    { id: 'charge_cell', qty: 2 },
    { id: 'logic_wafer', qty: 1 }
  ]),
  void_maw: recipe('void_maw', [
    { id: 'arc_maw', qty: 1 },
    { id: 'void_core', qty: 1 },
    { id: 'logic_wafer', qty: 2 }
  ]),
  thermal_carapace: recipe('thermal_carapace', [
    { id: 'strut_frame', qty: 1 },
    { id: 'thermal_ceramic', qty: 2 }
  ]),
  filter_carapace: recipe('filter_carapace', [
    { id: 'strut_frame', qty: 1 },
    { id: 'biocomposite', qty: 2 }
  ]),
  shielded_carapace: recipe('shielded_carapace', [
    { id: 'strut_frame', qty: 1 },
    { id: 'charge_cell', qty: 1 },
    { id: 'thermal_ceramic', qty: 1 }
  ]),
  survey_lens_2: recipe('survey_lens_2', [
    { id: 'silica_pane', qty: 1 },
    { id: 'copper_ore', qty: 1 }
  ]),
  survey_lens_3: recipe('survey_lens_3', [
    { id: 'survey_lens_2', qty: 1 },
    { id: 'logic_wafer', qty: 1 },
    { id: 'charged_crystal', qty: 1 }
  ]),
  survey_lens_4: recipe('survey_lens_4', [
    { id: 'survey_lens_3', qty: 1 },
    { id: 'void_core', qty: 1 }
  ]),
  lift_cell: recipe('lift_cell', [
    { id: 'charge_cell', qty: 1 },
    { id: 'biofuel', qty: 1 }
  ]),
  range_coil: recipe('range_coil', [
    { id: 'copper_ore', qty: 2 },
    { id: 'charged_crystal', qty: 1 }
  ])
};

const SERVER_AUTH_COMMAND_TYPES = new Set(['recipe_crafted', 'craft_campfire']);

export function isServerAuthoritativeCommand(commandType: string): boolean {
  return SERVER_AUTH_COMMAND_TYPES.has(commandType);
}

export function resolveServerAuthoritativeCommand(
  commandType: string,
  payload: JsonObject
): AuthoritativeCommandResolution | AuthoritativeCommandError | null {
  switch (commandType) {
    case 'recipe_crafted':
      return resolveRecipeCraft(payload);
    case 'craft_campfire':
      return resolveCraftCampfire(payload);
    default:
      return null;
  }
}

export function inventoryCreditsForAcceptedCommand(commandType: string, payload: JsonObject): ItemStack[] {
  switch (commandType) {
    case 'resource_taken':
      return compactStacks([readItemStack(payload)]);
    case 'voxel_mined':
      return compactStacks(readItemStacks(payload.drops));
    default:
      return [];
  }
}

export function starterInventory(): ItemStack[] {
  return [{ id: 'faulty_maw', qty: 1 }];
}

function resolveRecipeCraft(payload: JsonObject): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const recipeId = readString(payload.recipeId);
  const recipeDef = recipeId ? RECIPES[recipeId] : undefined;
  if (!recipeId || !recipeDef) {
    return { code: 'validation_failed', reason: 'Unknown recipe.' };
  }
  const eventPayload = canonicalRecipePayload(recipeDef);
  return {
    commandPayload: eventPayload,
    events: [{ type: 'recipe_crafted', payload: eventPayload }],
    debit: recipeDef.inputs,
    credit: recipeDef.outputs
  };
}

function resolveCraftCampfire(payload: JsonObject): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const recipeId = readString(payload.recipeId);
  if (recipeId !== 'campfire') {
    return { code: 'validation_failed', reason: 'craft_campfire can only craft the campfire recipe.' };
  }
  const position = readVec3(payload.pos);
  const up = readVec3(payload.up);
  if (!position || !up) {
    return { code: 'validation_failed', reason: 'Campfire placement requires finite pos and up vectors.' };
  }
  const recipeDef = RECIPES.campfire;
  const recipePayload = canonicalRecipePayload(recipeDef);
  const campfirePayload = { pos: position, up };
  return {
    commandPayload: { recipeId: 'campfire', ...campfirePayload },
    events: [
      { type: 'recipe_crafted', payload: recipePayload },
      { type: 'campfire_placed', payload: campfirePayload }
    ],
    debit: recipeDef.inputs,
    credit: [],
    campfireClaim: {
      campfireId: `campfire:${vecKey(position)}:${vecKey(up)}`,
      position,
      up,
      state: {}
    }
  };
}

function canonicalRecipePayload(recipeDef: Recipe): JsonObject {
  return {
    recipeId: recipeDef.id,
    inputs: recipeDef.inputs.map(stack => ({ ...stack })),
    outputs: recipeDef.outputs.map(stack => ({ ...stack }))
  };
}

function recipe(id: string, inputs: ItemStack[], outQty = 1): Recipe {
  return { id, inputs, outputs: [{ id, qty: outQty }] };
}

function readItemStack(value: JsonObject): ItemStack | null {
  const id = readString(value.id);
  const qty = readPositiveInt(value.qty);
  return id && qty !== null ? { id, qty } : null;
}

function readItemStacks(value: unknown): ItemStack[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ? readItemStack(entry as JsonObject)
      : null)
    .filter((stack): stack is ItemStack => stack !== null);
}

function compactStacks(stacks: Array<ItemStack | null>): ItemStack[] {
  const byId = new Map<string, number>();
  for (const stack of stacks) {
    if (!stack || stack.qty <= 0) continue;
    byId.set(stack.id, (byId.get(stack.id) ?? 0) + stack.qty);
  }
  return [...byId].map(([id, qty]) => ({ id, qty }));
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readPositiveInt(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value > 0 ? value : null;
}

function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : null;
}

function vecKey(vec: [number, number, number]): string {
  return vec.map(component => Number(component).toPrecision(12)).join(',');
}
