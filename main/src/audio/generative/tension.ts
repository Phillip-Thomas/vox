import { isDiatonic, modeTonicTriad, tonnetzDistance, type ModeName, type TriadSpec } from './theory.ts';
import {
  ARCH_DIP,
  ARCH_PEAK_BOOST,
  ARCH_PROFILE,
  COLOR_DISSONANCE,
  FALL_FLOOR_DROP,
  FALL_START_BOOST,
  PHRASE_BARS,
  REGISTER_EXTREMITY_RANGE,
  REGISTER_NEUTRAL_SEMIS,
  RISE_GAIN,
  SHAPE_FALL_AFTER_RISE_BOOST,
  SHAPE_PLATEAU_CALM_BOOST,
  SHAPE_RISE_TENSION_BOOST,
  SHAPE_WEIGHTS,
  TENSION_W_COLOR,
  TENSION_W_NONDIATONIC,
  TENSION_W_REGISTER,
  TENSION_W_TONNETZ,
  TONNETZ_NORM
} from './tuning.ts';
import { musicUnit, SALT_CURVE_SHAPE, seededPickWeighted } from './seededMusic.ts';

// --- The tension model and the scheduled tension curve (§6.5) -------------------------------
//
// Each chord candidate gets a perceptual-tension score (Farbood-style weighted
// blend); the phrase planner schedules a target curve over the 8-bar phrase;
// chord choice is argmin |T(candidate) − target(bar)| over LEGAL candidates.
// Dissonance is therefore always ASKED FOR by the curve, and release is always
// reachable because legality guarantees a short voice-leading path home.

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export interface TensionContext {
  tonicPc: number;
  mode: ModeName;
  /** Dissonance of the color intent that would dress this chord (COLOR_DISSONANCE). */
  colorDissonance: number;
  /** Mean upper-voice pitch of the candidate's optimal voicing, semitones above A1. */
  voicingMean: number;
}

/** Perceptual tension of a chord candidate, 0..1. */
export function chordTension(candidate: TriadSpec, ctx: TensionContext): number {
  const tonnetz = clamp01(
    tonnetzDistance(candidate, modeTonicTriad(ctx.tonicPc, ctx.mode)) / TONNETZ_NORM
  );
  const color = clamp01(ctx.colorDissonance);
  const nonDiatonic = isDiatonic(candidate, ctx.tonicPc, ctx.mode) ? 0 : 1;
  const register = clamp01(
    Math.abs(ctx.voicingMean - REGISTER_NEUTRAL_SEMIS) / REGISTER_EXTREMITY_RANGE
  );
  return clamp01(
    TENSION_W_TONNETZ * tonnetz +
      TENSION_W_COLOR * color +
      TENSION_W_NONDIATONIC * nonDiatonic +
      TENSION_W_REGISTER * register
  );
}

// --- Curve shapes ---------------------------------------------------------------------------

export type CurveShape = 'ARCH' | 'PLATEAU' | 'RISE' | 'FALL';

/** Target tension per bar over the phrase, all values 0..1. */
export function planTensionCurve(shape: CurveShape, railTension: number): number[] {
  const rail = clamp01(railTension);
  const curve = new Array<number>(PHRASE_BARS);
  switch (shape) {
    case 'PLATEAU': {
      curve.fill(rail);
      break;
    }
    case 'ARCH': {
      const base = clamp01(rail - ARCH_DIP);
      const peak = clamp01(rail + ARCH_PEAK_BOOST);
      for (let i = 0; i < PHRASE_BARS; i++) {
        curve[i] = base + (peak - base) * ARCH_PROFILE[i];
      }
      break;
    }
    case 'RISE': {
      const top = clamp01(rail + RISE_GAIN);
      for (let i = 0; i < PHRASE_BARS; i++) {
        curve[i] = rail + (top - rail) * (i / (PHRASE_BARS - 1));
      }
      break;
    }
    case 'FALL': {
      const start = clamp01(rail + FALL_START_BOOST);
      const floor = clamp01(rail - FALL_FLOOR_DROP);
      for (let i = 0; i < PHRASE_BARS; i++) {
        curve[i] = start + (floor - start) * (i / (PHRASE_BARS - 1));
      }
      break;
    }
  }
  return curve;
}

/**
 * Seeded phrase-shape draw. RISE leans on the tension rail (builds), PLATEAU
 * on calm, and a RISE prefers to resolve into a FALL (build → release).
 */
export function chooseCurveShape(
  seed: number,
  phraseIndex: number,
  tension: number,
  energy: number,
  prevShape: CurveShape | null
): CurveShape {
  const weights: Array<[CurveShape, number]> = SHAPE_WEIGHTS.map(([shape, w]) => {
    let weight = w;
    if (shape === 'RISE') weight += SHAPE_RISE_TENSION_BOOST * clamp01(tension);
    if (shape === 'PLATEAU') weight += SHAPE_PLATEAU_CALM_BOOST * clamp01(1 - energy);
    if (shape === 'FALL' && prevShape === 'RISE') weight += SHAPE_FALL_AFTER_RISE_BOOST;
    return [shape as CurveShape, weight];
  });
  return seededPickWeighted(weights, musicUnit(seed, SALT_CURVE_SHAPE, phraseIndex));
}

/** Dissonance constant for a color intent (0 for 'none' / unknown intents). */
export function colorIntentDissonance(intent: string): number {
  return COLOR_DISSONANCE[intent] ?? 0;
}
