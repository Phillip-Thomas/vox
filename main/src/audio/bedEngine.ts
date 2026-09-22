import type { ArchetypeId } from '../game/data/planetArchetypes.ts';
import { getMusicBus, makeImpulseBuffer, makeNoiseBuffer, peekAudioContext, rampParamAt } from './audioCore.ts';
import { resolveBedQualityTier, tanhDriveCurve, type BedQualityTier } from './generative/timbre.ts';
import { seededUnit } from '../utils/worldCoordinates.ts';
import { setMusicChord } from './musicPrimitives.ts';
import {
  isScoreMoodLeading,
  flushScheduledBedHits,
  registerBedHitOnsetResolver,
  registerBedTonicResolver,
  registerBedTonicHandback,
  registerStoryAuthorityCrossfade,
  registerBedQuantizer,
  registerBedHitQuantumResolver,
  scheduleHit,
  setGenerativeBedLead,
  setScorePlanetGenome,
  STORY_AUTHORITY_CROSSFADE_S
} from './scoreEngine.ts';
import {
  createBedConductor,
  noteStoryHandBack,
  planBedBar,
  type BedBarPlan,
  type BedConductorState,
  type CreateBedOptions
} from './generative/bedConductor.ts';
import { neutralBedSignals, type BedSignals } from './generative/worldSignals.ts';
import { pulseBodyHz } from './generative/pulse.ts';
import { retargetHarmonyKey } from './generative/harmonyBrain.ts';
import {
  advanceTransportBar,
  barDurationSec,
  createTransport,
  nextQuantumTime,
  requestTransportMeter,
  requestTransportTempo,
  resolveTransportHitQuantum,
  type HitQuantize,
  type TransportState
} from './generative/transport.ts';
import { humanizeOffsetMs, SLOTS_PER_BAR } from './generative/rhythm.ts';
import { musicUnit, SALT_PERC_PAN } from './generative/seededMusic.ts';
import {
  BED_LEAD_LEVEL,
  BED_MASTER_GAIN,
  BED_OST_LEVEL,
  BED_PAD_LEVEL,
  BED_PERC_LEVEL,
  BED_RESUME_FADE_S,
  BED_RISER_LEVEL,
  BED_SCENE_POLICY,
  BED_SHIMMER_LEVEL,
  BED_SUB_LEVEL,
  BED_TICK_LEVEL,
  BED_ALIVE_LIFT,
  BED_ALIVE_LIFT_SLEW_S,
  BED_LEAN_BALANCE_DB,
  BED_NIGHT_TRIM_DAYLIGHT_ONSET,
  BED_NIGHT_TRIM_DB,
  BED_WASH_LEVEL,
  BED_XOVER_HZ,
  BED_YIELD_FADE_S,
  CHIP_HARMONY_LEVEL,
  DRIVE_LEAD_K,
  DRIVE_LEAD_WET,
  DRIVE_PAD_K,
  DRIVE_PAD_PRE_DB,
  DRIVE_PAD_WET_ALIVE,
  DRIVE_SUB_K,
  DRIVE_SUB_WET,
  DRIVE_THERMAL_WET_LIFT,
  DRIVE_WET_SLEW_S,
  CHIP_MONO_DUCK,
  CHIP_VIBRATO_CENTS,
  CHIP_VIBRATO_HZ,
  DRIFT_TEXTURE_SPAN,
  HIT_MIN_LEAD_S,
  PAD_DETUNE_CENTS_MAX,
  PAD_DETUNE_CENTS_MIN,
  PAD_BREATH_HZ,
  PAD_BREATH_LEVEL,
  PAD_BREATH_Q,
  PAD_BREATH_S,
  PAD_OCTAVE_LEVEL_DB,
  PAD_OCTAVE_SHIFT,
  PAD_UNISON_CENTS,
  PAD_UNISON_FULL,
  PAD_UNISON_LEAN,
  PAD_UNISON_PAN_SPREAD,
  PAD_VOICE_GAIN_SLEW_S,
  PAD_VOICE_LP_MIN_HZ,
  PAD_VOICE_LP_Q,
  PAD_VOICE_LP_SLEW_S,
  PAD_VOICE_LP_SPAN_HZ,
  PAD_VOICES_FULL,
  PAD_VOICES_LEAN,
  PAD_WANDER_DEPTH_HZ,
  PAD_WANDER_HZ_MAX,
  PAD_WANDER_HZ_MIN,
  PAD_WIDTH_MAX,
  PARADOX_TICK2_LEVEL,
  PHRASE_BARS,
  REVERB_DECAY,
  REVERB_EARLY_LEVEL,
  REVERB_EARLY_TAPS,
  REVERB_EARLY_WINDOW_MS,
  REVERB_HF_DAMP_HZ,
  REVERB_LATE_LEVEL,
  REVERB_LATE_ONSET_MS,
  REVERB_PREDELAY_MS,
  REVERB_SECONDS,
  REVERB_WET_MAX,
  SUB_DESIGN_SLEW_S,
  SUB_HP_HZ,
  SUB_LP_HZ,
  UNISON_PAN_SLEW_S,
  XOVER_BLEND_SLEW_S,
  SHIMMER_OCTAVE_SHIFT,
  SIDECHAIN_RELEASE_BEATS,
  SUB_OCTAVE_SHIFT,
  TICK_GLIDE_S,
  BED_PULSE_BODY_LEVEL,
  BED_PULSE_CLICK_LEVEL,
  BED_PULSE_TAIL_LEVEL,
  PULSE_BODY_DECAY_S,
  PULSE_BODY_HZ_FROM,
  PULSE_CLICK_HP_HZ,
  PULSE_CLICK_S,
  PULSE_TAIL_BP_HZ,
  PULSE_TAIL_S
} from './generative/tuning.ts';

// --- The generative bed engine (P3 rim) ------------------------------------------------------
//
// The thin WebAudio rim around the pure bed conductor: persistent voices,
// param automation, one lookahead scheduler on the shared context clock.
// EVERY musical decision comes from planBedBar (pure, seeded, tested); this
// file only converts plans into scheduled ramps and bounded-lifetime
// transients. rAF writes ONLY the signals snapshot (intent); nothing here is
// called per frame with node churn.
//
// Leadership: the bed is the sandbox foreground. While a story mood leads
// (frozen contract), the bed fades out, freezes its planner, and stops
// publishing the harmonic center — the mood plays the score engine exactly
// as shipped. When the mood ends the bed resumes where it left off.

// --- Rim-only synth constants (grouped; musical grammar lives in generative/tuning.ts) --------

const SCHEDULER_INTERVAL_MS = 60; // the shipped "Tale of Two Clocks" cadence
const LOOKAHEAD_S = 0.18;
/** Re-anchor the transport when it lags this many bars behind the clock (tab hides, story leads). */
const TRANSPORT_STALE_BARS = 1.5;
const PAD_GLIDE_TAU_S = 0.7;
/** Stage 1 rim: seeds/salts for the per-voice wander clocks and the breath noise. */
const PAD_WANDER_SEED = 0x7761_6e64;
const PAD_BREATH_NOISE_SEED = 0x6272_7468;
const PAD_BREATH_NOISE_BUFFER_S = 0.5;
const PAD_BREATH_ATTACK_S = 0.01;
const PAD_BREATH_STOP_TAIL_S = 0.03;
/** Crossover biquads at Q = 1/√2, cascaded twice per band = Linkwitz–Riley 4th order. */
const XOVER_Q = Math.SQRT1_2;
/** Bare/colour sanity: the Stage 1 wet/blend rails are gated by `padChoir` (material+). */
const STAGE1_GATE_EPSILON = 0.001;
const SUB_GLIDE_TAU_S = 0.25;
const CHIP_DRONE_LEVEL = 0.028;
const CHIP_DRONE_OCTAVE = 12;
const OST_FILTER_MIN_HZ = 700;
const OST_FILTER_SPAN_HZ = 2600;
const OST_ATTACK_S = 0.008;
const LEAD_FILTER_HZ = 2200;
const LEAD_ATTACK_S = 0.05;
const LEAD_DELAY_MIX = 0.4;
const LEAD_DELAY_FEEDBACK = 0.3;
/** Square chip leads carry more harmonic energy than triangles — trim to match. */
const CHIP_LEAD_TRIM = 0.7;
const SHIMMER_LFO_HZ = 0.13;
const SHIMMER_LFO_DEPTH = 0.4; // × base gain
const WASH_FILTER_MIN_HZ = 280;
const WASH_FILTER_SPAN_HZ = 520;
const WASH_GUST_LFO_DEPTH = 0.5; // × base gain
const WASH_GUST_LFO_BASE_HZ = 0.35;
const WASH_PAN_LFO_HZ = 0.05;
const PERC_FILTER_BASE_HZ = 2600;
const PERC_FILTER_METAL_LIFT_HZ = 3400;
const PERC_Q_BASE = 1.2;
const PERC_Q_METAL = 6;
const PERC_DECAY_S = 0.09;
const PERC_PAN_SPREAD = 0.6;
const RISER_FILTER_FROM_HZ = 220;
const RISER_FILTER_TO_HZ = 2300;
const RISER_CUT_S = 2;
const TICK_FREQ_WOOD_HZ = 1500;
const TICK_FREQ_METAL_HZ = 2900;
const TICK_PARTIAL_RATIO = 2.76; // inharmonic col-legno partial, scaled by `metal`
const TICK_DECAY_S = 0.055;
const TICK_BAR_FADE_FRAC = 0.4; // presence fades over whole bars (τ = frac × bar)
const MASTER_TAU_S = 1.2;
const BAR_PARAM_TAU_S = 0.5;
const REVERB_SEND_LEVEL = 0.5;
const PAD_INITIAL_ROOT_SEMIS = 12;
const PAD_INITIAL_VOICE_STEP_SEMIS = 4;
const SIDECHAIN_ATTACK_S = 0.045;
const SIDECHAIN_BYPASS_SLEW_S = 0.35;
const SUB_TIMBRE_CROSSFADE_S = 1.4;
const SUB_MOTIF_CROSSFADE_S = 1.8;
const SUB_MOTIF_CROSSFADE_START = 0.15;
const SUB_MOTIF_CROSSFADE_END = 0.75;
/**
 * Eight persistent voices cover the largest doubled four-note motif fragment.
 * A voice is only retuned after its previous envelope has reached true zero:
 * underwater legato may overlap consonant notes, but never pitch-mutate one.
 */
const SUB_MOTIF_VOICE_COUNT = 8;
const SUB_MOTIF_RETUNE_LEAD_S = 0.03;
const SUB_MOTIF_NOTE_ATTACK_S = 0.09;
const SUB_MOTIF_NOTE_RELEASE_S = 0.42;
const SUB_MOTIF_NOTE_HOLD_SCALE = 0.8;
const SUB_MOTIF_SECOND_HARMONIC_LEVEL = 0.3;
const SUB_MOTIF_THIRD_HARMONIC_LEVEL = 0.08;
const SUB_MOTIF_FUNDAMENTAL_LEVEL = 1;
const SUB_MOTIF_ACTIVE_EPSILON = 0.001;
const SUB_MOTIF_OCTAVE_SHIFT = -24;
const SUB_HARMONIC_LEVEL = 0.16;
const SUB_HARMONIC_RATIO = 2;
const SUB_THERMAL_HARMONIC_LIFT = 0.7;
const SUB_NIGHT_GAIN_LIFT = 0.28;
const SUB_TRIANGLE_TRIM = 0.72;
const PAD_ORGAN_LEVEL = 0.12;
const PAD_ORGAN_THERMAL_LIFT = 0.65;
const PAD_ORGAN_GOLDEN_LIFT = 0.8;
const PAD_SPECTRAL_LFO_HZ = 0.071;
const PAD_SPECTRAL_MOTION_HZ = 180;
const PAD_TURBULENCE_MOTION_HZ = 120;
const DAYLIGHT_PAD_FILTER_LIFT_HZ = 420;
const GOLDEN_PAD_FILTER_LIFT_HZ = 260;
const NIGHT_SHIMMER_GAIN_LIFT = 0.65;
const BLOOM_PAD_WIDTH_LIFT = 0.2;
const SHIMMER_FM_RATIO = 2.01;
const SHIMMER_FM_INDEX = 0.055;
const SHIMMER_FM_SLEW_S = 1.8;
const BLOOM_REVERB_SECONDS = 4.8;
const BLOOM_REVERB_DECAY = 2.6;
const BLOOM_REVERB_WET_MAX = 0.24;
const BLOOM_REVERB_STATE_FLOOR = 0.18;
const BLOOM_REVERB_GOLDEN_LIFT = 0.42;
const REVERB_IMPULSE_SEED = 0x726f6f6d;
const BLOOM_IMPULSE_SEED = 0x626c6f6f;
const WASH_NOISE_SEED = 0x77617368;
const PERC_NOISE_SEED = 0x70657263;
const RISER_NOISE_SEED = 0x72697365;
const CHIP_NOISE_SEED = 0x63686970;
const CHIP_NOISE_FLOOR_LEVEL = 0.005;
const CHIP_NOISE_FILTER_HZ = 3200;
const CHIP_NOISE_Q = 0.7;
const CHIP_NOISE_BUFFER_S = 1;
const WASH_NOISE_BUFFER_S = 3;
const PERC_NOISE_BUFFER_S = 1;
const RISER_NOISE_BUFFER_S = 2;
const CHIP_FLOOR_SLEW_S = 1.2;
const RISER_ABORT_RELEASE_S = 1.1;
const RISER_BUILD_GAIN_SLEW_S = 0.08;
const PERC_ATTACK_S = 0.003;
const PERC_BODY_LEVEL = 0.34;
const PERC_BODY_START_HZ = 118;
const PERC_BODY_END_HZ = 54;
const PERC_BODY_PITCH_SPAN_HZ = 32;
const PERC_BODY_DECAY_S = 0.16;
const PERC_BODY_ENVELOPE_FLOOR = 0.0001;
const PERC_NODE_STOP_TAIL_S = 0.05;
const CHIP_SUB_LEVEL_WEIGHT = 0.6;
/** Strict chip-era pulse allocation: chip notes release before the next gene onset. */
const CHIP_PULSE_RELEASE_SCALE = 0.9;
const CHIP_COLOR_GATE_EPSILON = 0.01;
const PERC_PAN_SLEW_S = 0.04;
const TICK2_CROSSFADE_S = 4;
const TICK2_SILENT_EPSILON = 0.001;

