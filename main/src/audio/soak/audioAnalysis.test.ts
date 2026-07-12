import { describe, expect, it } from 'vitest';
import {
  analyzeChannels,
  audioHealthPass,
  encodeWavPcm16,
  SILENCE_ONSET_GRACE_S
} from './audioAnalysis.ts';

const SR = 44100;

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

  it('finds long silences after the onset grace', () => {
    const seconds = SILENCE_ONSET_GRACE_S + 12;
    const ch = sine(seconds, 220, 0.2);
    // 5 seconds of digital silence in the middle, after the grace window.
    const from = Math.round((SILENCE_ONSET_GRACE_S + 3) * SR);
    ch.fill(0, from, from + 5 * SR);
    const a = analyzeChannels([ch], SR);
    expect(a.longestSilenceS).toBeGreaterThanOrEqual(4);
    expect(a.longestSilenceS).toBeLessThanOrEqual(6);
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
