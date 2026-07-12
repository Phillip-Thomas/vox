import { describe, expect, it } from 'vitest';
import { chooseCurveShape, chordTension, planTensionCurve, type CurveShape } from './tension.ts';
import { PHRASE_BARS, REGISTER_NEUTRAL_SEMIS } from './tuning.ts';

const SHAPES: CurveShape[] = ['ARCH', 'PLATEAU', 'RISE', 'FALL'];

describe('planTensionCurve (§6.5 scheduled curves)', () => {
  it('always returns PHRASE_BARS values inside [0, 1]', () => {
    for (const shape of SHAPES) {
      for (const rail of [0, 0.3, 0.7, 1]) {
        const curve = planTensionCurve(shape, rail);
        expect(curve.length).toBe(PHRASE_BARS);
        for (const v of curve) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('ARCH peaks at bar 6 and releases through bars 7–8', () => {
    const curve = planTensionCurve('ARCH', 0.3);
    const peakIndex = curve.indexOf(Math.max(...curve));
    expect(peakIndex).toBe(5);
    expect(curve[6]).toBeLessThan(curve[5]);
    expect(curve[7]).toBeLessThan(curve[6]);
  });

  it('RISE is nondecreasing, FALL is nonincreasing, PLATEAU is flat', () => {
    const rise = planTensionCurve('RISE', 0.3);
    const fall = planTensionCurve('FALL', 0.3);
    const plateau = planTensionCurve('PLATEAU', 0.42);
    for (let i = 1; i < PHRASE_BARS; i++) {
      expect(rise[i]).toBeGreaterThanOrEqual(rise[i - 1]);
      expect(fall[i]).toBeLessThanOrEqual(fall[i - 1]);
      expect(plateau[i]).toBe(0.42);
    }
    expect(rise[PHRASE_BARS - 1]).toBeGreaterThan(rise[0]);
    expect(fall[PHRASE_BARS - 1]).toBeLessThan(fall[0]);
  });
});

describe('chordTension (Farbood-style blend)', () => {
  const ctx = {
    tonicPc: 0,
    mode: 'aeolian' as const,
    colorDissonance: 0,
    voicingMean: REGISTER_NEUTRAL_SEMIS
  };

  it('scores the tonic triad as the point of rest', () => {
    const tonic = chordTension({ rootPc: 0, quality: 'min' }, ctx);
    const submediant = chordTension({ rootPc: 8, quality: 'maj' }, ctx); // ♭VI, one L away
    const alien = chordTension({ rootPc: 1, quality: 'maj' }, ctx); // non-diatonic, far
    expect(tonic).toBe(0);
    expect(submediant).toBeGreaterThan(tonic);
    expect(alien).toBeGreaterThan(submediant);
  });

  it('rises with color dissonance and register extremity', () => {
    const plain = chordTension({ rootPc: 0, quality: 'min' }, ctx);
    const colored = chordTension({ rootPc: 0, quality: 'min' }, { ...ctx, colorDissonance: 0.8 });
    const extreme = chordTension(
      { rootPc: 0, quality: 'min' },
      { ...ctx, voicingMean: REGISTER_NEUTRAL_SEMIS + 10 }
    );
    expect(colored).toBeGreaterThan(plain);
    expect(extreme).toBeGreaterThan(plain);
  });

  it('stays inside [0, 1]', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const quality of ['maj', 'min'] as const) {
        const t = chordTension(
          { rootPc: pc, quality },
          { ...ctx, colorDissonance: 1, voicingMean: 40 }
        );
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('chooseCurveShape', () => {
  it('is deterministic for identical inputs', () => {
    for (let phrase = 0; phrase < 32; phrase++) {
      const a = chooseCurveShape(1234, phrase, 0.4, 0.5, 'ARCH');
      const b = chooseCurveShape(1234, phrase, 0.4, 0.5, 'ARCH');
      expect(a).toBe(b);
      expect(SHAPES).toContain(a);
    }
  });

  it('varies across phrases and seeds', () => {
    const bySeed = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      const run: CurveShape[] = [];
      for (let phrase = 0; phrase < 16; phrase++) {
        run.push(chooseCurveShape(seed, phrase, 0.4, 0.5, null));
      }
      expect(new Set(run).size).toBeGreaterThan(1);
      bySeed.add(run.join(','));
    }
    expect(bySeed.size).toBeGreaterThan(1);
  });
});