// --- Engine state ------------------------------------------------------------------------------

let built = false;
let signals: BedSignals = neutralBedSignals();
let conductor: BedConductorState | null = null;
let transport: TransportState | null = null;
/** Audio time of the bed's last harmony publish (Stage 3 live-tonic window). */
let lastBedPublishAt = Number.NEGATIVE_INFINITY;
let schedulerTimer: number | null = null;
let yielding = false;
let bedLeadTargetGain = BED_MASTER_GAIN;
let bedAuthorityFadeUntil = 0;
interface PlannedBedHitWindow {
  start: number;
  end: number;
  barIndex: number;
  beatsPerBar: number;
  published: BedBarPlan['publish'];
  era: number;
  stage: BedSignals['stage'];
}
let lastPlannedBedHitWindow: PlannedBedHitWindow | null = null;

/** Pure current-window quantizer; preserves beat semantics after lookahead planning. */
export function resolvePlannedBedQuantum(
  planned: Pick<PlannedBedHitWindow, 'start' | 'end' | 'barIndex' | 'beatsPerBar'>,
  fromTime: number,
  quantize: HitQuantize
): number | null {
  if (fromTime >= planned.end) return null;
  if (fromTime <= planned.start) {
    return quantize !== 'phrase' || planned.barIndex % PHRASE_BARS === 0
      ? planned.start
      : null;
  }
  if (quantize !== 'beat') return null;
  const beatDuration = (planned.end - planned.start) / planned.beatsPerBar;
  const beatIndex = Math.ceil((fromTime - planned.start) / beatDuration);
  return beatIndex < planned.beatsPerBar
    ? planned.start + beatIndex * beatDuration
    : null;
}
/** P4 offline-render hooks (null on the live path — behavior unchanged). */
let onBarHook: ((plan: BedBarPlan, barTime: number, barDur: number) => void) | null = null;
let offlineHitSink: ((kind: 'bloom' | 'boom', atTime: number) => void) | null = null;
let offlineSuppressTransientVoices = false;
let tickHzLive = 1;
let tickHzTarget = 1;
let tickLevelApplied = -1;
let nextTickAt = 0;
/** The paradox SECOND clock (§8.5): 0 = off; never re-phases with the first. */
let tick2HzLive = 0;
let tick2HzTarget = 0;
let tick2MixLive = 0;
let tick2MixTarget = 0;
let nextTick2At = 0;
let noteSalt = 0;
let leadDelay: DelayNode | null = null;
let leadDelayMixNode: GainNode | null = null;
let leadDelayFeedbackNode: GainNode | null = null;
let shimmerLfoDepth: GainNode | null = null;

let bedMaster: GainNode | null = null;
let bedBus: GainNode | null = null;
let breathGain: GainNode | null = null;
let reverbSend: GainNode | null = null;
let reverbWet: GainNode | null = null;
let bloomReverbSend: GainNode | null = null;
let bloomReverbWet: GainNode | null = null;

interface PadVoice {
  /** Unison saws (PAD_UNISON_FULL / PAD_UNISON_LEAN); left-/right-slotted saws share one side panner each. */
  saws: OscillatorNode[];
  /** [left, right] side panners (centre saws feed the filter directly). */
  sawPans: StereoPannerNode[];
  /** Signed unison slot per saw, −1..1 (pan and detune scale from it). */
  slots: number[];
  /** Cents offset per saw at full spread (signed). */
  cents: number[];
  octave: OscillatorNode;
  organ: OscillatorNode;
  filter: BiquadFilterNode;
  wanderDepth: GainNode;
  gain: GainNode;
  organGain: GainNode;
  octaveGain: GainNode;
  pan: StereoPannerNode;
  /** Currently assigned chord tone (null = the voice is resting at gain 0). */
  semis: number | null;
}
let padVoices: PadVoice[] = [];
let padGain: GainNode | null = null;
let padDriveWet: GainNode | null = null;
let padSpectralLfo: OscillatorNode | null = null;
let padSpectralDepth: GainNode | null = null;
let padBreathNoise: AudioBuffer | null = null;
let padBreathFilter: BiquadFilterNode | null = null;
let bedQuality: BedQualityTier = 'full';
/** Whole-bed mono-below crossover blend (bypass ↔ LR4 split), gated by padChoir. */
let xoverBypass: GainNode | null = null;
let xoverLow: GainNode | null = null;
let xoverHigh: GainNode | null = null;
/** Designed sub path blend (bypass ↔ drive/HP/LP/centre), gated by padChoir. */
let subDesignBypass: GainNode | null = null;
let subDesignOut: GainNode | null = null;
let subDriveWet: GainNode | null = null;
let leadDriveWet: GainNode | null = null;

let subSineOsc: OscillatorNode | null = null;
let subTriangleOsc: OscillatorNode | null = null;
let subHarmonicOsc: OscillatorNode | null = null;
interface SubMotifVoice {
  osc: OscillatorNode;
  gain: GainNode;
  /** Absolute audio time after which frequency may be changed in silence. */
  availableAt: number;
}
let subMotifVoices: SubMotifVoice[] = [];
let subMotifVoiceCursor = 0;
let subSineGain: GainNode | null = null;
let subTriangleGain: GainNode | null = null;
let subHarmonicGain: GainNode | null = null;
let subDroneGain: GainNode | null = null;
let subMotifGain: GainNode | null = null;
let subGain: GainNode | null = null;
let chipOsc: OscillatorNode | null = null;
let chipGain: GainNode | null = null;
let chipNoiseGain: GainNode | null = null;

let ostFilter: BiquadFilterNode | null = null;
let ostGain: GainNode | null = null;

let leadFilter: BiquadFilterNode | null = null;
let leadGain: GainNode | null = null;

let shimmerA: OscillatorNode | null = null;
let shimmerB: OscillatorNode | null = null;
let shimmerGain: GainNode | null = null;
let shimmerPan: StereoPannerNode | null = null;
let shimmerModA: OscillatorNode | null = null;
let shimmerModB: OscillatorNode | null = null;
let shimmerModDepthA: GainNode | null = null;
let shimmerModDepthB: GainNode | null = null;

let washFilter: BiquadFilterNode | null = null;
let washGain: GainNode | null = null;
let washPan: StereoPannerNode | null = null;
let washGustLfo: OscillatorNode | null = null;
let washGustDepth: GainNode | null = null;
let washPanLfo: OscillatorNode | null = null;
let washPanDepth: GainNode | null = null;

let percFilter: BiquadFilterNode | null = null;
let percGain: GainNode | null = null;
let percPan: StereoPannerNode | null = null;
let percNoise: AudioBuffer | null = null;

let riserFilter: BiquadFilterNode | null = null;
let riserGain: GainNode | null = null;
let riserBuilding = false;

let tickGain: GainNode | null = null;
/** Stage 5 pulse voice (the sidechain source): body into the designed sub path, click + tail dry. */
let pulseBodyGain: GainNode | null = null;
let pulseClickFilter: BiquadFilterNode | null = null;
let pulseTailFilter: BiquadFilterNode | null = null;
let pulseTransientGain: GainNode | null = null;
/** Bounded node lifetimes for the pulse transients. */
const PULSE_NODE_STOP_TAIL_S = 0.02;
const PULSE_BODY_ENVELOPE_FLOOR = 0.001;

export interface BedDebugSnapshot {
  barIndex: number;
  quality: BedQualityTier;
  stage: BedSignals['stage'];
  era: number;
  scene: BedSignals['scene'];
  arrangement: BedBarPlan['arrangement'];
  daylight: number;
  golden: number;
  submergence: number;
  rootSemis: number;
  padLevel: number;
  subLevel: number;
  ostinatoLevel: number;
  shimmerLevel: number;
  washLevel: number;
  subMotifMix: number;
  tickHz: number;
  tickPresence: number;
  windGust: number;
  windDrive: number;
  windPan: number;
  /** Stage 5: section in flight (−1 none), BLOOM-rail lift and pulse level of the last bar. */
  sectionIndex: number;
  bloomLift: number;
  pulseLevel: number;
}
let lastBedDebug: BedDebugSnapshot | null = null;

const hzOf = (semis: number): number => 55 * Math.pow(2, semis / 12);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smoothstep01 = (v: number): number => {
  const u = clamp01(v);
  return u * u * (3 - 2 * u);
};

// --- Public API ----------------------------------------------------------------------------------

/** rAF writes the world snapshot here — intent only, never scheduling. */
export function updateBedSignals(next: BedSignals): void {
  signals = next;
  ensureBed();
}

/** The live bed quality tier (resolved once at build; 'full' before the bed exists). */
export function getBedQualityTier(): BedQualityTier {
  return bedQuality;
}

/** Dev diagnostics: last bar's resolved signal→music controls (read-only copy). */
export function getBedDebugSnapshot(): BedDebugSnapshot | null {
  return lastBedDebug ? { ...lastBedDebug } : null;
}

/**
 * (Re)target the bed at a planet. New key, mode, motif, tempo, meter — a new
 * musical place. Tempo/meter changes land on the next bar line (§8.1 law).
 */
export function configureBedPlanet(
  planetSeed: number,
  archetype?: ArchetypeId,
  paletteBrightness?: number
): void {
  if (conductor && conductor.planetSeed === planetSeed) return;
  conductor = createBedConductor(planetSeed, { archetype, paletteBrightness });
  lastPlannedBedHitWindow = null;
  // The planet's tune haunts the story beats (§10.5): the score engine renders
  // mood melodies through this genome, filtered by each mood's own scale.
  setScorePlanetGenome(conductor.genome, planetSeed);
  if (transport) {
    requestTransportTempo(transport, conductor.genome.baseTempo);
    requestTransportMeter(transport, conductor.genome.meter);
  }
}

/** The bed transport's grid, for scoreEngine.scheduleHit while the bed leads. */
function bedQuantize(quantize: HitQuantize): number | null {
  const ctx = peekAudioContext();
  if (!ctx || !transport) return null;
  const fromTime = ctx.currentTime + HIT_MIN_LEAD_S;
  const planned = lastPlannedBedHitWindow;
  if (planned) {
    const currentWindowTime = resolvePlannedBedQuantum(planned, fromTime, quantize);
    if (currentWindowTime != null) return currentWindowTime;
  }
  return nextQuantumTime(transport, fromTime, quantize, PHRASE_BARS);
}

function resolvePlannedBedHitOnset(time: number) {
  const planned = lastPlannedBedHitWindow;
  if (!planned || time < planned.start || time >= planned.end) return null;
  return {
    published: planned.published,
    era: planned.era,
    stage: planned.stage
  };
}

// --- Node graph ------------------------------------------------------------------------------------

