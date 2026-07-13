import { describe, it, expect } from 'vitest';
import { ITEMS, ALL_ITEM_IDS, getItem, isItemId } from './items.ts';
import { ALL_RESOURCE_IDS, RESOURCES } from './resources.ts';
import { FLORA_HARVEST_KINDS, FLORA_HARVEST } from './floraHarvest.ts';

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

  it('tools cover tool tiers 0..4 (Faulty Maw + stone tools + the Maw line)', () => {
    const tools = ALL_ITEM_IDS.map(getItem).filter(i => i.kind === 'tool');
    const tiers = new Set(tools.map(t => t.toolTier));
    expect([0, 1, 2, 3, 4].every(t => tiers.has(t))).toBe(true);
    expect(getItem('faulty_maw').toolTier).toBe(0);   // soft only
    expect(getItem('stone_pickaxe').toolTier).toBe(1); // unlocks stone/ore
    expect(getItem('iron_maw').toolTier).toBe(1);
    expect(getItem('void_maw').toolTier).toBe(4);
  });

  it('the Hatchet specializes in wood, the Pickaxe in stone', () => {
    expect(getItem('stone_hatchet').harvestSpeed?.wood).toBeGreaterThan(1);
    expect(getItem('stone_pickaxe').harvestSpeed?.stone).toBeGreaterThan(0);
    expect(getItem('stone_pickaxe').harvestSpeed?.stone).toBeLessThan(1); // slow
  });

  it('the Faulty Maw runs on charge; the repaired Iron Maw does not', () => {
    expect(getItem('faulty_maw').usesCharge).toBe(true);
    expect(getItem('iron_maw').usesCharge).toBeFalsy();
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

  it('registers every procedural flora drop as an inventory item', () => {
    for (const kind of FLORA_HARVEST_KINDS) {
      const drop = FLORA_HARVEST[kind];
      expect(isItemId(drop.itemId)).toBe(true);
      expect(drop.quantity[0]).toBeGreaterThan(0);
      expect(drop.quantity[1]).toBeGreaterThanOrEqual(drop.quantity[0]);
    }
    expect(getItem('cactus_pulp').kind).toBe('ingredient');
    expect(getItem('fan_frond').kind).toBe('ingredient');
    expect(getItem('wild_bloom').kind).toBe('ingredient');
    expect(getItem('seedpod').kind).toBe('ingredient');
    expect(FLORA_HARVEST.shrub.itemId).toBe('berry');
  });
});
