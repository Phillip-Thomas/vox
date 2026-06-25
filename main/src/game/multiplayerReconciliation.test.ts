import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { MaterialType } from '../types/materials.ts';
import { applyRejectedCommandRollback } from './multiplayerReconciliation.ts';
import {
  collectForageCommand,
  collectStoneCommand,
  consumeItemCommand,
  craftAndPlaceCampfireCommand,
  createOfflineCommandContext,
  drinkFromWaterskinCommand,
  fillWaterskinCommand,
  mineVoxelCommand,
  placeStructureCommand,
  refuelMawCommand,
  repairMawCommand,
  spendMawChargeCommand
} from './gameplayCommands.ts';
import { createSimulationRng } from './rng.ts';
import { createWorldIdentity } from './worldIdentity.ts';
import { RECIPES } from './data/recipes.ts';
import { getAccessibleStations } from './data/stations.ts';
import { addItem, getItemCount, resetAllInventories } from './systems/inventorySystem.ts';
import { getMawCharge, resetAllMawState, setMawCharge } from './systems/mawSystem.ts';
import { getVitals, resetAllVitals, setVitals } from './systems/survivalVitals.ts';
import { getWaterskinFill, resetAllWaterskins, setWaterskinFill } from './systems/consumeSystem.ts';
import { getCampfires, resetCampfires } from './systems/campfires.ts';
import { isForageCollected, resetForagePickup } from './systems/foragePickup.ts';
import { isStoneCollected, resetStonePickup } from './systems/stonePickup.ts';
import { resetTreeHarvest } from './systems/treeHarvest.ts';
import { getPieceAt, resetStructures } from './systems/structureSystem.ts';

const actorId = 'alice';

function context() {
  return createOfflineCommandContext(createWorldIdentity({ x: 0, y: 0 }), {
    actorId,
    rng: createSimulationRng('multiplayer-reconciliation-test'),
    now: () => 123
  });
}

function populateGlobalVoxel(): void {
  const color = new THREE.Color('white');
  voxelSystem.reset();
  voxelSystem.setOriginalTerrain([{ x: 0, y: 0, z: 0, material: MaterialType.COPPER, color, blockId: 'copper_block' }]);
  voxelSystem.addVoxel(0, 0, 0, MaterialType.COPPER, color, undefined, { blockId: 'copper_block' });
}

beforeEach(() => {
  resetAllInventories();
  resetAllMawState();
  resetAllVitals();
  resetAllWaterskins();
  resetForagePickup();
  resetStonePickup();
  resetTreeHarvest();
  resetCampfires();
  resetStructures();
  voxelSystem.reset();
});

