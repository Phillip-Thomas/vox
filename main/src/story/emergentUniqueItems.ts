import type { ItemId } from '../game/data/items.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { recordAccomplishment } from '../game/systems/accomplishmentLedger.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import type { CommandContext } from '../game/commands.ts';
import { dispatchStoryAuthorityCommand } from '../game/storyAuthorityDispatch.ts';

export const EMERGENT_UNIQUE_ITEM_MILESTONES = {
  mawRepairKit: 'story:item:maw-repair-kit:acquired',
  keelMemory: 'story:item:kestrel-keel-memory:acquired',
  keelMemoryBanked: 'story:item:kestrel-keel-memory:banked'
} as const;

export type EmergentUniqueItemId = 'maw_repair_kit' | 'kestrel_keel_memory';

export interface UniqueItemCommitResult {
  ok: boolean;
  idempotent: boolean;
  itemId: EmergentUniqueItemId;
  pending?: boolean;
}

export function acquireEmergentUniqueItemAuthoritatively(
  context: CommandContext,
  itemId: EmergentUniqueItemId,
  eventId: string
): UniqueItemCommitResult {
  const lane = dispatchStoryAuthorityCommand(context, {
    commandId: eventId,
    commandType: 'story_item_acquired',
    payload: { itemId }
  });
  if (lane === 'pending') return { ok: true, idempotent: false, itemId, pending: true };
  if (lane === 'blocked') return { ok: false, idempotent: false, itemId };
  return acquireEmergentUniqueItem(itemId, eventId, context.actorId);
}

/**
 * Grants each authored story object once. The milestone is the durable receipt:
 * after the repair kit is consumed, reload/replay cannot manufacture another.
 * If a pre-receipt save already owns the object, migration records ownership
 * without increasing its count.
 */
export function acquireEmergentUniqueItem(
  itemId: EmergentUniqueItemId,
  eventId: string,
  actorId?: ActorId
): UniqueItemCommitResult {
  const actor = actorId ?? getLocalActorId();
  const milestone = milestoneFor(itemId);
  if (hasMilestone(milestone, actor)) return { ok: true, idempotent: true, itemId };

  if (getItemCount(itemId, actor) <= 0) addItem(itemId, 1, actor);
  markMilestone(milestone, actor);
  if (itemId === 'maw_repair_kit') {
    emitEmergentStoryEvent({
      id: eventId,
      type: 'maw_repair_kit_acquired',
      actorId: actor,
      payload: { itemId }
    });
  } else {
    emitEmergentStoryEvent({
      id: eventId,
      type: 'keel_memory_acquired',
      actorId: actor,
      payload: { componentId: itemId }
    });
  }
  return { ok: true, idempotent: false, itemId };
}

export function bankKestrelKeelMemory(
  eventId: string,
  oxygen: number,
  actorId?: ActorId
): UniqueItemCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actor)) {
    return { ok: true, idempotent: true, itemId: 'kestrel_keel_memory' };
  }
  if (!hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actor)
    || getItemCount('kestrel_keel_memory', actor) <= 0) {
    return { ok: false, idempotent: false, itemId: 'kestrel_keel_memory' };
  }
  const safeOxygen = Number.isFinite(oxygen) ? Math.max(0, Math.min(100, oxygen)) : 0;
  markMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actor);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'keel_memory_banked',
    actorId: actor,
    payload: { componentId: 'kestrel_keel_memory', oxygen: safeOxygen }
  });
  recordAccomplishment('returned_with_keel_memory', {
    id: eventId,
    sourceKey: 'story-event',
    data: { oxygen: safeOxygen }
  }, actor);
  emitEmergentStoryEvent({
    id: `${eventId}:accomplishment`,
    type: 'accomplishment_recorded',
    actorId: actor,
    payload: { accomplishmentId: 'returned_with_keel_memory' }
  });
  return { ok: true, idempotent: false, itemId: 'kestrel_keel_memory' };
}

export function bankKestrelKeelMemoryAuthoritatively(
  context: CommandContext,
  eventId: string,
  oxygen: number
): UniqueItemCommitResult {
  const lane = dispatchStoryAuthorityCommand(context, {
    commandId: eventId,
    commandType: 'story_item_banked',
    payload: {
      itemId: 'kestrel_keel_memory',
      oxygen: Number.isFinite(oxygen) ? Math.max(0, Math.min(100, oxygen)) : 0
    }
  });
  if (lane === 'pending') {
    return { ok: true, idempotent: false, itemId: 'kestrel_keel_memory', pending: true };
  }
  if (lane === 'blocked') {
    return { ok: false, idempotent: false, itemId: 'kestrel_keel_memory' };
  }
  return bankKestrelKeelMemory(eventId, oxygen, context.actorId);
}

export function hasBankedKestrelKeelMemory(actorId?: ActorId): boolean {
  return hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actorId);
}

function milestoneFor(itemId: ItemId): string {
  return itemId === 'maw_repair_kit'
    ? EMERGENT_UNIQUE_ITEM_MILESTONES.mawRepairKit
    : EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory;
}
