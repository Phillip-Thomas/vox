import type * as THREE from 'three';
import type { ActiveInteraction } from '../game/systems/interactionSystem.ts';

// --- Story context interactions ---------------------------------------------------
//
// The story's [F] prompts (Touch the anomaly stone, Eat, Rest) resolve here,
// AHEAD of the sandbox interactions in EfficientPlayer's resolver. Story world
// components register live resolvers; outside story mode the list is empty and
// this is a single null-returning call.

export type StoryInteractionResolver = (
  camera: THREE.Camera | null,
  position: THREE.Vector3
) => (ActiveInteraction & { perform: () => void }) | null;

const resolvers = new Set<StoryInteractionResolver>();

/** Register a live story resolver (returns the unregister). */
export function registerStoryInteraction(resolver: StoryInteractionResolver): () => void {
  resolvers.add(resolver);
  return () => resolvers.delete(resolver);
}

/** Highest-priority branch of EfficientPlayer's interaction resolver. */
export function resolveStoryInteraction(
  camera: THREE.Camera | null,
  position: THREE.Vector3
): (ActiveInteraction & { perform: () => void }) | null {
  for (const resolver of resolvers) {
    const hit = resolver(camera, position);
    if (hit) return hit;
  }
  return null;
}
