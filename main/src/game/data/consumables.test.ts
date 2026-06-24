import { describe, it, expect } from 'vitest';
import { EDIBLE_ITEM_IDS, getItem } from './items.ts';

describe('edible item data', () => {
  it('berry + root carry foodValue; waterskin is a consumable with none', () => {
    expect(getItem('berry').foodValue ?? 0).toBeGreaterThan(0);
    expect(getItem('root').foodValue ?? 0).toBeGreaterThan(0);
    expect(getItem('waterskin').kind).toBe('consumable');
    expect(getItem('waterskin').foodValue).toBeUndefined();
  });

  it('EDIBLE_ITEM_IDS is richest-first and excludes the waterskin', () => {
    expect(EDIBLE_ITEM_IDS).toContain('berry');
    expect(EDIBLE_ITEM_IDS).toContain('root');
    expect(EDIBLE_ITEM_IDS).not.toContain('waterskin');
    expect(EDIBLE_ITEM_IDS.indexOf('root')).toBeLessThan(EDIBLE_ITEM_IDS.indexOf('berry')); // 24 > 12
  });

  it('every listed edible actually has a positive foodValue', () => {
    for (const id of EDIBLE_ITEM_IDS) expect(getItem(id).foodValue ?? 0).toBeGreaterThan(0);
  });
});
