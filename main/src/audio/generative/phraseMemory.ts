import { fnv1a32 } from '../../utils/worldCoordinates.ts';
import { GESTURE_TABU, PHRASE_TABU } from './tuning.ts';

// --- Phrase memory (§7.3) — anti-repetition you can measure ------------------------------------
//
// Every rendered phrase hashes via fnv1a32 over (chordIds, operatorChain,
// rhythmMask, registerBand). A tabu list forbids the last PHRASE_TABU exact
// hashes (~8–12 min); a coarser operator-chain-only hash has a short tabu
// (GESTURE_TABU) against gesture-level ruts. The P4 soak asserts ZERO tabu
// violations across a 30-minute render — this module is what makes
// anti-repetition measured, not vibes.

export interface PhraseDescriptor {
  /** Chord ids sounded across the phrase, in order (theory.triadId strings). */
  chordIds: readonly string[];
  /** Serialized operator chain (motif.serializeOpChain). */
  operatorChain: string;
  /** Rhythm fingerprint (motif.figureRhythmMask). */
  rhythmMask: number;
  /** Register-band bucket (e.g. the rounded band center in semitones). */
  registerBand: number;
}

/** Exact-phrase identity hash. */
export function hashPhrase(d: PhraseDescriptor): number {
  return fnv1a32(`${d.chordIds.join(',')}|${d.operatorChain}|${d.rhythmMask}|${d.registerBand}`);
}

/** Coarse gesture identity: the operator chain alone. */
export function hashGesture(operatorChain: string): number {
  return fnv1a32(`gesture|${operatorChain}`);
}

export interface PhraseMemory {
  /** Last PHRASE_TABU exact phrase hashes, oldest first. */
  phrases: number[];
  /** Last GESTURE_TABU gesture hashes, oldest first. */
  gestures: number[];
}

export function createPhraseMemory(): PhraseMemory {
  return { phrases: [], gestures: [] };
}

/** True when neither the exact phrase nor its gesture is inside a tabu window. */
export function isPhraseAllowed(mem: PhraseMemory, phraseHash: number, gestureHash: number): boolean {
  return !mem.phrases.includes(phraseHash) && !mem.gestures.includes(gestureHash);
}

/** Record a rendered phrase; windows trim to PHRASE_TABU / GESTURE_TABU. */
export function recordPhrase(mem: PhraseMemory, phraseHash: number, gestureHash: number): void {
  mem.phrases.push(phraseHash);
  while (mem.phrases.length > PHRASE_TABU) mem.phrases.shift();
  mem.gestures.push(gestureHash);
  while (mem.gestures.length > GESTURE_TABU) mem.gestures.shift();
}
