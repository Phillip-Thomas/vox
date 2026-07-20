import { createHash } from 'node:crypto';
import type { JsonObject } from './protocol.js';
import { ECONOMY_CATALOG } from './generated/economyCatalog.js';
import {
  isCollectibleCoordPlausible,
  isCollectibleSurfaceCoordPlausible,
  isTerrainCoordInBounds,
  sameCoord,
  seedForWorldId,
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
  progression: ServerProgressionState;
}

export interface AuthoritativePlayerStatePatch {
  vitals?: ServerVitalsState;
  exhausted?: boolean;
  mawCharge?: number;
  waterskinFill?: number;
  progression?: ServerProgressionState;
}

export interface ServerProgressionState {
  era: string;
  milestones: string[];
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

export interface AuthoritativeCommandContext {
  commandId: string;
  worldId: string;
  /** Authenticated actor that owns this command. Required by actor-scoped story rails. */
  playerId?: string;
  /** Current server-owned clock for this shard. Used for story actions whose
   * physical contract includes local time (for example, a safe night rest). */
  worldTimeMs?: number;
  /** Server receive time for this command. Physical holds compare this only
   * with accepted event timestamps; client-supplied elapsed time is ignored. */
  serverTimeMs?: number;
  /** Authoritative history for the active shard. Story transactions use this
   * to make party-owned objects monotonic instead of trusting one player's
   * local progression snapshot. */
  worldEvents?: readonly AuthoritativeWorldEvent[];
  /** Latest pose accepted for this authenticated actor, stamped on server
   * receive. It proves liveness in the active shard, not physical proximity to
   * a client-authored story anchor or camera gaze. */
  authenticatedPose?: {
    playerId: string;
    worldId: string;
    seq: number;
    receivedAtMs: number;
  };
  /** Highest repair stage owned by the party's one shared Kestrel. */
  sharedShipRepairStage?: ServerShipRestorationStage;
}

export interface AuthoritativeWorldEvent {
  type: string;
  payload: JsonObject;
  playerId?: string;
  commandId?: string;
  timeMs?: number;
}

export interface AuthoritativeRecipe {
  id: string;
  inputs: ItemStack[];
  outputs: ItemStack[];
  station: string;
  era: string;
  requiredTech?: string;
  uniqueReceipt?: string;
}

interface ResourceDefinition {
  yield: [number, number];
  scanLevel: number;
}

const FLORA_DROPS = {
  cactus: { id: 'cactus_pulp', yield: [1, 2] },
  fan: { id: 'fan_frond', yield: [1, 2] },
  flower: { id: 'wild_bloom', yield: [1, 2] },
  seedhead: { id: 'seedpod', yield: [2, 3] },
  shrub: { id: 'berry', yield: [1, 2] }
} as const satisfies Record<string, { id: string; yield: readonly [number, number] }>;

type FloraKind = keyof typeof FLORA_DROPS;

const DEADWOOD_BASE = 0.022;
const DEADWOOD_SALT = 35;
const FORAGE_HASH_SALT = 32;
const FORAGE_MAX_DENSITY = 0.04 * 1.8;

export function isAuthoritativeDeadwoodNode(coord: ServerCoord3, worldId: string): boolean {
  const seed = seedForWorldId(worldId);
  return seed !== null
    && isCollectibleSurfaceCoordPlausible(coord)
    && seededVoxelUnit(coord[0], coord[1], coord[2], DEADWOOD_SALT, seed) < DEADWOOD_BASE
    && seededVoxelUnit(coord[0], coord[1], coord[2], FORAGE_HASH_SALT, seed) >= FORAGE_MAX_DENSITY;
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

export interface AuthoritativeBuildPieceDefinition {
  type: string;
  name: string;
  costUnits: number;
  shape: 'panel' | 'volume';
  family: 'foundation' | 'wall' | 'ceiling' | 'volume';
  heightUnits?: 1 | 2;
  hp: number;
  insulation: number;
  seals: boolean;
  passable?: boolean;
  climb?: boolean;
  openable?: boolean;
}

export interface AuthoritativeBuildMaterialDefinition {
  id: string;
  name: string;
  colorHex: number;
  resource: string;
  costMul: number;
  hpMul: number;
  insulationMul: number;
}

export const SERVER_ITEM_IDS: readonly string[] = ECONOMY_CATALOG.itemIds;

export const SERVER_BUILD_PIECES = Object.fromEntries(
  ECONOMY_CATALOG.buildPieces.map(piece => [
    piece.type,
    { ...piece } as AuthoritativeBuildPieceDefinition
  ])
) as Readonly<Record<string, AuthoritativeBuildPieceDefinition>>;
const BUILD_PIECES = SERVER_BUILD_PIECES;

export const SERVER_BUILD_MATERIALS = Object.fromEntries(
  ECONOMY_CATALOG.buildMaterials.map(material => [
    material.id,
    { ...material } as AuthoritativeBuildMaterialDefinition
  ])
) as Readonly<Record<string, AuthoritativeBuildMaterialDefinition>>;
const BUILD_MATERIALS = SERVER_BUILD_MATERIALS;

const VOLUME_FACE = 6;
const FACE_DIRS: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];
const WORLD_DAY_LENGTH_MS = 240_000;
const MAX_SHELTER_VISITED_CELLS = 4096;
const MAX_SHELTER_AXIS_SPAN = 32;
const LOCAL_SHELTER_STRUCTURE_RADIUS = MAX_SHELTER_AXIS_SPAN / 2;

type CatalogRecipe = (typeof ECONOMY_CATALOG.recipes)[number] & {
  requiredTech?: string;
  uniqueReceipt?: string;
};

function bindAuthoritativeRecipe(definition: CatalogRecipe): AuthoritativeRecipe {
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

export const SERVER_RECIPES = Object.fromEntries(
  ECONOMY_CATALOG.recipes.map(definition => [
    definition.id,
    bindAuthoritativeRecipe(definition)
  ])
) as Readonly<Record<string, AuthoritativeRecipe>>;
const RECIPES = SERVER_RECIPES;

export type ServerShipRepairStage = (typeof ECONOMY_CATALOG.storyTransactions.shipRepairStages)[number]['stage'];
export type ServerShipRestorationStage = 'wrecked' | ServerShipRepairStage;

const SHIP_REPAIR_STAGE_TRANSACTIONS = ECONOMY_CATALOG.storyTransactions.shipRepairStages;
const SHIP_REPAIR_STAGE_ORDER = SHIP_REPAIR_STAGE_TRANSACTIONS.map(
  transaction => transaction.stage
) as readonly ServerShipRepairStage[];

export const MAW_REPAIR_ORIGIN_WORLD_ID = ECONOMY_CATALOG.storyTransactions.mawRepair.originWorldId;
export const MAW_REPAIR_MIN_ATTENDANCE_MS = ECONOMY_CATALOG.storyTransactions.mawRepair.ritualSeconds * 1000;
export const MAW_PURPOSE_GAP_MIN_MS = ECONOMY_CATALOG.storyTransactions.mawRepair.purposeGapSeconds * 1000;
export const MAW_POND_OBSERVATION_MIN_MS = ECONOMY_CATALOG.storyTransactions.mawRepair.pondObservationSeconds * 1000;
export const MAW_POSE_MAX_AGE_MS = ECONOMY_CATALOG.storyTransactions.mawRepair.maxPoseAgeSeconds * 1000;
const MAW_FIRST_DIRECTION_MILESTONE = 'story:maw:first-direction-resolved';
const MAW_POND_RESONANCE_MILESTONE = 'story:maw:pond-resonance-visible';
const MAW_HARMLESS_TEST_BLOCK_IDS = new Set<string>(
  ECONOMY_CATALOG.storyTransactions.mawRepair.harmlessTestBlockIds
);
const TIDEGARDEN_WORLD_ID = '-1,-1:p1';
const STORY_ITEM_MILESTONES = {
  maw_repair_kit: 'story:item:maw-repair-kit:acquired',
  kestrel_keel_memory: 'story:item:kestrel-keel-memory:acquired'
} as const;
const KEEL_BANKED_MILESTONE = 'story:item:kestrel-keel-memory:banked';
const WRECK_SALVAGE_MILESTONE = 'story:salvage:kestrel:claimed';
const KESTREL_FOUNDING_RESERVE_MILESTONE = 'story:kestrel:founding-reserve-claimed';
export const TIDEGARDEN_ROUTE_MILESTONE = 'story:route:tidegarden:online';
const TIDEGARDEN_RELATIONSHIP_MILESTONE = 'story:tidegarden:relationship-attended';
const TIDEGARDEN_SITE_CHOICE_PREFIX = 'story:tidegarden:site-chosen:v1:';
const HABITAT_CORE_RECIPE_RECEIPT = 'story:item:habitat-core:crafted';
const HABITAT_CORE_ONLINE_MILESTONE = 'story:tidegarden:habitat-core-online';
const HABITAT_SHELTER_MILESTONE = 'story:tidegarden:shelter-certified';
const HABITAT_REST_MILESTONE = 'story:tidegarden:safe-rest-completed';
const TWO_WORLD_HANDOFF_MILESTONE = 'story:tidegarden:two-world-handoff';

// Public and authored-story recipes share one generated allow-list. Recipes
// outside that catalog never become authoritative through a client command.
export const SERVER_PUBLIC_DEMO_RECIPE_IDS: readonly string[] = ECONOMY_CATALOG.publicDemoRecipeIds;
export const SERVER_STORY_RECIPE_IDS: readonly string[] = ECONOMY_CATALOG.storyRecipeIds;
const AUTHORITATIVE_RECIPE_IDS = new Set([
  ...SERVER_PUBLIC_DEMO_RECIPE_IDS,
  ...SERVER_STORY_RECIPE_IDS
]);

const SERVER_AUTH_COMMAND_TYPES = new Set(['recipe_crafted', 'craft_campfire']);
SERVER_AUTH_COMMAND_TYPES.add('item_consumed');
SERVER_AUTH_COMMAND_TYPES.add('water_drank');
SERVER_AUTH_COMMAND_TYPES.add('waterskin_filled');
SERVER_AUTH_COMMAND_TYPES.add('maw_refueled');
SERVER_AUTH_COMMAND_TYPES.add('maw_repair_begun');
SERVER_AUTH_COMMAND_TYPES.add('maw_repaired');
SERVER_AUTH_COMMAND_TYPES.add('maw_first_direction_resolved');
SERVER_AUTH_COMMAND_TYPES.add('maw_pond_observation_begun');
SERVER_AUTH_COMMAND_TYPES.add('maw_pond_resonance_observed');
SERVER_AUTH_COMMAND_TYPES.add('maw_charge_spent');
SERVER_AUTH_COMMAND_TYPES.add('ship_repair_stage');
SERVER_AUTH_COMMAND_TYPES.add('story_item_acquired');
SERVER_AUTH_COMMAND_TYPES.add('story_item_banked');
SERVER_AUTH_COMMAND_TYPES.add('wreck_salvage_claimed');
SERVER_AUTH_COMMAND_TYPES.add('kestrel_founding_reserve_claimed');
SERVER_AUTH_COMMAND_TYPES.add('tidegarden_relationship_attended');
SERVER_AUTH_COMMAND_TYPES.add('tidegarden_site_chosen');
SERVER_AUTH_COMMAND_TYPES.add('habitat_core_placed');
SERVER_AUTH_COMMAND_TYPES.add('habitat_shelter_certified');
SERVER_AUTH_COMMAND_TYPES.add('habitat_safe_rest_completed');
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
    bonusDrops: [{ id: 'flint', chance: 1, min: 1, max: 1 }]
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
    waterskinFill: 0,
    progression: {
      era: 'primitive',
      milestones: []
    }
  };
}

