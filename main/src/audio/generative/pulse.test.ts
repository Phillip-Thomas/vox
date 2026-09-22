import { describe, expect, it } from 'vitest';
import {
  bloomPreReleaseFactor,
  liftTarget,
  pulseBeats,
  pulseBodyHz,
  pulseTarget,
  slewEnvelope,
  type LiftContext
} from './pulse.ts';
import {
  BLOOM_CREST_BARS,
  BLOOM_LIFT_SUSTAIN,
  BUILD_LIFT_CAP,
  LIFT_BAR_SLEW,
  PHRASE_BARS,
  PULSE_BODY_HZ_MAX,
  PULSE_BODY_HZ_MIN,
  PULSE_LEVEL_BLOOM,
  PULSE_LEVEL_BUILD
} from './tuning.ts';

const ctx = (patch: Partial<LiftContext>): LiftContext => ({
  arrangement: 'BED',
  dwell: 1,
  phrasePos: 0,
  buildSpan: 1,
  bloomPhrases: 1,
  ...patch
});

describe('the pulse and the lift (Stage 5)', () => {
  it('lift and pulse are zero outside BUILD/BLOOM', () => {
    for (const arrangement of ['REST', 'BED', 'EBB'] as const) {
      expect(liftTarget(ctx({ arrangement }))).toBe(0);
      expect(pulseTarget(ctx({ arrangement }))).toBe(0);
      expect(pulseBeats(4, arrangement, 0)).toEqual([]);
    }
  });

  it('the BUILD rises monotonically across its whole span to BUILD_LIFT_CAP; the crest is 1', () => {
    for (const buildSpan of [1, 2, 3]) {
      let prev = -1;
      for (let dwell = 1; dwell <= buildSpan; dwell++) {
        for (let pos = 0; pos < PHRASE_BARS; pos++) {
          const v = liftTarget(ctx({ arrangement: 'BUILD', dwell, phrasePos: pos, buildSpan }));
          expect(v).toBeGreaterThan(prev);
          prev = v;
        }
      }
      expect(prev).toBeCloseTo(BUILD_LIFT_CAP, 9);
    }
    expect(liftTarget(ctx({ arrangement: 'BLOOM', dwell: 1, bloomPhrases: 2 }))).toBe(1);
    expect(liftTarget(ctx({ arrangement: 'BLOOM', dwell: 1, bloomPhrases: 2, phrasePos: BLOOM_CREST_BARS }))).toBe(BLOOM_LIFT_SUSTAIN);
    expect(liftTarget(ctx({ arrangement: 'BLOOM', dwell: 2, bloomPhrases: 2, phrasePos: 0 }))).toBe(BLOOM_LIFT_SUSTAIN);
  });

  it('the final BLOOM phrase pre-releases over its last bars so the EBB is not a cliff', () => {
    const last = (pos: number) => bloomPreReleaseFactor(ctx({ arrangement: 'BLOOM', dwell: 1, bloomPhrases: 1, phrasePos: pos }));
    expect(last(0)).toBe(1);
    expect(last(PHRASE_BARS - 3)).toBe(1);
    expect(last(PHRASE_BARS - 2)).toBeLessThan(1);
    expect(last(PHRASE_BARS - 1)).toBeLessThan(last(PHRASE_BARS - 2));
    // Not the final phrase: no pre-release.
    expect(bloomPreReleaseFactor(ctx({ arrangement: 'BLOOM', dwell: 1, bloomPhrases: 2, phrasePos: PHRASE_BARS - 1 }))).toBe(1);
  });

  it('every bar step of a slewed envelope is bounded by LIFT_BAR_SLEW (the symphony law)', () => {
    let v = 0;
    const targets = [1, 1, 0, 0.3, 1, 0];
    for (const t of targets) {
      const next = slewEnvelope(v, t);
      expect(Math.abs(next - v)).toBeLessThanOrEqual(LIFT_BAR_SLEW + 1e-12);
      v = next;
    }
    expect(slewEnvelope(0.9, 1)).toBe(1);
    expect(slewEnvelope(0.2, 0)).toBe(0);
  });

  it('BUILD pulses half-time, BLOOM at full level pulses every felt beat, in 4/4 and 6/8', () => {
    expect(pulseBeats(4, 'BUILD', PULSE_LEVEL_BUILD)).toEqual([0, 2]);
    expect(pulseBeats(2, 'BUILD', PULSE_LEVEL_BUILD)).toEqual([0]);
    expect(pulseBeats(4, 'BLOOM', PULSE_LEVEL_BLOOM)).toEqual([0, 1, 2, 3]);
    expect(pulseBeats(2, 'BLOOM', PULSE_LEVEL_BLOOM)).toEqual([0, 1]);
    // The release tail drops back to half-time.
    expect(pulseBeats(4, 'BLOOM', 0.2)).toEqual([0, 2]);
  });

  it('the body lands on the chord root folded into the sub band', () => {
    for (const hz of [27.5, 41.2, 55, 61.7, 110, 233, 440, 1760]) {
      const body = pulseBodyHz(hz);
      expect(body).toBeGreaterThanOrEqual(PULSE_BODY_HZ_MIN);
      expect(body).toBeLessThan(PULSE_BODY_HZ_MAX);
      // Same pitch class: the ratio to the root is a power of two.
      const ratio = Math.log2(hz / body);
      expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
    }
  });
});
