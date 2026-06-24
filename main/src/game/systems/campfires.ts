// --- Placed campfires (stationary light sources) -----------------------------
//
// Crafting a Campfire places one at the player's feet; it stays put and lights the
// area. Module-singleton list of world positions (+ surface up for orientation),
// with a version + subscribe so the Campfires renderer updates. World-relative, so
// reset on world swap. Torches are NOT here — they're a carried light keyed off
// simply owning a torch (see PlayerTorch).

import * as THREE from 'three';

export interface Campfire {
  id: number;
  pos: [number, number, number];
  up: [number, number, number];
}

const campfires: Campfire[] = [];
let nextId = 1;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function placeCampfire(pos: THREE.Vector3, up: THREE.Vector3): void {
  campfires.push({ id: nextId++, pos: [pos.x, pos.y, pos.z], up: [up.x, up.y, up.z] });
  version++;
  emit();
}

export function getCampfires(): readonly Campfire[] {
  return campfires;
}

/** Re-insert campfires from a save (preserves positions; reissues ids). */
export function restoreCampfires(saved: ReadonlyArray<{ pos: [number, number, number]; up: [number, number, number] }>): void {
  for (const c of saved) campfires.push({ id: nextId++, pos: [...c.pos], up: [...c.up] });
  if (saved.length > 0) { version++; emit(); }
}

export function getCampfireVersion(): number {
  return version;
}

export function resetCampfires(): void {
  if (campfires.length > 0) {
    campfires.length = 0;
    version++;
    emit();
  }
}

export function subscribeCampfires(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