function ensureBed(): void {
  if (built) return;
  // The invariant: NO pre-gesture AudioContext is ever constructed on the
  // bed's behalf. peek first, and only fetch the bus once a context exists —
  // getMusicBus() would otherwise construct a suspended context itself.
  const ctx = peekAudioContext();
  if (!ctx) return;
  const bus = getMusicBus();
  if (!bus) return;
  built = true;
  bedQuality = resolveLiveBedQuality();
  buildBedGraph(ctx, bus);

  // Leadership plumbing: the bed is the sandbox floor from now on.
  setGenerativeBedLead(true);
  registerBedQuantizer(bedQuantize);
  registerBedHitQuantumResolver((request) => {
    if (!transport) return null;
    const planned = lastPlannedBedHitWindow;
    // The scheduler is already one bar ahead. Include its still-playing
    // planned bar, and apply the future transport's tempo at the next edge.
    const from = planned && request.notBefore < planned.end ? {
      bpm: planned.beatsPerBar * 60 / (planned.end - planned.start),
      meter: { beatsPerBar: planned.beatsPerBar, sixteenthsPerBeat: planned.beatsPerBar === 2 ? 6 : 4 },
      barIndex: planned.barIndex, barStartTime: planned.start,
      pendingBpm: transport.bpm, pendingMeter: transport.meter
    } : transport;
    return resolveTransportHitQuantum(from, request);
  });
  registerBedHitOnsetResolver(resolvePlannedBedHitOnset);
  // One tonic (Stage 3): a pitch-locked story chain entering from bed-led play
  // reads THIS centre (harmony brain tonic, last publish, bar length).
  registerBedTonicResolver(() => {
    if (!conductor || !transport) return null;
    return {
      tonicPc: conductor.harmony.tonicPc,
      lastPublishAt: lastBedPublishAt,
      barSeconds: barDurationSec(transport.bpm, transport.meter)
    };
  });
  registerBedTonicHandback((tonicPc) => {
    if (!conductor) return;
    // Keep the held chord and its register intact. The existing legality
    // machinery prepares the next pivot under the outgoing story's tonic.
    retargetHarmonyKey(conductor.harmony, tonicPc, conductor.harmony.mode);
  });
  registerStoryAuthorityCrossfade((storyLeads, atTime, durationSec) => {
    yielding = storyLeads;
    bedAuthorityFadeUntil = atTime + durationSec;
    if (!storyLeads) {
      bedLeadTargetGain = resolveBedLeadTarget(signals.scene);
      if (conductor) noteStoryHandBack(conductor);
    }
    if (bedMaster) {
      rampParamAt(
        bedMaster.gain,
        storyLeads ? 0 : bedLeadTargetGain,
        atTime,
        durationSec
      );
    }
  });

  startScheduler();
}

/**
 * Build the full voice graph on any context (the live singleton, or an
 * OfflineAudioContext in the P4 verification harness). Pure node construction
 * — no leadership registration, no timers.
 */
