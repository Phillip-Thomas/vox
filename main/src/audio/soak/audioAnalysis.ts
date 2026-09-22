// --- Rendered-buffer analysis + WAV encoding (P4 harness, pure) ----------------------------------
//
// Pure functions over Float32Array channel data: the audio-level soak
// assertions (no NaN, no clipping, a bed that never flatlines) and the
// 16-bit PCM encoder for the owner-audition excerpts. No WebAudio types —
// runs identically under vitest (node) and in the harness page (browser).

import { SOAK_CLIP_LIMIT } from '../generative/soak.ts';

/** RMS window for loudness profiling and silence detection, seconds. */
export const ANALYSIS_WINDOW_S = 0.5;
/** Below this window-RMS the bed counts as silent (the REST floor sits well above). */
export const SILENCE_RMS = 1e-4;
/** Ignore the first seconds when measuring silence (voices fade in from 0). */
export const SILENCE_ONSET_GRACE_S = 8;
/** Quiet-bed law: no silent analysis window is allowed after the onset grace. */
export const MAX_LONGEST_SILENCE_S = 0;
/**
 * Short envelope window for the symphony-law smoothness audit. This is long
 * enough to measure perceived level rather than individual waveform cycles,
 * while still exposing a gain/filter jump within a tenth of a second.
 */
export const SMOOTHNESS_WINDOW_S = 0.1;
/**
 * Above this RMS, the tighter full-level relative bound applies. Quieter
 * windows remain protected by the separate denominator-clamped quiet-bed tier.
 */
export const SMOOTHNESS_RMS_FLOOR = 0.02;
/** Quiet-bed relative audit starts once either window reaches this audible RMS. */
export const SMOOTHNESS_QUIET_AUDIBLE_RMS = 0.005;
/** Denominator clamp for quiet-bed dB ratios (prevents near-zero instability). */
export const SMOOTHNESS_QUIET_RATIO_FLOOR_RMS = 0.001;
/** Largest allowed adjacent-window RMS jump (linear full-scale units). */
export const SMOOTHNESS_MAX_DELTA_RMS = 0.04;
/** Largest allowed adjacent-window loudness jump when both windows are audible. */
export const SMOOTHNESS_MAX_DELTA_DB = 4.5;
/** Quiet floor permits note breath, but never a step-shaped order-of-magnitude jump. */
export const SMOOTHNESS_MAX_QUIET_DELTA_DB = 12;

export interface AudioAnalysis {
  seconds: number;
  peak: number;
  rms: number;
  nanCount: number;
  clipCount: number;
  /** Longest run of sub-SILENCE_RMS windows after the onset grace, seconds. */
  longestSilenceS: number;
  /** Loudest ANALYSIS_WINDOW_S window RMS (mix-headroom evidence). */
  maxWindowRms: number;
  /** Largest adjacent SMOOTHNESS_WINDOW_S RMS change after onset grace. */
  maxSmoothnessDeltaRms: number;
  /** Time of maxSmoothnessDeltaRms, at the second window's leading edge. */
  maxSmoothnessDeltaAtS: number;
  /** Largest audible adjacent-window change, expressed as an absolute dB delta. */
  maxSmoothnessDeltaDb: number;
  /** Time of maxSmoothnessDeltaDb, at the second window's leading edge. */
  maxSmoothnessDeltaDbAtS: number;
  /** Adjacent RMS endpoints that produced maxSmoothnessDeltaDb. */
  maxSmoothnessPreviousRms: number;
  maxSmoothnessCurrentRms: number;
  /** Windows exceeding either named symphony-law bound. */
  smoothnessViolations: number;
}

