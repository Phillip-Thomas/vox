import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import {
  EXCERPT_NAMES,
  renderExcerpt,
  runAudioSoak,
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
  renderExcerpt(name: ExcerptName): Promise<{
    name: string;
    fileStem: string;
    description: string;
    seconds: number;
    analysis: Record<string, number>;
    healthPass: boolean;
    report: unknown;
    wavBytes: number;
  }>;
  wavChunk(offset: number): string | null;
  runAudioSoak(minutes: number, seed?: number, archetype?: string): Promise<unknown>;
}

function buildApi(): SoakPageApi {
  return {
    excerptNames: EXCERPT_NAMES,
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
        healthPass: result.healthPass,
        report: result.report,
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
