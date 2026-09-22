import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import type { StoryBeat } from '../../story/storyState.ts';
import { buildPlanetProfile } from '../../game/PlanetProfile.ts';
import { daylightFromElevation, goldenFromElevation } from '../../utils/dayNight.ts';
import { celestialMusicPrimitives, paletteBrightnessOf } from '../planetMusicSignals.ts';
import { derivePlanetKey } from '../generative/harmonyBrain.ts';
import { deriveMotifGenome } from '../generative/motif.ts';
import { ERA_COLOR } from '../generative/tuning.ts';
import {
  neutralBedSignals,
  resolveAudioGust,
  resolveEraGates,
  resolveMacroDrift,
  resolveWorldClockTick,
  type BedSignals
} from '../generative/worldSignals.ts';
import {
  makeSoakScript,
  SOAK_CONTRAST_ARCHETYPE_A,
  SOAK_CONTRAST_ARCHETYPE_B,
  SOAK_CONTRAST_SEED_A,
  SOAK_CONTRAST_SEED_B,
  SOAK_HOME_ARCHETYPE,
  SOAK_HOME_SEED,
  stageForEra,
  type SoakReport,
  type SoakScript
} from '../generative/soak.ts';
import {
  analyzeLoudness,
  audioFloorPass,
  audioHealthPass,
  audioSmoothnessPass,
  encodeWavPcm16,
  type AudioAnalysis,
  type LoudnessAnalysis
} from './audioAnalysis.ts';
import type { BedQualityTier } from '../generative/timbre.ts';
import {
  createOfflineMusicRuntimeChain,
  type MixTailBypass,
  type OfflineMusicTailMode
} from '../audioCore.ts';
import {
  LATENCY_COMP_PINNED_RATES,
  LATENCY_COMP_TOLERANCE_S,
  TAIL_LATENCY_BY_RATE_S,
  TAIL_REFERENCE_GAIN_DB,
  tailLatencyForSampleRate
} from '../mix/mixTuning.ts';
import { truePeakLinear } from './audioAnalysis.ts';
import { resolveDuck, type DuckSource } from '../mix/duckMatrix.ts';
import { SFX_DUCK_SOURCE, SFX_CATEGORY } from '../mix/sfxCategories.ts';
import { renderDesignedSfx, type SfxEvent } from '../sfxEngine.ts';
import { describeStressDensity, type StressDensity } from './stressDensity.ts';
import { analyzeStemEnergy, encodeWavFloat32, isolateStressOptions, type StressDiagnosticVariant } from './stemDiagnostics.ts';
import {
  getChapter10ScoreMood,
  getStoryScoreMood,
  HIT_CAP_MS,
  listStoryScoreMoodInventory,
  STORY_HIT_ANCHOR_IDS,
  STORY_HIT_ANCHORS,
  storyHitAnchorTempo,
  type StoryHitAnchorId
} from '../../story/storyScore.ts';
import { scheduleHitOffline, type HitSchedule, type ScheduleHitKind, type ScoreMood } from '../scoreEngine.ts';
import type { HitQuantize } from '../generative/transport.ts';
import type { HitQuantumRung } from '../generative/hitSchedule.ts';
import {
  RENDER_SAMPLE_RATE,
  OFFLINE_DRIVE_STEP_S,
  renderBedOffline,
  renderCombinedOffline,
  renderStoryBeatOffline,
  type CombinedRenderOptions,
  type HitCue,
  type SfxScriptCue
} from './offlineRender.ts';

// --- Owner-audition excerpts (P4) ------------------------------------------------------------------
//
// The §3 P4 list, verbatim: sandbox day, sandbox night, two contrasting
// planet seeds, one story beat, one era transition. Each excerpt renders the
// REAL engine offline and reports self-describing metadata (planet key, mode,
// tempo, meter) so the WAV filename tells the owner what they are hearing —
// with the §5-§8 tuning constants named beside each in the probe output.

/**
 * Bed-excerpt length. Deterministically sized so every reference planet's
 * window contains at least one BLOOM/melody statement (the C418 law keeps
 * the tune rare: home seed 5 first blooms at 123 s, volcanic seed 10 first
 * states at 185 s) — the audition must contain the tune, not just the bed.
 */
export const EXCERPT_SECONDS = 210;
/** Story-beat excerpt length (its arc is the scripted intensity ramp). */
export const STORY_EXCERPT_SECONDS = 90;
/** Era-transition excerpt length (the whole bare→alive ladder must fit). */
export const ERA_EXCERPT_SECONDS = 120;
/** One controlled A/B window: long enough to cross a phrase boundary. */
export const EVIDENCE_SECONDS = 48;
/** Dedicated continuous day → night → day symphony-law render. */
export const SMOOTHNESS_SWEEP_SECONDS = 180;
/** Focused reproduction window for the diagnosed era-changing BUILD→BLOOM edge. */
export const ROOT_CAUSE_SWEEP_SECONDS = 80;
/** Story authority yield, scene mutation behind the story, and complementary resume. */
export const STORY_HANDOFF_SWEEP_SECONDS = 72;
/** The audited story beat: the largest build in the slice (a3-dawn). */
export const STORY_BEAT_EXCERPT = 'a3-dawn';
const STORY_INTENSITY_FLOOR = 0.35;
const STORY_BUILD_PEAK_FRAC = 0.6;
const STORY_BRAAM_FRAC = 0.25;

// Controlled evidence values. Each A/B pair varies one CONCEPTUAL world
// signal; derived rails belonging to that signal (daylight → warmth/wonder,
// stage → era) move with it exactly as they do in AudioDirector.
const EVIDENCE_SUN_ELEVATION_NIGHT = -1;
const EVIDENCE_SUN_ELEVATION_DAY = 0.6;
const EVIDENCE_GOLDEN_OFF = 0;
const EVIDENCE_GOLDEN_ON = 1;
const EVIDENCE_SUBMERGENCE_DRY = 0;
const EVIDENCE_SUBMERGENCE_DEEP = 0.85;
const EVIDENCE_WIND_CALM_STRENGTH = 0;
const EVIDENCE_WIND_GUSTY_STRENGTH = 1.65;
const EVIDENCE_WIND_FIXED_GUST = 1.45;
const EVIDENCE_WIND_FIXED_SCALE = 0.074;
const EVIDENCE_WIND_FIXED_SPEED = 0.9;
const EVIDENCE_WIND_FIXED_TURBULENCE = 0.9;
const EVIDENCE_WIND_FIXED_VEER = 1.5;
const EVIDENCE_WIND_FIXED_DIRECTION_X = -1;
const EVIDENCE_WIND_FIXED_OFFSET_X = 70;
const EVIDENCE_WIND_FIXED_OFFSET_Y = -40;
const EVIDENCE_PLAYER_X = 18;
const EVIDENCE_PLAYER_Z = -27;
const EVIDENCE_WARP_PROGRESS = 0.75;
const EVIDENCE_ERA_BARE = 0;
const EVIDENCE_ERA_ALIVE = 1;
const EVIDENCE_COMMON_PREROLL_S = 8;
const EVIDENCE_SIGNAL_RAMP_S = 10;
const EVIDENCE_ERA_RAMP_S = 24;
const EVIDENCE_WARP_EXIT_S = 40;
const EVIDENCE_DIAGNOSTIC_TIME_S = 24;
/** Seed 7 produces the controlled golden mediant on bar 8 (off does not). */
const EVIDENCE_GOLDEN_SEED = 7;
const EVIDENCE_GOLDEN_ARCHETYPE: ArchetypeId = 'verdant';
const SMOOTHNESS_SWEEP_TAU = Math.PI * 2;
const ROOT_CAUSE_BUILD_START_S = 4;
const ROOT_CAUSE_WARP_EXIT_S = ROOT_CAUSE_SWEEP_SECONDS;
const ROOT_CAUSE_ERA_START = 0.4;
const ROOT_CAUSE_ERA_RAMP_START_S = 25;
const ROOT_CAUSE_ERA_RAMP_S = 24;
const ROOT_CAUSE_WARP_PROGRESS = 0.6;
const ROOT_CAUSE_ENERGY = 0.55;
const ROOT_CAUSE_TENSION = 0.4;
const STORY_HANDOFF_BEGIN_S = 16;
const STORY_HANDOFF_SCENE_CHANGE_S = 32;
const STORY_HANDOFF_END_S = 48;

const NOTE_NAMES = ['A', 'As', 'B', 'C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs'];

export interface ExcerptResult {
  name: string;
  fileStem: string;
  description: string;
  seconds: number;
  analysis: AudioAnalysis;
  healthPass: boolean;
  /** Persistent-control mirror: musical note/hit onsets omitted, exact audible rails retained. */
  continuousControlAnalysis?: AudioAnalysis;
  report: SoakReport | null;
  wav: ArrayBuffer;
  /** Resolved musical consequences used by the controlled-pair contract. */
  mappingValues?: Record<string, number | string>;
}

function planetStem(seed: number, archetype: ArchetypeId): string {
  const key = derivePlanetKey(seed, archetype);
  const genome = deriveMotifGenome(seed, archetype);
  const meter = genome.meter.sixteenthsPerBeat === 6 ? '6-8' : '4-4';
  return `seed${seed}-${archetype}_${NOTE_NAMES[key.tonicPc]}-${key.homeMode}_${Math.round(genome.baseTempo)}bpm-${meter}`;
}

async function bedExcerpt(
  name: string,
  description: string,
  seed: number,
  archetype: ArchetypeId,
  scenario: 'sandboxDay' | 'sandboxNight' | 'eraLadder',
  seconds: number,
  hitCues?: readonly HitCue[]
): Promise<ExcerptResult> {
  const renderOptions = {
    planetSeed: seed,
    archetype,
    seconds,
    scenario,
    script: makeSoakScript(scenario, seed, seconds),
    hitCues
  } as const;
  const result = await renderBedOffline(renderOptions);
  // The era-ladder audition intentionally contains chip onsets and three
  // stage-bloom gestures. Audit its continuously controlled rails in the
  // same separate mirror used by controlled evidence instead of classifying
  // those composed envelopes as state-transition jumps.
  const continuousControlResult = scenario === 'eraLadder'
    ? await renderBedOffline({
        ...renderOptions,
        continuousControlAudit: true,
        driveLegacyMusic: false
      })
    : null;
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name,
    fileStem: `${name}_${planetStem(seed, archetype)}`,
    description,
    seconds,
    analysis: result.analysis,
    healthPass:
      result.report.pass &&
      (continuousControlResult
        ? result.analysis.nanCount === 0 &&
          result.analysis.clipCount === 0 &&
          audioFloorPass(result.analysis) &&
          continuousControlResult.report.pass &&
          audioHealthPass(continuousControlResult.analysis)
        : audioHealthPass(result.analysis)),
    continuousControlAnalysis: continuousControlResult?.analysis,
    report: result.report,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate)
  };
}

/**
 * Early-chapter audition set (owner brief 2026-07: the prologue/ch1/ch2 music
 * must be pleasing, subtle, and a smooth build toward the main score). Each
 * beat renders at the reality era the PLAYER actually hears there (the
 * AudioDirector chroma/detail/organic map keeps the monochrome ladder at
 * era≈0; ch2's color approach sits just past ERA_COLOR), held at the mood's
 * own resting baseline — no synthetic intensity ramp, no planet genome.
 */
export const EARLY_BEAT_SECONDS = 48;
export interface EarlyBeatAudition {
  beat: StoryBeat;
  era: number;
}
export const EARLY_BEAT_AUDITIONS: readonly EarlyBeatAudition[] = [
  { beat: 'crawl', era: 0 },
  { beat: 'ch1-raster', era: 0 },
  { beat: 'ch1-nav', era: 0 },
  { beat: 'descent', era: 0.05 },
  { beat: 'ch2-approach', era: 0.3 }
];

/**
 * Render one early beat exactly as shipped. Health here is finite/unclipped
 * only: composed near-silence is LEGAL at the bottom of the fidelity ladder,
 * so the sandbox silence-floor audit does not apply. Peak/RMS are reported so
 * the low end is provably tamed across before/after evidence runs.
 */
export async function renderEarlyBeatAudition(
  spec: EarlyBeatAudition,
  seconds = EARLY_BEAT_SECONDS
): Promise<ExcerptResult> {
  const result = await renderStoryBeatOffline({
    beat: spec.beat,
    seconds,
    era: spec.era
  });
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name: `early-${spec.beat}`,
    fileStem: `early-beat_${spec.beat}_era${spec.era.toFixed(2)}`,
    description: `Story mood '${spec.beat}' at reality era ${spec.era} (baseline intensity, no genome).`,
    seconds,
    analysis: result.analysis,
    healthPass: result.analysis.nanCount === 0 && result.analysis.clipCount === 0,
    report: null,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate)
  };
}

/**
 * Combined-intro auditions (owner brief follow-up): the prologue score PLUS
 * the legacy procedural engine at the storyTerminal scene mix — the whole
 * music bus the player hears at the very beginning, so a constant transit
 * drone can never again hide underneath a score-only render.
 */
export const INTRO_COMBINED_AUDITIONS: readonly EarlyBeatAudition[] = [
  { beat: 'crawl', era: 0 },
  { beat: 'ch1-raster', era: 0 }
];
const INTRO_COMBINED_SCENE = 'storyTerminal';

export async function renderIntroCombinedAudition(
  spec: EarlyBeatAudition,
  seconds = EARLY_BEAT_SECONDS
): Promise<ExcerptResult> {
  const result = await renderStoryBeatOffline({
    beat: spec.beat,
    seconds,
    era: spec.era,
    legacyScene: INTRO_COMBINED_SCENE
  });
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name: `intro-combined-${spec.beat}`,
    fileStem: `intro-combined_${spec.beat}_${INTRO_COMBINED_SCENE}_era${spec.era.toFixed(2)}`,
    description:
      `Story mood '${spec.beat}' plus the legacy procedural engine at the '${INTRO_COMBINED_SCENE}' scene mix (combined music bus).`,
    seconds,
    analysis: result.analysis,
    healthPass: result.analysis.nanCount === 0 && result.analysis.clipCount === 0,
    report: null,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate)
  };
}

