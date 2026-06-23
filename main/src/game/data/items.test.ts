import { describe, it, expect } from 'vitest';
import { ITEMS, ALL_ITEM_IDS, getItem, isItemId } from './items.ts';
import { ALL_RESOURCE_IDS, RESOURCES } from './resources.ts';

describe('item registry', () => {
  it('includes every resource as a kind:resource item with matching tier/name', () => {
    for (const id of ALL_RESOURCE_IDS) {
      const item = getItem(id);
      expect(item).toBeTruthy();
      expect(item.kind).toBe('resource');
      expect(item.tier).toBe(RESOURCES[id].tier);
      expect(item.name).toBe(RESOURCES[id].name);
    }
  });

  it('every item id round-trips through getItem and isItemId', () => {
    for (const id of ALL_ITEM_IDS) {
      expect(getItem(id).id).toBe(id);
      expect(isItemId(id)).toBe(true);
    }
    expect(isItemId('not_a_real_item')).toBe(false);
  });

  it('tools carry an ascending, gap-free toolTier 1..4 (the Maw line)', () => {
    const tools = ALL_ITEM_IDS.map(getItem).filter(i => i.kind === 'tool');
    const tiers = tools.map(t => t.toolTier).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(tiers).toEqual([1, 2, 3, 4]);
    expect(getItem('iron_maw').toolTier).toBe(1);
    expect(getItem('void_maw').toolTier).toBe(4);
  });

  it('suits declare hazard protection; modules declare an effect', () => {
    expect(getItem('thermal_carapace').hazardProtect?.extreme_cold).toBeGreaterThan(0);
    expect(getItem('filter_carapace').hazardProtect?.toxic_fog).toBeGreaterThan(0);
    expect(getItem('survey_lens_3').moduleEffect?.scanLevel).toBe(3);
    expect(getItem('range_coil').moduleEffect?.warpRangeAdd).toBe(1);
  });

  it('every item has a non-empty description and name', () => {
    for (const id of ALL_ITEM_IDS) {
      const item = ITEMS[id];
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});
