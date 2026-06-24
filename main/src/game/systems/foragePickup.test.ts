import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectForage, isForageCollected, getCollectedForage, markForageCollected, resetForagePickup
} from './foragePickup.ts';
import { resetInventory, getItemCount } from './inventorySystem.ts';

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

  it('snapshots coords and restore-marks without re-banking', () => {
    collectForage(5, 5, 5, 'berry');
    expect(getCollectedForage()).toContainEqual([5, 5, 5]);
    resetForagePickup(); resetInventory();
    markForageCollected(5, 5, 5);
    expect(isForageCollected(5, 5, 5)).toBe(true);
    expect(getItemCount('berry')).toBe(0); // mark doesn't grant
  });
});
