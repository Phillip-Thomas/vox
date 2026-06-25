import * as THREE from 'three';
import { commandAccepted, commandRejected, type CommandContext, type CommandResult } from './commands.ts';
import { createDomainEvent, type DomainEvent } from './events.ts';
import { LOCAL_ACTOR_ID, type ActorId } from './playerActors.ts';
import { createLocalSimulationRng, type SimulationRng } from './rng.ts';
import { worldIdentityFromCurrentWorld, type WorldIdentity } from './worldIdentity.ts';
import type { CurrentWorld } from '../utils/worldCoordinates.ts';
import type { BlockId } from './data/blocks.ts';
import type { ItemId } from './data/items.ts';
import { getItem } from './data/items.ts';
import type { Recipe } from './data/recipes.ts';
import type { ResourceDeposit } from './generation/resourceDeposits.ts';
import { pieceCost, type BuildMaterialId } from './data/buildMaterials.ts';
import type { BuildPieceType } from './data/buildPieces.ts';
import { harvestVoxel } from './systems/harvestingSystem.ts';
import { harvestTree } from './systems/treeHarvest.ts';
import { collectStone } from './systems/stonePickup.ts';
import { collectForage } from './systems/foragePickup.ts';
import { craft, type CraftContext } from './systems/craftingSystem.ts';
import {
  fitDoor,
  getPieceAt,
  isFreeBuild,
  placeDoorway,
  placePiece,
  placeVolume,
  removePiece,
  toggleDoor,
  type StructurePiece
} from './systems/structureSystem.ts';
import { placeCampfire } from './systems/campfires.ts';
import { addResource, getItemCount, removeItem } from './systems/inventorySystem.ts';
import { drink, feed, resetVitals } from './systems/survivalVitals.ts';
import { fillWaterskin, getWaterskinFill, useWaterskin } from './systems/consumeSystem.ts';
import { addMawCharge, BIOFUEL_CHARGE, CHARGE_PER_BREAK, consumeMawCharge, getMawCharge, refuelFromInventory, repairMaw } from './systems/mawSystem.ts';

export { LOCAL_ACTOR_ID };

let nextLocalCommandId = 0;

export interface OfflineCommandContextOptions {
  actorId?: string;
  rng?: SimulationRng;
  now?: () => number;
  emit?: (event: DomainEvent) => void;
  state?: Record<string, unknown>;
}

type CommandRef = { commandId: string };
type Vec3Like = { x: number; y: number; z: number };
type Coord3 = [number, number, number];
type RollbackItemStack = { id: ItemId; qty: number };

export interface MineVoxelTerrain {
  getVoxel(x: number, y: number, z: number): { blockId: BlockId; deposit?: ResourceDeposit | null } | null | undefined;
  removeVoxel(x: number, y: number, z: number): boolean;
  exposeNeighbors(x: number, y: number, z: number): number;
  isDeleted(x: number, y: number, z: number): boolean;
}

export interface MineVoxelWater {
  shouldVoxelExist(x: number, y: number, z: number): boolean;
  extendFloodForDugCell(
    x: number,
    y: number,
    z: number,
    isLiveSolid: (x: number, y: number, z: number) => boolean
  ): Vec3Like[];
}

function nextCommandId(type: string): string {
  nextLocalCommandId += 1;
  return `${type}_${nextLocalCommandId.toString(36)}`;
}

function commandRef(type: string, commandId?: string): CommandRef {
  return { commandId: commandId ?? nextCommandId(type) };
}

export function createOfflineCommandContext(
  world: WorldIdentity | CurrentWorld,
  options: OfflineCommandContextOptions = {}
): CommandContext {
  const identity = 'generationSchemaVersion' in world ? world : worldIdentityFromCurrentWorld(world);
  const actorId = options.actorId ?? LOCAL_ACTOR_ID;
  return {
    actorId,
    world: identity,
    rng: options.rng ?? createLocalSimulationRng(`offline:${identity.worldId}:${actorId}`),
    now: options.now ?? (() => Date.now()),
    emit: options.emit,
    state: options.state
  };
}

function event<TPayload>(context: CommandContext, type: string, payload: TPayload): DomainEvent {
  return createDomainEvent({
    worldId: context.world.worldId,
    actorId: context.actorId,
    timeMs: context.now(),
    type,
    payload
  });
}

