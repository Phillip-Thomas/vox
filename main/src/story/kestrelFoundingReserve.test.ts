import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES } from '../game/data/recipes.ts';
import { getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import { craft } from '../game/systems/craftingSystem.ts';
import {
  claimKestrelFoundingReserve,
  KESTREL_FOUNDING_RESERVE,
  KESTREL_FOUNDING_RESERVE_MILESTONE
} from './kestrelFoundingReserve.ts';

describe('Kestrel founding reserve migration', () => {
  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetShipRestoration();
  });

  it('grants exactly one complete Habitat Core BOM after Ch7 flight readiness', () => {
    expect(claimKestrelFoundingReserve('founding:early')).toMatchObject({
      ok: false,
      reason: 'ship-not-flight-ready'
    });
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    expect(claimKestrelFoundingReserve('founding:claim')).toEqual({
      ok: true,
      idempotent: false
    });
    for (const stack of KESTREL_FOUNDING_RESERVE) {
      expect(getItemCount(stack.id)).toBe(stack.qty);
    }
    expect(hasMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE)).toBe(true);
    expect(claimKestrelFoundingReserve('founding:claim')).toEqual({
      ok: true,
      idempotent: true
    });
    expect(craft(RECIPES.habitat_core, { stations: ['assembler'] })).toMatchObject({ ok: true });
    expect(getItemCount('habitat_core')).toBe(1);
  });
});