export const EXCERPT_NAMES = [
  'bed-sandbox-day',
  'bed-sandbox-night',
  'bed-contrast-A',
  'bed-contrast-B',
  'story-beat',
  'era-transition'
] as const;
export type ExcerptName = (typeof EXCERPT_NAMES)[number];

/** Required §5 signal-isolation evidence sets (two WAVs per entry). */
export const EVIDENCE_PAIR_NAMES = [
  'daylight-night',
  'golden-hour',
  'submergence',
  'wind',
  'warp',
  'descent',
  'era-stage',
  'planet-seed'
] as const;
export type EvidencePairName = (typeof EVIDENCE_PAIR_NAMES)[number];
export type EvidenceVariant = 'A' | 'B';

function evidenceBase(tSec: number): BedSignals {
  const s = neutralBedSignals();
  s.timeSec = tSec;
  s.scene = 'surface';
  s.golden = EVIDENCE_GOLDEN_OFF;
  s.playerX = EVIDENCE_PLAYER_X;
  s.playerZ = EVIDENCE_PLAYER_Z;
  return s;
}

function evidenceScript(write: (s: BedSignals, tSec: number) => void): SoakScript {
  return (tSec) => {
    const s = evidenceBase(tSec);
    write(s, tSec);
    return s;
  };
}

function setEvidenceDaylight(s: BedSignals, daylight: number): void {
  s.daylight = daylight;
  const celestial = celestialMusicPrimitives(daylight, false, s.submergence);
  s.warmth = celestial.warmth;
  s.wonder = celestial.wonder;
}

function evidenceRamp(tSec: number, durationSec = EVIDENCE_SIGNAL_RAMP_S): number {
  return Math.min(1, Math.max(0, (tSec - EVIDENCE_COMMON_PREROLL_S) / durationSec));
}

function setEvidenceWind(s: BedSignals, strength: number): void {
  s.windStrength = strength;
  s.windGustStrength = EVIDENCE_WIND_FIXED_GUST;
  s.windGustScale = EVIDENCE_WIND_FIXED_SCALE;
  s.windGustSpeed = EVIDENCE_WIND_FIXED_SPEED;
  s.windTurbulence = EVIDENCE_WIND_FIXED_TURBULENCE;
  s.windVeer = EVIDENCE_WIND_FIXED_VEER;
  s.windDirectionX = EVIDENCE_WIND_FIXED_DIRECTION_X;
  s.windDirectionY = 0;
  s.windOffsetX = EVIDENCE_WIND_FIXED_OFFSET_X;
  s.windOffsetY = EVIDENCE_WIND_FIXED_OFFSET_Y;
}

async function evidenceBed(
  pair: EvidencePairName,
  variant: EvidenceVariant,
  condition: string,
  description: string,
  seed: number,
  archetype: ArchetypeId,
  script: SoakScript,
  paletteBrightness?: number
): Promise<ExcerptResult> {
  const renderOptions = {
    planetSeed: seed,
    archetype,
    paletteBrightness,
    seconds: EVIDENCE_SECONDS,
    scenario: 'sandboxDay',
    script
  } as const;
  // The WAV keeps every composed note and designed transient so the mapping is
  // genuinely auditionable. A second, unwritten render removes only those
  // note/hit envelopes and retains the exact persistent gain/filter/send rails;
  // this prevents a legal chip-note onset from masquerading as a world-state
  // discontinuity while keeping every smoothness threshold unchanged.
  const result = await renderBedOffline(renderOptions);
  const continuousControlResult = await renderBedOffline({
    ...renderOptions,
    continuousControlAudit: true,
    driveLegacyMusic: false
  });
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  const diagnosticSignals = script(EVIDENCE_DIAGNOSTIC_TIME_S);
  const key = derivePlanetKey(seed, archetype);
  const genome = deriveMotifGenome(seed, archetype);
  const clock = resolveWorldClockTick(diagnosticSignals);
  const gust = resolveAudioGust(diagnosticSignals);
  const gates = resolveEraGates(diagnosticSignals.era, diagnosticSignals.stage);
  const drift = resolveMacroDrift(seed, diagnosticSignals.timeSec, diagnosticSignals.daylight);
  return {
    name: `${pair}-${variant}`,
    fileStem: `evidence-${pair}_${variant}-${condition}_${planetStem(seed, archetype)}`,
    description,
    seconds: EVIDENCE_SECONDS,
    analysis: result.analysis,
    healthPass:
      result.analysis.nanCount === 0 &&
      result.analysis.clipCount === 0 &&
      audioFloorPass(result.analysis) &&
      result.report.pass &&
      audioHealthPass(continuousControlResult.analysis) &&
      continuousControlResult.report.pass,
    continuousControlAnalysis: continuousControlResult.analysis,
    report: result.report,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate),
    mappingValues: {
      tonicPc: key.tonicPc,
      mode: key.homeMode,
      tempoBpm: Number(genome.baseTempo.toFixed(3)),
      meter: genome.meter.sixteenthsPerBeat === 6 ? '6/8' : '4/4',
      paletteBrightness: Number((paletteBrightness ?? 0.5).toFixed(3)),
      daylight: Number(diagnosticSignals.daylight.toFixed(3)),
      golden: Number(diagnosticSignals.golden.toFixed(3)),
      submergence: Number(diagnosticSignals.submergence.toFixed(3)),
      registerShift: drift.registerShift,
      clockHz: Number(clock.hz.toFixed(3)),
      clockLevel: Number(clock.level.toFixed(3)),
      clockPresence: Number(clock.presence.toFixed(3)),
      windDrive: Number(gust.drive.toFixed(3)),
      windPan: Number(gust.pan.toFixed(3)),
      padChoirGate: Number(gates.padChoir.toFixed(3)),
      subGate: Number(gates.sub.toFixed(3)),
      shimmerGate: Number(gates.shimmer.toFixed(3)),
      mediants: result.report.stats.mediants,
      stageBlooms: result.report.stats.stageBlooms,
      arrangement: result.report.stats.arrangement
    }
  };
}

/** Render one side of a controlled pair; A and B share duration and planner origin. */
export async function renderEvidence(
  pair: EvidencePairName,
  variant: EvidenceVariant
): Promise<ExcerptResult> {
  const b = variant === 'B';
  switch (pair) {
    case 'daylight-night': {
      const elevation = b ? EVIDENCE_SUN_ELEVATION_DAY : EVIDENCE_SUN_ELEVATION_NIGHT;
      const daylight = daylightFromElevation(elevation);
      return evidenceBed(
        pair,
        variant,
        b ? `day-sunElevation${elevation}` : `night-sunElevation${elevation}`,
        b
          ? 'Daylight source high; derived warmth/wonder follow the same live mapping.'
          : 'Daylight source low; derived warmth/wonder follow the same live mapping.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s) => setEvidenceDaylight(s, daylight))
      );
    }
    case 'golden-hour':
      return evidenceBed(
        pair,
        variant,
        b ? 'golden1' : 'golden0',
        b
          ? 'Golden cadence enabled; seed 7 reaches its seeded mediant opportunity at bar 8.'
          : 'Golden cadence disabled; all other signals and musical time are identical.',
        EVIDENCE_GOLDEN_SEED,
        EVIDENCE_GOLDEN_ARCHETYPE,
        evidenceScript((s) => {
          s.golden = b ? EVIDENCE_GOLDEN_ON : EVIDENCE_GOLDEN_OFF;
        })
      );
    case 'submergence':
      return evidenceBed(
        pair,
        variant,
        b ? 'submerged0.85' : 'surfaced0',
        b
          ? 'Submerged: continuous bus muffle plus slower harmony and sub-motif handoff.'
          : 'Surfaced control; every non-submergence signal is identical.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s) => {
          const depth = b
            ? EVIDENCE_SUBMERGENCE_DEEP * evidenceRamp(s.timeSec)
            : EVIDENCE_SUBMERGENCE_DRY;
          s.submergence = depth;
          const celestial = celestialMusicPrimitives(s.daylight, false, depth);
          s.warmth = celestial.warmth;
          s.wonder = celestial.wonder;
        })
      );
    case 'wind':
      return evidenceBed(
        pair,
        variant,
        b ? 'windStrength1.65' : 'windStrength0',
        b
          ? 'Authored wind strength high at the same moving gust cell and position.'
          : 'Wind strength zero; every gust-field coordinate/profile value is identical.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s) =>
          setEvidenceWind(
            s,
            b ? EVIDENCE_WIND_GUSTY_STRENGTH : EVIDENCE_WIND_CALM_STRENGTH
          )
        )
      );
    case 'warp':
      return evidenceBed(
        pair,
        variant,
        b ? 'warp-active' : 'warp-off',
        b
          ? 'Warp active: arrangement force-build and world-clock compression.'
          : 'Warp-off control at the same seed and musical window.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s, tSec) => {
          const active = b && tSec >= EVIDENCE_COMMON_PREROLL_S && tSec < EVIDENCE_WARP_EXIT_S;
          s.warpActive = active;
          s.warpProgress = active ? EVIDENCE_WARP_PROGRESS * evidenceRamp(tSec) : 0;
        })
      );
    case 'descent':
      return evidenceBed(
        pair,
        variant,
        b ? 'scene-descent' : 'scene-surface',
        b
          ? 'Descent scene: pressure-driven unquantized clock and descent scene policy.'
          : 'Surface-scene control; no synthetic warp/descent progress is injected.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s) => {
          s.scene = b ? 'descent' : 'surface';
          s.warpProgress = 0;
          s.era = ERA_COLOR;
          s.stage = 'color';
        })
      );
    case 'era-stage':
      return evidenceBed(
        pair,
        variant,
        b ? 'alive-era1' : 'bare-era0',
        b
          ? 'Alive reality rung: full hybrid instrumentation.'
          : 'Bare reality rung: period-authentic monophonic chip instrumentation.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        evidenceScript((s, tSec) => {
          const era = b
            ? EVIDENCE_ERA_BARE +
              (EVIDENCE_ERA_ALIVE - EVIDENCE_ERA_BARE) * evidenceRamp(tSec, EVIDENCE_ERA_RAMP_S)
            : EVIDENCE_ERA_BARE;
          s.era = era;
          s.stage = stageForEra(era);
        })
      );
    case 'planet-seed': {
      const seed = b ? SOAK_CONTRAST_SEED_B : SOAK_CONTRAST_SEED_A;
      const profile = buildPlanetProfile(seed);
      const archetype = profile.archetype;
      return evidenceBed(
        pair,
        variant,
        `seed${seed}-${archetype}`,
        b
          ? `Terrain seed ${seed} (${archetype}) with its derived key, motif, tempo, meter, and palette proxy.`
          : `Terrain seed ${seed} (${archetype}) with its derived key, motif, tempo, meter, and palette proxy.`,
        seed,
        archetype,
        evidenceScript(() => {}),
        paletteBrightnessOf(profile)
      );
    }
  }
}

