import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  addMawChargeCommand,
  collectStoneCommand,
  collectForageCommand,
  consumeItemCommand,
  craftAndPlaceCampfireCommand,
  craftRecipeCommand,
  createOfflineCommandContext,
  drinkFromWaterskinCommand,
  drinkWaterCommand,
  fitDoorCommand,
  harvestTreeCommand,
  harvestVoxelCommand,
  mineVoxelCommand,
  placeCampfireCommand,
  placeDoorwayCommand,
  placeStructureCommand,
  placeVolumeCommand,
  refuelMawCommand,
  removeStructureCommand,
  repairMawCommand,
  respawnCommand,
  fillWaterskinCommand,
  spendMawChargeCommand,
  toggleDoorCommand
} from './gameplayCommands.ts';
import type { DomainEvent } from './events.ts';
import { createSimulationRng } from './rng.ts';
import { createWorldIdentity } from './worldIdentity.ts';
import { addItem, getItemCount, resetInventory } from './systems/inventorySystem.ts';
import { getPieceAt, resetStructures } from './systems/structureSystem.ts';
import { getCampfires, resetCampfires } from './systems/campfires.ts';
import { RECIPES } from './data/recipes.ts';
import { getAccessibleStations } from './data/stations.ts';
import { getVitals, resetVitals, setVitals } from './systems/survivalVitals.ts';
import { getWaterskinFill, resetWaterskin, setWaterskinFill } from './systems/consumeSystem.ts';
import { getMawCharge, resetMaw, setMawCharge } from './systems/mawSystem.ts';
import { resetProgression } from './systems/progressionSystem.ts';
import { resetStonePickup } from './systems/stonePickup.ts';
import { resetTreeHarvest } from './systems/treeHarvest.ts';
import { EfficientVoxelSystem } from '../utils/efficientVoxelSystem.ts';
import { MaterialType } from '../types/materials.ts';
import type { BlockId } from './data/blocks.ts';
import type { ResourceDeposit } from './generation/resourceDeposits.ts';

function context(events: DomainEvent[] = []) {
  return createOfflineCommandContext(createWorldIdentity({ x: 0, y: 0 }), {
    rng: createSimulationRng('gameplay-command-test'),
    now: () => 123,
    emit: event => events.push(event)
  });
}

function terrainWithVoxel(blockId: BlockId, material: MaterialType, deposit?: ResourceDeposit | null) {
  const terrain = new EfficientVoxelSystem(20);
  const color = new THREE.Color('white');
  terrain.setOriginalTerrain([{ x: 0, y: 0, z: 0, material, color, blockId, deposit }]);
  terrain.addVoxel(0, 0, 0, material, color, undefined, { blockId, deposit });
  return terrain;
}

beforeEach(() => {
  resetInventory();
  resetStructures();
  resetCampfires();
  resetStonePickup();
  resetTreeHarvest();
  resetVitals();
  resetWaterskin();
  resetMaw();
  resetProgression();
});

