import { describe, expect, it } from 'vitest';
import { describeStressDensity } from './stressDensity.ts';
import { jetpackDiveSubmergence, stressSfxScript } from './excerpts.ts';

describe('stress evidence provenance', () => {
  it('requires a current BLOOM measurement instead of a stale arrangement timestamp', () => {
    expect(() => stressSfxScript('stress-shipcrash-bloom')).toThrow('current standalone bed');
    const cues = stressSfxScript('stress-shipcrash-bloom', 77.5);
    expect(cues[0]).toEqual({ t: 78.7, event: 'shipCrash' });
    expect(cues[1].t - cues[0].t).toBe(5);
  });
  it('reports the real mining stress count and shipped nominal amplitudes', () => {
    const report = describeStressDensity(stressSfxScript('stress-mining-burst'), 60);
    expect(report.oneShots.find(r => r.family === 'mine')?.triggers).toBe(75);
    expect(report.oneShots.find(r => r.family === 'blocked')?.triggersPerMinute).toBe(5);
    expect(report.oneShots.reduce((n, r) => n + r.triggers, 0)).toBe(82);
    expect(report.oneShots.every(r => r.nominalVoiceGains.length > 0)).toBe(true);
  });
  it('reports loop duration and level, excluding medium control messages from sound counts', () => {
    const report = describeStressDensity(stressSfxScript('stress-jetpack-splash'), 60);
    const jetpack = report.loops.find(r => r.family === 'jetpack')!;
    expect(jetpack.activeSeconds).toBeCloseTo(22.1);
    expect(jetpack.intervals.map(r => r.level)).toEqual([1, 0.9, 1]);
    expect(report.loops.find(r => r.family === 'shipThrust')?.activeSeconds).toBe(4);
    expect(report.controls).toHaveLength(2);
    expect(report.oneShots.some(r => r.family === 'submerge')).toBe(false);
  });
  it('represents the jetpack swim continuously across the existing water event times', () => {
    expect(jetpackDiveSubmergence(27)).toBe(0);
    expect(jetpackDiveSubmergence(30)).toBe(0.9);
    expect(jetpackDiveSubmergence(34)).toBe(0.9);
    expect(jetpackDiveSubmergence(35.5)).toBe(0);
    for (let t = 0.1; t < 60; t += 0.1) {
      expect(Math.abs(jetpackDiveSubmergence(t) - jetpackDiveSubmergence(t - 0.1))).toBeLessThanOrEqual(0.06000001);
    }
  });
});
