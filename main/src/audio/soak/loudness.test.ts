import { describe, expect, it } from 'vitest';
import {
  analyzeLoudness,
  designKWeighting,
  interChannelCorrelation,
  K_WEIGHTING_48K_REFERENCE,
  truePeakLinear
} from './audioAnalysis.ts';

// Stage 0 evidence floor: the loudness instrument is checked against synthetic
// signals whose LUFS and true-peak values follow from BS.1770-4 arithmetic
// rather than from a reference implementation we do not ship.

const SR_48K = 48000;
const SR_RENDER = 44100;
/** BS.1770-4 calibration: a single-channel full-scale 997 Hz sine reads this. */
const FULL_SCALE_MONO_SINE_LUFS = -3.01;
const CALIBRATION_HZ = 997;
/** Tolerance for a measured LUFS value against its derived expectation, LU. */
const LUFS_TOLERANCE = 0.1;
/** Tolerance for a 4× oversampled true peak against the analytic peak, dB. */
const TRUE_PEAK_TOLERANCE_DB = 0.5;
/** Blocks straddling a loud→silent edge survive the relative gate, LU. */
const GATED_TRANSITION_TOLERANCE = 0.25;

function sine(seconds: number, hz: number, gain: number, sampleRate = SR_RENDER, phase = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate + phase) * gain;
  }
  return out;
}

describe('K-weighting design', () => {
  it('reproduces the BS.1770-4 48 kHz coefficient table', () => {
    const designed = designKWeighting(SR_48K);
    for (const key of ['b0', 'b1', 'b2', 'a1', 'a2'] as const) {
      expect(designed.shelf[key]).toBeCloseTo(K_WEIGHTING_48K_REFERENCE.shelf[key], 8);
      expect(designed.highpass[key]).toBeCloseTo(K_WEIGHTING_48K_REFERENCE.highpass[key], 8);
    }
  });

  it('designs stable filters at the 44.1 kHz render rate', () => {
    const designed = designKWeighting(SR_RENDER);
    // Both poles inside the unit circle: |a2| < 1 and |a1| < 1 + a2.
    for (const f of [designed.shelf, designed.highpass]) {
      expect(Math.abs(f.a2)).toBeLessThan(1);
      expect(Math.abs(f.a1)).toBeLessThan(1 + f.a2);
    }
  });
});

describe('integrated loudness', () => {
  it('reads -3.01 LUFS for a full-scale single-channel 997 Hz sine', () => {
    const a = analyzeLoudness([sine(6, CALIBRATION_HZ, 1)], SR_RENDER);
    expect(a.integratedLufs).toBeCloseTo(FULL_SCALE_MONO_SINE_LUFS, 1);
  });

  it('reads the dBFS level for a stereo sine (the +3.01 LU channel sum cancels)', () => {
    for (const dbfs of [-20, -23]) {
      const gain = Math.pow(10, dbfs / 20);
      const channel = sine(6, CALIBRATION_HZ, gain);
      const a = analyzeLoudness([channel, channel], SR_RENDER);
      expect(Math.abs(a.integratedLufs - dbfs)).toBeLessThan(LUFS_TOLERANCE);
    }
  });

  it('gates silence out of the integrated value', () => {
    const loud = sine(6, CALIBRATION_HZ, Math.pow(10, -23 / 20));
    const silence = new Float32Array(6 * SR_RENDER);
    const l = new Float32Array(loud.length + silence.length);
    l.set(loud, 0);
    const a = analyzeLoudness([l, l], SR_RENDER);
    // The absolute + relative gates discard the silent half; only the blocks
    // straddling the transition survive, and they pull the value a fraction
    // of a LU down.
    expect(Math.abs(a.integratedLufs - -23)).toBeLessThan(GATED_TRANSITION_TOLERANCE);
  });

  it('reports short-term and momentary maxima at least as loud as integrated', () => {
    const quiet = sine(4, CALIBRATION_HZ, Math.pow(10, -30 / 20));
    const loud = sine(4, CALIBRATION_HZ, Math.pow(10, -14 / 20));
    const channel = new Float32Array(quiet.length + loud.length);
    channel.set(quiet, 0);
    channel.set(loud, quiet.length);
    const a = analyzeLoudness([channel, channel], SR_RENDER);
    expect(a.momentaryMaxLufs).toBeGreaterThanOrEqual(a.shortTermMaxLufs - LUFS_TOLERANCE);
    expect(a.shortTermMaxLufs).toBeGreaterThan(a.integratedLufs);
    expect(Math.abs(a.momentaryMaxLufs - -14)).toBeLessThan(0.3);
    expect(a.loudnessRangeLu).toBeGreaterThan(0);
  });

  it('reports a zero loudness range for a steady tone', () => {
    const channel = sine(20, CALIBRATION_HZ, 0.2);
    const a = analyzeLoudness([channel, channel], SR_RENDER);
    expect(a.loudnessRangeLu).toBeLessThan(0.1);
  });
});

describe('true peak', () => {
  it('finds the inter-sample peak a sample-peak meter misses', () => {
    // fs/4 with a 45-degree phase: every sample lands at ±1/sqrt(2) while the
    // continuous waveform still reaches full scale.
    const channel = sine(1, SR_RENDER / 4, 1, SR_RENDER, Math.PI / 4);
    const samplePeak = channel.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    expect(samplePeak).toBeCloseTo(Math.SQRT1_2, 3);
    const truePeak = truePeakLinear([channel]);
    expect(20 * Math.log10(truePeak)).toBeGreaterThan(-TRUE_PEAK_TOLERANCE_DB);
    expect(20 * Math.log10(truePeak)).toBeLessThan(TRUE_PEAK_TOLERANCE_DB);
  });

  it('never reports below the sample peak', () => {
    const channel = sine(0.5, 1000, 0.5);
    const samplePeak = channel.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    expect(truePeakLinear([channel])).toBeGreaterThanOrEqual(samplePeak);
  });

  it('reports dBTP and dBFS together', () => {
    const channel = sine(1, 1000, Math.pow(10, -6 / 20));
    const a = analyzeLoudness([channel, channel], SR_RENDER);
    expect(Math.abs(a.samplePeakDbfs - -6)).toBeLessThan(0.1);
    expect(a.truePeakDbtp).toBeGreaterThanOrEqual(a.samplePeakDbfs - 1e-6);
  });
});

describe('correlation and spectral proxy', () => {
  it('reads +1 for identical channels and -1 for inverted ones', () => {
    const l = sine(1, 440, 0.4);
    const r = Float32Array.from(l, (s) => -s);
    expect(interChannelCorrelation([l, l])).toBeCloseTo(1, 6);
    expect(interChannelCorrelation([l, r])).toBeCloseTo(-1, 6);
  });

  it('puts a low tone in the low band and a high tone in the high band', () => {
    const low = analyzeLoudness([sine(2, 80, 0.3)], SR_RENDER).spectral;
    const high = analyzeLoudness([sine(2, 8000, 0.3)], SR_RENDER).spectral;
    expect(low.bandFractions[0]).toBeGreaterThan(low.bandFractions[3]);
    expect(high.bandFractions[3]).toBeGreaterThan(high.bandFractions[0]);
    expect(high.meanZeroCrossingRate).toBeGreaterThan(low.meanZeroCrossingRate);
  });
});