function accepted(context: CommandContext, ref: CommandRef, events: DomainEvent[], extras: { deltas?: unknown; rollback?: unknown } = {}): CommandResult {
  for (const e of events) context.emit?.(e);
  return commandAccepted(ref, events, extras);
}

function rejected(ref: CommandRef, reason: string): CommandResult {
  return commandRejected(ref, 'validation_failed', reason);
}

function conflict(ref: CommandRef, reason: string): CommandResult {
  return commandRejected(ref, 'conflict', reason);
}

function coordPayload(x: number, y: number, z: number): Coord3 {
  return [x, y, z];
}

function coordFromVec3(coord: Vec3Like): Coord3 {
  return coordPayload(coord.x, coord.y, coord.z);
}

function bankDrops(drops: ReadonlyArray<{ id: Parameters<typeof addResource>[0]; qty: number }>, actorId: ActorId) {
  for (const drop of drops) addResource(drop.id, drop.qty, actorId);
}

function rollbackStacks(stacks: ReadonlyArray<RollbackItemStack>): RollbackItemStack[] {
  return stacks
    .filter(stack => stack.qty > 0)
    .map(stack => ({ id: stack.id, qty: stack.qty }));
}

function buildCostRollback(type: BuildPieceType, material: BuildMaterialId): RollbackItemStack[] {
  return isFreeBuild() ? [] : rollbackStacks(pieceCost(type, material));
}

function snapshotPiece(piece: StructurePiece | undefined): Omit<StructurePiece, 'id'> | null {
  if (!piece) return null;
  const { id: _id, ...rest } = piece;
  return {
    ...rest,
    cell: [...piece.cell] as Coord3,
    partner: piece.partner ? [...piece.partner] as Coord3 : undefined
  };
}

function mineDepositIdentity(context: CommandContext, coord: Vec3Like, deposit?: ResourceDeposit | null) {
  if (!deposit) return null;
  return {
    worldId: context.world.worldId,
    coord: coordFromVec3(coord),
    resourceId: deposit.resourceId,
    richness: deposit.richness,
    scanLevel: deposit.scanLevel
  };
}

export function harvestVoxelCommand(
  context: CommandContext,
  input: { coord?: Vec3Like; blockId: BlockId; deposit?: ResourceDeposit | null; toolTier: number; commandId?: string }
): CommandResult {
  const ref = commandRef('mineVoxel', input.commandId);
  const result = harvestVoxel({
    blockId: input.blockId,
    deposit: input.deposit,
    toolTier: input.toolTier,
    bank: false,
    rng: context.rng
  });
  if (!result.success) return rejected(ref, result.reason ?? 'voxel harvest rejected');
  bankDrops(result.drops, context.actorId);
  return accepted(context, ref, [
    event(context, 'voxel_mined', {
      coord: input.coord ? coordPayload(input.coord.x, input.coord.y, input.coord.z) : null,
      blockId: input.blockId,
      deposit: input.deposit ?? null,
      drops: result.drops
    })
  ], {
    deltas: result.drops,
    rollback: { removeItems: rollbackStacks(result.drops) }
  });
}