function buildBedGraph(ctx: BaseAudioContext, out: AudioNode): void {
  bedMaster = ctx.createGain();
  bedMaster.gain.value = 0;
  bedMaster.connect(out);

  bedBus = ctx.createGain();
  bedBus.gain.value = 1;
  // Mono-below-BED_XOVER_HZ for the whole bed: an LR4 split whose low band is
  // summed to mono. Blended against an exact bypass so bare/colour (blend 0)
  // are sample-identical to the pre-Stage-1 topology.
  xoverBypass = ctx.createGain();
  xoverBypass.gain.value = 1;
  bedBus.connect(xoverBypass);
  xoverBypass.connect(bedMaster);
  const mkBiquad = (type: BiquadFilterType): BiquadFilterNode => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = BED_XOVER_HZ;
    f.Q.value = XOVER_Q;
    return f;
  };
  const low1 = mkBiquad('lowpass');
  const low2 = mkBiquad('lowpass');
  const high1 = mkBiquad('highpass');
  const high2 = mkBiquad('highpass');
  xoverLow = ctx.createGain();
  xoverLow.gain.value = 0;
  xoverLow.channelCount = 1;
  xoverLow.channelCountMode = 'explicit';
  xoverHigh = ctx.createGain();
  xoverHigh.gain.value = 0;
  bedBus.connect(low1);
  low1.connect(low2);
  low2.connect(xoverLow);
  xoverLow.connect(bedMaster);
  bedBus.connect(high1);
  high1.connect(high2);
  high2.connect(xoverHigh);
  xoverHigh.connect(bedMaster);

  // Reverb: generated exponential-decay impulse (deterministic), one
  // convolver. Only the air voices (pads/shimmer via breath, lead, delay,
  // percussion) feed the send — sub, tick, wash, and riser stay dry.
  reverbSend = ctx.createGain();
  reverbSend.gain.value = REVERB_SEND_LEVEL;
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, REVERB_SECONDS, REVERB_DECAY, REVERB_IMPULSE_SEED);
  reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;
  reverbSend.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(bedMaster);

  // A second, longer decorrelated space fades in only for material+ golden
  // cadences and BLOOMs. It is built once; no transition creates convolver nodes.
  bloomReverbSend = ctx.createGain();
  bloomReverbSend.gain.value = REVERB_SEND_LEVEL;
  const bloomConvolver = ctx.createConvolver();
  bloomConvolver.buffer = makeImpulse(
    ctx,
    BLOOM_REVERB_SECONDS,
    BLOOM_REVERB_DECAY,
    BLOOM_IMPULSE_SEED
  );
  bloomReverbWet = ctx.createGain();
  bloomReverbWet.gain.value = 0;
  bloomReverbSend.connect(bloomConvolver);
  bloomConvolver.connect(bloomReverbWet);
  bloomReverbWet.connect(bedMaster);

  // Sidechain-style breathing bus (pads + shimmer duck on the beat).
  breathGain = ctx.createGain();
  breathGain.gain.value = 1;
  breathGain.connect(bedBus);
  breathGain.connect(reverbSend);
  breathGain.connect(bloomReverbSend);

  // PAD ENSEMBLE (Stage 1): 5 voices (3 lean) × N unison saws with per-saw pan
  // and phase, +1 octave saw, sine organ, PER-VOICE lowpass with a seeded
  // wander clock; parallel tanh drive; attack breath on retune. All of it is
  // gated by padChoir (material+): at bare/colour the pad bus is silent.
  padGain = ctx.createGain();
  padGain.gain.value = 0;
  padGain.connect(breathGain);
  const padSum = ctx.createGain();
  padSum.gain.value = 1;
  padSum.connect(padGain);
  const padDrivePre = ctx.createGain();
  padDrivePre.gain.value = Math.pow(10, DRIVE_PAD_PRE_DB / 20);
  const padDrive = ctx.createWaveShaper();
  padDrive.curve = tanhDriveCurve(DRIVE_PAD_K);
  // Drive inputs are lowpassed (pad ≤ ~3.6 kHz, sub ≤ 200 Hz, lead ≤ 2.2 kHz): a
  // k 1.8 tanh keeps its audible harmonics under Nyquist, so no oversampling —
  // it halved the offline render throughput for no audible gain. The music-bus
  // soft clip keeps '2x' because it sees the full band.
  padDrive.oversample = 'none';
  padDriveWet = ctx.createGain();
  padDriveWet.gain.value = 0;
  padSum.connect(padDrivePre);
  padDrivePre.connect(padDrive);
  padDrive.connect(padDriveWet);
  padDriveWet.connect(padGain);
  padSpectralLfo = ctx.createOscillator();
  padSpectralLfo.frequency.value = PAD_SPECTRAL_LFO_HZ;
  padSpectralDepth = ctx.createGain();
  padSpectralDepth.gain.value = 0;
  padSpectralLfo.connect(padSpectralDepth);
  padSpectralLfo.start();
  const voiceCount = bedQuality === 'lean' ? PAD_VOICES_LEAN : PAD_VOICES_FULL;
  const unison: number = bedQuality === 'lean' ? PAD_UNISON_LEAN : PAD_UNISON_FULL;
  const unisonCents = unisonCentsFor(unison);
  padVoices = Array.from({ length: voiceCount }, (_, i) => {
    const initialHz = hzOf(PAD_INITIAL_ROOT_SEMIS + i * PAD_INITIAL_VOICE_STEP_SEMIS + PAD_OCTAVE_SHIFT);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = PAD_VOICE_LP_MIN_HZ;
    filter.Q.value = PAD_VOICE_LP_Q;
    padSpectralDepth!.connect(filter.frequency);
    const wander = ctx.createOscillator();
    wander.frequency.value =
      PAD_WANDER_HZ_MIN + (PAD_WANDER_HZ_MAX - PAD_WANDER_HZ_MIN) * seededUnit(PAD_WANDER_SEED, i + 1);
    const wanderDepth = ctx.createGain();
    wanderDepth.gain.value = 0;
    wander.connect(wanderDepth);
    wanderDepth.connect(filter.frequency);
    wander.start();
    const gain = ctx.createGain();
    gain.gain.value = i < 3 ? 1 / voiceCount : 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(padSum);
    const slots = unisonCents.map((_, k) => (unison === 1 ? 0 : (k / (unison - 1)) * 2 - 1));
    // Two side panners per voice (not one per saw): the per-saw graded pan cost
    // 60 panner nodes and halved offline throughput; alternating L/R sides is
    // the classic supersaw width and keeps the node count flat.
    const sawPans = [ctx.createStereoPanner(), ctx.createStereoPanner()];
    for (const sawPan of sawPans) {
      sawPan.pan.value = 0;
      sawPan.connect(filter);
    }
    const saws = unisonCents.map((cents, k) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = initialHz;
      osc.detune.value = cents * (PAD_DETUNE_CENTS_MIN / PAD_DETUNE_CENTS_MAX);
      const slot = slots[k];
      osc.connect(slot === 0 ? filter : sawPans[slot < 0 ? 0 : 1]);
      // Phase offset: a seeded start-time jitter inside the first cycle.
      osc.start(ctx.currentTime + (seededUnit(PAD_WANDER_SEED, 100 + i * 16 + k) * 1) / initialHz);
      return osc;
    });
    const octave = ctx.createOscillator();
    octave.type = 'sawtooth';
    octave.frequency.value = initialHz * 2;
    const octaveGain = ctx.createGain();
    octaveGain.gain.value = 0;
    octave.connect(octaveGain);
    octaveGain.connect(filter);
    octave.start();
    const organ = ctx.createOscillator();
    organ.type = 'sine';
    organ.frequency.value = initialHz;
    const organGain = ctx.createGain();
    organGain.gain.value = 0;
    organ.connect(organGain);
    organGain.connect(filter);
    organ.start();
    return {
      saws,
      sawPans,
      slots,
      cents: unisonCents,
      octave,
      organ,
      filter,
      wanderDepth,
      gain,
      organGain,
      octaveGain,
      pan,
      semis: null
    };
  });
  padBreathNoise = makeNoiseBuffer(ctx, PAD_BREATH_NOISE_BUFFER_S, PAD_BREATH_NOISE_SEED);
  padBreathFilter = ctx.createBiquadFilter();
  padBreathFilter.type = 'bandpass';
  padBreathFilter.frequency.value = PAD_BREATH_HZ;
  padBreathFilter.Q.value = PAD_BREATH_Q;
  padBreathFilter.connect(padSum);

  // TUNED SUB: persistent triangle/sine/harmonic drone layers plus a separate
  // motif oscillator. Era and submergence CROSSFADE gains; oscillator waveform
  // is never mutated on a sounding node.
  subGain = ctx.createGain();
  subGain.gain.value = 0;
  subDroneGain = ctx.createGain();
  subDroneGain.gain.value = 1;
  subMotifGain = ctx.createGain();
  subMotifGain.gain.value = 0;
  subSineGain = ctx.createGain();
  subSineGain.gain.value = 0;
  subTriangleGain = ctx.createGain();
  subTriangleGain.gain.value = 0;
  subHarmonicGain = ctx.createGain();
  subHarmonicGain.gain.value = 0;
  const makeSubOsc = (type: OscillatorType, frequency: number, gain: GainNode): OscillatorNode => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(subDroneGain!);
    osc.start();
    return osc;
  };
  const baseSubHz = hzOf(SUB_OCTAVE_SHIFT);
  subSineOsc = makeSubOsc('sine', baseSubHz, subSineGain);
  subTriangleOsc = makeSubOsc('triangle', baseSubHz, subTriangleGain);
  subHarmonicOsc = makeSubOsc('sine', baseSubHz * SUB_HARMONIC_RATIO, subHarmonicGain);
  const motifWaveReal = new Float32Array([0, 0, 0, 0]);
  const motifWaveImag = new Float32Array([
    0,
    SUB_MOTIF_FUNDAMENTAL_LEVEL,
    SUB_MOTIF_SECOND_HARMONIC_LEVEL,
    SUB_MOTIF_THIRD_HARMONIC_LEVEL
  ]);
  const motifWave = ctx.createPeriodicWave(motifWaveReal, motifWaveImag);
  const makeMotifSub = (): SubMotifVoice => {
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(motifWave);
    osc.frequency.value = baseSubHz;
    osc.connect(voiceGain);
    voiceGain.connect(subMotifGain!);
    osc.start();
    return { osc, gain: voiceGain, availableAt: 0 };
  };
  subMotifVoices = Array.from({ length: SUB_MOTIF_VOICE_COUNT }, makeMotifSub);
  subMotifVoiceCursor = 0;
  // Stage 1 designed sub: the drone/motif sum runs through a parallel tanh
  // drive, a 28 Hz floor, a 120 Hz ceiling and a centre-pinned panner. It is
  // blended against an exact bypass by padChoir, so the chip-era triangle
  // bass (colour) and the bare floor are untouched by construction.
  const subDesignIn = ctx.createGain();
  subDesignIn.gain.value = 1;
  subDroneGain.connect(subDesignIn);
  subMotifGain.connect(subDesignIn);
  subDesignBypass = ctx.createGain();
  subDesignBypass.gain.value = 1;
  subDesignIn.connect(subDesignBypass);
  subDesignBypass.connect(subGain);
  const subDrive = ctx.createWaveShaper();
  subDrive.curve = tanhDriveCurve(DRIVE_SUB_K);
  subDrive.oversample = 'none';
  subDriveWet = ctx.createGain();
  subDriveWet.gain.value = 0;
  const subHp = ctx.createBiquadFilter();
  subHp.type = 'highpass';
  subHp.frequency.value = SUB_HP_HZ;
  subHp.Q.value = XOVER_Q;
  const subLp = ctx.createBiquadFilter();
  subLp.type = 'lowpass';
  subLp.frequency.value = SUB_LP_HZ;
  subLp.Q.value = XOVER_Q;
  const subCentre = ctx.createStereoPanner();
  subCentre.pan.value = 0;
  subDesignOut = ctx.createGain();
  subDesignOut.gain.value = 0;
  subDesignIn.connect(subHp);
  subDesignIn.connect(subDrive);
  subDrive.connect(subDriveWet);
  subDriveWet.connect(subHp);
  subHp.connect(subLp);
  subLp.connect(subCentre);
  subCentre.connect(subDesignOut);
  subDesignOut.connect(subGain);
  subGain.connect(bedBus);

  // CHIP DRONE: the bare-era quiet-bed floor (a barely-there pulse) — and the
  // paradox fold-back texture.
  chipOsc = ctx.createOscillator();
  chipOsc.type = 'square';
  chipOsc.frequency.value = hzOf(CHIP_DRONE_OCTAVE);
  chipGain = ctx.createGain();
  chipGain.gain.value = 0;
  chipOsc.connect(chipGain);
  chipGain.connect(bedBus);
  chipOsc.start();
  const chipNoise = ctx.createBufferSource();
  chipNoise.buffer = makeNoiseBuffer(ctx, CHIP_NOISE_BUFFER_S, CHIP_NOISE_SEED);
  chipNoise.loop = true;
  const chipNoiseFilter = ctx.createBiquadFilter();
  chipNoiseFilter.type = 'bandpass';
  chipNoiseFilter.frequency.value = CHIP_NOISE_FILTER_HZ;
  chipNoiseFilter.Q.value = CHIP_NOISE_Q;
  chipNoiseGain = ctx.createGain();
  chipNoiseGain.gain.value = 0;
  chipNoise.connect(chipNoiseFilter);
  chipNoiseFilter.connect(chipNoiseGain);
  chipNoiseGain.connect(bedBus);
  chipNoise.start();

  // OSTINATO pluck bus.
  ostFilter = ctx.createBiquadFilter();
  ostFilter.type = 'lowpass';
  ostFilter.frequency.value = 1400;
  ostGain = ctx.createGain();
  ostGain.gain.value = 0;
  ostFilter.connect(ostGain);
  ostGain.connect(bedBus);

  // LEAD motif bus → gentle lowpass → dotted-8th feedback delay.
  leadFilter = ctx.createBiquadFilter();
  leadFilter.type = 'lowpass';
  leadFilter.frequency.value = LEAD_FILTER_HZ;
  leadGain = ctx.createGain();
  leadGain.gain.value = 0;
  leadFilter.connect(leadGain);
  leadGain.connect(bedBus);
  // Stage 1 lead drive: parallel wet path into the bed bus (full tier only).
  if (bedQuality === 'full') {
    const leadDrive = ctx.createWaveShaper();
    leadDrive.curve = tanhDriveCurve(DRIVE_LEAD_K);
    leadDrive.oversample = 'none';
    leadDriveWet = ctx.createGain();
    leadDriveWet.gain.value = 0;
    leadGain.connect(leadDrive);
    leadDrive.connect(leadDriveWet);
    leadDriveWet.connect(bedBus);
  }
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.4;
  const feedback = ctx.createGain();
  feedback.gain.value = LEAD_DELAY_FEEDBACK;
  const delayMix = ctx.createGain();
  delayMix.gain.value = LEAD_DELAY_MIX;
  leadDelayMixNode = delayMix;
  leadDelayFeedbackNode = feedback;
  leadGain.connect(delay);
  leadGain.connect(reverbSend);
  leadGain.connect(bloomReverbSend);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(bedBus);
  delayMix.connect(reverbSend);
  delayMix.connect(bloomReverbSend);
  leadDelay = delay;

  // SHIMMER: two high chord tones, slow LFO breathing, panned wide.
  shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0;
  shimmerPan = ctx.createStereoPanner();
  shimmerPan.pan.value = 0;
  shimmerGain.connect(shimmerPan);
  shimmerPan.connect(breathGain);
  shimmerA = ctx.createOscillator();
  shimmerA.type = 'sine';
  shimmerA.frequency.value = hzOf(12 + SHIMMER_OCTAVE_SHIFT);
  shimmerB = ctx.createOscillator();
  shimmerB.type = 'sine';
  shimmerB.frequency.value = hzOf(19 + SHIMMER_OCTAVE_SHIFT);
  shimmerA.connect(shimmerGain);
  shimmerB.connect(shimmerGain);
  shimmerA.start();
  shimmerB.start();
  shimmerModA = ctx.createOscillator();
  shimmerModB = ctx.createOscillator();
  shimmerModA.frequency.value = shimmerA.frequency.value * SHIMMER_FM_RATIO;
  shimmerModB.frequency.value = shimmerB.frequency.value * SHIMMER_FM_RATIO;
  shimmerModDepthA = ctx.createGain();
  shimmerModDepthB = ctx.createGain();
  shimmerModDepthA.gain.value = 0;
  shimmerModDepthB.gain.value = 0;
  shimmerModA.connect(shimmerModDepthA);
  shimmerModB.connect(shimmerModDepthB);
  shimmerModDepthA.connect(shimmerA.frequency);
  shimmerModDepthB.connect(shimmerB.frequency);
  shimmerModA.start();
  shimmerModB.start();
  const shimmerLfo = ctx.createOscillator();
  shimmerLfo.frequency.value = SHIMMER_LFO_HZ;
  const shimmerDepth = ctx.createGain();
  shimmerDepth.gain.value = 0;
  shimmerLfo.connect(shimmerDepth);
  shimmerDepth.connect(shimmerGain.gain);
  shimmerLfo.start();
  shimmerLfoDepth = shimmerDepth;

  // WASH: filtered noise; its LFOs breathe with the planet's gust field.
  const washNoise = ctx.createBufferSource();
  washNoise.buffer = makeNoiseBuffer(ctx, WASH_NOISE_BUFFER_S, WASH_NOISE_SEED);
  washNoise.loop = true;
  washFilter = ctx.createBiquadFilter();
  washFilter.type = 'lowpass';
  washFilter.frequency.value = WASH_FILTER_MIN_HZ;
  washFilter.Q.value = 0.4;
  washGain = ctx.createGain();
  washGain.gain.value = 0;
  washPan = ctx.createStereoPanner();
  washPan.pan.value = 0;
  washNoise.connect(washFilter);
  washFilter.connect(washGain);
  washGain.connect(washPan);
  washPan.connect(bedBus);
  washNoise.start();
  washGustLfo = ctx.createOscillator();
  washGustLfo.frequency.value = WASH_GUST_LFO_BASE_HZ;
  washGustDepth = ctx.createGain();
  washGustDepth.gain.value = 0;
  washGustLfo.connect(washGustDepth);
  washGustDepth.connect(washGain.gain);
  washGustLfo.start();
  washPanLfo = ctx.createOscillator();
  washPanLfo.frequency.value = WASH_PAN_LFO_HZ;
  washPanDepth = ctx.createGain();
  washPanDepth.gain.value = 0;
  washPanLfo.connect(washPanDepth);
  washPanDepth.connect(washPan.pan);
  washPanLfo.start();

  // PERCUSSION: shared bandpass + pan; per-hit noise transients.
  percNoise = makeNoiseBuffer(ctx, PERC_NOISE_BUFFER_S, PERC_NOISE_SEED);
  percFilter = ctx.createBiquadFilter();
  percFilter.type = 'bandpass';
  percFilter.frequency.value = PERC_FILTER_BASE_HZ;
  percFilter.Q.value = PERC_Q_BASE;
  percGain = ctx.createGain();
  percGain.gain.value = 0;
  percPan = ctx.createStereoPanner();
  percPan.pan.value = 0;
  percFilter.connect(percGain);
  percGain.connect(percPan);
  percPan.connect(bedBus);
  percPan.connect(reverbSend);
  percPan.connect(bloomReverbSend);

  // RISER: looped noise → bandpass, ramped across BUILD phrases.
  const riserNoise = ctx.createBufferSource();
  riserNoise.buffer = makeNoiseBuffer(ctx, RISER_NOISE_BUFFER_S, RISER_NOISE_SEED);
  riserNoise.loop = true;
  riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'bandpass';
  riserFilter.frequency.value = RISER_FILTER_FROM_HZ;
  riserFilter.Q.value = 1.1;
  riserGain = ctx.createGain();
  riserGain.gain.value = 0;
  riserNoise.connect(riserFilter);
  riserFilter.connect(riserGain);
  riserGain.connect(bedBus);
  riserNoise.start();

  // WORLD-CLOCK TICK bus (transients scheduled on their own non-musical clock).
  tickGain = ctx.createGain();
  tickGain.gain.value = 0;
  tickGain.connect(bedBus);

  // PULSE (Stage 5): the sidechain's source. The root-tuned body rides the
  // designed sub path (drive, lowpass, mono-below); click and tail are dry and
  // centred. Silent by construction outside BUILD/BLOOM (plan.pulse.level 0).
  pulseBodyGain = ctx.createGain();
  pulseBodyGain.gain.value = 0;
  pulseBodyGain.connect(subDesignIn);
  pulseTransientGain = ctx.createGain();
  pulseTransientGain.gain.value = 0;
  pulseTransientGain.connect(bedBus);
  pulseClickFilter = ctx.createBiquadFilter();
  pulseClickFilter.type = 'highpass';
  pulseClickFilter.frequency.value = PULSE_CLICK_HP_HZ;
  pulseClickFilter.connect(pulseTransientGain);
  pulseTailFilter = ctx.createBiquadFilter();
  pulseTailFilter.type = 'bandpass';
  pulseTailFilter.frequency.value = PULSE_TAIL_BP_HZ;
  pulseTailFilter.Q.value = 1.2;
  pulseTailFilter.connect(pulseTransientGain);
}

function makeImpulse(
  ctx: BaseAudioContext,
  seconds: number,
  decay: number,
  seed: number
): AudioBuffer {
  // Shared Stage 1 generator: pre-delay, seeded early reflections, HF-damped
  // late tail, stereo-decorrelated by seed. The story convolver uses the same.
  return makeImpulseBuffer(ctx, {
    seconds,
    decay,
    seed,
    preDelayMs: REVERB_PREDELAY_MS,
    earlyTaps: REVERB_EARLY_TAPS,
    earlyWindowMs: REVERB_EARLY_WINDOW_MS,
    earlyLevel: REVERB_EARLY_LEVEL,
    lateLevel: REVERB_LATE_LEVEL,
    lateOnsetMs: REVERB_LATE_ONSET_MS,
    hfDampHz: REVERB_HF_DAMP_HZ,
    channels: 2
  });
}

/** Symmetric unison offsets for `n` saws: ±PAD_UNISON_CENTS pairs (+ a centre saw when odd). */
export function unisonCentsFor(n: number): number[] {
  const out: number[] = [];
  const pairs = Math.floor(n / 2);
  for (let k = pairs - 1; k >= 0; k--) out.push(-PAD_UNISON_CENTS[Math.min(k, PAD_UNISON_CENTS.length - 1)]);
  if (n % 2 === 1) out.push(0);
  for (let k = 0; k < pairs; k++) out.push(PAD_UNISON_CENTS[Math.min(k, PAD_UNISON_CENTS.length - 1)]);
  return out;
}

// --- Stage 1 rails: one pure resolver (the era-gate law, testable) ----------------------------------

/** World/plan inputs the Stage 1 material+ rails depend on. */
export interface Stage1RailInput {
  /** Actual built quality; omitted only by existing full-tier pure callers. */
  quality?: BedQualityTier;
  /** `gates.padChoir` — the material+ era gate every Stage 1 rail multiplies. */
  padChoir: number;
  thermal: number;
  golden: number;
  daylight: number;
  /** `plan.wind.turbulence` (0..1). */
  windTurbulence: number;
  /** `plan.levels.pad` (arrangement level). */
  padLevel: number;
  /** Pad voices in the built graph (PAD_VOICES_FULL / PAD_VOICES_LEAN). */
  padVoiceCount: number;
}

