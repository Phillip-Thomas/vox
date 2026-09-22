import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { buildPlanetProfile } from '../../game/PlanetProfile.ts';
import type { StoryBeat } from '../../story/storyState.ts';
import {
  clearStoryScoreMoodOverride,
  getStoryScoreMood,
  setScoreBeat,
  setStoryScoreMoodOverride
} from '../../story/storyScore.ts';
import type { ScoreMood } from '../scoreEngine.ts';
import {
  createOfflineMusicChain,
  createOfflineMusicRuntimeChain,
  rampParamAt,
  type OfflineMusicTailMode
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
  isScoreMoodLeading,
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
  getMusicPrimitives,
  resetMusicPrimitives,
  setMusicPrimitiveTargets,
  tickMusicPrimitives
} from '../musicPrimitives.ts';
import { createOfflineMusicEngineRuntime } from '../musicEngine.ts';
import type { BedQualityTier } from '../generative/timbre.ts';
import {
  NEUTRAL_PLANET_MOOD,
  resolveMusicMix,
  resolvePlanetMusicMood,
  type MusicScene
} from '../musicDirector.ts';
import {
  auditSoakLog,
  createSoakCollector,
  makeSoakScript,
  type SoakReport,
  type SoakScenarioName,
  type SoakScript
} from '../generative/soak.ts';
import {
  beginSfxOffline,
  type OfflineSfxRim,
  type SfxEvent
} from '../sfxEngine.ts';
import type { OxygenAudioPlan } from '../oxygenAudio.ts';
import { renderVoiceInto, type OfflineVoiceOptions, type VoiceChain } from '../voice/voiceBus.ts';
import { resolveMixSnapshot } from '../mix/mixSnapshot.ts';
import {
  analyzeChannels,
  analyzeLoudness,
  type AudioAnalysis,
  type LoudnessAnalysis
} from './audioAnalysis.ts';

import type { BedSignals } from '../generative/worldSignals.ts';

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
/** One oversized tick snaps the slewed primitives to their targets before t=0. */
const OFFLINE_PRIMITIVES_SNAP_S = 10;
/** Scripted SFX cues are instantiated inside the same scheduler horizon. */
const OFFLINE_SFX_LOOKAHEAD_S = 0.12;
/** Default seed for the offline SFX rim's noise. */
export const DEFAULT_SFX_RENDER_SEED = 0x5f3a91;

/** Non-`SfxEvent` cues the rim also renders: the body clock and the loops. */
export type SfxControlEvent = 'oxygenPulse' | 'jetpack' | 'shipThrust' | 'submerge';

export interface SfxCueParams {
  /** oxygenPulse: the Chapter 6 body-clock plan fields. */
  pulseGain?: number;
  criticalBreathGain?: number;
  criticalBreathDurationSeconds?: number;
  /** jetpack: loop on/off and drive. */
  active?: boolean;
  intensity?: number;
  /** shipThrust level, or submerge amount, 0..1. */
  level?: number;
  amount?: number;
}

/** One scripted diegetic cue: what fires, when, at what strength. */
export interface SfxScriptCue {
  t: number;
  event: SfxEvent | SfxControlEvent;
  params?: SfxCueParams;
  position?: AudioPosition;
  listener?: SfxListener;
  room?: RoomPresetId;
  quality?: 'full' | 'lean';
  variation?: boolean;
}

export interface VoiceScriptCue extends Omit<OfflineVoiceOptions, 'startTime' | 'chord'> {
  t: number;
  chord?: OfflineVoiceOptions['chord'];
}

const SFX_CONTROL_EVENTS: ReadonlySet<string> = new Set<SfxControlEvent>([
  'oxygenPulse',
  'jetpack',
  'shipThrust',
  'submerge'
]);

function fireSfxCue(rim: OfflineSfxRim, cue: SfxScriptCue): void {
  const params = cue.params ?? {};
  if (cue.room) rim.buses.setRoom?.(cue.room, cue.quality ?? 'full', cue.t);
  switch (cue.event) {
    case 'oxygenPulse': {
      const plan: OxygenAudioPlan = {
        active: true,
        oxygen: 0,
        urgency: 1,
        pulseIntervalSeconds: 1,
        pulseGain: params.pulseGain ?? 0,
        criticalBreathGain: params.criticalBreathGain ?? 0,
        criticalBreathDurationSeconds: params.criticalBreathDurationSeconds ?? 0
      };
      rim.playOxygenPulse(plan, cue.t);
      return;
    }
    case 'jetpack':
      rim.setJetpackActive(params.active ?? false, params.intensity ?? 1, cue.t);
      return;
    case 'shipThrust':
      rim.setShipThrust(params.level ?? 0, cue.t);
      return;
    case 'submerge':
      rim.setSubmerged(params.amount ?? 0, cue.t);
      return;
    default:
      rim.play(cue.event, cue.t, { position: cue.position, listener: cue.listener, variation: cue.variation });
  }
}

