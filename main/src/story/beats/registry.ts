import type { StoryBeat, StoryChapter } from '../storyState.ts';
import type { BeatContract } from './beatContract.ts';

// --- The beat registry ---------------------------------------------------------------
//
// Generated chapter indexes register the authored contracts. Exhaustiveness
// fails when any declared story beat is missing; historical comparisons use
// the frozen ladder trace, never a second runtime implementation.

const contracts = new Map<StoryBeat, BeatContract>();

export function registerBeat(contract: BeatContract): void {
  if (contracts.has(contract.id)) {
    throw new Error(`Beat ${contract.id} is registered twice.`);
  }
  contracts.set(contract.id, contract);
}

export function getBeatContract(beat: StoryBeat): BeatContract | null {
  return contracts.get(beat) ?? null;
}

/**
 * The beat a chapter re-enters the story through from `done` free play, or
 * null when the chapter has no such door. Chapter 10 is the first; the station
 * chapter is expected to be the second. Batch 4.
 */
export function chapterReactivationBeat(chapter: StoryChapter): StoryBeat | null {
  for (const contract of contracts.values()) {
    if (contract.chapter === chapter && contract.entry === 'reactivation-from-done') return contract.id;
  }
  return null;
}

export function registeredBeats(): readonly StoryBeat[] {
  return [...contracts.keys()];
}

/** Test/diagnostic helper. */
export function clearBeatRegistry(): void {
  contracts.clear();
}
