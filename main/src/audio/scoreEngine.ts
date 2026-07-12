import {
  getAudioContext,
  getMusicBus,
  isMusicMuted,
  makeNoiseBuffer,
  rampParamAt,
  unlockAudio
} from './audioCore.ts';
import {
  getMusicChord,
  getMusicPrimitives,
  setMusicChord,
  setMusicPrimitiveTargets
} from './musicPrimitives.ts';
import { nextGridStep, type HitQuantize } from './generative/transport.ts';
import {
  CHIP_MONO_DUCK,
  ERA_ALIVE,
  ERA_COLOR,
  ERA_MATERIAL,
  HIT_ALIVE_UPPER_VOICE_CAP,
  HIT_BARE_MAX_PITCHED_VOICES,
  HIT_BARE_UPPER_VOICE_CAP,
  HIT_COLOR_MAX_PITCHED_VOICES,
  HIT_COLOR_UPPER_VOICE_CAP,
  HIT_MATERIAL_UPPER_VOICE_CAP,
  HIT_MIN_LEAD_S,
  PHRASE_BARS,
  SCORE_BARE_PULSE_VOICE_CAP,
  SCORE_BARE_TRIANGLE_VOICE_CAP,
  SCORE_COLOR_PULSE_VOICE_CAP,
  SCORE_COLOR_TRIANGLE_VOICE_CAP,
  SCORE_NO_VOICE_CAP
} from './generative/tuning.ts';
import { eraFade } from './generative/worldSignals.ts';
import { planMoodPhrase } from './generative/moodMelody.ts';
import type { MotifGenome } from './generative/motif.ts';
import { musicUnit, SALT_MOOD_PHRASE } from './generative/seededMusic.ts';
import { fnv1a32 } from '../utils/worldCoordinates.ts';
import type { VoxelRealityStage } from '../game/systems/realityRenderSystem.ts';

// --- The score engine --------------------------------------------------------------------
//
// A fully procedural (WebAudio, zero assets) film-score instrument. Hans-Zimmer
// grammar built from era-appropriate synthesis; ONE instrument whose voices
// retune rather than swap, played through moods (see story/storyScore.ts for
// the story's mood table).
//
// Voices: PAD (4 chord tones × 2 detuned saws → lowpass), SUB (sine drone),
// OSTINATO (lookahead-scheduled pluck pattern), MELODY (generative triangle
// phrases → dotted-8th delay), RISER (filtered noise swell), HITS (braam /
// bloom / boom one-shots). Output rides the shared music bus (audioCore), so
// the score ducks/muffles/compresses with the rest of the mix.

export type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine';

export interface ScoreMood {
  /** Semitones above the root (A1 = 55 Hz) for the pad chord (max 4 tones). */
  chord: number[];
  /**
   * Harmonic motion: chords cycled every 2 bars (pad/sub retune, ostinato
   * transposes to each chord's root). Omitted = static `chord` (cutscenes,
   * where the intensity rail IS the movement).
   */
  progression?: number[][];
  /** Ostinato pattern in semitones RELATIVE TO THE CURRENT CHORD ROOT. */
  pattern: Array<number | null>;
  /** Generative lead: scale (semis from root) + phrase probability per 4 bars. */
  melody?: { scale: number[]; density: number };
  tempo: number;
  wave: Wave;
  pad: number;      // pad gain
  sub: number;      // sub drone gain
  ost: number;      // ostinato gain
  riser: number;    // max riser gain at intensity 1
  baseline: number; // resting intensity for this mood
  octave: number;   // ostinato octave shift (semitones)
}

const ROOT_HZ = 55; // A1
/**
 * Melody-phrase attack time (s). The sustain hold is clamped to land at or
 * after the attack completes — a short note at a fast mood tempo must soften
 * the envelope, never degenerate the attack into a click (mirrors
 * bedEngine.leadNote).
 */
const MELODY_ATTACK_S = 0.06;
const SCORE_NOISE_SECONDS = 2;
const SCORE_RISER_NOISE_SEED = 0x4d4f4f44;
const SCORE_MASTER_IDLE_TAU_S = 1.2;
const SCORE_MASTER_STEADY_TAU_S = 0.4;
export const STORY_AUTHORITY_CROSSFADE_S = 4.5;
const SCORE_PAD_BUS_SLEW_S = 0.8;
const SCORE_SUB_BUS_SLEW_S = 0.8;
const SCORE_OST_GAIN_SLEW_S = 0.4;
const SCORE_PAD_FILTER_SLEW_S = 0.7;
const SCORE_OST_FILTER_SLEW_S = 0.5;
const SCORE_RISER_GAIN_SLEW_S = 0.35;
const SCORE_RISER_FILTER_SLEW_S = 0.4;
const SCORE_MELODY_DELAY_SLEW_S = 0.5;
const SCORE_NOTE_TIMBRE_FULL_LEVEL = 1;
const SCORE_OST_NOTE_ATTACK_S = 0.008;
const SCORE_OST_ENVELOPE_FLOOR = 0.001;
const SCORE_CHIP_OST_RELEASE_STEP_SCALE = 1;
const SCORE_CHIP_OST_STOP_STEP_SCALE = 1;
const SCORE_OST_RELEASE_STEP_SCALE = 1.7;
const SCORE_OST_STOP_STEP_SCALE = 2;
const SCORE_CHIP_MONO_DUCK_RELEASE_S = 1.2;
const SCORE_FALLBACK_SEED = 0x53434f52;
const SALT_SCORE_DROP = fnv1a32('score:fallback-drop');
const SALT_SCORE_VELOCITY = fnv1a32('score:fallback-velocity');
const SALT_SCORE_PHRASE_GATE = fnv1a32('score:fallback-phrase-gate');
const SALT_SCORE_PHRASE_LENGTH = fnv1a32('score:fallback-phrase-length');
const SALT_SCORE_PHRASE_LEAP = fnv1a32('score:fallback-phrase-leap');
const SALT_SCORE_PHRASE_DIRECTION = fnv1a32('score:fallback-phrase-direction');
const SALT_SCORE_PHRASE_DURATION = fnv1a32('score:fallback-phrase-duration');
const SALT_SCORE_PHRASE_GAIN = fnv1a32('score:fallback-phrase-gain');
const SALT_SCORE_PHRASE_REST = fnv1a32('score:fallback-phrase-rest');
const SCORE_PAD_ORGAN_LEVEL = 0.11;
const SCORE_PAD_ORGAN_WARMTH_FLOOR = 0.6;
const SCORE_PAD_ORGAN_WARMTH_LIFT = 0.4;
const SCORE_PAD_VOICE_COUNT = 4;
const SCORE_PRIMARY_CHIP_VOICE_INDEX = 0;
const SCORE_PAD_INITIAL_OCTAVE_RATIO = 2;
const SCORE_PAD_ACTIVE_LEVEL = 1;
const SCORE_PAD_RICH_VOICE_GAIN = 0.5;
const SCORE_PAD_CHIP_VOICE_GAIN = 0.08;
const SCORE_PAD_VOICE_SLEW_S = 1.2;
const SCORE_PAD_MEMBERSHIP_SLEW_S = 1.2;
const SCORE_PAD_RETUNE_S = 0.9;
const SCORE_PAD_WIDTH_MAX = 0.72;
const SCORE_PAD_WIDTH_SLEW_S = 1.2;
const SCORE_ORGAN_SLEW_S = 1.4;
const SCORE_SUB_RICH_LEVEL = 1;
const SCORE_SUB_CHIP_LEVEL = 1;
const SCORE_SUB_TIMBRE_SLEW_S = 1.2;
const SCORE_SUB_RETUNE_S = 1;
const SCORE_SUB_HARMONIC_LEVEL = 0.16;
const SCORE_SUB_HARMONIC_RATIO = 2;
const SCORE_SUB_HARMONIC_SLEW_S = 1.2;
const SCORE_SUB_HARMONIC_WARMTH_FLOOR = 0.55;
const SCORE_SUB_HARMONIC_WARMTH_LIFT = 0.45;
const SCORE_REVERB_SECONDS = 3.4;
const SCORE_REVERB_DECAY = 2.8;
const SCORE_REVERB_SEED = 0x73706163;
const SCORE_REVERB_SEND_LEVEL = 0.5;
const SCORE_REVERB_WET_MAX = 0.22;
const SCORE_REVERB_SLEW_S = 1.4;
const SCORE_RICH_MATERIAL_WEIGHT = 0.5;
const SCORE_RICH_ALIVE_WEIGHT = 0.5;
const SCORE_REVERB_WONDER_FLOOR = 0.45;
const SCORE_REVERB_WONDER_LIFT = 0.55;
const BLOOM_ATTACK_BASE_S = 0.09;
const BLOOM_ATTACK_STAGGER_S = 0.07;
const BLOOM_TONE_HOLD_S = 0.4;
const BLOOM_TONE_RELEASE_S = 2.6;
const BLOOM_SUB_ATTACK_S = 0.14;
const BLOOM_SUB_HOLD_S = 0.5;
const BLOOM_SUB_RELEASE_S = 3;
const BLOOM_SUB_GAIN = 0.06;
const BOOM_BODY_GAIN = 0.2;
const BOOM_BODY_ATTACK_S = 0.09;
const BOOM_BODY_HOLD_S = 0.08;
const BOOM_BODY_RELEASE_S = 1.35;
const BOOM_AIR_GAIN = 0.07;
const BOOM_AIR_ATTACK_S = 0.075;
const BOOM_AIR_HOLD_S = 0.04;
const BOOM_AIR_RELEASE_S = 0.65;
const HIT_SEMITONES_PER_OCTAVE = 12;
const HIT_UNISON_INTERVAL = 0;
const HIT_FALLBACK_ROOT_SEMIS = 0;
const HIT_ACCENT_TARGET_INTERVAL = 7;
const HIT_BLOOM_REGISTER_FLOOR_SEMIS = 24;
const HIT_BLOOM_BASS_REGISTER_FLOOR_SEMIS = 12;
const HIT_EARLY_BOOM_OCTAVE_SHIFT = 0;
const HIT_DEEP_BOOM_OCTAVE_SHIFT = -12;
const HIT_EARLY_ACCENT_GAIN = 0.055;
const HIT_EARLY_ACCENT_ATTACK_S = 0.04;
const HIT_EARLY_ACCENT_HOLD_S = 0.12;
const HIT_EARLY_ACCENT_RELEASE_S = 0.7;
const HIT_PSG_NOISE_SECONDS = 0.22;
const HIT_PSG_NOISE_SEED = 0x50534748;
const HIT_PSG_NOISE_GAIN = 0.035;
const HIT_PSG_NOISE_ATTACK_S = 0.012;
const HIT_PSG_NOISE_HOLD_S = 0.025;
const HIT_PSG_NOISE_RELEASE_S = 0.18;
const HIT_PSG_NOISE_FILTER_HZ = 1800;
const HIT_PSG_NOISE_FILTER_Q = 0.8;
const HIT_ENVELOPE_FLOOR = 0.0001;
const HIT_MIN_AUDIBLE_GAIN = 0.001;
const HIT_NODE_STOP_TAIL_S = 0.1;

