// Pure trigger / retarget decision model for EfficientPlayer's hold-to-mine loop.
// Extracted from EfficientPlayer.updateMining so the acquisition edge, the
// retarget debounce, and the target-loss debounce are deterministically testable
// (node env) without Rapier physics, the voxel raycast, or an AudioContext.
//
// THE BUG THIS SOLVES: the raw `ms.key !== key` test fired a chip AND reset the
// charge on EVERY frame the rounded harvest coord flipped across a voxel
// boundary (physics micro-jitter, or a harvestable<->blocked flicker on the same
// cell). That machine-gunned the `mine`/`blocked` cue (clipped to the limiter
// floor into a ~9/s metronome) and — because the charge reset every flip — made
// extraction on a boundary impossible. Here, LEAVING the committed target (to a
// different key, or to a lost/null target) must PERSIST for a short debounce
// before it commits; a 1-few-frame flicker back to the incumbent cancels the
// pending change and keeps the charge running, silently.

/**
 * Consecutive frames a NEW candidate (a different key, or a lost/null target)
 * must persist before it displaces the committed harvest target. 5 frames is
 * ~83 ms at 60 fps: comfortably longer than the 1-3 frame boundary jitter this
 * rejects, yet short enough that a deliberate re-aim commits without felt lag.
 * Frame-counted (not milliseconds) because the jitter it rejects is inherently
 * per-frame, so the rejection stays consistent independent of frame time.
 */
export const RETARGET_DEBOUNCE_FRAMES = 5;

/**
 * A raw harvest candidate key for a frame, or null when nothing is targeted.
 * Blocked (un-harvestable) voxels use a '!'-prefixed key so they share the one
 * key space and are debounced by the exact same machine as harvestable targets
 * — that is what silences the harvestable<->blocked boundary flicker.
 */
export type MiningCandidate = string | null;

export interface MiningTriggerState {
  /** The key currently being charged (the incumbent), or null for no target. */
  committedKey: string | null;
  /** A candidate that differs from committedKey and is awaiting confirmation. */
  pendingKey: string | null;
  /** Consecutive frames `pendingKey` has persisted unchanged. */
  pendingFrames: number;
}

export type MiningChip = 'acquire' | 'blocked' | null;

export interface MiningTriggerDecision {
  /** The committed key AFTER this frame (what `ms.key` should become). */
  committedKey: string | null;
  /**
   * Which cue to sound this frame, if any. ONLY a true acquisition edge
   * (no-target -> target) chips; a confirmed retarget or a confirmed loss is
   * silent (the progress tick already voices an in-progress mine).
   */
  chip: MiningChip;
  /**
   * A new target became committed this frame (an acquisition edge OR a confirmed
   * retarget): the caller must (re)compute tool/duration and reset the charge.
   */
  commit: boolean;
}

export function createMiningTriggerState(): MiningTriggerState {
  return { committedKey: null, pendingKey: null, pendingFrames: 0 };
}

/** Return the machine to rest (call on key release / block break). */
export function resetMiningTriggerState(state: MiningTriggerState): void {
  state.committedKey = null;
  state.pendingKey = null;
  state.pendingFrames = 0;
}

function isBlockedKey(key: string | null): boolean {
  return key !== null && key.startsWith('!');
}

/**
 * Advance the trigger machine by one frame. Mutates and reflects `state` (a
 * per-player ref) and returns the frame's decision.
 *
 * Semantics:
 *  - committed === null (genuine rest) + a target this frame -> IMMEDIATE commit
 *    and an acquisition chip ('blocked' if the acquired key is un-harvestable,
 *    else 'acquire'). Acquiring from rest is responsive; no debounce.
 *  - committed !== null + the SAME candidate -> stay; cancel any pending change;
 *    keep the charge running.
 *  - committed !== null + a DIFFERENT candidate (or null) -> debounce: the new
 *    candidate must persist `debounceFrames` frames before it commits. On commit
 *    the charge resets (commit=true) but NO chip sounds (quiet retarget / quiet
 *    loss). A candidate that changes again restarts the count; a flicker back to
 *    the incumbent cancels the pending change entirely.
 */
export function advanceMiningTrigger(
  state: MiningTriggerState,
  candidate: MiningCandidate,
  debounceFrames: number = RETARGET_DEBOUNCE_FRAMES
): MiningTriggerDecision {
  // Candidate matches the incumbent: nothing is leaving. Cancel any pending
  // change and hold the charge.
  if (candidate === state.committedKey) {
    state.pendingKey = null;
    state.pendingFrames = 0;
    return { committedKey: state.committedKey, chip: null, commit: false };
  }

  // From genuine rest, the first real target is an acquisition edge: commit and
  // chip immediately (the debounce guards LEAVING a target, never ACQUIRING one).
  if (state.committedKey === null) {
    state.committedKey = candidate;
    state.pendingKey = null;
    state.pendingFrames = 0;
    return {
      committedKey: candidate,
      chip: isBlockedKey(candidate) ? 'blocked' : 'acquire',
      commit: true
    };
  }

  // Leaving a committed target (to a different key, or to null): debounce it.
  if (candidate === state.pendingKey) {
    state.pendingFrames += 1;
  } else {
    state.pendingKey = candidate;
    state.pendingFrames = 1;
  }

  if (state.pendingFrames >= debounceFrames) {
    // Sustained long enough: commit the change. A retarget resets the charge for
    // the new target; a confirmed loss (null) returns to rest so the NEXT real
    // target is a fresh acquisition edge that may chip again.
    state.committedKey = candidate;
    state.pendingKey = null;
    state.pendingFrames = 0;
    return { committedKey: candidate, chip: null, commit: true };
  }

  // Still inside the debounce window: keep charging the incumbent, silently.
  return { committedKey: state.committedKey, chip: null, commit: false };
}
