import { describe, expect, it } from 'vitest';
import {
  CEILING_DBTP,
  LATENCY_COMP_PINNED_RATES,
  LATENCY_COMP_MUSIC_PATH_S,
  LATENCY_COMP_MUSIC_VS_SFX_S,
  LATENCY_COMP_SFX_PATH_S,
  LIM_MAKEUP_COMP_DB,
  LIM_THRESH_DB,
  SAFETY_MAKEUP_COMP_DB,
  TAIL_LATENCY_BY_RATE_S,
  TAIL_REFERENCE_GAIN_DB,
  tailLatencyForSampleRate
} from './mixTuning.ts';
import { TARGET_TP_DBTP } from '../generative/tuning.ts';

// Stage 2 constants law: the measured constants are pinned to their measurement
// (evidence/stage-2/after/summary.json) and audio:check re-measures them every run.
describe('Stage 2 mix tuning constants', () => {
  it('limiter threshold and ceiling sit at the true-peak target', () => {
    expect(LIM_THRESH_DB).toBe(TARGET_TP_DBTP);
    expect(CEILING_DBTP).toBe(TARGET_TP_DBTP);
  });

  it('every compressor makeup trim is a cancellation (negative), the reference gain is the one named positive static gain', () => {
    expect(SAFETY_MAKEUP_COMP_DB).toBeLessThan(0);
    expect(LIM_MAKEUP_COMP_DB).toBeLessThan(0);
    // Measured pre-Stage-2 safety makeup: +1.9929 dB (evidence/stage-2/after/summary.json tailStageGains.legacySafety).
    expect(TAIL_REFERENCE_GAIN_DB).toBeCloseTo(1.99, 2);
  });

  it('publishes the measured music-path latency for Stage 3 (C6): once sampled, music lags SFX by under one 60 Hz frame', () => {
    expect(LATENCY_COMP_MUSIC_PATH_S).toBeCloseTo(0.025215, 5);
    expect(LATENCY_COMP_SFX_PATH_S).toBeCloseTo(0.01034, 5);
    expect(LATENCY_COMP_MUSIC_VS_SFX_S).toBeGreaterThan(0);
    expect(LATENCY_COMP_MUSIC_VS_SFX_S).toBeLessThan(1 / 60);
  });

  // S2-D4 / dissent D-2: per-rate MEASUREMENTS, never a scaled sample count.
  describe('tail latency per sample rate', () => {
    it('pins one measured entry per rate, and the 44.1 kHz aliases point at it', () => {
      for (const rate of LATENCY_COMP_PINNED_RATES) {
        const entry = TAIL_LATENCY_BY_RATE_S[rate];
        expect(entry, `no pinned entry for ${rate} Hz`).toBeDefined();
        expect(entry.musicPathS).toBeGreaterThan(entry.sfxPathS);
        expect(entry.musicPathS).toBeLessThan(0.05);
        expect(entry.sfxPathS).toBeGreaterThan(0);
      }
      expect(LATENCY_COMP_MUSIC_PATH_S).toBe(TAIL_LATENCY_BY_RATE_S[44100].musicPathS);
      expect(LATENCY_COMP_SFX_PATH_S).toBe(TAIL_LATENCY_BY_RATE_S[44100].sfxPathS);
    });

    it('is not the 44.1 kHz sample count rescaled: the compressor pre-delays are rate-invariant', () => {
      const at44 = TAIL_LATENCY_BY_RATE_S[44100];
      const at48 = TAIL_LATENCY_BY_RATE_S[48000];
      // A samples-derived 48 kHz figure would be 44100/48000 of the 44.1 kHz time.
      const samplesDerived = at44.musicPathS * (44100 / 48000);
      expect(Math.abs(at48.musicPathS - samplesDerived)).toBeGreaterThan(0.0005);
      // …and the true 48 kHz latency sits between the rate-invariant value and it.
      expect(at48.musicPathS).toBeLessThan(at44.musicPathS);
      expect(at48.musicPathS).toBeGreaterThan(samplesDerived);
    });

    it('selects the nearest pinned rate from ctx.sampleRate, and reports the offset from that entry', () => {
      expect(tailLatencyForSampleRate(44100).pinnedRate).toBe(44100);
      expect(tailLatencyForSampleRate(48000).pinnedRate).toBe(48000);
      expect(tailLatencyForSampleRate(44000).pinnedRate).toBe(44100);
      expect(tailLatencyForSampleRate(96000).pinnedRate).toBe(48000);
      const at48 = tailLatencyForSampleRate(48000);
      expect(at48.musicVsSfxS).toBeCloseTo(TAIL_LATENCY_BY_RATE_S[48000].musicPathS - TAIL_LATENCY_BY_RATE_S[48000].sfxPathS, 9);
      // Both pinned rates keep the music-vs-SFX offset inside one 60 Hz frame.
      for (const rate of LATENCY_COMP_PINNED_RATES) {
        expect(tailLatencyForSampleRate(rate).musicVsSfxS).toBeLessThan(1 / 60);
        expect(tailLatencyForSampleRate(rate).musicVsSfxS).toBeGreaterThan(0);
      }
    });
  });
});
