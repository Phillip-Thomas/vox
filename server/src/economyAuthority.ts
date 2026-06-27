import type { JsonObject } from './protocol.js';
import {
  isCollectibleCoordPlausible,
  isTerrainCoordInBounds,
  sameCoord,
  type ServerCoord3
} from './worldAuthority.js';

export interface ItemStack {
  id: string;
  qty: number;
}

export interface AuthoritativeCommandResolution {
  commandPayload: JsonObject;
  events: Array<{ type: string; payload: JsonObject }>;
  debit: ItemStack[];
  credit: ItemStack[];
  playerStatePatch?: AuthoritativePlayerStatePatch;
  campfireClaim?: {
    campfireId: string;
    position: [number, number, number];
    up: [number, number, number];
    state: JsonObject;
  };
  structureClaims?: AuthoritativeStructureClaim[];
}

export interface ServerVitalsState {
  health: number;
  hunger: number;
  thirst: number;
  warmth: number;
  stamina: number;
  oxygen: number;
}

export interface ServerPlayerState {
  vitals: ServerVitalsState;
  exhausted: boolean;
  mawCharge: number;
  waterskinFill: number;
}

export interface AuthoritativePlayerStatePatch {
  vitals?: ServerVitalsState;
  exhausted?: boolean;
  mawCharge?: number;
  waterskinFill?: number;
}

export type AuthoritativeStructureClaim =
  | {
    mode: 'insert';
    structureId: string;
    cell: [number, number, number];
    face: number;
    structureType: string;
    material: string;
    state: JsonObject;
  }
  | {
    mode: 'door_leaf';
    structureId: string;
    requiredStructureId: string;
    cell: [number, number, number];
    face: number;
    structureType: 'door';
    material: string;
    state: JsonObject;
  };

export type AuthoritativeCommandError = {
  code: 'validation_failed';
  reason: string;
};

export type CanonicalCommandPayloadResolution =
  | { commandPayload: JsonObject }
  | AuthoritativeCommandError;

interface Recipe {
  id: string;
  inputs: ItemStack[];
  outputs: ItemStack[];
}

interface ResourceDefinition {
  yield: [number, number];
  scanLevel: number;
}

interface BlockDefinition {
  drops: string[];
  bonusDrops?: Array<{ id: string; chance: number; min: number; max: number }>;
  depositResources?: string[];
}

interface ServerResourceDeposit {
  resourceId: string;
  richness: number;
  scanLevel: number;
}

interface BuildPieceDefinition {
  costUnits: number;
  shape: 'panel' | 'volume';
}

const BUILD_PIECES: Record<string, BuildPieceDefinition> = {
  foundation: { shape: 'panel', costUnits: 4 },
  wall: { shape: 'panel', costUnits: 2 },
  ceiling: { shape: 'panel', costUnits: 3 },
  doorway: { shape: 'panel', costUnits: 2 },
  window: { shape: 'panel', costUnits: 2 },
  gable: { shape: 'panel', costUnits: 1 },
  stairs: { shape: 'volume', costUnits: 4 },
  sloped_roof: { shape: 'volume', costUnits: 3 },
  ladder: { shape: 'panel', costUnits: 1 },
  door: { shape: 'panel', costUnits: 2 }
};

const BUILD_MATERIALS: Record<string, { resource: string; costMul: number }> = {
  wood: { resource: 'wood', costMul: 1 }
};

const VOLUME_FACE = 6;
const FACE_DIRS: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

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
SERVER_AUTH_COMMAND_TYPES.add('item_consumed');
SERVER_AUTH_COMMAND_TYPES.add('water_drank');
SERVER_AUTH_COMMAND_TYPES.add('waterskin_filled');
SERVER_AUTH_COMMAND_TYPES.add('maw_refueled');
SERVER_AUTH_COMMAND_TYPES.add('maw_repaired');
SERVER_AUTH_COMMAND_TYPES.add('maw_charge_spent');
SERVER_AUTH_COMMAND_TYPES.add('structure_placed');