export function analyzeChannels(channels: readonly Float32Array[], sampleRate: number): AudioAnalysis {
  const frames = channels[0]?.length ?? 0;
  let peak = 0;
  let sumSquares = 0;
  let nanCount = 0;
  let clipCount = 0;
  const win = Math.max(1, Math.round(ANALYSIS_WINDOW_S * sampleRate));
  const graceWindows = Math.ceil((SILENCE_ONSET_GRACE_S * sampleRate) / win);
  let windowSum = 0;
  let windowIndex = 0;
  let silentRun = 0;
  let longestSilentRun = 0;
  let maxWindowRms = 0;
  const smoothWin = Math.max(1, Math.round(SMOOTHNESS_WINDOW_S * sampleRate));
  const smoothGraceWindows = Math.ceil((SILENCE_ONSET_GRACE_S * sampleRate) / smoothWin);
  const smoothnessWindows: number[] = [];
  let smoothnessSum = 0;
  let smoothnessFrames = 0;

  for (let i = 0; i < frames; i++) {
    let frameSquare = 0;
    for (const channel of channels) {
      const s = channel[i];
      if (!Number.isFinite(s)) {
        nanCount++;
        continue;
      }
      const a = Math.abs(s);
      if (a >= SOAK_CLIP_LIMIT) clipCount++;
      if (a > peak) peak = a;
      frameSquare += s * s;
    }
    const meanSquare = frameSquare / Math.max(1, channels.length);
    sumSquares += meanSquare;
    windowSum += meanSquare;
    smoothnessSum += meanSquare;
    smoothnessFrames++;
    if ((i + 1) % win === 0 || i === frames - 1) {
      const windowRms = Math.sqrt(windowSum / win);
      if (windowRms > maxWindowRms) maxWindowRms = windowRms;
      if (windowIndex >= graceWindows) {
        if (windowRms < SILENCE_RMS) {
          silentRun++;
          if (silentRun > longestSilentRun) longestSilentRun = silentRun;
        } else {
          silentRun = 0;
        }
      }
      windowSum = 0;
      windowIndex++;
    }
    if ((i + 1) % smoothWin === 0 || i === frames - 1) {
      smoothnessWindows.push(Math.sqrt(smoothnessSum / Math.max(1, smoothnessFrames)));
      smoothnessSum = 0;
      smoothnessFrames = 0;
    }
  }

  let maxSmoothnessDeltaRms = 0;
  let maxSmoothnessDeltaAtS = 0;
  let maxSmoothnessDeltaDb = 0;
  let maxSmoothnessDeltaDbAtS = 0;
  let maxSmoothnessPreviousRms = 0;
  let maxSmoothnessCurrentRms = 0;
  let smoothnessViolations = 0;
  for (let i = Math.max(1, smoothGraceWindows); i < smoothnessWindows.length; i++) {
    const previous = smoothnessWindows[i - 1];
    const current = smoothnessWindows[i];
    const deltaRms = Math.abs(current - previous);
    const atS = (i * smoothWin) / sampleRate;
    if (deltaRms > maxSmoothnessDeltaRms) {
      maxSmoothnessDeltaRms = deltaRms;
      maxSmoothnessDeltaAtS = atS;
    }
    let deltaDb = 0;
    const quietAudible = Math.max(previous, current) >= SMOOTHNESS_QUIET_AUDIBLE_RMS;
    if (quietAudible) {
      const ratioPrevious = Math.max(SMOOTHNESS_QUIET_RATIO_FLOOR_RMS, previous);
      const ratioCurrent = Math.max(SMOOTHNESS_QUIET_RATIO_FLOOR_RMS, current);
      deltaDb = Math.abs(20 * Math.log10(ratioCurrent / ratioPrevious));
      if (deltaDb > maxSmoothnessDeltaDb) {
        maxSmoothnessDeltaDb = deltaDb;
        maxSmoothnessDeltaDbAtS = atS;
        maxSmoothnessPreviousRms = previous;
        maxSmoothnessCurrentRms = current;
      }
    }
    const bothFullLevel = previous >= SMOOTHNESS_RMS_FLOOR && current >= SMOOTHNESS_RMS_FLOOR;
    const relativeLimit = bothFullLevel
      ? SMOOTHNESS_MAX_DELTA_DB
      : SMOOTHNESS_MAX_QUIET_DELTA_DB;
    if (deltaRms > SMOOTHNESS_MAX_DELTA_RMS || deltaDb > relativeLimit) {
      smoothnessViolations++;
    }
  }

  return {
    seconds: frames / sampleRate,
    peak,
    rms: frames ? Math.sqrt(sumSquares / frames) : 0,
    nanCount,
    clipCount,
    longestSilenceS: longestSilentRun * (win / sampleRate),
    maxWindowRms,
    maxSmoothnessDeltaRms,
    maxSmoothnessDeltaAtS,
    maxSmoothnessDeltaDb,
    maxSmoothnessDeltaDbAtS,
    maxSmoothnessPreviousRms,
    maxSmoothnessCurrentRms,
    smoothnessViolations
  };
}

