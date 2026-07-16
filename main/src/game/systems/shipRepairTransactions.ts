import { ECONOMY_CATALOG } from '../data/generatedEconomyCatalog.ts';
import type { ItemStack } from '../data/items.ts';
import { addItem, getItemCount, hasItems, removeItem } from './inventorySystem.ts';
import { hasMilestone, markMilestone } from './progressionSystem.ts';
import { recordAccomplishment } from './accomplishmentLedger.ts';
import {
  commitShipRepairStage,
  getShipRestorationSnapshot,
  type ShipRepairResult
} from './shipRestoration.ts';
import type { ShipRepairStage } from '../../story/emergentCapabilities.ts';
import { emitEmergentStoryEvent } from '../../story/emergentStoryEvents.ts';
import { hasBankedKestrelKeelMemory } from '../../story/emergentUniqueItems.ts';
import type { ActorId } from '../playerActors.ts';
import type { StationId } from '../data/stations.ts';

export const WRECK_SALVAGE_MILESTONE = 'story:salvage:kestrel:claimed';
export const WRECK_BENCH_STATIONS = ['smelter', 'assembler'] as const satisfies readonly StationId[];

export const WRECK_SALVAGE: readonly ItemStack[] =
  ECONOMY_CATALOG.storyTransactions.wreckSalvage.map(stack => ({ ...stack }));

export const SHIP_REPAIR_STAGE_COSTS: Readonly<Record<Exclude<ShipRepairStage, 'wrecked'>, readonly ItemStack[]>> = {
  bench_online: catalogStageCosts('bench_online'),
  frame_restored: catalogStageCosts('frame_restored'),
  hull_sealed: catalogStageCosts('hull_sealed'),
  lift_online: catalogStageCosts('lift_online'),
  flight_ready: catalogStageCosts('flight_ready')
};

export interface ShipRepairTransactionResult extends ShipRepairResult {
  debited: ItemStack[];
}

/** Finite authority-owned salvage; the milestone prevents reload farming. */
export function claimWreckSalvage(eventId: string, actorId?: ActorId): boolean {
  if (hasMilestone(WRECK_SALVAGE_MILESTONE, actorId)) return false;
  for (const stack of WRECK_SALVAGE) addItem(stack.id, stack.qty, actorId);
  markMilestone(WRECK_SALVAGE_MILESTONE, actorId);
  recordAccomplishment('wreck_salvage_recovered', {
    id: eventId,
    sourceKey: 'wreck-salvage'
  }, actorId);
  return true;
}

/**
 * Atomically debits the canonical stage BOM and advances the versioned ship.
 * Replaying the same stable event is free and idempotent; a different event may
 * not skip or repeat a stage. Bench installation additionally requires that the
 * Keel Memory was honestly banked on shore.
 */
export function commitShipRepairTransaction(
  eventId: string,
  target: Exclude<ShipRepairStage, 'wrecked'>,
  actorId?: ActorId
): ShipRepairTransactionResult {
  const snapshot = getShipRestorationSnapshot();
  const replay = snapshot.repairHistory.find(entry => entry.eventId === eventId);
  if (replay) {
    const result = commitShipRepairStage(eventId, target, actorId);
    if (result.ok && target === 'bench_online') ensureWreckBenchStationEvents(eventId, actorId);
    return { ...result, debited: [] };
  }
  if (target === 'bench_online' && !hasBankedKestrelKeelMemory(actorId)) {
    return failure(snapshot, 'out-of-order');
  }
  const costs = SHIP_REPAIR_STAGE_COSTS[target].map(stack => ({ ...stack }));
  if (!hasItems(costs, actorId)) return failure(snapshot, 'out-of-order');

  for (const stack of costs) removeItem(stack.id, stack.qty, actorId);
  const committed = commitShipRepairStage(eventId, target, actorId);
  if (!committed.ok) {
    for (const stack of costs) addItem(stack.id, stack.qty, actorId);
    return { ...committed, debited: [] };
  }
  if (target === 'bench_online') ensureWreckBenchStationEvents(eventId, actorId);

  // Intermediate stages are evidence inside one meaningful accomplishment,
  // not four trophy-like ledger entries. The final monotonic transaction is
  // the single player-facing "The Wreck Stands" fact.
  const accomplishmentId = 'the_wreck_stands';
  if (target === 'flight_ready' && recordAccomplishment(accomplishmentId, {
    id: eventId,
    sourceKey: 'ship-repair-stage',
    data: { stage: target }
  }, actorId)) {
    emitEmergentStoryEvent({
      id: `${eventId}:accomplishment`,
      type: 'accomplishment_recorded',
      actorId,
      payload: { accomplishmentId }
    });
  }
  return { ...committed, debited: costs };
}

/** Reconstruct the bench's two runtime capabilities without duplicating facts. */
export function ensureWreckBenchStationEvents(eventIdInput: string, actorId?: ActorId): number {
  const eventId = eventIdInput.trim();
  if (!eventId) return 0;
  let emitted = 0;
  for (const stationId of WRECK_BENCH_STATIONS) {
    if (emitEmergentStoryEvent({
      id: `${eventId}:station:${stationId}:activated`,
      type: 'station_activated',
      actorId,
      payload: { stationId }
    })) emitted++;
  }
  return emitted;
}

export function canAffordShipRepairStage(
  target: Exclude<ShipRepairStage, 'wrecked'>,
  actorId?: ActorId
): boolean {
  return SHIP_REPAIR_STAGE_COSTS[target].every(stack => getItemCount(stack.id, actorId) >= stack.qty);
}

function failure(
  state: ReturnType<typeof getShipRestorationSnapshot>,
  reason: ShipRepairResult['reason']
): ShipRepairTransactionResult {
  return { ok: false, idempotent: false, reason, state, debited: [] };
}

function catalogStageCosts(
  stage: Exclude<ShipRepairStage, 'wrecked'>
): ItemStack[] {
  const entry = ECONOMY_CATALOG.storyTransactions.shipRepairStages.find(candidate => candidate.stage === stage);
  if (!entry) throw new Error(`Missing canonical ship repair stage: ${stage}`);
  return entry.inputs.map(stack => ({ ...stack }));
}