/** Reject a script that names an event no rim path can render. */
export function validateSfxScript(script: readonly SfxScriptCue[]): void {
  for (const cue of script) {
    if (!Number.isFinite(cue.t) || cue.t < 0) {
      throw new Error(`SFX cue '${cue.event}' has a non-finite time`);
    }
    if (SFX_CONTROL_EVENTS.has(cue.event)) continue;
    if (!cue.event) throw new Error('SFX cue is missing an event');
  }
}

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
  /** Diagnostic harness only; records dispatch and driving rails without altering scheduling. */
  captureStressDiagnostics?: boolean;
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
  /**
   * Stage 0 combined render: scripted diegetic cues rendered by the offline
   * SFX rim, joined at the post-compressor master exactly as the live SFX
   * sub-master joins it.
   */
  sfxScript?: readonly SfxScriptCue[];
  voiceScript?: readonly VoiceScriptCue[];
  /** Seed for the offline rim's noise; the same seed replays bit-identically. */
  sfxSeed?: number;
  /**
   * SFX-only baseline: hold the music bus at silence while the rim renders.
   * The music graph is still built and driven, so the render's timing and the
   * compressor's state match the combined pass.
   */
  musicSilent?: boolean;
  /**
   * Return the module-global music rails to their cold-start values before
   * building the graph. A harness page runs many renders; without this, render
   * N inherits render N-1's rails and no replay hash is stable.
   */
  resetGlobalsBeforeRender?: boolean;
  /**
   * Stage 1 music-bus glue (glue compressor + soft clip before the safety
   * compressor). Default true = the shipped chain. `false` renders the chain
   * without the glue stage — the bare-era regression compares that render
   * against the pre-Stage-1 instrument, which had no glue at all.
   */
  musicBusGlue?: boolean;
  /** Stage 1 bed quality tier for the render (default 'full'). */
  bedQuality?: BedQualityTier;
  /** Mastering-tail selection (Stage 2 evidence; default 'shipped'). */
  tail?: OfflineMusicTailMode;
  /**
   * Stage 2 duck traces: `false` mutes the SFX sub-master while every scripted
   * cue still fires and ducks, so the music's duck envelope can be measured
   * against an un-ducked render of the same script-free bed.
   */
  sfxAudible?: boolean;
}

export interface BedRenderResult {
  buffer: AudioBuffer;
  analysis: AudioAnalysis;
  report: SoakReport;
  bars: number;
  /** Scripted SFX cues the rim fired (0 unless `sfxScript` was given). */
  sfxCuesFired: number;
  diagnosticTrace?: {
    cues: import('./stemDiagnostics.ts').OfflineCueTrace[];
    signals: { atS: number; signals: BedSignals }[];
  };
}

export interface CombinedRenderResult extends BedRenderResult {
  loudness: LoudnessAnalysis;
}

