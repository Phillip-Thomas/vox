import {
  applyBiquad, designKWeighting, LOUDNESS_HOP_S, LUFS_ABSOLUTE_GATE,
  LUFS_OFFSET_DB, LUFS_RELATIVE_GATE_LU, MOMENTARY_WINDOW_S, SHORT_TERM_WINDOW_S
} from './audioAnalysis.ts';
import type { CombinedRenderOptions, SfxScriptCue } from './offlineRender.ts';

export const STRESS_DIAGNOSTIC_VARIANTS = ['music-no-sfx', 'music-ducked', 'sfx-only', 'sum'] as const;
export type StressDiagnosticVariant = (typeof STRESS_DIAGNOSTIC_VARIANTS)[number];

/** Only the existing isolation switches change; world/story scripts remain identical. */
export function isolateStressOptions(options: CombinedRenderOptions, variant?: StressDiagnosticVariant): CombinedRenderOptions {
  switch (variant) {
    case undefined: case 'sum': return options;
    case 'music-no-sfx': return { ...options, sfxScript: [] };
    case 'music-ducked': return { ...options, sfxAudible: false };
    case 'sfx-only': return { ...options, musicSilent: true };
    default: throw new Error(`Unknown stress diagnostic variant: ${String(variant)}`);
  }
}

export interface OfflineCueTrace {
  cue: SfxScriptCue;
  /** Driver time when fireSfxCue returned; cue.t is the scheduled audio time. */
  dispatchedAtS: number;
}

/** Measurements use the existing meter's filter, window and gate constants. */
export function analyzeStemEnergy(channels: readonly Float32Array[], sampleRate: number) {
  const frames = channels[0]?.length ?? 0;
  const filters = designKWeighting(sampleRate);
  const weighted = channels.map(c => applyBiquad(applyBiquad(c, filters.shelf), filters.highpass));
  const prefix = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) {
    let power = 0;
    for (const c of weighted) if (Number.isFinite(c[i])) power += c[i] ** 2;
    prefix[i + 1] = prefix[i] + power;
  }
  const lufs = (power: number): number | null => power > 0 ? LUFS_OFFSET_DB + 10 * Math.log10(power) : null;
  function windows(windowS: number) {
    const win = Math.round(windowS * sampleRate), hop = Math.round(LOUDNESS_HOP_S * sampleRate);
    const rows = [];
    for (let start = 0; start + win <= frames; start += hop) {
      const power = (prefix[start + win] - prefix[start]) / win;
      rows.push({ startS: start / sampleRate, kPower: power, kEnergySeconds: power * win / sampleRate, lufs: lufs(power) });
    }
    return rows;
  }
  const momentary = windows(MOMENTARY_WINDOW_S);
  const absolute = momentary.filter(b => b.lufs != null && b.lufs > LUFS_ABSOLUTE_GATE);
  const mean = (rows: typeof momentary) => rows.length ? rows.reduce((sum, r) => sum + r.kPower, 0) / rows.length : 0;
  const absoluteLufs = lufs(mean(absolute));
  const relativeGateLufs = absoluteLufs == null ? null : absoluteLufs + LUFS_RELATIVE_GATE_LU;
  const gateBlocks = momentary.map(b => ({ ...b,
    absolutePass: b.lufs != null && b.lufs > LUFS_ABSOLUTE_GATE,
    integratedPass: b.lufs != null && relativeGateLufs != null && b.lufs > LUFS_ABSOLUTE_GATE && b.lufs > relativeGateLufs
  }));
  const gated = gateBlocks.filter(b => b.integratedPass);
  return {
    method: 'Existing BS.1770 stereo K filters; 400 ms integrated blocks and every 3 s window at 100 ms hop. Null LUFS means silence.',
    sampleRate, frames, seconds: frames / sampleRate,
    windowHopS: LOUDNESS_HOP_S, absoluteGateLufs: LUFS_ABSOLUTE_GATE, relativeGateLufs,
    integratedLufs: lufs(mean(gated)), absoluteGateBlocks: absolute.length, integratedGateBlocks: gated.length,
    meanGatedKPower: mean(gated), meanAllBlockKPower: mean(momentary),
    totalKWeightedEnergySeconds: prefix[frames] / sampleRate,
    gateBlocks, shortTermWindows: windows(SHORT_TERM_WINDOW_S)
  };
}

/** Unnormalized, unclipped IEEE float WAV: exact samples used by the meter. */
export function encodeWavFloat32(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const frames = channels[0]?.length ?? 0, blockAlign = channels.length * 4;
  const dataBytes = frames * blockAlign, buffer = new ArrayBuffer(44 + dataBytes), view = new DataView(buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, 32, true); ascii(36, 'data'); view.setUint32(40, dataBytes, true);
  let at = 44;
  for (let i = 0; i < frames; i++) for (const c of channels) { view.setFloat32(at, c[i], true); at += 4; }
  return buffer;
}