/** The rendered symphony law: no step-shaped short-window level changes. */
export function audioSmoothnessPass(a: AudioAnalysis): boolean {
  return a.smoothnessViolations === 0;
}

/** The owner-ruling quiet floor: the shipped bed never flatlines. */
export function audioFloorPass(a: AudioAnalysis): boolean {
  return a.longestSilenceS <= MAX_LONGEST_SILENCE_S;
}

/** The audio-level pass/fail: finite, unclipped, smooth, and never silent. */
export function audioHealthPass(a: AudioAnalysis): boolean {
  return (
    a.nanCount === 0 &&
    a.clipCount === 0 &&
    audioSmoothnessPass(a) &&
    audioFloorPass(a)
  );
}

/** Encode channels as a 16-bit PCM RIFF/WAVE file. */
export function encodeWavPcm16(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

// --- ITU-R BS.1770-4 loudness, true peak, correlation, spectral proxy -----------------------------
//
// Stage 0 evidence floor. Pure functions over Float32Array channel data, no
// WebAudio types, so the same code runs under vitest (node) and inside the
// score-soak harness page. Nothing here is in a shipped audio path — these are
// measurement instruments for the offline renders only.

/** BS.1770-4 stage-1 high-shelf ("head" filter) design parameters. */
export const K_SHELF_FC_HZ = 1681.974450955533;
export const K_SHELF_GAIN_DB = 3.999843853973347;
export const K_SHELF_Q = 0.7071752369554196;
/** Vb = Vh^K_SHELF_VB_EXPONENT — the shelf's mid-band gain term. */
export const K_SHELF_VB_EXPONENT = 0.4996667741545416;
/** BS.1770-4 stage-2 RLB high-pass design parameters. */
export const K_HPF_FC_HZ = 38.13547087602444;
export const K_HPF_Q = 0.5003270373238773;
/** The BS.1770-4 loudness offset, in LKFS. */
export const LUFS_OFFSET_DB = -0.691;
/** Absolute gate (BS.1770-4 §5.1), LKFS. */
export const LUFS_ABSOLUTE_GATE = -70;
/** Relative gate below the absolute-gated mean (BS.1770-4 §5.1), LU. */
export const LUFS_RELATIVE_GATE_LU = -10;
/** EBU R128 loudness-range relative gate below the short-term gated mean, LU. */
export const LRA_RELATIVE_GATE_LU = -20;
export const LRA_LOW_PERCENTILE = 0.1;
export const LRA_HIGH_PERCENTILE = 0.95;
/** Momentary window (BS.1770-4 / EBU Tech 3341), seconds. */
export const MOMENTARY_WINDOW_S = 0.4;
/** Short-term window (EBU Tech 3341), seconds. */
export const SHORT_TERM_WINDOW_S = 3;
/** Block hop for both loudness ladders (75% overlap on the momentary window). */
export const LOUDNESS_HOP_S = 0.1;
/** Hop of the published short-term series (a 3 s window every second). */
export const SHORT_TERM_SERIES_HOP_S = 1;
/** True-peak oversampling factor (BS.1770-4 Annex 2 minimum). */
export const TRUE_PEAK_OVERSAMPLE = 4;
/** Half-length, in input samples, of each polyphase interpolation phase. */
export const TRUE_PEAK_HALF_TAPS = 12;
/** Window length for the spectral proxy series, seconds. */
export const SPECTRAL_WINDOW_S = 0.5;
/** Band-split corners for the 4-band spectral energy proxy, Hz. */
export const SPECTRAL_BAND_EDGES_HZ = [200, 800, 3200] as const;
/** Floor for dB conversions of an all-zero measurement. */
const SILENT_DB = -Infinity;

export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface KWeightingFilters {
  /** Stage 1: the spherical-head high shelf. */
  shelf: Biquad;
  /** Stage 2: the RLB high-pass. */
  highpass: Biquad;
}

/**
 * The BS.1770-4 reference coefficient table at 48 kHz. `designKWeighting(48000)`
 * must reproduce it — that is what pins the analytic design to the spec.
 */
export const K_WEIGHTING_48K_REFERENCE: KWeightingFilters = {
  shelf: {
    b0: 1.53512485958697,
    b1: -2.69169618940638,
    b2: 1.19839281085285,
    a1: -1.69065929318241,
    a2: 0.73248077421585
  },
  highpass: { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 }
};

/** Design the two K-weighting biquads for any render rate (44.1 kHz included). */
export function designKWeighting(sampleRate: number): KWeightingFilters {
  const shelfK = Math.tan((Math.PI * K_SHELF_FC_HZ) / sampleRate);
  const vh = Math.pow(10, K_SHELF_GAIN_DB / 20);
  const vb = Math.pow(vh, K_SHELF_VB_EXPONENT);
  const shelfA0 = 1 + shelfK / K_SHELF_Q + shelfK * shelfK;
  const shelf: Biquad = {
    b0: (vh + (vb * shelfK) / K_SHELF_Q + shelfK * shelfK) / shelfA0,
    b1: (2 * (shelfK * shelfK - vh)) / shelfA0,
    b2: (vh - (vb * shelfK) / K_SHELF_Q + shelfK * shelfK) / shelfA0,
    a1: (2 * (shelfK * shelfK - 1)) / shelfA0,
    a2: (1 - shelfK / K_SHELF_Q + shelfK * shelfK) / shelfA0
  };
  const hpK = Math.tan((Math.PI * K_HPF_FC_HZ) / sampleRate);
  const hpA0 = 1 + hpK / K_HPF_Q + hpK * hpK;
  const highpass: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (hpK * hpK - 1)) / hpA0,
    a2: (1 - hpK / K_HPF_Q + hpK * hpK) / hpA0
  };
  return { shelf, highpass };
}

