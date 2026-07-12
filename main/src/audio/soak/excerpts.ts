import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
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
  audioFloorPass,
  audioHealthPass,
  audioSmoothnessPass,
  encodeWavPcm16,
  type AudioAnalysis
} from './audioAnalysis.ts';
import {
  renderBedOffline,
  renderStoryBeatOffline,
  type HitCue
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
  report: SoakReport;
  pass: boolean;
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
  archetype: ArchetypeId = SOAK_HOME_ARCHETYPE
): Promise<AudioSoakResult> {
  const seconds = minutes * 60;
  const result = await renderBedOffline({
    planetSeed,
    archetype,
    seconds,
    scenario: 'fullSoak',
    includeStemAuditCarriers: true
  });
  return {
    minutes,
    planetSeed,
    archetype,
    bars: result.bars,
    analysis: result.analysis,
    report: result.report,
    pass: result.report.pass && audioHealthPass(result.analysis)
  };
}