/**
 * The CELESTIAL IDLE BED: when no mood leads, the instrument never fully
 * leaves — it holds a soft consonant space pad (drifting through open fifths
 * and add9 colors, sparse distant lead) UNDER the streamed music, scaled by the
 * wonder/warmth primitives. Whatever combination of factors the world produces,
 * something harmonic is always breathing.
 */
const IDLE_MOOD: ScoreMood = {
  chord: [0, 7, 12],
  progression: [[0, 7, 12], [5, 12, 19], [7, 14, 19], [0, 7, 16]],
  pattern: [null, null, null, null, null, null, null, null],
  melody: { scale: [0, 7, 12, 14, 19, 24], density: 0.14 },
  tempo: 46,
  wave: 'triangle',
  pad: 0.07,
  sub: 0.05,
  ost: 0,
  riser: 0,
  baseline: 0.3,
  octave: 12
};

// --- engine state ---------------------------------------------------------------------

let built = false;
/** Context that owns the active graph, live or offline. */
let activeScoreContext: BaseAudioContext | null = null;
let master: GainNode | null = null;
let padGain: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let subGain: GainNode | null = null;
let subOsc: OscillatorNode | null = null;
let subRichGain: GainNode | null = null;
let subChipOsc: OscillatorNode | null = null;
let subChipGain: GainNode | null = null;
let subHarmonicOsc: OscillatorNode | null = null;
let subHarmonicGain: GainNode | null = null;
let ostGain: GainNode | null = null;
let ostFilter: BiquadFilterNode | null = null;
let riserGain: GainNode | null = null;
let riserFilter: BiquadFilterNode | null = null;

interface PadVoice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  chip: OscillatorNode;
  organ: OscillatorNode;
  gain: GainNode;
  chipGain: GainNode;
  chipDuckGain: GainNode;
  organGain: GainNode;
  pan: StereoPannerNode;
  activeGain: GainNode;
  active: boolean;
}
let padVoices: PadVoice[] = [];

let melodyGain: GainNode | null = null;
let melodyFilter: BiquadFilterNode | null = null;
let melodyDelay: DelayNode | null = null;
let scoreReverbWet: GainNode | null = null;

/**
 * P5 (§10.5, owner-approved): the planet's motif genome, pushed by the
 * generative bed. While a story mood leads, its `melody.scale` becomes a
 * FILTER over this genome — the planet's tune haunts the story beats, played
 * in the mood's mode — replacing the legacy random walk. Null (no planet
 * known yet) keeps the shipped walk. NO `MOODS` schema change.
 */
let planetGenome: MotifGenome | null = null;
let planetGenomeSeed = 0;

// The idle bed leads from the very first unlock — the instrument is never off.
let mood: ScoreMood | null = IDLE_MOOD;
/** True when the celestial idle bed leads (no mood set) — extra quiet. */
let idle = true;
/**
 * P3: the generative bed (bedEngine) replaces the celestial idle bed as the
 * sandbox floor. While it leads AND no story mood is set, this engine's idle
 * voice stays silent and stops publishing the harmonic center — ONE harmonic
 * truth (the bed's harmony brain). Story moods keep full authority: any
 * non-null mood reclaims the instrument and the center instantly.
 */
let bedLead = false;
/** Grid quantizer registered by the generative bed (its transport owns the sandbox grid). */
let bedQuantizer: ((quantize: HitQuantize) => number | null) | null = null;
export interface BedHitOnsetState {
  published: { root: number; tones: readonly number[] };
  era: number;
  stage?: VoxelRealityStage;
}
let bedHitOnsetResolver: ((time: number) => BedHitOnsetState | null) | null = null;
export type ScoreHitKind = 'braam' | 'bloom' | 'boom';
export interface ScheduledBedHit {
  kind: ScoreHitKind;
  time: number;
}
let scheduledBedHits: ScheduledBedHit[] = [];
/** One-shot hit output at fixed gain, so grid hits sound even while idle yields. */
let hitBus: GainNode | null = null;
/** Fixed hit-output gain — matches the shipped mood-era master level for hits. */
export const HIT_BUS_GAIN = 0.9;
/** Score master level while a mood leads (idle scales it down). */
const SCORE_MASTER_LEVEL = 0.9;
let intensity = IDLE_MOOD.baseline;
let authorityFadeUntil = 0;
type StoryAuthorityCrossfade = (storyLeads: boolean, atTime: number, durationSec: number) => void;
let storyAuthorityCrossfade: StoryAuthorityCrossfade | null = null;
let schedulerTimer: number | null = null;
let offlineSuppressScoreTransients = false;
let nextNoteAt = 0;
let patternStep = 0;
let currentChord: number[] = [0];
let chordIndex = 0;
/** Melody phrase state: scale-degree index of the last note (random walk). */
let melodyDegree = 4;

const STEPS_PER_BAR = 8; // 8th notes, 4/4
const STEPS_PER_BEAT = 2; // quarter-note beat on the 8th-note step grid
const SCORE_SECONDS_PER_MINUTE = 60;
const STEPS_PER_CHORD = STEPS_PER_BAR * 2;
const STEPS_PER_PHRASE_SLOT = STEPS_PER_BAR * 4;

const hzForSemis = (semis: number, octaveShift = 0) => ROOT_HZ * Math.pow(2, (semis + octaveShift) / 12);
const scoreUnit = (salt: number, index: number): number =>
  musicUnit(planetGenome ? planetGenomeSeed : SCORE_FALLBACK_SEED, salt, index);

const hitPitchClass = (semis: number): number =>
  ((semis % HIT_SEMITONES_PER_OCTAVE) + HIT_SEMITONES_PER_OCTAVE) % HIT_SEMITONES_PER_OCTAVE;

const registerHitPitchAtOrAbove = (pitchClass: number, floorSemis: number): number =>
  floorSemis + hitPitchClass(pitchClass - floorSemis);

export interface ScoreHitPitchPlan {
  /** Pitch classes explicitly present in the published chord, deduplicated. */
  chordPitchClasses: readonly number[];
  /** Ordered upper bloom voices; every pitch class comes from `chordPitchClasses`. */
  bloomSemis: readonly number[];
  /** Low bloom anchor; null only for a malformed empty published chord. */
  bloomBassSemis: number | null;
  /** Published root (or the first valid chord tone if the root is malformed). */
  rootSemis: number;
  /** Published chord tone nearest the impact's preferred fifth-like accent. */
  accentSemis: number;
  boomBody: Readonly<{ startSemis: number; endSemis: number }>;
  boomAir: Readonly<{ startSemis: number; endSemis: number }>;
}

export type ScoreHitPaletteRung = 'bare' | 'color' | 'material' | 'alive';

export interface ScoreHitPalette {
  rung: ScoreHitPaletteRung;
  braamEnabled: boolean;
  upperWave: Wave;
  upperVoiceCap: number;
  bassWave: Wave | null;
  boomBodyWave: Wave | null;
  boomAirWave: Wave | null;
  boomOctaveShift: number;
  noiseAccent: boolean;
  /** Null once the 16-bit material rung intentionally lifts PSG channel caps. */
  maxPitchedVoices: number | null;
}

export interface ScoreHitRenderPlan {
  pitch: ScoreHitPitchPlan;
  palette: ScoreHitPalette;
}

/**
 * Era-authentic one-shot palette. Hit timbre is captured once at onset: bare
 * and color stay inside PSG/noise budgets; material admits 16-bit chord
 * texture; only alive may instantiate the full saw/sine Zimmer vocabulary.
 */