const MAX_VITAL = 100;
const MAX_WATERSKIN = 100;
const MAX_MAW_CHARGE = 100;
const BIOFUEL_CHARGE = 50;

const CONSUMABLES: Record<string, { food: number; water: number }> = {
  berry: { food: 12, water: 6 },
  root: { food: 24, water: 0 }
};

const RESOURCES: Record<string, ResourceDefinition> = {
  stone: { yield: [1, 2], scanLevel: 0 },
  flint: { yield: [1, 1], scanLevel: 0 },
  silica: { yield: [1, 3], scanLevel: 0 },
  copper_ore: { yield: [1, 3], scanLevel: 1 },
  iron_trace: { yield: [1, 2], scanLevel: 1 },
  resin: { yield: [1, 2], scanLevel: 1 },
  biofiber: { yield: [1, 3], scanLevel: 1 },
  frost_crystal: { yield: [1, 2], scanLevel: 2 },
  basalt_glass: { yield: [1, 2], scanLevel: 2 },
  charged_crystal: { yield: [1, 1], scanLevel: 2 },
  gold_trace: { yield: [1, 1], scanLevel: 3 },
  void_glass: { yield: [1, 1], scanLevel: 4 }
};

const BLOCKS: Record<string, BlockDefinition> = {
  stone: {
    drops: ['stone'],
    bonusDrops: [{ id: 'flint', chance: 0.35, min: 1, max: 1 }]
  },
  dirt: { drops: [] },
  grass: { drops: ['biofiber'], depositResources: ['biofiber', 'resin'] },
  sand: { drops: ['silica'], depositResources: ['silica'] },
  lava: { drops: [] },
  wood: { drops: ['resin', 'biofiber'], depositResources: ['resin', 'biofiber'] },
  copper_block: { drops: ['copper_ore'], depositResources: ['copper_ore'] },
  gold_block: { drops: ['gold_trace'], depositResources: ['gold_trace'] },
  silver_block: { drops: ['iron_trace'], depositResources: ['iron_trace'] },
  basalt: { drops: ['stone', 'basalt_glass'], depositResources: ['basalt_glass'] },
  ice: { drops: ['frost_crystal'], depositResources: ['frost_crystal'] },
  crystal_crust: { drops: ['silica', 'charged_crystal'], depositResources: ['charged_crystal', 'void_glass'] }
};

export function defaultServerPlayerState(): ServerPlayerState {
  return {
    vitals: {
      health: MAX_VITAL,
      hunger: MAX_VITAL,
      thirst: MAX_VITAL,
      warmth: MAX_VITAL,
      stamina: MAX_VITAL,
      oxygen: MAX_VITAL
    },
    exhausted: false,
    mawCharge: 0,
    waterskinFill: 0
  };
}

export function isServerAuthoritativeCommand(commandType: string): boolean {
  return SERVER_AUTH_COMMAND_TYPES.has(commandType);
}

export function resolveServerAuthoritativeCommand(
  commandType: string,
  payload: JsonObject,
  playerState: ServerPlayerState = defaultServerPlayerState()
): AuthoritativeCommandResolution | AuthoritativeCommandError | null {
  switch (commandType) {
    case 'recipe_crafted':
      return resolveRecipeCraft(payload);
    case 'craft_campfire':
      return resolveCraftCampfire(payload);
    case 'item_consumed':
      return resolveItemConsumed(payload, playerState);
    case 'water_drank':
      return resolveWaterDrank(payload, playerState);
    case 'waterskin_filled':
      return resolveWaterskinFilled(payload, playerState);
    case 'maw_refueled':
      return resolveMawRefueled(playerState);
    case 'maw_repaired':
      return resolveMawRepaired(playerState);
    case 'maw_charge_spent':
      return resolveMawChargeSpent(payload, playerState);
    case 'structure_placed':
      return resolveStructurePlaced(payload);
    default:
      return null;
  }
}