export async function renderExcerpt(name: ExcerptName): Promise<ExcerptResult> {
  switch (name) {
    case 'bed-sandbox-day':
      return bedExcerpt(
        name,
        'The generative bed, home planet, full daylight (alive era).',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'bed-sandbox-night':
      return bedExcerpt(
        name,
        'The same planet at night: register sinks, sub deepens, shimmer rises.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'sandboxNight',
        EXCERPT_SECONDS
      );
    case 'bed-contrast-A':
      return bedExcerpt(
        name,
        'Contrast planet A — two planets must be different musical places.',
        SOAK_CONTRAST_SEED_A,
        SOAK_CONTRAST_ARCHETYPE_A,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'bed-contrast-B':
      return bedExcerpt(
        name,
        'Contrast planet B — same daylight script, different musical identity.',
        SOAK_CONTRAST_SEED_B,
        SOAK_CONTRAST_ARCHETYPE_B,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'era-transition': {
      // Stage flips are events (§8.4): since P5 the CONDUCTOR fires the rung
      // blooms itself (plus the promised mediant at `alive`) — the excerpt
      // just plays the ladder and the mechanism scores it.
      return bedExcerpt(
        name,
        'The fidelity ladder bare→color→material→alive; the stage-transition mechanism blooms the rungs.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'eraLadder',
        ERA_EXCERPT_SECONDS
      );
    }
    case 'story-beat': {
      const seconds = STORY_EXCERPT_SECONDS;
      const peakAt = seconds * STORY_BUILD_PEAK_FRAC;
      const result = await renderStoryBeatOffline({
        beat: STORY_BEAT_EXCERPT,
        seconds,
        // P5 (§10.5): the home planet's tune haunts the beat, filtered by the
        // mood's own scale.
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        // The director's-own-timeline stand-in: floor → build → bloom → ebb.
        intensityAt: (t) =>
          t < peakAt
            ? STORY_INTENSITY_FLOOR + (1 - STORY_INTENSITY_FLOOR) * (t / peakAt)
            : 1 - 0.5 * ((t - peakAt) / (seconds - peakAt)),
        hits: [
          { atSec: seconds * STORY_BRAAM_FRAC, kind: 'braam' },
          { atSec: peakAt, kind: 'bloom' }
        ]
      });
      const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
        result.buffer.getChannelData(c)
      );
      return {
        name,
        fileStem: `${name}_${STORY_BEAT_EXCERPT}_intensity-build`,
        description: `Story mood '${STORY_BEAT_EXCERPT}' through the shipped instrument, riser build with braam and bloom.`,
        seconds,
        analysis: result.analysis,
        healthPass: audioHealthPass(result.analysis),
        report: null,
        wav: encodeWavPcm16(channels, result.buffer.sampleRate)
      };
    }
  }
}

export interface AudioSoakResult {
  minutes: number;
  planetSeed: number;
  archetype: ArchetypeId;
  bars: number;
  analysis: AudioAnalysis;
  continuousControlAnalysis: AudioAnalysis;
  report: SoakReport;
  pass: boolean;
  listeningWindows?: { startSeconds: number; seconds: number; sampleRate: number; pcmSha256: string; wav: ArrayBuffer }[];
}

export interface SmoothnessSweepResult {
  seconds: number;
  planetSeed: number;
  archetype: ArchetypeId;
  bars: number;
  analysis: AudioAnalysis;
  report: SoakReport;
  pass: boolean;
}

/**
 * Continuous celestial sweep using the SAME scalar day/night functions as the
 * sky. Noon begins and ends the render; moon-overhead lands at its midpoint.
 */
export async function runSmoothnessSweep(): Promise<SmoothnessSweepResult> {
  const script = evidenceScript((s, tSec) => {
    const elevation = Math.cos(
      SMOOTHNESS_SWEEP_TAU * (tSec / SMOOTHNESS_SWEEP_SECONDS)
    );
    setEvidenceDaylight(s, daylightFromElevation(elevation));
    s.golden = goldenFromElevation(elevation);
  });
  const result = await renderBedOffline({
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    seconds: SMOOTHNESS_SWEEP_SECONDS,
    scenario: 'sandboxDay',
    script,
    includeStemAuditCarriers: true
  });
  return {
    seconds: SMOOTHNESS_SWEEP_SECONDS,
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    bars: result.bars,
    analysis: result.analysis,
    report: result.report,
    pass: result.report.pass && audioHealthPass(result.analysis)
  };
}

/**
 * Exact regression scenario for the shipped jump: force BUILD while the era
 * gate rises from early-material to alive, then let BLOOM cancel-and-hold the
 * actual riser value before its named release. The old reset-to-new-gate code
 * produces the doctored red-test's ~15 dB edge; this real graph must stay clean.
 */
export async function runEraBuildSmoothnessSweep(): Promise<SmoothnessSweepResult> {
  const script = evidenceScript((s, tSec) => {
    const eraProgress = Math.min(
      1,
      Math.max(0, (tSec - ROOT_CAUSE_ERA_RAMP_START_S) / ROOT_CAUSE_ERA_RAMP_S)
    );
    s.era = ROOT_CAUSE_ERA_START + (EVIDENCE_ERA_ALIVE - ROOT_CAUSE_ERA_START) * eraProgress;
    // Hold the rung name steady to isolate the continuous era gate: stage
    // blooms are a separate designed transient and would mask the riser edge.
    s.stage = 'material';
    s.energy = ROOT_CAUSE_ENERGY;
    s.tension = ROOT_CAUSE_TENSION;
    s.warpActive = tSec >= ROOT_CAUSE_BUILD_START_S && tSec < ROOT_CAUSE_WARP_EXIT_S;
    s.warpProgress = s.warpActive ? ROOT_CAUSE_WARP_PROGRESS * eraProgress : 0;
  });
  const result = await renderBedOffline({
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    seconds: ROOT_CAUSE_SWEEP_SECONDS,
    scenario: 'sandboxDay',
    script,
    includeStemAuditCarriers: true,
    continuousControlAudit: true,
    driveLegacyMusic: false
  });
  return {
    seconds: ROOT_CAUSE_SWEEP_SECONDS,
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    bars: result.bars,
    analysis: result.analysis,
    report: result.report,
    pass: result.report.pass && audioHealthPass(result.analysis)
  };
}

/** Full output-chain authority audit, including a scene change while the bed is frozen. */
export async function runStoryHandoffSmoothnessSweep(
  auditStem: 'combined' | 'bed' | 'story' | 'legacy' = 'combined'
): Promise<SmoothnessSweepResult> {
  const script = evidenceScript((s, tSec) => {
    s.storyLeads = tSec >= STORY_HANDOFF_BEGIN_S && tSec < STORY_HANDOFF_END_S;
    s.scene = tSec >= STORY_HANDOFF_SCENE_CHANGE_S ? 'storyTerminal' : 'surface';
  });
  const result = await renderBedOffline({
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    seconds: STORY_HANDOFF_SWEEP_SECONDS,
    scenario: 'sandboxDay',
    script,
    includeStemAuditCarriers: true,
    storyHandoffBeat: STORY_BEAT_EXCERPT,
    continuousControlAudit: true,
    auditStem
  });
  return {
    seconds: STORY_HANDOFF_SWEEP_SECONDS,
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    bars: result.bars,
    analysis: result.analysis,
    report: result.report,
    pass:
      result.report.pass &&
      (auditStem === 'combined'
        ? audioHealthPass(result.analysis)
        : result.analysis.nanCount === 0 &&
          result.analysis.clipCount === 0 &&
          audioSmoothnessPass(result.analysis))
  };
}

/** The OfflineAudioContext soak: 30+ min of the real bed, audited + scanned. */
export async function runAudioSoak(
  minutes: number,
  planetSeed: number = SOAK_HOME_SEED,
  archetype: ArchetypeId = SOAK_HOME_ARCHETYPE,
  options: { listeningWindows?: boolean; quality?: BedQualityTier } = {}
): Promise<AudioSoakResult> {
  const seconds = minutes * 60;
  if (options.listeningWindows && seconds < 1500) throw new Error('Listening comparison requires the complete windows at 2 and 22 minutes.');
  const result = await renderBedOffline({
    planetSeed,
    archetype,
    seconds,
    scenario: 'fullSoak',
    includeStemAuditCarriers: true,
    bedQuality: options.quality
  });
  // The full pass proves the composed mix is finite, unclipped, and never
  // silent. A second 32-minute pass removes only scheduled note/hit envelopes
  // and legacy audit-noise carriers, retaining the real persistent bed graph
  // so short-window RMS measures world/control discontinuities rather than
  // legal musical attacks. The strict thresholds are unchanged.
  const continuousControlResult = await renderBedOffline({
    planetSeed,
    archetype,
    seconds,
    scenario: 'fullSoak',
    continuousControlAudit: true,
    driveLegacyMusic: false,
    bedQuality: options.quality
  });
  let listeningWindows: AudioSoakResult['listeningWindows'];
  if (options.listeningWindows) {
    listeningWindows = [];
    for (const startSeconds of [120, 1320]) {
      const rate = result.buffer.sampleRate;
      const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, channel) =>
        result.buffer.getChannelData(channel).slice(startSeconds * rate, (startSeconds + 180) * rate));
      listeningWindows.push({ startSeconds, seconds: 180, sampleRate: rate, pcmSha256: await sha256Hex(channels), wav: encodeWavPcm16(channels, rate) });
    }
  }
  return {
    minutes,
    planetSeed,
    archetype,
    bars: result.bars,
    analysis: result.analysis,
    continuousControlAnalysis: continuousControlResult.analysis,
    report: result.report,
    listeningWindows,
    pass:
      result.report.pass &&
      continuousControlResult.report.pass &&
      result.analysis.nanCount === 0 &&
      result.analysis.clipCount === 0 &&
      audioFloorPass(result.analysis) &&
      audioHealthPass(continuousControlResult.analysis)
  };
}


// --- The `audio:check` gate (Stage 0 evidence floor) ------------------------------------------------
//
// One 90 s render of the mix the player's output route actually carries: the
// shipped music chain plus a scripted diegetic cue list joined post-compressor,
// with a story-authority handoff in the middle. Rendered twice and hashed, so
// the gate also proves the render is reproducible. Nothing here is audible in
// the game — it is the measurement the later stages are argued against.

export const AUDIO_CHECK_SECONDS = 90;
export const AUDIO_CHECK_PLANET_SEED = SOAK_HOME_SEED;
export const AUDIO_CHECK_ARCHETYPE = SOAK_HOME_ARCHETYPE;
/** Seed for the offline SFX rim's noise; changing it changes the replay hash. */
export const AUDIO_CHECK_SFX_SEED = 0x51f7c0de;
const AUDIO_CHECK_STORY_LEAD_BEGIN_S = 46;
const AUDIO_CHECK_STORY_LEAD_END_S = 70;
/**
 * Stage 0 records the floor; it does not move it. The ceiling is the measured
 * baseline plus a margin, and Stage 2 is where it becomes −1 dBTP for real.
 * See PARAVOXIA_AUDIO_10X_PLAN.md §7.
 */
export const AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP = -1;
export const AUDIO_CHECK_MAX_LONGEST_SILENCE_S = 0;
/**
 * Replay determinism, honestly stated. Two renders of this graph are NOT
 * float-bit-identical: measured against the persistent bed graph alone, two
 * consecutive OfflineAudioContext renders in the same page diverge from
 * ~0.186 s by up to ~9e-6 full scale (about −101 dBFS, ~120 dB under the
 * signal), and the same jitter appears across processes. That floor lives in
 * Chrome's renderer, not in the generative code — the pure soak's symbolic log
 * still replays bit-identically. So the gate asserts two things instead: the
 * two renders agree to within this bound, and a coarse quantized fingerprint
 * of the waveform hashes identically. The exact PCM SHA-256 of each render is
 * reported for the record but not asserted.
 */
export const AUDIO_CHECK_REPLAY_MAX_ABS_DELTA = 1e-4;
/**
 * Stage 1 glue stage must carry unity static gain (D7): GLUE_MAKEUP_COMP_DB is a
 * measured Chrome constant, so the gate re-measures it every run and fails if
 * the browser's baked makeup drifts by more than this, dB.
 */
export const AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB = 0.05;
/** Stage 2: the shipped tail's static gain must match the pre-Stage-2 tail within this, dB (contract: 0.1). */
export const AUDIO_CHECK_TAIL_REFERENCE_MAX_DB = 0.1;
/** Fingerprint window and quantum — coarse enough to be immune to that jitter. */
const REPLAY_FINGERPRINT_WINDOW_S = 0.5;
const REPLAY_FINGERPRINT_QUANTUM = 1e-3;

/**
 * Typical play, as a cue list: mining chips in bursts against a blocked swing,
 * a traversal jump/land, a jetpack loop segment, a ship crash, the Chapter 6
 * oxygen body clock with one critical breath, a dive in and out, and a
 * boarding/launch pair. 24 sounding cues plus the 6 loop and muffle control
 * cues they need.
 */
export const AUDIO_CHECK_SFX_SCRIPT: readonly SfxScriptCue[] = [
  // Mining burst one — four chips inside a second and a half.
  { t: 10.0, event: 'mine' },
  { t: 10.32, event: 'mine' },
  { t: 10.64, event: 'mine' },
  { t: 11.0, event: 'mine' },
  { t: 11.6, event: 'blocked' },
  // Traversal.
  { t: 15.4, event: 'jump' },
  { t: 16.0, event: 'land' },
  // Mining burst two — the pickup that follows a broken block.
  { t: 20.0, event: 'mine' },
  { t: 20.34, event: 'mine' },
  { t: 20.7, event: 'mine' },
  // Jetpack loop segment.
  { t: 26.0, event: 'jetpack', params: { active: true, intensity: 0.85 } },
  { t: 31.0, event: 'jetpack', params: { active: false } },
  // The loudest single event in the game.
  { t: 36.0, event: 'shipCrash' },
  // A dive: the muffle clamps on and releases around the splash pair.
  { t: 42.0, event: 'splashEnter' },
  { t: 42.05, event: 'submerge', params: { amount: 1 } },
  { t: 52.0, event: 'splashExit' },
  { t: 52.05, event: 'submerge', params: { amount: 0 } },
  // The body clock under the story handoff, ending on a critical breath.
  { t: 44.0, event: 'oxygenPulse', params: { pulseGain: 0.05 } },
  { t: 45.3, event: 'oxygenPulse', params: { pulseGain: 0.06 } },
  { t: 46.6, event: 'oxygenPulse', params: { pulseGain: 0.07 } },
  {
    t: 47.9,
    event: 'oxygenPulse',
    params: { pulseGain: 0.08, criticalBreathGain: 0.03, criticalBreathDurationSeconds: 0.9 }
  },
  // Story-terminal beats under the lead.
  { t: 58.0, event: 'terminalKey' },
  { t: 58.3, event: 'terminalAdvance' },
  { t: 62.0, event: 'terminalAlarm' },
  { t: 66.0, event: 'storyGlitch' },
  // Board and launch.
  { t: 74.0, event: 'boardShip' },
  { t: 76.0, event: 'shipLaunch' },
  { t: 78.0, event: 'shipThrust', params: { level: 0.7 } },
  { t: 82.0, event: 'shipThrust', params: { level: 0 } },
  { t: 84.0, event: 'shipLand' }
];

/** The handoff scenario the check renders under: the bed yields, then resumes. */
function audioCheckScript(): SoakScript {
  return evidenceScript((s, tSec) => {
    s.storyLeads =
      tSec >= AUDIO_CHECK_STORY_LEAD_BEGIN_S && tSec < AUDIO_CHECK_STORY_LEAD_END_S;
    s.scene = s.storyLeads ? 'storyTerminal' : 'surface';
  });
}

export type AudioCheckStem = 'combined' | 'bed' | 'sfx';

async function sha256Hex(channels: readonly Float32Array[]): Promise<string> {
  const frames = channels[0]?.length ?? 0;
  const interleaved = new Float32Array(frames * channels.length);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels.length; c++) interleaved[i * channels.length + c] = channels[c][i];
  }
  const digest = await crypto.subtle.digest('SHA-256', interleaved.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface AudioCheckRender {
  stem: AudioCheckStem;
  seconds: number;
  bars: number;
  sfxCuesFired: number;
  analysis: AudioAnalysis;
  loudness: LoudnessAnalysis;
  pcmSha256: string;
}

interface AudioCheckStemRender extends AudioCheckRender {
  channels: readonly Float32Array[];
}

/** One stem of the check's 90 s render, analysed and hashed. */
export async function renderAudioCheckStem(stem: AudioCheckStem): Promise<AudioCheckRender> {
  const { channels: _channels, ...summary } = await renderAudioCheckStemFull(stem);
  return summary;
}

function audioCheckRenderOptions(stem: AudioCheckStem): CombinedRenderOptions {
  return {
    planetSeed: AUDIO_CHECK_PLANET_SEED,
    archetype: AUDIO_CHECK_ARCHETYPE,
    seconds: AUDIO_CHECK_SECONDS,
    scenario: 'sandboxDay',
    script: audioCheckScript(),
    storyHandoffBeat: STORY_BEAT_EXCERPT,
    sfxScript: stem === 'bed' ? [] : AUDIO_CHECK_SFX_SCRIPT,
    sfxSeed: AUDIO_CHECK_SFX_SEED,
    musicSilent: stem === 'sfx',
    resetGlobalsBeforeRender: true
  };
}

async function renderAudioCheckStemFull(stem: AudioCheckStem): Promise<AudioCheckStemRender> {
  const result = await renderCombinedOffline(audioCheckRenderOptions(stem));
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    stem,
    seconds: result.analysis.seconds,
    bars: result.bars,
    sfxCuesFired: result.sfxCuesFired,
    analysis: result.analysis,
    loudness: result.loudness,
    pcmSha256: await sha256Hex(channels),
    channels
  };
}

