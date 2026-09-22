// --- Stage 2 game-mix tuning (audio-10x, scene-contract draft-v3) --------------------------------
//
// Every knob of the mastering tail, the category buses, the duck matrix and
// the snapshot mixer is a named constant here so the owner can retune after
// listening. Loudness targets (TARGET_LUFS_I, TARGET_TP_DBTP, BLOOM_ST_LUFS …)
// stay in generative/tuning.ts beside the Stage 1 glue constants.

import { TARGET_TP_DBTP } from '../generative/tuning.ts';

// --- Safety compressor (contract acceptanceCriteria[5]: a safety device, not a programme squash) --
/** Threshold, dB. Above the bed's whole dynamic range; only a runaway sum reaches it. */
export const SAFETY_THRESH_DB = -6;
export const SAFETY_RATIO = 20;
/** 0 to 3 dB permitted by the contract; 3 keeps the onset of gain reduction gentle. */
export const SAFETY_KNEE_DB = 3;
/** At most 0.003 s by contract. */
export const SAFETY_ATTACK_S = 0.003;
export const SAFETY_RELEASE_S = 0.1;
/**
 * Chrome's DynamicsCompressor bakes a makeup gain in (pow(1/fullRangeGain, 0.6)).
 * Measured for the safety settings above exactly as GLUE_MAKEUP_COMP_DB is: a
 * -30 dBFS probe tone through the offline chain with and without the stage
 * (soak page measureSafetyStaticGainDb). This trim returns the safety stage to
 * unity static gain so no makeup exists anywhere in the chain.
 */
export const SAFETY_MAKEUP_COMP_DB = -2.91;
/**
 * The static gain the PRE-Stage-2 tail carried: the shipped safety compressor's
 * own baked makeup (threshold -20, ratio 8, 30 dB knee), measured with the same
 * -30 dBFS probe through the 'pre-stage-2' offline tail against the pre-tail tap.
 * Every Stage 1 level (BED_ALIVE_LIFT → -20.5 LUFS, the story floors, the bare
 * and colour eras) was measured THROUGH that gain, so Stage 2 keeps it as one
 * named, visible reference trim instead of a hidden compressor makeup. It is the
 * only static gain in the chain that is not a cancellation; see
 * evidence/stage-2/README.md (deviation 1) for the owner decision it carries.
 */
export const TAIL_REFERENCE_GAIN_DB = 1.99;

// --- True-peak limiter (after the SFX join, owning protection) ---------------------------------------
/** Threshold at the true-peak target: a DynamicsCompressor at 20:1, knee 0, fast attack. */
export const LIM_THRESH_DB = TARGET_TP_DBTP;
export const LIM_RATIO = 20;
export const LIM_KNEE_DB = 0;
export const LIM_ATTACK_S = 0.001;
export const LIM_RELEASE_S = 0.08;
/** Measured baked makeup of the limiter compressor, cancelled by a trim (same method). */
export const LIM_MAKEUP_COMP_DB = -0.57;
/**
 * The ceiling: a WaveShaper whose asymptote sits at CEILING_DBTP. The curve is
 * y = x / (1 + |x/c|^n)^(1/n) — unity slope and transparent (< 0.05 dB at -9
 * dBFS) below the ceiling, saturating smoothly to c above it. Oversampled 4× so
 * the inter-sample peaks the 4× analyser measures are bounded near c.
 */
export const CEILING_DBTP = TARGET_TP_DBTP;
export const CEILING_SOFTNESS = 6;
export const CEILING_OVERSAMPLE: OverSampleType = '4x';

// --- Music-path latency of the finished tail (Stage 3 LATENCY_COMP) ---------------------------------
//
// Measured on the finished tail with an impulse through the offline mirror
// (soak page measureTailLatencyS): glue compressor + safety compressor +
// limiter compressor pre-delays and the two oversampled shaper resamplers.
// SFX joins before the limiter, so its path latency is the 'sfx' entry and the
// music-versus-SFX offset is the difference.
//
// PER SAMPLE RATE, MEASURED (Stage 2 repair S2-D4, judge ruling on dissent D-2).
// The tail's latency is not a fixed sample count: Chromium's DynamicsCompressor
// carries a pre-delay specified in TIME (rate-invariant), while the oversampled
// WaveShaper's resampler is specified in samples (rate-dependent). Deriving the
// 48 kHz figure from the 44.1 kHz sample count is therefore wrong by ~1.4 ms.
// Each entry below is its own measurement, taken by measureTailLatencyS in an
// OfflineAudioContext AT THAT RATE; `audio:check` re-measures every entry each
// run and fails past LATENCY_COMP_TOLERANCE_S. Re-measure if the tail changes.

