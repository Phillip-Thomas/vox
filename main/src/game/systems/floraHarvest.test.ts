import { beforeEach, describe, expect, it } from 'vitest';
import { FLORA_HARVEST, FLORA_HARVEST_KINDS } from '../data/floraHarvest.ts';
import { createSimulationRng } from '../rng.ts';
import { getItemCount, resetInventory } from './inventorySystem.ts';
import {
  collectFlora,
  getFloraHarvestVersion,
  getHarvestedFlora,
  isFloraHarvested,
  markFloraHarvested,
  resetFloraHarvest,
  unmarkFloraHarvested
} from './floraHarvest.ts';

beforeEach(() => {
  resetFloraHarvest();
  resetInventory();
});

describe('flora harvest state', () => {
  it.each(FLORA_HARVEST_KINDS)('collects %s once and banks its canonical item', kind => {
    const definition = FLORA_HARVEST[kind];
    const result = collectFlora(1, 2, 3, kind, createSimulationRng(`flora:${kind}`));

    expect(result?.id).toBe(definition.itemId);
    expect(result?.qty).toBeGreaterThanOrEqual(definition.quantity[0]);
    expect(result?.qty).toBeLessThanOrEqual(definition.quantity[1]);
    expect(getItemCount(definition.itemId)).toBe(result?.qty);
    expect(isFloraHarvested(1, 2, 3)).toBe(true);
    expect(collectFlora(1, 2, 3, kind, createSimulationRng('second'))).toBeNull();
  });

  it('treats a coord as exclusive even when a different flora kind is claimed', () => {
    expect(collectFlora(4, 5, 6, 'flower', createSimulationRng('flower'))).not.toBeNull();
    expect(collectFlora(4, 5, 6, 'shrub', createSimulationRng('shrub'))).toBeNull();
    expect(getItemCount('berry')).toBe(0);
  });

  it('restore marks, snapshots, unmarks and versions without granting items', () => {
    const before = getFloraHarvestVersion();
    markFloraHarvested(7, 8, 9);
    const marked = getFloraHarvestVersion();

    expect(marked).toBeGreaterThan(before);
    expect(getHarvestedFlora()).toContainEqual([7, 8, 9]);
    expect(getItemCount('wild_bloom')).toBe(0);
    markFloraHarvested(7, 8, 9);
    expect(getFloraHarvestVersion()).toBe(marked);
    expect(unmarkFloraHarvested(7, 8, 9)).toBe(true);
    expect(isFloraHarvested(7, 8, 9)).toBe(false);
  });

  it('reproduces yield from the command RNG seed', () => {
    const first = collectFlora(2, 3, 4, 'seedhead', createSimulationRng('same-command'));
    resetFloraHarvest();
    resetInventory();
    const second = collectFlora(2, 3, 4, 'seedhead', createSimulationRng('same-command'));

    expect(second).toEqual(first);
  });
});