/**
 * One pass over both renders: the largest sample difference, the first sample
 * that differs, and a coarse per-window RMS/peak fingerprint of each on a 1e-3
 * grid. Any audible change moves the fingerprint; the renderer's ~1e-5 float
 * jitter cannot.
 */
interface ReplayComparison {
  maxAbsDelta: number;
  firstDivergenceS: number | null;
  fingerprintA: string;
  fingerprintB: string;
}

function compareRenders(
  a: readonly Float32Array[],
  b: readonly Float32Array[],
  sampleRate: number
): ReplayComparison {
  const channels = Math.min(a.length, b.length);
  const frames = Math.min(a[0]?.length ?? 0, b[0]?.length ?? 0);
  const win = Math.max(1, Math.round(REPLAY_FINGERPRINT_WINDOW_S * sampleRate));
  let maxAbsDelta = 0;
  let firstDivergence = -1;
  const partsA: string[] = [];
  const partsB: string[] = [];
  let sumSquaresA = 0;
  let sumSquaresB = 0;
  let peakA = 0;
  let peakB = 0;
  let windowFrames = 0;
  const quantize = (value: number): number => Math.round(value / REPLAY_FINGERPRINT_QUANTUM);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const va = a[c][i];
      const vb = b[c][i];
      const diff = Math.abs(va - vb);
      if (diff > maxAbsDelta) maxAbsDelta = diff;
      if (diff !== 0 && firstDivergence < 0) firstDivergence = i;
      sumSquaresA += va * va;
      sumSquaresB += vb * vb;
      const absA = Math.abs(va);
      const absB = Math.abs(vb);
      if (absA > peakA) peakA = absA;
      if (absB > peakB) peakB = absB;
    }
    windowFrames++;
    if (windowFrames === win) {
      const divisor = win * channels;
      partsA.push(`${quantize(Math.sqrt(sumSquaresA / divisor))}:${quantize(peakA)}`);
      partsB.push(`${quantize(Math.sqrt(sumSquaresB / divisor))}:${quantize(peakB)}`);
      sumSquaresA = 0;
      sumSquaresB = 0;
      peakA = 0;
      peakB = 0;
      windowFrames = 0;
    }
  }
  return {
    maxAbsDelta,
    firstDivergenceS: firstDivergence < 0 ? null : firstDivergence / sampleRate,
    fingerprintA: partsA.join(','),
    fingerprintB: partsB.join(',')
  };
}

async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}


/**
 * The replay pass: the same render, kept as raw channels. It skips the
 * loudness instrument — the replay is compared against the first render, not
 * measured on its own — which keeps the gate inside its wall budget.
 */
async function renderReplayChannels(stem: AudioCheckStem): Promise<Float32Array[]> {
  const result = await renderBedOffline(audioCheckRenderOptions(stem));
  return Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
}

export interface AudioCheckCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface AudioCheckResult {
  seconds: number;
  truePeakCeilingDbtp: number;
  render: AudioCheckRender;
  replaySha256: string;
  replayFingerprintSha256: string;
  replayMaxAbsDelta: number;
  replayFirstDivergenceS: number | null;
  glueStaticGainDb: number;
  checks: readonly AudioCheckCheck[];
  pass: boolean;
}

/** Render the combined mix twice, measure it, and report the gate's verdict. */
export async function runAudioCheck(): Promise<AudioCheckResult> {
  const first = await renderAudioCheckStemFull('combined');
  const replayChannels = await renderReplayChannels('combined');
  const comparison = compareRenders(first.channels, replayChannels, RENDER_SAMPLE_RATE);
  const divergenceS = comparison.firstDivergenceS;
  const replayDelta = comparison.maxAbsDelta;
  const firstFingerprintHash = await sha256Text(comparison.fingerprintA);
  const replaySha256 = await sha256Hex(replayChannels);
  const { channels: _channels, ...render } = first;
  const { analysis, loudness } = render;
  const glueGain = await measureGlueStaticGainDb();
  const safetyGain = await measureTailStageStaticGainDb('safety');
  const limiterGain = await measureTailStageStaticGainDb('limiter');
  const tailGain = await measureTailStageStaticGainDb('tail');
  // S2-D4: one measurement per pinned rate, each in an OfflineAudioContext at that rate.
  const latencyByRate: { sampleRate: number; music: number; sfx: number; pinnedMusic: number; pinnedSfx: number }[] = [];
  for (const rate of LATENCY_COMP_PINNED_RATES) {
    const m = await measureTailLatencyS({ path: 'music', sampleRate: rate });
    const s = await measureTailLatencyS({ path: 'sfx', sampleRate: rate });
    const pinned = TAIL_LATENCY_BY_RATE_S[rate];
    latencyByRate.push({ sampleRate: rate, music: m.latencyS, sfx: s.latencyS, pinnedMusic: pinned.musicPathS, pinnedSfx: pinned.sfxPathS });
  }
  const ceiling = await measureCeilingTruePeakDbtp(CEILING_STRESS_INPUT_DBFS);
  const checks: AudioCheckCheck[] = [
    {
      name: 'finite',
      pass: analysis.nanCount === 0,
      detail: `nan=${analysis.nanCount}`
    },
    {
      name: 'sfx-cues',
      pass: render.sfxCuesFired === AUDIO_CHECK_SFX_SCRIPT.length,
      detail: `${render.sfxCuesFired}/${AUDIO_CHECK_SFX_SCRIPT.length} cues fired`
    },
    {
      name: 'true-peak',
      pass: loudness.truePeakDbtp <= AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP,
      detail: `${loudness.truePeakDbtp.toFixed(2)} dBTP <= ${AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP} dBTP`
    },
    {
      name: 'smoothness',
      pass: audioSmoothnessPass(analysis),
      detail: `${analysis.smoothnessViolations} violations, max ${analysis.maxSmoothnessDeltaDb.toFixed(2)} dB`
    },
    {
      name: 'silence',
      pass: analysis.longestSilenceS <= AUDIO_CHECK_MAX_LONGEST_SILENCE_S,
      detail: `longest ${analysis.longestSilenceS.toFixed(1)}s <= ${AUDIO_CHECK_MAX_LONGEST_SILENCE_S}s`
    },
    {
      name: 'replay-delta',
      pass: replayDelta <= AUDIO_CHECK_REPLAY_MAX_ABS_DELTA,
      detail:
        `max |Δ| ${replayDelta.toExponential(2)} <= ${AUDIO_CHECK_REPLAY_MAX_ABS_DELTA.toExponential(0)}` +
        (divergenceS == null ? ' (bit-identical)' : `, first at ${divergenceS.toFixed(4)}s`)
    },
    {
      name: 'replay-hash',
      pass: comparison.fingerprintB === comparison.fingerprintA,
      detail: `${firstFingerprintHash.slice(0, 16)} (fingerprint); pcm ${render.pcmSha256.slice(0, 12)} / ${replaySha256.slice(0, 12)}`
    },
    {
      name: 'glue-gain',
      pass: Number.isFinite(glueGain.gainDb) && Math.abs(glueGain.gainDb) <= AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB,
      detail: `glue static gain ${glueGain.gainDb.toFixed(4)} dB, |gain| <= ${AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB} dB`
    },
    {
      name: 'safety-gain',
      pass: Number.isFinite(safetyGain.trimmedGainDb) && Math.abs(safetyGain.trimmedGainDb) <= AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB,
      detail: `safety stage static gain ${safetyGain.trimmedGainDb.toFixed(4)} dB after SAFETY_MAKEUP_COMP_DB (baked ${safetyGain.bakedGainDb.toFixed(3)} dB), |gain| <= ${AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB} dB`
    },
    {
      name: 'limiter-gain',
      pass: Number.isFinite(limiterGain.trimmedGainDb) && Math.abs(limiterGain.trimmedGainDb) <= AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB,
      detail: `limiter stage static gain ${limiterGain.trimmedGainDb.toFixed(4)} dB after LIM_MAKEUP_COMP_DB + ceiling (baked ${limiterGain.bakedGainDb.toFixed(3)} dB), |gain| <= ${AUDIO_CHECK_GLUE_STATIC_GAIN_MAX_DB} dB`
    },
    {
      name: 'tail-reference',
      pass: Number.isFinite(tailGain.trimmedGainDb) && Math.abs(tailGain.trimmedGainDb) <= AUDIO_CHECK_TAIL_REFERENCE_MAX_DB,
      detail: `shipped tail vs pre-Stage-2 tail ${tailGain.trimmedGainDb.toFixed(4)} dB at -30 dBFS (tail static gain ${tailGain.bakedGainDb.toFixed(3)} dB = TAIL_REFERENCE_GAIN_DB ${TAIL_REFERENCE_GAIN_DB}), |Δ| <= ${AUDIO_CHECK_TAIL_REFERENCE_MAX_DB} dB`
    },
    {
      name: 'tail-latency',
      pass: latencyByRate.every(
        (r) =>
          Math.abs(r.music - r.pinnedMusic) <= LATENCY_COMP_TOLERANCE_S &&
          Math.abs(r.sfx - r.pinnedSfx) <= LATENCY_COMP_TOLERANCE_S
      ),
      detail:
        latencyByRate
          .map(
            (r) =>
              `${r.sampleRate} Hz: music ${(r.music * 1000).toFixed(3)} ms (pinned ${(r.pinnedMusic * 1000).toFixed(3)}), sfx ${(r.sfx * 1000).toFixed(3)} ms (pinned ${(r.pinnedSfx * 1000).toFixed(3)})`
          )
          .join('; ') + `, tolerance ${LATENCY_COMP_TOLERANCE_S * 1000} ms (TAIL_LATENCY_BY_RATE_S)`
    },
    {
      name: 'ceiling-tp',
      pass: ceiling.truePeakDbtp <= AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP,
      detail: `${CEILING_STRESS_INPUT_DBFS} dBFS burst through the tail → ${ceiling.truePeakDbtp.toFixed(3)} dBTP (sample peak ${ceiling.samplePeakDbfs.toFixed(3)} dBFS) <= ${AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP} dBTP`
    }
  ];
  return {
    seconds: AUDIO_CHECK_SECONDS,
    truePeakCeilingDbtp: AUDIO_CHECK_TRUE_PEAK_CEILING_DBTP,
    render,
    replaySha256,
    replayFingerprintSha256: firstFingerprintHash,
    replayMaxAbsDelta: replayDelta,
    replayFirstDivergenceS: divergenceS,
    glueStaticGainDb: glueGain.gainDb,
    checks,
    pass: checks.every((c) => c.pass)
  };
}



// --- Stage evidence renders (audio-10x run: before/after A/B of one stage) -----------------------------
//
// Every Stage N A/B is rendered through THIS entry so the before and after
// columns come from the same scripts, seeds and instrument. The probe
// (tools/audio-stage-evidence-probe.mjs) pulls the WAV and the metrics.

export const STAGE_EVIDENCE_NAMES = [
  ...EXCERPT_NAMES,
  'bare-bed',
  'bare-story-ch1-fixed',
  'color-bed',
  'bed-check',
  'combined-check',
  // Stage 2 stress scripts (combined render, contract acceptanceCriteria[5]).
  'stress-shipcrash-bloom',
  'stress-mining-burst',
  'stress-oxygen-dive',
  'stress-terminal-storylead',
  'stress-jetpack-splash',
  // Stage 2 story-floor check (ch4-defy / refused / seam-ebb hand-back moods).
  'floor-ch4-defy',
  'floor-refused',
  'floor-seam-ebb'
] as const;
export type StageEvidenceName = (typeof STAGE_EVIDENCE_NAMES)[number];

export interface StageEvidenceSpec {
  name: StageEvidenceName;
  /** Export the unchanged meter input without PCM16 clipping/quantization. */
  float32?: boolean;
  /** Render without the Stage 1 glue stage (bare-era regression proof). */
  glue?: boolean;
  quality?: BedQualityTier;
  /** Mastering-tail selection: 'pre-tail' taps the music path before the tail. */
  tail?: OfflineMusicTailMode;
  /** Stress scripts only. Omission preserves the existing acceptance render. */
  diagnosticVariant?: StressDiagnosticVariant;
}

export interface StageEvidenceResult {
  name: string;
  fileStem: string;
  seconds: number;
  bars: number;
  analysis: AudioAnalysis;
  loudness: LoudnessAnalysis;
  pcmSha256: string;
  fingerprintSha256: string;
  wav: ArrayBuffer;
  wavEncoding: 'PCM16' | 'IEEE-float32';
  diagnostics?: {
    variant: StressDiagnosticVariant;
    purpose: 'acceptance-sum' | 'diagnostic-only';
    wavEncoding: 'IEEE-float32';
    sourceOptions: Record<string, unknown>;
    originalSfxScriptSha256: string;
    drivingSignalsSha256: string;
    scheduledCues: readonly SfxScriptCue[];
    dispatchedCues: import('./stemDiagnostics.ts').OfflineCueTrace[];
    counts: {
      originalScheduled: number; variantScheduled: number; offlineDispatched: number;
      routedOneShots: number; audibleEvents: number | null; liveAccepted: null;
    };
    controlDuty: StressDensity;
    drivingControls: { atS: number; submergence: number; oxygen: number; storyLeads: boolean }[];
    limitations: string[];
    energy: ReturnType<typeof analyzeStemEnergy>;
  };
  stressEvidence?: {
    density: StressDensity;
    /** Standalone current-tree bed; the crash is placed within its measured loudest 3 s. */
    bloomReference?: { windowStartS: number; shortTermMaxLufs: number; impactAtS: number };
  };
}