export function mineVoxelCommand(
  context: CommandContext,
  input: {
    coord: Vec3Like;
    terrain: MineVoxelTerrain;
    water?: MineVoxelWater;
    toolTier: number;
    usesCharge?: boolean;
    autoRefuel?: boolean;
    chargeCost?: number;
    commandId?: string;
  }
): CommandResult {
  const ref = commandRef('mineVoxel', input.commandId);
  const voxel = input.terrain.getVoxel(input.coord.x, input.coord.y, input.coord.z);
  if (!voxel) return conflict(ref, 'voxel already mined');
  const mawChargeBefore = getMawCharge(context.actorId);
  const biofuelBefore = getItemCount('biofuel', context.actorId);

  const harvest = harvestVoxel({
    blockId: voxel.blockId,
    deposit: voxel.deposit,
    toolTier: input.toolTier,
    bank: false,
    rng: context.rng
  });
  if (!harvest.success) return rejected(ref, harvest.reason ?? 'voxel harvest rejected');

  if (!input.terrain.removeVoxel(input.coord.x, input.coord.y, input.coord.z)) {
    return conflict(ref, 'voxel already mined');
  }

  const exposedNeighbors = input.terrain.exposeNeighbors(input.coord.x, input.coord.y, input.coord.z);
  const flooded = input.water?.extendFloodForDugCell(
    input.coord.x,
    input.coord.y,
    input.coord.z,
    (x, y, z) => input.water!.shouldVoxelExist(x, y, z) && !input.terrain.isDeleted(x, y, z)
  ) ?? [];

  let mawRefueled = 0;
  let mawChargeSpent = 0;
  if (input.usesCharge) {
    const beforeRefuel = getMawCharge(context.actorId);
    if (beforeRefuel <= 0 && input.autoRefuel !== false && refuelFromInventory(context.actorId)) {
      mawRefueled = getMawCharge(context.actorId) - beforeRefuel;
    }

    const beforeSpend = getMawCharge(context.actorId);
    if (beforeSpend > 0) {
      consumeMawCharge(input.chargeCost ?? CHARGE_PER_BREAK, context.actorId);
      mawChargeSpent = beforeSpend - getMawCharge(context.actorId);
    }
  }

  bankDrops(harvest.drops, context.actorId);
  const biofuelSpent = Math.max(0, biofuelBefore - getItemCount('biofuel', context.actorId));

  const minedPayload = {
    coord: coordFromVec3(input.coord),
    blockId: voxel.blockId,
    deposit: voxel.deposit ?? null,
    depositIdentity: mineDepositIdentity(context, input.coord, voxel.deposit),
    drops: harvest.drops,
    exposedNeighbors,
    flooded: flooded.map(coordFromVec3),
    maw: {
      usesCharge: Boolean(input.usesCharge),
      refueled: mawRefueled,
      chargeSpent: mawChargeSpent,
      charge: getMawCharge(context.actorId)
    }
  };
  const events: DomainEvent[] = [
    event(context, 'voxel_mined', minedPayload)
  ];
  if (flooded.length > 0) {
    events.push(event(context, 'water_flooded', { cells: flooded.map(coordFromVec3) }));
  }
  if (mawRefueled > 0) {
    events.push(event(context, 'maw_refueled', { amount: mawRefueled, charge: getMawCharge(context.actorId) + mawChargeSpent }));
  }
  if (mawChargeSpent > 0) {
    events.push(event(context, 'maw_charge_spent', { amount: mawChargeSpent, charge: getMawCharge(context.actorId) }));
  }

  return accepted(context, ref, events, {
    deltas: {
      drops: harvest.drops,
      exposedNeighbors,
      flooded,
      maw: minedPayload.maw
    },
    rollback: {
      removeItems: rollbackStacks(harvest.drops),
      refundItems: biofuelSpent > 0 ? [{ id: 'biofuel', qty: biofuelSpent }] : [],
      mawChargeBefore,
      restoreVoxel: {
        coord: minedPayload.coord,
        blockId: voxel.blockId,
        deposit: voxel.deposit ?? null
      }
    }
  });
}

export function harvestTreeCommand(
  context: CommandContext,
  input: { x: number; y: number; z: number; commandId?: string }
): CommandResult {
  const ref = commandRef('harvestTree', input.commandId);
  const result = harvestTree(input.x, input.y, input.z, context.rng, context.actorId);
  if (result.wood <= 0) return conflict(ref, 'tree already harvested');
  return accepted(context, ref, [
    event(context, 'resource_taken', {
      source: 'tree',
      coord: coordPayload(input.x, input.y, input.z),
      id: 'wood',
      qty: result.wood
    })
  ], {
    deltas: [{ id: 'wood', qty: result.wood }],
    rollback: {
      removeItems: [{ id: 'wood', qty: result.wood }],
      uncollectResource: { source: 'tree', coord: coordPayload(input.x, input.y, input.z) }
    }
  });
}

export function collectStoneCommand(
  context: CommandContext,
  input: { x: number; y: number; z: number; commandId?: string }
): CommandResult {
  const ref = commandRef('collectStone', input.commandId);
  const qty = collectStone(input.x, input.y, input.z, context.rng, context.actorId);
  if (qty <= 0) return conflict(ref, 'stone already collected');
  return accepted(context, ref, [
    event(context, 'resource_taken', {
      source: 'loose_stone',
      coord: coordPayload(input.x, input.y, input.z),
      id: 'stone',
      qty
    })
  ], {
    deltas: [{ id: 'stone', qty }],
    rollback: {
      removeItems: [{ id: 'stone', qty }],
      uncollectResource: { source: 'loose_stone', coord: coordPayload(input.x, input.y, input.z) }
    }
  });
}