export function isServerAuthoritativeCommand(commandType: string): boolean {
  return SERVER_AUTH_COMMAND_TYPES.has(commandType);
}

export function resolveServerAuthoritativeCommand(
  commandType: string,
  payload: JsonObject,
  playerState: ServerPlayerState = defaultServerPlayerState(),
  context?: AuthoritativeCommandContext
): AuthoritativeCommandResolution | AuthoritativeCommandError | null {
  switch (commandType) {
    case 'recipe_crafted':
      return resolveRecipeCraft(payload, playerState, context);
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
    case 'maw_repair_begun':
      return resolveMawRepairBegun(playerState, context);
    case 'maw_repaired':
      return resolveMawRepaired(payload, playerState, context);
    case 'maw_first_direction_resolved':
      return resolveMawFirstDirection(payload, playerState, context);
    case 'maw_pond_observation_begun':
      return resolveMawPondObservationBegun(playerState, context);
    case 'maw_pond_resonance_observed':
      return resolveMawPondResonanceObserved(payload, playerState, context);
    case 'maw_charge_spent':
      return resolveMawChargeSpent(payload, playerState);
    case 'ship_repair_stage':
      return resolveShipRepairStage(payload, playerState, context);
    case 'story_item_acquired':
      return resolveStoryItemAcquired(payload, playerState, context);
    case 'story_item_banked':
      return resolveStoryItemBanked(payload, playerState, context);
    case 'wreck_salvage_claimed':
      return resolveWreckSalvageClaimed(playerState, context);
    case 'kestrel_founding_reserve_claimed':
      return resolveKestrelFoundingReserveClaimed(playerState, context);
    case 'tidegarden_relationship_attended':
      return resolveTidegardenRelationshipAttended(payload, playerState, context);
    case 'tidegarden_site_chosen':
      return resolveTidegardenSiteChosen(payload, playerState, context);
    case 'habitat_core_placed':
      return resolveHabitatCorePlaced(payload, playerState, context);
    case 'habitat_shelter_certified':
      return resolveHabitatShelterCertified(payload, playerState, context);
    case 'habitat_safe_rest_completed':
      return resolveHabitatSafeRestCompleted(payload, playerState, context);
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
  return authoritativeBuildCost(type, material)
    .map(stack => ({ ...stack, qty: Math.floor(stack.qty / 2) }))
    .filter(stack => stack.qty > 0);
}

function resolveRecipeCraft(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const recipeId = readString(payload.recipeId);
  const recipeDef = recipeId ? RECIPES[recipeId] : undefined;
  if (!recipeId || !recipeDef) {
    return { code: 'validation_failed', reason: 'Unknown recipe.' };
  }
  if (!AUTHORITATIVE_RECIPE_IDS.has(recipeId)) {
    return { code: 'validation_failed', reason: 'Recipe is not available in the authoritative field economy.' };
  }
  const requiredRepairStage = recipeId === 'lift_cell'
    ? 'hull_sealed'
    : recipeId === 'logic_wafer'
      ? 'lift_online'
      : recipeId === 'habitat_core'
        ? 'flight_ready'
        : null;
  if (requiredRepairStage) {
    const currentStage = effectiveShipRepairStage(playerState.progression, context);
    if (currentStage === 'wrecked'
      || SHIP_REPAIR_STAGE_ORDER.indexOf(currentStage) < SHIP_REPAIR_STAGE_ORDER.indexOf(requiredRepairStage)) {
      return {
        code: 'validation_failed',
        reason: `${recipeId} knowledge requires ship repair stage ${requiredRepairStage}.`
      };
    }
  }
  if (recipeId === 'habitat_core' && context?.worldId !== TIDEGARDEN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Habitat Core fabrication belongs to Tidegarden settlement.' };
  }
  const eventPayload = canonicalRecipePayload(recipeDef);
  let progression: ServerProgressionState | undefined;
  if (recipeDef.uniqueReceipt) {
    const commandReceipt = uniqueRecipeCommandReceipt(recipeId, context);
    if (!commandReceipt) {
      return { code: 'validation_failed', reason: 'Unique recipe requires a stable command id and world.' };
    }
    const milestones = new Set(playerState.progression.milestones);
    if (milestones.has(recipeDef.uniqueReceipt) && !milestones.has(commandReceipt)) {
      return { code: 'validation_failed', reason: 'Unique recipe was already crafted.' };
    }
    progression = advanceProgression(playerState.progression, recipeDef.era, recipeDef.uniqueReceipt);
    progression = advanceProgression(progression, recipeDef.era, commandReceipt);
  }
  return {
    commandPayload: eventPayload,
    events: [{ type: 'recipe_crafted', payload: eventPayload }],
    debit: recipeDef.inputs,
    credit: recipeDef.outputs,
    ...(progression ? { playerStatePatch: { progression } } : {})
  };
}

function uniqueRecipeCommandReceipt(
  recipeId: string,
  context: AuthoritativeCommandContext | undefined
): string | null {
  if (!context?.commandId || !context.worldId) return null;
  const digest = createHash('sha256')
    .update(`${context.worldId.length}:${context.worldId}:${context.commandId.length}:${context.commandId}`)
    .digest('hex');
  return `story:tx:recipe:${recipeId}:${digest}`;
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

function resolveMawRepairBegun(
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== MAW_REPAIR_ORIGIN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Maw repair ritual belongs to the origin world.' };
  }
  if (!context.commandId || !context.playerId) {
    return { code: 'validation_failed', reason: 'Maw repair ritual requires an authenticated receipt.' };
  }
  const existing = findMawRepairBeginReceipt(context.commandId, context);
  if (playerState.progression.milestones.includes('maw_repaired') && !existing) {
    return { code: 'validation_failed', reason: 'Maw is already repaired.' };
  }
  const eventPayload = {
    ritualBeginCommandId: context.commandId,
    ritualSeconds: ECONOMY_CATALOG.storyTransactions.mawRepair.ritualSeconds
  };
  return {
    commandPayload: {},
    events: [{ type: 'maw_repair_begun', payload: eventPayload }],
    debit: [],
    credit: []
  };
}

function resolveMawRepaired(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== MAW_REPAIR_ORIGIN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Maw repair belongs to the origin world.' };
  }
  const ritualBeginCommandId = readString(payload.ritualBeginCommandId);
  if (!ritualBeginCommandId) {
    return { code: 'validation_failed', reason: 'Maw repair requires an accepted ritual-begun receipt.' };
  }
  const receipt = findMawRepairBeginReceipt(ritualBeginCommandId, context);
  if (!receipt) {
    return { code: 'validation_failed', reason: 'Maw repair requires an accepted ritual-begun receipt.' };
  }
  const serverTimeMs = context?.serverTimeMs;
  if (!Number.isFinite(serverTimeMs) || !Number.isFinite(receipt.timeMs)) {
    return { code: 'validation_failed', reason: 'Maw repair attendance requires server time.' };
  }
  if ((serverTimeMs as number) - (receipt.timeMs as number) < MAW_REPAIR_MIN_ATTENDANCE_MS) {
    return { code: 'validation_failed', reason: 'Maw repair ritual attendance is not complete.' };
  }
  const transaction = ECONOMY_CATALOG.storyTransactions.mawRepair;
  const eventPayload = {
    ritualBeginCommandId,
    minimumAttendanceMs: MAW_REPAIR_MIN_ATTENDANCE_MS
  };
  return {
    commandPayload: { ritualBeginCommandId },
    events: [{ type: 'maw_repaired', payload: eventPayload }],
    debit: transaction.inputs.map(stack => ({ ...stack })),
    credit: transaction.outputs.map(stack => ({ ...stack })),
    playerStatePatch: {
      mawCharge: 0,
      exhausted: playerState.exhausted,
      progression: advanceProgression(playerState.progression, 'emergent', 'maw_repaired')
    }
  };
}