describe('multiplayer reconciliation rollback', () => {
  it('removes local pickup rewards on conflict without uncollecting the shared target', () => {
    const result = collectStoneCommand(context(), { x: 1, y: 2, z: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('collectStone should have succeeded');
    expect(getItemCount('stone', actorId)).toBeGreaterThan(0);
    expect(isStoneCollected(1, 2, 3)).toBe(true);

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'conflict' });

    expect(applied.removedItems).toBeGreaterThan(0);
    expect(getItemCount('stone', actorId)).toBe(0);
    expect(isStoneCollected(1, 2, 3)).toBe(true);
  });

  it('restores predicted pickups on non-conflict rejection', () => {
    const result = collectForageCommand(context(), { x: 4, y: 5, z: 6, kind: 'root' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('collectForage should have succeeded');

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'validation_failed' });

    expect(applied.restoredResources).toBe(1);
    expect(getItemCount('root', actorId)).toBe(0);
    expect(isForageCollected(4, 5, 6)).toBe(false);
  });

  it('keeps conflicted terrain removed but reverses local mining rewards and Maw state', () => {
    populateGlobalVoxel();
    addItem('biofuel', 1, actorId);
    const result = mineVoxelCommand(context(), {
      coord: { x: 0, y: 0, z: 0 },
      terrain: voxelSystem,
      toolTier: 1,
      usesCharge: true
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('mineVoxel should have succeeded');
    expect(voxelSystem.isDeleted(0, 0, 0)).toBe(true);
    expect(getItemCount('biofuel', actorId)).toBe(0);
    expect(getMawCharge(actorId)).toBe(46);

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'conflict' });

    expect(applied.restoredTerrain).toBe(0);
    expect(voxelSystem.isDeleted(0, 0, 0)).toBe(true);
    expect(getItemCount('copper_ore', actorId)).toBe(0);
    expect(getItemCount('biofuel', actorId)).toBe(1);
    expect(getMawCharge(actorId)).toBe(0);
  });

  it('restores rejected non-conflict mining terrain', () => {
    populateGlobalVoxel();
    const result = mineVoxelCommand(context(), {
      coord: { x: 0, y: 0, z: 0 },
      terrain: voxelSystem,
      toolTier: 1
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('mineVoxel should have succeeded');

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'rate_limited' });

    expect(applied.restoredTerrain).toBe(1);
    expect(voxelSystem.isDeleted(0, 0, 0)).toBe(false);
    expect(voxelSystem.getVoxel(0, 0, 0)).toBeTruthy();
  });

  it('removes rejected local structure predictions and refunds their full cost', () => {
    addItem('wood', 10, actorId);
    const before = getItemCount('wood', actorId);
    const result = placeStructureCommand(context(), {
      cell: [2, 0, 0],
      face: 3,
      type: 'foundation',
      material: 'wood'
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('placeStructure should have succeeded');
    expect(getPieceAt(2, 0, 0, 3)).toBeTruthy();
    expect(getItemCount('wood', actorId)).toBeLessThan(before);

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'conflict' });

    expect(applied.removedStructures).toBe(1);
    expect(getPieceAt(2, 0, 0, 3)).toBeUndefined();
    expect(getItemCount('wood', actorId)).toBe(before);
  });

  it('removes rejected campfire craft predictions and refunds recipe inputs', () => {
    addItem('flint', 2, actorId);
    addItem('biofuel', 1, actorId);
    addItem('wood', 3, actorId);
    const result = craftAndPlaceCampfireCommand(context(), {
      recipe: RECIPES.campfire,
      craftContext: { stations: getAccessibleStations() },
      position: { x: 1.25, y: 2.5, z: 3.75 },
      up: { x: 0, y: 1, z: 0 }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('craftAndPlaceCampfire should have succeeded');
    expect(getCampfires()).toHaveLength(1);
    expect(getItemCount('flint', actorId)).toBe(0);

    const applied = applyRejectedCommandRollback(result.rollback, { actorId, rejectCode: 'validation_failed' });

    expect(applied.removedCampfires).toBe(1);
    expect(getCampfires()).toHaveLength(0);
    expect(getItemCount('flint', actorId)).toBe(2);
    expect(getItemCount('biofuel', actorId)).toBe(1);
    expect(getItemCount('wood', actorId)).toBe(3);
  });

  it('restores predicted vitals, waterskin, and Maw state on rejection', () => {
    setVitals({ hunger: 50, thirst: 40 }, actorId);
    addItem('berry', 1, actorId);
    const consumed = consumeItemCommand(context(), { itemId: 'berry' });
    expect(consumed.ok).toBe(true);
    if (!consumed.ok) throw new Error('consumeItem should have succeeded');
    expect(getItemCount('berry', actorId)).toBe(0);
    expect(getVitals(actorId).hunger).toBe(62);

    const consumeRollback = applyRejectedCommandRollback(consumed.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(consumeRollback.restoredVitals).toBe(true);
    expect(getItemCount('berry', actorId)).toBe(1);
    expect(getVitals(actorId)).toMatchObject({ hunger: 50, thirst: 40 });

    addItem('waterskin', 1, actorId);
    const filled = fillWaterskinCommand(context(), { amount: 25 });
    expect(filled.ok).toBe(true);
    if (!filled.ok) throw new Error('fillWaterskin should have succeeded');
    expect(getWaterskinFill(actorId)).toBe(25);

    const fillRollback = applyRejectedCommandRollback(filled.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(fillRollback.restoredWaterskin).toBe(true);
    expect(getWaterskinFill(actorId)).toBe(0);

    setVitals({ thirst: 20 }, actorId);
    setWaterskinFill(40, actorId);
    const drank = drinkFromWaterskinCommand(context(), { amount: 30 });
    expect(drank.ok).toBe(true);
    if (!drank.ok) throw new Error('drinkFromWaterskin should have succeeded');
    expect(getWaterskinFill(actorId)).toBe(10);
    expect(getVitals(actorId).thirst).toBe(50);

    applyRejectedCommandRollback(drank.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(getWaterskinFill(actorId)).toBe(40);
    expect(getVitals(actorId).thirst).toBe(20);

    addItem('biofuel', 1, actorId);
    const refueled = refuelMawCommand(context());
    expect(refueled.ok).toBe(true);
    if (!refueled.ok) throw new Error('refuelMaw should have succeeded');
    expect(getMawCharge(actorId)).toBe(50);
    expect(getItemCount('biofuel', actorId)).toBe(0);

    applyRejectedCommandRollback(refueled.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(getMawCharge(actorId)).toBe(0);
    expect(getItemCount('biofuel', actorId)).toBe(1);

    setMawCharge(50, actorId);
    const spent = spendMawChargeCommand(context(), { amount: 4 });
    expect(spent.ok).toBe(true);
    if (!spent.ok) throw new Error('spendMawCharge should have succeeded');
    expect(getMawCharge(actorId)).toBe(46);

    applyRejectedCommandRollback(spent.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(getMawCharge(actorId)).toBe(50);

    addItem('faulty_maw', 1, actorId);
    const repaired = repairMawCommand(context());
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) throw new Error('repairMaw should have succeeded');
    expect(getItemCount('faulty_maw', actorId)).toBe(0);
    expect(getItemCount('iron_maw', actorId)).toBe(1);

    applyRejectedCommandRollback(repaired.rollback, { actorId, rejectCode: 'validation_failed' });
    expect(getItemCount('faulty_maw', actorId)).toBe(1);
    expect(getItemCount('iron_maw', actorId)).toBe(0);
  });
});