export function resolveServerCanonicalCommandPayload(
  commandType: string,
  payload: JsonObject,
  context: { worldId: string }
): CanonicalCommandPayloadResolution | null {
  switch (commandType) {
    case 'resource_taken':
      return resolveResourceTakenPayload(payload, context.worldId);
    case 'voxel_mined':
      return resolveVoxelMinedPayload(payload, context.worldId);
    case 'structure_removed':
      return resolveStructureRemovedPayload(payload);
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

export function structureRefundFor(type: string, material: string): ItemStack[] {
  return buildCost(type, material)
    .map(stack => ({ ...stack, qty: Math.floor(stack.qty / 2) }))
    .filter(stack => stack.qty > 0);
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

function resolveItemConsumed(
  payload: JsonObject,
  playerState: ServerPlayerState
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const itemId = readString(payload.itemId);
  const item = itemId ? CONSUMABLES[itemId] : undefined;
  if (!itemId || !item || (item.food <= 0 && item.water <= 0)) {
    return { code: 'validation_failed', reason: 'Item is not server-consumable.' };
  }
  const eventPayload = { itemId, food: item.food, water: item.water };
  return {
    commandPayload: { itemId },
    events: [{ type: 'item_consumed', payload: eventPayload }],
    debit: [{ id: itemId, qty: 1 }],
    credit: [],
    playerStatePatch: {
      vitals: feedVitals(playerState.vitals, item.food, item.water),
      exhausted: playerState.exhausted
    }
  };
}

function resolveWaterDrank(
  payload: JsonObject,
  playerState: ServerPlayerState
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const requestedAmount = readPositiveAmount(payload.amount, 60);
  const source = readString(payload.source);
  if (source === 'waterskin') {
    if (playerState.waterskinFill <= 0) {
      return { code: 'validation_failed', reason: 'Waterskin is empty.' };
    }
    const amount = Math.min(playerState.waterskinFill, requestedAmount);
    const fill = clamp(playerState.waterskinFill - amount, 0, MAX_WATERSKIN);
    const eventPayload = { source: 'waterskin', amount, fill };
    return {
      commandPayload: { source: 'waterskin', amount: requestedAmount },
      events: [{ type: 'water_drank', payload: eventPayload }],
      debit: [{ id: 'waterskin', qty: 1 }],
      credit: [{ id: 'waterskin', qty: 1 }],
      playerStatePatch: {
        vitals: drinkVitals(playerState.vitals, amount),
        exhausted: playerState.exhausted,
        waterskinFill: fill
      }
    };
  }
  if (source !== null) {
    return { code: 'validation_failed', reason: 'Unknown drink source.' };
  }

  const filledWaterskin = payload.filledWaterskin === true;
  const eventPayload = { amount: requestedAmount, filledWaterskin };
  return {
    commandPayload: { amount: requestedAmount, filledWaterskin },
    events: [{ type: 'water_drank', payload: eventPayload }],
    debit: filledWaterskin ? [{ id: 'waterskin', qty: 1 }] : [],
    credit: filledWaterskin ? [{ id: 'waterskin', qty: 1 }] : [],
    playerStatePatch: {
      vitals: drinkVitals(playerState.vitals, requestedAmount),
      exhausted: playerState.exhausted,
      ...(filledWaterskin ? { waterskinFill: MAX_WATERSKIN } : {})
    }
  };
}

function resolveWaterskinFilled(
  payload: JsonObject,
  playerState: ServerPlayerState
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (playerState.waterskinFill >= MAX_WATERSKIN) {
    return { code: 'validation_failed', reason: 'Waterskin is already full.' };
  }
  const requestedAmount = readPositiveAmount(payload.amount, MAX_WATERSKIN);
  const amount = Math.min(MAX_WATERSKIN - playerState.waterskinFill, requestedAmount);
  if (amount <= 0) return { code: 'validation_failed', reason: 'Waterskin did not fill.' };
  const fill = clamp(playerState.waterskinFill + amount, 0, MAX_WATERSKIN);
  const eventPayload = { amount, fill };
  return {
    commandPayload: { amount: requestedAmount },
    events: [{ type: 'waterskin_filled', payload: eventPayload }],
    debit: [{ id: 'waterskin', qty: 1 }],
    credit: [{ id: 'waterskin', qty: 1 }],
    playerStatePatch: { waterskinFill: fill }
  };
}

function resolveMawRefueled(playerState: ServerPlayerState): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (playerState.mawCharge > 0) {
    return { code: 'validation_failed', reason: 'Maw already has charge.' };
  }
  const charge = Math.min(MAX_MAW_CHARGE, playerState.mawCharge + BIOFUEL_CHARGE);
  const amount = charge - playerState.mawCharge;
  if (amount <= 0) return { code: 'validation_failed', reason: 'Maw did not refuel.' };
  return {
    commandPayload: {},
    events: [{ type: 'maw_refueled', payload: { amount, charge } }],
    debit: [{ id: 'biofuel', qty: 1 }],
    credit: [],
    playerStatePatch: { mawCharge: charge }
  };
}

function resolveMawRepaired(playerState: ServerPlayerState): AuthoritativeCommandResolution {
  return {
    commandPayload: {},
    events: [{ type: 'maw_repaired', payload: {} }],
    debit: [{ id: 'faulty_maw', qty: 1 }],
    credit: [{ id: 'iron_maw', qty: 1 }],
    playerStatePatch: { mawCharge: 0, exhausted: playerState.exhausted }
  };
}

function resolveMawChargeSpent(
  payload: JsonObject,
  playerState: ServerPlayerState
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const requestedAmount = readPositiveAmount(payload.amount, 0);
  if (requestedAmount <= 0) {
    return { code: 'validation_failed', reason: 'Maw charge spend requires a positive amount.' };
  }
  if (playerState.mawCharge <= 0) {
    return { code: 'validation_failed', reason: 'Maw has no charge to spend.' };
  }
  const amount = Math.min(playerState.mawCharge, requestedAmount);
  const charge = clamp(playerState.mawCharge - amount, 0, MAX_MAW_CHARGE);
  return {
    commandPayload: { amount: requestedAmount },
    events: [{ type: 'maw_charge_spent', payload: { amount, charge } }],
    debit: [],
    credit: [],
    playerStatePatch: { mawCharge: charge }
  };
}

function resolveStructurePlaced(payload: JsonObject): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const cell = readIntCoord(payload.cell);
  const face = readInt(payload.face);
  const type = readString(payload.type);
  const material = readString(payload.material);
  const piece = type ? BUILD_PIECES[type] : undefined;
  const materialDef = material ? BUILD_MATERIALS[material] : undefined;
  if (!cell || face === null || !type || !piece || !material || !materialDef) {
    return { code: 'validation_failed', reason: 'Structure placement requires known type, material, cell, and face.' };
  }
  if (!isStructureCoordPlausible(cell)) {
    return { code: 'validation_failed', reason: 'Structure placement target is outside plausible build bounds.' };
  }
  if (type === 'door') return resolveDoorLeafPlaced(cell, face, material);

  if (piece.shape === 'volume') {
    if (face !== VOLUME_FACE) {
      return { code: 'validation_failed', reason: 'Volume structure placement must use the volume face.' };
    }
    const up = readFaceIndex(payload.up);
    const orient = readOrient(payload.orient);
    if (up === null || orient === null) {
      return { code: 'validation_failed', reason: 'Volume structure placement requires up and orient.' };
    }
    const eventPayload = { cell, face: VOLUME_FACE, type, material, up, orient };
    return {
      commandPayload: eventPayload,
      events: [{ type: 'structure_placed', payload: eventPayload }],
      debit: buildCost(type, material),
      credit: [],
      structureClaims: [{
        mode: 'insert',
        structureId: structureId(cell, VOLUME_FACE),
        cell,
        face: VOLUME_FACE,
        structureType: type,
        material,
        state: { up, orient }
      }]
    };
  }

  const panelFace = readFaceIndex(face);
  if (panelFace === null) {
    return { code: 'validation_failed', reason: 'Panel structure placement requires face 0..5.' };
  }
  if (type === 'doorway') return resolveDoorwayPlaced(cell, panelFace, material, payload.up);

  const up = readFaceIndex(payload.up);
  const eventPayload: JsonObject = { cell, face: panelFace, type, material };
  const state: JsonObject = {};
  if (up !== null) {
    eventPayload.up = up;
    state.up = up;
  }
  return {
    commandPayload: eventPayload,
    events: [{ type: 'structure_placed', payload: eventPayload }],
    debit: buildCost(type, material),
    credit: [],
    structureClaims: [{
      mode: 'insert',
      structureId: structureId(cell, panelFace),
      cell,
      face: panelFace,
      structureType: type,
      material,
      state
    }]
  };
}

function resolveDoorwayPlaced(
  cell: [number, number, number],
  face: number,
  material: string,
  rawUp: unknown
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const up = readFaceIndex(rawUp);
  if (up === null) return { code: 'validation_failed', reason: 'Doorway placement requires up face 0..5.' };
  const dir = FACE_DIRS[up];
  const upper: [number, number, number] = [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]];
  if (!isStructureCoordPlausible(upper)) {
    return { code: 'validation_failed', reason: 'Doorway upper cell is outside plausible build bounds.' };
  }
  const eventPayload = { cell, face, type: 'doorway', material, up };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'structure_placed', payload: eventPayload }],
    debit: buildCost('doorway', material),
    credit: [],
    structureClaims: [
      {
        mode: 'insert',
        structureId: structureId(cell, face),
        cell,
        face,
        structureType: 'doorway',
        material,
        state: { up, tall: 'lower', partner: upper }
      },
      {
        mode: 'insert',
        structureId: structureId(upper, face),
        cell: upper,
        face,
        structureType: 'doorway',
        material,
        state: { up, tall: 'upper', partner: cell }
      }
    ]
  };
}

