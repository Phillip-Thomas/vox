// --- Systemic context interaction --------------------------------------------
//
// ONE primary interact key (F) whose meaning changes with context: open/close a
// door, drink at water, board the ship, eat, … A single resolver (in EfficientPlayer)
// picks the best available action each frame and publishes it here; the HUD shows a
// generic "[F] <verb>" prompt and F performs whatever is current. Adding an
// interaction = adding a resolver branch — no new key, no new prompt.

export type InteractionId =
  | 'door' | 'board' | 'drink'
  // story-mode prompts (resolved by story/storyInteractions.ts, highest priority)
  | 'story-anomaly' | 'story-eat' | 'story-rest'
  | 'story-field-kit' | 'story-maw-repair' | 'story-maw-pond-attend'
  | 'story-keel-free' | 'story-keel-bank'
  | 'story-wreck-diagnosis' | 'story-wreck-salvage' | 'story-ship-repair' | 'story-wreck-scar-attend'
  | 'story-board-hatch' | 'story-board-cancel'
  | 'story-audit-fire' | 'story-audit-life' | 'story-audit-tree'
  | 'story-comply-fire' | 'story-comply-organics' | 'story-refuse-tree'
  | 'story-tidegarden-attend' | 'story-tidegarden-record' | 'story-tidegarden-choose-site'
  | 'story-habitat-core' | 'story-habitat-certify' | 'story-habitat-rest'
  | 'story-tidegarden-choose-site';

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
