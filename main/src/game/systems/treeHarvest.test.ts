import { describe, it, expect, beforeEach } from 'vitest';
import {
  isTreeHarvested, markTreeHarvested, getTreeHarvestVersion, resetTreeHarvest, harvestTree
} from './treeHarvest.ts';
import { getItemCount, resetInventory } from './inventorySystem.ts';
import { createSimulationRng } from '../rng.ts';

beforeEach(() => { resetTreeHarvest(); resetInventory(); });

describe('tree harvest state', () => {
  it('marks a tree harvested and bumps the version so TreeField rebuilds', () => {
    expect(isTreeHarvested(1, 2, 3)).toBe(false);
    const v0 = getTreeHarvestVersion();
    markTreeHarvested(1, 2, 3);
    expect(isTreeHarvested(1, 2, 3)).toBe(true);
    expect(getTreeHarvestVersion()).toBeGreaterThan(v0);
  });

  it('marking the same tree twice does not double-bump the version', () => {
    markTreeHarvested(1, 2, 3);
    const v = getTreeHarvestVersion();
    markTreeHarvested(1, 2, 3);
    expect(getTreeHarvestVersion()).toBe(v);
  });

  it('resetTreeHarvest clears (for world swaps)', () => {
    markTreeHarvested(4, 5, 6);
    resetTreeHarvest();
    expect(isTreeHarvested(4, 5, 6)).toBe(false);
  });
});

describe('harvestTree', () => {
  it('fells a tree: banks wood and marks it gone', () => {
    const { wood } = harvestTree(7, 8, 9);
    expect(wood).toBeGreaterThanOrEqual(2);
    expect(wood).toBeLessThanOrEqual(4);
    expect(getItemCount('wood')).toBe(wood);
    expect(isTreeHarvested(7, 8, 9)).toBe(true);
  });

  it('does not re-yield wood for an already-felled tree', () => {
    harvestTree(7, 8, 9);
    const before = getItemCount('wood');
    expect(harvestTree(7, 8, 9)).toEqual({ wood: 0 });
    expect(getItemCount('wood')).toBe(before);
  });

  it('can use command-provided deterministic RNG', () => {
    const first = harvestTree(7, 8, 9, createSimulationRng('tree-command', '0,0'));
    resetTreeHarvest(); resetInventory();
    const second = harvestTree(7, 8, 9, createSimulationRng('tree-command', '0,0'));

    expect(second).toEqual(first);
  });
});