/** Direct-form-I biquad over a whole channel, allocating one output array. */
export function applyBiquad(input: Float32Array, f: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

function kWeight(channel: Float32Array, sampleRate: number): Float32Array {
  const filters = designKWeighting(sampleRate);
  return applyBiquad(applyBiquad(channel, filters.shelf), filters.highpass);
}

/**
 * Per-block mean-square sums of the K-weighted channels, summed across
 * channels with BS.1770 weight 1.0 (stereo L/R — the render is always stereo).
 */
function blockPowers(
  weighted: readonly Float32Array[],
  sampleRate: number,
  windowS: number
): Float64Array {
  const frames = weighted[0]?.length ?? 0;
  const win = Math.max(1, Math.round(windowS * sampleRate));
  const hop = Math.max(1, Math.round(LOUDNESS_HOP_S * sampleRate));
  if (frames < win) return new Float64Array(0);
  // Prefix sums of the summed per-channel square keep every window O(1).
  const prefix = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) {
    let square = 0;
    for (const channel of weighted) {
      const s = channel[i];
      if (Number.isFinite(s)) square += s * s;
    }
    prefix[i + 1] = prefix[i] + square;
  }
  const count = Math.floor((frames - win) / hop) + 1;
  const powers = new Float64Array(count);
  for (let b = 0; b < count; b++) {
    const start = b * hop;
    powers[b] = (prefix[start + win] - prefix[start]) / win;
  }
  return powers;
}

function powerToLufs(power: number): number {
  return power > 0 ? LUFS_OFFSET_DB + 10 * Math.log10(power) : SILENT_DB;
}

function gatedMeanLufs(powers: Float64Array, relativeGateLu: number): number {
  let sum = 0;
  let count = 0;
  for (const p of powers) {
    if (powerToLufs(p) > LUFS_ABSOLUTE_GATE) {
      sum += p;
      count++;
    }
  }
  if (count === 0) return SILENT_DB;
  const relativeGate = powerToLufs(sum / count) + relativeGateLu;
  let gatedSum = 0;
  let gatedCount = 0;
  for (const p of powers) {
    const l = powerToLufs(p);
    if (l > LUFS_ABSOLUTE_GATE && l > relativeGate) {
      gatedSum += p;
      gatedCount++;
    }
  }
  return gatedCount === 0 ? SILENT_DB : powerToLufs(gatedSum / gatedCount);
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return SILENT_DB;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1)))
  );
  return sorted[index];
}

