import type { ScoreMood } from '../scoreEngine.ts';
import { pcMod } from './theory.ts';
import { nearestPitchInBand } from './voiceLeading.ts';

// --- MOODS as constraints (audio-10x Stage 3, §6.4 / contract sc.chain.tonic-authority) ---------------
//
// Pure. A story mood is no longer a literal semitone stack the pad jumps between:
// it is a CONSTRAINT the harmony grammar voices under. Every entry's pitch-class
// set must be present in the output; bass = chord root at every change; the
// progression order is kept verbatim; tempo, cell and levels are untouched. The
// only freedom is the octave placement of the inner voices, chosen by minimal
// motion from the previous voicing — so the same chords are heard with the
// same roots and the same colours, and only the voice leading is new.
//
// Voicing policies (MOOD_VOICING_OVERRIDES in storyScore.ts choose per entry):
//   literal     — the shipped stack, transposed by the chain tonic only.
//   subtractive — literal; a chord written as a subtraction (ch4-comply
//                 [[0,6],[0,1]], refused, seam-ebb) may never be re-voiced fuller.
//   ordered     — literal; a4-exhale opens one member at a time and the order is
//                 the meaning.
//   brain       — bass = root; the inner voices move by minimal displacement
//                 inside the mood's own register band, every pitch class kept,
//                 the written tight intervals (a semitone or whole step — the
//                 dread, the ch10 floor) preserved EXACTLY (none lost, none
//                 added), and no voice ever jumps further than the composer's
//                 own jump for that change (the literal is always a candidate).
//
// Migration law: with every entry 'literal' this module is the identity
// (render-hash proven), so the layer is proven inert before it is proven better.

export type MoodVoicingPolicy = 'literal' | 'brain' | 'subtractive' | 'ordered';

export interface MoodHarmonyConstraint {
  /** Chain tonic, semitones above A1 — the ONE transposition of the whole mood. */
  tonicSemis: number;
  /** Union of every chord's pitch classes after transposition — must be present. */
  pitchClassSet: number[];
  /** The authored progression (or the single static chord), untransposed. */
  chordSequence: readonly (readonly number[])[];
  bassPolicy: 'root';
  /** The pad's voice budget: tones past it are not voiced (shipped behaviour). */
  maxVoices: number;
  /** Upper-voice register band after transposition (from the authored uppers). */
  registerBand: { lo: number; hi: number };
  tempo: number;
  ostinatoCell: readonly (number | null)[];
  /** The policy the entry is voiced under AFTER the gain guard (see `requestedPolicy`). */
  voicingPolicy: MoodVoicingPolicy;
  /** The policy the table asked for; differs from `voicingPolicy` only when the gain guard demoted 'brain' to 'literal'. */
  requestedPolicy: MoodVoicingPolicy;
  /**
   * Gain guard (brain only): over two cycles of the progression the brain walk
   * must never move a voice further than the composer's written jump for that
   * change AND must strictly reduce the total inner-voice motion; otherwise the
   * entry stays literal and the reason is recorded here.
   */
  brainGuard: 'applied' | 'no-gain' | 'exceeds-written-jump' | 'not-requested';
  /** Per-chord dissonance 0..1 (semitone / whole-step / tritone pairs over pairs). Derived, not written to the rails. */
  tensionCurve: number[];
}

/** Intervals a voicing must keep literally: the written semitone and whole step. */
export const TIGHT_INTERVAL_MAX = 2;
/** Minimum band width so every pitch class has an instance (nearestPitchInBand law). */
const BAND_MIN_WIDTH = 11;

const PERMS_BY_N: Record<number, ReadonlyArray<readonly number[]>> = {
  0: [[]],
  1: [[0]],
  2: [[0, 1], [1, 0]],
  3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
};

export function chordPitchClasses(chord: readonly number[]): number[] {
  return [...new Set(chord.map(pcMod))].sort((a, b) => a - b);
}

/** Sorted absolute intervals ≤ TIGHT_INTERVAL_MAX between any two tones (each pair once). */
export function tightIntervals(chord: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < chord.length; i++) {
    for (let j = i + 1; j < chord.length; j++) {
      const d = Math.abs(chord[i] - chord[j]);
      if (d > 0 && d <= TIGHT_INTERVAL_MAX) out.push(d);
    }
  }
  return out.sort((a, b) => a - b);
}