/** Bare-era regression scripts: era pinned at the rung, story handoff at a fixed time. */
export const BARE_EVIDENCE_SECONDS = 48;
export const BARE_STORY_EVIDENCE_SECONDS = 60;
export const BARE_STORY_HANDOFF_AT_S = 24;
export const COLOR_EVIDENCE_ERA = 0.35;

function eraPinnedScript(seed: number, seconds: number, era: number, storyAtS: number | null): SoakScript {
  const base = makeSoakScript('sandboxDay', seed, seconds);
  return (t: number): BedSignals => {
    const s = base(t);
    s.era = era;
    s.stage = stageForEra(era);
    s.chroma = era;
    s.detail = era;
    s.organic = era;
    s.atmosphere = 0.2 + 0.6 * era;
    s.storyLeads = storyAtS != null && t >= storyAtS;
    return s;
  };
}

function windowFingerprint(channels: readonly Float32Array[], sampleRate: number): string {
  const win = Math.max(1, Math.round(REPLAY_FINGERPRINT_WINDOW_S * sampleRate));
  const frames = channels[0]?.length ?? 0;
  const parts: string[] = [];
  const quantize = (value: number): number => Math.round(value / REPLAY_FINGERPRINT_QUANTUM);
  let sumSquares = 0;
  let peak = 0;
  let n = 0;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const v = ch[i];
      sumSquares += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    if (++n === win) {
      parts.push(`${quantize(Math.sqrt(sumSquares / (win * channels.length)))}:${quantize(peak)}`);
      sumSquares = 0;
      peak = 0;
      n = 0;
    }
  }
  return parts.join(',');
}

async function finishStageEvidence(
  name: string,
  fileStem: string,
  result: { buffer: AudioBuffer; analysis: AudioAnalysis; bars?: number },
  float32 = false
): Promise<StageEvidenceResult> {
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name,
    fileStem,
    seconds: result.analysis.seconds,
    bars: result.bars ?? 0,
    analysis: result.analysis,
    loudness: analyzeLoudness(channels, result.buffer.sampleRate),
    pcmSha256: await sha256Hex(channels),
    fingerprintSha256: await sha256Text(windowFingerprint(channels, result.buffer.sampleRate)),
    wav: float32 ? encodeWavFloat32(channels, result.buffer.sampleRate) : encodeWavPcm16(channels, result.buffer.sampleRate),
    wavEncoding: float32 ? 'IEEE-float32' : 'PCM16'
  };
}

// --- Stage 2 stress scripts and story floors -----------------------------------------------------------
//
// Five stress scripts through the combined render (contract acceptanceCriteria[5]):
// each must hold true peak <= -1 dBTP with the duck matrix measurable in the
// music. The offline SFX rim has no rate limiter and no frame queue on purpose:
// the render measures the raw sum a call site could produce, so the limiter is
// proven against the worst case, not the guarded one.

export const STRESS_EVIDENCE_SECONDS = 60;
// The window is measured anew from the matching standalone bed below. The old
// Stage 1 timestamp (131.1 s) silently ceased to target BLOOM after Stage 5.
export const STRESS_BLOOM_IMPACT_OFFSET_S = 1.2;
/** Same-frame burst (40 nodes mined in one frame) and a 1.5 s spread of 40. */
export const STRESS_MINING_BURST_NODES = 40;
export const STRESS_MINING_BURST_AT_S = 20;
export const STRESS_MINING_SPREAD_AT_S = 32;
export const STRESS_MINING_SPREAD_S = 1.5;
/** Chapter 6 body clock under dive: pulses every 1.1 s, urgency rising. */
export const STRESS_OXYGEN_PULSE_S = 1.1;
export const STRESS_OXYGEN_PULSE_GAIN_FROM = 0.04;
export const STRESS_OXYGEN_PULSE_GAIN_TO = 0.08;
/** Typewriter cadence under a story lead (VoyageLedger digit drift ~70 ms). */
export const STRESS_TYPEWRITER_PERIOD_S = 0.07;
const STRESS_STORY_LEAD_BEGIN_S = 10;
const STRESS_STORY_LEAD_END_S = 50;
/** Story-floor renders: the composer's low intensity, held. */
export const FLOOR_EVIDENCE_SECONDS = 60;
export const FLOOR_EVIDENCE_INTENSITY = 0.25;
export const FLOOR_EVIDENCE_ERA = 1;

function stressScript(secondsTotal: number, write?: (s: BedSignals, tSec: number) => void): SoakScript {
  const base = makeSoakScript('sandboxDay', SOAK_HOME_SEED, secondsTotal);
  return (t: number): BedSignals => {
    const s = base(t);
    write?.(s, t);
    return s;
  };
}

export function stressSfxScript(name: StageEvidenceName, bloomWindowStartS?: number): readonly SfxScriptCue[] {
  switch (name) {
    case 'stress-shipcrash-bloom': {
      if (bloomWindowStartS == null || !Number.isFinite(bloomWindowStartS) || bloomWindowStartS < 0) {
        throw new Error('crash-over-BLOOM requires the current standalone bed loudness window');
      }
      const impactAt = bloomWindowStartS + STRESS_BLOOM_IMPACT_OFFSET_S;
      return [
        { t: impactAt, event: 'shipCrash' },
        { t: impactAt + 5, event: 'shipLand' }
      ];
    }
    case 'stress-mining-burst': {
      const cues: SfxScriptCue[] = [];
      for (let i = 0; i < STRESS_MINING_BURST_NODES; i++) {
        cues.push({ t: STRESS_MINING_BURST_AT_S, event: 'mine' });
      }
      for (let i = 0; i < STRESS_MINING_BURST_NODES; i++) {
        cues.push({
          t: STRESS_MINING_SPREAD_AT_S + (i / STRESS_MINING_BURST_NODES) * STRESS_MINING_SPREAD_S,
          event: i % 7 === 6 ? 'blocked' : 'mine'
        });
      }
      cues.push({ t: 44, event: 'jump' }, { t: 44.6, event: 'land' });
      return cues;
    }
    case 'stress-oxygen-dive': {
      const cues: SfxScriptCue[] = [
        { t: 8, event: 'splashEnter' },
        { t: 8.05, event: 'submerge', params: { amount: 1 } }
      ];
      const from = 12;
      const to = 50;
      const n = Math.floor((to - from) / STRESS_OXYGEN_PULSE_S);
      for (let i = 0; i <= n; i++) {
        const u = i / Math.max(1, n);
        const gain = STRESS_OXYGEN_PULSE_GAIN_FROM + (STRESS_OXYGEN_PULSE_GAIN_TO - STRESS_OXYGEN_PULSE_GAIN_FROM) * u;
        const critical = u > 0.75;
        cues.push({
          t: from + i * STRESS_OXYGEN_PULSE_S,
          event: 'oxygenPulse',
          params: critical
            ? { pulseGain: gain, criticalBreathGain: 0.03, criticalBreathDurationSeconds: 0.9 }
            : { pulseGain: gain }
        });
      }
      cues.push(
        { t: 54, event: 'splashExit' },
        { t: 54.05, event: 'submerge', params: { amount: 0 } }
      );
      return cues;
    }
    case 'stress-terminal-storylead': {
      const cues: SfxScriptCue[] = [];
      for (let t = 14; t < 20; t += STRESS_TYPEWRITER_PERIOD_S) {
        cues.push({ t: Math.round(t * 1000) / 1000, event: 'terminalKey' });
      }
      cues.push(
        { t: 20.2, event: 'terminalAdvance' },
        { t: 26, event: 'terminalAlarm' },
        { t: 30, event: 'terminalCorrupt' },
        { t: 36, event: 'storyGlitch' },
        { t: 40, event: 'terminalAlarm' },
        { t: 40.5, event: 'terminalCorrupt' },
        { t: 46, event: 'terminalAdvance' }
      );
      return cues;
    }
    case 'stress-jetpack-splash':
      return [
        { t: 6, event: 'jump' },
        { t: 6.4, event: 'jetpack', params: { active: true, intensity: 1 } },
        { t: 18, event: 'jetpack', params: { active: false } },
        { t: 18.6, event: 'land' },
        { t: 22, event: 'jump' },
        { t: 22.3, event: 'jetpack', params: { active: true, intensity: 0.9 } },
        { t: 27, event: 'splashEnter' },
        { t: 27.05, event: 'submerge', params: { amount: 1 } },
        { t: 27.2, event: 'jetpack', params: { active: false } },
        { t: 34, event: 'splashExit' },
        { t: 34.05, event: 'submerge', params: { amount: 0 } },
        { t: 34.4, event: 'jetpack', params: { active: true, intensity: 1 } },
        { t: 40, event: 'jetpack', params: { active: false } },
        { t: 40.5, event: 'land' },
        { t: 48, event: 'boardShip' },
        { t: 50, event: 'shipLaunch' },
        { t: 52, event: 'shipThrust', params: { level: 0.8 } },
        { t: 56, event: 'shipThrust', params: { level: 0 } },
        { t: 58, event: 'shipLand' }
      ];
    default:
      return [];
  }
}

/**
 * The dive script's submergence over time (S2-J2).
 *
 * It used to STEP 0 → 0.85 at 8 s and back at 54 s. Nothing in play does that:
 * submergence is a continuous scalar the swimmer drives, and the blind listener
 * heard the step's consequence as a "brick wall lowpass switching in" — an
 * artefact of the script, not of the mix. The music path always slewed
 * (MUSIC_SUBMERGE_ENTER_SLEW_S 0.42 / EXIT 0.65) and the SFX muffle is
 * edge-snapped by design (SFX_SUBMERGE_EDGE 0.5, 80 ms); the ramp below makes
 * the script represent the swim, so what remains audible at the edge is the
 * shipped gesture and not the step.
 *
 * Entering and leaving each take DIVE_RAMP_S (≥ 1 s, longer than the music
 * slew), and the plateau still sits at 0.85 across the same window.
 */
export const DIVE_RAMP_S = 1.5;
export const DIVE_ENTER_AT_S = 8;
export const DIVE_EXIT_AT_S = 54;
export const DIVE_SUBMERGENCE_PLATEAU = 0.85;
export function diveSubmergence(t: number): number {
  if (t <= DIVE_ENTER_AT_S) return 0;
  if (t < DIVE_ENTER_AT_S + DIVE_RAMP_S) return DIVE_SUBMERGENCE_PLATEAU * ((t - DIVE_ENTER_AT_S) / DIVE_RAMP_S);
  if (t < DIVE_EXIT_AT_S) return DIVE_SUBMERGENCE_PLATEAU;
  if (t < DIVE_EXIT_AT_S + DIVE_RAMP_S) return DIVE_SUBMERGENCE_PLATEAU * (1 - (t - DIVE_EXIT_AT_S) / DIVE_RAMP_S);
  return 0;
}

export function jetpackDiveSubmergence(t: number): number {
  return Math.max(0, Math.min(1, (t - 27) / DIVE_RAMP_S, (34 + DIVE_RAMP_S - t) / DIVE_RAMP_S)) * 0.9;
}

function stressRenderOptions(name: StageEvidenceName, bloomWindowStartS?: number): CombinedRenderOptions {
  const sfxScript = stressSfxScript(name, bloomWindowStartS);
  switch (name) {
    case 'stress-shipcrash-bloom':
      // The whole owner bed excerpt: the BLOOM lands where the arrangement puts it.
      return {
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds: EXCERPT_SECONDS,
        scenario: 'sandboxDay',
        script: makeSoakScript('sandboxDay', SOAK_HOME_SEED, EXCERPT_SECONDS),
        sfxScript,
        sfxSeed: AUDIO_CHECK_SFX_SEED,
        resetGlobalsBeforeRender: true
      };
    case 'stress-oxygen-dive':
      return {
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds: STRESS_EVIDENCE_SECONDS,
        scenario: 'sandboxDay',
        script: stressScript(STRESS_EVIDENCE_SECONDS, (s, t) => {
          s.submergence = diveSubmergence(t);
          s.oxygen = t >= 12 && t < 50 ? Math.max(0.05, 1 - (t - 12) / 38) : 1;
        }),
        sfxScript,
        sfxSeed: AUDIO_CHECK_SFX_SEED,
        resetGlobalsBeforeRender: true
      };
    case 'stress-terminal-storylead':
      return {
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds: STRESS_EVIDENCE_SECONDS,
        scenario: 'sandboxDay',
        script: stressScript(STRESS_EVIDENCE_SECONDS, (s, t) => {
          s.storyLeads = t >= STRESS_STORY_LEAD_BEGIN_S && t < STRESS_STORY_LEAD_END_S;
          s.scene = s.storyLeads ? 'storyTerminal' : 'surface';
        }),
        storyHandoffBeat: STORY_BEAT_EXCERPT,
        sfxScript,
        sfxSeed: AUDIO_CHECK_SFX_SEED,
        resetGlobalsBeforeRender: true
      };
    case 'stress-jetpack-splash':
      return {
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds: STRESS_EVIDENCE_SECONDS,
        scenario: 'sandboxDay',
        script: stressScript(STRESS_EVIDENCE_SECONDS, (s, t) => {
          s.submergence = jetpackDiveSubmergence(t);
        }),
        sfxScript,
        sfxSeed: AUDIO_CHECK_SFX_SEED,
        resetGlobalsBeforeRender: true
      };
    case 'stress-mining-burst':
    default:
      return {
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds: STRESS_EVIDENCE_SECONDS,
        scenario: 'sandboxDay',
        script: stressScript(STRESS_EVIDENCE_SECONDS),
        sfxScript,
        sfxSeed: AUDIO_CHECK_SFX_SEED,
        resetGlobalsBeforeRender: true
      };
  }
}

