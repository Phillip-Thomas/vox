import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { MaterialType } from '../types/materials.ts';
import { applyRejectedCommandRollback } from './multiplayerReconciliation.ts';
import {
  collectForageCommand,
  collectStoneCommand,
  craftAndPlaceCampfireCommand,
  createOfflineCommandContext,
  mineVoxelCommand,
  placeStructureCommand
} from './gameplayCommands.ts';
import { createSimulationRng } from './rng.ts';
import { createWorldIdentity } from './worldIdentity.ts';
import { RECIPES } from './data/recipes.ts';
import { getAccessibleStations } from './data/stations.ts';
import { addItem, getItemCount, resetAllInventories } from './systems/inventorySystem.ts';
import { getMawCharge, resetAllMawState } from './systems/mawSystem.ts';
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
});
