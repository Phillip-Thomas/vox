import { describe, expect, it } from 'vitest';
import {
  analyzeChannels,
  audioFloorPass,
  audioHealthPass,
  audioSmoothnessPass,
  encodeWavPcm16,
  SILENCE_ONSET_GRACE_S,
  SMOOTHNESS_MAX_DELTA_DB,
  SMOOTHNESS_MAX_DELTA_RMS,
  SMOOTHNESS_MAX_QUIET_DELTA_DB
} from './audioAnalysis.ts';

const SR = 44100;
const QUIET_STEP_FROM = 0.002;
const QUIET_STEP_TO = 0.019;
const QUIET_SLEW_TO = 0.012;
const QUIET_SLEW_SECONDS = 1.2;
const RISER_OLD_START_GAIN = 0.027;
const RISER_OLD_RESET_GAIN = 0.16;
const RISER_FIXED_RELEASE_S = 2;
const RISER_TEST_BED_FLOOR = 0.04;

function sine(seconds: number, hz: number, gain: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / SR) * gain;
  return out;
}

describe('analyzeChannels', () => {
  it('measures a healthy stereo sine correctly', () => {
    const l = sine(3, 220, 0.5);
    const r = sine(3, 220, 0.5);
    const a = analyzeChannels([l, r], SR);
    expect(a.seconds).toBeCloseTo(3, 2);
    expect(a.peak).toBeCloseTo(0.5, 2);
    expect(a.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(a.nanCount).toBe(0);
    expect(a.clipCount).toBe(0);
    expect(a.smoothnessViolations).toBe(0);
    expect(audioSmoothnessPass(a)).toBe(true);
    expect(audioHealthPass(a)).toBe(true);
  });

  it('counts NaN and clipped samples and fails health', () => {
    const ch = sine(1, 220, 0.5);
    ch[100] = Number.NaN;
    ch[200] = 1.5;
    ch[201] = -1.0;
    const a = analyzeChannels([ch], SR);
    expect(a.nanCount).toBe(1);
    expect(a.clipCount).toBe(2);
    expect(audioHealthPass(a)).toBe(false);
  });

  it('fails a rendered gain step (smoothness red-test)', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 4;
    const ch = sine(seconds, 220, 0.1);
    const edge = Math.round((SILENCE_ONSET_GRACE_S + 2) * SR);
    for (let i = edge; i < ch.length; i++) ch[i] *= 8;

    const a = analyzeChannels([ch, ch], SR);
    expect(a.nanCount).toBe(0);
    expect(a.clipCount).toBe(0);
    expect(a.maxSmoothnessDeltaRms).toBeGreaterThan(SMOOTHNESS_MAX_DELTA_RMS);
    expect(a.maxSmoothnessDeltaDb).toBeGreaterThan(SMOOTHNESS_MAX_DELTA_DB);
    expect(a.smoothnessViolations).toBeGreaterThan(0);
    expect(audioSmoothnessPass(a)).toBe(false);
    expect(audioHealthPass(a)).toBe(false);
  });

  it('fails an order-of-magnitude jump inside the quiet bed', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 4;
    const ch = sine(seconds, 220, QUIET_STEP_FROM);
    const edge = Math.round((SILENCE_ONSET_GRACE_S + 2) * SR);
    for (let i = edge; i < ch.length; i++) ch[i] *= QUIET_STEP_TO / QUIET_STEP_FROM;

    const a = analyzeChannels([ch, ch], SR);
    expect(a.maxSmoothnessDeltaRms).toBeLessThan(SMOOTHNESS_MAX_DELTA_RMS);
    expect(a.maxSmoothnessDeltaDb).toBeGreaterThan(SMOOTHNESS_MAX_QUIET_DELTA_DB);
    expect(audioSmoothnessPass(a)).toBe(false);
  });

  it('accepts the same quiet-bed change through a named long slew', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 5;
    const ch = sine(seconds, 220, 1);
    const edge = Math.round((SILENCE_ONSET_GRACE_S + 1) * SR);
    const slewFrames = Math.round(QUIET_SLEW_SECONDS * SR);
    for (let i = 0; i < ch.length; i++) {
      const progress = Math.min(1, Math.max(0, (i - edge) / slewFrames));
      ch[i] *= QUIET_STEP_FROM + (QUIET_SLEW_TO - QUIET_STEP_FROM) * progress;
    }
    expect(audioSmoothnessPass(analyzeChannels([ch, ch], SR))).toBe(true);
  });

  it('reproduces the old era-changing BUILD-to-BLOOM riser reset and passes the held release', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 4;
    const edge = Math.round((SILENCE_ONSET_GRACE_S + 2) * SR);
    const oldReset = sine(seconds, 220, RISER_TEST_BED_FLOOR + RISER_OLD_START_GAIN);
    for (let i = edge; i < oldReset.length; i++) {
      oldReset[i] *=
        (RISER_TEST_BED_FLOOR + RISER_OLD_RESET_GAIN) /
        (RISER_TEST_BED_FLOOR + RISER_OLD_START_GAIN);
    }
    expect(audioSmoothnessPass(analyzeChannels([oldReset, oldReset], SR))).toBe(false);

    const heldRelease = sine(seconds, 220, 1);
    const releaseFrames = Math.round(RISER_FIXED_RELEASE_S * SR);
    for (let i = 0; i < heldRelease.length; i++) {
      const progress = Math.min(1, Math.max(0, (i - edge) / releaseFrames));
      heldRelease[i] *= RISER_TEST_BED_FLOOR + RISER_OLD_START_GAIN * (1 - progress);
    }
    expect(audioSmoothnessPass(analyzeChannels([heldRelease, heldRelease], SR))).toBe(true);
  });

  it('finds long silences after the onset grace', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 12;
    const ch = sine(seconds, 220, 0.2);
    // 5 seconds of digital silence in the middle, after the grace window.
    const from = Math.round((SILENCE_ONSET_GRACE_S + 3) * SR);
    ch.fill(0, from, from + 5 * SR);
    const a = analyzeChannels([ch], SR);
    expect(a.longestSilenceS).toBeGreaterThanOrEqual(4);
    expect(a.longestSilenceS).toBeLessThanOrEqual(6);
    expect(audioFloorPass(a)).toBe(false);
    expect(audioHealthPass(a)).toBe(false);
  });
});

describe('encodeWavPcm16', () => {
  it('writes a well-formed RIFF header and correct sizes', () => {
    const frames = 1000;
    const wav = encodeWavPcm16([new Float32Array(frames), new Float32Array(frames)], SR);
    const view = new DataView(wav);
    const ascii = (o: number, n: number): string =>
      Array.from({ length: n }, (_, i) => String.fromCharCode(view.getUint8(o + i))).join('');
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getUint32(40, true)).toBe(frames * 4); // data bytes
    expect(wav.byteLength).toBe(44 + frames * 4);
  });

  it('round-trips full-scale samples with clamping', () => {
    const ch = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]);
    const wav = encodeWavPcm16([ch], SR);
    const view = new DataView(wav);
    const sample = (i: number): number => view.getInt16(44 + i * 2, true);
    expect(sample(0)).toBe(0);
    expect(sample(1)).toBe(Math.trunc(0.5 * 0x7fff)); // setInt16 truncates
    expect(sample(3)).toBe(0x7fff);
    expect(sample(4)).toBe(-0x8000);
    expect(sample(5)).toBe(0x7fff); // clamped
    expect(sample(6)).toBe(-0x8000); // clamped
  });
});