/**
 * Every Stage 1 gain/blend rail as a plain number, resolved from world signals
 * only. Convention: "active" rails are exactly 0 at padChoir 0; "bypass" rails
 * are exactly 1 there; `aliveTrim` is exactly 1 there. Panners are position
 * only (a voice whose gain is 0 has no audible pan), so they are not rails.
 */
export interface Stage1Rails {
  padBusLevel: number;
  padOctaveLevel: number;
  padWanderDepthHz: number;
  padOrganLevel: number;
  padSpectralDepthHz: number;
  padDriveWet: number;
  padBreathLevel: number;
  xoverBypass: number;
  xoverLow: number;
  xoverHigh: number;
  subDesignBypass: number;
  subDesignOut: number;
  subDriveWet: number;
  leadDriveWet: number;
  /** Whole-bed alive lift × night trim on the bed bus and both room returns. */
  aliveTrim: number;
}

/**
 * Night depth for the alive-bed trim: 0 for daylight ≥ BED_NIGHT_TRIM_DAYLIGHT_ONSET
 * (so daylight renders are bit-identical to before the trim existed), smoothstep
 * to 1 at full night.
 */
export function bedNightTrimDepth(daylight: number): number {
  if (BED_NIGHT_TRIM_DAYLIGHT_ONSET <= 0) return 0;
  return smoothstep01((BED_NIGHT_TRIM_DAYLIGHT_ONSET - clamp01(daylight)) / BED_NIGHT_TRIM_DAYLIGHT_ONSET);
}

export function resolveStage1Rails(input: Stage1RailInput): Stage1Rails {
  const padChoir = input.padChoir;
  const thermal = clamp01(input.thermal);
  const golden = clamp01(input.golden);
  const nightDepth = bedNightTrimDepth(input.daylight);
  const nightTrim = nightDepth === 0 ? 1 : Math.pow(10, (BED_NIGHT_TRIM_DB * nightDepth) / 20);
  const qualityTrim = input.quality === 'lean' ? Math.pow(10, BED_LEAN_BALANCE_DB / 20) : 1;
  return {
    padBusLevel: BED_PAD_LEVEL * input.padLevel * padChoir,
    padOctaveLevel: Math.pow(10, PAD_OCTAVE_LEVEL_DB / 20) * padChoir,
    padWanderDepthHz: PAD_WANDER_DEPTH_HZ * padChoir,
    padOrganLevel:
      (PAD_ORGAN_LEVEL / Math.max(1, input.padVoiceCount)) *
      padChoir *
      (1 + PAD_ORGAN_THERMAL_LIFT * thermal + PAD_ORGAN_GOLDEN_LIFT * golden),
    padSpectralDepthHz:
      padChoir * (thermal * PAD_SPECTRAL_MOTION_HZ + input.windTurbulence * PAD_TURBULENCE_MOTION_HZ),
    // Drive is drive: thermal worlds lift the WET blend, never the level.
    padDriveWet: DRIVE_PAD_WET_ALIVE * padChoir * (1 - DRIVE_THERMAL_WET_LIFT + DRIVE_THERMAL_WET_LIFT * thermal),
    padBreathLevel: PAD_BREATH_LEVEL * padChoir * input.padLevel,
    xoverBypass: 1 - padChoir,
    xoverLow: padChoir,
    xoverHigh: padChoir,
    subDesignBypass: 1 - padChoir,
    subDesignOut: padChoir,
    subDriveWet: DRIVE_SUB_WET * padChoir * (1 + SUB_THERMAL_HARMONIC_LIFT * thermal),
    leadDriveWet: DRIVE_LEAD_WET * padChoir,
    aliveTrim: 1 - (1 - BED_ALIVE_LIFT * nightTrim * qualityTrim) * padChoir
  };
}

/** Live tier from the browser's own budget signals (offline renders choose explicitly). */
function resolveLiveBedQuality(): BedQualityTier {
  if (typeof navigator === 'undefined') return 'full';
  const nav = navigator as Navigator & { deviceMemory?: number };
  return resolveBedQualityTier({
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemoryGb: nav.deviceMemory,
    coarsePointer:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : undefined
  });
}

// --- The scheduler (one clock; bars planned ahead of ctx.currentTime) -------------------------------

function startScheduler(): void {
  if (schedulerTimer != null) return;
  schedulerTimer = window.setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);
}

function schedulerTick(): void {
  const ctx = peekAudioContext();
  if (!ctx || !bedMaster || !conductor) return;
  const now = ctx.currentTime;
  const s = signals;

  // Story authority: fade out, freeze the planner, publish nothing. Keep the
  // stage baseline current — awakenings the STORY scored must not re-fire as
  // deferred bed blooms on resume (§8.4 stage row, frozen contract).
  const storyLeads = isScoreMoodLeading();
  if (storyLeads) {
    conductor.prevStage = s.stage;
    if (!yielding) {
      yielding = true;
      bedAuthorityFadeUntil = now + BED_YIELD_FADE_S;
      rampParamAt(bedMaster.gain, 0, now, BED_YIELD_FADE_S);
    }
    return;
  }
  if (yielding) {
    yielding = false;
    noteStoryHandBack(conductor); // Stage 5 (contract [16]): the next section carries no bloom budget
    bedLeadTargetGain = resolveBedLeadTarget(s.scene);
    bedAuthorityFadeUntil = now + Math.max(BED_RESUME_FADE_S, STORY_AUTHORITY_CROSSFADE_S);
    rampParamAt(
      bedMaster.gain,
      bedLeadTargetGain,
      now,
      Math.max(BED_RESUME_FADE_S, STORY_AUTHORITY_CROSSFADE_S)
    );
  }

  advanceBedScheduling(ctx, now, s);
}

/**
 * The clock-agnostic scheduling core: plan and schedule every bar whose start
 * enters the lookahead horizon, then the world-clock ticks. Shared verbatim by
 * the live 60 ms interval and the offline suspend/resume drive (P4).
 */
function advanceBedScheduling(ctx: BaseAudioContext, now: number, s: BedSignals): void {
  if (!conductor) return;
  if (!transport) {
    transport = createTransport(now + LOOKAHEAD_S, conductor.genome.baseTempo, conductor.genome.meter);
  }
  const barDur = barDurationSec(transport.bpm, transport.meter);
  // Tab hides / story leads leave the transport behind the clock: re-anchor
  // on a fresh bar instead of burst-replaying the gap.
  if (now > transport.barStartTime + barDur * TRANSPORT_STALE_BARS) {
    transport.barStartTime = now + 0.05;
  }

  // Plan and schedule every bar whose start enters the lookahead horizon.
  while (transport.barStartTime < now + LOOKAHEAD_S) {
    const plan = planBedBar(conductor, s);
    scheduleBar(ctx, plan, transport);
    onBarHook?.(plan, transport.barStartTime, barDurationSec(transport.bpm, transport.meter));
    advanceTransportBar(transport);
  }

  if (!offlineSuppressTransientVoices) scheduleTicks(ctx, now);
}

// --- Bar rendering -----------------------------------------------------------------------------------

