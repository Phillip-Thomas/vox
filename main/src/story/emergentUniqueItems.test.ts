import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { getAccomplishment, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  acquireEmergentUniqueItem,
  bankKestrelKeelMemory,
  EMERGENT_UNIQUE_ITEM_MILESTONES,
  hasBankedKestrelKeelMemory
} from './emergentUniqueItems.ts';

describe('emergent unique story items', () => {
  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetAccomplishments();
    resetEmergentStoryEvents();
  });

  it('grants the repair kit once and never duplicates a consumed receipt', () => {
    expect(acquireEmergentUniqueItem('maw_repair_kit', 'pack:opened')).toMatchObject({
      ok: true,
      idempotent: false
    });
    expect(getItemCount('maw_repair_kit')).toBe(1);
    expect(acquireEmergentUniqueItem('maw_repair_kit', 'pack:opened')).toMatchObject({
      ok: true,
      idempotent: true
    });
    expect(getItemCount('maw_repair_kit')).toBe(1);
    expect(getEmergentStoryEvents()).toHaveLength(1);
  });

  it('migrates pre-receipt ownership without adding a second unique item', () => {
    addItem('kestrel_keel_memory', 1);
    acquireEmergentUniqueItem('kestrel_keel_memory', 'keel:freed');
    expect(getItemCount('kestrel_keel_memory')).toBe(1);
    expect(hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory)).toBe(true);
  });

  it('banks the keel memory only after acquisition and records evidence once', () => {
    expect(bankKestrelKeelMemory('dive:shore', 64).ok).toBe(false);
    acquireEmergentUniqueItem('kestrel_keel_memory', 'keel:freed');
    expect(bankKestrelKeelMemory('dive:shore', 64)).toMatchObject({ ok: true, idempotent: false });
    expect(bankKestrelKeelMemory('dive:shore', 5)).toMatchObject({ ok: true, idempotent: true });
    expect(hasBankedKestrelKeelMemory()).toBe(true);
    expect(getAccomplishment('returned_with_keel_memory')?.evidenceHistory).toHaveLength(1);
    expect(getEmergentStoryEvents().map(event => event.type)).toEqual([
      'keel_memory_acquired',
      'keel_memory_banked',
      'accomplishment_recorded'
    ]);
  });
});