export function collectForageCommand(
  context: CommandContext,
  input: { x: number; y: number; z: number; kind: 'berry' | 'root'; commandId?: string }
): CommandResult {
  const ref = commandRef('collectForage', input.commandId);
  const result = collectForage(input.x, input.y, input.z, input.kind, context.rng, context.actorId);
  if (!result) return conflict(ref, 'forage already collected');
  return accepted(context, ref, [
    event(context, 'resource_taken', {
      source: 'forage',
      kind: input.kind,
      coord: coordPayload(input.x, input.y, input.z),
      id: result.id,
      qty: result.qty
    })
  ], {
    deltas: [result],
    rollback: {
      removeItems: [result],
      uncollectResource: { source: 'forage', coord: coordPayload(input.x, input.y, input.z) }
    }
  });
}

export function placeStructureCommand(
  context: CommandContext,
  input: { cell: Coord3; face: number; type: BuildPieceType; material: BuildMaterialId; up?: number; commandId?: string }
): CommandResult {
  const ref = commandRef('placeStructure', input.commandId);
  if (!placePiece(input.cell, input.face, input.type, input.material, input.up, context.actorId)) return rejected(ref, 'structure placement rejected');
  return accepted(context, ref, [
    event(context, 'structure_placed', { cell: input.cell, face: input.face, type: input.type, material: input.material, up: input.up })
  ], {
    rollback: {
      refundItems: buildCostRollback(input.type, input.material),
      removePlacedStructure: { cell: input.cell, face: input.face }
    }
  });
}

export function placeDoorwayCommand(
  context: CommandContext,
  input: { cell: Coord3; face: number; up: number; material: BuildMaterialId; commandId?: string }
): CommandResult {
  const ref = commandRef('placeDoorway', input.commandId);
  if (!placeDoorway(input.cell, input.face, input.up, input.material, context.actorId)) return rejected(ref, 'doorway placement rejected');
  return accepted(context, ref, [
    event(context, 'structure_placed', { cell: input.cell, face: input.face, type: 'doorway', material: input.material, up: input.up })
  ], {
    rollback: {
      refundItems: buildCostRollback('doorway', input.material),
      removePlacedStructure: { cell: input.cell, face: input.face }
    }
  });
}

export function fitDoorCommand(
  context: CommandContext,
  input: { cell: Coord3; face: number; material: BuildMaterialId; commandId?: string }
): CommandResult {
  const ref = commandRef('fitDoor', input.commandId);
  if (!fitDoor(input.cell, input.face, input.material, context.actorId)) return rejected(ref, 'door fitting rejected');
  return accepted(context, ref, [
    event(context, 'structure_placed', { cell: input.cell, face: input.face, type: 'door', material: input.material })
  ], {
    rollback: {
      refundItems: buildCostRollback('door', input.material),
      setDoorOpen: { cell: input.cell, face: input.face, open: false }
    }
  });
}

export function placeVolumeCommand(
  context: CommandContext,
  input: { cell: Coord3; up: number; orient: number; type: BuildPieceType; material: BuildMaterialId; commandId?: string }
): CommandResult {
  const ref = commandRef('placeVolume', input.commandId);
  if (!placeVolume(input.cell, input.up, input.orient, input.type, input.material, context.actorId)) return rejected(ref, 'volume placement rejected');
  return accepted(context, ref, [
    event(context, 'structure_placed', { cell: input.cell, face: 6, type: input.type, material: input.material, up: input.up, orient: input.orient })
  ], {
    rollback: {
      refundItems: buildCostRollback(input.type, input.material),
      removePlacedStructure: { cell: input.cell, face: 6 }
    }
  });
}

export function removeStructureCommand(
  context: CommandContext,
  input: { cell: Coord3; face: number; commandId?: string }
): CommandResult {
  const ref = commandRef('removeStructure', input.commandId);
  const piece = getPieceAt(input.cell[0], input.cell[1], input.cell[2], input.face);
  const restore = [
    snapshotPiece(piece),
    piece?.partner ? snapshotPiece(getPieceAt(piece.partner[0], piece.partner[1], piece.partner[2], input.face)) : null
  ].filter((p): p is Omit<StructurePiece, 'id'> => p !== null);
  const refundItems = piece && !isFreeBuild()
    ? rollbackStacks(pieceCost(piece.type, piece.material).map(stack => ({ ...stack, qty: Math.floor(stack.qty / 2) })))
    : [];
  if (!removePiece(input.cell, input.face, context.actorId)) return rejected(ref, 'structure removal rejected');
  return accepted(context, ref, [
    event(context, 'structure_removed', { cell: input.cell, face: input.face })
  ], {
    rollback: {
      removeItems: refundItems,
      restoreStructures: restore
    }
  });
}

