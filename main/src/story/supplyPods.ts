import type * as THREE from 'three';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { addItem } from '../game/systems/inventorySystem.ts';
import { playSfx } from '../audio/sfxEngine.ts';

// --- Supply pods (the profile task row's final verb) --------------------------------
//
// Three supply pods sit ON the one physically traversable profile row. Recovering
// all three is the trigger that earns NAV VIEW, where the third axis becomes an
// honest playable space instead of something movie mode brute-forces with W/S +
// jetpack. Their loot feeds the ch3 campfire chain honestly. Collected state
// lives in milestones (`story:pod:<i>`) — zero new save fields.

export const SUPPLY_POD_COUNT = 3;

/** Per-pod loot — with the hull debris, covers the campfire chain end to end. */
const POD_LOOT: ReadonlyArray<ReadonlyArray<{ id: 'biofuel' | 'flint' | 'wood'; qty: number }>> = [
  [{ id: 'biofuel', qty: 1 }],
  [{ id: 'flint', qty: 1 }],
  [{ id: 'wood', qty: 1 }]
];

function milestoneFor(index: number): string {
  return `story:pod:${index}`;
}

export function isPodCollected(index: number): boolean {
  return hasMilestone(milestoneFor(index));
}

export function collectedPodCount(): number {
  let count = 0;
  for (let i = 0; i < SUPPLY_POD_COUNT; i++) if (isPodCollected(i)) count++;
  return count;
}

export function supplyPodsComplete(): boolean {
  return collectedPodCount() >= SUPPLY_POD_COUNT;
}

/** Walk-over collection: grants the pod's loot exactly once. */
export function collectPod(index: number): void {
  if (isPodCollected(index)) return;
  markMilestone(milestoneFor(index));
  for (const loot of POD_LOOT[index] ?? [{ id: 'wood', qty: 1 }]) {
    addItem(loot.id, loot.qty);
  }
  playSfx('terminalKey');
}

// Live pod positions (registered by SupplyPods for the autopilot's recovery run).
let positions: THREE.Vector3[] = [];

export function setSupplyPodPositions(next: THREE.Vector3[]): void {
  positions = next;
}

export function getSupplyPodPositions(): readonly THREE.Vector3[] {
  return positions;
}

/** Dev-jump seeding: mark every pod collected + grant the totals. */
export function seedSupplyPodsCollected(): void {
  for (let i = 0; i < SUPPLY_POD_COUNT; i++) {
    if (!isPodCollected(i)) {
      markMilestone(milestoneFor(i));
      for (const loot of POD_LOOT[i] ?? []) addItem(loot.id, loot.qty);
    }
  }
}
