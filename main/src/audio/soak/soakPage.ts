import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import {
  EARLY_BEAT_AUDITIONS,
  EVIDENCE_PAIR_NAMES,
  EXCERPT_NAMES,
  INTRO_COMBINED_AUDITIONS,
  renderEarlyBeatAudition,
  renderEvidence,
  renderExcerpt,
  renderIntroCombinedAudition,
  runAudioSoak,
  runEraBuildSmoothnessSweep,
  runStoryHandoffSmoothnessSweep,
  runSmoothnessSweep,
  type EvidencePairName,
  type EvidenceVariant,
  type ExcerptName
} from './excerpts.ts';

// --- The score-soak harness page (P4) ---------------------------------------------------------------
//
// Served by the vite dev server at /score-soak.html; driven headless by
// score-soak-probe.mjs. The page renders the REAL engines offline and hands
// results (analysis, audit report, WAV bytes in base64 chunks) to the probe.
// Browser-only rim — all logic lives in excerpts.ts / offlineRender.ts.

const WAV_CHUNK_BYTES = 1 << 20;

let lastWav: Uint8Array | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export interface SoakPageApi {
  excerptNames: readonly ExcerptName[];
  evidencePairNames: readonly EvidencePairName[];
  earlyBeatAuditions: ReadonlyArray<{ beat: string; era: number }>;
  introCombinedAuditions: ReadonlyArray<{ beat: string; era: number }>;
  renderIntroCombined(index: number): Promise<{
    name: string;
    fileStem: string;
    description: string;
    seconds: number;
    analysis: Record<string, number>;
    healthPass: boolean;
    wavBytes: number;
  }>;
  renderEarlyBeat(index: number): Promise<{
    name: string;
    fileStem: string;
    description: string;
    seconds: number;
    analysis: Record<string, number>;
    healthPass: boolean;
    wavBytes: number;
  }>;
  renderExcerpt(name: ExcerptName): Promise<{
    name: string;
    fileStem: string;
    description: string;
    seconds: number;
    analysis: Record<string, number>;
    continuousControlAnalysis?: Record<string, number>;
    healthPass: boolean;
    report: unknown;
    wavBytes: number;
  }>;
  renderEvidence(pair: EvidencePairName, variant: EvidenceVariant): Promise<{
    name: string;
    fileStem: string;
    description: string;
    seconds: number;
    analysis: Record<string, number>;
    continuousControlAnalysis?: Record<string, number>;
    healthPass: boolean;
    report: unknown;
    mappingValues: Record<string, number | string>;
    wavBytes: number;
  }>;
  wavChunk(offset: number): string | null;
  runAudioSoak(minutes: number, seed?: number, archetype?: string): Promise<unknown>;
  runSmoothnessSweep(): Promise<unknown>;
  runEraBuildSmoothnessSweep(): Promise<unknown>;
  runStoryHandoffSmoothnessSweep(
    auditStem?: 'combined' | 'bed' | 'story' | 'legacy'
  ): Promise<unknown>;
}