export function resolveScoreHitPalette(
  era: number,
  stage?: VoxelRealityStage
): ScoreHitPalette {
  const value = Number.isFinite(era) ? era : HIT_FALLBACK_ROOT_SEMIS;
  const rung: ScoreHitPaletteRung = stage === 'paradox'
    ? 'alive'
    : (stage ?? (
        value < ERA_COLOR ? 'bare' :
        value < ERA_MATERIAL ? 'color' :
        value < ERA_ALIVE ? 'material' :
        'alive'
      ));
  if (rung === 'bare') {
    return {
      rung: 'bare',
      braamEnabled: false,
      upperWave: 'square',
      upperVoiceCap: HIT_BARE_UPPER_VOICE_CAP,
      bassWave: null,
      boomBodyWave: null,
      boomAirWave: null,
      boomOctaveShift: HIT_EARLY_BOOM_OCTAVE_SHIFT,
      noiseAccent: true,
      maxPitchedVoices: HIT_BARE_MAX_PITCHED_VOICES
    };
  }
  if (rung === 'color') {
    return {
      rung: 'color',
      braamEnabled: false,
      upperWave: 'square',
      upperVoiceCap: HIT_COLOR_UPPER_VOICE_CAP,
      bassWave: null,
      boomBodyWave: null,
      boomAirWave: null,
      boomOctaveShift: HIT_DEEP_BOOM_OCTAVE_SHIFT,
      noiseAccent: true,
      maxPitchedVoices: HIT_COLOR_MAX_PITCHED_VOICES
    };
  }
  if (rung === 'material') {
    return {
      rung: 'material',
      braamEnabled: false,
      upperWave: 'triangle',
      upperVoiceCap: HIT_MATERIAL_UPPER_VOICE_CAP,
      bassWave: 'triangle',
      boomBodyWave: 'triangle',
      boomAirWave: 'triangle',
      boomOctaveShift: HIT_DEEP_BOOM_OCTAVE_SHIFT,
      noiseAccent: false,
      maxPitchedVoices: null
    };
  }
  return {
    rung: 'alive',
    braamEnabled: true,
    upperWave: 'triangle',
    upperVoiceCap: HIT_ALIVE_UPPER_VOICE_CAP,
    bassWave: 'sine',
    boomBodyWave: 'sine',
    boomAirWave: 'triangle',
    boomOctaveShift: HIT_DEEP_BOOM_OCTAVE_SHIFT,
    noiseAccent: false,
    maxPitchedVoices: null
  };
}

export function resolveScoreHitRenderPlan(
  published: { root: number; chord: readonly number[] },
  era: number,
  stage?: VoxelRealityStage
): ScoreHitRenderPlan {
  return {
    pitch: resolveScoreHitPitchPlan(published),
    palette: resolveScoreHitPalette(era, stage)
  };
}

/**
 * Frozen public `scoreHit` vocabulary: reflex braam/bloom/boom calls retain
 * the shipped full one-shot semantics. Era-aware palettes belong to the new
 * scheduled bed/stage path; they must not silently turn a legacy story bloom
 * into noise-only punctuation. Pitches still come from the published chord.
 */
export function resolveLegacyScoreHitRenderPlan(published: {
  root: number;
  chord: readonly number[];
}): ScoreHitRenderPlan {
  return resolveScoreHitRenderPlan(published, ERA_ALIVE, 'alive');
}

/**
 * Resolve the complete pitched-hit vocabulary from the ONE published harmonic
 * truth. Bloom voices use published chord pitch classes only; impact glides
 * start and land on either the published root (octaves included) or a
 * published chord tone. The pure plan is deliberately exported so the
 * never-wrong-note law can be tested without inspecting WebAudio nodes.
 */
export function resolveScoreHitPitchPlan(published: {
  root: number;
  chord: readonly number[];
}): ScoreHitPitchPlan {
  const finiteChord = published.chord.filter(Number.isFinite);
  const rootSemis = Number.isFinite(published.root)
    ? published.root
    : (finiteChord[0] ?? HIT_FALLBACK_ROOT_SEMIS);
  const chordPitchClasses: number[] = [];
  const seenPitchClasses = new Set<number>();
  for (const tone of finiteChord) {
    const pitchClass = hitPitchClass(tone);
    if (seenPitchClasses.has(pitchClass)) continue;
    seenPitchClasses.add(pitchClass);
    chordPitchClasses.push(pitchClass);
  }

  const bloomSemis = chordPitchClasses
    .map((pitchClass) => registerHitPitchAtOrAbove(pitchClass, HIT_BLOOM_REGISTER_FLOOR_SEMIS))
    .sort((a, b) => a - b)
    .slice(0, SCORE_PAD_VOICE_COUNT);
  const bloomBassSemis = chordPitchClasses.length > 0
    ? registerHitPitchAtOrAbove(
        chordPitchClasses[0],
        HIT_BLOOM_BASS_REGISTER_FLOOR_SEMIS
      )
    : null;

  const rootPitchClass = hitPitchClass(rootSemis);
  let accentInterval = HIT_UNISON_INTERVAL;
  let accentDistance = Number.POSITIVE_INFINITY;
  for (const pitchClass of chordPitchClasses) {
    const interval = hitPitchClass(pitchClass - rootPitchClass);
    if (interval === HIT_UNISON_INTERVAL) continue;
    const distance = Math.abs(interval - HIT_ACCENT_TARGET_INTERVAL);
    if (distance < accentDistance) {
      accentDistance = distance;
      accentInterval = interval;
    }
  }
  const accentSemis = rootSemis + accentInterval;

  return {
    chordPitchClasses,
    bloomSemis,
    bloomBassSemis,
    rootSemis,
    accentSemis,
    boomBody: { startSemis: accentSemis, endSemis: rootSemis },
    boomAir: {
      startSemis: rootSemis + HIT_SEMITONES_PER_OCTAVE,
      endSemis: accentSemis
    }
  };
}

/**
 * Forecast the story progression at a scheduler step. The chord turn happens
 * before notes/hits on a `STEPS_PER_CHORD` boundary, matching the live loop.
 */
export function resolveScoreHarmonyAtStep(
  scoreMood: Pick<ScoreMood, 'chord' | 'progression'>,
  step: number
): { root: number; chord: readonly number[] } {
  const progression = scoreMood.progression;
  const chord = progression && progression.length > 0
    ? progression[
        Math.floor(Math.max(HIT_UNISON_INTERVAL, step) / STEPS_PER_CHORD) % progression.length
      ]
    : scoreMood.chord;
  return { root: chord[0] ?? HIT_FALLBACK_ROOT_SEMIS, chord };
}

/** Pitch plan captured for the harmonic center that will lead at quantized onset. */
export function resolveScheduledScoreHitPitchPlan(
  scoreMood: Pick<ScoreMood, 'chord' | 'progression'>,
  step: number
): ScoreHitPitchPlan {
  return resolveScoreHitPitchPlan(resolveScoreHarmonyAtStep(scoreMood, step));
}

/** Forecasted harmony and era palette captured together for a future onset. */
export function resolveScheduledScoreHitRenderPlan(
  scoreMood: Pick<ScoreMood, 'chord' | 'progression'>,
  step: number,
  era: number,
  stage?: VoxelRealityStage
): ScoreHitRenderPlan {
  return {
    pitch: resolveScheduledScoreHitPitchPlan(scoreMood, step),
    palette: resolveScoreHitPalette(era, stage)
  };
}

/** Convert an absolute cue time onto the story score's authored 8th-note grid. */
export function resolveScoreStepAtTime(
  scoreMood: Pick<ScoreMood, 'tempo'>,
  gridStart: number,
  onsetTime: number
): number {
  const stepSeconds = SCORE_SECONDS_PER_MINUTE / scoreMood.tempo / STEPS_PER_BEAT;
  return Math.floor(
    Math.max(HIT_UNISON_INTERVAL, onsetTime - gridStart) / stepSeconds + Number.EPSILON
  );
}

/** Explicit offline/live cue plan forecast from onset time, harmony, and era. */
export function resolveTimedScoreHitRenderPlan(
  scoreMood: Pick<ScoreMood, 'chord' | 'progression' | 'tempo'>,
  gridStart: number,
  onsetTime: number,
  era: number,
  stage?: VoxelRealityStage
): ScoreHitRenderPlan {
  return resolveScheduledScoreHitRenderPlan(
    scoreMood,
    resolveScoreStepAtTime(scoreMood, gridStart, onsetTime),
    era,
    stage
  );
}

/** Pure half-open bar-window partition; stale hits are deliberately discarded. */
export function partitionScheduledBedHits(
  events: readonly ScheduledBedHit[],
  windowStart: number,
  windowEnd: number
): { due: ScheduledBedHit[]; future: ScheduledBedHit[] } {
  const due: ScheduledBedHit[] = [];
  const future: ScheduledBedHit[] = [];
  for (const event of events) {
    if (event.time >= windowStart && event.time < windowEnd) due.push({ ...event });
    else if (event.time >= windowEnd) future.push({ ...event });
  }
  return { due, future };
}

export interface ScorePadVoiceState {
  active: boolean;
  semis: number | null;
}

