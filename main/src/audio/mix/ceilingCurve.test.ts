import { describe, expect, it } from 'vitest';
import { ceilingCurve, ceilingCurveSample } from './ceilingCurve.ts';
import { CEILING_DBTP, CEILING_SOFTNESS } from './mixTuning.ts';

const c = Math.pow(10, CEILING_DBTP / 20);

describe('true-peak ceiling curve', () => {
  it('never exceeds the ceiling for any input, including inputs past full scale', () => {
    for (const x of [0.5, 0.9, 1, 1.5, 4, 100]) {
      expect(Math.abs(ceilingCurveSample(x, c, CEILING_SOFTNESS))).toBeLessThan(c);
      expect(Math.abs(ceilingCurveSample(-x, c, CEILING_SOFTNESS))).toBeLessThan(c);
    }
    const table = ceilingCurve(c, CEILING_SOFTNESS);
    let peak = 0;
    for (const v of table) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(c);
  });

  it('is transparent below the programme peaks: < 0.02 dB at -9 dBFS, unity slope at the origin', () => {
    const x = Math.pow(10, -9 / 20);
    const y = ceilingCurveSample(x, c, CEILING_SOFTNESS);
    expect(Math.abs(20 * Math.log10(y / x))).toBeLessThan(0.02);
    const tiny = 1e-4;
    expect(ceilingCurveSample(tiny, c, CEILING_SOFTNESS) / tiny).toBeCloseTo(1, 6);
  });

  it('is odd-symmetric and monotonic (no folding, no DC)', () => {
    const table = ceilingCurve(c, CEILING_SOFTNESS, 4097);
    for (let i = 1; i < table.length; i++) expect(table[i]).toBeGreaterThanOrEqual(table[i - 1]);
    expect(table[2048]).toBe(0);
    expect(table[0]).toBeCloseTo(-table[4096], 9);
  });
});
