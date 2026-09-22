import { describe, expect, it, vi } from 'vitest';
import { analyzeChannels } from './audioAnalysis.ts';
import { renderCombinedOffline } from './offlineRender.ts';
import { renderStageEvidence, type StageEvidenceName } from './excerpts.ts';

// CPU-only contract at the engine boundary. Browser PCM equality is a separate leased check.
vi.mock('./offlineRender.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('./offlineRender.ts')>();
  const render = async (options: import('./offlineRender.ts').BedRenderOptions) => {
    const channel = Float32Array.from({ length: 4000 }, (_, i) => 0.04 * Math.sin(i * 0.1));
    const buffer = { numberOfChannels: 2, sampleRate: 1000, getChannelData: () => channel } as unknown as AudioBuffer;
    return { buffer, analysis: analyzeChannels([channel, channel], 1000), bars: 1, sfxCuesFired: options.sfxScript?.length ?? 0,
      diagnosticTrace: options.captureStressDiagnostics ? {
        cues: (options.sfxScript ?? []).map(cue => ({ cue, dispatchedAtS: cue.t })),
        signals: [0, 15, 30, 55].map(atS => ({ atS, signals: options.script!(atS) }))
      } : undefined };
  };
  return { ...actual, renderBedOffline: vi.fn(render), renderCombinedOffline: vi.fn(render) };
});

describe('stage diagnostic engine contract', () => {
  const names: StageEvidenceName[] = ['stress-shipcrash-bloom', 'stress-mining-burst', 'stress-oxygen-dive', 'stress-terminal-storylead', 'stress-jetpack-splash'];
  for (const name of names) it(`${name} keeps the default fixture, rails and nominal output options`, async () => {
    const original = await renderStageEvidence({ name, quality: 'lean' });
    const baseline = vi.mocked(renderCombinedOffline).mock.calls.slice(-1)[0][0];
    expect(original.fileStem).toBe(`${name}_lean`);
    expect(original.diagnostics).toBeUndefined();
    expect(baseline.captureStressDiagnostics).toBeUndefined();
    expect(baseline.seconds).toBe(name === 'stress-shipcrash-bloom' ? 210 : 60);
    const expected = { ...baseline, script: undefined };
    for (const variant of ['music-no-sfx', 'music-ducked', 'sfx-only', 'sum'] as const) {
      const result = await renderStageEvidence({ name, quality: 'lean', diagnosticVariant: variant });
      const options = vi.mocked(renderCombinedOffline).mock.calls.slice(-1)[0][0];
      expect({ ...options, script: undefined }).toEqual({ ...expected, captureStressDiagnostics: true,
        ...(variant === 'music-no-sfx' ? { sfxScript: [] } : {}),
        ...(variant === 'music-ducked' ? { sfxAudible: false } : {}),
        ...(variant === 'sfx-only' ? { musicSilent: true } : {}) });
      for (const t of [0, 8, 14, 27.5, 34.1, 54.5, 59]) expect(options.script!(t)).toEqual(baseline.script!(t));
      expect(result.stressEvidence).toEqual(original.stressEvidence);
      expect(result.diagnostics?.purpose).toBe(variant === 'sum' ? 'acceptance-sum' : 'diagnostic-only');
      expect(result.diagnostics?.counts.liveAccepted).toBeNull();
    }
  });
  it('rejects an isolation request for a non-stress fixture', async () => {
    await expect(renderStageEvidence({ name: 'bare-bed', diagnosticVariant: 'sum' })).rejects.toThrow('original stress');
  });
});