export function toggleDoorCommand(
  context: CommandContext,
  input: { piece: Pick<StructurePiece, 'cell' | 'face' | 'open'>; commandId?: string }
): CommandResult {
  const ref = commandRef('toggleDoor', input.commandId);
  const nextOpen = !Boolean(input.piece.open);
  if (!toggleDoor(input.piece.cell, input.piece.face)) return rejected(ref, 'door toggle rejected');
  return accepted(context, ref, [
    event(context, 'door_toggled', { cell: input.piece.cell, face: input.piece.face, open: nextOpen })
  ], {
    rollback: { setDoorOpen: { cell: input.piece.cell, face: input.piece.face, open: Boolean(input.piece.open) } }
  });
}

export function craftRecipeCommand(
  context: CommandContext,
  input: { recipe: Recipe; craftContext: CraftContext; commandId?: string }
): CommandResult {
  const ref = commandRef('craftRecipe', input.commandId);
  const result = craft(input.recipe, { ...input.craftContext, actorId: context.actorId });
  if (!result.ok) return rejected(ref, result.blockedBy ?? 'craft rejected');
  return accepted(context, ref, [
    event(context, 'recipe_crafted', { recipeId: input.recipe.id, outputs: input.recipe.outputs, inputs: input.recipe.inputs })
  ], {
    deltas: input.recipe.outputs,
    rollback: {
      removeItems: rollbackStacks(input.recipe.outputs),
      refundItems: rollbackStacks(input.recipe.inputs)
    }
  });
}

export function placeCampfireCommand(
  context: CommandContext,
  input: { position: Vec3Like; up: Vec3Like; commandId?: string }
): CommandResult {
  const ref = commandRef('placeCampfire', input.commandId);
  placeCampfire(
    new THREE.Vector3(input.position.x, input.position.y, input.position.z),
    new THREE.Vector3(input.up.x, input.up.y, input.up.z),
    context.actorId
  );
  return accepted(context, ref, [
    event(context, 'campfire_placed', {
      pos: coordPayload(input.position.x, input.position.y, input.position.z),
      up: coordPayload(input.up.x, input.up.y, input.up.z)
    })
  ], {
    rollback: {
      removePlacedCampfire: {
        pos: coordPayload(input.position.x, input.position.y, input.position.z),
        up: coordPayload(input.up.x, input.up.y, input.up.z)
      }
    }
  });
}

export function craftAndPlaceCampfireCommand(
  context: CommandContext,
  input: { recipe: Recipe; craftContext: CraftContext; position: Vec3Like; up: Vec3Like; commandId?: string }
): CommandResult {
  const ref = commandRef('placeCampfire', input.commandId);
  const result = craft(input.recipe, { ...input.craftContext, actorId: context.actorId });
  if (!result.ok) return rejected(ref, result.blockedBy ?? 'campfire craft rejected');
  if (!removeItem('campfire', 1, context.actorId)) return rejected(ref, 'crafted campfire was not available to place');
  placeCampfire(
    new THREE.Vector3(input.position.x, input.position.y, input.position.z),
    new THREE.Vector3(input.up.x, input.up.y, input.up.z),
    context.actorId
  );
  return accepted(context, ref, [
    event(context, 'recipe_crafted', { recipeId: input.recipe.id, outputs: input.recipe.outputs, inputs: input.recipe.inputs }),
    event(context, 'campfire_placed', {
      pos: coordPayload(input.position.x, input.position.y, input.position.z),
      up: coordPayload(input.up.x, input.up.y, input.up.z)
    })
  ], {
    rollback: {
      refundItems: rollbackStacks(input.recipe.inputs),
      removePlacedCampfire: {
        pos: coordPayload(input.position.x, input.position.y, input.position.z),
        up: coordPayload(input.up.x, input.up.y, input.up.z)
      }
    }
  });
}

export function consumeItemCommand(
  context: CommandContext,
  input: { itemId: ItemId; commandId?: string }
): CommandResult {
  const ref = commandRef('consumeItem', input.commandId);
  const def = getItem(input.itemId);
  if ((def.foodValue ?? 0) <= 0 && (def.waterValue ?? 0) <= 0) return rejected(ref, 'item is not consumable');
  if (!removeItem(input.itemId, 1, context.actorId)) return rejected(ref, 'item not available');
  feed(def.foodValue ?? 0, def.waterValue ?? 0, context.actorId);
  return accepted(context, ref, [
    event(context, 'item_consumed', { itemId: input.itemId, food: def.foodValue ?? 0, water: def.waterValue ?? 0 })
  ]);
}

