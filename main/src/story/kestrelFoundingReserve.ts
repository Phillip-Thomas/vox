import type { CommandContext } from '../game/commands.ts';
import { ECONOMY_CATALOG } from '../game/data/generatedEconomyCatalog.ts';
import type { ItemStack } from '../game/data/items.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { addItem } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { dispatchStoryAuthorityCommand } from '../game/storyAuthorityDispatch.ts';

export const KESTREL_FOUNDING_RESERVE_MILESTONE = 'story:kestrel:founding-reserve-claimed';
export const KESTREL_FOUNDING_RESERVE: readonly ItemStack[] =
  ECONOMY_CATALOG.storyTransactions.kestrelFoundingReserve.map(stack => ({ ...stack }));

export interface KestrelFoundingReserveResult {
  ok: boolean;
  idempotent: boolean;
  pending?: boolean;
  reason?: 'ship-not-flight-ready' | 'authority-blocked';
}

/**
 * One migration-safe founding loadout, separate from Ch7's already-consumed
 * wreck cache. Existing saves and fresh runs therefore reach the same Ch9 BOM.
 */
export function claimKestrelFoundingReserve(
  eventId: string,
  actorId: ActorId = getLocalActorId(),
  commandContext?: CommandContext
): KestrelFoundingReserveResult {
  if (hasMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE, actorId)) {
    return { ok: true, idempotent: true };
  }
  if (getShipRepairStage() !== 'flight_ready') {
    return { ok: false, idempotent: false, reason: 'ship-not-flight-ready' };
  }
  if (commandContext) {
    const lane = dispatchStoryAuthorityCommand(commandContext, {
      commandId: eventId,
      commandType: 'kestrel_founding_reserve_claimed',
      payload: { reserveId: 'tidegarden-founding-loadout' }
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') {
      return { ok: false, idempotent: false, reason: 'authority-blocked' };
    }
  }
  applyKestrelFoundingReserve(KESTREL_FOUNDING_RESERVE, actorId);
  return { ok: true, idempotent: false };
}

/** Replication boundary; the server's canonical outputs remain authoritative. */
export function applyKestrelFoundingReserve(
  outputs: readonly ItemStack[],
  actorId: ActorId = getLocalActorId()
): boolean {
  if (hasMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE, actorId)) return false;
  for (const stack of outputs) addItem(stack.id, stack.qty, actorId);
  markMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE, actorId);
  return true;
}