/** The three hand-back floors, rendered as the story instrument alone at a held low intensity. */
async function renderFloorEvidence(
  name: 'floor-ch4-defy' | 'floor-refused' | 'floor-seam-ebb',
  tier: { musicBusGlue: boolean; tail: OfflineMusicTailMode }
): Promise<{ buffer: AudioBuffer; analysis: AudioAnalysis }> {
  const common = {
    seconds: FLOOR_EVIDENCE_SECONDS,
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    era: FLOOR_EVIDENCE_ERA,
    intensityAt: () => FLOOR_EVIDENCE_INTENSITY,
    musicBusGlue: tier.musicBusGlue,
    tail: tier.tail
  } as const;
  if (name === 'floor-ch4-defy') {
    return renderStoryBeatOffline({ ...common, beat: 'ch4-defy' });
  }
  // The ch10 variant moods reach the instrument live through the override path
  // under the chapter's beats; the render takes the same door.
  return renderStoryBeatOffline({
    ...common,
    beat: 'ch10-transit',
    moodOverride: getChapter10ScoreMood(name === 'floor-refused' ? 'refused' : 'seam-ebb')
  });
}

/** Pure authored controls declared before the actual stress WAV starts. The
 * nominal drive hash is not the later AudioContext-quantized execution hash. */
export async function describeStressInputDeclaration(spec: StageEvidenceSpec, bloomWindowStartS?: number) {
  if (!spec.name.startsWith('stress-')) throw new Error('Only original stress fixtures have declarations');
  const options = stressRenderOptions(spec.name, bloomWindowStartS);
  const nominalSignals = [];
  for (let t = 0; t < options.seconds - OFFLINE_DRIVE_STEP_S / 2; t += OFFLINE_DRIVE_STEP_S) {
    nominalSignals.push({ atS: t, signals: options.script!(t) });
  }
  return {
    name: spec.name, quality: spec.quality ?? 'full', variant: spec.diagnosticVariant ?? 'sum',
    sourceOptions: { planetSeed: options.planetSeed, archetype: options.archetype, seconds: options.seconds,
      scenario: options.scenario, sfxSeed: options.sfxSeed, storyHandoffBeat: options.storyHandoffBeat ?? null,
      musicBusGlue: spec.glue ?? true, bedQuality: spec.quality ?? 'full', tail: spec.tail ?? 'shipped',
      resetGlobalsBeforeRender: options.resetGlobalsBeforeRender },
    originalSfxScriptSha256: await sha256Text(JSON.stringify(options.sfxScript)),
    nominalDrivingSignalsSha256: await sha256Text(JSON.stringify(nominalSignals)),
    nominalDriveStepS: OFFLINE_DRIVE_STEP_S, nominalDriveSamples: nominalSignals.length,
    controlsSampling: 'Authored nominal checkpoints. Actual AudioContext-quantized controls and their matching hash are recorded separately after render.',
    density: describeStressDensity(options.sfxScript, options.seconds),
    scheduledCues: options.sfxScript,
    bloomWindowStartS: bloomWindowStartS ?? null
  };
}
export type StressInputDeclaration = Awaited<ReturnType<typeof describeStressInputDeclaration>>;

export async function renderStageEvidence(spec: StageEvidenceSpec, hooks?: {
  onStressPrepared?: (declaration: StressInputDeclaration) => void | Promise<void>;
}): Promise<StageEvidenceResult> {
  if (spec.diagnosticVariant && !spec.name.startsWith('stress-')) {
    throw new Error('Diagnostic variants are only supported for the original stress scripts');
  }
  const tier = {
    musicBusGlue: spec.glue ?? true,
    bedQuality: spec.quality ?? 'full',
    tail: spec.tail ?? 'shipped'
  } as const;
  const suffix =
    `${spec.glue === false ? '_noglue' : ''}${spec.quality === 'lean' ? '_lean' : ''}` +
    `${spec.tail && spec.tail !== 'shipped' ? `_${spec.tail}` : ''}`;
  const stem = `${spec.name}${suffix}${spec.diagnosticVariant ? `_diagnostic-${spec.diagnosticVariant}` : ''}`;
  switch (spec.name) {
    case 'stress-shipcrash-bloom':
    case 'stress-mining-burst':
    case 'stress-oxygen-dive':
    case 'stress-terminal-storylead':
    case 'stress-jetpack-splash': {
      let bloomReference: NonNullable<StageEvidenceResult['stressEvidence']>['bloomReference'];
      if (spec.name === 'stress-shipcrash-bloom') {
        const bed = await renderBedOffline({
          planetSeed: SOAK_HOME_SEED, archetype: SOAK_HOME_ARCHETYPE,
          seconds: EXCERPT_SECONDS, scenario: 'sandboxDay',
          script: makeSoakScript('sandboxDay', SOAK_HOME_SEED, EXCERPT_SECONDS),
          resetGlobalsBeforeRender: true, ...tier
        });
        const loudness = analyzeLoudness(Array.from({ length: bed.buffer.numberOfChannels }, (_, c) => bed.buffer.getChannelData(c)), bed.buffer.sampleRate);
        bloomReference = {
          windowStartS: loudness.shortTermMaxAtS,
          shortTermMaxLufs: loudness.shortTermMaxLufs,
          impactAtS: loudness.shortTermMaxAtS + STRESS_BLOOM_IMPACT_OFFSET_S
        };
      }
      const options = { ...stressRenderOptions(spec.name, bloomReference?.windowStartS), ...tier };
      // Await the evidence writer before constructing/rendering the stress
      // context. It cannot modify the already resolved render options.
      await hooks?.onStressPrepared?.(await describeStressInputDeclaration(spec, bloomReference?.windowStartS));
      const renderOptions = isolateStressOptions(options, spec.diagnosticVariant);
      const result = await renderCombinedOffline(spec.diagnosticVariant
        ? { ...renderOptions, captureStressDiagnostics: true } : renderOptions);
      const finished = await finishStageEvidence(spec.name, stem, result, spec.float32);
      finished.stressEvidence = { density: describeStressDensity(options.sfxScript ?? [], options.seconds), bloomReference };
      if (spec.diagnosticVariant) {
        const trace = result.diagnosticTrace!;
        const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) => result.buffer.getChannelData(c));
        const controlDuty = describeStressDensity(trace.cues.map(row => row.cue), options.seconds);
        const muted = renderOptions.sfxAudible === false || renderOptions.sfxScript.length === 0;
        finished.wav = encodeWavFloat32(channels, result.buffer.sampleRate);
        finished.wavEncoding = 'IEEE-float32';
        finished.diagnostics = {
          variant: spec.diagnosticVariant,
          purpose: spec.diagnosticVariant === 'sum' && tier.tail === 'shipped' && tier.musicBusGlue ? 'acceptance-sum' : 'diagnostic-only',
          wavEncoding: 'IEEE-float32',
          sourceOptions: { planetSeed: options.planetSeed, archetype: options.archetype, seconds: options.seconds,
            scenario: options.scenario, sfxSeed: options.sfxSeed, storyHandoffBeat: options.storyHandoffBeat ?? null,
            ...tier, musicSilent: renderOptions.musicSilent ?? false, sfxAudible: renderOptions.sfxAudible ?? true,
            resetGlobalsBeforeRender: options.resetGlobalsBeforeRender },
          originalSfxScriptSha256: await sha256Text(JSON.stringify(options.sfxScript)),
          drivingSignalsSha256: await sha256Text(JSON.stringify(trace.signals)),
          scheduledCues: renderOptions.sfxScript, dispatchedCues: trace.cues,
          counts: { originalScheduled: options.sfxScript.length, variantScheduled: renderOptions.sfxScript.length,
            offlineDispatched: result.sfxCuesFired,
            routedOneShots: muted ? 0 : controlDuty.oneShots.reduce((sum, r) => sum + r.triggers, 0),
            audibleEvents: muted ? 0 : null, liveAccepted: null },
          controlDuty,
          drivingControls: trace.signals.map(({ atS, signals: s }) => ({ atS, submergence: s.submergence, oxygen: s.oxygen, storyLeads: s.storyLeads })),
          limitations: [
            'Offline rim bypasses the live rate limiter and frame queue; live accepted counts are unmeasured.',
            'Dispatch counts are returned rim calls. Routed one-shots are not measured individual audibility; loop/control duty is separate.',
            'Control duty describes commanded intervals, excluding release envelopes and room tails.',
            'All variants traverse the selected actual tail. Separately mastered diagnostic stems do not add linearly; only the actual shared-tail sum is acceptance evidence.'
          ],
          energy: analyzeStemEnergy(channels, result.buffer.sampleRate)
        };
      }
      return finished;
    }
    case 'floor-ch4-defy':
    case 'floor-refused':
    case 'floor-seam-ebb': {
      const result = await renderFloorEvidence(spec.name, { musicBusGlue: tier.musicBusGlue, tail: tier.tail });
      return finishStageEvidence(spec.name, stem, result, spec.float32);
    }
    case 'bare-bed':
    case 'color-bed': {
      const era = spec.name === 'bare-bed' ? 0 : COLOR_EVIDENCE_ERA;
      const seconds = BARE_EVIDENCE_SECONDS;
      const result = await renderBedOffline({
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds,
        scenario: 'sandboxDay',
        script: eraPinnedScript(SOAK_HOME_SEED, seconds, era, null),
        resetGlobalsBeforeRender: true,
        ...tier
      });
      return finishStageEvidence(spec.name, stem, result, spec.float32);
    }
    case 'bare-story-ch1-fixed': {
      const seconds = BARE_STORY_EVIDENCE_SECONDS;
      const result = await renderBedOffline({
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        seconds,
        scenario: 'sandboxDay',
        script: eraPinnedScript(SOAK_HOME_SEED, seconds, 0, BARE_STORY_HANDOFF_AT_S),
        storyHandoffBeat: 'ch1-fixed',
        resetGlobalsBeforeRender: true,
        ...tier
      });
      return finishStageEvidence(spec.name, stem, result, spec.float32);
    }
    case 'bed-check':
    case 'combined-check': {
      const result = await renderBedOffline({
        ...audioCheckRenderOptions(spec.name === 'bed-check' ? 'bed' : 'combined'),
        ...tier
      });
      return finishStageEvidence(spec.name, stem, result, spec.float32);
    }
    default: {
      const name = spec.name as ExcerptName;
      if (name === 'story-beat') {
        const seconds = STORY_EXCERPT_SECONDS;
        const peakAt = seconds * STORY_BUILD_PEAK_FRAC;
        const result = await renderStoryBeatOffline({
          beat: STORY_BEAT_EXCERPT,
          seconds,
          planetSeed: SOAK_HOME_SEED,
          archetype: SOAK_HOME_ARCHETYPE,
          intensityAt: (t) =>
            t < peakAt
              ? STORY_INTENSITY_FLOOR + (1 - STORY_INTENSITY_FLOOR) * (t / peakAt)
              : 1 - 0.5 * ((t - peakAt) / (seconds - peakAt)),
          hits: [
            { atSec: seconds * STORY_BRAAM_FRAC, kind: 'braam' },
            { atSec: peakAt, kind: 'bloom' }
          ],
          musicBusGlue: tier.musicBusGlue,
          tail: tier.tail
        });
        return finishStageEvidence(
          name,
          `${name}_${STORY_BEAT_EXCERPT}_intensity-build${suffix}`,
          result,
          spec.float32
        );
      }
      const table: Record<Exclude<ExcerptName, 'story-beat'>, [number, ArchetypeId, 'sandboxDay' | 'sandboxNight' | 'eraLadder', number]> = {
        'bed-sandbox-day': [SOAK_HOME_SEED, SOAK_HOME_ARCHETYPE, 'sandboxDay', EXCERPT_SECONDS],
        'bed-sandbox-night': [SOAK_HOME_SEED, SOAK_HOME_ARCHETYPE, 'sandboxNight', EXCERPT_SECONDS],
        'bed-contrast-A': [SOAK_CONTRAST_SEED_A, SOAK_CONTRAST_ARCHETYPE_A, 'sandboxDay', EXCERPT_SECONDS],
        'bed-contrast-B': [SOAK_CONTRAST_SEED_B, SOAK_CONTRAST_ARCHETYPE_B, 'sandboxDay', EXCERPT_SECONDS],
        'era-transition': [SOAK_HOME_SEED, SOAK_HOME_ARCHETYPE, 'eraLadder', ERA_EXCERPT_SECONDS]
      };
      const [seed, archetype, scenario, seconds] = table[name];
      const result = await renderBedOffline({
        planetSeed: seed,
        archetype,
        seconds,
        scenario,
        script: makeSoakScript(scenario, seed, seconds),
        resetGlobalsBeforeRender: true,
        ...tier
      });
      return finishStageEvidence(name, `${name}_${planetStem(seed, archetype)}${suffix}`, result, spec.float32);
    }
  }
}

/**
 * Static gain of the Stage 1 glue stage, dB: a quiet sine (below every knee)
 * through the offline chain with and without glue. Chrome's DynamicsCompressor
 * bakes a makeup gain in; GLUE_MAKEUP_COMP_DB is tuned from this measurement
 * so the glue stage carries unity static gain (no makeup anywhere).
 */
export const GLUE_PROBE_SECONDS = 1;
export const GLUE_PROBE_LEVEL = 0.01;
export const GLUE_PROBE_HZ = 220;
export async function measureGlueStaticGainDb(): Promise<{ withGlueRms: number; withoutGlueRms: number; gainDb: number }> {
  const rmsOf = async (glue: boolean): Promise<number> => {
    const ctx = new OfflineAudioContext(2, RENDER_SAMPLE_RATE * GLUE_PROBE_SECONDS, RENDER_SAMPLE_RATE);
    const chain = createOfflineMusicRuntimeChain(ctx, { glue });
    const osc = ctx.createOscillator();
    osc.frequency.value = GLUE_PROBE_HZ;
    const g = ctx.createGain();
    g.gain.value = GLUE_PROBE_LEVEL;
    osc.connect(g);
    g.connect(chain.bus);
    osc.start();
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    const from = Math.floor(data.length / 2);
    let sum = 0;
    for (let i = from; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / (data.length - from));
  };
  const withGlueRms = await rmsOf(true);
  const withoutGlueRms = await rmsOf(false);
  return { withGlueRms, withoutGlueRms, gainDb: 20 * Math.log10(withGlueRms / withoutGlueRms) };
}