function findMawRepairBeginReceipt(
  ritualBeginCommandId: string,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeWorldEvent | null {
  if (!context?.playerId) return null;
  for (let index = (context.worldEvents?.length ?? 0) - 1; index >= 0; index--) {
    const event = context.worldEvents?.[index];
    if (
      event?.type === 'maw_repair_begun'
      && event.commandId === ritualBeginCommandId
      && event.playerId === context.playerId
      && event.payload.ritualBeginCommandId === ritualBeginCommandId
      && event.payload.ritualSeconds === ECONOMY_CATALOG.storyTransactions.mawRepair.ritualSeconds
    ) return event;
  }
  return null;
}

type MawFirstDirectionChoice = 'lowered-and-listened' | 'harmless-test';

function resolveMawFirstDirection(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const authorityError = mawStoryAuthorityContextError(context, 'Maw first direction');
  if (authorityError) return authorityError;
  const choice = readMawFirstDirectionChoice(payload.choice);
  if (!choice) {
    return { code: 'validation_failed', reason: 'Maw first direction requires a canonical choice.' };
  }
  const existing = findActorCommandEvent('maw_first_direction_resolved', context!.commandId, context);
  if (existing) {
    if (existing.payload.choice !== choice) {
      return { code: 'validation_failed', reason: 'Maw first direction receipt choice does not match.' };
    }
    return mawFirstDirectionResolution(
      choice,
      readString(existing.payload.repairCommandId),
      readString(existing.payload.proofCommandId),
      readString(existing.payload.targetKind),
      playerState,
      context
    );
  }
  if (!playerState.progression.milestones.includes('maw_repaired')) {
    return { code: 'validation_failed', reason: 'Repair the Maw before assigning its first direction.' };
  }
  const repairReceipt = findLatestActorEvent('maw_repaired', context);
  if (!repairReceipt?.commandId || !Number.isFinite(repairReceipt.timeMs)) {
    return { code: 'validation_failed', reason: 'Maw first direction requires an accepted repair receipt.' };
  }
  if ((context!.serverTimeMs as number) - (repairReceipt.timeMs as number) < MAW_PURPOSE_GAP_MIN_MS) {
    return { code: 'validation_failed', reason: 'Maw purpose gap is not complete.' };
  }
  let proofCommandId: string | null = null;
  let targetKind = 'unassigned';
  if (choice === 'harmless-test') {
    const proof = findLatestAcceptedMawMine((repairReceipt.timeMs as number) + MAW_PURPOSE_GAP_MIN_MS, context);
    const proofBlockId = readString(proof?.payload.blockId);
    if (
      !proof?.commandId
      || !proofBlockId
    ) {
      return {
        code: 'validation_failed',
        reason: 'Maw harmless test requires an accepted safe-block mine receipt from the repaired Maw.'
      };
    }
    proofCommandId = proof.commandId;
    targetKind = proofBlockId;
  }
  return mawFirstDirectionResolution(
    choice,
    repairReceipt.commandId,
    proofCommandId,
    targetKind,
    playerState,
    context
  );
}

function mawFirstDirectionResolution(
  choice: MawFirstDirectionChoice,
  repairCommandId: string | null,
  proofCommandId: string | null,
  targetKind: string | null,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (!repairCommandId) {
    return { code: 'validation_failed', reason: 'Maw first direction requires an accepted repair receipt.' };
  }
  if (
    choice === 'harmless-test'
    && (!proofCommandId || !targetKind || !MAW_HARMLESS_TEST_BLOCK_IDS.has(targetKind))
  ) {
    return { code: 'validation_failed', reason: 'Maw harmless-test receipt is malformed.' };
  }
  if (choice === 'lowered-and-listened' && targetKind !== 'unassigned') {
    return { code: 'validation_failed', reason: 'Maw lowered direction receipt is malformed.' };
  }
  const branchMilestone = `story:maw:first-direction:${choice}`;
  if (
    playerState.progression.milestones.includes(MAW_FIRST_DIRECTION_MILESTONE)
    && !playerState.progression.milestones.includes(branchMilestone)
  ) {
    return { code: 'validation_failed', reason: 'Maw first direction was already resolved differently.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    MAW_FIRST_DIRECTION_MILESTONE,
    'maw-first-direction',
    context,
    [branchMilestone]
  );
  if ('code' in progression) return progression;
  const eventPayload = {
    choice,
    repairCommandId,
    proofCommandId,
    targetKind,
    minimumPurposeGapMs: MAW_PURPOSE_GAP_MIN_MS
  };
  return {
    commandPayload: { choice },
    events: [{ type: 'maw_first_direction_resolved', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: { progression }
  };
}

function resolveMawPondObservationBegun(
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const authorityError = mawStoryAuthorityContextError(context, 'Maw pond observation');
  if (authorityError) return authorityError;
  const existing = findActorCommandEvent('maw_pond_observation_begun', context!.commandId, context);
  if (existing) {
    const existingPayload = canonicalPondObservationBeginPayload(existing.payload);
    if (!existingPayload) {
      return { code: 'validation_failed', reason: 'Maw pond observation receipt is malformed.' };
    }
    return {
      commandPayload: {},
      events: [{ type: 'maw_pond_observation_begun', payload: existingPayload }],
      debit: [],
      credit: []
    };
  }
  if (playerState.progression.milestones.includes(MAW_POND_RESONANCE_MILESTONE)) {
    return { code: 'validation_failed', reason: 'Maw pond resonance was already observed.' };
  }
  if (!playerState.progression.milestones.includes(MAW_FIRST_DIRECTION_MILESTONE)) {
    return { code: 'validation_failed', reason: 'Resolve the Maw first direction before observing the pond.' };
  }
  const directionReceipt = findLatestActorEvent('maw_first_direction_resolved', context);
  if (!directionReceipt?.commandId) {
    return { code: 'validation_failed', reason: 'Maw pond observation requires an accepted first-direction receipt.' };
  }
  const pose = freshAuthenticatedPose(context);
  if ('code' in pose) return pose;
  const eventPayload = {
    observationBeginCommandId: context!.commandId,
    directionCommandId: directionReceipt.commandId,
    poseSeq: pose.seq,
    maximumPoseAgeMs: MAW_POSE_MAX_AGE_MS,
    minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
    physicalProximityCertified: false
  };
  return {
    commandPayload: {},
    events: [{ type: 'maw_pond_observation_begun', payload: eventPayload }],
    debit: [],
    credit: []
  };
}

function resolveMawPondResonanceObserved(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const authorityError = mawStoryAuthorityContextError(context, 'Maw pond resonance');
  if (authorityError) return authorityError;
  const observationBeginCommandId = readString(payload.observationBeginCommandId);
  if (!observationBeginCommandId) {
    return { code: 'validation_failed', reason: 'Maw pond resonance requires an accepted observation-begun receipt.' };
  }
  const existing = findActorCommandEvent('maw_pond_resonance_observed', context!.commandId, context);
  if (existing) {
    if (existing.payload.observationBeginCommandId !== observationBeginCommandId) {
      return { code: 'validation_failed', reason: 'Maw pond resonance receipt does not match its observation.' };
    }
    return mawPondResonanceResolution(existing.payload, playerState, context);
  }
  if (!playerState.progression.milestones.includes(MAW_FIRST_DIRECTION_MILESTONE)) {
    return { code: 'validation_failed', reason: 'Resolve the Maw first direction before pond resonance.' };
  }
  const observationReceipt = findActorCommandEvent(
    'maw_pond_observation_begun',
    observationBeginCommandId,
    context
  );
  const observation = observationReceipt
    ? canonicalPondObservationBeginPayload(observationReceipt.payload)
    : null;
  if (!observationReceipt || !observation) {
    return { code: 'validation_failed', reason: 'Maw pond resonance requires an accepted observation-begun receipt.' };
  }
  if (!Number.isFinite(observationReceipt.timeMs)) {
    return { code: 'validation_failed', reason: 'Maw pond observation requires server time.' };
  }
  if (
    (context!.serverTimeMs as number) - (observationReceipt.timeMs as number)
    < MAW_POND_OBSERVATION_MIN_MS
  ) {
    return { code: 'validation_failed', reason: 'Maw pond observation hold is not complete.' };
  }
  const pose = freshAuthenticatedPose(context);
  if ('code' in pose) return pose;
  if (pose.seq < observation.poseSeq) {
    return { code: 'validation_failed', reason: 'Maw pond observation requires a current authenticated pose.' };
  }
  return mawPondResonanceResolution({
    observationBeginCommandId,
    directionCommandId: observation.directionCommandId,
    beginPoseSeq: observation.poseSeq,
    completionPoseSeq: pose.seq,
    minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
    physicalProximityCertified: false
  }, playerState, context);
}

function mawPondResonanceResolution(
  rawEventPayload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const observationBeginCommandId = readString(rawEventPayload.observationBeginCommandId);
  const directionCommandId = readString(rawEventPayload.directionCommandId);
  const beginPoseSeq = readInt(rawEventPayload.beginPoseSeq);
  const completionPoseSeq = readInt(rawEventPayload.completionPoseSeq);
  if (!observationBeginCommandId || !directionCommandId || beginPoseSeq === null || completionPoseSeq === null) {
    return { code: 'validation_failed', reason: 'Maw pond resonance receipt is malformed.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    MAW_POND_RESONANCE_MILESTONE,
    'maw-pond-resonance',
    context
  );
  if ('code' in progression) return progression;
  const eventPayload = {
    observationBeginCommandId,
    directionCommandId,
    beginPoseSeq,
    completionPoseSeq,
    minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
    physicalProximityCertified: false
  };
  return {
    commandPayload: { observationBeginCommandId },
    events: [{ type: 'maw_pond_resonance_observed', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: { progression }
  };
}

function mawStoryAuthorityContextError(
  context: AuthoritativeCommandContext | undefined,
  label: string
): AuthoritativeCommandError | null {
  if (context?.worldId !== MAW_REPAIR_ORIGIN_WORLD_ID) {
    return { code: 'validation_failed', reason: `${label} belongs to the origin world.` };
  }
  if (!context.commandId || !context.playerId) {
    return { code: 'validation_failed', reason: `${label} requires an authenticated actor receipt.` };
  }
  if (!Number.isFinite(context.serverTimeMs)) {
    return { code: 'validation_failed', reason: `${label} requires server time.` };
  }
  return null;
}

function freshAuthenticatedPose(
  context: AuthoritativeCommandContext | undefined
): { seq: number } | AuthoritativeCommandError {
  const pose = context?.authenticatedPose;
  const serverTimeMs = context?.serverTimeMs;
  if (
    !pose
    || pose.playerId !== context?.playerId
    || pose.worldId !== context.worldId
    || !Number.isInteger(pose.seq)
    || pose.seq < 0
    || !Number.isFinite(pose.receivedAtMs)
    || !Number.isFinite(serverTimeMs)
    || (serverTimeMs as number) < pose.receivedAtMs
    || (serverTimeMs as number) - pose.receivedAtMs > MAW_POSE_MAX_AGE_MS
  ) {
    return { code: 'validation_failed', reason: 'Maw pond observation requires a fresh authenticated pose.' };
  }
  return { seq: pose.seq };
}

function findActorCommandEvent(
  type: string,
  commandId: string,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeWorldEvent | null {
  if (!context?.playerId) return null;
  for (let index = (context.worldEvents?.length ?? 0) - 1; index >= 0; index--) {
    const event = context.worldEvents?.[index];
    if (event?.type === type && event.commandId === commandId && event.playerId === context.playerId) {
      return event;
    }
  }
  return null;
}

function findLatestActorEvent(
  type: string,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeWorldEvent | null {
  if (!context?.playerId) return null;
  for (let index = (context.worldEvents?.length ?? 0) - 1; index >= 0; index--) {
    const event = context.worldEvents?.[index];
    if (event?.type === type && event.playerId === context.playerId) return event;
  }
  return null;
}

function findLatestAcceptedMawMine(
  notBeforeMs: number,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeWorldEvent | null {
  if (!context?.playerId) return null;
  for (let index = (context.worldEvents?.length ?? 0) - 1; index >= 0; index--) {
    const event = context.worldEvents?.[index];
    const blockId = readString(event?.payload.blockId);
    if (
      event?.type === 'voxel_mined'
      && event.playerId === context.playerId
      && Boolean(event.commandId)
      && Number.isFinite(event.timeMs)
      && (event.timeMs as number) >= notBeforeMs
      && event.payload.toolId === 'iron_maw'
      && Boolean(blockId && MAW_HARMLESS_TEST_BLOCK_IDS.has(blockId))
    ) return event;
  }
  return null;
}

interface CanonicalPondObservationBeginPayload extends JsonObject {
  observationBeginCommandId: string;
  directionCommandId: string;
  poseSeq: number;
  maximumPoseAgeMs: number;
  minimumObservationMs: number;
  physicalProximityCertified: false;
}

function canonicalPondObservationBeginPayload(
  payload: JsonObject
): CanonicalPondObservationBeginPayload | null {
  const observationBeginCommandId = readString(payload.observationBeginCommandId);
  const directionCommandId = readString(payload.directionCommandId);
  const poseSeq = readInt(payload.poseSeq);
  if (
    !observationBeginCommandId
    || !directionCommandId
    || poseSeq === null
    || payload.maximumPoseAgeMs !== MAW_POSE_MAX_AGE_MS
    || payload.minimumObservationMs !== MAW_POND_OBSERVATION_MIN_MS
    || payload.physicalProximityCertified !== false
  ) return null;
  return {
    observationBeginCommandId,
    directionCommandId,
    poseSeq,
    maximumPoseAgeMs: MAW_POSE_MAX_AGE_MS,
    minimumObservationMs: MAW_POND_OBSERVATION_MIN_MS,
    physicalProximityCertified: false
  };
}

function readMawFirstDirectionChoice(value: unknown): MawFirstDirectionChoice | null {
  return value === 'lowered-and-listened' || value === 'harmless-test' ? value : null;
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

function resolveShipRepairStage(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const requestedStage = readString(payload.stage);
  const transaction = requestedStage
    ? SHIP_REPAIR_STAGE_TRANSACTIONS.find(candidate => candidate.stage === requestedStage)
    : undefined;
  if (!transaction) {
    return { code: 'validation_failed', reason: 'Unknown ship repair stage.' };
  }

  const receipt = shipRepairReceipt(transaction.stage, context);
  if (!receipt) {
    return { code: 'validation_failed', reason: 'Ship repair requires a stable command id and world.' };
  }

  const stageMilestone = shipRepairStageMilestone(transaction.stage);
  const milestones = new Set(playerState.progression.milestones);
  const targetIndex = SHIP_REPAIR_STAGE_ORDER.indexOf(transaction.stage);
  const canonicalFrom: ServerShipRestorationStage = targetIndex === 0
    ? 'wrecked'
    : SHIP_REPAIR_STAGE_ORDER[targetIndex - 1]!;

  // Stateful validation runs before command-cache/database replay detection.
  // The bounded receipt lets the exact original command resolve canonically at
  // any later stage, while a different command cannot repeat a completed one.
  if (milestones.has(stageMilestone) && milestones.has(receipt)) {
    return shipRepairStageResolution(transaction, canonicalFrom, playerState.progression);
  }

  const currentStage = context?.worldEvents
    ? currentShipRepairStageFromEvents(context.worldEvents)
    : currentShipRepairStage(playerState.progression);
  const currentIndex = currentStage === 'wrecked'
    ? -1
    : SHIP_REPAIR_STAGE_ORDER.indexOf(currentStage);
  const expectedStage = SHIP_REPAIR_STAGE_ORDER[currentIndex + 1] ?? null;
  if (expectedStage !== transaction.stage) {
    const expectation = expectedStage
      ? `${currentStage} to ${expectedStage}`
      : `${currentStage}; restoration is already complete`;
    return {
      code: 'validation_failed',
      reason: `Ship repair stage must advance from ${expectation}.`
    };
  }

  if (context?.worldEvents && transaction.stage === 'bench_online') {
    const hasSalvage = context.worldEvents.some(event => event.type === 'wreck_salvage_claimed');
    const hasBankedKeel = context.worldEvents.some(event => event.type === 'story_item_banked'
      && event.payload.itemId === 'kestrel_keel_memory');
    if (!hasSalvage || !hasBankedKeel) {
      return {
        code: 'validation_failed',
        reason: 'Workbench installation requires recovered salvage and a banked Keel Memory.'
      };
    }
  }

  let progression = advanceProgression(playerState.progression, 'emergent', stageMilestone);
  progression = advanceProgression(progression, 'emergent', receipt);
  return shipRepairStageResolution(transaction, currentStage, progression);
}

function shipRepairStageResolution(
  transaction: (typeof SHIP_REPAIR_STAGE_TRANSACTIONS)[number],
  from: ServerShipRestorationStage,
  progression: ServerProgressionState
): AuthoritativeCommandResolution {
  const eventPayload = { from, to: transaction.stage };
  // Flight readiness opens the party's one authored sibling-world route. Keep
  // that route in the same authoritative progression write as the accepted
  // stage (and repair it on an exact replay of a pre-route save).
  const resolvedProgression = transaction.stage === 'flight_ready'
    ? advanceProgression(progression, 'emergent', TIDEGARDEN_ROUTE_MILESTONE)
    : progression;
  return {
    commandPayload: { stage: transaction.stage },
    events: [{ type: 'ship_repair_stage', payload: eventPayload }],
    debit: transaction.inputs.map(stack => ({ ...stack })),
    credit: [],
    playerStatePatch: { progression: resolvedProgression },
    structureClaims: [storyClaim(
      `story:ship-repair:${transaction.stage}`,
      'ship_repair_stage',
      { stage: transaction.stage }
    )]
  };
}

function currentShipRepairStageFromEvents(
  events: readonly AuthoritativeWorldEvent[]
): ServerShipRestorationStage {
  let current: ServerShipRestorationStage = 'wrecked';
  for (const event of events) {
    if (event.type !== 'ship_repair_stage') continue;
    const target = readString(event.payload.to);
    const expected = SHIP_REPAIR_STAGE_ORDER[
      current === 'wrecked' ? 0 : SHIP_REPAIR_STAGE_ORDER.indexOf(current) + 1
    ];
    if (target === expected) current = target as ServerShipRepairStage;
  }
  return current;
}

function currentShipRepairStage(progression: ServerProgressionState): ServerShipRestorationStage {
  const milestones = new Set(progression.milestones);
  let current: ServerShipRestorationStage = 'wrecked';
  for (const stage of SHIP_REPAIR_STAGE_ORDER) {
    if (!milestones.has(shipRepairStageMilestone(stage))) break;
    current = stage;
  }
  return current;
}

function effectiveShipRepairStage(
  progression: ServerProgressionState,
  context: AuthoritativeCommandContext | undefined
): ServerShipRestorationStage {
  const actorStage = currentShipRepairStage(progression);
  const sharedStage = context?.sharedShipRepairStage ?? 'wrecked';
  const actorIndex = actorStage === 'wrecked' ? -1 : SHIP_REPAIR_STAGE_ORDER.indexOf(actorStage);
  const sharedIndex = sharedStage === 'wrecked' ? -1 : SHIP_REPAIR_STAGE_ORDER.indexOf(sharedStage);
  return sharedIndex > actorIndex ? sharedStage : actorStage;
}

function shipRepairStageMilestone(stage: ServerShipRepairStage): string {
  return `ship_repair:${stage}`;
}

function shipRepairReceipt(
  stage: ServerShipRepairStage,
  context: AuthoritativeCommandContext | undefined
): string | null {
  if (!context?.commandId || !context.worldId) return null;
  const digest = createHash('sha256')
    .update(`${context.worldId.length}:${context.worldId}:${context.commandId.length}:${context.commandId}`)
    .digest('hex');
  return `story:tx:ship-repair:${stage}:${digest}`;
}

function resolveStoryItemAcquired(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const itemId = readString(payload.itemId);
  if (itemId !== 'maw_repair_kit' && itemId !== 'kestrel_keel_memory') {
    return { code: 'validation_failed', reason: 'Unknown authored story item.' };
  }
  const milestone = STORY_ITEM_MILESTONES[itemId];
  const progression = storyReceiptProgression(
    playerState.progression,
    milestone,
    `story-item:${itemId}`,
    context
  );
  if ('code' in progression) return progression;
  return {
    commandPayload: { itemId },
    events: [{ type: 'story_item_acquired', payload: { itemId } }],
    debit: [],
    credit: [{ id: itemId, qty: 1 }],
    playerStatePatch: { progression }
  };
}

function resolveStoryItemBanked(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const itemId = readString(payload.itemId);
  if (itemId !== 'kestrel_keel_memory') {
    return { code: 'validation_failed', reason: 'Only the Keel Memory has a bank transaction.' };
  }
  if (!playerState.progression.milestones.includes(STORY_ITEM_MILESTONES.kestrel_keel_memory)) {
    return { code: 'validation_failed', reason: 'Keel Memory must be acquired before it can be banked.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    KEEL_BANKED_MILESTONE,
    'story-item:kestrel-keel-memory:banked',
    context
  );
  if ('code' in progression) return progression;
  const oxygen = clamp(readFiniteNumber(payload.oxygen) ?? 0, 0, MAX_VITAL);
  return {
    commandPayload: { itemId, oxygen },
    events: [{ type: 'story_item_banked', payload: { itemId, oxygen } }],
    debit: [{ id: itemId, qty: 1 }],
    credit: [{ id: itemId, qty: 1 }],
    playerStatePatch: { progression }
  };
}

function resolveWreckSalvageClaimed(
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const progression = storyReceiptProgression(
    playerState.progression,
    WRECK_SALVAGE_MILESTONE,
    'wreck-salvage',
    context
  );
  if ('code' in progression) return progression;
  const outputs = ECONOMY_CATALOG.storyTransactions.wreckSalvage.map(stack => ({ ...stack }));
  return {
    commandPayload: { cacheId: 'kestrel-wreck' },
    events: [{ type: 'wreck_salvage_claimed', payload: { cacheId: 'kestrel-wreck', outputs } }],
    debit: [],
    credit: outputs,
    playerStatePatch: { progression },
    structureClaims: [storyClaim('story:wreck-salvage', 'wreck_salvage', { cacheId: 'kestrel-wreck' })]
  };
}

function resolveKestrelFoundingReserveClaimed(
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== TIDEGARDEN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'The founding reserve follows the Kestrel to Tidegarden.' };
  }
  if (effectiveShipRepairStage(playerState.progression, context) !== 'flight_ready') {
    return { code: 'validation_failed', reason: 'The founding reserve requires an authoritative flight-ready Kestrel.' };
  }
  // The ship is shared, while recipe receipts and inventory are actor-owned.
  // Adopt the already-authoritative party stage into this actor's reconnect
  // snapshot before granting their one finite Core BOM.
  let migratedProgression = playerState.progression;
  for (const stage of SHIP_REPAIR_STAGE_ORDER) {
    migratedProgression = advanceProgression(
      migratedProgression,
      'emergent',
      shipRepairStageMilestone(stage)
    );
  }
  const progression = storyReceiptProgression(
    migratedProgression,
    KESTREL_FOUNDING_RESERVE_MILESTONE,
    'kestrel-founding-reserve',
    context
  );
  if ('code' in progression) return progression;
  const outputs = ECONOMY_CATALOG.storyTransactions.kestrelFoundingReserve.map(stack => ({ ...stack }));
  return {
    commandPayload: { reserveId: 'tidegarden-founding-loadout' },
    events: [{
      type: 'kestrel_founding_reserve_claimed',
      payload: { reserveId: 'tidegarden-founding-loadout', outputs }
    }],
    debit: [],
    credit: outputs,
    playerStatePatch: { progression }
  };
}

function resolveTidegardenRelationshipAttended(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== TIDEGARDEN_WORLD_ID
    || readString(payload.relationshipId) !== 'tideline-root-water-exchange') {
    return { code: 'validation_failed', reason: 'Relationship proof does not belong to Tidegarden.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    TIDEGARDEN_RELATIONSHIP_MILESTONE,
    'tidegarden-relationship',
    context
  );
  if ('code' in progression) return progression;
  const waterDepth = readFiniteNumber(payload.waterDepth);
  if (waterDepth === null || waterDepth < 1) {
    return { code: 'validation_failed', reason: 'Relationship proof requires a real waterline.' };
  }
  const eventPayload = {
    relationshipId: 'tideline-root-water-exchange',
    waterDepth,
    sourceKey: 'deterministic-waterline'
  };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'tidegarden_relationship_attended', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: { progression }
  };
}

function resolveTidegardenSiteChosen(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const playerId = context?.playerId;
  if (context?.worldId !== TIDEGARDEN_WORLD_ID
    || !playerId
    || !playerState.progression.milestones.includes(TIDEGARDEN_RELATIONSHIP_MILESTONE)
    || !context.worldEvents?.some(event => (
      event.type === 'tidegarden_relationship_attended' && event.playerId === playerId
    ))) {
    return { code: 'validation_failed', reason: 'Attend a Tidegarden relationship before choosing a site.' };
  }
  const cell = readIntCoord(payload.cell);
  const supportCell = readIntCoord(payload.supportCell);
  const up = readAxisVector(payload.up);
  if (!cell || !supportCell || !up
    || !isTerrainCoordInBounds(cell)
    || !isCollectibleSurfaceCoordPlausible(supportCell)
    || !isOutwardSurfaceAxis(supportCell, up)
    || !sameIntCoord(cell, [
      supportCell[0] + up[0],
      supportCell[1] + up[1],
      supportCell[2] + up[2]
    ])) {
    return { code: 'validation_failed', reason: 'Tidegarden site choice proof is malformed or off-surface.' };
  }
  if (authoritativeStructurePieces(context.worldEvents).has(serverPanelKey(cell, VOLUME_FACE))) {
    return { code: 'validation_failed', reason: 'Tidegarden site choice is obstructed by an accepted volume piece.' };
  }
  const siteMilestone = `${TIDEGARDEN_SITE_CHOICE_PREFIX}${cell.join(',')}`
    + `|${supportCell.join(',')}|${up.join(',')}`;
  const previousChoice = playerState.progression.milestones.find(milestone => (
    milestone.startsWith(TIDEGARDEN_SITE_CHOICE_PREFIX)
  ));
  if (previousChoice && previousChoice !== siteMilestone) {
    return { code: 'validation_failed', reason: 'A different Tidegarden site was already chosen.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    siteMilestone,
    'tidegarden-site-chosen',
    context
  );
  if ('code' in progression) return progression;
  const eventPayload = {
    worldId: TIDEGARDEN_WORLD_ID,
    cell,
    supportCell,
    up
  };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'tidegarden_site_chosen', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: { progression }
  };
}

function resolveHabitatCorePlaced(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const playerId = context?.playerId;
  if (context?.worldId !== TIDEGARDEN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Habitat Core can only be installed on Tidegarden.' };
  }
  if (!playerId
    || !playerState.progression.milestones.includes(TIDEGARDEN_RELATIONSHIP_MILESTONE)
    || !context.worldEvents?.some(event => (
      event.type === 'tidegarden_relationship_attended' && event.playerId === playerId
    ))) {
    return { code: 'validation_failed', reason: 'Attend the Tidegarden relationship before installing the Core.' };
  }
  const shelterId = readString(payload.shelterId);
  const cell = readIntCoord(payload.cell);
  const supportCell = readIntCoord(payload.supportCell);
  const position = readVec3(payload.position);
  const up = readAxisVector(payload.up);
  if (!shelterId || !cell || !supportCell || !position || !up
    || shelterId !== `habitat:${TIDEGARDEN_WORLD_ID}:${cell.join(',')}`
    || !sameIntCoord(cell, [supportCell[0] + up[0], supportCell[1] + up[1], supportCell[2] + up[2]])) {
    return { code: 'validation_failed', reason: 'Habitat Core placement proof is malformed.' };
  }
  const siteChosen = context.worldEvents?.some(event => (
    event.type === 'tidegarden_site_chosen'
    && event.playerId === playerId
    && sameIntCoord(readIntCoord(event.payload.cell) ?? [Number.NaN, Number.NaN, Number.NaN], cell)
    && sameIntCoord(
      readIntCoord(event.payload.supportCell) ?? [Number.NaN, Number.NaN, Number.NaN],
      supportCell
    )
    && sameIntCoord(readAxisVector(event.payload.up) ?? [Number.NaN, Number.NaN, Number.NaN], up)
  ));
  if (!siteChosen) {
    return { code: 'validation_failed', reason: 'Habitat Core requires an accepted Tidegarden site choice.' };
  }
  const siteMilestone = `${TIDEGARDEN_SITE_CHOICE_PREFIX}${cell.join(',')}`
    + `|${supportCell.join(',')}|${up.join(',')}`;
  if (!playerState.progression.milestones.includes(siteMilestone)) {
    return { code: 'validation_failed', reason: 'Habitat Core requires the actor\'s accepted Tidegarden site choice.' };
  }
  const structurePieces = authoritativeStructurePieces(context.worldEvents);
  const upFace = faceForAxisVector(up);
  const foundation = upFace === null
    ? undefined
    : structurePieces.get(serverPanelKey(cell, upFace ^ 1));
  if (foundation?.type !== 'foundation') {
    return { code: 'validation_failed', reason: 'Habitat Core requires an accepted foundation at the site.' };
  }
  if (structurePieces.has(serverPanelKey(cell, VOLUME_FACE))) {
    return { code: 'validation_failed', reason: 'Habitat Core site is obstructed by an accepted volume piece.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    HABITAT_CORE_ONLINE_MILESTONE,
    'habitat-core-online',
    context,
    [HABITAT_CORE_RECIPE_RECEIPT]
  );
  if ('code' in progression) return progression;
  const canonicalPosition: [number, number, number] = [
    cell[0] * 2 + up[0] * 0.24,
    cell[1] * 2 + up[1] * 0.24,
    cell[2] * 2 + up[2] * 0.24
  ];
  const eventPayload = { shelterId, cell, supportCell, position: canonicalPosition, up };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'habitat_core_placed', payload: eventPayload }],
    debit: [{ id: 'habitat_core', qty: 1 }],
    credit: [],
    playerStatePatch: { progression },
    structureClaims: [storyClaim('story:habitat-core', 'habitat_core', eventPayload, cell)]
  };
}

function resolveHabitatShelterCertified(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== TIDEGARDEN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Shelter certification belongs to Tidegarden.' };
  }
  const playerId = context.playerId;
  if (!playerId || !playerState.progression.milestones.includes(HABITAT_CORE_ONLINE_MILESTONE)) {
    return { code: 'validation_failed', reason: 'Install the Habitat Core before certifying its shelter.' };
  }
  const core = latestWorldEventForPlayer(context.worldEvents, 'habitat_core_placed', playerId);
  const shelterId = readString(payload.shelterId);
  const cell = readIntCoord(payload.cell);
  const requestedInsulation = readFiniteNumber(payload.insulation);
  const requestedInteriorCellCount = readPositiveInt(payload.interiorCellCount);
  if (!core || !shelterId || shelterId !== core.payload.shelterId || !cell
    || !sameIntCoord(cell, readIntCoord(core.payload.cell) ?? [Number.NaN, Number.NaN, Number.NaN])
    || requestedInsulation === null || requestedInsulation < 0 || requestedInteriorCellCount === null) {
    return { code: 'validation_failed', reason: 'Shelter certification does not match the installed Core.' };
  }
  const shelter = analyzeAuthoritativeShelter(cell, context.worldEvents);
  if (!shelter) {
    return { code: 'validation_failed', reason: 'Shelter certification requires a sealed accepted enclosure.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    HABITAT_SHELTER_MILESTONE,
    'habitat-shelter-certified',
    context
  );
  if ('code' in progression) return progression;
  const eventPayload = {
    shelterId,
    cell,
    insulation: shelter.insulation,
    interiorCellCount: shelter.interiorCellCount
  };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'habitat_shelter_certified', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: { progression },
    structureClaims: [storyClaim('story:habitat-shelter-certified', 'habitat_shelter', eventPayload, cell)]
  };
}

function resolveHabitatSafeRestCompleted(
  payload: JsonObject,
  playerState: ServerPlayerState,
  context: AuthoritativeCommandContext | undefined
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  if (context?.worldId !== TIDEGARDEN_WORLD_ID) {
    return { code: 'validation_failed', reason: 'Safe-rest receipt belongs to Tidegarden.' };
  }
  const playerId = context.playerId;
  if (!playerId || !playerState.progression.milestones.includes(HABITAT_SHELTER_MILESTONE)) {
    return { code: 'validation_failed', reason: 'Certify the Habitat shelter before resting.' };
  }
  const certification = latestWorldEventForPlayer(
    context.worldEvents,
    'habitat_shelter_certified',
    playerId
  );
  const shelterId = readString(payload.shelterId);
  const requestedDayPhase = readFiniteNumber(payload.dayPhase);
  const dayPhase = context?.worldTimeMs === undefined
    ? null
    : ((context.worldTimeMs % WORLD_DAY_LENGTH_MS) + WORLD_DAY_LENGTH_MS) % WORLD_DAY_LENGTH_MS
      / WORLD_DAY_LENGTH_MS;
  if (!certification || !shelterId || shelterId !== certification.payload.shelterId
    || requestedDayPhase === null || dayPhase === null || dayPhase < 0.55 || dayPhase > 0.95) {
    return { code: 'validation_failed', reason: 'Safe rest requires the certified shelter during local night.' };
  }
  const core = latestWorldEventForPlayer(context.worldEvents, 'habitat_core_placed', playerId);
  const coreCell = readIntCoord(core?.payload.cell);
  if (!coreCell || !analyzeAuthoritativeShelter(coreCell, context.worldEvents)) {
    return { code: 'validation_failed', reason: 'Safe rest requires the accepted enclosure to remain sealed.' };
  }
  const progression = storyReceiptProgression(
    playerState.progression,
    HABITAT_REST_MILESTONE,
    'habitat-safe-rest',
    context,
    [TWO_WORLD_HANDOFF_MILESTONE]
  );
  if ('code' in progression) return progression;
  const eventPayload = { shelterId, dayPhase };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'habitat_safe_rest_completed', payload: eventPayload }],
    debit: [],
    credit: [],
    playerStatePatch: {
      progression,
      vitals: { ...playerState.vitals, stamina: MAX_VITAL, warmth: MAX_VITAL },
      exhausted: false
    },
    structureClaims: [storyClaim('story:habitat-safe-rest', 'habitat_safe_rest', eventPayload)]
  };
}

function storyReceiptProgression(
  source: ServerProgressionState,
  milestone: string,
  kind: string,
  context: AuthoritativeCommandContext | undefined,
  additionalMilestones: readonly string[] = []
): ServerProgressionState | AuthoritativeCommandError {
  const receipt = storyCommandReceipt(kind, context);
  if (!receipt) {
    return { code: 'validation_failed', reason: 'Story transaction requires a stable command id and world.' };
  }
  const milestones = new Set(source.milestones);
  if (milestones.has(milestone)) {
    if (milestones.has(receipt)) return source;
    return { code: 'validation_failed', reason: 'Story transaction was already completed.' };
  }
  let progression = advanceProgression(source, 'emergent', milestone);
  progression = advanceProgression(progression, 'emergent', receipt);
  for (const additional of additionalMilestones) {
    progression = advanceProgression(progression, 'emergent', additional);
  }
  return progression;
}

function storyCommandReceipt(
  kind: string,
  context: AuthoritativeCommandContext | undefined
): string | null {
  if (!context?.commandId || !context.worldId) return null;
  const digest = createHash('sha256')
    .update(`${context.worldId.length}:${context.worldId}:${context.commandId.length}:${context.commandId}`)
    .digest('hex');
  return `story:tx:${kind}:${digest}`;
}

function storyClaim(
  structureId: string,
  structureType: string,
  state: JsonObject,
  cell: [number, number, number] = [0, 0, 0]
): AuthoritativeStructureClaim {
  return {
    mode: 'insert',
    structureId,
    cell,
    face: VOLUME_FACE,
    structureType,
    material: 'story',
    state
  };
}

function latestWorldEventForPlayer(
  events: readonly AuthoritativeWorldEvent[] | undefined,
  type: string,
  playerId: string
): AuthoritativeWorldEvent | null {
  if (!events) return null;
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event?.type === type && event.playerId === playerId) return event;
  }
  return null;
}

interface AuthoritativeStructurePiece {
  cell: [number, number, number];
  face: number;
  type: string;
  material: string;
  open?: boolean;
  leaf?: boolean;
  partnerKey?: string;
}

interface AuthoritativeShelterAnalysis {
  insulation: number;
  interiorCellCount: number;
}

/** Rebuild the accepted structure surface from the shard audit log. Story
 * physical proofs are checked against this projection, never against the
 * client's claimed panel count or insulation. */
function authoritativeStructurePieces(
  events: readonly AuthoritativeWorldEvent[] | undefined
): Map<string, AuthoritativeStructurePiece> {
  const pieces = new Map<string, AuthoritativeStructurePiece>();
  for (const event of events ?? []) {
    const cell = readIntCoord(event.payload.cell);
    const face = readInt(event.payload.face);
    if (!cell || face === null || face < 0 || face > VOLUME_FACE) continue;
    const key = serverPanelKey(cell, face);

    if (event.type === 'structure_removed') {
      const removed = pieces.get(key);
      pieces.delete(key);
      if (removed?.partnerKey) pieces.delete(removed.partnerKey);
      continue;
    }
    if (event.type === 'door_toggled') {
      const piece = pieces.get(key);
      if (piece && typeof event.payload.open === 'boolean') piece.open = event.payload.open;
      continue;
    }
    if (event.type !== 'structure_placed') continue;

    const type = readString(event.payload.type);
    const material = readString(event.payload.material);
    if (!type || !material || !BUILD_PIECES[type] || !BUILD_MATERIALS[material]) continue;
    if (type === 'door') {
      const doorway = pieces.get(key);
      if (doorway?.type === 'doorway') {
        doorway.leaf = true;
        doorway.open = false;
      }
      continue;
    }

    const piece: AuthoritativeStructurePiece = { cell, face, type, material };
    pieces.set(key, piece);
    const up = readFaceIndex(event.payload.up);
    if ((BUILD_PIECES[type].heightUnits ?? 1) > 1 && up !== null) {
      const direction = FACE_DIRS[up];
      const upper: [number, number, number] = [
        cell[0] + direction[0],
        cell[1] + direction[1],
        cell[2] + direction[2]
      ];
      const upperKey = serverPanelKey(upper, face);
      piece.partnerKey = upperKey;
      pieces.set(upperKey, {
        ...piece,
        cell: upper,
        partnerKey: key
      });
    }
  }
  return pieces;
}

function analyzeAuthoritativeShelter(
  cell: [number, number, number],
  events: readonly AuthoritativeWorldEvent[] | undefined
): AuthoritativeShelterAnalysis | null {
  const allPieces = authoritativeStructurePieces(events);
  const facePieces = [...allPieces.values()].filter(piece => (
    piece.face >= 0 && piece.face < FACE_DIRS.length
    && Math.abs(piece.cell[0] - cell[0]) <= LOCAL_SHELTER_STRUCTURE_RADIUS
    && Math.abs(piece.cell[1] - cell[1]) <= LOCAL_SHELTER_STRUCTURE_RADIUS
    && Math.abs(piece.cell[2] - cell[2]) <= LOCAL_SHELTER_STRUCTURE_RADIUS
  ));
  if (facePieces.length < FACE_DIRS.length) return null;

  const mins: [number, number, number] = [Infinity, Infinity, Infinity];
  const maxs: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const piece of facePieces) {
    for (let axis = 0; axis < 3; axis++) {
      mins[axis] = Math.min(mins[axis], piece.cell[axis]);
      maxs[axis] = Math.max(maxs[axis], piece.cell[axis]);
    }
  }
  for (let axis = 0; axis < 3; axis++) {
    if (maxs[axis] - mins[axis] > MAX_SHELTER_AXIS_SPAN) return null;
    mins[axis] -= 1;
    maxs[axis] += 1;
    if (cell[axis] < mins[axis] || cell[axis] > maxs[axis]) return null;
  }

  const panels = new Map<string, AuthoritativeStructurePiece>();
  for (const piece of facePieces) {
    if (isAuthoritativeShelterSeal(piece)) panels.set(serverPanelKey(piece.cell, piece.face), piece);
  }

  const queue: Array<[number, number, number]> = [cell];
  const visited = new Set<string>([serverCellKey(cell)]);
  let insulationTotal = 0;
  let insulationFaces = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (visited.size > MAX_SHELTER_VISITED_CELLS) return null;
    const current = queue[cursor];
    for (let face = 0; face < FACE_DIRS.length; face++) {
      const direction = FACE_DIRS[face];
      const next: [number, number, number] = [
        current[0] + direction[0],
        current[1] + direction[1],
        current[2] + direction[2]
      ];
      const sealedBy = panels.get(serverPanelKey(current, face))
        ?? panels.get(serverPanelKey(next, face ^ 1));
      if (sealedBy) {
        const piece = BUILD_PIECES[sealedBy.type];
        const material = BUILD_MATERIALS[sealedBy.material];
        insulationTotal += piece.insulation * material.insulationMul;
        insulationFaces++;
        continue;
      }
      if (
        next[0] < mins[0] || next[0] > maxs[0]
        || next[1] < mins[1] || next[1] > maxs[1]
        || next[2] < mins[2] || next[2] > maxs[2]
      ) return null;
      const nextKey = serverCellKey(next);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push(next);
      }
    }
  }

  return {
    insulation: insulationFaces > 0 ? insulationTotal / insulationFaces : 0,
    interiorCellCount: visited.size
  };
}

