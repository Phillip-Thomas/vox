// --- Placed campfires (stationary light sources) -----------------------------
//
// Crafting a Campfire places one at the player's feet; it stays put and lights the
// area. Module-singleton list of world positions (+ surface up for orientation),
// with a version + subscribe so the Campfires renderer updates. World-relative, so
// reset on world swap. Torches are NOT here — they're a carried light keyed off
// simply owning a torch (see PlayerTorch).

import * as THREE from 'three';
import { getLocalActorId, type ActorId } from '../playerActors.ts';

export interface Campfire {
  id: number;
  pos: [number, number, number];
  up: [number, number, number];
  ownerId?: ActorId;
  placedBy?: ActorId;
}

const campfires: Campfire[] = [];
let nextId = 1;
let version = 0;
const listeners = new Set<() => void>();
const DUPLICATE_EPSILON = 0.0001;

function emit() {
  listeners.forEach(l => l());
}

function ownership(actorId?: ActorId): Pick<Campfire, 'ownerId' | 'placedBy'> {
  const id = actorId ?? getLocalActorId();
  return { ownerId: id, placedBy: id };
}

export function placeCampfire(pos: THREE.Vector3, up: THREE.Vector3, actorId?: ActorId): void {
  campfires.push({ id: nextId++, pos: [pos.x, pos.y, pos.z], up: [up.x, up.y, up.z], ...ownership(actorId) });
  version++;
  emit();
}

export function getCampfires(): readonly Campfire[] {
  return campfires;
}

/** Re-insert campfires from a save (preserves positions; reissues ids). */
export function restoreCampfires(saved: ReadonlyArray<Omit<Campfire, 'id'>>): void {
  let added = 0;
  for (const c of saved) {
    if (campfires.some(existing => sameCampfire(existing, c))) continue;
    campfires.push({ ...c, id: nextId++, pos: [...c.pos], up: [...c.up] });
    added++;
  }
  if (added > 0) { version++; emit(); }
}

export function removeCampfireIfOwnedBy(
  pos: readonly [number, number, number],
  up: readonly [number, number, number],
  actorId: ActorId
): boolean {
  const index = campfires.findIndex(campfire =>
    sameVec3(campfire.pos, pos)
    && sameVec3(campfire.up, up)
    && (campfire.ownerId ?? campfire.placedBy) === actorId
  );
  if (index < 0) return false;
  campfires.splice(index, 1);
  version++;
  emit();
  return true;
}

export function removeCampfireAt(
  pos: readonly [number, number, number],
  up: readonly [number, number, number]
): boolean {
  const index = campfires.findIndex(campfire => sameVec3(campfire.pos, pos) && sameVec3(campfire.up, up));
  if (index < 0) return false;
  campfires.splice(index, 1);
  version++;
  emit();
  return true;
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

function sameCampfire(a: Omit<Campfire, 'id'>, b: Omit<Campfire, 'id'>): boolean {
  return sameVec3(a.pos, b.pos)
    && sameVec3(a.up, b.up)
    && a.ownerId === b.ownerId
    && a.placedBy === b.placedBy;
}

function sameVec3(a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
  return Math.abs(a[0] - b[0]) <= DUPLICATE_EPSILON
    && Math.abs(a[1] - b[1]) <= DUPLICATE_EPSILON
    && Math.abs(a[2] - b[2]) <= DUPLICATE_EPSILON;
}
