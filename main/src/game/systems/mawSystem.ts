// --- Maw state (charge + repair) ---------------------------------------------
//
// The Maw arrives at the crash both DRAINED and DAMAGED:
//  - Charge (0..MAX) is consumed as you mine. At 0 it auto-loads a Biofuel from the
//    inventory; with no Biofuel you drop to slow bare-handed rates (the mining loop
//    applies that speed penalty). Charge governs SPEED, not capability.
//  - Capability is the tool tier (Faulty Maw = tier 0 → soft matter only). Repairing
//    the Maw converts it to the tier-1 `iron_maw` (charge-free) and advances the era
//    to Emergent — the reward for finishing the Primitive arc.
//
// Module-singleton, plain numeric state (persistence-ready). Charge starts at 0:
// the cold open is "forage by hand → craft Biofuel → power the Maw".

import { addItem, getItemCount, removeItem } from './inventorySystem.ts';
import { advanceEraTo, markMilestone } from './progressionSystem.ts';

export const MAX_MAW_CHARGE = 100;
/** Charge restored by loading one Biofuel. */
export const BIOFUEL_CHARGE = 50;
/** Charge spent per voxel broken with a charge-using tool. */
export const CHARGE_PER_BREAK = 4;

let charge = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function getMawCharge(): number {
  return charge;
}

export function getMawChargeFraction(): number {
  return charge / MAX_MAW_CHARGE;
}

export function isMawPowered(): boolean {
  return charge > 0;
}

export function addMawCharge(amount: number): void {
  if (amount <= 0) return;
  charge = Math.min(MAX_MAW_CHARGE, charge + amount);
  emit();
}

export function consumeMawCharge(amount: number): void {
  if (amount <= 0) return;
  charge = Math.max(0, charge - amount);
  emit();
}

/** Set charge directly (for restoring a save). */
export function setMawCharge(amount: number): void {
  charge = Math.max(0, Math.min(MAX_MAW_CHARGE, amount));
  emit();
}

/**
 * If the Maw is empty, burn one Biofuel from the inventory to refill it. Returns
 * true if a Biofuel was consumed. Called from the mining loop so refueling is
 * seamless — craft Biofuel and it loads itself when needed.
 */
export function refuelFromInventory(): boolean {
  if (charge > 0) return false;
  if (getItemCount('biofuel') <= 0) return false;
  if (removeItem('biofuel', 1)) {
    addMawCharge(BIOFUEL_CHARGE);
    return true;
  }
  return false;
}

/**
 * Repair the Faulty Maw into the charge-free tier-1 Maw and step into the Emergent
 * era. Requires owning the Faulty Maw. The MATERIAL cost (repair kit, ore, salvage)
 * is layered on by the crafting flow in a later phase; this is the canonical state
 * transition. Returns false if there is no Faulty Maw to repair.
 */
export function repairMaw(): boolean {
  if (!removeItem('faulty_maw', 1)) return false;
  addItem('iron_maw', 1);
  charge = 0; // the repaired Maw is self-powered; charge no longer applies
  emit();
  markMilestone('maw_repaired');
  advanceEraTo('emergent');
  return true;
}

export function resetMaw(): void {
  charge = 0;
  emit();
}

export function subscribeMaw(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
