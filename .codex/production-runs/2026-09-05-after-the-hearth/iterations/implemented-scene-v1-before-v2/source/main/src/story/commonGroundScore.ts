// --- Common Ground (ch13) score adapter ---------------------------------------------
//
// EXISTING FACADE ONLY. Six moods, six cue bindings, taken verbatim from the
// signed score lane. No engine, no graph, no node, no bundle, no hit, no note
// scheduler and no new instrument: every value below is submitted through
// `storyScore.ts`'s existing `setStoryScoreMoodOverride` / `setScoreBeat` pair,
// which is the same door chapters 7, 8 and 10 already use.
//
// One behaviour here is genuinely new, and it is bounded to five seconds: the
// final completion's live-only texture. Deactivation clears the score
// immediately today, and the signed lane asks for exactly one exception at that
// cleanup — a live token that survives the handback frame, releases through the
// EXISTING 4.5-second fade, and is cancelled by every listed trigger. It is
// never hydrated, never replayed and never deferred until an unlock.

import type { ScoreMood } from '../audio/scoreEngine.ts';
import type { StoryBeat } from './storyState.ts';
import {
  clearStoryScoreMoodOverride,
  setScoreBeat,
  setStoryScoreMoodOverride
} from './storyScore.ts';

/** The six signed moods. Ids are the contract's `cueRef` values. */
export type CommonGroundMoodId =
  | 'restored-home'
  | 'unreconciled'
  | 'demonstrating'
  | 'refused-hold'
  | 'revised'
  | 'independent-action-settled';

/**
 * Verbatim from `scene-score-lane.json#/moods`.
 *
 * The relationships are the point and are worth reading as music: `restored-home`
 * is the only triangle and the only one with a melody — the home is the one place
 * in this chapter that sings. Everything at the audit site is the same square
 * fifth-and-tritone colour, and the four survey moods differ ONLY in their
 * pattern: demonstration thins the home's pulse to two hits, refusal empties the
 * bar entirely (refusal as subtraction, the ch4-comply law), revision puts the
 * tritone back on the offbeat, and the settled ending adds the fifth on the last
 * eighth. Nothing gets louder; the spacing changes.
 */
const CG_MOODS: Readonly<Record<CommonGroundMoodId, ScoreMood>> = Object.freeze({
  'restored-home': Object.freeze({
    chord: [0, 4, 7, 10],
    progression: [[0, 4, 7, 10], [0, 7, 12]],
    melody: { scale: [0, 2, 4, 7, 9, 10, 12, 14], density: 0.12 },
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 56, wave: 'triangle', octave: 12,
    baseline: 0.26, pad: 0.12, sub: 0.07, ost: 0.018, riser: 0
  }),
  unreconciled: Object.freeze({
    chord: [0, 6, 7],
    progression: [[0, 6, 7], [0, 1, 7]],
    pattern: [0, null, null, 6, null, null, 7, null],
    tempo: 58, wave: 'square', octave: 24,
    baseline: 0.28, pad: 0.075, sub: 0.07, ost: 0.025, riser: 0
  }),
  demonstrating: Object.freeze({
    chord: [0, 6, 7],
    progression: [[0, 6, 7], [0, 1, 7]],
    pattern: [0, null, null, null, null, null, 7, null],
    tempo: 58, wave: 'square', octave: 24,
    baseline: 0.24, pad: 0.065, sub: 0.065, ost: 0.018, riser: 0
  }),
  'refused-hold': Object.freeze({
    chord: [0, 1, 7],
    pattern: [null, null, null, null, null, null, null, null],
    tempo: 58, wave: 'square', octave: 24,
    baseline: 0.18, pad: 0.045, sub: 0.055, ost: 0, riser: 0
  }),
  revised: Object.freeze({
    chord: [0, 6, 7],
    progression: [[0, 6, 7], [0, 1, 7]],
    pattern: [0, null, null, 6, null, null, null, null],
    tempo: 58, wave: 'square', octave: 24,
    baseline: 0.24, pad: 0.065, sub: 0.065, ost: 0.018, riser: 0
  }),
  'independent-action-settled': Object.freeze({
    chord: [0, 6, 7],
    progression: [[0, 6, 7], [0, 1, 7]],
    pattern: [0, null, null, 6, null, null, null, 7],
    tempo: 58, wave: 'square', octave: 24,
    baseline: 0.24, pad: 0.065, sub: 0.065, ost: 0.018, riser: 0
  })
} as Record<CommonGroundMoodId, ScoreMood>);

export function commonGroundMood(id: CommonGroundMoodId): ScoreMood {
  return CG_MOODS[id];
}

export const COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS = 5;

export type CommonGroundScoreCancelReason =
  | 'new-story'
  | 'optional-survey-action'
  | 'actor-change'
  | 'world-change'
  | 'reset'
  | 'exit'
  | 'pause'
  | 'visibility-loss'
  | 'music-mute'
  | 'audio-unavailable';

