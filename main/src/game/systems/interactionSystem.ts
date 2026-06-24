// --- Systemic context interaction --------------------------------------------
//
// ONE primary interact key (F) whose meaning changes with context: open/close a
// door, drink at water, board the ship, eat, … A single resolver (in EfficientPlayer)
// picks the best available action each frame and publishes it here; the HUD shows a
// generic "[F] <verb>" prompt and F performs whatever is current. Adding an
// interaction = adding a resolver branch — no new key, no new prompt.

export type InteractionId = 'door' | 'board' | 'drink';

export interface ActiveInteraction {
  id: InteractionId;
  verb: string; // shown in the prompt: "Open Door", "Enter Ship", "Drink", "Eat Wildberries"
}

let current: ActiveInteraction | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

export function getInteraction(): ActiveInteraction | null { return current; }

/** Publish the currently-available interaction (or null). Emits only on change. */
export function setInteraction(next: ActiveInteraction | null): void {
  if (current?.id === next?.id && current?.verb === next?.verb) return;
  current = next;
  emit();
}

export function subscribeInteraction(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
