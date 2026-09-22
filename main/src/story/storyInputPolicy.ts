import { getStoryStateSnapshot, subscribeStory, type StoryBeat } from './storyState.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import * as input from './beats/inputPrimitives.ts';
import type { StoryInputPolicy } from './beats/inputPrimitives.ts';
export * from './beats/inputPrimitives.ts';
import { BEAT_DEFINITIONS } from './beats/definitions.ts';

/** The public policy view is derived from the same authored declaration as the HUD. */
export function policyForBeat(beat: StoryBeat | null): StoryInputPolicy { return buildPolicyForBeat(beat); }

function buildPolicyForBeat(beat: StoryBeat | null): StoryInputPolicy {
  return beat ? { ...(BEAT_DEFINITIONS[beat]?.input ?? input.SANDBOX_POLICY) } : { ...input.SANDBOX_POLICY };
}

let current: StoryInputPolicy = input.SANDBOX_POLICY as StoryInputPolicy;

function refresh(): void {
  const story = getStoryStateSnapshot();
  // Registry first: a registered beat's contract carries its policy by value.
  const contract = story.active && story.beat ? BEAT_DEFINITIONS[story.beat] : null;
  current = contract
    ? { ...contract.input }
    : story.active ? buildPolicyForBeat(story.beat) : (input.SANDBOX_POLICY as StoryInputPolicy);
  // Dev affordance (mirrors `__storyBeat`): sampled by tools/story-ladder-trace.mjs.
  if (typeof window !== 'undefined') {
    (window as unknown as { __storyInputPolicy?: StoryInputPolicy }).__storyInputPolicy = current;
  }
}

subscribeStory(refresh);
refresh();

export function getStoryInputPolicy(): StoryInputPolicy {
  return current;
}

/**
 * Recipe knowledge survives Story handback independently of input/camera mode.
 * A repaired Kestrel keeps only the patterns actually earned through its
 * monotonic repair stages; an untouched sandbox retains its normal catalog.
 */
export function isFabricatorRecipeAllowed(id: string): boolean {
  const story = getStoryStateSnapshot();
  if (story.active) return current.recipeAllowed(id);
  return getShipRepairStage() === 'wrecked' ? true : input.ch9RecipeAllowed(id);
}

// --- director live-mutation hooks (no-ops against the frozen sandbox object) ----

function mutable(): StoryInputPolicy | null {
  return current === input.SANDBOX_POLICY ? null : current;
}

/** Timeline movement control (0 freezes; beat changes reset to the beat default). */
export function setStoryMoveScale(scale: number): void {
  const p = mutable();
  if (p) p.moveSpeedScale = scale;
}

/** A2 liberation: 0 = feed-locked look, 1 = free. Consumed by CameraControls. */
export function setStoryFeedBlend(blend: number): void {
  const p = mutable();
  if (p) p.feedBlend = Math.min(1, Math.max(0, blend));
}

/** The ch1 lift: 0 = side camera, 1 = first person. Consumed by CameraControls. */
export function setStorySideBlend(blend: number): void {
  const p = mutable();
  if (p) p.sideBlend = Math.min(1, Math.max(0, blend));
}

export function setStoryTargetFov(fov: number): void {
  const p = mutable();
  if (p) p.targetFov = fov;
}

/** A2 liberation: lerp the render crunch away (null restores the device dpr). */
export function setStoryTargetDpr(dpr: number | null): void {
  const p = mutable();
  if (p) p.targetDpr = dpr;
}

/** A2's final handoff flips the look free without waiting for a beat rebuild. */
export function setStoryLookMode(mode: 'free' | 'feed'): void {
  const p = mutable();
  if (p) p.lookMode = mode;
}