/** Render the generative bed offline: real rim, real scheduler core, audited. */
export async function renderBedOffline(opts: BedRenderOptions): Promise<BedRenderResult> {
  if (opts.resetGlobalsBeforeRender) resetMusicPrimitives();
  const ctx = new OfflineAudioContext(
    2,
    Math.round(opts.seconds * RENDER_SAMPLE_RATE),
    RENDER_SAMPLE_RATE
  );
  const runtimeChain = createOfflineMusicRuntimeChain(ctx, {
    glue: opts.musicBusGlue ?? true,
    tail: opts.tail ?? 'shipped'
  });
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

  if (opts.musicSilent) out.gain.value = 0;
  const sfxScript = [...(opts.sfxScript ?? [])].sort((a, b) => a.t - b.t);
  validateSfxScript(sfxScript);
  const sfxRim =
    sfxScript.length > 0
      ? beginSfxOffline(ctx, runtimeChain.sfx, opts.sfxSeed ?? DEFAULT_SFX_RENDER_SEED, {
          storyLead: () => signalsNow.storyLeads
        })
      : null;
  // Duck traces: the cues still fire (and duck the music) but are inaudible.
  if (opts.sfxAudible === false) runtimeChain.sfx.setOutput(0, 0);
  const pendingSfx = [...sfxScript];
  const pendingVoice = [...(opts.voiceScript ?? [])].sort((a, b) => a.t - b.t);
  const voiceSlots: ({ rung: OfflineVoiceOptions['rung']; chain: VoiceChain } | undefined)[] = [];
  let sfxCuesFired = 0;
  const diagnosticTrace: BedRenderResult['diagnosticTrace'] = opts.captureStressDiagnostics
    ? { cues: [], signals: [] } : undefined;

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
    quality: opts.bedQuality,
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
      diagnosticTrace?.signals.push({ atS: now, signals: { ...signalsNow } });
      runtimeChain.applySnapshot(resolveMixSnapshot({ phase: 'playing', storyLead: signalsNow.storyLeads, submergence: signalsNow.submergence,
        era: signalsNow.era, stage: signalsNow.stage, station: false, quality: opts.bedQuality ?? 'full' }), now);
      while (pendingVoice.length > 0 && pendingVoice[0].t <= now + OFFLINE_SFX_LOOKAHEAD_S) {
        const cue = pendingVoice.shift()!;
        const slot = opts.bedQuality === 'lean' ? 0 : Math.max(0, Math.min(1, cue.slot ?? 0));
        let current = voiceSlots[slot];
        if (current && current.rung !== cue.rung) { current.chain.disconnect(); current = undefined; }
        const voice = renderVoiceInto(ctx, runtimeChain.sfx.input('voice'), { ...cue, startTime: cue.t, chord: cue.chord ?? getMusicChord(), runSeed: cue.runSeed ?? opts.planetSeed }, current?.chain);
        voiceSlots[slot] = { rung: cue.rung, chain: voice.chain };
        runtimeChain.sfx.duck('voice', { storyLead: signalsNow.storyLeads }, cue.t);
      }
      // Diegetic cues instantiate inside the same 120 ms horizon the score's
      // own hits use, so a cue can never be baked against a stale graph.
      while (sfxRim && pendingSfx.length > 0 && pendingSfx[0].t <= now + OFFLINE_SFX_LOOKAHEAD_S) {
        const cue = pendingSfx.shift()!;
        fireSfxCue(sfxRim, cue);
        diagnosticTrace?.cues.push({ cue, dispatchedAtS: now });
        sfxCuesFired++;
      }
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
          signalsNow,
          signalsNow.storyLeads
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
      bars,
      sfxCuesFired,
      ...(diagnosticTrace ? { diagnosticTrace } : {})
    };
  } finally {
    for (const slot of voiceSlots) slot?.chain.disconnect();
    if (renderRealStoryHandoff) {
      endOfflineScoreRender();
      setScoreBeat(null);
      setScorePlanetGenome(null);
      setGenerativeBedLead(false);
    }
    endOfflineBedRender();
  }
}

export interface CombinedRenderOptions extends BedRenderOptions {
  sfxScript: readonly SfxScriptCue[];
}

/**
 * The Stage 0 combined render: the shipped music chain PLUS a scripted SFX cue
 * list joined post-compressor, i.e. the mix the player's output route actually
 * carries. Everything the bed driver already does — soak audit, story handoff,
 * legacy rim — is unchanged; the SFX rim rides alongside it.
 */
export async function renderCombinedOffline(
  opts: CombinedRenderOptions
): Promise<CombinedRenderResult> {
  const result = await renderBedOffline(opts);
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    ...result,
    loudness: analyzeLoudness(channels, result.buffer.sampleRate)
  };
}