interface CommonGroundScoreRuntime {
  beat: StoryBeat | null;
  mood: CommonGroundMoodId | null;
  /** Live-only final texture. Never serialized, never restored. */
  finalTexture: { beat: StoryBeat; elapsed: number } | null;
}

const runtime: CommonGroundScoreRuntime = { beat: null, mood: null, finalTexture: null };

/**
 * Publish a mood ONCE PER SEMANTIC VARIANT EDGE.
 *
 * Re-submitting the same variant is suppressed here rather than in the engine,
 * because a per-frame resubmission is what would turn a held texture into a
 * stutter and make every sample of a trace sound like an event. Nothing in this
 * chapter is scored per sample.
 */
export function setCommonGroundMood(beat: StoryBeat, mood: CommonGroundMoodId): boolean {
  if (runtime.beat === beat && runtime.mood === mood) return false;
  runtime.beat = beat;
  runtime.mood = mood;
  setStoryScoreMoodOverride(beat, CG_MOODS[mood]);
  return true;
}

export function enterCommonGroundScoreBeat(beat: StoryBeat | null): void {
  if (beat === null) {
    runtime.beat = null;
    runtime.mood = null;
    return;
  }
  if (runtime.beat !== beat) {
    runtime.mood = null;
    runtime.beat = beat;
  }
}

export interface CommonGroundFinalTextureEligibility {
  /** True when the completion was ALREADY true in the loaded save. */
  restoredCompletion: boolean;
  /** True when the audio output cannot carry it at this exact edge. */
  audioUnavailable?: boolean;
}

/**
 * Begin the live-only final texture, at the ACTUAL first completion.
 *
 * THE TEST IS THE COMPLETION EDGE, NOT THE SNAPSHOT'S PROVENANCE. A save that
 * already carried the reciprocal proof has nothing to acknowledge, and a receipt
 * read is not an event. But a save loaded halfway through the chapter is also
 * "hydrated", and the completion the player then physically earns is a first
 * completion in every sense that matters — using the snapshot-wide flag as the
 * predicate would ban the texture for every Continue forever.
 *
 * Audio being unavailable or muted at this edge CANCELS eligibility outright.
 * It is not queued for a later unlock: the moment is the moment.
 */
export function beginCommonGroundFinalTexture(
  beat: StoryBeat,
  eligibility: CommonGroundFinalTextureEligibility
): boolean {
  if (eligibility.restoredCompletion || eligibility.audioUnavailable) return false;
  if (runtime.finalTexture) return false;
  setCommonGroundMood(beat, 'independent-action-settled');
  runtime.finalTexture = { beat, elapsed: 0 };
  return true;
}

export function commonGroundFinalTextureHolds(): boolean {
  return runtime.finalTexture !== null;
}

/**
 * Advance the live token. Returns true on the frame it releases.
 *
 * The deadline releases PRESENTATION INTENT ONLY. Controls, progression and the
 * guidance retirement all happened at the commit; nothing waits on this.
 */
export function tickCommonGroundFinalTexture(dtSeconds: number): boolean {
  const token = runtime.finalTexture;
  if (!token) return false;
  token.elapsed += Math.max(0, dtSeconds);
  if (token.elapsed < COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS) return false;
  releaseCommonGroundFinalTexture();
  return true;
}

/** The normal release: hand back to the existing 4.5-second complementary fade. */
function releaseCommonGroundFinalTexture(): void {
  const token = runtime.finalTexture;
  runtime.finalTexture = null;
  if (!token) return;
  setScoreBeat(null);
  clearStoryScoreMoodOverride(token.beat);
  runtime.beat = null;
  runtime.mood = null;
}

/**
 * Cancel immediately on any signed trigger. A cancelled token never resumes,
 * never hydrates and never defers to unlock — it is simply gone, and the
 * existing click-free release owns the tail.
 */
export function cancelCommonGroundFinalTexture(_reason: CommonGroundScoreCancelReason): boolean {
  if (!runtime.finalTexture) return false;
  releaseCommonGroundFinalTexture();
  return true;
}

/** Chapter exit: drop local ownership without touching any other chapter's. */
export function releaseCommonGroundScore(beat: StoryBeat | null): void {
  cancelCommonGroundFinalTexture('exit');
  if (beat) clearStoryScoreMoodOverride(beat);
  runtime.beat = null;
  runtime.mood = null;
}

export function resetCommonGroundScoreRuntime(): void {
  runtime.beat = null;
  runtime.mood = null;
  runtime.finalTexture = null;
}

/** Test/diagnostic read; never a progression authority. */
export function getCommonGroundScoreDiagnostic(): {
  readonly beat: StoryBeat | null;
  readonly mood: CommonGroundMoodId | null;
  readonly finalTextureSeconds: number | null;
} {
  return {
    beat: runtime.beat,
    mood: runtime.mood,
    finalTextureSeconds: runtime.finalTexture?.elapsed ?? null
  };
}