export interface TailLatencyS {
  /** Impulse at the music bus → output peak, seconds. */
  musicPathS: number;
  /** Impulse at the SFX join (post-bus, pre-limiter) → output peak, seconds. */
  sfxPathS: number;
}
/** The rates pinned by measurement. 44.1 kHz is the evidence render rate; 48 kHz is the common device rate. */
export const LATENCY_COMP_PINNED_RATES: readonly number[] = [44100, 48000];
/** One measured entry per pinned rate — never a scaled sample count. */
export const TAIL_LATENCY_BY_RATE_S: Readonly<Record<number, TailLatencyS>> = {
  // 1112 / 456 samples at 44.1 kHz; 1184 / 480 samples at 48 kHz. Neither pair
  // is the other rescaled: a samples-derived 48 kHz music path would read
  // 23.167 ms and the measurement is 24.667 ms — 1.5 ms of error avoided.
  44100: { musicPathS: 0.025215, sfxPathS: 0.01034 },
  48000: { musicPathS: 0.024667, sfxPathS: 0.01 }
};
/**
 * The live path selects its entry from `ctx.sampleRate` at arming: the nearest
 * pinned rate, because the rate-invariant compressor pre-delays dominate and
 * interpolating between two rates would invent a number nothing measured.
 * A rate far from both pinned rates still gets the nearer measurement — the
 * error is bounded by the ~1 ms spread between 44.1 and 48 kHz.
 */
export function tailLatencyForSampleRate(sampleRate: number): TailLatencyS & { pinnedRate: number; musicVsSfxS: number } {
  let pinnedRate = LATENCY_COMP_PINNED_RATES[0];
  for (const rate of LATENCY_COMP_PINNED_RATES) {
    if (Math.abs(rate - sampleRate) < Math.abs(pinnedRate - sampleRate)) pinnedRate = rate;
  }
  const entry = TAIL_LATENCY_BY_RATE_S[pinnedRate];
  return { ...entry, pinnedRate, musicVsSfxS: entry.musicPathS - entry.sfxPathS };
}
/**
 * The 44.1 kHz entries, kept as named constants because every Stage 2 evidence
 * render is at RENDER_SAMPLE_RATE 44100 and the ab-results table quotes them.
 * Live code must call `tailLatencyForSampleRate(ctx.sampleRate)` instead.
 */
export const LATENCY_COMP_MUSIC_PATH_S = TAIL_LATENCY_BY_RATE_S[44100].musicPathS;
export const LATENCY_COMP_SFX_PATH_S = TAIL_LATENCY_BY_RATE_S[44100].sfxPathS;
/** Music lags SFX by this on the same route (glue + safety pre-delays and the 2× soft-clip resampler), at 44.1 kHz. */
export const LATENCY_COMP_MUSIC_VS_SFX_S = LATENCY_COMP_MUSIC_PATH_S - LATENCY_COMP_SFX_PATH_S;
/** audio:check re-measures every pinned entry each run and fails past this drift, seconds. */
export const LATENCY_COMP_TOLERANCE_S = 0.0005;

// --- Category buses -----------------------------------------------------------------------------------
export type MixBus = 'music' | 'world' | 'player' | 'ui' | 'ship' | 'voice';
/** The SFX category buses (every MixBus but the music path). */
export type SfxBus = Exclude<MixBus, 'music'>;
export const MIX_BUSES: readonly MixBus[] = ['music', 'world', 'player', 'ui', 'ship', 'voice'];
/** SFX buses that pass the underwater muffle; ui/voice bypass it (the institution is not underwater). */
export const SUBMERGED_SFX_BUSES: readonly MixBus[] = ['world', 'player', 'ship'];
/** Snapshot bus-gain slew (95 % settled): a mix state change reads as the room changing, never a cut. */
export const MIX_SNAPSHOT_SLEW_S = 0.6;
/** Bus gains below this change are not written (dB). */
export const MIX_SNAPSHOT_EPSILON_DB = 0.05;

// --- Duck matrix ---------------------------------------------------------------------------------------
/** Under a story lead the music column is capped here: the score holds authority while a beat is active. */
export const DUCK_STORY_LEAD_CAP_DB = -3;
/** Ducks shallower than this are not applied (dB). */
export const DUCK_MIN_DB = -0.25;

// --- Per-frame automation hygiene (AudioDirector) -----------------------------------------------------
/** A resolved target must move by more than this (unit gain / normalised) to be re-written. */
export const AUTOMATION_EPSILON = 0.004;
/** …or this long must have passed since the last write of that lane (a keep-alive cadence). */
/**
 * Keep-alive cadence for the legacy engine's dirty-checked lanes (Stage 3
 * retune, evidence/stage-3/README.md): at 0.25 s the ~14 procedural targets
 * re-issued ~112 idempotent writes/s by themselves, which alone exceeded the
 * under-60-per-second steady-state term. A missed write still cannot stick —
 * it is re-issued within this cadence — and the curves are start-anchored
 * exponentials, so nothing audible depends on the interval.
 */
export const AUTOMATION_CADENCE_S = 2;
