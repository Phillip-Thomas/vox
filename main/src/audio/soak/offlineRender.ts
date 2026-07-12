import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { buildPlanetProfile } from '../../game/PlanetProfile.ts';
import type { StoryBeat } from '../../story/storyState.ts';
import { getStoryScoreMood, setScoreBeat } from '../../story/storyScore.ts';
import {
  createOfflineMusicChain,
  createOfflineMusicRuntimeChain,
  rampParamAt
} from '../audioCore.ts';
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
  resolveScoreHitRenderPlan,
  resolveTimedScoreHitRenderPlan,
  setGenerativeBedLead,
  STORY_AUTHORITY_CROSSFADE_S,
  setScoreIntensity,
  setScorePlanetGenome,
  stepOfflineScoreRender
} from '../scoreEngine.ts';
import { deriveMotifGenome } from '../generative/motif.ts';
import {
  getMusicChord,
  setMusicPrimitiveTargets,
  tickMusicPrimitives
} from '../musicPrimitives.ts';
import { createOfflineMusicEngineRuntime } from '../musicEngine.ts';
import { resolveMusicMix, resolvePlanetMusicMood } from '../musicDirector.ts';
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
const OFFLINE_WARP_INTENSITY_MAX = 1;
const OFFLINE_STORY_PROXY_LEVEL = 0.07;
const OFFLINE_STORY_PROXY_ROOT_HZ = 110;
const OFFLINE_STORY_PROXY_RETUNE_S = 1.2;
const OFFLINE_SEMITONES_PER_OCTAVE = 12;
/** Queue story cues inside the scheduler's 180 ms horizon, never at render setup. */
const OFFLINE_HIT_LOOKAHEAD_S = 0.12;
const OFFLINE_STORY_DEFAULT_ERA = 1;

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
  /** Dedicated audits only: non-pitched carriers through exact streamed-stem slews. */
  includeStemAuditCarriers?: boolean;
  /** Dedicated authority audit: toggle this real story mood from script.storyLeads. */
  storyHandoffBeat?: StoryBeat;
  /** Dedicated derivative audit: retain persistent graphs, omit musical transients. */
  continuousControlAudit?: boolean;
  /** Root-cause isolation may mute legacy rims while retaining their graph. */
  driveLegacyMusic?: boolean;
  /** Diagnostic-only stem isolation; the default renders the shipped combined mix. */
  auditStem?: 'combined' | 'bed' | 'story' | 'legacy';
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
  const runtimeChain = createOfflineMusicRuntimeChain(ctx);
  const out = runtimeChain.bus;
  const auditStem = opts.auditStem ?? 'combined';
  const bedOut = ctx.createGain();
  const storyOut = ctx.createGain();
  const legacyOut = ctx.createGain();
  bedOut.gain.value = auditStem === 'combined' || auditStem === 'bed' ? 1 : 0;
  storyOut.gain.value = auditStem === 'combined' || auditStem === 'story' ? 1 : 0;
  legacyOut.gain.value = auditStem === 'combined' || auditStem === 'legacy' ? 1 : 0;
  bedOut.connect(out);
  storyOut.connect(out);
  legacyOut.connect(out);
  // Full score-side parity for diagnosis: the shipped procedural graph plus
  // deterministic proxy carriers through the exact streamed-stem gain slews.
  const legacyMusic = createOfflineMusicEngineRuntime(ctx, legacyOut, {
    includeStemAuditCarriers: opts.includeStemAuditCarriers
  });
  const planetMood = resolvePlanetMusicMood(buildPlanetProfile(opts.planetSeed));
  // Audit carrier for the complementary story/bed authority crossfade. The
  // score's actual timbre is covered by renderStoryBeatOffline; this persistent
  // legal-root sine makes handoff gain derivatives measurable in bed sweeps.
  const storyProxyOsc = ctx.createOscillator();
  const storyProxyGain = ctx.createGain();
  storyProxyOsc.type = 'sine';
  storyProxyOsc.frequency.value = OFFLINE_STORY_PROXY_ROOT_HZ;
  storyProxyGain.gain.value = 0;
  storyProxyOsc.connect(storyProxyGain);
  storyProxyGain.connect(storyOut);
  storyProxyOsc.start();
  const hitChain = ctx.createGain();
  hitChain.gain.value = HIT_BUS_GAIN;
  hitChain.connect(bedOut);

  const script = opts.script ?? makeSoakScript(opts.scenario, opts.planetSeed, opts.seconds);
  const pendingCues = [...(opts.hitCues ?? [])].sort((a, b) => a.atSec - b.atSec);
  let bars = 0;
  let signalsNow = script(0);
  let legacyChordRoot: number | null = null;
  let storyProxyLeading = false;
  let storyScoreLeading = false;

  const conductor = beginOfflineBedRender(ctx, bedOut, opts.planetSeed, {
    archetype: opts.archetype,
    paletteBrightness: opts.paletteBrightness,
    suppressTransientVoices: opts.continuousControlAudit,
    onBar: (plan, barTime) => {
      bars++;
      collector.onBar(plan, signalsNow);
      // Grid-quantized cues: each fires on the FIRST planned bar line at or
      // after its cue time (the §8.1 law — a drop off-grid is a defect).
      while (pendingCues.length > 0 && pendingCues[0].atSec <= barTime) {
        renderHitInto(
          ctx,
          hitChain,
          pendingCues[0].kind,
          barTime,
          resolveScoreHitRenderPlan(
            { root: plan.publish.root, chord: plan.publish.tones },
            signalsNow.era,
            signalsNow.stage
          )
        );
        pendingCues.shift();
      }
    },
    onHit: (kind, atTime) =>
      renderHitInto(
        ctx,
        hitChain,
        kind,
        atTime,
        resolveScoreHitRenderPlan(getMusicChord(), signalsNow.era, signalsNow.stage)
      )
  });
  const collector = createSoakCollector(conductor, opts.scenario);
  const renderRealStoryHandoff = opts.storyHandoffBeat != null;
  if (renderRealStoryHandoff) {
    setScorePlanetGenome(deriveMotifGenome(opts.planetSeed, opts.archetype), opts.planetSeed);
    setGenerativeBedLead(true);
    setScoreBeat(null);
    beginOfflineScoreRender(ctx, storyOut, {
      suppressTransientVoices: opts.continuousControlAudit
    });
  }

  try {
    const buffer = await driveOffline(ctx, opts.seconds, (now) => {
      signalsNow = script(now);
      if (renderRealStoryHandoff && signalsNow.storyLeads !== storyScoreLeading) {
        storyScoreLeading = signalsNow.storyLeads;
        setScoreBeat(storyScoreLeading ? opts.storyHandoffBeat! : null);
      }
      // Full live-chain parity: the same continuous submergence signal drives
      // the bus lowpass while the bed responds musically (sub takes the motif).
      runtimeChain.setSubmergence(signalsNow.submergence, now);
      stepOfflineBedRender(ctx, now, signalsNow);
      if (renderRealStoryHandoff) {
        setMusicPrimitiveTargets({
          era: signalsNow.era,
          warmth: signalsNow.warmth,
          wonder: signalsNow.wonder
        });
        tickMusicPrimitives(OFFLINE_DRIVE_STEP_S);
        stepOfflineScoreRender(ctx, now);
      }
      if (opts.driveLegacyMusic !== false) {
        const warpIntensity = signalsNow.warpActive
          ? Math.sin(Math.min(OFFLINE_WARP_INTENSITY_MAX, signalsNow.warpProgress) * Math.PI)
          : 0;
        const mix = resolveMusicMix(
          signalsNow.scene,
          warpIntensity,
          planetMood,
          signalsNow.daylight,
          signalsNow
        );
        legacyMusic.setLayerTargets(mix.layers, mix.fadeSeconds);
        legacyMusic.setProceduralTargets(mix.procedural, mix.fadeSeconds);
      }
      const chordRoot = getMusicChord().root;
      if (chordRoot !== legacyChordRoot) {
        legacyChordRoot = chordRoot;
        legacyMusic.retuneDronesToChordRoot(chordRoot);
        storyProxyOsc.frequency.setTargetAtTime(
          OFFLINE_STORY_PROXY_ROOT_HZ * Math.pow(2, chordRoot / OFFLINE_SEMITONES_PER_OCTAVE),
          now,
          OFFLINE_STORY_PROXY_RETUNE_S
        );
      }
      if (!renderRealStoryHandoff && signalsNow.storyLeads !== storyProxyLeading) {
        storyProxyLeading = signalsNow.storyLeads;
        rampParamAt(
          storyProxyGain.gain,
          storyProxyLeading ? OFFLINE_STORY_PROXY_LEVEL : 0,
          now,
          STORY_AUTHORITY_CROSSFADE_S
        );
      }
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
    if (renderRealStoryHandoff) {
      endOfflineScoreRender();
      setScoreBeat(null);
      setScorePlanetGenome(null);
      setGenerativeBedLead(false);
    }
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
  /** Era captured for onset-authentic hit palettes (a3-dawn defaults alive). */
  era?: number;
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
  const scoreMood = getStoryScoreMood(opts.beat);
  if (!scoreMood) throw new Error(`No score mood for story beat '${opts.beat}'`);
  const pendingHits = [...(opts.hits ?? [])]
    .sort((a, b) => a.atSec - b.atSec)
    .map((hit) => ({
      ...hit,
      onsetPlan: resolveTimedScoreHitRenderPlan(
        scoreMood,
        0,
        hit.atSec,
        opts.era ?? OFFLINE_STORY_DEFAULT_ERA,
        'alive'
      )
    }));
  try {
    const buffer = await driveOffline(ctx, opts.seconds, (now) => {
      if (opts.intensityAt) setScoreIntensity(opts.intensityAt(now));
      tickMusicPrimitives(OFFLINE_DRIVE_STEP_S);
      stepOfflineScoreRender(ctx, now);
      // The score scheduler has now published the chord that owns this onset.
      // Instantiate only inside that same lookahead window, so a 54 s bloom
      // cannot be baked against the setup-time tonic.
      while (pendingHits.length > 0 && pendingHits[0].atSec <= now + OFFLINE_HIT_LOOKAHEAD_S) {
        const hit = pendingHits.shift()!;
        renderHitOfflineAt(ctx, hit.kind, hit.atSec, hit.onsetPlan);
      }
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
