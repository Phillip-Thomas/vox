import { describe, expect, it } from 'vitest';
import { analyzeLoudness } from './audioAnalysis.ts';
import { analyzeStemEnergy, encodeWavFloat32, isolateStressOptions } from './stemDiagnostics.ts';
import type { CombinedRenderOptions } from './offlineRender.ts';
import { neutralBedSignals } from '../generative/worldSignals.ts';

describe('stress diagnostic isolation', () => {
  const script = () => neutralBedSignals();
  const base: CombinedRenderOptions = { planetSeed: 5, seconds: 60, scenario: 'sandboxDay', script,
    sfxScript: [{ t: 20, event: 'mine' }, { t: 27, event: 'submerge', params: { amount: 1 } }],
    sfxSeed: 12, bedQuality: 'lean', tail: 'shipped', musicBusGlue: true, resetGlobalsBeforeRender: true };
  it('leaves default and explicit actual sum options untouched', () => {
    expect(isolateStressOptions(base)).toBe(base);
    expect(isolateStressOptions(base, 'sum')).toBe(base);
  });
  it('preserves all driving rails, timing and gains when removing or muting SFX', () => {
    expect(isolateStressOptions(base, 'music-no-sfx')).toEqual({ ...base, sfxScript: [] });
    expect(isolateStressOptions(base, 'music-ducked')).toEqual({ ...base, sfxAudible: false });
    expect(isolateStressOptions(base, 'sfx-only')).toEqual({ ...base, musicSilent: true });
    for (const variant of ['music-no-sfx', 'music-ducked', 'sfx-only'] as const) expect(isolateStressOptions(base, variant).script).toBe(script);
    expect(base.sfxScript).toHaveLength(2);
  });
});

describe('raw diagnostic evidence', () => {
  it('exports exact float samples including above-unity peaks without normalization', () => {
    const left = new Float32Array([-1.25, 0.0000123, 1.5]), right = new Float32Array([0.2, -0.25, 0]);
    const wav = new DataView(encodeWavFloat32([left, right], 44100));
    expect(wav.getUint16(20, true)).toBe(3);
    expect(wav.getUint16(34, true)).toBe(32);
    for (let i = 0; i < left.length; i++) {
      expect(wav.getFloat32(44 + i * 8, true)).toBe(left[i]);
      expect(wav.getFloat32(48 + i * 8, true)).toBe(right[i]);
    }
  });
  it('matches the existing integrated meter while exposing its gate decisions and all 3-second windows', () => {
    const rate = 8000, channel = Float32Array.from({ length: rate * 8 }, (_, i) => {
      const t = i / rate;
      return (t < 1 ? 0 : t < 4 ? 0.12 : 0.001) * Math.sin(2 * Math.PI * 440 * t);
    });
    const channels = [channel, channel], d = analyzeStemEnergy(channels, rate), meter = analyzeLoudness(channels, rate);
    expect(d.integratedLufs).toBeCloseTo(meter.integratedLufs, 10);
    expect(Math.max(...d.shortTermWindows.map(w => w.lufs ?? -Infinity))).toBeCloseTo(meter.shortTermMaxLufs, 10);
    expect(d.shortTermWindows).toHaveLength(51);
    expect(d.gateBlocks.some(b => !b.integratedPass)).toBe(true);
    expect(d.gateBlocks.filter(b => b.integratedPass)).toHaveLength(d.integratedGateBlocks);
    expect(d.totalKWeightedEnergySeconds).toBeGreaterThan(0);
  });
  it('represents silent gates explicitly without nonfinite JSON numbers', () => {
    const d = analyzeStemEnergy([new Float32Array(4000)], 1000);
    expect(d.integratedLufs).toBeNull();
    expect(d.integratedGateBlocks).toBe(0);
    expect(d.totalKWeightedEnergySeconds).toBe(0);
    expect(JSON.stringify(d)).not.toContain('Infinity');
  });
});
