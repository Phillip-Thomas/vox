import { describe, it, expect, beforeEach } from 'vitest';
import {
  PROGRESSION_OWNERSHIP,
  getCurrentEra,
  isEraAtLeast,
  advanceEraTo,
  markMilestone,
  hasMilestone,
  resetProgression
} from './progressionSystem.ts';
import {
  getMawCharge, isMawPowered, addMawCharge, consumeMawCharge, refuelFromInventory,
  repairMaw, resetAllMawState, MAX_MAW_CHARGE, BIOFUEL_CHARGE
} from './mawSystem.ts';
import { addItem, getItemCount, resetAllInventories } from './inventorySystem.ts';
import { getEquippedToolTier, ensureStarterLoadout } from './loadoutSystem.ts';

beforeEach(() => { resetProgression(); resetAllMawState(); resetAllInventories(); });

describe('progression / eras', () => {
  it('starts in the Primitive era', () => {
    expect(getCurrentEra()).toBe('primitive');
    expect(isEraAtLeast('primitive')).toBe(true);
    expect(isEraAtLeast('emergent')).toBe(false);
  });

  it('advances forward only — a lower target is ignored', () => {
    advanceEraTo('emergent');
    expect(getCurrentEra()).toBe('emergent');
    advanceEraTo('primitive'); // cannot regress
    expect(getCurrentEra()).toBe('emergent');
    advanceEraTo('paravox_machina');
    expect(getCurrentEra()).toBe('paravox_machina');
  });

  it('tracks milestones', () => {
    expect(hasMilestone('x')).toBe(false);
    markMilestone('x');
    expect(hasMilestone('x')).toBe(true);
  });

  it('is classified and stored as per-player progression', () => {
    expect(PROGRESSION_OWNERSHIP.scope).toBe('per_player');

    advanceEraTo('emergent', 'alice');
    markMilestone('maw_repaired', 'alice');

    expect(getCurrentEra('alice')).toBe('emergent');
    expect(hasMilestone('maw_repaired', 'alice')).toBe(true);
    expect(getCurrentEra('bob')).toBe('primitive');
    expect(hasMilestone('maw_repaired', 'bob')).toBe(false);
    expect(isEraAtLeast('emergent', 'bob')).toBe(false);
  });
});

describe('maw charge', () => {
  it('starts drained (cold open: out of charge)', () => {
    expect(getMawCharge()).toBe(0);
    expect(isMawPowered()).toBe(false);
  });

  it('clamps charge to the max and never below zero', () => {
    addMawCharge(9999);
    expect(getMawCharge()).toBe(MAX_MAW_CHARGE);
    consumeMawCharge(9999);
    expect(getMawCharge()).toBe(0);
  });

  it('auto-loads a Biofuel only when empty, consuming one from inventory', () => {
    addItem('biofuel', 2);
    expect(refuelFromInventory()).toBe(true);
    expect(getMawCharge()).toBe(BIOFUEL_CHARGE);
    expect(getItemCount('biofuel')).toBe(1);
    // Not empty now → refuel is a no-op (doesn't burn a second Biofuel).
    expect(refuelFromInventory()).toBe(false);
    expect(getItemCount('biofuel')).toBe(1);
  });

  it('does nothing when empty with no Biofuel', () => {
    expect(refuelFromInventory()).toBe(false);
    expect(getMawCharge()).toBe(0);
  });
});

describe('maw repair = the bridge into Emergent', () => {
  it('repairing the Faulty Maw yields the charge-free Iron Maw and advances the era', () => {
    ensureStarterLoadout(); // grants the Faulty Maw
    expect(getEquippedToolTier()).toBe(0);
    expect(getCurrentEra()).toBe('primitive');

    expect(repairMaw()).toBe(true);
    expect(getItemCount('faulty_maw')).toBe(0);
    expect(getItemCount('iron_maw')).toBe(1);
    expect(getEquippedToolTier()).toBe(1);      // can now cut stone/ore
    expect(getCurrentEra()).toBe('emergent');
    expect(hasMilestone('maw_repaired')).toBe(true);
  });

  it('repairing one actor\'s Maw does not advance another actor', () => {
    ensureStarterLoadout('alice');
    ensureStarterLoadout('bob');

    expect(repairMaw('alice')).toBe(true);

    expect(getItemCount('iron_maw', 'alice')).toBe(1);
    expect(getCurrentEra('alice')).toBe('emergent');
    expect(hasMilestone('maw_repaired', 'alice')).toBe(true);
    expect(getItemCount('faulty_maw', 'bob')).toBe(1);
    expect(getCurrentEra('bob')).toBe('primitive');
    expect(hasMilestone('maw_repaired', 'bob')).toBe(false);
  });

  it('fails (and does not advance) with no Faulty Maw to repair', () => {
    expect(repairMaw()).toBe(false);
    expect(getCurrentEra()).toBe('primitive');
  });
});