/** Fixed-size voice assignment: absent/non-finite chord slots are explicitly inactive. */
export function resolveScorePadVoiceStates(
  chord: readonly number[],
  voiceCount = SCORE_PAD_VOICE_COUNT
): ScorePadVoiceState[] {
  return Array.from({ length: voiceCount }, (_, index) => {
    const semis = chord[index];
    return Number.isFinite(semis)
      ? { active: true, semis }
      : { active: false, semis: null };
  });
}

export interface ScorePadLayerGains {
  chip: number;
  rich: number;
  organ: number;
}

export interface ScoreSubLayerGains {
  chip: number;
  rich: number;
  harmonic: number;
}

export interface ScoreEraTimbreMix {
  chip: number;
  rich: number;
  color: number;
}

export interface ScoreEraChannelBudget {
  pulseVoiceCap: number;
  triangleBassVoiceCap: number;
  pitchedVoiceCap: number | null;
  melodyMayOverlapOstinato: boolean;
}

export interface ScoreOstinatoTiming {
  releaseStepScale: number;
  stopStepScale: number;
}

/** Continuous era mix shared by every story note; no sounding oscillator mutates waveform. */
export function resolveScoreEraTimbreMix(era: number): ScoreEraTimbreMix {
  const rich = eraFade(era, ERA_MATERIAL);
  return {
    chip: SCORE_NOTE_TIMBRE_FULL_LEVEL - rich,
    rich,
    color: eraFade(era, ERA_COLOR)
  };
}

/**
 * Exact PSG channel budget at the story rim. `pitchedVoiceCap=null` means the
 * material hybrid is intentionally polyphonic. Bare alternates one pulse
 * drone/arp; color permits one pulse harmony + one pulse lead + triangle bass.
 */
export function resolveScoreEraChannelBudget(era: number): ScoreEraChannelBudget {
  const mix = resolveScoreEraTimbreMix(era);
  if (mix.chip <= 0) {
    return {
      pulseVoiceCap: SCORE_NO_VOICE_CAP,
      triangleBassVoiceCap: SCORE_NO_VOICE_CAP,
      pitchedVoiceCap: null,
      melodyMayOverlapOstinato: true
    };
  }
  const colorPresent = mix.color > 0;
  const pulseVoiceCap = colorPresent
    ? SCORE_COLOR_PULSE_VOICE_CAP
    : SCORE_BARE_PULSE_VOICE_CAP;
  const triangleBassVoiceCap = colorPresent
    ? SCORE_COLOR_TRIANGLE_VOICE_CAP
    : SCORE_BARE_TRIANGLE_VOICE_CAP;
  return {
    pulseVoiceCap,
    triangleBassVoiceCap,
    pitchedVoiceCap: pulseVoiceCap + triangleBassVoiceCap,
    melodyMayOverlapOstinato: false
  };
}

/** Chip notes release before the next grid slot, preserving the physical PSG voice cap. */
export function resolveScoreOstinatoTiming(era: number): ScoreOstinatoTiming {
  const chipEra = resolveScoreEraChannelBudget(era).pitchedVoiceCap != null;
  return chipEra
    ? {
        releaseStepScale: SCORE_CHIP_OST_RELEASE_STEP_SCALE,
        stopStepScale: SCORE_CHIP_OST_STOP_STEP_SCALE
      }
    : {
        releaseStepScale: SCORE_OST_RELEASE_STEP_SCALE,
        stopStepScale: SCORE_OST_STOP_STEP_SCALE
      };
}

/** Central post-timbre chord-membership gate shared by saw, chip, and organ. */
export function resolveScorePadMembershipGain(active: boolean): number {
  return active ? SCORE_PAD_ACTIVE_LEVEL : 0;
}

/**
 * Per-voice era crossfade. Bare/color remains a quiet chip oscillator;
 * detuned saw/organ richness begins only on the material ramp. Inactive
 * voices resolve to literal zero on every layer, preventing stale organ tones.
 */
export function resolveScorePadLayerGains(
  active: boolean,
  era: number,
  warmth: number,
  voiceIndex = SCORE_PRIMARY_CHIP_VOICE_INDEX
): ScorePadLayerGains {
  if (!active) return { chip: 0, rich: 0, organ: 0 };
  const mix = resolveScoreEraTimbreMix(era);
  const carriesChipVoice = voiceIndex === SCORE_PRIMARY_CHIP_VOICE_INDEX;
  return {
    chip: carriesChipVoice ? SCORE_PAD_CHIP_VOICE_GAIN * mix.chip : 0,
    rich: SCORE_PAD_RICH_VOICE_GAIN * mix.rich,
    organ:
      SCORE_PAD_ORGAN_LEVEL *
      mix.rich *
      (SCORE_PAD_ORGAN_WARMTH_FLOOR + SCORE_PAD_ORGAN_WARMTH_LIFT * warmth)
  };
}

/** Bare has no sub; color adds triangle bass; sine body/harmonic begin at material+. */
export function resolveScoreSubLayerGains(era: number, warmth: number): ScoreSubLayerGains {
  const mix = resolveScoreEraTimbreMix(era);
  return {
    chip: SCORE_SUB_CHIP_LEVEL * mix.color * mix.chip,
    rich: SCORE_SUB_RICH_LEVEL * mix.rich,
    harmonic:
      SCORE_SUB_HARMONIC_LEVEL *
      mix.rich *
      (SCORE_SUB_HARMONIC_WARMTH_FLOOR + SCORE_SUB_HARMONIC_WARMTH_LIFT * warmth)
  };
}

function ensureScore(): AudioContext | null {
  const ctx = getAudioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return null;
  if (built) return ctx;
  built = true;
  buildScoreGraph(ctx, bus);
  // A mood can be selected before the first user gesture. Static moods have
  // no progression callback to rescue an uninitialized graph, so establish
  // voice membership and legal pitches immediately on construction.
  retuneVoices(ctx, ctx.currentTime);
  startScheduler();
  return ctx;
}

/**
 * Build the instrument's voice graph on any context (the live singleton, or
 * an OfflineAudioContext in the P4 verification harness). Node construction
 * only — no timers.
 */
function buildScoreGraph(ctx: BaseAudioContext, out: AudioNode): void {
  activeScoreContext = ctx;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);

  hitBus = ctx.createGain();
  hitBus.gain.value = HIT_BUS_GAIN;
  hitBus.connect(out);

  const reverbInput = ctx.createGain();
  reverbInput.gain.value = SCORE_REVERB_SEND_LEVEL;
  const reverb = ctx.createConvolver();
  reverb.buffer = makeScoreImpulse(ctx);
  scoreReverbWet = ctx.createGain();
  scoreReverbWet.gain.value = 0;
  reverbInput.connect(reverb);
  reverb.connect(scoreReverbWet);
  scoreReverbWet.connect(master);

  // PAD: four persistent voices. A chip oscillator carries bare/color;
  // detuned saws + organ crossfade in only on the material ramp.
  padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  padFilter.Q.value = 0.6;
  padGain = ctx.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain);
  padGain.connect(master);
  padGain.connect(reverbInput);
  padVoices = Array.from({ length: SCORE_PAD_VOICE_COUNT }, () => {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const chipGain = ctx.createGain();
    chipGain.gain.value = 0;
    const chipDuckGain = ctx.createGain();
    chipDuckGain.gain.value = SCORE_NOTE_TIMBRE_FULL_LEVEL;
    const organGain = ctx.createGain();
    organGain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    const activeGain = ctx.createGain();
    activeGain.gain.value = 0;
    gain.connect(pan);
    chipGain.connect(chipDuckGain);
    chipDuckGain.connect(pan);
    organGain.connect(pan);
    pan.connect(activeGain);
    activeGain.connect(padFilter!);
    const mk = (detune: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = ROOT_HZ * SCORE_PAD_INITIAL_OCTAVE_RATIO;
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start();
      return osc;
    };
    const chip = ctx.createOscillator();
    chip.type = 'square';
    chip.frequency.value = ROOT_HZ * SCORE_PAD_INITIAL_OCTAVE_RATIO;
    chip.connect(chipGain);
    chip.start();
    const organ = ctx.createOscillator();
    organ.type = 'sine';
    organ.frequency.value = ROOT_HZ * SCORE_PAD_INITIAL_OCTAVE_RATIO;
    organ.connect(organGain);
    organ.start();
    return {
      oscA: mk(-7),
      oscB: mk(7),
      chip,
      organ,
      gain,
      chipGain,
      chipDuckGain,
      organGain,
      pan,
      activeGain,
      active: false
    };
  });

  // SUB drone.
  subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = ROOT_HZ;
  subGain = ctx.createGain();
  subGain.gain.value = 0;
  subRichGain = ctx.createGain();
  subRichGain.gain.value = 0;
  subOsc.connect(subRichGain);
  subRichGain.connect(subGain);
  subChipOsc = ctx.createOscillator();
  subChipOsc.type = 'triangle';
  subChipOsc.frequency.value = ROOT_HZ;
  subChipGain = ctx.createGain();
  subChipGain.gain.value = 0;
  subChipOsc.connect(subChipGain);
  subChipGain.connect(subGain);
  subHarmonicOsc = ctx.createOscillator();
  subHarmonicOsc.type = 'sine';
  subHarmonicOsc.frequency.value = ROOT_HZ * SCORE_SUB_HARMONIC_RATIO;
  subHarmonicGain = ctx.createGain();
  subHarmonicGain.gain.value = 0;
  subHarmonicOsc.connect(subHarmonicGain);
  subHarmonicGain.connect(subGain);
  subGain.connect(master);
  subOsc.start();
  subChipOsc.start();
  subHarmonicOsc.start();

  // OSTINATO bus.
  ostFilter = ctx.createBiquadFilter();
  ostFilter.type = 'lowpass';
  ostFilter.frequency.value = 1200;
  ostGain = ctx.createGain();
  ostGain.gain.value = 0;
  ostFilter.connect(ostGain);
  ostGain.connect(master);

  // RISER: looped noise → bandpass.
  const buffer = makeNoiseBuffer(ctx, SCORE_NOISE_SECONDS, SCORE_RISER_NOISE_SEED);
  // MELODY lead bus: triangle phrases → gentle lowpass → dotted-8th feedback
  // delay (the cinematic space that keeps sparse phrases alive).
  melodyFilter = ctx.createBiquadFilter();
  melodyFilter.type = 'lowpass';
  melodyFilter.frequency.value = 2200;
  melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.9;
  const delay = ctx.createDelay(1.5);
  melodyDelay = delay;
  delay.delayTime.value = 0.42;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const delayMix = ctx.createGain();
  delayMix.gain.value = 0.45;
  melodyFilter.connect(melodyGain);
  melodyGain.connect(master);
  melodyGain.connect(delay);
  melodyGain.connect(reverbInput);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(master);

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'bandpass';
  riserFilter.frequency.value = 300;
  riserFilter.Q.value = 1.1;
  riserGain = ctx.createGain();
  riserGain.gain.value = 0;
  noise.connect(riserFilter);
  riserFilter.connect(riserGain);
  riserGain.connect(master);
  noise.start();
}

