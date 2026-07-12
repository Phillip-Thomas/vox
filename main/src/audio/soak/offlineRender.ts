import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import type { StoryBeat } from '../../story/storyState.ts';
import { setScoreBeat } from '../../story/storyScore.ts';
import { createOfflineMusicChain } from '../audioCore.ts';
import {
  beginOfflineBedRender,
  endOfflineBedRender,
  stepOfflineBedRender
} from '../bedEngine.ts';
import {
  beginOfflineScoreRender,
  endOfflineScoreRender,
  HIT_BUS_GAIN,
  renderHitInto,
  renderHitOfflineAt,
  setScoreIntensity,
  setScorePlanetGenome,
  stepOfflineScoreRender
} from '../scoreEngine.ts';
import { deriveMotifGenome } from '../generative/motif.ts';
import { tickMusicPrimitives } from '../musicPrimitives.ts';
import {
  auditSoakLog,
  createSoakCollector,
  makeSoakScript,
  type SoakReport,
  type SoakScenarioName,
  type SoakScript
} from '../generative/soak.ts';
import { analyzeChannels, type AudioAnalysis } from './audioAnalysis.ts';

// --- Offline renders of the REAL engines (P4 harness, browser-only) --------------------------------
//
// These drivers run the shipped bedEngine/scoreEngine rims against an
// OfflineAudioContext, stepping the same lookahead cores through
// suspend/resume checkpoints at the live scheduler cadence. The result is a
// faithful render of what the live game schedules — same graph, same code —
// plus the pure soak audit trail collected bar by bar.

/** Offline checkpoint cadence — matches the live 60 ms scheduler interval. */
export const OFFLINE_DRIVE_STEP_S = 0.06;
/** Render sample rate for soaks and audition WAVs. */
export const RENDER_SAMPLE_RATE = 44100;

export type HitKind = 'braam' | 'bloom' | 'boom';

export interface HitCue {
  atSec: number;
  kind: HitKind;
}

/**
 * Drive an OfflineAudioContext through suspend/resume checkpoints, calling
 * `onStep(now)` at each one (the offline stand-in for the 60 ms interval).
 */
async function driveOffline(
  ctx: OfflineAudioContext,
  durationSec: number,
  onStep: (now: number) => void
): Promise<AudioBuffer> {
  onStep(0);
  const chain = (t: number): void => {
    if (t >= durationSec - OFFLINE_DRIVE_STEP_S / 2) return;
    ctx
      .suspend(t)
      .then(() => {
        onStep(ctx.currentTime);
        chain(t + OFFLINE_DRIVE_STEP_S);
        void ctx.resume();
      })
      .catch(() => {
        // A rejected suspend (duration edge) just ends the drive.
      });
  };
  chain(OFFLINE_DRIVE_STEP_S);
  return await ctx.startRendering();
}

export interface BedRenderOptions {
  planetSeed: number;
  archetype?: ArchetypeId;
  paletteBrightness?: number;
  seconds: number;
  scenario: SoakScenarioName;
  /** Override the scenario script (era-transition excerpt shapes its own). */
  script?: SoakScript;
  /** Extra punctuation, quantized to the next planned bar line. */
  hitCues?: readonly HitCue[];
}

export interface BedRenderResult {
  buffer: AudioBuffer;
  analysis: AudioAnalysis;
  report: SoakReport;
  bars: number;
}

/** Render the generative bed offline: real rim, real scheduler core, audited. */
export async function renderBedOffline(opts: BedRenderOptions): Promise<BedRenderResult> {
  const ctx = new OfflineAudioContext(
    2,
    Math.round(opts.seconds * RENDER_SAMPLE_RATE),
    RENDER_SAMPLE_RATE
  );
  const out = createOfflineMusicChain(ctx);
  const hitChain = ctx.createGain();
  hitChain.gain.value = HIT_BUS_GAIN;
  hitChain.connect(out);

  const script = opts.script ?? makeSoakScript(opts.scenario, opts.planetSeed, opts.seconds);
  const pendingCues = [...(opts.hitCues ?? [])].sort((a, b) => a.atSec - b.atSec);
  let bars = 0;
  let signalsNow = script(0);

  const conductor = beginOfflineBedRender(ctx, out, opts.planetSeed, {
    archetype: opts.archetype,
    paletteBrightness: opts.paletteBrightness,
    onBar: (plan, barTime) => {
      bars++;
      collector.onBar(plan, signalsNow);
      // Grid-quantized cues: each fires on the FIRST planned bar line at or
      // after its cue time (the §8.1 law — a drop off-grid is a defect).
      while (pendingCues.length > 0 && pendingCues[0].atSec <= barTime) {
        renderHitInto(ctx, hitChain, pendingCues[0].kind, barTime);
        pendingCues.shift();
      }
    },
    onHit: (kind, atTime) => renderHitInto(ctx, hitChain, kind, atTime)
  });
  const collector = createSoakCollector(conductor, opts.scenario);

  try {
    const buffer = await driveOffline(ctx, opts.seconds, (now) => {
      signalsNow = script(now);
      stepOfflineBedRender(ctx, now, signalsNow);
    });
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
      buffer.getChannelData(c)
    );
    return {
      buffer,
      analysis: analyzeChannels(channels, buffer.sampleRate),
      report: auditSoakLog(collector.finish()),
      bars
    };
  } finally {
    endOfflineBedRender();
  }
}

export interface StoryBeatRenderOptions {
  beat: StoryBeat;
  seconds: number;
  /** Intensity rail script (the director's own timeline stand-in). */
  intensityAt?: (tSec: number) => number;
  /** Reflex punctuation at absolute times (legacy scoreHit semantics). */
  hits?: readonly HitCue[];
  /**
   * P5 (§10.5): render with this planet's motif genome set — the mood's
   * `melody.scale` filters the planet's tune. Omitted = the legacy walk.
   */
  planetSeed?: number;
  archetype?: ArchetypeId;
}

export interface StoryBeatRenderResult {
  buffer: AudioBuffer;
  analysis: AudioAnalysis;
}

/** Render a story MOODS beat offline through the shipped score instrument. */
export async function renderStoryBeatOffline(
  opts: StoryBeatRenderOptions
): Promise<StoryBeatRenderResult> {
  const ctx = new OfflineAudioContext(
    2,
    Math.round(opts.seconds * RENDER_SAMPLE_RATE),
    RENDER_SAMPLE_RATE
  );
  const out = createOfflineMusicChain(ctx);
  // The real story path: the beat's MOODS entry takes the instrument. With a
  // planet given, the planet's tune haunts the beat (§10.5).
  if (opts.planetSeed != null) {
    setScorePlanetGenome(deriveMotifGenome(opts.planetSeed, opts.archetype), opts.planetSeed);
  }
  setScoreBeat(opts.beat);
  beginOfflineScoreRender(ctx, out);
  for (const hit of opts.hits ?? []) {
    renderHitOfflineAt(ctx, hit.kind, hit.atSec);
  }
  try {
    const buffer = await driveOffline(ctx, opts.seconds, (now) => {
      if (opts.intensityAt) setScoreIntensity(opts.intensityAt(now));
      tickMusicPrimitives(OFFLINE_DRIVE_STEP_S);
      stepOfflineScoreRender(ctx, now);
    });
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
      buffer.getChannelData(c)
    );
    return { buffer, analysis: analyzeChannels(channels, buffer.sampleRate) };
  } finally {
    endOfflineScoreRender();
    setScoreBeat(null);
    if (opts.planetSeed != null) setScorePlanetGenome(null);
  }
}