function resolveDoorLeafPlaced(
  cell: [number, number, number],
  face: number,
  material: string
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const panelFace = readFaceIndex(face);
  if (panelFace === null) return { code: 'validation_failed', reason: 'Door fitting requires face 0..5.' };
  const eventPayload = { cell, face: panelFace, type: 'door', material };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'structure_placed', payload: eventPayload }],
    debit: buildCost('door', material),
    credit: [],
    structureClaims: [{
      mode: 'door_leaf',
      structureId: doorLeafId(cell, panelFace),
      requiredStructureId: structureId(cell, panelFace),
      cell,
      face: panelFace,
      structureType: 'door',
      material,
      state: { leaf: true, open: false }
    }]
  };
}

function resolveResourceTakenPayload(
  payload: JsonObject,
  worldId: string
): CanonicalCommandPayloadResolution {
  const source = readString(payload.source);
  const coord = readIntCoord(payload.coord);
  if (!source || !coord) {
    return { code: 'validation_failed', reason: 'Resource pickup requires source and coord.' };
  }
  if (!isCollectibleCoordPlausible(coord)) {
    return { code: 'validation_failed', reason: 'Resource pickup target is outside plausible terrain bounds.' };
  }

  switch (source) {
    case 'tree': {
      const qty = deterministicRng(`resource_taken:tree:${worldId}:${coordKey(coord)}`).int(2, 4);
      return { commandPayload: { source, coord, id: 'wood', qty } };
    }
    case 'loose_stone': {
      const qty = deterministicRng(`resource_taken:loose_stone:${worldId}:${coordKey(coord)}`).int(1, 2);
      return { commandPayload: { source, coord, id: 'stone', qty } };
    }
    case 'forage': {
      const kind = readString(payload.kind);
      if (kind === 'root') return { commandPayload: { source, kind, coord, id: 'root', qty: 1 } };
      if (kind === 'berry') {
        const qty = deterministicRng(`resource_taken:forage:berry:${worldId}:${coordKey(coord)}`).int(1, 2);
        return { commandPayload: { source, kind, coord, id: 'berry', qty } };
      }
      return { code: 'validation_failed', reason: 'Forage pickup requires berry or root kind.' };
    }
    default:
      return { code: 'validation_failed', reason: 'Unknown resource pickup source.' };
  }
}