function isAuthoritativeShelterSeal(piece: AuthoritativeStructurePiece): boolean {
  if (piece.type === 'doorway') return Boolean(piece.leaf) && !piece.open;
  const definition = BUILD_PIECES[piece.type];
  return definition.openable ? !piece.open : definition.seals;
}

function faceForAxisVector(vector: readonly [number, number, number]): number | null {
  const index = FACE_DIRS.findIndex(direction => sameIntCoord(direction, vector));
  return index >= 0 ? index : null;
}

/** Cube-world sites must use the outward normal of their dominant surface face. */
function isOutwardSurfaceAxis(
  supportCell: readonly [number, number, number],
  up: readonly [number, number, number]
): boolean {
  const axis = up.findIndex(component => component !== 0);
  if (axis < 0) return false;
  const dominant = Math.max(...supportCell.map(component => Math.abs(component)));
  return Math.abs(supportCell[axis] ?? 0) === dominant
    && Math.sign(supportCell[axis] ?? 0) === up[axis];
}

function serverCellKey(cell: readonly [number, number, number]): string {
  return `${cell[0]},${cell[1]},${cell[2]}`;
}

function serverPanelKey(cell: readonly [number, number, number], face: number): string {
  return `${serverCellKey(cell)}:${face}`;
}

function readAxisVector(value: unknown): [number, number, number] | null {
  const vector = readVec3(value);
  if (!vector || vector.some(component => !Number.isInteger(component))) return null;
  return Math.abs(vector[0]) + Math.abs(vector[1]) + Math.abs(vector[2]) === 1
    ? vector as [number, number, number]
    : null;
}

