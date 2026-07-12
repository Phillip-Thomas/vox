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
  }

  return {
    seconds: frames / sampleRate,
    peak,
    rms: frames ? Math.sqrt(sumSquares / frames) : 0,
    nanCount,
    clipCount,
    longestSilenceS: longestSilentRun * (win / sampleRate),
    maxWindowRms
  };
}

/** The audio-level pass/fail: finite samples, nothing at/over full scale. */
export function audioHealthPass(a: AudioAnalysis): boolean {
  return a.nanCount === 0 && a.clipCount === 0;
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