/** EBU R128 loudness range over the short-term ladder. */
function loudnessRange(shortTermPowers: Float64Array): number {
  const absolute: number[] = [];
  let sum = 0;
  for (const p of shortTermPowers) {
    if (powerToLufs(p) > LUFS_ABSOLUTE_GATE) {
      absolute.push(p);
      sum += p;
    }
  }
  if (absolute.length === 0) return 0;
  const relativeGate = powerToLufs(sum / absolute.length) + LRA_RELATIVE_GATE_LU;
  const gated = absolute
    .map(powerToLufs)
    .filter((l) => l > relativeGate)
    .sort((a, b) => a - b);
  if (gated.length === 0) return 0;
  return percentile(gated, LRA_HIGH_PERCENTILE) - percentile(gated, LRA_LOW_PERCENTILE);
}

/**
 * Polyphase windowed-sinc interpolation phases for TRUE_PEAK_OVERSAMPLE×
 * upsampling. Phase 0 is the identity tap, so the sample peak is always
 * included in the maximum.
 */
function truePeakPhases(): Float64Array[] {
  const taps = TRUE_PEAK_HALF_TAPS * 2;
  const phases: Float64Array[] = [];
  for (let phase = 0; phase < TRUE_PEAK_OVERSAMPLE; phase++) {
    const kernel = new Float64Array(taps);
    const offset = phase / TRUE_PEAK_OVERSAMPLE;
    let sum = 0;
    for (let t = 0; t < taps; t++) {
      const x = t - (TRUE_PEAK_HALF_TAPS - 1) - offset;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      // Blackman window over the tap span keeps the stopband down without
      // needing the spec's fixed 48-tap table at a single sample rate.
      const w = (t + 0.5) / taps;
      const window =
        0.42 - 0.5 * Math.cos(2 * Math.PI * w) + 0.08 * Math.cos(4 * Math.PI * w);
      kernel[t] = sinc * window;
      sum += kernel[t];
    }
    // Unity DC gain per phase: an interpolated constant must stay constant.
    if (sum !== 0) for (let t = 0; t < taps; t++) kernel[t] /= sum;
    phases.push(kernel);
  }
  return phases;
}

/**
 * Only interpolate around samples within this fraction of the sample peak.
 * Sinc interpolation between neighbours that are all far below the sample peak
 * cannot exceed it, and the sample peak itself is always in the maximum, so
 * the gate bounds the cost of a 90 s render without changing the answer.
 */
export const TRUE_PEAK_INTERPOLATION_GATE = 0.5;

/** Peak of the 4× oversampled signal, linear full-scale, over all channels. */
export function truePeakLinear(channels: readonly Float32Array[]): number {
  const phases = truePeakPhases();
  const taps = TRUE_PEAK_HALF_TAPS * 2;
  let samplePeak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i];
      if (!Number.isFinite(s)) continue;
      const a = Math.abs(s);
      if (a > samplePeak) samplePeak = a;
    }
  }
  const gate = samplePeak * TRUE_PEAK_INTERPOLATION_GATE;
  let peak = samplePeak;
  for (const channel of channels) {
    const frames = channel.length;
    for (let i = 0; i < frames; i++) {
      // Dilate the gate by one sample on each side: an inter-sample peak sits
      // between two samples, so a loud neighbour must also open the window.
      const near =
        Math.abs(channel[i]) >= gate ||
        (i > 0 && Math.abs(channel[i - 1]) >= gate) ||
        (i + 1 < frames && Math.abs(channel[i + 1]) >= gate);
      if (!near) continue;
      for (let phase = 1; phase < TRUE_PEAK_OVERSAMPLE; phase++) {
        const kernel = phases[phase];
        let acc = 0;
        for (let t = 0; t < taps; t++) {
          const index = i + t - (TRUE_PEAK_HALF_TAPS - 1);
          if (index < 0 || index >= frames) continue;
          const v = channel[index];
          if (Number.isFinite(v)) acc += kernel[t] * v;
        }
        const a = Math.abs(acc);
        if (a > peak) peak = a;
      }
    }
  }
  return peak;
}