function makeScoreImpulse(ctx: BaseAudioContext): AudioBuffer {
  const buffer = makeNoiseBuffer(ctx, SCORE_REVERB_SECONDS, SCORE_REVERB_SEED);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] *= Math.pow(1 - i / data.length, SCORE_REVERB_DECAY);
  }
  return buffer;
}

/**
 * Start/stop companions for one scheduled note. Chip and authored timbres are
 * parallel one-shots with fixed complementary gains captured at note onset;
 * no sounding oscillator ever has its waveform mutated at an era boundary.
 */
function createEraLayeredOscillators(
  ctx: BaseAudioContext,
  frequencyHz: number,
  authoredWave: Wave,
  era: number,
  destination: AudioNode
): OscillatorNode[] {
  const mix = resolveScoreEraTimbreMix(era);
  const layers: Array<{ wave: Wave; level: number }> = authoredWave === 'square'
    ? [{ wave: 'square', level: mix.chip + mix.rich }]
    : [
        { wave: 'square', level: mix.chip },
        { wave: authoredWave, level: mix.rich }
      ];
  const oscillators: OscillatorNode[] = [];
  for (const layer of layers) {
    if (layer.level <= 0) continue;
    const osc = ctx.createOscillator();
    osc.type = layer.wave;
    osc.frequency.value = frequencyHz;
    const timbreGain = ctx.createGain();
    timbreGain.gain.value = layer.level;
    osc.connect(timbreGain);
    timbreGain.connect(destination);
    oscillators.push(osc);
  }
  return oscillators;
}

/** Bare's pulse drone yields while its lone ostinato/arp note speaks. */
function scheduleChipDroneYield(at: number, releaseAt: number, era: number): void {
  const mix = resolveScoreEraTimbreMix(era);
  const duckTarget = Math.max(CHIP_MONO_DUCK, mix.color);
  for (const voice of padVoices) {
    rampParamAt(voice.chipDuckGain.gain, duckTarget, at, SCORE_OST_NOTE_ATTACK_S);
    rampParamAt(
      voice.chipDuckGain.gain,
      SCORE_NOTE_TIMBRE_FULL_LEVEL,
      releaseAt,
      SCORE_CHIP_MONO_DUCK_RELEASE_S
    );
  }
}

// --- the lookahead scheduler (ostinato notes + smoothed control rails) ------------------

function startScheduler(): void {
  if (schedulerTimer != null) return;
  schedulerTimer = window.setInterval(() => {
    const ctx = getAudioContext();
    if (!ctx || !mood) return;
    stepScoreScheduler(ctx, ctx.currentTime);
  }, 60);
}

/**
 * One lookahead pass — the clock-agnostic scheduling core, shared verbatim by
 * the live 60 ms interval and the offline suspend/resume drive (P4).
 */
function stepScoreScheduler(ctx: BaseAudioContext, now: number): void {
  if (!mood) return;
  // The generative bed owns the sandbox: while it leads and no story mood
  // is set, this engine's idle voice schedules and updates nothing. The
  // complementary authority ramp was already scheduled at the handoff, so
  // skipping hidden pad/sub/convolver rails cannot disturb that crossfade.
  if (idle && bedLead) return;
  applyRails(ctx, now);
  const era = getMusicPrimitives().era;
  const eraMix = resolveScoreEraTimbreMix(era);
  const channelBudget = resolveScoreEraChannelBudget(era);
  const ostinatoTiming = resolveScoreOstinatoTiming(era);
  const ostinatoOwnsEarlyLead = mood.ost > 0 && mood.pattern.some((note) => note != null);
  const melodyPresence = Math.max(eraMix.color, eraMix.rich);
  const melodyMaySpeak = melodyPresence > 0 && (
    !ostinatoOwnsEarlyLead || channelBudget.melodyMayOverlapOstinato
  );
  const stepSeconds = 60 / mood.tempo / 2; // 8th notes
  while (nextNoteAt < now + 0.18) {
    if (nextNoteAt < now) nextNoteAt = now;

    // Harmonic motion: the progression turns every two bars; pad/sub glide
    // to the new chord and the ostinato transposes with its root.
    if (mood.progression && patternStep % STEPS_PER_CHORD === 0) {
      chordIndex = Math.floor(patternStep / STEPS_PER_CHORD) % mood.progression.length;
      currentChord = mood.progression[chordIndex];
      retuneVoices(ctx, now);
    }
    const chordRoot = currentChord[0] ?? 0;

    const semis = mood.pattern[patternStep % mood.pattern.length];
    // Humanize: soft velocity drift + the occasional dropped note when calm.
    const dropped = intensity < 0.45 && scoreUnit(SALT_SCORE_DROP, patternStep) < 0.08;
    if (!offlineSuppressScoreTransients && semis != null && !dropped && ostFilter) {
      const velocity = 0.78 + scoreUnit(SALT_SCORE_VELOCITY, patternStep) * 0.22;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, nextNoteAt);
      env.gain.linearRampToValueAtTime(velocity, nextNoteAt + SCORE_OST_NOTE_ATTACK_S);
      const releaseAt = nextNoteAt + stepSeconds * ostinatoTiming.releaseStepScale;
      env.gain.exponentialRampToValueAtTime(SCORE_OST_ENVELOPE_FLOOR, releaseAt);
      const oscillators = createEraLayeredOscillators(
        ctx,
        hzForSemis(chordRoot + semis, mood.octave),
        mood.wave,
        era,
        env
      );
      env.connect(ostFilter);
      for (const osc of oscillators) {
        osc.start(nextNoteAt);
        osc.stop(nextNoteAt + stepSeconds * ostinatoTiming.stopStepScale);
      }
      if (eraMix.chip > 0) scheduleChipDroneYield(nextNoteAt, releaseAt, era);
    }

    // The lead: every four bars, maybe a phrase. With a planet genome and a
    // story mood leading, the mood's scale FILTERS the planet's tune (§10.5,
    // seeded — reproducible); the legacy random walk survives as the fallback.
    if (
      !offlineSuppressScoreTransients &&
      mood.melody &&
      melodyMaySpeak &&
      patternStep % STEPS_PER_PHRASE_SLOT === 0
    ) {
      const phraseSlot = Math.floor(patternStep / STEPS_PER_PHRASE_SLOT);
      if (planetGenome && !idle) {
        if (musicUnit(planetGenomeSeed, SALT_MOOD_PHRASE, phraseSlot) < mood.melody.density) {
          scheduleGenomePhrase(ctx, nextNoteAt, stepSeconds, phraseSlot, era, melodyPresence);
        }
      } else if (scoreUnit(SALT_SCORE_PHRASE_GATE, phraseSlot) < mood.melody.density) {
        schedulePhrase(ctx, nextNoteAt, stepSeconds, phraseSlot, era, melodyPresence);
      }
    }

    patternStep++;
    nextNoteAt += stepSeconds;
  }
}

/**
 * The planet's tune through the mood's scale (P5, §10.5): a developed motif
 * figure rendered on the mood-scale lattice, scheduled through the same
 * melody bus and register as the shipped walk. Fully seeded — the same beat
 * on the same planet replays note-for-note.
 */