function chordTension(chord: readonly number[]): number {
  const pcs = chordPitchClasses(chord);
  if (pcs.length < 2) return 0;
  let tense = 0;
  let pairs = 0;
  for (let i = 0; i < pcs.length; i++) {
    for (let j = i + 1; j < pcs.length; j++) {
      const d = Math.min(pcMod(pcs[j] - pcs[i]), pcMod(pcs[i] - pcs[j]));
      pairs++;
      if (d === 1 || d === 2 || d === 6) tense++;
    }
  }
  return pairs === 0 ? 0 : tense / pairs;
}

export function deriveMoodConstraint(
  mood: Pick<ScoreMood, 'chord' | 'progression' | 'tempo' | 'pattern'>,
  tonicSemis: number,
  voicingPolicy: MoodVoicingPolicy,
  maxVoices = 4
): MoodHarmonyConstraint {
  const chordSequence: readonly (readonly number[])[] =
    mood.progression && mood.progression.length > 0 ? mood.progression : [mood.chord];
  const pcs = new Set<number>();
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const chord of chordSequence) {
    const voiced = chord.slice(0, maxVoices);
    for (const tone of voiced) pcs.add(pcMod(tone + tonicSemis));
    for (const upper of voiced.slice(1)) {
      lo = Math.min(lo, upper + tonicSemis);
      hi = Math.max(hi, upper + tonicSemis);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = tonicSemis + 1;
    hi = lo + BAND_MIN_WIDTH;
  }
  if (hi - lo < BAND_MIN_WIDTH) hi = lo + BAND_MIN_WIDTH;
  const base: MoodHarmonyConstraint = {
    tonicSemis,
    pitchClassSet: [...pcs].sort((a, b) => a - b),
    chordSequence,
    bassPolicy: 'root',
    maxVoices,
    registerBand: { lo, hi },
    tempo: mood.tempo,
    ostinatoCell: mood.pattern,
    voicingPolicy,
    requestedPolicy: voicingPolicy,
    brainGuard: 'not-requested',
    tensionCurve: chordSequence.map(chordTension)
  };
  if (voicingPolicy !== 'brain' || chordSequence.length < 2) return base;
  const guard = evaluateBrainGain(base);
  return { ...base, voicingPolicy: guard === 'applied' ? 'brain' : 'literal', brainGuard: guard };
}

/**
 * The gain guard: walk two cycles literal and brain; the brain applies only when
 * it never exceeds a written jump at any change and strictly lowers the total.
 */
export function evaluateBrainGain(c: MoodHarmonyConstraint): 'applied' | 'no-gain' | 'exceeds-written-jump' {
  const brainC: MoodHarmonyConstraint = { ...c, voicingPolicy: 'brain' };
  const literalC: MoodHarmonyConstraint = { ...c, voicingPolicy: 'literal' };
  const literal = resolveMoodVoicingSequence(literalC, 2);
  const brain = resolveMoodVoicingSequence(brainC, 2);
  let literalTotal = 0;
  let brainTotal = 0;
  for (let k = 1; k < literal.length; k++) {
    const l = voiceDisplacement(literal[k - 1].slice(1, c.maxVoices), literal[k].slice(1, c.maxVoices));
    const b = voiceDisplacement(brain[k - 1].slice(1, c.maxVoices), brain[k].slice(1, c.maxVoices));
    if (b.max > l.max) return 'exceeds-written-jump';
    literalTotal += l.total;
    brainTotal += b.total;
  }
  return brainTotal < literalTotal ? 'applied' : 'no-gain';
}

/** The authored stack, transposed by the chain tonic — the identity path. */
export function literalVoicing(chord: readonly number[], tonicSemis: number): number[] {
  return chord.map((tone) => tone + tonicSemis);
}

export interface VoiceDisplacement {
  total: number;
  max: number;
}

/** Displacement of the voices both chords voice (voice i → voice i). */
export function voiceDisplacement(prev: readonly number[], next: readonly number[]): VoiceDisplacement {
  const n = Math.min(prev.length, next.length);
  let total = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(next[i] - prev[i]);
    total += d;
    if (d > max) max = d;
  }
  return { total, max };
}

/** The candidate's tight intervals must EQUAL the written ones: nothing lost, nothing new. */
function sameTightIntervals(chord: readonly number[], required: readonly number[]): boolean {
  const have = tightIntervals(chord);
  if (have.length !== required.length) return false;
  for (let i = 0; i < have.length; i++) if (have[i] !== required[i]) return false;
  return true;
}

/**
 * Voice chord `index` (cyclic over the progression) given the previous voicing.
 * Literal policies (and the opening of any policy) return the transposed stack;
 * 'brain' returns the minimal-motion re-voicing described above. Two ceilings
 * bound it: the candidate's tight intervals must EQUAL the written ones, and
 * no voice may jump further than the composer's own written jump for this
 * change (literal[prev] → literal[index], wrap included); the written stack is
 * always a candidate, so the result is never worse than the literal on the
 * largest move and never worse on the total.
 */