/** Pearson correlation between the first two channels; 1 for mono-identical. */
export function interChannelCorrelation(channels: readonly Float32Array[]): number {
  const l = channels[0];
  const r = channels[1] ?? channels[0];
  if (!l || l.length === 0) return 1;
  const frames = Math.min(l.length, r.length);
  let dot = 0;
  let ll = 0;
  let rr = 0;
  for (let i = 0; i < frames; i++) {
    const a = Number.isFinite(l[i]) ? l[i] : 0;
    const b = Number.isFinite(r[i]) ? r[i] : 0;
    dot += a * b;
    ll += a * a;
    rr += b * b;
  }
  if (ll === 0 || rr === 0) return 1;
  return dot / Math.sqrt(ll * rr);
}

export interface SpectralProxyWindow {
  atS: number;
  /** Zero crossings per second — a brightness proxy without an FFT. */
  zeroCrossingRate: number;
  /** Energy fraction in each of the 4 bands, summing to 1 for a live window. */
  bandFractions: readonly number[];
}

export interface SpectralProxy {
  windows: readonly SpectralProxyWindow[];
  meanZeroCrossingRate: number;
  /** Whole-render band energy fractions (the timbre fingerprint for A/B). */
  bandFractions: readonly number[];
}

function bandSplitFilters(sampleRate: number): Biquad[] {
  // A cascade-free 4-band proxy: one lowpass, two bandpasses, one highpass,
  // each a single RBJ biquad at Q = 0.7071. Approximate by construction — the
  // value is the *difference* between two renders, not an absolute spectrum.
  const q = Math.SQRT1_2;
  const [low, mid, high] = SPECTRAL_BAND_EDGES_HZ;
  return [
    rbjLowpass(low, sampleRate, q),
    rbjBandpass(Math.sqrt(low * mid), sampleRate, q),
    rbjBandpass(Math.sqrt(mid * high), sampleRate, q),
    rbjHighpass(high, sampleRate, q)
  ];
}

function rbjLowpass(fc: number, sampleRate: number, q: number): Biquad {
  const w = (2 * Math.PI * fc) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cos) / 2) / a0,
    b1: (1 - cos) / a0,
    b2: ((1 - cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0
  };
}

function rbjHighpass(fc: number, sampleRate: number, q: number): Biquad {
  const w = (2 * Math.PI * fc) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: ((1 + cos) / 2) / a0,
    b1: (-(1 + cos)) / a0,
    b2: ((1 + cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0
  };
}

function rbjBandpass(fc: number, sampleRate: number, q: number): Biquad {
  const w = (2 * Math.PI * fc) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0
  };
}

/** Windowed zero-crossing + 4-band energy proxy for later timbre A/B. */
export function spectralProxy(
  channels: readonly Float32Array[],
  sampleRate: number
): SpectralProxy {
  const frames = channels[0]?.length ?? 0;
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (const channel of channels) {
      const s = channel[i];
      if (Number.isFinite(s)) sum += s;
    }
    mono[i] = sum / Math.max(1, channels.length);
  }
  const bands = bandSplitFilters(sampleRate).map((f) => applyBiquad(mono, f));
  const win = Math.max(1, Math.round(SPECTRAL_WINDOW_S * sampleRate));
  const windows: SpectralProxyWindow[] = [];
  const totalBandEnergy = new Float64Array(bands.length);
  let totalCrossings = 0;
  for (let start = 0; start + win <= frames; start += win) {
    let crossings = 0;
    for (let i = start + 1; i < start + win; i++) {
      if (mono[i - 1] < 0 !== mono[i] < 0) crossings++;
    }
    const energies = bands.map((band) => {
      let e = 0;
      for (let i = start; i < start + win; i++) e += band[i] * band[i];
      return e;
    });
    const sum = energies.reduce((a, b) => a + b, 0);
    for (let b = 0; b < energies.length; b++) totalBandEnergy[b] += energies[b];
    totalCrossings += crossings;
    windows.push({
      atS: start / sampleRate,
      zeroCrossingRate: (crossings * sampleRate) / win,
      bandFractions: energies.map((e) => (sum > 0 ? e / sum : 0))
    });
  }
  const grandTotal = totalBandEnergy.reduce((a, b) => a + b, 0);
  return {
    windows,
    meanZeroCrossingRate: windows.length
      ? (totalCrossings * sampleRate) / (win * windows.length)
      : 0,
    bandFractions: Array.from(totalBandEnergy, (e) => (grandTotal > 0 ? e / grandTotal : 0))
  };
}