function scheduleGenomePhrase(
  ctx: BaseAudioContext,
  startAt: number,
  stepSeconds: number,
  phraseSlot: number,
  era: number,
  presence: number
): void {
  if (!planetGenome || !mood?.melody || !melodyFilter) return;
  const prim = getMusicPrimitives();
  const chordRoot = currentChord[0] ?? 0;
  const notes = planMoodPhrase(
    planetGenome,
    { scale: mood.melody.scale, chordRoot, wonder: prim.wonder },
    planetGenomeSeed,
    phraseSlot
  );
  const slotSec = stepSeconds / 2; // figure slots are 16ths; the step grid is 8ths
  for (const note of notes) {
    const at = startAt + note.slot * slotSec;
    const dur = Math.max(slotSec, note.durationSlots * slotSec);
    const gain = (0.05 + 0.05 * intensity) * note.velocity * presence;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + MELODY_ATTACK_S);
    env.gain.setValueAtTime(gain, at + Math.max(MELODY_ATTACK_S, dur * 0.6));
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, MELODY_ATTACK_S));
    const oscillators = createEraLayeredOscillators(
      ctx,
      hzForSemis(note.semis, 36),
      'triangle',
      era,
      env
    );
    env.connect(melodyFilter);
    for (const osc of oscillators) {
      osc.start(at);
      osc.stop(at + dur + 0.1);
    }
  }
}

/** A 5–8 note phrase: mostly stepwise, breathing rhythm, through the delay bus. */
function schedulePhrase(
  ctx: BaseAudioContext,
  startAt: number,
  stepSeconds: number,
  phraseSlot: number,
  era: number,
  presence: number
): void {
  if (!mood?.melody || !melodyFilter) return;
  const scale = mood.melody.scale;
  const chordRoot = currentChord[0] ?? 0;
  const noteCount = 5 + Math.floor(scoreUnit(SALT_SCORE_PHRASE_LENGTH, phraseSlot) * 4);
  let at = startAt;
  for (let i = 0; i < noteCount; i++) {
    // Random walk: mostly ±1 degree, occasional leap, gravity toward mid-scale.
    const saltIndex = phraseSlot * 16 + i;
    const leap = scoreUnit(SALT_SCORE_PHRASE_LEAP, saltIndex) < 0.2;
    const direction = scoreUnit(SALT_SCORE_PHRASE_DIRECTION, saltIndex) < 0.5 ? -1 : 1;
    const drift = direction * (leap ? 2 : 1);
    melodyDegree = Math.max(0, Math.min(scale.length - 1, melodyDegree + drift + (melodyDegree > scale.length - 2 ? -1 : 0)));
    const durSteps = [2, 2, 3, 4][Math.floor(scoreUnit(SALT_SCORE_PHRASE_DURATION, saltIndex) * 4)];
    const dur = durSteps * stepSeconds;
    const gain =
      (0.05 + 0.05 * intensity) *
      (0.8 + scoreUnit(SALT_SCORE_PHRASE_GAIN, saltIndex) * 0.2) *
      presence;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + MELODY_ATTACK_S);
    env.gain.setValueAtTime(gain, at + Math.max(MELODY_ATTACK_S, dur * 0.6));
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, MELODY_ATTACK_S));
    const oscillators = createEraLayeredOscillators(
      ctx,
      hzForSemis(chordRoot + scale[melodyDegree], 36),
      'triangle',
      era,
      env
    );
    env.connect(melodyFilter);
    for (const osc of oscillators) {
      osc.start(at);
      osc.stop(at + dur + 0.1);
    }
    at += dur;
    // Breathe: occasional rest between notes.
    if (scoreUnit(SALT_SCORE_PHRASE_REST, saltIndex) < 0.25) at += stepSeconds;
  }
}

/** Smooth the mood/intensity-dependent parameters toward their targets. */
function applyRails(_ctx: BaseAudioContext, now: number): void {
  if (!master) return;
  const prim = getMusicPrimitives();
  // Volume and mute live on the shared music bus (audioCore); the score master
  // carries only the score's own place in the mix.
  const on = mood != null && !(idle && bedLead);
  // The idle bed sits UNDER the streamed music, lifted by the wonder axis.
  const idleScale = idle ? 0.32 * (0.5 + 0.7 * prim.wonder) : 1;
  if (idle && !bedLead) {
    master.gain.setTargetAtTime(
      on ? SCORE_MASTER_LEVEL * idleScale : 0,
      now,
      SCORE_MASTER_IDLE_TAU_S
    );
  } else if (now >= authorityFadeUntil) {
    // Story/bed handoffs use one shared, complementary start-anchored crossfade. Once
    // that scheduled ramp has landed, this target only holds the endpoint.
    master.gain.setTargetAtTime(on ? SCORE_MASTER_LEVEL : 0, now, SCORE_MASTER_STEADY_TAU_S);
  }
  if (!mood) return;
  if (idle) intensity = 0.2 + 0.5 * prim.wonder; // the sky sets the idle breath
  const boost = 0.55 + 0.45 * intensity;
  const material = eraFade(prim.era, ERA_MATERIAL);
  const alive = eraFade(prim.era, ERA_ALIVE);
  const subLayers = resolveScoreSubLayerGains(prim.era, prim.warmth);
  padGain?.gain.setTargetAtTime(mood.pad * boost, now, SCORE_PAD_BUS_SLEW_S);
  subGain?.gain.setTargetAtTime(mood.sub * boost, now, SCORE_SUB_BUS_SLEW_S);
  subRichGain?.gain.setTargetAtTime(
    subLayers.rich,
    now,
    SCORE_SUB_TIMBRE_SLEW_S
  );
  subChipGain?.gain.setTargetAtTime(
    subLayers.chip,
    now,
    SCORE_SUB_TIMBRE_SLEW_S
  );
  subHarmonicGain?.gain.setTargetAtTime(
    subLayers.harmonic,
    now,
    SCORE_SUB_HARMONIC_SLEW_S
  );
  const richness =
    SCORE_RICH_MATERIAL_WEIGHT * material + SCORE_RICH_ALIVE_WEIGHT * alive;
  const width = SCORE_PAD_WIDTH_MAX * richness;
  padVoices.forEach((voice, index) => {
    const layers = resolveScorePadLayerGains(voice.active, prim.era, prim.warmth, index);
    voice.pan.pan.setTargetAtTime(
      ((index / Math.max(1, padVoices.length - 1)) * 2 - 1) * width,
      now,
      SCORE_PAD_WIDTH_SLEW_S
    );
    voice.gain.gain.setTargetAtTime(layers.rich, now, SCORE_PAD_VOICE_SLEW_S);
    voice.chipGain.gain.setTargetAtTime(layers.chip, now, SCORE_PAD_VOICE_SLEW_S);
    voice.organGain.gain.setTargetAtTime(layers.organ, now, SCORE_ORGAN_SLEW_S);
  });
  scoreReverbWet?.gain.setTargetAtTime(
    SCORE_REVERB_WET_MAX *
      richness *
      (SCORE_REVERB_WONDER_FLOOR + SCORE_REVERB_WONDER_LIFT * prim.wonder),
    now,
    SCORE_REVERB_SLEW_S
  );
  ostGain?.gain.setTargetAtTime(
    mood.ost * (0.35 + 0.65 * intensity),
    now,
    SCORE_OST_GAIN_SLEW_S
  );
  // Warmth opens the pad; tension (via intensity) opens everything else.
  padFilter?.frequency.setTargetAtTime(
    320 + intensity * 2100 + prim.warmth * 500,
    now,
    SCORE_PAD_FILTER_SLEW_S
  );
  ostFilter?.frequency.setTargetAtTime(
    700 + intensity * 2600,
    now,
    SCORE_OST_FILTER_SLEW_S
  );
  riserGain?.gain.setTargetAtTime(
    mood.riser * intensity * intensity,
    now,
    SCORE_RISER_GAIN_SLEW_S
  );
  riserFilter?.frequency.setTargetAtTime(
    220 + intensity * 1900,
    now,
    SCORE_RISER_FILTER_SLEW_S
  );
}

function retuneVoices(_ctx: BaseAudioContext, now: number): void {
  if (!mood) return;
  const padStates = resolveScorePadVoiceStates(currentChord, padVoices.length);
  padVoices.forEach((voice, index) => {
    const state = padStates[index];
    voice.active = state.active;
    voice.activeGain.gain.setTargetAtTime(
      resolveScorePadMembershipGain(state.active),
      now,
      SCORE_PAD_MEMBERSHIP_SLEW_S
    );
    if (!state.active || state.semis == null) {
      // Every layer receives an explicit zero target. In particular, an organ
      // voice that outlived a four-tone chord can never leak its stale pitch
      // into a later triad.
      voice.gain.gain.setTargetAtTime(0, now, SCORE_PAD_VOICE_SLEW_S);
      voice.chipGain.gain.setTargetAtTime(0, now, SCORE_PAD_VOICE_SLEW_S);
      voice.organGain.gain.setTargetAtTime(0, now, SCORE_ORGAN_SLEW_S);
      return;
    }
    const hz = hzForSemis(state.semis, HIT_SEMITONES_PER_OCTAVE);
    voice.oscA.frequency.setTargetAtTime(hz, now, SCORE_PAD_RETUNE_S);
    voice.oscB.frequency.setTargetAtTime(hz, now, SCORE_PAD_RETUNE_S);
    voice.chip.frequency.setTargetAtTime(hz, now, SCORE_PAD_RETUNE_S);
    voice.organ.frequency.setTargetAtTime(hz, now, SCORE_PAD_RETUNE_S);
  });
  const subHz = hzForSemis(currentChord[0] ?? 0, 0);
  subOsc?.frequency.setTargetAtTime(subHz, now, SCORE_SUB_RETUNE_S);
  subChipOsc?.frequency.setTargetAtTime(subHz, now, SCORE_SUB_RETUNE_S);
  subHarmonicOsc?.frequency.setTargetAtTime(
    subHz * SCORE_SUB_HARMONIC_RATIO,
    now,
    SCORE_SUB_RETUNE_S
  );
  // The lead's echo keeps time with the mood (dotted 8th).
  melodyDelay?.delayTime.setTargetAtTime(
    (60 / mood.tempo) * 0.75,
    now,
    SCORE_MELODY_DELAY_SLEW_S
  );
  // Publish the harmonic center — every other voice in the game reads this.
  // ONE harmonic truth: while the generative bed leads the sandbox, ITS
  // harmony brain is the sole publisher and the idle voice stays quiet.
  if (!(idle && bedLead)) setMusicChord(currentChord[0] ?? 0, currentChord);
}

