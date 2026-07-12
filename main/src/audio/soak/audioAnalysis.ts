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