/**
 * Stage 2: the mastering tail's fixed latency, measured, not assumed. A unit
 * impulse at a quiet level goes through the offline chain; the delay of the
 * output's peak is the tail's look-ahead (Chrome's DynamicsCompressor carries a
 * fixed pre-delay per instance; an oversampled WaveShaper adds its resampler).
 * `path: 'music'` enters at the music bus; `path: 'sfx'` enters at the SFX join,
 * so the two numbers give both LATENCY_COMP_MUSIC_PATH_S and the music-vs-SFX
 * offset Stage 3 needs.
 *
 * Stage 2 repair (S2-D4, dissent D-2): the tail's latency is NOT a fixed sample
 * count. Chromium's DynamicsCompressor pre-delay is specified in TIME, so most
 * of it is rate-invariant, while the oversampled WaveShaper's resampler is not.
 * `sampleRate` therefore renders the probe at the rate being pinned, and
 * `TAIL_LATENCY_BY_RATE_S` carries one measured entry per rate rather than one
 * number scaled by samples.
 */
export const TAIL_LATENCY_PROBE_SECONDS = 0.5;
export const TAIL_LATENCY_IMPULSE_AT_S = 0.2;
export const TAIL_LATENCY_IMPULSE_LEVEL = 0.05;
export async function measureTailLatencyS(options: {
  path: 'music' | 'sfx';
  tail?: OfflineMusicTailMode;
  glue?: boolean;
  /** Render rate of the probe. Defaults to RENDER_SAMPLE_RATE (44.1 kHz, the evidence rate). */
  sampleRate?: number;
}): Promise<{ latencyS: number; latencySamples: number; peak: number; sampleRate: number }> {
  const rate = options.sampleRate ?? RENDER_SAMPLE_RATE;
  const ctx = new OfflineAudioContext(2, Math.round(rate * TAIL_LATENCY_PROBE_SECONDS), rate);
  const chain = createOfflineMusicRuntimeChain(ctx, { glue: options.glue ?? true, tail: options.tail ?? 'shipped' });
  const impulse = ctx.createBuffer(1, 8, rate);
  impulse.getChannelData(0)[0] = TAIL_LATENCY_IMPULSE_LEVEL;
  const source = ctx.createBufferSource();
  source.buffer = impulse;
  const entry = options.path === 'music' ? chain.bus : chain.sfxJoin;
  source.connect(entry);
  const at = Math.round(TAIL_LATENCY_IMPULSE_AT_S * rate);
  source.start(at / rate);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let peak = 0;
  let peakAt = at;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) {
      peak = a;
      peakAt = i;
    }
  }
  const latencySamples = peakAt - at;
  return { latencyS: latencySamples / rate, latencySamples, peak, sampleRate: rate };
}

// --- Stage 2 static-gain measurements (the "no makeup anywhere" proof) -------------------------------------
//
// Same method as GLUE_MAKEUP_COMP_DB: a quiet sine below every knee through the
// offline chain with and without one stage. `bakedGainDb` is the stage's raw
// static gain (Chrome's baked makeup); `trimmedGainDb` is the stage WITH its
// named trim, which must be ~0. `legacySafety` measures the pre-Stage-2 safety
// compressor's baked makeup — the value TAIL_REFERENCE_GAIN_DB pins.
export const TAIL_PROBE_SECONDS = 1;
/** -30 dBFS, per the contract's wording of the measurement. */
export const TAIL_PROBE_LEVEL = Math.pow(10, -30 / 20);
export const TAIL_PROBE_HZ = 220;
export type TailStage = 'safety' | 'limiter' | 'legacySafety' | 'tail';

async function tailProbeRms(options: { tail?: OfflineMusicTailMode; glue?: boolean; bypass?: MixTailBypass; path?: 'music' | 'sfx' }): Promise<number> {
  const ctx = new OfflineAudioContext(2, RENDER_SAMPLE_RATE * TAIL_PROBE_SECONDS, RENDER_SAMPLE_RATE);
  const chain = createOfflineMusicRuntimeChain(ctx, { glue: options.glue ?? true, tail: options.tail ?? 'shipped', bypass: options.bypass });
  const osc = ctx.createOscillator();
  osc.frequency.value = TAIL_PROBE_HZ;
  const g = ctx.createGain();
  // The music bus carries DEFAULT_MUSIC_VOLUME; the SFX path enters at the join
  // through the world bus so the sfx sub-master (DEFAULT_SFX_VOLUME) is in both.
  g.gain.value = TAIL_PROBE_LEVEL;
  osc.connect(g);
  g.connect(options.path === 'sfx' ? chain.sfx.input('world') : chain.bus);
  osc.start();
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  const from = Math.floor(data.length / 2);
  let sum = 0;
  for (let i = from; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (data.length - from));
}

const dbRatio = (a: number, b: number): number => 20 * Math.log10(a / b);

export async function measureTailStageStaticGainDb(stage: TailStage): Promise<{
  stage: TailStage;
  bakedGainDb: number;
  trimmedGainDb: number;
  detail: string;
}> {
  switch (stage) {
    case 'safety': {
      const without = await tailProbeRms({ bypass: { safety: true, safetyTrim: true, referenceGain: true, limiter: true, ceiling: true } });
      const raw = await tailProbeRms({ bypass: { safetyTrim: true, referenceGain: true, limiter: true, ceiling: true } });
      const trimmed = await tailProbeRms({ bypass: { referenceGain: true, limiter: true, ceiling: true } });
      return {
        stage,
        bakedGainDb: dbRatio(raw, without),
        trimmedGainDb: dbRatio(trimmed, without),
        detail: 'safety compressor alone vs bypassed; trimmed = with SAFETY_MAKEUP_COMP_DB (reference gain bypassed)'
      };
    }
    case 'limiter': {
      const without = await tailProbeRms({ path: 'sfx', bypass: { limiter: true, limiterTrim: true, ceiling: true } });
      const raw = await tailProbeRms({ path: 'sfx', bypass: { limiterTrim: true, ceiling: true } });
      const trimmed = await tailProbeRms({ path: 'sfx', bypass: { ceiling: true } });
      const withCeiling = await tailProbeRms({ path: 'sfx' });
      return {
        stage,
        bakedGainDb: dbRatio(raw, without),
        trimmedGainDb: dbRatio(withCeiling, without),
        detail: `limiter compressor alone vs bypassed (SFX path); trimmed incl. ceiling; trim-only ${dbRatio(trimmed, without).toFixed(4)} dB`
      };
    }
    case 'legacySafety': {
      const preTail = await tailProbeRms({ tail: 'pre-tail' });
      const legacy = await tailProbeRms({ tail: 'pre-stage-2' });
      return {
        stage,
        bakedGainDb: dbRatio(legacy, preTail),
        trimmedGainDb: dbRatio(legacy, preTail) - TAIL_REFERENCE_GAIN_DB,
        detail: 'pre-Stage-2 tail vs pre-tail tap (glue is unity); trimmed = minus TAIL_REFERENCE_GAIN_DB (must be ~0)'
      };
    }
    case 'tail':
    default: {
      const legacy = await tailProbeRms({ tail: 'pre-stage-2' });
      const shipped = await tailProbeRms({ tail: 'shipped' });
      const preTail = await tailProbeRms({ tail: 'pre-tail' });
      return {
        stage: 'tail',
        bakedGainDb: dbRatio(shipped, preTail),
        trimmedGainDb: dbRatio(shipped, legacy),
        detail: 'whole shipped tail vs pre-tail tap (bakedGainDb = TAIL_REFERENCE_GAIN_DB expected); trimmed = shipped vs pre-Stage-2 tail (must be within 0.1 dB)'
      };
    }
  }
}

// --- Stage 2 duck trace ------------------------------------------------------------------------------------
//
// Two renders of the same bed: one with a single scripted SFX cue whose output is
// muted (the duck still fires), one with no cue. The ratio of their short-window
// RMS around the cue is the music's duck envelope — depth and timing measured on
// the render the player would hear, not asserted from the table.
export const DUCK_TRACE_SECONDS = 16;
export const DUCK_TRACE_CUE_AT_S = 8;
/**
 * S2-J3: 1 ms windows, not 5 ms. At 5 ms the shipCrash attack read "+40 ms,
 * 0.34 ms of margin under the 40 ms term" — a bin artefact: the true full-depth
 * window lay anywhere in (45, 50] ms raw, so the real margin was 0.3–5.3 ms.
 * A 1 ms window makes the margin a measurement instead of a rounding.
 */
export const DUCK_TRACE_WINDOW_S = 0.001;
export const DUCK_TRACE_SPAN_S = 2.5;
/** The oxygenCritical row is 0.2 attack / 0.4 hold / 2.0 release — 2.6 s of shape, so its trace runs longer. */
export const DUCK_TRACE_LONG_SPAN_S = 4;
/**
 * The post-join tail latency the impact and the ducked music BOTH carry
 * (LATENCY_COMP_SFX_PATH_S at the evidence render rate). Trace times are raw
 * against the scheduled cue; subtracting this gives the time from the AUDIBLE
 * onset, which is what the contract's 40 ms term is about.
 */
export const DUCK_TRACE_ONSET_LATENCY_S = TAIL_LATENCY_BY_RATE_S[RENDER_SAMPLE_RATE]?.sfxPathS ?? TAIL_LATENCY_BY_RATE_S[44100].sfxPathS;

/**
 * A duck trace target: any SFX event that carries a duck source, or a bare
 * duck source with no SfxEvent of its own. `oxygenCritical` is the second kind
 * — it is raised by the oxygen body clock's critical breath, not by `playSfx`
 * (S2-J5: the only active row with no measured trace at Stage 2).
 */
export type DuckTraceTarget = SfxEvent | 'oxygenCritical';
/** The scripted cue that raises each source-only target in the offline rim. */
const DUCK_TRACE_SOURCE_CUE: Record<'oxygenCritical', SfxScriptCue> = {
  oxygenCritical: {
    t: DUCK_TRACE_CUE_AT_S,
    event: 'oxygenPulse',
    params: { pulseGain: 0.6, criticalBreathGain: 0.6, criticalBreathDurationSeconds: 0.6 }
  }
};

export interface DuckTraceResult {
  event: DuckTraceTarget;
  source: DuckSource | null;
  expectedDb: number | null;
  expectedAttackS: number | null;
  cueAtS: number;
  /** dB of (ducked / reference) per DUCK_TRACE_WINDOW_S from the cue time. */
  traceDb: number[];
  windowS: number;
  minDb: number;
  minAtS: number;
  /** First window at or below (expectedDb + 1 dB) — the measured attack time. */
  reachedAtS: number | null;
  /** First window after the minimum back within 1 dB of unity — the measured recovery time. */
  recoveredAtS: number | null;
  dbAtAttack: number | null;
  /** First window at or below the table depth itself — "full depth at", raw. */
  fullDepthAtS: number | null;
  /** The shared post-join latency subtracted below (S2-J3). */
  onsetLatencyS: number;
  /**
   * The same four times measured from the AUDIBLE onset: raw minus
   * onsetLatencyS, floored at 0. These are the numbers the 40 ms term is judged
   * on; the raw column stays so the subtraction is visible, not implied.
   */
  onsetAdjusted: {
    reachedAtS: number | null;
    fullDepthAtS: number | null;
    minAtS: number;
    recoveredAtS: number | null;
  };
}

export async function renderDuckTrace(event: DuckTraceTarget, storyLead = false): Promise<DuckTraceResult> {
  const script = stressScript(DUCK_TRACE_SECONDS, (s) => {
    s.storyLeads = storyLead;
  });
  const sourceOnly = event === 'oxygenCritical';
  const spanS = sourceOnly ? DUCK_TRACE_LONG_SPAN_S : DUCK_TRACE_SPAN_S;
  const common = {
    planetSeed: SOAK_HOME_SEED,
    archetype: SOAK_HOME_ARCHETYPE,
    seconds: DUCK_TRACE_SECONDS,
    scenario: 'sandboxDay' as const,
    script,
    sfxSeed: AUDIO_CHECK_SFX_SEED,
    resetGlobalsBeforeRender: true
  };
  const reference = await renderBedOffline({ ...common });
  const ducked = await renderBedOffline({
    ...common,
    sfxScript: [sourceOnly ? DUCK_TRACE_SOURCE_CUE[event] : { t: DUCK_TRACE_CUE_AT_S, event: event as SfxEvent }],
    sfxAudible: false
  });
  const sr = reference.buffer.sampleRate;
  const win = Math.max(1, Math.round(DUCK_TRACE_WINDOW_S * sr));
  const start = Math.round(DUCK_TRACE_CUE_AT_S * sr);
  const count = Math.floor((spanS * sr) / win);
  const rmsOf = (buffer: AudioBuffer, from: number): number => {
    let sum = 0;
    let n = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = from; i < from + win && i < d.length; i++) {
        sum += d[i] * d[i];
        n++;
      }
    }
    return Math.sqrt(sum / Math.max(1, n));
  };
  const traceDb: number[] = [];
  let minDb = 0;
  let minAtS = 0;
  for (let w = 0; w < count; w++) {
    const from = start + w * win;
    const a = rmsOf(ducked.buffer, from);
    const b = rmsOf(reference.buffer, from);
    const db = b > 0 ? 20 * Math.log10(Math.max(1e-9, a) / b) : 0;
    const r = Math.round(db * 100) / 100;
    traceDb.push(r);
    if (r < minDb) {
      minDb = r;
      minAtS = w * DUCK_TRACE_WINDOW_S;
    }
  }
  const source: DuckSource | null = sourceOnly ? 'oxygenCritical' : SFX_DUCK_SOURCE[event as SfxEvent] ?? null;
  const shape = source ? resolveDuck(source, { storyLead }).music ?? null : null;
  const expectedDb = shape?.db ?? null;
  let reachedAtS: number | null = null;
  let recoveredAtS: number | null = null;
  let fullDepthAtS: number | null = null;
  if (expectedDb != null) {
    for (let w = 0; w < traceDb.length; w++) {
      if (traceDb[w] <= expectedDb + 1) {
        reachedAtS = w * DUCK_TRACE_WINDOW_S;
        break;
      }
    }
    for (let w = 0; w < traceDb.length; w++) {
      if (traceDb[w] <= expectedDb) {
        fullDepthAtS = w * DUCK_TRACE_WINDOW_S;
        break;
      }
    }
    const minIndex = Math.round(minAtS / DUCK_TRACE_WINDOW_S);
    for (let w = minIndex; w < traceDb.length; w++) {
      if (traceDb[w] >= -1) {
        recoveredAtS = w * DUCK_TRACE_WINDOW_S;
        break;
      }
    }
  }
  const attackIndex = shape ? Math.round(shape.attackS / DUCK_TRACE_WINDOW_S) : null;
  return {
    event,
    source,
    expectedDb,
    expectedAttackS: shape?.attackS ?? null,
    cueAtS: DUCK_TRACE_CUE_AT_S,
    traceDb,
    windowS: DUCK_TRACE_WINDOW_S,
    minDb,
    minAtS,
    reachedAtS,
    recoveredAtS,
    dbAtAttack: attackIndex != null ? traceDb[attackIndex] ?? null : null,
    fullDepthAtS,
    onsetLatencyS: DUCK_TRACE_ONSET_LATENCY_S,
    onsetAdjusted: {
      reachedAtS: fromOnset(reachedAtS),
      fullDepthAtS: fromOnset(fullDepthAtS),
      minAtS: fromOnset(minAtS) ?? 0,
      recoveredAtS: fromOnset(recoveredAtS)
    }
  };
}