// --- public API -------------------------------------------------------------------------

export function unlockScore(): void {
  ensureScore();
  unlockAudio();
}

/**
 * P3: the generative bed announces itself as the sandbox floor. While true
 * and no story mood leads, the celestial idle voice yields (silent, no chord
 * publishing) — the bed IS the idle bed now. Story moods are unaffected.
 */
export function setGenerativeBedLead(lead: boolean): void {
  const changed = bedLead !== lead;
  bedLead = lead;
  if (changed && !lead) clearScheduledBedHits();
  if (changed && idle && master) {
    const context = activeScoreContext;
    if (context) scheduleStoryAuthority(false, context.currentTime);
  }
}

/** True while a story mood (not the idle/generative floor) leads the score. */
export function isScoreMoodLeading(): boolean {
  return !idle;
}

/**
 * P5 (§10.5): the generative bed pushes the planet's motif genome here. While
 * a story mood leads, its `melody.scale` filters this genome instead of
 * feeding the legacy random walk — the planet's tune haunts the story beats.
 * Additive; passing null restores the shipped walk.
 */
export function setScorePlanetGenome(genome: MotifGenome | null, planetSeed = 0): void {
  planetGenome = genome;
  planetGenomeSeed = planetSeed;
}

/**
 * The generative bed registers its transport's quantizer so grid-synced hits
 * land on the SANDBOX grid while the bed leads (one clock, §8.1).
 */
export function registerBedQuantizer(fn: ((quantize: HitQuantize) => number | null) | null): void {
  bedQuantizer = fn;
  if (!fn) {
    bedHitOnsetResolver = null;
    clearScheduledBedHits();
  }
}

/** Resolve a hit inside an already-planned bed bar without waiting a scheduler tick. */
export function registerBedHitOnsetResolver(
  fn: ((time: number) => BedHitOnsetState | null) | null
): void {
  bedHitOnsetResolver = fn;
}

/** Clear bed-owned future punctuation at graph/authority boundaries. */
export function clearScheduledBedHits(): void {
  scheduledBedHits = [];
}

/**
 * Flush queued bed hits whose onsets belong to `[barStart, barEnd)`. The bed
 * calls this only after that bar's harmony has been planned/published, so both
 * pitch and era palette are captured from the actual onset state rather than
 * from the earlier public `scheduleHit` request.
 */
export function flushScheduledBedHits(
  barStart: number,
  barEnd: number,
  published: { root: number; tones: readonly number[] },
  era: number,
  stage?: VoxelRealityStage
): number {
  const { due, future } = partitionScheduledBedHits(scheduledBedHits, barStart, barEnd);
  scheduledBedHits = future;
  if (!activeScoreContext || !hitBus || due.length === 0) return 0;
  const renderPlan = resolveScoreHitRenderPlan(
    { root: published.root, chord: published.tones },
    era,
    stage
  );
  for (const event of due) {
    renderHitInto(activeScoreContext, hitBus, event.kind, event.time, renderPlan);
  }
  return due.length;
}

/**
 * Bed-engine hook for the shared story-authority crossfade. Additive: the
 * frozen score/story APIs do not change, but both engines now move on the same
 * audio timestamp and duration instead of racing independent scheduler fades.
 */
export function registerStoryAuthorityCrossfade(fn: StoryAuthorityCrossfade | null): void {
  storyAuthorityCrossfade = fn;
}

function scheduleStoryAuthority(storyLeads: boolean, atTime: number): void {
  if (master) {
    rampParamAt(
      master.gain,
      storyLeads ? SCORE_MASTER_LEVEL : 0,
      atTime,
      STORY_AUTHORITY_CROSSFADE_S
    );
  }
  authorityFadeUntil = atTime + STORY_AUTHORITY_CROSSFADE_S;
  storyAuthorityCrossfade?.(storyLeads, atTime, STORY_AUTHORITY_CROSSFADE_S);
}

/**
 * Retune the whole instrument to a mood. `null` hands the instrument to the
 * CELESTIAL IDLE BED — the score never leaves, it recedes.
 */
export function setScoreMood(next: ScoreMood | null): void {
  const storyWasLeading = !idle;
  idle = next == null;
  mood = next ?? IDLE_MOOD;
  intensity = mood.baseline;
  patternStep = 0;
  chordIndex = 0;
  currentChord = mood.progression?.[0] ?? mood.chord;
  melodyDegree = 4;
  const ctx = built ? activeScoreContext : null;
  if (ctx) {
    // When the generative bed resumes, keep the outgoing story harmony stable
    // through its fade. Retuning full-level voices to the idle chord caused the
    // owner's return jump; the next story entrance retunes while master is zero.
    if (!idle || !bedLead) retuneVoices(ctx, ctx.currentTime);
    if (storyWasLeading !== !idle) scheduleStoryAuthority(!idle, ctx.currentTime);
  }
  // Publish the drama rails while a mood leads.
  if (!idle) setMusicPrimitiveTargets({ tension: mood.baseline, energy: Math.min(1, mood.tempo / 130) });
}

/** Timeline hook: the story director drives this with its OWN ramp values. */
export function setScoreIntensity(value: number): void {
  intensity = Math.min(1, Math.max(0, value));
  if (!idle) setMusicPrimitiveTargets({ tension: intensity, energy: intensity * 0.85 });
}

/**
 * One-shot punctuation.
 *   braam — the Zimmer horn (stacked saws, slow bite, long tail)
 *   bloom — a major chord opening (the color/texture arrivals)
 *   boom  — sub impact (the pod hitting the ground)
 */
export function scoreHit(kind: 'braam' | 'bloom' | 'boom'): void {
  const context = ensureScore();
  if (!context || !master || isMusicMuted()) return;
  renderHit(
    context,
    kind,
    context.currentTime,
    resolveLegacyScoreHitRenderPlan(getMusicChord())
  );
}

/**
 * Grid-synced punctuation (P2, §8.1): schedule a hit ON the musical grid and
 * return the exact audio time it will land, so VISUALS can chase AUDIO — a
 * drop that lands off-grid is a defect. Additive API; `scoreHit` stays for
 * legacy reflex moments. Returns null when the score cannot sound (no
 * context / muted). Quantization rides the shipped scheduler's step grid
 * ('phrase' = PHRASE_BARS bars); P3 migrates it onto the generative
 * transport when that clock takes over.
 */
export function scheduleHit(kind: 'braam' | 'bloom' | 'boom', quantize: HitQuantize): number | null {
  const context = ensureScore();
  if (!context || !master || isMusicMuted() || !mood) return null;
  // While the generative bed leads the sandbox, ITS transport owns the grid.
  if (idle && bedLead && bedQuantizer) {
    const time = bedQuantizer(quantize);
    if (time != null) {
      const onset = bedHitOnsetResolver?.(time);
      if (onset) {
        renderHit(
          context,
          kind,
          time,
          resolveScoreHitRenderPlan(
            { root: onset.published.root, chord: onset.published.tones },
            onset.era,
            onset.stage
          )
        );
        return time;
      }
      // The bed may change harmony/era before this future quantum. Queue only
      // timing here; bedEngine flushes it after publishing the owning bar's
      // explicit onset harmony and stage palette.
      scheduledBedHits.push({ kind, time });
      return time;
    }
    return null;
  }
  const stepSeconds = 60 / mood.tempo / 2; // 8th notes, matching the scheduler
  const stepsPerUnit =
    quantize === 'beat' ? STEPS_PER_BEAT :
    quantize === 'bar' ? STEPS_PER_BAR :
    STEPS_PER_BAR * PHRASE_BARS;
  const notBefore = context.currentTime + HIT_MIN_LEAD_S;
  // The scheduler clamps a stale nextNoteAt to currentTime before scheduling
  // step `patternStep` — mirror that so our grid matches the audible one. A
  // never-started grid (nextNoteAt 0) anchors at the lead horizon.
  const base = nextNoteAt > 0 ? Math.max(nextNoteAt, context.currentTime) : notBefore;
  const { step, time } = nextGridStep(patternStep, base, stepSeconds, stepsPerUnit, notBefore);
  // A bar/phrase quantum can also be a two-bar progression boundary. Capture
  // the chord that the scheduler will publish BEFORE that onset, not the chord
  // that happened to be live when this lookahead request was made.
  const onsetPlan = resolveScheduledScoreHitRenderPlan(
    mood,
    step,
    getMusicPrimitives().era
  );
  renderHit(context, kind, time, onsetPlan);
  return time;
}