function sameIntCoord(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
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
      debit: authoritativeBuildCost(type, material),
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
  if ((piece.heightUnits ?? 1) > 1) {
    return resolveTallPanelPlaced(cell, panelFace, type, material, payload.up);
  }

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
    debit: authoritativeBuildCost(type, material),
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

function resolveTallPanelPlaced(
  cell: [number, number, number],
  face: number,
  type: string,
  material: string,
  rawUp: unknown
): AuthoritativeCommandResolution | AuthoritativeCommandError {
  const up = readFaceIndex(rawUp);
  if (up === null) return { code: 'validation_failed', reason: 'Two-cell panel placement requires up face 0..5.' };
  if (face === up || face === (up ^ 1)) {
    return { code: 'validation_failed', reason: 'Two-cell panel build-up must be perpendicular to its wall face.' };
  }
  const dir = FACE_DIRS[up];
  const upper: [number, number, number] = [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]];
  if (!isStructureCoordPlausible(upper)) {
    return { code: 'validation_failed', reason: 'Two-cell panel upper cell is outside plausible build bounds.' };
  }
  const eventPayload = { cell, face, type, material, up };
  return {
    commandPayload: eventPayload,
    events: [{ type: 'structure_placed', payload: eventPayload }],
    debit: authoritativeBuildCost(type, material),
    credit: [],
    structureClaims: [
      {
        mode: 'insert',
        structureId: structureId(cell, face),
        cell,
        face,
        structureType: type,
        material,
        state: { up, tall: 'lower', partner: upper }
      },
      {
        mode: 'insert',
        structureId: structureId(upper, face),
        cell: upper,
        face,
        structureType: type,
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
    debit: authoritativeBuildCost('door', material),
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
      const qty = deterministicRng(`resource_taken:tree:${worldId}:${coordKey(coord)}`).int(6, 8);
      return { commandPayload: { source, coord, id: 'wood', qty } };
    }
    case 'loose_stone': {
      const qty = deterministicRng(`resource_taken:loose_stone:${worldId}:${coordKey(coord)}`).int(1, 2);
      return { commandPayload: { source, coord, id: 'stone', qty } };
    }
    case 'forage': {
      const kind = readString(payload.kind);
      const deadwoodHere = isAuthoritativeDeadwoodNode(coord, worldId);
      if (kind === 'deadwood' && !deadwoodHere) {
        return { code: 'validation_failed', reason: 'Deadwood pickup does not match a deterministic surface node.' };
      }
      if (kind !== 'deadwood' && deadwoodHere) {
        return { code: 'validation_failed', reason: 'Forage kind does not match the deterministic surface node.' };
      }
      if (kind === 'root') return { commandPayload: { source, kind, coord, id: 'root', qty: 1 } };
      if (kind === 'deadwood') return { commandPayload: { source, kind, coord, id: 'wood', qty: 2 } };
      if (kind === 'berry') {
        const qty = deterministicRng(`resource_taken:forage:berry:${worldId}:${coordKey(coord)}`).int(1, 2);
        return { commandPayload: { source, kind, coord, id: 'berry', qty } };
      }
      return { code: 'validation_failed', reason: 'Forage pickup requires berry, root, or deadwood kind.' };
    }
    case 'flora': {
      const kind = readString(payload.kind);
      if (!kind || !isFloraKind(kind)) {
        return { code: 'validation_failed', reason: 'Flora harvest requires a known flora kind.' };
      }
      const drop = FLORA_DROPS[kind];
      const qty = deterministicRng(
        `resource_taken:flora:${kind}:${worldId}:${coordKey(coord)}`
      ).int(drop.yield[0], drop.yield[1]);
      return { commandPayload: { source, kind, coord, id: drop.id, qty } };
    }
    default:
      return { code: 'validation_failed', reason: 'Unknown resource pickup source.' };
  }
}

function seededVoxelUnit(
  x: number,
  y: number,
  z: number,
  salt: number,
  worldSeed: number
): number {
  let hash = Math.imul(x | 0, 374761393)
    ^ Math.imul(y | 0, 668265263)
    ^ Math.imul(z | 0, 2147483647)
    ^ Math.imul(salt | 0, 1013904223)
    ^ Math.imul(worldSeed | 0, 1597334677);
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function isFloraKind(value: string): value is FloraKind {
  return Object.prototype.hasOwnProperty.call(FLORA_DROPS, value);
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
      // The repaired Maw is the only tool identity currently used by a
      // server-owned story receipt. Every other client tool label is stripped
      // instead of becoming arbitrary world-event authority.
      toolId: payload.toolId === 'iron_maw' ? 'iron_maw' : null,
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

function canonicalRecipePayload(recipeDef: AuthoritativeRecipe): JsonObject {
  return {
    recipeId: recipeDef.id,
    inputs: recipeDef.inputs.map(stack => ({ ...stack })),
    outputs: recipeDef.outputs.map(stack => ({ ...stack }))
  };
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

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

export function authoritativeBuildCost(type: string, material: string): ItemStack[] {
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

const ERA_RANKS: Record<string, number> = {
  primitive: 0,
  emergent: 1,
  paravox_machina: 2
};

function advanceProgression(
  current: ServerProgressionState,
  targetEra: string,
  milestone: string
): ServerProgressionState {
  const currentRank = ERA_RANKS[current.era] ?? 0;
  const targetRank = ERA_RANKS[targetEra] ?? currentRank;
  const milestones = new Set(current.milestones.filter(id => typeof id === 'string' && id.length > 0));
  milestones.add(milestone);
  return {
    era: targetRank > currentRank ? targetEra : current.era,
    milestones: [...milestones].sort()
  };
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
