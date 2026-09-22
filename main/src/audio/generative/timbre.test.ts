import { describe, expect, it } from 'vitest';
import {
  highBandEnergyFraction,
  makeImpulseResponse,
  resolveBedQualityTier,
  tanhDriveCeiling,
  tanhDriveCurve,
  type ImpulseSpec
} from './timbre.ts';

const SR = 44100;
const spec = (over: Partial<ImpulseSpec> = {}): ImpulseSpec => ({
  sampleRate: SR,
  seconds: 0.6,
  decay: 3,
  seed: 0x726f6f6d,
  preDelayMs: 22,
  earlyTaps: 8,
  earlyWindowMs: [8, 60],
  earlyLevel: 0.5,
  lateLevel: 0.3,
  lateOnsetMs: 30,
  hfDampHz: 3200,
  channels: 2,
  ...over
});

describe('impulse generator (Stage 1 space)', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = makeImpulseResponse(spec());
    const b = makeImpulseResponse(spec());
    const c = makeImpulseResponse(spec({ seed: 0x626c6f6f }));
    expect(Array.from(a[0])).toEqual(Array.from(b[0]));
    expect(Array.from(a[1])).toEqual(Array.from(b[1]));
    expect(Array.from(a[0])).not.toEqual(Array.from(c[0]));
  });

  it('is silent before the pre-delay and decorrelated between channels', () => {
    const [l, r] = makeImpulseResponse(spec());
    const pre = Math.floor((22 / 1000) * SR);
    for (let i = 0; i < pre; i++) {
      expect(l[i]).toBe(0);
      expect(r[i]).toBe(0);
    }
    let lr = 0;
    let ll = 0;
    let rr = 0;
    for (let i = 0; i < l.length; i++) {
      lr += l[i] * r[i];
      ll += l[i] * l[i];
      rr += r[i] * r[i];
    }
    const corr = lr / Math.sqrt(ll * rr);
    expect(Math.abs(corr)).toBeLessThan(0.2);
  });

  it('damps high frequencies relative to the undamped tail', () => {
    const damped = makeImpulseResponse(spec({ earlyTaps: 0 }))[0];
    const bright = makeImpulseResponse(spec({ earlyTaps: 0, hfDampHz: 20000 }))[0];
    const dampedHigh = highBandEnergyFraction(damped, SR, 3200);
    const brightHigh = highBandEnergyFraction(bright, SR, 3200);
    expect(dampedHigh).toBeLessThan(brightHigh * 0.7);
  });

  it('places every early tap inside the named window and decays to zero', () => {
    const taps = makeImpulseResponse(spec({ lateLevel: 0 }))[0];
    const pre = Math.floor((22 / 1000) * SR);
    const tapMin = pre + Math.floor((8 / 1000) * SR);
    const tapMax = pre + Math.floor((60 / 1000) * SR);
    let count = 0;
    for (let i = 0; i < taps.length; i++) {
      if (taps[i] !== 0) {
        count++;
        expect(Math.abs(taps[i])).toBeCloseTo(0.5, 6);
        expect(i).toBeGreaterThanOrEqual(tapMin);
        expect(i).toBeLessThanOrEqual(tapMax);
      }
    }
    // Eight seeded taps; two may share a sample for some seeds.
    expect(count).toBeGreaterThanOrEqual(7);
    expect(count).toBeLessThanOrEqual(8);
    const ir = makeImpulseResponse(spec())[0];
    expect(Math.abs(ir[ir.length - 1])).toBeLessThan(1e-3);
    expect(ir.every((v) => Number.isFinite(v))).toBe(true);
    let peak = 0;
    for (const v of ir) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThanOrEqual(0.5 + 0.3);
  });
});

describe('drive curves', () => {
  it('has unity small-signal slope, odd symmetry, monotonic shape and the closed-form ceiling', () => {
    const k = 1.8;
    const curve = tanhDriveCurve(k, 4097);
    const mid = (curve.length - 1) / 2;
    expect(curve[mid]).toBe(0);
    const dx = 2 / (curve.length - 1);
    const slope = (curve[mid + 1] - curve[mid - 1]) / (2 * dx);
    expect(slope).toBeCloseTo(1, 3);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    for (let i = 0; i < mid; i++) expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 6);
    expect(curve[curve.length - 1]).toBeCloseTo(tanhDriveCeiling(k), 6);
    expect(tanhDriveCeiling(1.4)).toBeCloseTo(Math.tanh(1.4) / 1.4, 9);
  });
});

describe('bed quality tier', () => {
  it('selects full on unknown/desktop hints and lean on any budget signal', () => {
    expect(resolveBedQualityTier({})).toBe('full');
    expect(resolveBedQualityTier({ hardwareConcurrency: 16, deviceMemoryGb: 32, renderQuality: 'high' })).toBe('full');
    expect(resolveBedQualityTier({ coarsePointer: true })).toBe('lean');
    expect(resolveBedQualityTier({ hardwareConcurrency: 4 })).toBe('lean');
    expect(resolveBedQualityTier({ deviceMemoryGb: 4 })).toBe('lean');
    expect(resolveBedQualityTier({ renderQuality: 'low' })).toBe('lean');
    expect(resolveBedQualityTier({ renderQuality: 'potato' })).toBe('lean');
    expect(resolveBedQualityTier({ renderQuality: 'medium', hardwareConcurrency: 8 })).toBe('full');
  });
});