export interface StoryBeatRenderOptions {
  beat: StoryBeat;
  seconds: number;
  /** Actual OfflineAudioContext rate, for per-rate latency/onset proof. */
  sampleRate?: number;
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
  /**
   * Reality-era rail for the WHOLE render (hit palettes AND the live
   * chip↔rich instrumentation crossfade). Omitted = the primitives' default
   * (alive, era 1) — pass a low value to audition what the player actually
   * hears in the early chapters.
   */
  era?: number;
  /**
   * Drive the LEGACY procedural music engine (musicEngine rim) alongside the
   * score at this scene's resolved mix — the combined music-bus picture the
   * player actually hears (e.g. the storyTerminal transit drone under the
   * prologue score). Omitted = score instrument only.
   */
  legacyScene?: MusicScene;
  /** Stage 1 glue stage on the offline music chain (default true = shipped chain). */
  musicBusGlue?: boolean;
  /** Mastering-tail selection (Stage 2 evidence; default 'shipped'). */
  tail?: OfflineMusicTailMode;
  /**
   * Render this exact mood under `beat` instead of the beat's MOODS entry — the
   * path the ch10 variant moods (refused, seam-ebb, …) take live through
   * setStoryScoreMoodOverride. Cleared when the render ends.
   */
  moodOverride?: ScoreMood;
  /**
   * Stage 3 harness hook: called at every offline drive checkpoint with the
   * context and its current time, AFTER the score scheduler stepped — the
   * place a probe arms `scheduleHitOffline` against the live offline grid.
   */
  onDriveStep?: (ctx: OfflineAudioContext, now: number) => void;
}

export interface StoryBeatRenderResult {
  buffer: AudioBuffer;
  analysis: AudioAnalysis;
}

/** Render a story MOODS beat offline through the shipped score instrument. */
export async function renderStoryBeatOffline(
  opts: StoryBeatRenderOptions
): Promise<StoryBeatRenderResult> {
  const sampleRate = opts.sampleRate ?? RENDER_SAMPLE_RATE;
  const ctx = new OfflineAudioContext(
    2,
    Math.round(opts.seconds * sampleRate),
    sampleRate
  );
  const out = createOfflineMusicChain(ctx, {
    glue: opts.musicBusGlue ?? true,
    tail: opts.tail ?? 'shipped'
  });
  // The real story path: the beat's MOODS entry takes the instrument. With a
  // planet given, the planet's tune haunts the beat (§10.5).
  if (opts.planetSeed != null) {
    setScorePlanetGenome(deriveMotifGenome(opts.planetSeed, opts.archetype), opts.planetSeed);
  }
  if (opts.moodOverride) setStoryScoreMoodOverride(opts.beat, opts.moodOverride);
  setScoreBeat(opts.beat);
  // Era-authentic audition: snap the primitives era rail BEFORE the first
  // scheduler pass so the render opens at the requested fidelity rung instead
  // of slewing down from the alive-era default over the first second.
  if (opts.era != null) {
    setMusicPrimitiveTargets({ era: opts.era });
    tickMusicPrimitives(OFFLINE_PRIMITIVES_SNAP_S);
  }
  beginOfflineScoreRender(ctx, out);
  // Combined-bus parity: the same legacy rim the live game runs every frame,
  // fed by the same pure mix resolver (procedural voices render for real;
  // streamed stems have no assets offline and stay silent).
  const legacyMusic = opts.legacyScene != null
    ? createOfflineMusicEngineRuntime(ctx, out)
    : null;
  let legacyChordRoot: number | null = null;
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
      opts.onDriveStep?.(ctx, now);
      if (legacyMusic && opts.legacyScene != null) {
        const legacyMix = resolveMusicMix(
          opts.legacyScene,
          0,
          NEUTRAL_PLANET_MOOD,
          1,
          getMusicPrimitives(),
          isScoreMoodLeading()
        );
        legacyMusic.setLayerTargets(legacyMix.layers, legacyMix.fadeSeconds);
        legacyMusic.setProceduralTargets(legacyMix.procedural, legacyMix.fadeSeconds);
        const chordRoot = getMusicChord().root;
        if (chordRoot !== legacyChordRoot) {
          legacyChordRoot = chordRoot;
          legacyMusic.retuneDronesToChordRoot(chordRoot);
        }
      }
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
    if (opts.moodOverride) clearStoryScoreMoodOverride(opts.beat);
    if (opts.planetSeed != null) setScorePlanetGenome(null);
    if (opts.era != null) {
      // Restore the module-global primitives for any later render in this page.
      setMusicPrimitiveTargets({ era: OFFLINE_STORY_DEFAULT_ERA });
      tickMusicPrimitives(OFFLINE_PRIMITIVES_SNAP_S);
    }
  }
}
import type { AudioPosition, SfxListener } from '../sfx/spatialSfx.ts';
import type { RoomPresetId } from '../mix/mixSnapshot.ts';