/** Raw trace time → time from the audible onset, rounded to the microsecond. */
function fromOnset(raw: number | null): number | null {
  if (raw == null) return null;
  return Math.round(Math.max(0, raw - DUCK_TRACE_ONSET_LATENCY_S) * 1e6) / 1e6;
}

// --- Stage 2 ceiling stress ------------------------------------------------------------------------------------
//
// The true-peak ceiling proven against a signal no game sound produces: a
// sine burst well past full scale into the SFX path (post-join, so it meets
// only the limiter + ceiling), measured with the 4× oversampled true-peak
// analyser. This is the honest statement of what the ceiling holds.
export const CEILING_STRESS_INPUT_DBFS = 6;
export const CEILING_STRESS_SECONDS = 0.5;
export const CEILING_STRESS_HZ = 997;
export async function measureCeilingTruePeakDbtp(inputDbfs: number): Promise<{
  inputDbfs: number;
  truePeakDbtp: number;
  samplePeakDbfs: number;
}> {
  const ctx = new OfflineAudioContext(2, RENDER_SAMPLE_RATE * CEILING_STRESS_SECONDS, RENDER_SAMPLE_RATE);
  const chain = createOfflineMusicRuntimeChain(ctx, { tail: 'shipped' });
  const osc = ctx.createOscillator();
  osc.frequency.value = CEILING_STRESS_HZ;
  const g = ctx.createGain();
  // The sfx sub-master carries DEFAULT_SFX_VOLUME; drive past it so the tail sees the level asked for.
  g.gain.value = Math.pow(10, inputDbfs / 20) / 0.78;
  osc.connect(g);
  g.connect(chain.sfx.input('world'));
  osc.start(0.1);
  osc.stop(CEILING_STRESS_SECONDS - 0.1);
  const buffer = await ctx.startRendering();
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  let samplePeak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) samplePeak = Math.max(samplePeak, Math.abs(ch[i]));
  const tp = truePeakLinear(channels);
  return {
    inputDbfs,
    truePeakDbtp: tp > 0 ? 20 * Math.log10(tp) : -Infinity,
    samplePeakDbfs: samplePeak > 0 ? 20 * Math.log10(samplePeak) : -Infinity
  };
}

// --- Stage 3 MOODS-as-constraints identity (contract sc.chain.tonic-authority) ----------------------
//
// Every authored mood entry rendered for MOOD_IDENTITY_SECONDS through the shipped
// instrument at the offline default era, no planet genome (so the chain tonic is
// the reference A and the render is a function of the entry alone). Commit A of
// the migration must leave every hash identical; commit B (brain voicing) is
// allowed to change only the moods it re-voices.
export const MOOD_IDENTITY_SECONDS = 12;

export interface MoodIdentityResult {
  name: string;
  beat: string;
  variant: string | null;
  legacyName: string | null;
  carrierAlive: boolean | null;
  seconds: number;
  pcmSha256: string;
  fingerprintSha256: string;
  analysis: AudioAnalysis;
  /** PCM16 WAV of the render, for cross-run sample deltas (the harness is not bit-deterministic run to run). */
  wav: ArrayBuffer;
}

export function listMoodIdentityNames(): string[] {
  return listStoryScoreMoodInventory().map((entry) => entry.name);
}

export async function renderMoodIdentity(index: number): Promise<MoodIdentityResult> {
  const inventory = listStoryScoreMoodInventory();
  const entry = inventory[index];
  if (!entry) throw new Error(`mood identity index ${index} out of range (${inventory.length})`);
  const result = await renderStoryBeatOffline({
    beat: entry.beat,
    seconds: MOOD_IDENTITY_SECONDS,
    moodOverride: entry.variant ? entry.mood : undefined
  });
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name: entry.name,
    beat: entry.beat,
    variant: entry.variant,
    legacyName: entry.legacyName ?? null,
    carrierAlive: entry.carrierAlive ?? null,
    seconds: MOOD_IDENTITY_SECONDS,
    pcmSha256: await sha256Hex(channels),
    fingerprintSha256: await sha256Text(windowFingerprint(channels, result.buffer.sampleRate)),
    analysis: result.analysis,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate)
  };
}

// --- Stage 3 composed-sync onset proof (contract: onset within 1 ms of the returned audioTime) ---------
//
// The beat's mood is rendered with every continuous voice at gain 0 (pad, sub,
// ostinato, riser, no melody) so the output is DIGITAL SILENCE until the hit:
// the first nonzero sample IS the envelope start. `scheduleHitOffline` is armed
// from the drive loop at `armAtS` against the offline instrument's own step
// grid — the same quantum law and render path as the live `scheduleHit`. The
// pre-tail tap removes the mastering tail's fixed look-ahead (which is the
// image side's LATENCY_COMP_MUSIC_PATH_S, measured separately).

export interface HitOnsetProbeSpec {
  anchorId: string;
  beat: StoryBeat;
  kind: ScheduleHitKind;
  quantize: HitQuantize;
  capMs: number;
  mayLead?: boolean;
  floorRung?: HitQuantumRung;
  /** Drive time (s) at which the hit is armed. */
  armAtS: number;
  /** Desired onset, seconds after arming (the site's timeline constant). */
  desiredDelayS: number;
  notBeforeDelayS?: number;
  seconds?: number;
  sampleRate?: number;
  tail?: OfflineMusicTailMode;
  /** Separately rendered post-tail music and bundle-SFX waveform companion. */
  captureWaveform?: boolean;
}

export interface HitOnsetProbeResult extends HitOnsetProbeSpec {
  seconds: number;
  tempo: number;
  armedAtS: number | null;
  schedule: HitSchedule | null;
  /** First nonzero output sample, seconds (the rendered envelope start). */
  firstNonZeroS: number | null;
  /** firstNonZeroS − schedule.audioTime, ms (the contract's ±1 ms term). */
  onsetErrorMs: number | null;
  /** First sample above −60 dBFS, seconds (audibility reference, not the onset). */
  audibleS: number | null;
  /** True when every sample before the scheduled onset is exactly zero. */
  preRollSilent: boolean;
  fitsCap: boolean | null;
  postTail?: {
    expectedMusicAtS: number; expectedSfxAtS: number | null;
    firstMusicSampleAtS: number | null; firstSfxSampleAtS: number | null;
    sampleRate: number;
    music: { atMs: number; peak: number }[];
    sfx: { atMs: number; peak: number }[];
  };
}

/** The ten contracted anchors as onset-probe rows (kind, quantum, cap, lead, floor from the story table). */
export function hitOnsetAnchorSpecs(armAtS = 6, desiredDelayS = 2.2): HitOnsetProbeSpec[] {
  return STORY_HIT_ANCHOR_IDS.map((anchorId: StoryHitAnchorId) => {
    const row = STORY_HIT_ANCHORS[anchorId];
    return {
      anchorId,
      beat: row.beat,
      kind: row.kind,
      quantize: row.quantize,
      capMs: HIT_CAP_MS[anchorId],
      mayLead: row.mayLead,
      floorRung: row.floorRung,
      armAtS,
      desiredDelayS,
      // Room for a whole bar past the desired onset at the row's grid tempo.
      seconds: Math.max(12, armAtS + desiredDelayS + 6 + (60 / storyHitAnchorTempo(anchorId)) * 4)
    };
  });
}

export async function renderHitOnsetProbe(spec: HitOnsetProbeSpec): Promise<HitOnsetProbeResult> {
  if (spec.captureWaveform && spec.tail !== 'shipped') throw new Error('Post-tail waveform capture requires the shipped tail.');
  const base = getStoryScoreMood(spec.beat);
  if (!base) throw new Error(`onset probe: no MOODS entry for ${spec.beat}`);
  const silent: ScoreMood = { ...base, pad: 0, sub: 0, ost: 0, riser: 0, melody: undefined };
  const seconds = spec.seconds ?? Math.max(12, spec.armAtS + spec.desiredDelayS + 6);
  let schedule: HitSchedule | null = null;
  let armedAtS: number | null = null;
  const result = await renderStoryBeatOffline({
    beat: spec.beat,
    seconds,
    sampleRate: spec.sampleRate,
    moodOverride: silent,
    tail: spec.tail ?? 'pre-tail',
    onDriveStep: (ctx, now) => {
      if (armedAtS != null || now < spec.armAtS) return;
      armedAtS = now;
      schedule = scheduleHitOffline(ctx, spec.kind, spec.quantize, {
        anchorId: spec.anchorId,
        desired: now + spec.desiredDelayS,
        notBefore: spec.notBeforeDelayS != null ? now + spec.notBeforeDelayS : undefined,
        capMs: spec.capMs,
        mayLead: spec.mayLead,
        floorRung: spec.floorRung
      });
    }
  });
  const sr = result.buffer.sampleRate;
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) => result.buffer.getChannelData(c));
  let firstNonZero = -1;
  let audible = -1;
  const audibleLevel = Math.pow(10, -60 / 20);
  for (let i = 0; i < channels[0].length && (firstNonZero < 0 || audible < 0); i++) {
    for (const ch of channels) {
      const a = Math.abs(ch[i]);
      if (a > 0 && firstNonZero < 0) firstNonZero = i;
      if (a > audibleLevel && audible < 0) audible = i;
    }
  }
  const sched = schedule as HitSchedule | null;
  const onsetSample = sched ? Math.floor(sched.audioTime * sr) : -1;
  let preRollSilent = true;
  if (onsetSample > 0) {
    outer: for (let i = 0; i < onsetSample - 1; i++) {
      for (const ch of channels) {
        if (ch[i] !== 0) {
          preRollSilent = false;
          break outer;
        }
      }
    }
  }
  let postTail: HitOnsetProbeResult['postTail'];
  if (spec.captureWaveform && sched) {
    const latency = tailLatencyForSampleRate(sr);
    const expectedMusicAtS = sched.audioTime + latency.musicPathS;
    const event = STORY_HIT_ANCHORS[spec.anchorId as StoryHitAnchorId]?.sfx;
    let sfxChannels: Float32Array[] = [];
    if (event) {
      const context = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
      const mix = createOfflineMusicRuntimeChain(context);
      renderDesignedSfx(context, mix.sfx.input(SFX_CATEGORY[event]), event, sched.audioTime + latency.musicVsSfxS, 1, 5);
      const rendered = await context.startRendering();
      sfxChannels = Array.from({ length: rendered.numberOfChannels }, (_, i) => rendered.getChannelData(i));
    }
    const trace = (audio: readonly Float32Array[]) => {
      const points: { atMs: number; peak: number }[] = [];
      const first = Math.max(0, Math.floor((expectedMusicAtS - 0.15) * sr));
      const last = Math.min(channels[0].length, Math.ceil((expectedMusicAtS + 0.15) * sr));
      for (let i = first; i < last; i += 32) {
        let peak = 0;
        for (const channel of audio) for (let sample = i; sample < Math.min(i + 32, last); sample++) peak = Math.max(peak, Math.abs(channel[sample] ?? 0));
        points.push({ atMs: (i / sr - expectedMusicAtS) * 1000, peak });
      }
      return points;
    };
    let firstSfx = -1;
    if (sfxChannels.length) for (let i = 0; i < sfxChannels[0].length; i++) {
      if (sfxChannels.some(channel => Math.abs(channel[i]) > 0)) { firstSfx = i; break; }
    }
    postTail = { expectedMusicAtS, expectedSfxAtS: event ? sched.audioTime + latency.musicVsSfxS + latency.sfxPathS : null,
      firstMusicSampleAtS: firstNonZero >= 0 ? firstNonZero / sr : null, firstSfxSampleAtS: firstSfx >= 0 ? firstSfx / sr : null,
      sampleRate: sr, music: trace(channels), sfx: trace(sfxChannels) };
  }
  return {
    ...spec,
    seconds,
    tempo: base.tempo,
    armedAtS,
    schedule: sched,
    firstNonZeroS: firstNonZero >= 0 ? firstNonZero / sr : null,
    onsetErrorMs: sched && firstNonZero >= 0 ? (firstNonZero / sr - sched.audioTime) * 1000 : null,
    audibleS: audible >= 0 ? audible / sr : null,
    preRollSilent,
    fitsCap: sched ? Math.abs(sched.slackMs) <= spec.capMs + 1e-6 : null,
    ...(postTail ? { postTail } : {})
  };
}
