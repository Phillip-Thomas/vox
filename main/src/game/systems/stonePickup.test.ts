import { describe, it, expect, beforeEach } from 'vitest';
import {
  isStoneCollected, getStonePickupVersion, resetStonePickup, collectStone
} from './stonePickup.ts';
import { getItemCount, resetInventory } from './inventorySystem.ts';
import { createSimulationRng } from '../rng.ts';

beforeEach(() => { resetStonePickup(); resetInventory(); });

describe('loose stone pickup', () => {
  it('collecting a stone banks 1-2 stone, marks it, and bumps the version', () => {
    const v0 = getStonePickupVersion();
    const n = collectStone(1, 2, 3);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(2);
    expect(getItemCount('stone')).toBe(n);
    expect(isStoneCollected(1, 2, 3)).toBe(true);
    expect(getStonePickupVersion()).toBeGreaterThan(v0);
  });

  it('a collected stone cannot be collected again', () => {
    collectStone(1, 2, 3);
    const before = getItemCount('stone');
    expect(collectStone(1, 2, 3)).toBe(0);
    expect(getItemCount('stone')).toBe(before);
  });

  it('reset clears collected state (world swap)', () => {
    collectStone(4, 5, 6);
    resetStonePickup();
    expect(isStoneCollected(4, 5, 6)).toBe(false);
  });

  it('can use command-provided deterministic RNG', () => {
    const first = collectStone(1, 2, 3, createSimulationRng('stone-command', '0,0'));
    resetStonePickup(); resetInventory();
    const second = collectStone(1, 2, 3, createSimulationRng('stone-command', '0,0'));

    expect(second).toBe(first);
  });
});