function renderHit(
  context: BaseAudioContext,
  kind: 'braam' | 'bloom' | 'boom',
  now: number,
  renderPlan?: ScoreHitRenderPlan
): void {
  // Hits ride a fixed-gain bus so grid punctuation (blooms/booms the bed
  // schedules) still sounds while the idle voice yields to the bed.
  if (!hitBus) return;
  renderHitInto(context, hitBus, kind, now, renderPlan);
}

/**
 * Render one hit into an arbitrary destination on an arbitrary context — the
 * shared hit vocabulary, reusable by the P4 offline harness (bed excerpts
 * route their warp booms / landing blooms / stage-transition blooms here).
 */
export function renderHitInto(
  context: BaseAudioContext,
  dest: AudioNode,
  kind: 'braam' | 'bloom' | 'boom',
  now: number,
  scheduledRenderPlan = resolveScoreHitRenderPlan(
    getMusicChord(),
    getMusicPrimitives().era
  )
): void {
  const out = context.createGain();
  out.connect(dest);
  const { pitch: pitchPlan, palette } = scheduledRenderPlan;

  const tone = (
    startSemis: number,
    octave: number,
    type: Wave,
    gain: number,
    attack: number,
    hold: number,
    release: number,
    endSemis = startSemis
  ) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hzForSemis(startSemis, octave), now);
    if (endSemis !== startSemis) {
      osc.frequency.exponentialRampToValueAtTime(
        hzForSemis(endSemis, octave),
        now + attack + hold
      );
    }
    const env = context.createGain();
    env.gain.setValueAtTime(HIT_ENVELOPE_FLOOR, now);
    env.gain.exponentialRampToValueAtTime(
      Math.max(HIT_MIN_AUDIBLE_GAIN, gain),
      now + attack
    );
    env.gain.setValueAtTime(
      Math.max(HIT_MIN_AUDIBLE_GAIN, gain),
      now + attack + hold
    );
    env.gain.exponentialRampToValueAtTime(
      HIT_ENVELOPE_FLOOR,
      now + attack + hold + release
    );
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + attack + hold + release + HIT_NODE_STOP_TAIL_S);
  };

  const noiseAccent = () => {
    const source = context.createBufferSource();
    source.buffer = makeNoiseBuffer(context, HIT_PSG_NOISE_SECONDS, HIT_PSG_NOISE_SEED);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = HIT_PSG_NOISE_FILTER_HZ;
    filter.Q.value = HIT_PSG_NOISE_FILTER_Q;
    const env = context.createGain();
    env.gain.setValueAtTime(HIT_ENVELOPE_FLOOR, now);
    env.gain.exponentialRampToValueAtTime(
      HIT_PSG_NOISE_GAIN,
      now + HIT_PSG_NOISE_ATTACK_S
    );
    env.gain.setValueAtTime(
      HIT_PSG_NOISE_GAIN,
      now + HIT_PSG_NOISE_ATTACK_S + HIT_PSG_NOISE_HOLD_S
    );
    env.gain.exponentialRampToValueAtTime(
      HIT_ENVELOPE_FLOOR,
      now + HIT_PSG_NOISE_ATTACK_S + HIT_PSG_NOISE_HOLD_S + HIT_PSG_NOISE_RELEASE_S
    );
    source.connect(filter);
    filter.connect(env);
    env.connect(out);
    source.start(now);
    source.stop(now + HIT_PSG_NOISE_SECONDS);
  };

  if (palette.noiseAccent) noiseAccent();

  if (kind === 'braam') {
    if (!palette.braamEnabled) {
      for (const semis of pitchPlan.bloomSemis.slice(0, palette.upperVoiceCap)) {
        tone(
          semis,
          HIT_UNISON_INTERVAL,
          palette.upperWave,
          HIT_EARLY_ACCENT_GAIN,
          HIT_EARLY_ACCENT_ATTACK_S,
          HIT_EARLY_ACCENT_HOLD_S,
          HIT_EARLY_ACCENT_RELEASE_S
        );
      }
      return;
    }
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
    filter.frequency.exponentialRampToValueAtTime(400, now + 2.8);
    out.disconnect();
    out.connect(filter);
    filter.connect(dest);
    tone(pitchPlan.rootSemis, 0, 'sawtooth', 0.16, 0.35, 0.5, 2.2);
    tone(
      pitchPlan.rootSemis,
      -HIT_SEMITONES_PER_OCTAVE,
      'sawtooth',
      0.14,
      0.35,
      0.5,
      2.2
    );
    tone(pitchPlan.accentSemis, 0, 'sawtooth', 0.09, 0.4, 0.5, 2.0);
  } else if (kind === 'bloom') {
    for (const [i, semis] of pitchPlan.bloomSemis
      .slice(0, palette.upperVoiceCap)
      .entries()) {
      tone(
        semis,
        HIT_UNISON_INTERVAL,
        palette.upperWave,
        0.07 - i * 0.01,
        BLOOM_ATTACK_BASE_S + i * BLOOM_ATTACK_STAGGER_S,
        BLOOM_TONE_HOLD_S,
        BLOOM_TONE_RELEASE_S
      );
    }
    if (pitchPlan.bloomBassSemis != null && palette.bassWave) {
      tone(
        pitchPlan.bloomBassSemis,
        HIT_UNISON_INTERVAL,
        palette.bassWave,
        BLOOM_SUB_GAIN,
        BLOOM_SUB_ATTACK_S,
        BLOOM_SUB_HOLD_S,
        BLOOM_SUB_RELEASE_S
      );
    }
  } else {
    // Both endpoints of both pitch falls are published harmony: the body falls
    // from the nearest fifth-like chord tone into the root; the air falls from
    // the root's octave into that same legal chord tone.
    if (palette.boomBodyWave) {
      tone(
        pitchPlan.boomBody.startSemis,
        palette.boomOctaveShift,
        palette.boomBodyWave,
        BOOM_BODY_GAIN,
        BOOM_BODY_ATTACK_S,
        BOOM_BODY_HOLD_S,
        BOOM_BODY_RELEASE_S,
        pitchPlan.boomBody.endSemis
      );
    }
    if (palette.boomAirWave) {
      tone(
        pitchPlan.boomAir.startSemis,
        palette.boomOctaveShift,
        palette.boomAirWave,
        BOOM_AIR_GAIN,
        BOOM_AIR_ATTACK_S,
        BOOM_AIR_HOLD_S,
        BOOM_AIR_RELEASE_S,
        pitchPlan.boomAir.endSemis
      );
    }
  }
}

// --- Offline render rim (P4 verification harness) -----------------------------------------------
//
// The audition harness plays a STORY MOOD through the shipped instrument on an
// OfflineAudioContext: same graph builder, same lookahead core, stepped through
// suspend/resume checkpoints. Guarded so it can never run while the live
// instrument exists. Set the mood (setScoreBeat/setScoreMood) BEFORE begin.

/** Begin an offline mood render: build the instrument on `ctx` into `out`. */
export interface OfflineScoreRenderOptions {
  /** Persistent-control audit: keep real mood rails/chords but omit note envelopes. */
  suppressTransientVoices?: boolean;
}

export function beginOfflineScoreRender(
  ctx: BaseAudioContext,
  out: AudioNode,
  options: OfflineScoreRenderOptions = {}
): void {
  if (built || schedulerTimer != null) {
    throw new Error('scoreEngine is live — offline rendering requires a fresh page');
  }
  built = true;
  clearScheduledBedHits();
  offlineSuppressScoreTransients = options.suppressTransientVoices ?? false;
  buildScoreGraph(ctx, out);
  nextNoteAt = 0;
  patternStep = 0;
  chordIndex = 0;
  currentChord = mood?.progression?.[0] ?? mood?.chord ?? [0];
  retuneVoices(ctx, 0);
}

/** One offline checkpoint of the shipped lookahead core. */
export function stepOfflineScoreRender(ctx: BaseAudioContext, now: number): void {
  stepScoreScheduler(ctx, now);
}

/** Render a hit through the instrument's own hit bus at an absolute time. */
export function renderHitOfflineAt(
  ctx: BaseAudioContext,
  kind: ScoreHitKind,
  at: number,
  onsetPlan?: ScoreHitRenderPlan
): void {
  if (hitBus) renderHitInto(ctx, hitBus, kind, at, onsetPlan);
}

/** Tear down offline module state so a later render (or the live game) starts clean. */
export function endOfflineScoreRender(): void {
  built = false;
  clearScheduledBedHits();
  offlineSuppressScoreTransients = false;
  activeScoreContext = null;
  master = null;
  padGain = null;
  padFilter = null;
  subGain = null;
  subOsc = null;
  subRichGain = null;
  subChipOsc = null;
  subChipGain = null;
  subHarmonicOsc = null;
  subHarmonicGain = null;
  ostGain = null;
  ostFilter = null;
  riserGain = null;
  riserFilter = null;
  padVoices = [];
  melodyGain = null;
  melodyFilter = null;
  melodyDelay = null;
  scoreReverbWet = null;
  hitBus = null;
  nextNoteAt = 0;
  patternStep = 0;
  chordIndex = 0;
  melodyDegree = 4;
  authorityFadeUntil = 0;
}
