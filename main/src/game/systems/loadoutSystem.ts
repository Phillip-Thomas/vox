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
import { getItem, type ItemId } from '../data/items.ts';
import { addItem, getInventory, getItemCount } from './inventorySystem.ts';

// Baselines for a player carrying nothing. Tool tier 0 = bare-handed extraction
// of soft terrain (dirt/sand/grass/wood/stone); scan level 1 shows the most
// common deposits; warp range 1 is the starting jump radius.
const BASE_TOOL_TIER = 0;
const BASE_SCAN_LEVEL = 1;
const BASE_WARP_RANGE = 1;

function ownedItemIds(): ItemId[] {
  return (Object.entries(getInventory()) as [ItemId, number][])
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([id]) => id);
}

/** Highest mining tier among owned tools (the Maw line); BASE if none owned. */
export function getEquippedToolTier(): number {
  let tier = BASE_TOOL_TIER;
  for (const id of ownedItemIds()) {
    const def = getItem(id);
    if (def.kind === 'tool' && def.toolTier != null) tier = Math.max(tier, def.toolTier);
  }
  return tier;
}

/** Combined hazard protection from all owned suits (max per hazard). */
export function getSuitProtection(): Partial<Record<HazardId, number>> {
  const out: Partial<Record<HazardId, number>> = {};
  for (const id of ownedItemIds()) {
    const def = getItem(id);
    if (def.kind !== 'suit' || !def.hazardProtect) continue;
    for (const [hazard, value] of Object.entries(def.hazardProtect) as [HazardId, number][]) {
      out[hazard] = Math.max(out[hazard] ?? 0, value);
    }
  }
  return out;
}

/** Protection (0 = none) against a specific hazard. */
export function getHazardProtection(hazard: HazardId): number {
  return getSuitProtection()[hazard] ?? 0;
}

/** Live scanner level — gates which resources a planet survey reveals. */
export function getScanLevel(): number {
  let level = BASE_SCAN_LEVEL;
  for (const id of ownedItemIds()) {
    const eff = getItem(id).moduleEffect;
    if (eff?.scanLevel != null) level = Math.max(level, eff.scanLevel);
  }
  return level;
}

/** Live warp range — base plus every Range Coil owned. */
export function getWarpRange(): number {
  let range = BASE_WARP_RANGE;
  for (const id of ownedItemIds()) {
    const eff = getItem(id).moduleEffect;
    if (eff?.warpRangeAdd != null) range += eff.warpRangeAdd * getItemCount(id);
  }
  return range;
}

// --- Bootstrap ---------------------------------------------------------------
// Until crafting (Phase 2) exists, hand the player a starting Maw so the early
// loop (stone + base metals) is playable. Idempotent: only grants if no tool is
// owned, so it survives world swaps without stacking. Phase 2 replaces this with
// a real hand-craft recipe.
export const STARTER_TOOL: ItemId = 'iron_maw';

export function ensureStarterLoadout(): void {
  const ownsTool = ownedItemIds().some(id => getItem(id).kind === 'tool');
  if (!ownsTool) addItem(STARTER_TOOL, 1);
}