export function drinkWaterCommand(
  context: CommandContext,
  input: { amount?: number; fillWaterskinIfOwned?: boolean; commandId?: string } = {}
): CommandResult {
  const ref = commandRef('drinkWater', input.commandId);
  const amount = input.amount ?? 60;
  drink(amount, context.actorId);
  let filled = false;
  if (input.fillWaterskinIfOwned && getItemCount('waterskin', context.actorId) > 0) {
    fillWaterskin(undefined, context.actorId);
    filled = true;
  }
  return accepted(context, ref, [
    event(context, 'water_drank', { amount, filledWaterskin: filled })
  ]);
}

export function fillWaterskinCommand(
  context: CommandContext,
  input: { amount?: number; commandId?: string } = {}
): CommandResult {
  const ref = commandRef('fillWaterskin', input.commandId);
  const before = getWaterskinFill(context.actorId);
  fillWaterskin(input.amount, context.actorId);
  const filled = getWaterskinFill(context.actorId) - before;
  if (filled <= 0) return conflict(ref, 'waterskin already full');
  return accepted(context, ref, [
    event(context, 'waterskin_filled', { amount: filled, fill: getWaterskinFill(context.actorId) })
  ]);
}

export function drinkFromWaterskinCommand(
  context: CommandContext,
  input: { amount?: number; commandId?: string } = {}
): CommandResult {
  const ref = commandRef('drinkFromWaterskin', input.commandId);
  const amount = useWaterskin(input.amount, context.actorId);
  if (amount <= 0) return conflict(ref, 'waterskin empty');
  return accepted(context, ref, [
    event(context, 'water_drank', { source: 'waterskin', amount, fill: getWaterskinFill(context.actorId) })
  ]);
}

export function refuelMawCommand(context: CommandContext, input: { commandId?: string } = {}): CommandResult {
  const ref = commandRef('refuelMaw', input.commandId);
  if (!refuelFromInventory(context.actorId)) return conflict(ref, 'Maw did not refuel');
  return accepted(context, ref, [
    event(context, 'maw_refueled', { amount: BIOFUEL_CHARGE, charge: getMawCharge(context.actorId) })
  ]);
}

export function addMawChargeCommand(context: CommandContext, input: { amount: number; commandId?: string }): CommandResult {
  const ref = commandRef('addMawCharge', input.commandId);
  const before = getMawCharge(context.actorId);
  addMawCharge(input.amount, context.actorId);
  const amount = getMawCharge(context.actorId) - before;
  if (amount <= 0) return conflict(ref, 'Maw charge unchanged');
  return accepted(context, ref, [
    event(context, 'maw_refueled', { amount, charge: getMawCharge(context.actorId) })
  ]);
}

export function spendMawChargeCommand(context: CommandContext, input: { amount: number; commandId?: string }): CommandResult {
  const ref = commandRef('spendMawCharge', input.commandId);
  const before = getMawCharge(context.actorId);
  consumeMawCharge(input.amount, context.actorId);
  const amount = before - getMawCharge(context.actorId);
  if (amount <= 0) return conflict(ref, 'Maw charge unchanged');
  return accepted(context, ref, [
    event(context, 'maw_charge_spent', { amount, charge: getMawCharge(context.actorId) })
  ]);
}

export function repairMawCommand(context: CommandContext, input: { commandId?: string } = {}): CommandResult {
  const ref = commandRef('repairMaw', input.commandId);
  if (!repairMaw(context.actorId)) return rejected(ref, 'Maw repair rejected');
  return accepted(context, ref, [
    event(context, 'maw_repaired', {})
  ]);
}

export function respawnCommand(
  context: CommandContext,
  input: { position?: Vec3Like; up?: Vec3Like; commandId?: string } = {}
): CommandResult {
  const ref = commandRef('respawn', input.commandId);
  resetVitals(context.actorId);
  return accepted(context, ref, [
    event(context, 'player_respawned', {
      position: input.position ? coordFromVec3(input.position) : null,
      up: input.up ? coordFromVec3(input.up) : null
    })
  ]);
}