function resolveVoxelMinedPayload(
  payload: JsonObject,
  worldId: string
): CanonicalCommandPayloadResolution {
  const coord = readIntCoord(payload.coord);
  const blockId = readString(payload.blockId);
  const block = blockId ? BLOCKS[blockId] : undefined;
  if (!coord || !blockId || !block) {
    return { code: 'validation_failed', reason: 'Voxel mining requires a known block id and integer coord.' };
  }
  if (!isTerrainCoordInBounds(coord)) {
    return { code: 'validation_failed', reason: 'Voxel mining target is outside generated terrain bounds.' };
  }

  const depositResolution = readDepositForTarget(payload.deposit, { block, blockId, worldId, coord })
    ?? readDepositForTarget(payload.depositIdentity, { block, blockId, worldId, coord });
  if (depositResolution && 'error' in depositResolution) return depositResolution.error;
  const deposit = depositResolution?.deposit ?? null;
  const rng = deterministicRng(`voxel_mined:${worldId}:${coordKey(coord)}:${blockId}:${depositKey(deposit)}`);
  const drops: ItemStack[] = [];
  for (const id of dropsForBlock(block, deposit)) {
    const resource = RESOURCES[id];
    if (!resource) continue;
    const [lo, hi] = resource.yield;
    const rolled = rng.int(lo, hi);
    const richness = deposit?.resourceId === id ? deposit.richness : 1;
    const qty = Math.max(0, Math.round(rolled * richness));
    if (qty > 0) drops.push({ id, qty });
  }

  for (const bonus of block.bonusDrops ?? []) {
    if (!rng.chance(bonus.chance)) continue;
    const qty = rng.int(bonus.min, bonus.max);
    if (qty > 0) drops.push({ id: bonus.id, qty });
  }

  return {
    commandPayload: {
      coord,
      blockId,
      deposit: deposit ?? null,
      depositIdentity: deposit ? {
        worldId,
        coord,
        resourceId: deposit.resourceId,
        richness: deposit.richness,
        scanLevel: deposit.scanLevel
      } : null,
      drops: compactStacks(drops),
      exposedNeighbors: readNonNegativeInteger(payload.exposedNeighbors) ?? 0,
      flooded: readCoordArray(payload.flooded),
      maw: readObject(payload.maw) ?? {
        usesCharge: false,
        refueled: 0,
        chargeSpent: 0,
        charge: 0
      }
    }
  };
}