describe('gameplay command wrappers', () => {
  it('collects resources through commands and emits resource events', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);

    const stone = collectStoneCommand(ctx, { x: 1, y: 2, z: 3 });
    const tree = harvestTreeCommand(ctx, { x: 4, y: 5, z: 6 });
    const forage = collectForageCommand(ctx, { x: 7, y: 8, z: 9, kind: 'berry' });

    expect(stone.ok).toBe(true);
    expect(tree.ok).toBe(true);
    expect(forage.ok).toBe(true);
    expect(getItemCount('stone')).toBeGreaterThan(0);
    expect(getItemCount('wood')).toBeGreaterThan(0);
    expect(getItemCount('berry')).toBeGreaterThan(0);
    expect(events.map(event => event.type)).toEqual(['resource_taken', 'resource_taken', 'resource_taken']);
  });

  it('resolves voxel drops with command-provided deterministic RNG', () => {
    const firstEvents: DomainEvent[] = [];
    const secondEvents: DomainEvent[] = [];

    const first = harvestVoxelCommand(context(firstEvents), {
      coord: { x: 1, y: 2, z: 3 },
      blockId: 'stone',
      toolTier: 1
    });
    resetInventory();
    const second = harvestVoxelCommand(context(secondEvents), {
      coord: { x: 1, y: 2, z: 3 },
      blockId: 'stone',
      toolTier: 1
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(secondEvents[0].payload).toEqual(firstEvents[0].payload);
  });

  it('mines a voxel as one terrain, drop, water, and Maw command', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    const deposit = { resourceId: 'copper_ore' as const, richness: 1.1, scanLevel: 1 };
    const terrain = terrainWithVoxel('copper_block', MaterialType.COPPER, deposit);
    const water = {
      shouldVoxelExist: () => true,
      extendFloodForDugCell: () => [{ x: 0, y: 0, z: 0 }]
    };
    addItem('biofuel', 1);

    const result = mineVoxelCommand(ctx, {
      coord: { x: 0, y: 0, z: 0 },
      terrain,
      water,
      toolTier: 1,
      usesCharge: true
    });

    expect(result.ok).toBe(true);
    expect(terrain.getVoxel(0, 0, 0)).toBeUndefined();
    expect(getItemCount('copper_ore')).toBeGreaterThan(0);
    expect(getItemCount('biofuel')).toBe(0);
    expect(getMawCharge()).toBe(46);
    expect(events.map(event => event.type)).toEqual(['voxel_mined', 'water_flooded', 'maw_refueled', 'maw_charge_spent']);
    expect(events[0].payload).toMatchObject({
      coord: [0, 0, 0],
      blockId: 'copper_block',
      depositIdentity: {
        worldId: ctx.world.worldId,
        coord: [0, 0, 0],
        resourceId: 'copper_ore',
        scanLevel: 1
      },
      flooded: [[0, 0, 0]],
      maw: {
        usesCharge: true,
        refueled: 50,
        chargeSpent: 4,
        charge: 46
      }
    });
  });

  it('rejects mineVoxel without mutating inventory when the voxel is gone', () => {
    const ctx = context();
    const terrain = terrainWithVoxel('grass', MaterialType.GRASS);
    expect(terrain.removeVoxel(0, 0, 0)).toBe(true);

    const result = mineVoxelCommand(ctx, {
      coord: { x: 0, y: 0, z: 0 },
      terrain,
      toolTier: 0
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('mineVoxel should have rejected the missing voxel');
    expect(result.code).toBe('conflict');
    expect(getItemCount('biofiber')).toBe(0);
  });

  it('places, fits, toggles, and removes structures through commands', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    addItem('wood', 100);

    expect(placeStructureCommand(ctx, { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood' }).ok).toBe(true);
    expect(placeVolumeCommand(ctx, { cell: [2, 0, 0], up: 2, orient: 1, type: 'stairs', material: 'wood' }).ok).toBe(true);
    expect(placeDoorwayCommand(ctx, { cell: [0, 0, 0], face: 0, up: 2, material: 'wood' }).ok).toBe(true);
    expect(fitDoorCommand(ctx, { cell: [0, 0, 0], face: 0, material: 'wood' }).ok).toBe(true);
    const door = getPieceAt(0, 0, 0, 0);
    expect(door).toBeTruthy();
    expect(toggleDoorCommand(ctx, { piece: door! }).ok).toBe(true);
    expect(removeStructureCommand(ctx, { cell: [2, 0, 0], face: 6 }).ok).toBe(true);

    expect(events.map(event => event.type)).toEqual([
      'structure_placed',
      'structure_placed',
      'structure_placed',
      'structure_placed',
      'door_toggled',
      'structure_removed'
    ]);
  });

  it('crafts and places a campfire atomically', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    addItem('flint', 2);
    addItem('biofuel', 1);
    addItem('wood', 3);

    const result = craftAndPlaceCampfireCommand(ctx, {
      recipe: RECIPES.campfire,
      craftContext: { stations: getAccessibleStations() },
      position: { x: 1, y: 2, z: 3 },
      up: { x: 0, y: 1, z: 0 }
    });

    expect(result.ok).toBe(true);
    expect(getItemCount('campfire')).toBe(0);
    expect(getCampfires()).toHaveLength(1);
    expect(events.map(event => event.type)).toEqual(['recipe_crafted', 'campfire_placed']);
  });

  it('covers direct craft, campfire placement, and Maw charge add wrappers', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    addItem('biofiber', 3);

    expect(craftRecipeCommand(ctx, {
      recipe: RECIPES.biofuel,
      craftContext: { stations: getAccessibleStations() }
    }).ok).toBe(true);
    expect(getItemCount('biofuel')).toBe(1);

    expect(placeCampfireCommand(ctx, {
      position: { x: 2, y: 3, z: 4 },
      up: { x: 0, y: 1, z: 0 }
    }).ok).toBe(true);
    expect(getCampfires()).toHaveLength(1);

    expect(addMawChargeCommand(ctx, { amount: 5 }).ok).toBe(true);
    expect(getMawCharge()).toBe(5);
    expect(events.map(event => event.type)).toEqual(['recipe_crafted', 'campfire_placed', 'maw_refueled']);
  });

  it('consumes items, drinks water, and uses the waterskin through commands', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    setVitals({ hunger: 50, thirst: 40 });
    addItem('berry', 1);
    addItem('waterskin', 1);

    expect(consumeItemCommand(ctx, { itemId: 'berry' }).ok).toBe(true);
    expect(getVitals().hunger).toBeGreaterThan(50);
    expect(drinkWaterCommand(ctx, { amount: 20, fillWaterskinIfOwned: true }).ok).toBe(true);
    expect(getWaterskinFill()).toBe(100);
    setWaterskinFill(0);
    expect(fillWaterskinCommand(ctx, { amount: 25 }).ok).toBe(true);
    expect(getWaterskinFill()).toBe(25);
    setVitals({ thirst: 20 });
    setWaterskinFill(40);
    expect(drinkFromWaterskinCommand(ctx, { amount: 30 }).ok).toBe(true);
    expect(getWaterskinFill()).toBe(10);
    expect(events.map(event => event.type)).toEqual(['item_consumed', 'water_drank', 'waterskin_filled', 'water_drank']);
  });

  it('routes Maw refuel, charge spend, and repair through commands', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    addItem('biofuel', 1);
    addItem('faulty_maw', 1);

    expect(refuelMawCommand(ctx).ok).toBe(true);
    expect(getMawCharge()).toBeGreaterThan(0);
    const beforeSpend = getMawCharge();
    expect(spendMawChargeCommand(ctx, { amount: 4 }).ok).toBe(true);
    expect(getMawCharge()).toBe(beforeSpend - 4);
    setMawCharge(0);
    expect(repairMawCommand(ctx).ok).toBe(true);
    expect(getItemCount('iron_maw')).toBe(1);
    expect(events.map(event => event.type)).toEqual(['maw_refueled', 'maw_charge_spent', 'maw_repaired']);
  });

  it('routes respawn through a command event and resets vitals', () => {
    const events: DomainEvent[] = [];
    const ctx = context(events);
    setVitals({ health: 15, hunger: 20, thirst: 30, stamina: 0, oxygen: 0 });

    const result = respawnCommand(ctx, {
      position: { x: 1, y: 2, z: 3 },
      up: { x: 0, y: 1, z: 0 }
    });

    expect(result.ok).toBe(true);
    expect(getVitals()).toMatchObject({ health: 100, hunger: 100, thirst: 100, stamina: 100, oxygen: 100 });
    expect(events.map(event => event.type)).toEqual(['player_respawned']);
    expect(events[0].payload).toEqual({ position: [1, 2, 3], up: [0, 1, 0] });
  });

  it('rejects or conflicts every validation-bearing command wrapper path', () => {
    const ctx = context();
    addItem('wood', 100);

    expect(harvestVoxelCommand(ctx, { blockId: 'stone', toolTier: 0 }).ok).toBe(false);

    const hardTerrain = terrainWithVoxel('stone', MaterialType.STONE);
    expect(mineVoxelCommand(ctx, {
      coord: { x: 0, y: 0, z: 0 },
      terrain: hardTerrain,
      toolTier: 0
    }).ok).toBe(false);
    expect(hardTerrain.getVoxel(0, 0, 0)).toBeTruthy();

    expect(collectStoneCommand(ctx, { x: 1, y: 1, z: 1 }).ok).toBe(true);
    expect(collectStoneCommand(ctx, { x: 1, y: 1, z: 1 }).ok).toBe(false);
    expect(harvestTreeCommand(ctx, { x: 2, y: 2, z: 2 }).ok).toBe(true);
    expect(harvestTreeCommand(ctx, { x: 2, y: 2, z: 2 }).ok).toBe(false);
    expect(collectForageCommand(ctx, { x: 3, y: 3, z: 3, kind: 'root' }).ok).toBe(true);
    expect(collectForageCommand(ctx, { x: 3, y: 3, z: 3, kind: 'root' }).ok).toBe(false);

    expect(placeStructureCommand(ctx, { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood' }).ok).toBe(true);
    expect(placeStructureCommand(ctx, { cell: [0, 0, 0], face: 3, type: 'foundation', material: 'wood' }).ok).toBe(false);
    expect(placeVolumeCommand(ctx, { cell: [4, 0, 0], up: 2, orient: 0, type: 'stairs', material: 'wood' }).ok).toBe(true);
    expect(placeVolumeCommand(ctx, { cell: [4, 0, 0], up: 2, orient: 0, type: 'stairs', material: 'wood' }).ok).toBe(false);
    expect(placeDoorwayCommand(ctx, { cell: [5, 0, 0], face: 0, up: 2, material: 'wood' }).ok).toBe(true);
    expect(placeDoorwayCommand(ctx, { cell: [5, 0, 0], face: 0, up: 2, material: 'wood' }).ok).toBe(false);
    expect(fitDoorCommand(ctx, { cell: [9, 9, 9], face: 0, material: 'wood' }).ok).toBe(false);
    expect(toggleDoorCommand(ctx, { piece: getPieceAt(0, 0, 0, 3)! }).ok).toBe(false);
    expect(removeStructureCommand(ctx, { cell: [9, 9, 9], face: 0 }).ok).toBe(false);

    expect(craftRecipeCommand(ctx, {
      recipe: RECIPES.torch,
      craftContext: { stations: getAccessibleStations() }
    }).ok).toBe(false);
    expect(craftAndPlaceCampfireCommand(ctx, {
      recipe: RECIPES.campfire,
      craftContext: { stations: getAccessibleStations() },
      position: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 }
    }).ok).toBe(false);

    expect(consumeItemCommand(ctx, { itemId: 'wood' }).ok).toBe(false);
    setWaterskinFill(100);
    expect(fillWaterskinCommand(ctx, { amount: 1 }).ok).toBe(false);
    setWaterskinFill(0);
    expect(drinkFromWaterskinCommand(ctx, { amount: 1 }).ok).toBe(false);
    expect(refuelMawCommand(ctx).ok).toBe(false);
    expect(addMawChargeCommand(ctx, { amount: 0 }).ok).toBe(false);
    expect(spendMawChargeCommand(ctx, { amount: 1 }).ok).toBe(false);
    expect(repairMawCommand(ctx).ok).toBe(false);
  });
});
