import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEquippedToolTier, getHazardProtection, getScanLevel, getWarpRange,
  ensureStarterLoadout, STARTER_TOOL
} from './loadoutSystem.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';

beforeEach(() => resetInventory());

describe('getEquippedToolTier', () => {
  it('is 0 (bare-handed) with an empty inventory', () => {
    expect(getEquippedToolTier()).toBe(0);
  });

  it('reflects the highest Maw owned, not the most recently added', () => {
    addItem('arc_maw', 1);   // tier 3
    addItem('iron_maw', 1);  // tier 1
    expect(getEquippedToolTier()).toBe(3);
  });

  it('ignores non-tool items', () => {
    addItem('stone', 99);
    addItem('charge_cell', 5);
    expect(getEquippedToolTier()).toBe(0);
  });
});

describe('survival / scan / warp derivations', () => {
  it('hazard protection sums from owned suits, max per hazard', () => {
    expect(getHazardProtection('extreme_cold')).toBe(0);
    addItem('thermal_carapace', 1);
    expect(getHazardProtection('extreme_cold')).toBeGreaterThan(0);
    expect(getHazardProtection('radiation')).toBe(0); // wrong suit
    addItem('shielded_carapace', 1);
    expect(getHazardProtection('radiation')).toBeGreaterThan(0);
  });

  it('scan level is the best Survey Lens owned, baseline 1', () => {
    expect(getScanLevel()).toBe(1);
    addItem('survey_lens_2', 1);
    expect(getScanLevel()).toBe(2);
    addItem('survey_lens_4', 1);
    expect(getScanLevel()).toBe(4);
  });

  it('warp range adds per Range Coil owned, baseline 1', () => {
    expect(getWarpRange()).toBe(1);
    addItem('range_coil', 2);
    expect(getWarpRange()).toBe(3);
  });
});

describe('ensureStarterLoadout', () => {
  it('grants the starter Maw exactly once (idempotent across calls)', () => {
    ensureStarterLoadout();
    ensureStarterLoadout();
    expect(getItemCount(STARTER_TOOL)).toBe(1);
    expect(getEquippedToolTier()).toBe(1);
  });

  it('does not grant if a (different) tool is already owned', () => {
    addItem('frost_maw', 1);
    ensureStarterLoadout();
    expect(getItemCount(STARTER_TOOL)).toBe(0);
    expect(getEquippedToolTier()).toBe(2);
  });
});