function scheduleBar(ctx: BaseAudioContext, plan: BedBarPlan, t: TransportState): void {
  const barTime = t.barStartTime;
  const barDur = barDurationSec(t.bpm, t.meter);
  const slotSec = barDur / SLOTS_PER_BAR;
  const beatDur = barDur / t.meter.beatsPerBar;
  const s = signals;
  const g = plan.gates;
  const seed = conductor!.planetSeed;
  lastPlannedBedHitWindow = {
    start: barTime,
    end: barTime + barDur,
    barIndex: plan.barIndex,
    beatsPerBar: t.meter.beatsPerBar,
    published: plan.publish,
    era: s.era,
    stage: s.stage
  };

  // ONE harmonic truth: the bed publishes while it leads (we only get here
  // when no story mood leads).
  setMusicChord(plan.publish.root, plan.publish.tones);
  lastBedPublishAt = barTime;

  // Master: scene gain (REST floor is carried by the arrangement levels — the
  // master itself never parks at zero while the bed leads).
  bedLeadTargetGain = BED_MASTER_GAIN * plan.policy.gain;
  if (barTime >= bedAuthorityFadeUntil) {
    bedMaster!.gain.setTargetAtTime(bedLeadTargetGain, barTime, MASTER_TAU_S);
  }

  // -- Pads: retune to the voicing at the bar line, glide (retune-not-swap).
  // Stage 1: all published upper tones sound (colour tones from voice 4 up).
  const uppers = plan.publish.tones.slice(1, 1 + padVoices.length);
  const detune =
    PAD_DETUNE_CENTS_MIN + (PAD_DETUNE_CENTS_MAX - PAD_DETUNE_CENTS_MIN) * clamp01(s.chroma) * g.stereoWidth;
  const unisonScale = detune / PAD_DETUNE_CENTS_MAX;
  const width = Math.min(
    1,
    PAD_WIDTH_MAX * g.stereoWidth + (plan.arrangement === 'BLOOM' ? BLOOM_PAD_WIDTH_LIFT : 0)
  );
  const voiceSpan = Math.max(1, padVoices.length - 1);
  const padVoiceFilterHz =
    PAD_VOICE_LP_MIN_HZ +
    plan.padBrightness * PAD_VOICE_LP_SPAN_HZ +
    clamp01(s.daylight) * DAYLIGHT_PAD_FILTER_LIFT_HZ +
    clamp01(s.golden) * GOLDEN_PAD_FILTER_LIFT_HZ;
  // Stage 1 rails resolve in one pure function (the era-gate law lives there).
  const rails = resolveStage1Rails({
    quality: bedQuality,
    padChoir: g.padChoir,
    thermal: s.thermal,
    golden: s.golden,
    daylight: s.daylight,
    windTurbulence: plan.wind.turbulence,
    padLevel: plan.levels.pad,
    padVoiceCount: padVoices.length
  });
  let padRetuned = false;
  padVoices.forEach((voice, i) => {
    const semis = uppers[i] ?? null;
    if (semis != null) {
      const hz = hzOf(semis + PAD_OCTAVE_SHIFT);
      if (voice.semis !== semis) padRetuned = true;
      voice.saws.forEach((saw, k) => {
        saw.frequency.setTargetAtTime(hz, barTime, PAD_GLIDE_TAU_S);
        saw.detune.setTargetAtTime(voice.cents[k] * unisonScale, barTime, BAR_PARAM_TAU_S);
      });
      voice.sawPans.forEach((sawPan, side) => {
        rampParamAt(
          sawPan.pan,
          (side === 0 ? -1 : 1) * PAD_UNISON_PAN_SPREAD * g.stereoWidth,
          barTime,
          UNISON_PAN_SLEW_S
        );
      });
      voice.octave.frequency.setTargetAtTime(hz * 2, barTime, PAD_GLIDE_TAU_S);
      voice.organ.frequency.setTargetAtTime(hz, barTime, PAD_GLIDE_TAU_S);
    }
    voice.semis = semis;
    rampParamAt(voice.gain.gain, semis == null ? 0 : 1 / padVoices.length, barTime, PAD_VOICE_GAIN_SLEW_S);
    voice.pan.pan.setTargetAtTime(((i / voiceSpan) * 2 - 1) * width, barTime, BAR_PARAM_TAU_S);
    rampParamAt(voice.filter.frequency, padVoiceFilterHz, barTime, PAD_VOICE_LP_SLEW_S);
    rampParamAt(voice.wanderDepth.gain, rails.padWanderDepthHz, barTime, PAD_VOICE_LP_SLEW_S);
    rampParamAt(voice.octaveGain.gain, rails.padOctaveLevel, barTime, PAD_VOICE_GAIN_SLEW_S);
    voice.organGain.gain.setTargetAtTime(rails.padOrganLevel, barTime, MASTER_TAU_S);
  });
  const padTarget = rails.padBusLevel;
  padGain!.gain.setTargetAtTime(padTarget, barTime, BAR_PARAM_TAU_S);
  rampParamAt(padDriveWet!.gain, rails.padDriveWet, barTime, DRIVE_WET_SLEW_S);
  padSpectralDepth?.gain.setTargetAtTime(rails.padSpectralDepthHz, barTime, MASTER_TAU_S);
  if (padRetuned && g.padChoir > STAGE1_GATE_EPSILON && padTarget > 0 && !offlineSuppressTransientVoices) {
    padBreath(ctx, barTime, rails.padBreathLevel);
  }
  // Stage 1 material+ blends: whole-bed mono-below crossover, designed sub, lead drive.
  rampParamAt(xoverBypass!.gain, rails.xoverBypass, barTime, XOVER_BLEND_SLEW_S);
  rampParamAt(xoverLow!.gain, rails.xoverLow, barTime, XOVER_BLEND_SLEW_S);
  rampParamAt(xoverHigh!.gain, rails.xoverHigh, barTime, XOVER_BLEND_SLEW_S);
  rampParamAt(subDesignBypass!.gain, rails.subDesignBypass, barTime, SUB_DESIGN_SLEW_S);
  rampParamAt(subDesignOut!.gain, rails.subDesignOut, barTime, SUB_DESIGN_SLEW_S);
  rampParamAt(subDriveWet!.gain, rails.subDriveWet, barTime, DRIVE_WET_SLEW_S);
  if (leadDriveWet) rampParamAt(leadDriveWet.gain, rails.leadDriveWet, barTime, DRIVE_WET_SLEW_S);

  // -- Sub: triangle chip bass and sine/harmonic hybrid are separate persistent
  // voices. Submergence crossfades the root drone against a dedicated motif
  // oscillator, so neither timbre nor musical role ever swaps in place.
  const chipTimbre = 1 - g.padChoir;
  const hybridSubHz = hzOf(plan.publish.root + SUB_OCTAVE_SHIFT);
  const chipSubHz = hzOf(plan.publish.root);
  subSineOsc!.frequency.setTargetAtTime(hybridSubHz, barTime, SUB_GLIDE_TAU_S);
  subTriangleOsc!.frequency.setTargetAtTime(chipSubHz, barTime, SUB_GLIDE_TAU_S);
  subHarmonicOsc!.frequency.setTargetAtTime(
    hybridSubHz * SUB_HARMONIC_RATIO,
    barTime,
    SUB_GLIDE_TAU_S
  );
  subSineGain!.gain.setTargetAtTime(1 - chipTimbre, barTime, SUB_TIMBRE_CROSSFADE_S);
  subTriangleGain!.gain.setTargetAtTime(
    chipTimbre * SUB_TRIANGLE_TRIM,
    barTime,
    SUB_TIMBRE_CROSSFADE_S
  );
  subHarmonicGain!.gain.setTargetAtTime(
    SUB_HARMONIC_LEVEL *
      g.padChoir *
      (1 + SUB_THERMAL_HARMONIC_LIFT * clamp01(s.thermal)),
    barTime,
    SUB_TIMBRE_CROSSFADE_S
  );
  const subMotifVoiceMix = smoothstep01(
    (plan.subMotifMix - SUB_MOTIF_CROSSFADE_START) /
      (SUB_MOTIF_CROSSFADE_END - SUB_MOTIF_CROSSFADE_START)
  );
  subDroneGain!.gain.setTargetAtTime(1 - subMotifVoiceMix, barTime, SUB_MOTIF_CROSSFADE_S);
  subMotifGain!.gain.setTargetAtTime(subMotifVoiceMix, barTime, SUB_MOTIF_CROSSFADE_S);
  const subTarget =
    BED_SUB_LEVEL *
    plan.levels.sub *
    g.sub *
    (1 + SUB_NIGHT_GAIN_LIFT * (1 - clamp01(s.daylight)));
  subGain!.gain.setTargetAtTime(subTarget, barTime, BAR_PARAM_TAU_S);

  // -- Chip drone: the bare-era floor and the paradox fold-back. Bare is
  // MONOPHONIC (§8.5): the drone yields while the lone chip arp speaks.
  chipOsc!.frequency.setTargetAtTime(hzOf(plan.publish.root + CHIP_DRONE_OCTAVE), barTime, SUB_GLIDE_TAU_S);
  const chipBase =
    CHIP_DRONE_LEVEL *
    g.chip *
    Math.max(plan.levels.pad, CHIP_SUB_LEVEL_WEIGHT * plan.levels.sub);
  chipGain!.gain.setTargetAtTime(chipBase, barTime, BAR_PARAM_TAU_S);
  chipNoiseGain!.gain.setTargetAtTime(
    plan.chipMono ? CHIP_NOISE_FLOOR_LEVEL : 0,
    barTime,
    CHIP_FLOOR_SLEW_S
  );

  // -- Ostinato: transient plucks — or, underwater, the sub sings the tune.
  // At `color`, two pulse channels are the entire harmonic budget. A lead
  // statement (lead + its optional chord-tone partner) owns both; otherwise
  // the pulse drone and the monophonic ostinato own one each.
  const strictColorPulseBudget =
    !plan.chipMono && g.chipHarmony > CHIP_COLOR_GATE_EPSILON && g.padChoir <= CHIP_COLOR_GATE_EPSILON;
  const colorLeadOwnsPulses = strictColorPulseBudget && plan.melody.length > 0;
  const ostTarget =
    BED_OST_LEVEL * plan.levels.ostinato * (1 - plan.subMotifMix) * (colorLeadOwnsPulses ? 0 : 1);
  ostGain!.gain.setTargetAtTime(ostTarget, barTime, BAR_PARAM_TAU_S);
  ostFilter!.frequency.setTargetAtTime(
    OST_FILTER_MIN_HZ + clamp01(s.energy) * OST_FILTER_SPAN_HZ,
    barTime,
    BAR_PARAM_TAU_S
  );
  for (const note of offlineSuppressTransientVoices ? [] : plan.ostinato) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + note.slot * slotSec + jitter);
    const holdSec = note.durationSlots * slotSec;
    if (plan.subMotifMix > SUB_MOTIF_ACTIVE_EPSILON) {
      // Pick a voice whose prior envelope is already at true zero. The pool is
      // sized for the densest legal doubled fragment; the defensive no-voice
      // case composes silence rather than ever retuning a sounding oscillator.
      const retuneAt = Math.max(ctx.currentTime, at - SUB_MOTIF_RETUNE_LEAD_S);
      let selected: SubMotifVoice | null = null;
      for (let offset = 0; offset < subMotifVoices.length; offset++) {
        const index = (subMotifVoiceCursor + offset) % subMotifVoices.length;
        const candidate = subMotifVoices[index];
        if (candidate.availableAt <= retuneAt) {
          selected = candidate;
          subMotifVoiceCursor = (index + 1) % subMotifVoices.length;
          break;
        }
      }
      if (selected) {
        const releaseAt = at + Math.max(SUB_MOTIF_NOTE_ATTACK_S, holdSec * SUB_MOTIF_NOTE_HOLD_SCALE);
        const silentAt = releaseAt + SUB_MOTIF_NOTE_RELEASE_S;
        selected.gain.gain.cancelScheduledValues(retuneAt);
        selected.gain.gain.setValueAtTime(0, retuneAt);
        selected.osc.frequency.setValueAtTime(
          hzOf(note.semis + SUB_MOTIF_OCTAVE_SHIFT),
          retuneAt
        );
        selected.gain.gain.setValueAtTime(0, at);
        selected.gain.gain.linearRampToValueAtTime(note.velocity, at + SUB_MOTIF_NOTE_ATTACK_S);
        selected.gain.gain.setValueAtTime(note.velocity, releaseAt);
        selected.gain.gain.linearRampToValueAtTime(0, silentAt);
        selected.availableAt = silentAt;
      }
    }
    if (plan.subMotifMix < 1 - SUB_MOTIF_ACTIVE_EPSILON && !colorLeadOwnsPulses) {
      pluck(ctx, at, note.semis, note.velocity, holdSec, g.chip > 0.5 ? 'square' : 'triangle');
    }
    if ((plan.chipMono || strictColorPulseBudget) && !colorLeadOwnsPulses && chipGain) {
      rampParamAt(chipGain.gain, chipBase * CHIP_MONO_DUCK, at, OST_ATTACK_S);
      rampParamAt(
        chipGain.gain,
        chipBase,
        at + Math.max(OST_ATTACK_S, holdSec * CHIP_PULSE_RELEASE_SCALE),
        CHIP_FLOOR_SLEW_S
      );
    }
  }

  // -- Lead statements (rare; the tune's entrances carry the emotion). In the
  // chip eras the lead is a PULSE with NES vibrato and — at `color` — the trio's
  // second pulse a chord tone below (§8.5). The delay space is era-gated:
  // bare is bone dry, color gets the single slapback, material+ full feedback.
  leadGain!.gain.setTargetAtTime(BED_LEAD_LEVEL * plan.levels.lead, barTime, BAR_PARAM_TAU_S);
  leadDelay?.delayTime.setTargetAtTime(beatDur * 0.75, barTime, BAR_PARAM_TAU_S);
  leadDelayMixNode?.gain.setTargetAtTime(LEAD_DELAY_MIX * g.delay, barTime, BAR_PARAM_TAU_S);
  leadDelayFeedbackNode?.gain.setTargetAtTime(LEAD_DELAY_FEEDBACK * g.padChoir, barTime, BAR_PARAM_TAU_S);
  const chipLead = g.padChoir < 0.5;
  const vibratoCents = chipLead ? CHIP_VIBRATO_CENTS * g.vibrato : 0;
  for (const note of offlineSuppressTransientVoices ? [] : plan.melody) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + note.slot * slotSec + jitter);
    const durSec = note.durationSlots * slotSec;
    const velocity = chipLead ? note.velocity * CHIP_LEAD_TRIM : note.velocity;
    if (strictColorPulseBudget && chipGain) {
      rampParamAt(chipGain.gain, chipBase * CHIP_MONO_DUCK, at, LEAD_ATTACK_S);
      rampParamAt(
        chipGain.gain,
        chipBase,
        at + Math.max(LEAD_ATTACK_S, durSec),
        CHIP_FLOOR_SLEW_S
      );
    }
    leadNote(ctx, at, note.semis, velocity, durSec, chipLead, vibratoCents);
    if (chipLead && g.chipHarmony > 0.01) {
      leadNote(
        ctx,
        at,
        chordToneBelow(note.semis, plan.publish.tones),
        velocity * CHIP_HARMONY_LEVEL * g.chipHarmony,
        durSec,
        true,
        vibratoCents
      );
    }
  }

  // -- Shimmer + wash: the texture family, reweighted by the texture drift clock.
  const shimmerLean = 1 - DRIFT_TEXTURE_SPAN + 2 * DRIFT_TEXTURE_SPAN * plan.textureLean;
  const shimmerBase =
    BED_SHIMMER_LEVEL *
    plan.levels.texture *
    g.shimmer *
    shimmerLean *
    (0.5 + 0.5 * clamp01(s.crystalline)) *
    (1 + NIGHT_SHIMMER_GAIN_LIFT * (1 - clamp01(s.daylight)));
  shimmerGain!.gain.setTargetAtTime(shimmerBase, barTime, MASTER_TAU_S);
  shimmerLfoDepth?.gain.setTargetAtTime(shimmerBase * SHIMMER_LFO_DEPTH, barTime, MASTER_TAU_S);
  const shimTones = [plan.publish.tones[1] ?? 12, plan.publish.tones[3] ?? 19];
  const shimmerHzA = hzOf(shimTones[0] + SHIMMER_OCTAVE_SHIFT);
  const shimmerHzB = hzOf(shimTones[1] + SHIMMER_OCTAVE_SHIFT);
  shimmerA!.frequency.setTargetAtTime(shimmerHzA, barTime, MASTER_TAU_S);
  shimmerB!.frequency.setTargetAtTime(shimmerHzB, barTime, MASTER_TAU_S);
  shimmerModA!.frequency.setTargetAtTime(shimmerHzA * SHIMMER_FM_RATIO, barTime, SHIMMER_FM_SLEW_S);
  shimmerModB!.frequency.setTargetAtTime(shimmerHzB * SHIMMER_FM_RATIO, barTime, SHIMMER_FM_SLEW_S);
  const fmDepth = SHIMMER_FM_INDEX * g.shimmer * clamp01(s.crystalline);
  shimmerModDepthA!.gain.setTargetAtTime(shimmerHzA * fmDepth, barTime, SHIMMER_FM_SLEW_S);
  shimmerModDepthB!.gain.setTargetAtTime(shimmerHzB * fmDepth, barTime, SHIMMER_FM_SLEW_S);
  shimmerPan!.pan.setTargetAtTime(0.4 * g.stereoWidth, barTime, MASTER_TAU_S);

  const washLean = 1 - DRIFT_TEXTURE_SPAN + 2 * DRIFT_TEXTURE_SPAN * (1 - plan.textureLean);
  const washBase = BED_WASH_LEVEL * plan.levels.texture * g.riser * plan.wind.drive * washLean;
  washGain!.gain.setTargetAtTime(washBase, barTime, MASTER_TAU_S);
  washGustDepth?.gain.setTargetAtTime(washBase * WASH_GUST_LFO_DEPTH, barTime, MASTER_TAU_S);
  washGustLfo?.frequency.setTargetAtTime(
    WASH_GUST_LFO_BASE_HZ * (0.5 + s.windGustSpeed), barTime, MASTER_TAU_S
  );
  washFilter!.frequency.setTargetAtTime(
    WASH_FILTER_MIN_HZ +
      plan.wind.drive * WASH_FILTER_SPAN_HZ +
      plan.wind.turbulence * PAD_TURBULENCE_MOTION_HZ,
    barTime,
    MASTER_TAU_S
  );
  washPan!.pan.setTargetAtTime(plan.wind.pan * g.stereoWidth, barTime, MASTER_TAU_S);
  washPanDepth?.gain.setTargetAtTime(
    plan.wind.turbulence * g.stereoWidth,
    barTime,
    MASTER_TAU_S
  );

  // -- Percussion: Euclidean transients (the noise channel from `color` up).
  percGain!.gain.setTargetAtTime(BED_PERC_LEVEL * plan.levels.percussion * g.percussion, barTime, BAR_PARAM_TAU_S);
  percFilter!.frequency.setTargetAtTime(
    PERC_FILTER_BASE_HZ + clamp01(s.metal) * PERC_FILTER_METAL_LIFT_HZ,
    barTime,
    BAR_PARAM_TAU_S
  );
  percFilter!.Q.setTargetAtTime(PERC_Q_BASE + clamp01(s.metal) * PERC_Q_METAL, barTime, BAR_PARAM_TAU_S);
  for (const slot of offlineSuppressTransientVoices ? [] : plan.percussion) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + slot * slotSec + jitter);
    percHit(ctx, at, plan.barIndex * 31 + slot, g.stereoWidth, g.padChoir);
  }

  // -- The pulse (Stage 5): root-tuned onsets on the felt beats the plan named,
  //    body share = the alive gate (click + tail alone at material). Levels are
  //    per-bar rails; onsets are bounded transient nodes like percHit.
  if (pulseBodyGain && pulseTransientGain) {
    rampParamAt(pulseBodyGain.gain, BED_PULSE_BODY_LEVEL * plan.pulse.level * plan.pulse.body, barTime, BAR_PARAM_TAU_S);
    rampParamAt(pulseTransientGain.gain, plan.pulse.level, barTime, BAR_PARAM_TAU_S);
    const bodyHz = pulseBodyHz(hzOf(plan.publish.root));
    for (const b of offlineSuppressTransientVoices ? [] : plan.pulse.beats) {
      const at = Math.max(ctx.currentTime, barTime + b * beatDur);
      pulseHit(ctx, at, bodyHz, plan.pulse.body > 0.001);
    }
  }

  // -- Sidechain breathing: transport-keyed dips, sample-accurate (§8.2).
  //    Stage 5: the dips key off the PULSE onsets and nowhere else — no pumping
  //    without a source (depth is already 0 outside BUILD/BLOOM and their release).
  if (breathGain) {
    const depth = plan.sidechainDepth;
    breathGain.gain.cancelAndHoldAtTime(barTime);
    if (depth > 0.01 && plan.pulse.beats.length > 0) {
      const release = SIDECHAIN_RELEASE_BEATS * beatDur;
      for (const b of plan.pulse.beats) {
        const at = barTime + b * beatDur;
        // The old automation hard-stepped directly to 1-depth on the beat. A
        // named attack keeps the ODESZA breath while bounding gain derivative.
        // Anchor unity ON the beat so the preceding release does not begin
        // interpolating toward this dip during the quarter-beat gap.
        breathGain.gain.linearRampToValueAtTime(1, at);
        breathGain.gain.linearRampToValueAtTime(1 - depth, at + SIDECHAIN_ATTACK_S);
        breathGain.gain.linearRampToValueAtTime(1, at + release);
      }
    } else {
      rampParamAt(breathGain.gain, 1, barTime, SIDECHAIN_BYPASS_SLEW_S);
    }
  }

  // -- Riser: the BUILD's riser lands EXACTLY on the planned bloom boundary
  //    (Stage 5: a build may span 1–3 phrases; the plan names the bars left).
  if (plan.buildPhrase && plan.phrasePos === 0 && !riserBuilding && riserGain && riserFilter) {
    const bloomTime = barTime + (plan.buildBarsToBloom ?? PHRASE_BARS) * barDur;
    const filterRiseAt = barTime + RISER_BUILD_GAIN_SLEW_S;
    // Start-anchored target curves cannot interpolate backward from an older
    // automation event. The gain reaches its 95%-settled build target at the
    // phrase boundary, then BLOOM releases from the value actually rendered.
    rampParamAt(
      riserGain.gain,
      Math.max(0.001, BED_RISER_LEVEL * g.riser),
      barTime,
      Math.max(RISER_BUILD_GAIN_SLEW_S, bloomTime - barTime)
    );
    rampParamAt(
      riserFilter.frequency,
      RISER_FILTER_FROM_HZ,
      barTime,
      RISER_BUILD_GAIN_SLEW_S
    );
    rampParamAt(
      riserFilter.frequency,
      RISER_FILTER_TO_HZ,
      filterRiseAt,
      Math.max(RISER_BUILD_GAIN_SLEW_S, bloomTime - filterRiseAt)
    );
    riserBuilding = true;
  }
  if (riserBuilding && !plan.buildPhrase && !plan.bloomEntered && riserGain) {
    // Forced EBB / aborted BUILD used to leave the phrase-long future ramp
    // alive, so an invisible riser kept getting louder. Hold its actual value
    // and release structurally.
    rampParamAt(riserGain.gain, 0, barTime, RISER_ABORT_RELEASE_S);
    riserBuilding = false;
  }
  if (plan.bloomEntered && riserGain) {
    // Hold the ACTUAL build endpoint before cutting. The former setValue used
    // the new era gate and could jump at BUILD→BLOOM when the era moved mid-build.
    rampParamAt(riserGain.gain, 0, barTime, RISER_CUT_S);
    riserBuilding = false;
  }

  // -- Stage 1 alive trim × night trim: the bed bus and both room returns, gated by padChoir.
  const aliveTrim = rails.aliveTrim;
  rampParamAt(bedBus!.gain, aliveTrim, barTime, BED_ALIVE_LIFT_SLEW_S);

  // -- Reverb space: era depth × atmosphere.
  reverbWet!.gain.setTargetAtTime(
    REVERB_WET_MAX * g.reverb * clamp01(s.atmosphere) * aliveTrim, barTime, MASTER_TAU_S
  );
  const bloomSpace =
    (plan.arrangement === 'BLOOM' ? 1 : BLOOM_REVERB_STATE_FLOOR) +
    BLOOM_REVERB_GOLDEN_LIFT * clamp01(s.golden);
  bloomReverbWet!.gain.setTargetAtTime(
    BLOOM_REVERB_WET_MAX * g.reverb * clamp01(s.atmosphere) * bloomSpace * aliveTrim,
    barTime,
    MASTER_TAU_S
  );

  // -- The world-clock tick: presence/level fade over whole bars, at bar lines.
  // At paradox the clock may SPLIT (§8.5): a second timeline at the golden
  // ratio of the first — the game remembering that time has two readings.
  const tickTarget =
    BED_TICK_LEVEL * plan.tick.presence * (0.3 + 0.7 * plan.tick.level);
  if (Math.abs(tickTarget - tickLevelApplied) > 0.005 && tickGain) {
    tickGain.gain.setTargetAtTime(tickTarget, barTime, barDur * TICK_BAR_FADE_FRAC);
    tickLevelApplied = tickTarget;
  }
  tickHzTarget = plan.tick.hz;
  tick2HzTarget = plan.tick.splitHz ?? 0;
  tick2MixTarget = plan.tick.splitHz == null ? 0 : plan.tick.presence;

  // -- Warp exit / arrival / awakening: grid punctuation through the shared
  // hit path (scheduleHit rides THIS transport's grid while the bed leads).
  // Offline renders route the hit into their own chain instead.
  if (!offlineSuppressTransientVoices && (plan.warpExitBoom || plan.landingPivot || plan.stageBloom)) {
    const kind = plan.landingPivot || plan.stageBloom ? 'bloom' : 'boom';
    if (offlineHitSink) offlineHitSink(kind, barTime);
    else scheduleHit(kind, 'bar');
  }
  // Public bed-owned hits are queued by exact grid time. Instantiate them only
  // now that this onset window's chord and era palette are known.
  flushScheduledBedHits(
    barTime,
    barTime + barDur,
    plan.publish,
    s.era,
    s.stage
  );

  lastBedDebug = {
    barIndex: plan.barIndex,
    quality: bedQuality,
    stage: s.stage,
    era: s.era,
    scene: s.scene,
    arrangement: plan.arrangement,
    daylight: s.daylight,
    golden: s.golden,
    submergence: s.submergence,
    rootSemis: plan.publish.root,
    padLevel: padTarget,
    subLevel: subTarget,
    ostinatoLevel: ostTarget,
    shimmerLevel: shimmerBase,
    washLevel: washBase,
    subMotifMix: plan.subMotifMix,
    tickHz: plan.tick.hz,
    tickPresence: plan.tick.presence,
    windGust: plan.wind.gust,
    windDrive: plan.wind.drive,
    windPan: plan.wind.pan,
    sectionIndex: plan.sectionIndex,
    bloomLift: plan.bloomLift,
    pulseLevel: plan.pulse.level
  };
}

