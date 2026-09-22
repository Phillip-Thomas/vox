import type * as THREE from 'three';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { playSfx } from '../audio/sfxEngine.ts';

// --- Hull-debris salvage (the raster act's second verb) ------------------------------
//
// The descent scatters hull debris along the travel strip; recovering it is part
// of the ch1 objective and is where the campfire chain's timber/flint come from
// (trees don't resolve until A3 — the wreck provides). Collected state lives in
// milestones (`story:debris:<i>`) so it persists via the existing save with no
// new fields, and dev jumps can seed it like everything else.

// How many pieces this run scattered (voyage hull outcome). Milestone-backed so
// it survives reloads with zero new save fields.
const SCATTER_MARK = 'story:debris-scattered:';
const STONE_BACKFILL_MARK = 'story:debris-stone-backfill:v2';

export function setDebrisScattered(count: number): void {
  const clamped = Math.max(3, Math.min(6, Math.round(count)));
  markMilestone(`${SCATTER_MARK}${clamped}`);
}

export function getDebrisScattered(): number {
  // Highest marker wins (set once per save in practice).
  for (let n = 6; n >= 3; n--) {
    if (hasMilestone(`${SCATTER_MARK}${n}`)) return n;
  }
  return 4;
}

/**
 * Per-piece loot. The first three impact sites include four pieces of local
 * stone kicked loose by the crash, guaranteeing the raster quota on the same
 * row even on the minimum-debris voyage outcome. The hull material still
 * covers the later campfire chain (wood 3 / flint 2) by piece four.
 */
const DEBRIS_LOOT: ReadonlyArray<ReadonlyArray<{ id: 'wood' | 'flint' | 'stone'; qty: number }>> = [
  [{ id: 'wood', qty: 2 }, { id: 'stone', qty: 2 }],
  [{ id: 'flint', qty: 1 }, { id: 'stone', qty: 1 }],
  [{ id: 'wood', qty: 1 }, { id: 'stone', qty: 1 }],
  [{ id: 'flint', qty: 1 }],
  [{ id: 'wood', qty: 1 }],
  [{ id: 'wood', qty: 1 }]
];

/**
 * One-time migration for saves that collected debris before impact stone was
 * added to its loot. Crafting is disabled throughout ch1-raster, so topping the
 * current stone count up to the already-earned amount cannot replace legitimate
 * spending; it only restores rewards the old build never issued.
 */
export function backfillLegacyDebrisStone(): number {
  if (hasMilestone(STONE_BACKFILL_MARK)) return 0;
  let earned = 0;
  for (let index = 0; index < Math.min(3, getDebrisScattered()); index++) {
    if (!isDebrisCollected(index)) continue;
    for (const loot of DEBRIS_LOOT[index] ?? []) {
      if (loot.id === 'stone') earned += loot.qty;
    }
  }
  const restored = Math.max(0, earned - getItemCount('stone'));
  if (restored > 0) addItem('stone', restored);
  markMilestone(STONE_BACKFILL_MARK);
  return restored;
}

function milestoneFor(index: number): string {
  return `story:debris:${index}`;
}

export function isDebrisCollected(index: number): boolean {
  return hasMilestone(milestoneFor(index));
}

export function collectedDebrisCount(): number {
  let count = 0;
  const scattered = getDebrisScattered();
  for (let i = 0; i < scattered; i++) if (isDebrisCollected(i)) count++;
  return count;
}

export function debrisSalvageComplete(): boolean {
  return collectedDebrisCount() >= getDebrisScattered();
}

/** Walk-over collection: grants the piece's loot exactly once. */
export function collectDebris(index: number): void {
  if (isDebrisCollected(index)) return;
  markMilestone(milestoneFor(index));
  for (const loot of DEBRIS_LOOT[index] ?? [{ id: 'wood', qty: 1 }]) {
    addItem(loot.id, loot.qty);
  }
  playSfx('terminalKey');
}

// Live piece positions (registered by DebrisField for the autopilot's sweep).
let positions: THREE.Vector3[] = [];

export function setDebrisPositions(next: THREE.Vector3[]): void {
  positions = next;
}

export function getDebrisPositions(): readonly THREE.Vector3[] {
  return positions;
}

/** Dev-jump seeding: mark every piece collected + grant the totals. */
export function seedDebrisCollected(): void {
  const scattered = getDebrisScattered();
  for (let i = 0; i < scattered; i++) {
    if (!isDebrisCollected(i)) {
      markMilestone(milestoneFor(i));
      for (const loot of DEBRIS_LOOT[i] ?? []) addItem(loot.id, loot.qty);
    }
  }
}