export function voiceMoodChord(
  c: MoodHarmonyConstraint,
  index: number,
  prev: readonly number[] | null
): number[] {
  const length = c.chordSequence.length;
  const k = ((index % length) + length) % length;
  const literal = c.chordSequence[k];
  // The FULL authored stack is published (hits, the bed and the legacy drones read
  // every tone); the pad voices only the first `maxVoices`, so the brain re-voices
  // those and appends any remaining literal tones untouched.
  const literalOut = literalVoicing(literal, c.tonicSemis);
  const voiced = literal.slice(0, c.maxVoices);
  if (c.voicingPolicy !== 'brain' || !prev || prev.length === 0 || voiced.length <= 1) return literalOut;
  const tail = literalOut.slice(voiced.length);
  // Voice 0 is the chord ROOT, literal: the published root and the sub's pitch.
  // The other pad voices are free inside the mood's own register band — they
  // may sit below the root voice (an inversion) because the sub, not this
  // voice, is the bass; only the root's identity is the constraint.
  const bass = literalOut[0];
  const upperPcs = voiced.slice(1).map((tone) => pcMod(tone + c.tonicSemis));
  const n = upperPcs.length;
  const perms = PERMS_BY_N[n];
  if (!perms) return literalOut;
  const lo = c.registerBand.lo;
  const hi = Math.max(c.registerBand.hi, lo + BAND_MIN_WIDTH);
  const literalVoiced = literalOut.slice(0, voiced.length);
  const required = tightIntervals(literalVoiced);
  const bandCenter = (lo + hi) / 2;
  const displacementFrom = (from: readonly number[], out: readonly number[]): { total: number; max: number } => {
    let total = 0;
    let max = 0;
    const m = Math.min(from.length, out.length);
    for (let v = 1; v < m; v++) {
      const d = Math.abs(out[v] - from[v]);
      total += d;
      if (d > max) max = d;
    }
    return { total, max };
  };
  // The composer's own jump for this change (previous written stack → this one).
  const literalPrev = literalVoicing(c.chordSequence[(k - 1 + length) % length].slice(0, c.maxVoices), c.tonicSemis);
  const ceiling = displacementFrom(literalPrev, literalVoiced).max;
  const candidates: number[][] = [literalVoiced];
  for (const perm of perms) {
    const out = [bass];
    for (let v = 0; v < n; v++) {
      const near = prev[v + 1] ?? bandCenter;
      out.push(nearestPitchInBand(upperPcs[perm[v]], near, lo, hi));
    }
    if (sameTightIntervals(out, required)) candidates.push(out);
  }
  const scored = candidates.map((out) => ({ out, ...displacementFrom(prev, out) }));
  const within = scored.filter((s) => s.max <= ceiling);
  const pool = within.length > 0 ? within : scored;
  let best = pool[0];
  for (const s of pool) {
    if (s.total < best.total || (s.total === best.total && s.max < best.max)) best = s;
  }
  return [...best.out, ...tail];
}

/**
 * The voicing at ABSOLUTE chord index `index` (the scheduler's chord count since
 * the mood took the instrument), walked from the literal opening with wrap — the
 * same recursion the live scheduler runs, so a hit forecast at chord k equals
 * what the pad plays at chord k on any cycle.
 */
export function resolveMoodVoicingAt(c: MoodHarmonyConstraint, index: number): number[] {
  if (c.voicingPolicy !== 'brain') return voiceMoodChord(c, index, null);
  let prev: number[] | null = null;
  for (let i = 0; i <= Math.max(0, index); i++) prev = voiceMoodChord(c, i, prev);
  return prev!;
}

/** One voicing per authored chord for `cycles` passes of the progression (wrap included from the second pass). */
export function resolveMoodVoicingSequence(c: MoodHarmonyConstraint, cycles = 1): number[][] {
  const out: number[][] = [];
  let prev: number[] | null = null;
  const total = c.chordSequence.length * Math.max(1, cycles);
  for (let i = 0; i < total; i++) {
    prev = voiceMoodChord(c, i, prev);
    out.push(prev);
  }
  return out;
}

/** Largest single-voice move over a cycle of the progression (…last → first included). */
export function maxVoiceDisplacementOverCycle(seq: readonly (readonly number[])[]): number {
  if (seq.length < 2) return 0;
  let worst = 0;
  for (let i = 0; i < seq.length; i++) {
    const next = seq[(i + 1) % seq.length];
    worst = Math.max(worst, voiceDisplacement(seq[i], next).max);
  }
  return worst;
}