/** Nearest chord tone strictly below `semis` (chord pcs exist in every octave). */
function chordToneBelow(semis: number, tones: readonly number[]): number {
  const pcs = new Set(tones.map((t) => ((t % 12) + 12) % 12));
  for (let cand = semis - 1; cand >= semis - 12; cand--) {
    if (pcs.has(((cand % 12) + 12) % 12)) return cand;
  }
  return semis - 12;
}

// --- Transients (bounded lifetimes, like the shipped score voices) -----------------------------------

/** Stage 1 attack breath: a 60 ms filtered-noise puff on a pad retune (material+). */
function padBreath(ctx: BaseAudioContext, at: number, level: number): void {
  if (!padBreathNoise || !padBreathFilter || level <= 0) return;
  const src = ctx.createBufferSource();
  src.buffer = padBreathNoise;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + PAD_BREATH_ATTACK_S);
  env.gain.linearRampToValueAtTime(0, at + PAD_BREATH_S);
  src.connect(env);
  env.connect(padBreathFilter);
  src.start(at);
  src.stop(at + PAD_BREATH_S + PAD_BREATH_STOP_TAIL_S);
  src.onended = () => {
    src.disconnect();
    env.disconnect();
  };
}

function pluck(
  ctx: BaseAudioContext,
  at: number,
  semis: number,
  velocity: number,
  holdSec: number,
  wave: OscillatorType
): void {
  if (!ostFilter) return;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = hzOf(semis);
  const env = ctx.createGain();
  const releaseScale = wave === 'square' ? CHIP_PULSE_RELEASE_SCALE : 1.7;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(velocity, at + OST_ATTACK_S);
  env.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.08, holdSec * releaseScale));
  osc.connect(env);
  env.connect(ostFilter);
  osc.start(at);
  osc.stop(at + Math.max(0.1, holdSec * 2));
}

function leadNote(
  ctx: BaseAudioContext,
  at: number,
  semis: number,
  velocity: number,
  durSec: number,
  chip = false,
  vibratoCents = 0
): void {
  if (!leadFilter) return;
  const osc = ctx.createOscillator();
  osc.type = chip ? 'square' : 'triangle';
  osc.frequency.value = hzOf(semis);
  const stopAt = at + Math.max(0.3, durSec) + 0.1;
  // NES vibrato (§8.5 — unlocks at `color`): a bounded-lifetime pitch LFO.
  if (vibratoCents > 0.5) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = CHIP_VIBRATO_HZ;
    const depth = ctx.createGain();
    depth.gain.value = vibratoCents;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(at);
    lfo.stop(stopAt);
  }
  const env = ctx.createGain();
  const peak = velocity;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), at + LEAD_ATTACK_S);
  env.gain.setValueAtTime(Math.max(0.001, peak), at + Math.max(LEAD_ATTACK_S, durSec * 0.6));
  env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.2, durSec));
  osc.connect(env);
  env.connect(leadFilter);
  osc.start(at);
  osc.stop(stopAt);
}

