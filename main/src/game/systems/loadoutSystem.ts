// --- Loadout (live player capability, DERIVED from inventory) ----------------
//
// This is the seam that turns the static gameplay constants into progression.
// Instead of a hardcoded PLAYER_TOOL_TIER, the player's capabilities are PURE
// derivations over what they own: the best Maw owned sets the mining tier, owned
// Carapaces sum into hazard protection, the best Survey Lens sets scan level, and
// Range Coils extend warp range.
//
// Deriving from inventory (rather than a separate equipment store) means there is
// no second source of truth to keep in sync, and the whole progression state is
// already serializable via the inventory snapshot. "Owned == equipped" for the
// first pass; an explicit equip/slots layer can wrap this later without changing
// callers (they only see the getters).

import type { HazardId } from '../data/planetArchetypes.ts';
import { getItem, type HarvestClass, type ItemDefinition, type ItemId } from '../data/items.ts';
import { addItem, getInventory, getItemCount } from './inventorySystem.ts';
import type { ActorId } from '../playerActors.ts';

// Baselines for a player carrying nothing. Tool tier 0 = bare-handed extraction
// of soft terrain (dirt/sand/grass/wood/stone); scan level 1 shows the most
// common deposits; warp range 1 is the starting jump radius.
const BASE_TOOL_TIER = 0;
const BASE_SCAN_LEVEL = 1;
const BASE_WARP_RANGE = 1;

function ownedItemIds(actorId?: ActorId): ItemId[] {
  return (Object.entries(getInventory(actorId)) as [ItemId, number][])
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([id]) => id);
}

/** The best (highest tool tier) tool currently owned, or null if none. */
export function getEquippedTool(actorId?: ActorId): ItemDefinition | null {
  let best: ItemDefinition | null = null;
  for (const id of ownedItemIds(actorId)) {
    const def = getItem(id);
    if (def.kind !== 'tool') continue;
    if (!best || (def.toolTier ?? 0) > (best.toolTier ?? 0)) best = def;
  }
  return best;
}

/** Highest mining tier among owned tools (capability gate); BASE if none owned. */
export function getEquippedToolTier(actorId?: ActorId): number {
  return Math.max(BASE_TOOL_TIER, getEquippedTool(actorId)?.toolTier ?? BASE_TOOL_TIER);
}

/** A tool's speed for a given material class (its override, else its default, else 1). */
export function toolSpeedFor(tool: ItemDefinition | null, klass: HarvestClass): number {
  if (!tool) return 1;
  return tool.harvestSpeed?.[klass] ?? tool.mineSpeedMul ?? 1;
}

/**
 * Pick the best owned tool to harvest a given material class — the "right tool for
 * the job": among tools strong enough (toolTier ≥ requiredTier), the one with the
 * highest speed for that class. So the Hatchet wins on wood and the Pickaxe is used
 * on stone, regardless of which has the higher tier. Null if nothing qualifies.
 */
export function selectTool(klass: HarvestClass, requiredTier: number, actorId?: ActorId): ItemDefinition | null {
  let best: ItemDefinition | null = null;
  let bestSpeed = -1;
  for (const id of ownedItemIds(actorId)) {
    const def = getItem(id);
    if (def.kind !== 'tool' || (def.toolTier ?? 0) < requiredTier) continue;
    const speed = toolSpeedFor(def, klass);
    if (speed > bestSpeed) { best = def; bestSpeed = speed; }
  }
  return best;
}

/** True while the player still carries a charge-using tool (the Faulty Maw) — the
 *  signal for whether the charge meter is relevant (gone once the Maw is repaired). */
export function ownsChargeTool(actorId?: ActorId): boolean {
  return ownedItemIds(actorId).some(id => getItem(id).usesCharge === true);
}

/** Combined hazard protection from all owned suits (max per hazard). */
export function getSuitProtection(actorId?: ActorId): Partial<Record<HazardId, number>> {
  const out: Partial<Record<HazardId, number>> = {};
  for (const id of ownedItemIds(actorId)) {
    const def = getItem(id);
    if (def.kind !== 'suit' || !def.hazardProtect) continue;
    for (const [hazard, value] of Object.entries(def.hazardProtect) as [HazardId, number][]) {
      out[hazard] = Math.max(out[hazard] ?? 0, value);
    }
  }
  return out;
}

/** Protection (0 = none) against a specific hazard. */
export function getHazardProtection(hazard: HazardId, actorId?: ActorId): number {
  return getSuitProtection(actorId)[hazard] ?? 0;
}

/** Live scanner level — gates which resources a planet survey reveals. */
export function getScanLevel(actorId?: ActorId): number {
  let level = BASE_SCAN_LEVEL;
  for (const id of ownedItemIds(actorId)) {
    const eff = getItem(id).moduleEffect;
    if (eff?.scanLevel != null) level = Math.max(level, eff.scanLevel);
  }
  return level;
}

/** Live warp range — base plus every Range Coil owned. */
export function getWarpRange(actorId?: ActorId): number {
  let range = BASE_WARP_RANGE;
  for (const id of ownedItemIds(actorId)) {
    const eff = getItem(id).moduleEffect;
    if (eff?.warpRangeAdd != null) range += eff.warpRangeAdd * getItemCount(id, actorId);
  }
  return range;
}

// --- Bootstrap ---------------------------------------------------------------
// Until crafting (Phase 2) exists, hand the player a starting Maw so the early
// loop (stone + base metals) is playable. Idempotent: only grants if no tool is
// owned, so it survives world swaps without stacking. Phase 2 replaces this with
// a real hand-craft recipe.
export const STARTER_TOOL: ItemId = 'faulty_maw';

export function ensureStarterLoadout(actorId?: ActorId): void {
  const ownsTool = ownedItemIds(actorId).some(id => getItem(id).kind === 'tool');
  if (!ownsTool) addItem(STARTER_TOOL, 1, actorId);
}
