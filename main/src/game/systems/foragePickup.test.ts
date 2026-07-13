import { describe, it, expect, beforeEach } from 'vitest';
import {
  FORAGE_HASH_SALT,
  FORAGE_MAX_DENSITY,
  collectForage,
  isDeadwoodNode,
  isForageCollected,
  getCollectedForage,
  markForageCollected,
  resetForagePickup
} from './foragePickup.ts';
import { QUALITY_PROFILES } from '../../config/graphicsSettings.ts';
import { resetInventory, getItemCount } from './inventorySystem.ts';
import { createSimulationRng } from '../rng.ts';
import { seededVoxelUnit } from '../../utils/seededHash.ts';

beforeEach(() => { resetForagePickup(); resetInventory(); });

describe('forage pickup', () => {
  it('collects a berry node and banks berries (once)', () => {
    const got = collectForage(2, 0, 3, 'berry');
    expect(got?.id).toBe('berry');
    expect(getItemCount('berry')).toBeGreaterThan(0);
    expect(isForageCollected(2, 0, 3)).toBe(true);
    expect(collectForage(2, 0, 3, 'berry')).toBeNull(); // already gone
  });

  it('a root node banks a starch root', () => {
    collectForage(1, 0, 0, 'root');
    expect(getItemCount('root')).toBe(1);
    expect(getItemCount('berry')).toBe(0);
  });

  it('deadwood banks deterministic primitive wood even when decorative trees are disabled', () => {
    expect(QUALITY_PROFILES.POTATO.treeDensity).toBe(0);
    const got = collectForage(9, 0, 2, 'deadwood');
    expect(got).toEqual({ id: 'wood', qty: 2 });
    expect(getItemCount('wood')).toBe(2);
  });

  it('uses quality-independent deterministic deadwood coordinates', () => {
    const nodes = Array.from({ length: 500 }, (_, x) => isDeadwoodNode(x, 0, 0, 12345));
    expect(nodes.some(Boolean)).toBe(true);
    expect(nodes).toEqual(Array.from({ length: 500 }, (_, x) => isDeadwoodNode(x, 0, 0, 12345)));
    for (let x = 0; x < nodes.length; x++) {
      if (!nodes[x]) continue;
      expect(seededVoxelUnit(x, 0, 0, FORAGE_HASH_SALT, 12345)).toBeGreaterThanOrEqual(FORAGE_MAX_DENSITY);
    }
  });

  it('snapshots coords and restore-marks without re-banking', () => {
    collectForage(5, 5, 5, 'berry');
    expect(getCollectedForage()).toContainEqual([5, 5, 5]);
    resetForagePickup(); resetInventory();
    markForageCollected(5, 5, 5);
    expect(isForageCollected(5, 5, 5)).toBe(true);
    expect(getItemCount('berry')).toBe(0); // mark doesn't grant
  });

  it('can use command-provided deterministic RNG', () => {
    const first = collectForage(2, 0, 3, 'berry', createSimulationRng('forage-command', '0,0'));
    resetForagePickup(); resetInventory();
    const second = collectForage(2, 0, 3, 'berry', createSimulationRng('forage-command', '0,0'));

    expect(second).toEqual(first);
  });
});