function percHit(
  ctx: BaseAudioContext,
  at: number,
  salt: number,
  width: number,
  materialBody: number
): void {
  if (!percFilter || !percNoise || !percPan || !percGain || !conductor) return;
  const src = ctx.createBufferSource();
  src.buffer = percNoise;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(1, at + PERC_ATTACK_S);
  env.gain.exponentialRampToValueAtTime(0.001, at + PERC_DECAY_S);
  src.connect(env);
  env.connect(percFilter);

  // ODESZA-scale pitch-drop body begins at material+. Color retains the
  // period-authentic single NES noise channel, with no modern sine layer.
  let body: OscillatorNode | null = null;
  if (materialBody > 0) {
    body = ctx.createOscillator();
    body.type = 'sine';
    const bodyStart =
      PERC_BODY_START_HZ +
      musicUnit(conductor.planetSeed, SALT_PERC_PAN, salt + 1) * PERC_BODY_PITCH_SPAN_HZ;
    body.frequency.setValueAtTime(bodyStart, at);
    body.frequency.exponentialRampToValueAtTime(PERC_BODY_END_HZ, at + PERC_BODY_DECAY_S);
    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(PERC_BODY_ENVELOPE_FLOOR, at);
    bodyEnv.gain.exponentialRampToValueAtTime(
      PERC_BODY_LEVEL * clamp01(materialBody),
      at + PERC_ATTACK_S
    );
    bodyEnv.gain.exponentialRampToValueAtTime(
      PERC_BODY_ENVELOPE_FLOOR,
      at + PERC_BODY_DECAY_S
    );
    body.connect(bodyEnv);
    bodyEnv.connect(percGain);
  }
  const pan = (musicUnit(conductor.planetSeed, SALT_PERC_PAN, salt) * 2 - 1) * PERC_PAN_SPREAD * width;
  rampParamAt(percPan.pan, pan, at, PERC_PAN_SLEW_S);
  src.start(at);
  src.stop(at + PERC_DECAY_S + PERC_NODE_STOP_TAIL_S);
  body?.start(at);
  body?.stop(at + PERC_BODY_DECAY_S + PERC_NODE_STOP_TAIL_S);
}

/**
 * One pulse onset (Stage 5): click (2 ms noise, highpassed) + tail (60 ms noise,
 * bandpassed 200 Hz) into the dry transient gain, and — when the alive gate is
 * open — a sine body dropping from PULSE_BODY_HZ_FROM to the chord root's sub
 * over PULSE_BODY_DECAY_S into the designed sub path. Bounded node lifetimes.
 */
function pulseHit(ctx: BaseAudioContext, at: number, bodyHz: number, withBody: boolean): void {
  if (!percNoise || !pulseClickFilter || !pulseTailFilter || !pulseBodyGain) return;
  const click = ctx.createBufferSource();
  click.buffer = percNoise;
  const clickEnv = ctx.createGain();
  clickEnv.gain.setValueAtTime(BED_PULSE_CLICK_LEVEL, at);
  clickEnv.gain.linearRampToValueAtTime(0, at + PULSE_CLICK_S);
  click.connect(clickEnv);
  clickEnv.connect(pulseClickFilter);
  click.start(at);
  click.stop(at + PULSE_CLICK_S + PULSE_NODE_STOP_TAIL_S);

  const tail = ctx.createBufferSource();
  tail.buffer = percNoise;
  const tailEnv = ctx.createGain();
  tailEnv.gain.setValueAtTime(BED_PULSE_TAIL_LEVEL, at);
  tailEnv.gain.exponentialRampToValueAtTime(PULSE_BODY_ENVELOPE_FLOOR, at + PULSE_TAIL_S);
  tail.connect(tailEnv);
  tailEnv.connect(pulseTailFilter);
  tail.start(at);
  tail.stop(at + PULSE_TAIL_S + PULSE_NODE_STOP_TAIL_S);

  if (withBody) {
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(PULSE_BODY_HZ_FROM, at);
    body.frequency.exponentialRampToValueAtTime(bodyHz, at + PULSE_BODY_DECAY_S);
    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(PULSE_BODY_ENVELOPE_FLOOR, at);
    bodyEnv.gain.exponentialRampToValueAtTime(1, at + PULSE_CLICK_S * 2);
    bodyEnv.gain.exponentialRampToValueAtTime(PULSE_BODY_ENVELOPE_FLOOR, at + PULSE_BODY_DECAY_S * 2);
    body.connect(bodyEnv);
    bodyEnv.connect(pulseBodyGain);
    body.start(at);
    body.stop(at + PULSE_BODY_DECAY_S * 2 + PULSE_NODE_STOP_TAIL_S);
  }
}

// --- The world-clock tick (its own clock — NEVER the musical grid; §8.1) -------------------------------

function scheduleTicks(ctx: BaseAudioContext, now: number): void {
  if (!tickGain) return;
  // Rate GLIDES (≥ TICK_GLIDE_S): smooth the live rate toward its target.
  const k = Math.min(1, SCHEDULER_INTERVAL_MS / 1000 / TICK_GLIDE_S);
  const tick2K = Math.min(1, SCHEDULER_INTERVAL_MS / 1000 / TICK2_CROSSFADE_S);
  tickHzLive += (tickHzTarget - tickHzLive) * k;
  tick2MixLive += (tick2MixTarget - tick2MixLive) * tick2K;
  if (nextTickAt < now) nextTickAt = now + 1 / tickHzLive;
  // No transient nodes while the tick bus is silent (main-thread budget) —
  // the timeline still advances so the clock never re-syncs to the music.
  const silent = tickLevelApplied <= 0.001;
  while (nextTickAt < now + LOOKAHEAD_S) {
    if (!silent) tickHit(ctx, nextTickAt);
    nextTickAt += 1 / tickHzLive;
  }
  // The paradox SECOND clock (§8.5): its own timeline at the golden ratio of
  // the first — the two never re-phase, and it never re-syncs either.
  if (tick2HzTarget > 0 || tick2MixLive > TICK2_SILENT_EPSILON) {
    if (tick2HzLive <= 0) tick2HzLive = tick2HzTarget;
    else if (tick2HzTarget > 0) tick2HzLive += (tick2HzTarget - tick2HzLive) * k;
    if (nextTick2At < now) nextTick2At = now + 1 / tick2HzLive;
    while (nextTick2At < now + LOOKAHEAD_S) {
      if (!silent && tick2MixLive > TICK2_SILENT_EPSILON) {
        tickHit(ctx, nextTick2At, PARADOX_TICK2_LEVEL * tick2MixLive);
      }
      nextTick2At += 1 / tick2HzLive;
    }
  } else {
    tick2HzLive = 0;
  }
}

function tickHit(ctx: BaseAudioContext, at: number, levelScale = 1): void {
  if (!tickGain) return;
  const metal = clamp01(signals.metal);
  const base = TICK_FREQ_WOOD_HZ + (TICK_FREQ_METAL_HZ - TICK_FREQ_WOOD_HZ) * metal;
  const mk = (freq: number, gain: number): void => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, at + TICK_DECAY_S);
    osc.connect(env);
    env.connect(tickGain!);
    osc.start(at);
    osc.stop(at + TICK_DECAY_S + 0.05);
  };
  mk(base, levelScale);
  if (metal > 0.05) mk(base * TICK_PARTIAL_RATIO, 0.5 * metal * levelScale);
}

// --- Offline render rim (P4 verification harness) ------------------------------------------------
//
// The soak/audition harness drives THE SAME graph builder, bar scheduler, and
// tick voice on an OfflineAudioContext, stepping time through suspend/resume
// checkpoints instead of the live 60 ms interval. Guarded so it can never run
// while the live bed exists; the live path is untouched when unused.

export interface OfflineBedHooks {
  /** Called once per planned bar, right after it is scheduled (soak audits). */
  onBar?: (plan: BedBarPlan, barTime: number, barDur: number) => void;
  /** Receives warp-exit booms / landing-pivot blooms instead of the live hit path. */
  onHit?: (kind: 'bloom' | 'boom', atTime: number) => void;
  /** Persistent-control audit: omit note/tick/perc/hit envelopes, retain all rails. */
  suppressTransientVoices?: boolean;
}

/**
 * Begin an offline bed render: fresh conductor, fresh transport, the full
 * voice graph built on `ctx` into `out`. Returns the conductor so the harness
 * can snapshot harmony state around each bar (read-only). Throws if the live
 * bed is running — offline rendering needs a page of its own.
 */
export function beginOfflineBedRender(
  ctx: BaseAudioContext,
  out: AudioNode,
  planetSeed: number,
  opts?: CreateBedOptions & OfflineBedHooks & { quality?: BedQualityTier }
): BedConductorState {
  if (built || schedulerTimer != null) {
    throw new Error('bedEngine is live — offline rendering requires a fresh page');
  }
  built = true;
  conductor = createBedConductor(planetSeed, opts);
  transport = null;
  signals = neutralBedSignals();
  noteSalt = 0;
  tickHzLive = 1;
  tickHzTarget = 1;
  tickLevelApplied = -1;
  nextTickAt = 0;
  tick2HzLive = 0;
  tick2HzTarget = 0;
  tick2MixLive = 0;
  tick2MixTarget = 0;
  nextTick2At = 0;
  yielding = false;
  bedLeadTargetGain = BED_MASTER_GAIN;
  bedAuthorityFadeUntil = 0;
  riserBuilding = false;
  lastBedDebug = null;
  lastPlannedBedHitWindow = null;
  onBarHook = opts?.onBar ?? null;
  offlineHitSink = opts?.onHit ?? null;
  offlineSuppressTransientVoices = opts?.suppressTransientVoices ?? false;
  bedQuality = opts?.quality ?? 'full';
  buildBedGraph(ctx, out);
  // Skip the live master fade-in: renders start at the composed level.
  bedMaster!.gain.value = BED_MASTER_GAIN;
  return conductor;
}

/** One offline checkpoint: write the world snapshot, then schedule the horizon. */
export function stepOfflineBedRender(ctx: BaseAudioContext, now: number, next: BedSignals): void {
  signals = next;
  if (next.storyLeads) {
    if (conductor) conductor.prevStage = next.stage;
    if (!yielding) {
      yielding = true;
      bedAuthorityFadeUntil = now + STORY_AUTHORITY_CROSSFADE_S;
      if (bedMaster) rampParamAt(bedMaster.gain, 0, now, STORY_AUTHORITY_CROSSFADE_S);
    }
    return;
  }
  if (yielding) {
    yielding = false;
    if (conductor) noteStoryHandBack(conductor);
    bedLeadTargetGain = resolveBedLeadTarget(next.scene);
    bedAuthorityFadeUntil = now + STORY_AUTHORITY_CROSSFADE_S;
    if (bedMaster) {
      rampParamAt(
        bedMaster.gain,
        bedLeadTargetGain,
        now,
        STORY_AUTHORITY_CROSSFADE_S
      );
    }
  }
  advanceBedScheduling(ctx, now, next);
}

/** Tear down offline module state so a later render (or the live game) starts clean. */
export function endOfflineBedRender(): void {
  built = false;
  conductor = null;
  transport = null;
  onBarHook = null;
  offlineHitSink = null;
  offlineSuppressTransientVoices = false;
  signals = neutralBedSignals();
  noteSalt = 0;
  tickHzLive = 1;
  tickHzTarget = 1;
  tickLevelApplied = -1;
  nextTickAt = 0;
  tick2HzLive = 0;
  tick2HzTarget = 0;
  tick2MixLive = 0;
  tick2MixTarget = 0;
  nextTick2At = 0;
  yielding = false;
  bedLeadTargetGain = BED_MASTER_GAIN;
  bedAuthorityFadeUntil = 0;
  riserBuilding = false;
  lastBedDebug = null;
  lastPlannedBedHitWindow = null;
  bedMaster = null;
  bedBus = null;
  breathGain = null;
  reverbSend = null;
  reverbWet = null;
  bloomReverbSend = null;
  bloomReverbWet = null;
  padVoices = [];
  padGain = null;
  padDriveWet = null;
  padSpectralLfo = null;
  padSpectralDepth = null;
  padBreathNoise = null;
  padBreathFilter = null;
  bedQuality = 'full';
  xoverBypass = null;
  xoverLow = null;
  xoverHigh = null;
  subDesignBypass = null;
  subDesignOut = null;
  subDriveWet = null;
  leadDriveWet = null;
  subSineOsc = null;
  subTriangleOsc = null;
  subHarmonicOsc = null;
  subMotifVoices = [];
  subMotifVoiceCursor = 0;
  subSineGain = null;
  subTriangleGain = null;
  subHarmonicGain = null;
  subDroneGain = null;
  subMotifGain = null;
  subGain = null;
  chipOsc = null;
  chipGain = null;
  chipNoiseGain = null;
  ostFilter = null;
  ostGain = null;
  leadFilter = null;
  leadGain = null;
  shimmerA = null;
  shimmerB = null;
  shimmerGain = null;
  shimmerPan = null;
  shimmerModA = null;
  shimmerModB = null;
  shimmerModDepthA = null;
  shimmerModDepthB = null;
  washFilter = null;
  washGain = null;
  washPan = null;
  washGustLfo = null;
  washGustDepth = null;
  washPanLfo = null;
  washPanDepth = null;
  percFilter = null;
  percGain = null;
  percPan = null;
  percNoise = null;
  riserFilter = null;
  riserGain = null;
  tickGain = null;
  pulseBodyGain = null;
  pulseClickFilter = null;
  pulseTailFilter = null;
  pulseTransientGain = null;
  leadDelay = null;
  leadDelayMixNode = null;
  leadDelayFeedbackNode = null;
  shimmerLfoDepth = null;
}
/** Resolve at handoff time so a scene change behind a long story cannot resume stale. */
export function resolveBedLeadTarget(scene: BedSignals['scene']): number {
  return BED_MASTER_GAIN * BED_SCENE_POLICY[scene].gain;
}
