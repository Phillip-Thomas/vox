import { beforeEach, describe, expect, it } from 'vitest';
import { ECONOMY_CATALOG } from '../data/generatedEconomyCatalog.ts';
import type { ItemId, ItemStack } from '../data/items.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';
import { resetProgression } from './progressionSystem.ts';
import { resetShipRestoration } from './shipRestoration.ts';
import { resetAccomplishments } from './accomplishmentLedger.ts';
import { resetEmergentStoryEvents } from '../../story/emergentStoryEvents.ts';
import { acquireEmergentUniqueItem, bankKestrelKeelMemory } from '../../story/emergentUniqueItems.ts';
import {
  claimWreckSalvage,
  commitShipRepairTransaction,
  SHIP_REPAIR_STAGE_COSTS,
  WRECK_SALVAGE
} from './shipRepairTransactions.ts';
import { isTidegardenRouteOnline } from '../../story/tidegardenRoute.ts';

describe('canonical ship repair transactions', () => {
  beforeEach(() => {
    resetInventory();
    resetProgression();
    resetShipRestoration();
    resetAccomplishments();
    resetEmergentStoryEvents();
  });

  it('grants the finite wreck salvage once', () => {
    expect(claimWreckSalvage('wreck:salvage')).toBe(true);
    expect(claimWreckSalvage('wreck:salvage')).toBe(false);
    for (const stack of WRECK_SALVAGE) expect(getItemCount(stack.id)).toBe(stack.qty);
  });

  it('requires the banked memory, debits every stage, and unlocks the route once', () => {
    acquireEmergentUniqueItem('kestrel_keel_memory', 'keel:free');
    expect(commitShipRepairTransaction('repair:bench', 'bench_online').ok).toBe(false);
    bankKestrelKeelMemory('keel:shore', 72);
    expect(commitShipRepairTransaction('repair:bench', 'bench_online')).toMatchObject({
      ok: true,
      idempotent: false,
      debited: [{ id: 'kestrel_keel_memory', qty: 1 }]
    });

    for (const stage of ['frame_restored', 'hull_sealed', 'lift_online', 'flight_ready'] as const) {
      for (const stack of SHIP_REPAIR_STAGE_COSTS[stage]) addItem(stack.id, stack.qty);
      const result = commitShipRepairTransaction(`repair:${stage}`, stage);
      expect(result.ok).toBe(true);
      for (const stack of SHIP_REPAIR_STAGE_COSTS[stage]) expect(getItemCount(stack.id)).toBe(0);
    }
    expect(isTidegardenRouteOnline()).toBe(true);
    expect(commitShipRepairTransaction('repair:flight_ready', 'flight_ready')).toMatchObject({
      ok: true,
      idempotent: true,
      debited: []
    });
  });

  it('leaves inventory untouched on an unaffordable or out-of-order stage', () => {
    addItem('refined_alloy', 1);
    expect(commitShipRepairTransaction('repair:frame', 'frame_restored').ok).toBe(false);
    expect(getItemCount('refined_alloy')).toBe(1);
  });

  it('freezes the self-contained authored repair BOM', () => {
    const stages = ['frame_restored', 'hull_sealed', 'lift_online', 'flight_ready'] as const;
    const total = expandStacks(stages.flatMap(stage => SHIP_REPAIR_STAGE_COSTS[stage]));
    expect(total).toEqual({
      biofiber: 6,
      copper_ore: 14,
      iron_trace: 7,
      resin: 3,
      silica: 4
    });
    const salvage = expandStacks(WRECK_SALVAGE);
    expect(subtract(total, salvage)).toEqual({});
  });
});

function expandStacks(stacks: readonly ItemStack[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const stack of stacks) merge(out, expand(stack.id, stack.qty));
  return sorted(out);
}

function expand(id: ItemId, qty: number): Record<string, number> {
  const recipe = ECONOMY_CATALOG.recipes.find(candidate => candidate.id === id);
  if (!recipe) return { [id]: qty };
  const out: Record<string, number> = {};
  for (const input of recipe.inputs) merge(out, expand(input.id, input.qty * qty));
  return out;
}

function merge(target: Record<string, number>, source: Record<string, number>): void {
  for (const [id, qty] of Object.entries(source)) target[id] = (target[id] ?? 0) + qty;
}

function subtract(total: Record<string, number>, debit: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, qty] of Object.entries(total)) {
    const remaining = qty - (debit[id] ?? 0);
    if (remaining > 0) out[id] = remaining;
  }
  return sorted(out);
}

function sorted(value: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
