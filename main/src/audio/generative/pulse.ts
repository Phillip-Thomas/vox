import {
  BLOOM_CREST_BARS,
  BLOOM_LIFT_SUSTAIN,
  BLOOM_PRE_RELEASE_BARS,
  BUILD_LIFT_CAP,
  LIFT_BAR_SLEW,
  PHRASE_BARS,
  PULSE_BODY_HZ_MAX,
  PULSE_BODY_HZ_MIN,
  PULSE_BUILD_BEAT_STEP,
  PULSE_LEVEL_BLOOM,
  PULSE_LEVEL_BUILD,
  type ArrangementStateName
} from './tuning.ts';

// --- The pulse and the lift (Stage 5) — pure envelopes for the heartbeat and the BLOOM rail ----------
//
// Before Stage 5 the pads "breathed" on every beat in every state whenever
// energy × era said so: a sidechain with no source. The pulse is that source —
// a root-tuned transient (click + sine pitch-drop body + noise tail) that
// exists ONLY across BUILD/BLOOM, half-time in the build, every felt beat in
// the bloom; the breath dips key off its onsets and nowhere else. Both the
// pulse level and the BLOOM lift are per-bar envelopes bounded by LIFT_BAR_SLEW
// so a forced EBB (warp exit) releases instead of cliffing.

export interface LiftContext {
  arrangement: ArrangementStateName;
  /** Phrases spent in the current state including this one (ArrangementState.dwell). */
  dwell: number;
  /** Bar position inside the phrase, 0..PHRASE_BARS-1. */
  phrasePos: number;
  /** Planned BUILD span (phrases) and BLOOM length (phrases) for this gesture. */
  buildSpan: number;
  bloomPhrases: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** One bar-step of a slewed envelope: the value may move at most LIFT_BAR_SLEW toward its target. */
export function slewEnvelope(previous: number, target: number): number {
  const delta = Math.max(-LIFT_BAR_SLEW, Math.min(LIFT_BAR_SLEW, target - previous));
  return clamp01(previous + delta);
}

/** Pre-release factor over the final bars of the last BLOOM phrase (1 → toward 0 in PRE_RELEASE steps). */
export function bloomPreReleaseFactor(ctx: LiftContext): number {
  if (ctx.arrangement !== 'BLOOM' || ctx.dwell < ctx.bloomPhrases) return 1;
  const barsLeft = PHRASE_BARS - ctx.phrasePos; // 8..1
  if (barsLeft > BLOOM_PRE_RELEASE_BARS) return 1;
  return barsLeft / (BLOOM_PRE_RELEASE_BARS + 1);
}

/** Target BLOOM-rail lift for this bar, 0..1 (BUILD rises to BUILD_LIFT_CAP; the crest is 1). */
export function liftTarget(ctx: LiftContext): number {
  switch (ctx.arrangement) {
    case 'BUILD': {
      const total = Math.max(1, ctx.buildSpan) * PHRASE_BARS;
      const into = (Math.max(1, ctx.dwell) - 1) * PHRASE_BARS + ctx.phrasePos + 1;
      return BUILD_LIFT_CAP * clamp01(into / total);
    }
    case 'BLOOM': {
      // Crest bars at 1, then a slewed settle to the sustain (the impact, then the groove).
      const base = ctx.dwell <= 1 && ctx.phrasePos < BLOOM_CREST_BARS ? 1 : BLOOM_LIFT_SUSTAIN;
      return base * bloomPreReleaseFactor(ctx);
    }
    default:
      return 0;
  }
}

/** Target pulse level for this bar before the era gate, 0..1. */
export function pulseTarget(ctx: LiftContext): number {
  switch (ctx.arrangement) {
    case 'BUILD':
      return PULSE_LEVEL_BUILD;
    case 'BLOOM':
      return PULSE_LEVEL_BLOOM * bloomPreReleaseFactor(ctx);
    default:
      return 0;
  }
}

/**
 * Felt beats carrying a pulse onset this bar. BLOOM at (or near) full level
 * pulses every beat; BUILD and every release tail pulse half-time (every
 * PULSE_BUILD_BEAT_STEP-th beat from the downbeat). Silent when the level is 0.
 */
export function pulseBeats(beatsPerBar: number, arrangement: ArrangementStateName, level: number): number[] {
  if (level <= 0) return [];
  const beats: number[] = [];
  const every = arrangement === 'BLOOM' && level >= PULSE_LEVEL_BLOOM * 0.5;
  for (let b = 0; b < beatsPerBar; b++) {
    if (every || b % PULSE_BUILD_BEAT_STEP === 0) beats.push(b);
  }
  return beats;
}

/** The body's landing pitch: the chord root's sub, folded by octaves into [PULSE_BODY_HZ_MIN, MAX]. */
export function pulseBodyHz(rootHz: number): number {
  let hz = Math.max(1e-3, rootHz);
  while (hz >= PULSE_BODY_HZ_MAX) hz /= 2;
  while (hz < PULSE_BODY_HZ_MIN) hz *= 2;
  return hz;
}
