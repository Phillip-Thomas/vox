import { pcMod, triadPcs, type TriadSpec } from './theory.ts';
import { VL_COMMON_TONE_TENSION, VL_TOTAL_MAX, VL_VOICE_MAX } from './tuning.ts';

// --- Minimal-motion voice-leading (§6.4) ----------------------------------------------------
//
// Voicing: bass = chord root in the sub register (pitch = rootPc, semitones
// above A1); THREE upper voices confined to a register band. Chord-to-chord,
// the next voicing minimizes total displacement over all 3! voice→pitch-class
// assignments. Legality is a displacement bound plus the low-tension
// common-tone rule — the widening at high tension IS the audible strain.

export interface Voicing {
  /** Semitones above A1 — the chord root in the sub register (0..11). */
  bass: number;
  /** Three upper voices, semitones above A1, inside the register band. */
  uppers: [number, number, number];
}

export interface TransitionResult {
  voicing: Voicing;
  /** Total displacement of the three upper voices, semitones. */
  displacement: number;
  /** Largest single upper-voice displacement, semitones. */
  maxVoice: number;
  /** Number of upper voices that did not move. */
  commonTones: number;
}

const PERMUTATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
];

/**
 * Nearest instance of pitch class `pc` (semitones from A) to `near`, clamped
 * into [lo, hi]. Requires hi − lo ≥ 11 so an instance always exists.
 */
export function nearestPitchInBand(pc: number, near: number, lo: number, hi: number): number {
  let best = Number.NaN;
  let bestDist = Infinity;
  const start = Math.ceil((lo - pc) / 12);
  const end = Math.floor((hi - pc) / 12);
  for (let k = start; k <= end; k++) {
    const pitch = pc + k * 12;
    const d = Math.abs(pitch - near);
    if (d < bestDist) {
      bestDist = d;
      best = pitch;
    }
  }
  return best;
}

/** Initial voicing (no previous chord): each triad pc nearest the band center. */
export function voiceTriad(t: TriadSpec, bandCenter: number, halfWidth: number): Voicing {
  const lo = bandCenter - halfWidth;
  const hi = bandCenter + halfWidth;
  const pcs = triadPcs(t);
  const uppers = pcs.map((pc) => nearestPitchInBand(pc, bandCenter, lo, hi)) as [number, number, number];
  uppers.sort((a, b) => a - b);
  return { bass: pcMod(t.rootPc), uppers };
}

/**
 * Minimal-total-displacement transition from `prev` to the triad `next`:
 * brute-force the 3! assignments of next's pitch classes to the previous
 * voices; each voice takes the in-band instance nearest its old pitch.
 */
export function leadVoices(
  prev: Voicing,
  next: TriadSpec,
  bandCenter: number,
  halfWidth: number
): TransitionResult {
  return leadVoicesRange(prev, next, bandCenter - halfWidth, bandCenter + halfWidth);
}

/**
 * Range form of `leadVoices` — the harmony brain widens the band to CONTAIN
 * the previous voicing while the band center glides (P3), so a moving band
 * can never strand the voicing outside its own legality window.
 */
export function leadVoicesRange(
  prev: Voicing,
  next: TriadSpec,
  lo: number,
  hi: number
): TransitionResult {
  const pcs = triadPcs(next);
  let best: TransitionResult | null = null;
  for (const perm of PERMUTATIONS) {
    const uppers: [number, number, number] = [0, 0, 0];
    let displacement = 0;
    let maxVoice = 0;
    let commonTones = 0;
    for (let v = 0; v < 3; v++) {
      const pitch = nearestPitchInBand(pcs[perm[v]], prev.uppers[v], lo, hi);
      uppers[v] = pitch;
      const d = Math.abs(pitch - prev.uppers[v]);
      displacement += d;
      if (d > maxVoice) maxVoice = d;
      if (d === 0) commonTones++;
    }
    if (
      best === null ||
      displacement < best.displacement ||
      (displacement === best.displacement && maxVoice < best.maxVoice)
    ) {
      best = { voicing: { bass: pcMod(next.rootPc), uppers }, displacement, maxVoice, commonTones };
    }
  }
  return best!;
}

/**
 * Legality (§6.4): total ≤ VL_TOTAL_MAX, per-voice ≤ VL_VOICE_MAX, and below
 * VL_COMMON_TONE_TENSION at least one common tone must be held.
 */
export function isLegalTransition(r: TransitionResult, tension: number): boolean {
  if (r.displacement > VL_TOTAL_MAX) return false;
  if (r.maxVoice > VL_VOICE_MAX) return false;
  if (tension < VL_COMMON_TONE_TENSION && r.commonTones < 1) return false;
  return true;
}
