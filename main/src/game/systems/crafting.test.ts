import { describe, it, expect, beforeEach } from 'vitest';
import { canCraft, craft, recipeReady, type CraftContext } from './craftingSystem.ts';
import { RECIPES, ALL_RECIPES } from '../data/recipes.ts';
import { ALL_STATION_IDS } from '../data/stations.ts';
import { ITEMS } from '../data/items.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';

const ALL_STATIONS: CraftContext = { stations: ALL_STATION_IDS };

beforeEach(() => resetInventory());

describe('recipe tree integrity', () => {
  it('every recipe id, input, and output is a real item', () => {
    for (const r of ALL_RECIPES) {
      expect(ITEMS[r.id]).toBeTruthy();
      for (const s of [...r.inputs, ...r.outputs]) {
        expect(ITEMS[s.id]).toBeTruthy();
        expect(s.qty).toBeGreaterThan(0);
      }
    }
  });

  it('has no self-referential recipe (output never appears in its own inputs)', () => {
    for (const r of ALL_RECIPES) {
      expect(r.inputs.some(i => i.id === r.id)).toBe(false);
    }
  });
});

describe('canCraft gating', () => {
  it('blocks on materials when the inventory is empty', () => {
    const check = canCraft(RECIPES.refined_alloy, ALL_STATIONS);
    expect(check).toEqual({ ok: false, blockedBy: 'materials' });
  });

  it('blocks on station when that station is not accessible', () => {
    addItem('copper_ore', 2);
    addItem('iron_trace', 1);
    const check = canCraft(RECIPES.refined_alloy, { stations: ['hand'] });
    expect(check).toEqual({ ok: false, blockedBy: 'station' });
  });

  it('passes once materials and station are satisfied', () => {
    addItem('copper_ore', 2);
    addItem('iron_trace', 1);
    expect(canCraft(RECIPES.refined_alloy, ALL_STATIONS).ok).toBe(true);
  });

  it('blocks on tech when a recipe is tech-gated and the tech is missing', () => {
    const gated = { ...RECIPES.refined_alloy, requiredTech: 'metallurgy' };
    addItem('copper_ore', 2);
    addItem('iron_trace', 1);
    expect(canCraft(gated, ALL_STATIONS).blockedBy).toBe('tech');
    expect(canCraft(gated, { stations: ALL_STATION_IDS, unlocked: new Set(['metallurgy']) }).ok).toBe(true);
  });
});

describe('craft consumes inputs and banks outputs', () => {
  it('refines alloy from ore, consuming exactly the inputs', () => {
    addItem('copper_ore', 3);
    addItem('iron_trace', 2);
    const res = craft(RECIPES.refined_alloy, ALL_STATIONS);
    expect(res.ok).toBe(true);
    expect(getItemCount('refined_alloy')).toBe(1);
    expect(getItemCount('copper_ore')).toBe(1); // 3 - 2
    expect(getItemCount('iron_trace')).toBe(1); // 2 - 1
  });

  it('does not consume anything on a failed craft', () => {
    addItem('copper_ore', 1); // not enough (needs 2)
    const res = craft(RECIPES.refined_alloy, ALL_STATIONS);
    expect(res.ok).toBe(false);
    expect(getItemCount('copper_ore')).toBe(1);
    expect(getItemCount('refined_alloy')).toBe(0);
  });

  it('a Maw upgrade consumes the prior tier', () => {
    addItem('iron_maw', 1);
    addItem('cryo_cell', 1);
    addItem('logic_wafer', 1);
    expect(craft(RECIPES.frost_maw, ALL_STATIONS).ok).toBe(true);
    expect(getItemCount('frost_maw')).toBe(1);
    expect(getItemCount('iron_maw')).toBe(0); // upgraded away
  });

  it('full chain: raw resources -> refined -> component -> Iron Maw', () => {
    // Smelt a strut frame's worth of refined stock.
    addItem('copper_ore', 6); addItem('iron_trace', 3); // -> 3 refined_alloy
    craft(RECIPES.refined_alloy, ALL_STATIONS);
    craft(RECIPES.refined_alloy, ALL_STATIONS);
    craft(RECIPES.refined_alloy, ALL_STATIONS);
    addItem('biofiber', 2); addItem('resin', 1); craft(RECIPES.biocomposite, ALL_STATIONS);
    addItem('silica', 2); craft(RECIPES.silica_pane, ALL_STATIONS);
    expect(craft(RECIPES.strut_frame, ALL_STATIONS).ok).toBe(true); // uses 2 alloy + 1 biocomposite
    expect(craft(RECIPES.logic_wafer, ALL_STATIONS).ok).toBe(true); // uses 1 pane + 1 alloy
    expect(craft(RECIPES.iron_maw, ALL_STATIONS).ok).toBe(true);
    expect(getItemCount('iron_maw')).toBe(1);
  });
});

describe('recipeReady', () => {
  it('is true when station matches and no tech gate', () => {
    expect(recipeReady(RECIPES.iron_maw, ALL_STATIONS)).toBe(true);
  });
  it('is false when the station is out of reach', () => {
    expect(recipeReady(RECIPES.iron_maw, { stations: ['smelter'] })).toBe(false);
  });
});