function buildApi(): SoakPageApi {
  return {
    excerptNames: EXCERPT_NAMES,
    evidencePairNames: EVIDENCE_PAIR_NAMES,
    earlyBeatAuditions: EARLY_BEAT_AUDITIONS.map(({ beat, era }) => ({ beat, era })),
    introCombinedAuditions: INTRO_COMBINED_AUDITIONS.map(({ beat, era }) => ({ beat, era })),
    async renderIntroCombined(index: number) {
      const spec = INTRO_COMBINED_AUDITIONS[index];
      console.log(`[soak-page] rendering combined intro ${spec.beat} @ era ${spec.era}…`);
      const started = performance.now();
      const result = await renderIntroCombinedAudition(spec);
      lastWav = new Uint8Array(result.wav);
      console.log(
        `[soak-page] ${result.name} rendered in ${((performance.now() - started) / 1000).toFixed(1)}s ` +
          `(peak ${result.analysis.peak.toFixed(3)}, rms ${result.analysis.rms.toFixed(4)})`
      );
      return {
        name: result.name,
        fileStem: result.fileStem,
        description: result.description,
        seconds: result.seconds,
        analysis: { ...result.analysis },
        healthPass: result.healthPass,
        wavBytes: lastWav.length
      };
    },
    async renderEarlyBeat(index: number) {
      const spec = EARLY_BEAT_AUDITIONS[index];
      console.log(`[soak-page] rendering early beat ${spec.beat} @ era ${spec.era}…`);
      const started = performance.now();
      const result = await renderEarlyBeatAudition(spec);
      lastWav = new Uint8Array(result.wav);
      console.log(
        `[soak-page] ${result.name} rendered in ${((performance.now() - started) / 1000).toFixed(1)}s ` +
          `(peak ${result.analysis.peak.toFixed(3)}, rms ${result.analysis.rms.toFixed(4)})`
      );
      return {
        name: result.name,
        fileStem: result.fileStem,
        description: result.description,
        seconds: result.seconds,
        analysis: { ...result.analysis },
        healthPass: result.healthPass,
        wavBytes: lastWav.length
      };
    },
    async renderExcerpt(name: ExcerptName) {
      console.log(`[soak-page] rendering excerpt ${name}…`);
      const started = performance.now();
      const result = await renderExcerpt(name);
      lastWav = new Uint8Array(result.wav);
      console.log(
        `[soak-page] ${name} rendered in ${((performance.now() - started) / 1000).toFixed(1)}s ` +
          `(peak ${result.analysis.peak.toFixed(3)}, rms ${result.analysis.rms.toFixed(4)})`
      );
      return {
        name: result.name,
        fileStem: result.fileStem,
        description: result.description,
        seconds: result.seconds,
        analysis: { ...result.analysis },
        continuousControlAnalysis: result.continuousControlAnalysis
          ? { ...result.continuousControlAnalysis }
          : undefined,
        healthPass: result.healthPass,
        report: result.report,
        wavBytes: lastWav.length
      };
    },
    async renderEvidence(pair: EvidencePairName, variant: EvidenceVariant) {
      console.log(`[soak-page] rendering evidence ${pair} ${variant}…`);
      const started = performance.now();
      const result = await renderEvidence(pair, variant);
      lastWav = new Uint8Array(result.wav);
      console.log(
        `[soak-page] ${pair} ${variant} rendered in ${((performance.now() - started) / 1000).toFixed(1)}s ` +
          `(peak ${result.analysis.peak.toFixed(3)}, rms ${result.analysis.rms.toFixed(4)}, ` +
          `smooth ${result.analysis.maxSmoothnessDeltaDb.toFixed(2)} dB)`
      );
      return {
        name: result.name,
        fileStem: result.fileStem,
        description: result.description,
        seconds: result.seconds,
        analysis: { ...result.analysis },
        continuousControlAnalysis: result.continuousControlAnalysis
          ? { ...result.continuousControlAnalysis }
          : undefined,
        healthPass: result.healthPass,
        report: result.report,
        mappingValues: result.mappingValues ?? {},
        wavBytes: lastWav.length
      };
    },
    wavChunk(offset: number): string | null {
      if (!lastWav || offset >= lastWav.length) return null;
      return toBase64(lastWav.subarray(offset, Math.min(offset + WAV_CHUNK_BYTES, lastWav.length)));
    },
    async runAudioSoak(minutes: number, seed?: number, archetype?: string) {
      console.log(`[soak-page] audio soak: ${minutes} min offline render…`);
      const started = performance.now();
      const result = await runAudioSoak(minutes, seed, archetype as ArchetypeId | undefined);
      console.log(
        `[soak-page] soak rendered in ${((performance.now() - started) / 1000).toFixed(1)}s`
      );
      return result;
    },
    async runSmoothnessSweep() {
      console.log('[soak-page] continuous day→night→day smoothness render…');
      const started = performance.now();
      const result = await runSmoothnessSweep();
      console.log(
        `[soak-page] smoothness sweep rendered in ${((performance.now() - started) / 1000).toFixed(1)}s`
      );
      return result;
    },
    async runEraBuildSmoothnessSweep() {
      console.log('[soak-page] era-changing BUILD→BLOOM root-cause render…');
      const started = performance.now();
      const result = await runEraBuildSmoothnessSweep();
      console.log(
        `[soak-page] root-cause sweep rendered in ${((performance.now() - started) / 1000).toFixed(1)}s`
      );
      return result;
    },
    async runStoryHandoffSmoothnessSweep(auditStem = 'combined') {
      console.log('[soak-page] story authority yield→scene-change→resume render…');
      const started = performance.now();
      const result = await runStoryHandoffSmoothnessSweep(auditStem);
      console.log(
        `[soak-page] story handoff sweep rendered in ${((performance.now() - started) / 1000).toFixed(1)}s`
      );
      return result;
    }
  };
}

declare global {
  interface Window {
    __scoreSoak?: SoakPageApi;
  }
}

if (typeof window !== 'undefined') {
  window.__scoreSoak = buildApi();
  const el = document.getElementById('status');
  if (el) el.textContent = 'score-soak harness ready (driven by score-soak-probe.mjs)';
}