export interface LoudnessAnalysis {
  /** BS.1770-4 gated integrated loudness, LUFS. */
  integratedLufs: number;
  /** Loudest 3 s window, LUFS. */
  shortTermMaxLufs: number;
  /** Start time of that loudest 3 s window, seconds (Stage 2 BLOOM locator). */
  shortTermMaxAtS: number;
  /**
   * Short-term (3 s) loudness sampled once per SHORT_TERM_SERIES_HOP_S along the
   * render, LUFS; index k is the window starting at k · hop. Stage 2 asserts the
   * old and new mastering tails agree at every window.
   */
  shortTermSeriesLufs: number[];
  /** Loudest 400 ms window, LUFS. */
  momentaryMaxLufs: number;
  /** EBU R128 loudness range, LU. */
  loudnessRangeLu: number;
  /** 4× oversampled true peak, dBTP. */
  truePeakDbtp: number;
  /** Sample peak for comparison, dBFS. */
  samplePeakDbfs: number;
  /** Pearson L/R correlation: 1 = mono, 0 = uncorrelated, <0 = out of phase. */
  correlation: number;
  spectral: SpectralProxy;
}

/** The full Stage 0 loudness instrument over a rendered stereo buffer. */
export function analyzeLoudness(
  channels: readonly Float32Array[],
  sampleRate: number
): LoudnessAnalysis {
  const weighted = channels.map((channel) => kWeight(channel, sampleRate));
  const momentary = blockPowers(weighted, sampleRate, MOMENTARY_WINDOW_S);
  const shortTerm = blockPowers(weighted, sampleRate, SHORT_TERM_WINDOW_S);
  let samplePeak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i];
      if (!Number.isFinite(s)) continue;
      const a = Math.abs(s);
      if (a > samplePeak) samplePeak = a;
    }
  }
  const truePeak = truePeakLinear(channels);
  const maxLufs = (powers: Float64Array): number => {
    let best = SILENT_DB;
    for (const p of powers) {
      const l = powerToLufs(p);
      if (l > best) best = l;
    }
    return best;
  };
  let shortTermMaxAt = 0;
  {
    let best = SILENT_DB;
    for (let b = 0; b < shortTerm.length; b++) {
      const l = powerToLufs(shortTerm[b]);
      if (l > best) {
        best = l;
        shortTermMaxAt = b * LOUDNESS_HOP_S;
      }
    }
  }
  const seriesStride = Math.max(1, Math.round(SHORT_TERM_SERIES_HOP_S / LOUDNESS_HOP_S));
  const shortTermSeries: number[] = [];
  for (let b = 0; b < shortTerm.length; b += seriesStride) {
    const l = powerToLufs(shortTerm[b]);
    shortTermSeries.push(Number.isFinite(l) ? Math.round(l * 100) / 100 : -120);
  }
  return {
    integratedLufs: gatedMeanLufs(momentary, LUFS_RELATIVE_GATE_LU),
    shortTermMaxLufs: maxLufs(shortTerm),
    shortTermMaxAtS: Math.round(shortTermMaxAt * 10) / 10,
    shortTermSeriesLufs: shortTermSeries,
    momentaryMaxLufs: maxLufs(momentary),
    loudnessRangeLu: loudnessRange(shortTerm),
    truePeakDbtp: truePeak > 0 ? 20 * Math.log10(truePeak) : SILENT_DB,
    samplePeakDbfs: samplePeak > 0 ? 20 * Math.log10(samplePeak) : SILENT_DB,
    correlation: interChannelCorrelation(channels),
    spectral: spectralProxy(channels, sampleRate)
  };
}
