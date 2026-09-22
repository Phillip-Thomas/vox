import { fnv1a32 } from '../../utils/worldCoordinates.ts';
import { BAR_LEVEL_QUANTUM, BAR_TABU, GESTURE_TABU, PHRASE_TABU } from './tuning.ts';

// --- Phrase memory (§7.3) — anti-repetition you can measure ------------------------------------
//
// Every rendered phrase hashes via fnv1a32 over (chordIds, operatorChain,
// rhythmMask, registerBand). A tabu list forbids the last PHRASE_TABU exact
// hashes (~8–12 min); a coarser operator-chain-only hash has a short tabu
// (GESTURE_TABU) against gesture-level ruts. The P4 soak asserts ZERO tabu
// violations across a 30-minute render — this module is what makes
// anti-repetition measured, not vibes.

export interface PhraseDescriptor {
  /**
   * Chord ids sounded across the phrase, in order (theory.triadId strings),
   * consecutive holds collapsed. The causal window at statement time: the
   * just-completed phrase plus the chord under the statement's first bar —
   * the rest of the new phrase is undrawn when the fingerprint is taken.
   */
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
  /** Last BAR_TABU whole-bar fingerprints, oldest first (Stage 5 whole-bar law). */
  bars: number[];
}

export function createPhraseMemory(): PhraseMemory {
  return { phrases: [], gestures: [], bars: [] };
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

// --- Whole-bar fingerprint law (Stage 5) -------------------------------------------------------------
//
// The soak already fingerprinted every rendered bar (chord + arrangement +
// ostinato + percussion) to REPORT novelty; Stage 5 makes the same fingerprint
// a LAW. Every planned bar hashes its sounding content — chord, pad voicing,
// arrangement state, statement chain, ostinato notes, percussion onsets and
// the quantized layer levels — and may not recur inside BAR_TABU bars. On a
// collision the conductor applies the cheapest legal variation operator and
// re-checks; the bypass is an audited exception with a budget (soak.ts).

export interface BarDescriptor {
  chordId: string;
  /** Upper pad voices, semitones above A1 (the voicing, not just the chord). */
  uppers: readonly number[];
  arrangement: string;
  melodyChain: string | null;
  /** Ostinato notes as `slot:semis`, in order. */
  ostinato: readonly string[];
  /** Percussion onset slots, ascending. */
  percussion: readonly number[];
  /** Layer levels in a stable order; quantized to BAR_LEVEL_QUANTUM inside the hash. */
  levels: readonly number[];
}

/** Quantize a level to the fingerprint's dynamic quantum (two bars closer than this share a dynamic). */
export function quantizeBarLevel(level: number): number {
  return Math.round(level / BAR_LEVEL_QUANTUM) * BAR_LEVEL_QUANTUM;
}

/** Whole-bar identity hash (fnv1a32 over the descriptor's stable serialization). */
export function hashBar(d: BarDescriptor): number {
  const levels = d.levels.map((l) => quantizeBarLevel(l).toFixed(2)).join(',');
  return fnv1a32(
    `${d.chordId}|${d.uppers.join('.')}|${d.arrangement}|${d.melodyChain ?? ''}|${d.ostinato.join(',')}|${d.percussion.join(',')}|${levels}`
  );
}

/** True when the bar fingerprint has not sounded inside the last BAR_TABU bars. */
export function isBarAllowed(mem: PhraseMemory, barHash: number): boolean {
  return !mem.bars.includes(barHash);
}

/** Record a planned bar; the window trims to BAR_TABU. */
export function recordBar(mem: PhraseMemory, barHash: number): void {
  mem.bars.push(barHash);
  while (mem.bars.length > BAR_TABU) mem.bars.shift();
}