function resolveStructureRemovedPayload(payload: JsonObject): CanonicalCommandPayloadResolution {
  const cell = readIntCoord(payload.cell);
  const face = readInt(payload.face);
  if (!cell || face === null || face < 0 || face > VOLUME_FACE) {
    return { code: 'validation_failed', reason: 'Structure removal requires a valid cell and face.' };
  }
  if (!isStructureCoordPlausible(cell)) {
    return { code: 'validation_failed', reason: 'Structure removal target is outside plausible build bounds.' };
  }
  return { commandPayload: { cell, face } };
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

function readPositiveAmount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(MAX_VITAL, value);
}

function readNonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 ? value : null;
}

function readInt(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' ? value : null;
}

function readFaceIndex(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value < FACE_DIRS.length
    ? value
    : null;
}

function readOrient(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 3
    ? value
    : null;
}

function readIntCoord(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    ? [x, y, z]
    : null;
}

function readCoordArray(value: unknown): Array<[number, number, number]> {
  if (!Array.isArray(value)) return [];
  return value
    .map(readIntCoord)
    .filter((coord): coord is [number, number, number] => coord !== null);
}

function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : null;
}

function readDepositForTarget(
  value: unknown,
  target: { block: BlockDefinition; blockId: string; worldId: string; coord: ServerCoord3 }
): { deposit: ServerResourceDeposit } | { error: AuthoritativeCommandError } | null {
  if (value === undefined || value === null) return null;
  const payload = readObject(value);
  if (!payload) {
    return { error: { code: 'validation_failed', reason: 'Deposit identity must be an object when provided.' } };
  }

  const identityWorldId = readString(payload.worldId);
  if (identityWorldId !== null && identityWorldId !== target.worldId) {
    return { error: { code: 'validation_failed', reason: 'Deposit world identity does not match command world.' } };
  }

  const identityCoord = readIntCoord(payload.coord);
  if (identityCoord !== null && !sameCoord(identityCoord, target.coord)) {
    return { error: { code: 'validation_failed', reason: 'Deposit coordinate does not match mined voxel.' } };
  }

  const resourceId = readString(payload.resourceId);
  const resource = resourceId ? RESOURCES[resourceId] : undefined;
  if (!resourceId || !resource) {
    return { error: { code: 'validation_failed', reason: 'Deposit resource is not known.' } };
  }
  if (!target.block.depositResources?.includes(resourceId)) {
    return { error: { code: 'validation_failed', reason: 'Deposit resource is not plausible for the mined block.' } };
  }

  const richness = payload.richness;
  if (typeof richness !== 'number' || !Number.isFinite(richness) || richness < 0.75 || richness > 1.5) {
    return { error: { code: 'validation_failed', reason: 'Deposit richness is outside the generated range.' } };
  }

  const scanLevel = payload.scanLevel;
  if (typeof scanLevel !== 'number' || !Number.isInteger(scanLevel) || scanLevel !== resource.scanLevel) {
    return { error: { code: 'validation_failed', reason: 'Deposit scan level does not match the resource definition.' } };
  }

  return { deposit: { resourceId, richness, scanLevel } };
}

function readObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function vecKey(vec: [number, number, number]): string {
  return vec.map(component => Number(component).toPrecision(12)).join(',');
}

function coordKey(coord: [number, number, number]): string {
  return coord.join(',');
}

function structureId(cell: [number, number, number], face: number): string {
  return `slot:${coordKey(cell)}:${face}`;
}

function doorLeafId(cell: [number, number, number], face: number): string {
  return `door:${coordKey(cell)}:${face}`;
}

function buildCost(type: string, material: string): ItemStack[] {
  const piece = BUILD_PIECES[type];
  const materialDef = BUILD_MATERIALS[material];
  if (!piece || !materialDef) return [];
  return [{ id: materialDef.resource, qty: Math.max(1, Math.ceil(piece.costUnits * materialDef.costMul)) }];
}

function isStructureCoordPlausible(coord: [number, number, number]): boolean {
  return coord.every(value => Math.abs(value) <= 33);
}

function depositKey(deposit: ServerResourceDeposit | null): string {
  return deposit ? `${deposit.resourceId}:${deposit.richness}:${deposit.scanLevel}` : 'none';
}

function dropsForBlock(block: BlockDefinition, deposit: ServerResourceDeposit | null): string[] {
  const out: string[] = [];
  if (deposit) out.push(deposit.resourceId);
  for (const id of block.drops) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function feedVitals(vitals: ServerVitalsState, hunger: number, water: number): ServerVitalsState {
  return {
    ...vitals,
    hunger: clamp(vitals.hunger + hunger, 0, MAX_VITAL),
    thirst: water > 0 ? clamp(vitals.thirst + water, 0, MAX_VITAL) : vitals.thirst
  };
}

function drinkVitals(vitals: ServerVitalsState, amount: number): ServerVitalsState {
  return {
    ...vitals,
    thirst: clamp(vitals.thirst + amount, 0, MAX_VITAL)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deterministicRng(seed: string): {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
} {
  let state = mixSeed(seed);
  const rng = {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(minInclusive: number, maxInclusive: number) {
      const lo = Math.ceil(Math.min(minInclusive, maxInclusive));
      const hi = Math.floor(Math.max(minInclusive, maxInclusive));
      if (hi <= lo) return lo;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    },
    chance(probability: number) {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return rng.next() < probability;
    }
  };
  return rng;
}

function mixSeed(seed: string): number {
  const base = hashRngSeed(seed);
  let mixed = (base ^ Math.imul(0x6d2b79f5, 2246822519)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 3266489917) >>> 0;
  return mixed || 0x6d2b79f5;
}

function hashRngSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
