import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import type { MusicScene } from '../musicDirector.ts';
import type { ChordAnchor, ModeName } from './theory.ts';
import type { MotifOp } from './motif.ts';

/** The §8.3 arrangement states. REST is the quiet-bed floor — never true silence. */
export type ArrangementStateName = 'REST' | 'BED' | 'BUILD' | 'BLOOM' | 'EBB';

// --- Generative-score tuning constants (P1 §6 + P2 §7/§8 + P3 bed/arrangement) -------------
//
// EVERY grammar constant from PARAVOXIA_SCORE.md §6–§8 lives HERE, named and
// grouped, so the owner can retune after listening without touching
// generative logic. No magic numbers in the generative modules — they import
// from this file.

// --- Phrase / harmonic rhythm (§6.5) ------------------------------------------------------

/** Bars per phrase — the planning window for tension curves and rations. */
export const PHRASE_BARS = 8;
/** Harmonic rhythm: bars per chord at rest (low energy). */
export const HARMONY_BARS_REST = 4;
/** Harmonic rhythm: bars per chord by default. */
export const HARMONY_BARS_DEFAULT = 2;
/** Harmonic rhythm: bars per chord at high energy. */
export const HARMONY_BARS_FAST = 1;
/** Energy below this = "at rest" → HARMONY_BARS_REST. */
export const HARMONY_REST_ENERGY_MAX = 0.3;
/** Energy above this → HARMONY_BARS_FAST. */
export const HARMONY_FAST_ENERGY_MIN = 0.7;

// --- Voice-leading legality (§6.4) --------------------------------------------------------

/** Max total displacement (semitones, summed over the 3 upper voices). */
export const VL_TOTAL_MAX = 6;
/** Max displacement of any single upper voice (semitones). */
export const VL_VOICE_MAX = 4;
/** Below this tension, at least one common tone must be held. */
export const VL_COMMON_TONE_TENSION = 0.4;
/**
 * After this many consecutive failed chord-change attempts, the common-tone
 * rule is bypassed for the retry (displacement bounds still hold). Some
 * corners of the grammar have a single common-tone neighbor (Lydian II:maj),
 * and a drifted register band can price it out — without this escape the
 * walk freezes for minutes (found by the P4 soak, frozen seed 8). Same
 * philosophy as the chord-tabu bypass: never at the cost of a wrong note,
 * never at the cost of a frozen walk.
 */
export const HELD_RELAX_BARS = 2;

// --- Register band (§6.4, §8.3) -----------------------------------------------------------

/** Upper-voice band center, semitones above A1 (55 Hz). */
export const REGISTER_BAND_CENTER_BASE = 12;
/** Half-width of the upper-voice band (semitones). Must be ≥ 6 so every pc has an instance. */
export const REGISTER_BAND_HALF_WIDTH = 8;
/** Daylight lifts the band by up to a fifth (§8.3): center += warmth × this. */
export const REGISTER_WARMTH_LIFT_SEMIS = 7;
/**
 * The band GLIDES: at each chord change the live band center moves toward its
 * target by at most this many semitones (register weather, never a jump —
 * and the §6.4 displacement law stays satisfiable while the band travels).
 */
export const BAND_SLEW_SEMIS = 2;
/** Neutral register for the tension model's extremity term. */
export const REGISTER_NEUTRAL_SEMIS = 12;
/** Normalization range for register extremity (semitones → 0..1). */
export const REGISTER_EXTREMITY_RANGE = 12;

// --- Mode drift (§6.2) ----------------------------------------------------------------------

/** Minimum phrases between single-accidental mode steps. */
export const MODE_DRIFT_MIN_PHRASES = 4;
/** Probability of a drift step when eligible at a phrase boundary. */
export const MODE_DRIFT_P = 0.35;
/** Direction bias strength: p(bright) = 0.5 + this × (warmth − tension). */
export const MODE_DRIFT_DIR_BIAS = 0.4;
/** Ionian is EARNED: entering it requires warmth ≥ this (owner ruling #3). */
export const IONIAN_WARMTH_GATE = 0.7;
/** Phrygian ♭2 territory: entering it requires tension > this. */
export const TENSION_PHRYGIAN_GATE = 0.7;

// --- Chord color (§6.3) ---------------------------------------------------------------------

/** p(color tone) = chroma × this. */
export const COLOR_P_SCALE = 0.8;
/** ♭9/♯11 exotic colors permitted only above this tension. */
export const TENSION_COLOR_GATE = 0.6;
/** Perceptual dissonance per color intent (feeds the tension model). */
export const COLOR_DISSONANCE: Record<string, number> = {
  none: 0,
  add6: 0.15,
  add9: 0.2,
  seventh: 0.3, // realized quality-appropriately: maj7 on major, m7 on minor
  flat9: 0.8,
  sharp11: 0.7
};
/** Relative weights when drawing a color intent (before tension gating). */
export const COLOR_INTENT_WEIGHTS: Array<[intent: string, weight: number]> = [
  ['add9', 0.35],
  ['add6', 0.2],
  ['seventh', 0.3],
  ['flat9', 0.075],
  ['sharp11', 0.075]
];

// --- Chromatic mediants (§6.3) --------------------------------------------------------------

/** Max mediant moves per phrase — the rationed jaw-drop gesture. */
export const MEDIANT_RATION = 1;
/** Base probability a mediant enters the candidate pool when permitted. */
export const MEDIANT_BASE_P = 0.3;
/** Golden-hour multiplier on mediant probability (§8.4). */
export const GOLDEN_MEDIANT_MULT = 3;
/** Mediant probability ceiling after multipliers. */
export const MEDIANT_P_MAX = 0.9;
/**
 * Golden-hour plagal color: continuously prefer IV / ♭VII candidates by up
 * to this much tension-distance score without changing the active mode.
 */
export const GOLDEN_PLAGAL_SCORE_BIAS = 0.08;
/** Root intervals carrying the Mixolydian/plagal golden color. */
export const GOLDEN_PLAGAL_ROOT_INTERVALS: readonly number[] = [5, 10];

// --- Tension model weights (§6.5, Farbood-style blend) --------------------------------------

export const TENSION_W_TONNETZ = 0.4;
export const TENSION_W_COLOR = 0.2;
export const TENSION_W_NONDIATONIC = 0.25;
export const TENSION_W_REGISTER = 0.15;
/** Tonnetz (PLR-graph) distance normalization: distance/this, clamped to 1. */
export const TONNETZ_NORM = 4;

// --- Tension curves (§6.5) -------------------------------------------------------------------

/** ARCH profile over the 8-bar phrase: rise to bar 6, release bars 7–8. */
export const ARCH_PROFILE = [0, 0.2, 0.45, 0.7, 0.9, 1, 0.45, 0.15];
/** ARCH: how far below the rail the phrase starts. */
export const ARCH_DIP = 0.1;
/** ARCH: peak height above the rail. */
export const ARCH_PEAK_BOOST = 0.3;
/** RISE: bar-8 target above the rail (into a build). */
export const RISE_GAIN = 0.45;
/** FALL: bar-1 start above the rail (after a bloom). */
export const FALL_START_BOOST = 0.3;
/** FALL: bar-8 landing below the rail. */
export const FALL_FLOOR_DROP = 0.15;
/** Base weights for the phrase-shape draw. */
export const SHAPE_WEIGHTS: Array<[shape: string, weight: number]> = [
  ['ARCH', 0.45],
  ['PLATEAU', 0.3],
  ['RISE', 0.15],
  ['FALL', 0.1]
];
/** Extra FALL weight when the previous phrase was a RISE (build → release). */
export const SHAPE_FALL_AFTER_RISE_BOOST = 0.5;
/** Extra RISE weight per unit of rail tension. */
export const SHAPE_RISE_TENSION_BOOST = 0.3;
/** Extra PLATEAU weight per unit of (1 − energy) — calm favors stillness. */
export const SHAPE_PLATEAU_CALM_BOOST = 0.25;

// --- Progression choice (§6.5) ----------------------------------------------------------------

/** Candidates within this |T − target| of the best tie-break by seeded hash. */
export const CHORD_TIE_EPSILON = 0.02;
/** No-repeat window: a new chord may not match the last N distinct chords. */
export const CHORD_TABU = 3;
/** Phrase-final bias: probability bars 7–8 restrict to tonic/plagal neighbors. */
export const CADENCE_BIAS_P = 0.65;
/** Phrase position (0-based) where the cadence bias may apply (bars 7–8). */
export const CADENCE_START_POS = 6;

// --- Key / home-mode derivation (§7.1, §8.4) ---------------------------------------------------
//
// Home modes only (Ionian and Phrygian are never home — §6.2). Weights follow
// the §8.4 archetype table; small secondary weights keep the distribution
// non-degenerate. OWNER RETUNE after listening across seeds.

export const ARCHETYPE_MODE_WEIGHTS: Record<ArchetypeId, Array<[ModeName, number]>> = {
  verdant: [['dorian', 0.5], ['mixolydian', 0.5]],
  oceanic: [['lydian', 0.7], ['dorian', 0.3]],
  arid: [['aeolian', 0.85], ['dorian', 0.15]],
  frozen: [['lydian', 0.8], ['aeolian', 0.2]],
  volcanic: [['aeolian', 1]],
  crystal: [['lydian', 0.8], ['dorian', 0.2]],
  metallic: [['aeolian', 0.8], ['dorian', 0.2]],
  fungal: [['dorian', 0.7], ['mixolydian', 0.3]],
  anomaly: [['lydian', 0.35], ['dorian', 0.35], ['aeolian', 0.3]]
};

/** Fallback mode weights when no archetype is known (Aeolian = Zimmer default). */
export const DEFAULT_MODE_WEIGHTS: Array<[ModeName, number]> = [
  ['aeolian', 0.4],
  ['dorian', 0.3],
  ['mixolydian', 0.15],
  ['lydian', 0.15]
];

// --- Motif DNA: contour gene (§7.1) -----------------------------------------------------------

/** Contour gene length bounds (intervals, in scale steps). */
export const CONTOUR_LEN_MIN = 3;
export const CONTOUR_LEN_MAX = 5;
/** Weighted interval magnitudes: ±1 p=.4, ±2 p=.3, ±3 p=.15, ±4/±5 p=.15 combined. */
export const CONTOUR_STEP_WEIGHTS: Array<[steps: number, weight: number]> = [
  [1, 0.4],
  [2, 0.3],
  [3, 0.15],
  [4, 0.075],
  [5, 0.075]
];
/** An interval of at least this many scale steps is a leap. */
export const CONTOUR_LEAP_MIN = 4;
/** At most this many leaps per contour gene. */
export const CONTOUR_MAX_LEAPS = 1;

// --- Motif DNA: anchor gene (§7.1) --------------------------------------------------------------

/** Start chord-tone weights: 5th 50% / root 30% / 3rd 20% (the yearning shape). */
export const ANCHOR_START_WEIGHTS: Array<[ChordAnchor, number]> = [
  ['fifth', 0.5],
  ['root', 0.3],
  ['third', 0.2]
];
/** Landing-tone weights: root 80% / 5th 20%. */
export const ANCHOR_LAND_WEIGHTS: Array<[ChordAnchor, number]> = [
  ['root', 0.8],
  ['fifth', 0.2]
];

// --- Motif DNA: per-planet tempo and meter (§7.1, §8.1) ------------------------------------------

/** Global sandbox tempo range, bpm (half-time feel). Story moods keep authored tempi. */
export const TEMPO_MIN = 66;
export const TEMPO_MAX = 88;
/** Per-archetype base-tempo bands (bpm) within the global range (frozen slowest — §8.4). */
export const ARCHETYPE_TEMPO_BANDS: Record<ArchetypeId, [lo: number, hi: number]> = {
  verdant: [72, 82],
  arid: [68, 78],
  frozen: [66, 72],
  volcanic: [74, 84],
  oceanic: [66, 74],
  crystal: [70, 80],
  metallic: [72, 84],
  fungal: [70, 80],
  anomaly: [66, 88]
};
/** Tempo band when no archetype is known. */
export const DEFAULT_TEMPO_BAND: [lo: number, hi: number] = [70, 82];
/** 6/8 is a seeded minority for wonder-leaning archetypes (§8.1). */
export const METER_68_P = 0.25;
/** Anomaly carries the explicit 6/8 bias of the §8.4 table. */
export const METER_68_ANOMALY_P = 0.5;
/** Archetypes eligible for a 6/8 home meter (wonder-leaning). */
export const METER_68_ARCHETYPES: ReadonlyArray<ArchetypeId> = [
  'oceanic', 'frozen', 'crystal', 'anomaly'
];

// --- Motif development (§7.2) ---------------------------------------------------------------------

/** Max bars a developed figure may span (augment legality bound). */
export const MOTIF_MAX_BARS = 4;
/** Max notes a developed figure may hold (extend legality bound). */
export const MOTIF_MAX_NOTES = 8;
/** Held duration (grid slots) of a figure's final note. */
export const MOTIF_FINAL_DUR_SLOTS = 8;
/** Smallest fragment(n) — an ostinato cell needs at least this many notes. */
export const FRAGMENT_MIN_NOTES = 2;
/** Default ostinato cell size: fragment(this) of the planet motif. */
export const FRAGMENT_DEFAULT_NOTES = 3;
/** Retrograde is rare and wonder-gated: legal only at wonder ≥ this. */
export const RETROGRADE_WONDER_GATE = 0.6;

// --- Phrase memory and macro-drift (§7.3) -----------------------------------------------------------

/** Exact-phrase tabu window (rendered-phrase hashes, ~8–12 min). */
export const PHRASE_TABU = 16;
/** Coarser operator-chain-only tabu window (gesture-level ruts). */
export const GESTURE_TABU = 4;
/** Macro-drift clock periods, minutes — CO-PRIME by design (Eno's principle). P3 wires them. */
export const DRIFT_MODE_MIN = 17;
export const DRIFT_REGISTER_MIN = 23;
export const DRIFT_TEXTURE_MIN = 11;

// --- Rhythm generators (§8.2) --------------------------------------------------------------------------

/** Max seeded micro-timing jitter, ms, scaled by `organic` (0 = machine-perfect chip grid). */
export const HUMAN_JITTER_MS = 12;
/** Transport-keyed sidechain duck depth at energy 1 (P3 voice rim). */
export const SIDECHAIN_DEPTH = 0.35;

// --- Transport and grid-synced hits (§8.1) ---------------------------------------------------------------

/** Minimum lead time (s) for a grid-scheduled hit — never in the past, never reactive-late. */
export const HIT_MIN_LEAD_S = 0.05;
/**
 * Composed sync (audio-10x Stage 3). A scheduled hit whose onset is within this
 * of the audio clock is COMMITTED: a chain exit or reset may cancel hits further
 * out, never one about to sound — the hand-back bloom fires on the very tick
 * that exits its chain.
 */
export const HIT_CANCEL_GRACE_S = 0.05;
/**
 * The braam's bite (s): the attack of every braam tone, the `onsetAttackMs` a
 * HitSchedule reports for the kind. Named so the sync trace and the render share
 * one number.
 */
export const HIT_BRAAM_ATTACK_S = 0.35;
/**
 * Live-tonic window for a chain entry (bars): a pitch-locked chain reads the
 * bed's tonic only if the bed published inside this many of its own bars, else
 * it derives planetHomeRoot(seed). Contract sc.chain.tonic-authority.
 */
export const TONIC_LIVE_WINDOW_BARS = 8;
/**
 * applyRails dirty check: a smoothed-rail target is re-issued only when it
 * moved by more than this relative (of |target|) or absolute amount. The param
 * is already gliding to the last target, so skipping an identical re-issue is
 * inaudible by construction; the residual 528 writes/s (evidence/stage-2
 * deviation 11) came from re-issuing unchanged targets every 60 ms tick.
 */
export const RAILS_DIRTY_REL = 0.004;
export const RAILS_DIRTY_ABS = 1e-4;
/**
 * Master switch for the applyRails dirty check. Off, every tick re-issues every
 * rail exactly as the shipped instrument did (the render-identity baseline for
 * the MOODS-as-constraints migration is captured with it off); on, unchanged
 * targets are skipped. The two renders differ only at the automation float
 * floor — asserted as a loudness/smoothness delta, never as a hash.
 */
export const RAILS_DIRTY_ENABLED = true;
/**
 * A bundle's SFX member is forward-scheduled to an exact audio time; the
 * director posts it this far (s, beat clock) before that time so the post is
 * never late on a dropped frame. Only bundled `playSfx` calls use it (C6).
 */
export const SFX_BUNDLE_ARM_LEAD_S = 0.08;
/**
 * bundleAt derivation (contract, Cinematography C6): the device term
 * (ctx.outputLatency, else baseLatency, else 0) plus the music-path tail latency
 * is clamped as a whole to this, sampled once at arming.
 */
export const LATENCY_COMP_MAX_S = 0.25;

// --- The world-clock tick (§8.1, owner ruling #2 — P3 voice consumes these) --------------------------------

/** One tick per real second at rest. NEVER quantized to the musical grid. */
export const TICK_HZ_BASE = 1.0;
export const TICK_HZ_MIN = 0.5;
export const TICK_HZ_MAX = 2.5;
/** Tick audible when tension exceeds this (or descent/warp force presence). */
export const TICK_GATE = 0.55;
/** Half-width of the continuous tick-presence fade around TICK_GATE. */
export const TICK_GATE_FADE_WIDTH = 0.08;
/** Tick rate changes glide over at least this many seconds. */
export const TICK_GLIDE_S = 2;
/** Clock-pressure multiplier while warping (time compressing). */
export const TICK_WARP_MULT = 2;
/** Clock pressure in the descent scene (radar-altimeter urgency; warp progress adds on top). */
export const TICK_DESCENT_PRESSURE = 2.2;
/**
 * Descent ramp on TICK_DESCENT_PRESSURE: pressure starts at BASE of the full
 * descent multiplier and climbs by SPAN as the ground nears (the
 * radar-altimeter accelerando). BASE + SPAN should sum to 1.
 */
export const TICK_DESCENT_RAMP_BASE = 0.75;
export const TICK_DESCENT_RAMP_SPAN = 0.25;
/** At full submergence the tick slows to this fraction of its rate (depth dilates time). */
export const TICK_SUBMERGE_FLOOR = 0.55;
/**
 * Forced tick presence (descent/warp) drives level with at least this much
 * tension-equivalent — the clock is never forced audible yet inaudible.
 */
export const TICK_FORCED_LEVEL_FLOOR = 0.4;
/** Level normalizer gain on tension × (pressure / TICK_HZ_MAX). */
export const TICK_LEVEL_GAIN = 2;

// --- Era instrumentation ladder (§8.5 — a ramp, not a staircase) --------------------------------

/** Era rung thresholds on the continuous 0..1 era rail. */
export const ERA_COLOR = 0.25;
export const ERA_MATERIAL = 0.5;
export const ERA_ALIVE = 0.75;
/** Each unlock FADES in over this much era below its threshold (ramp, not staircase). */
export const ERA_FADE_WIDTH = 0.12;
/** Paradox fold-back: chip voices return as texture at this level (owner ruling #5). */
export const CHIP_FOLDBACK_LEVEL = 0.3;

// --- Shared world-signal → score map (§5) ------------------------------------------------------

/** Palette brightness proxy shared by live wiring and controlled offline evidence. */
export const PALETTE_BRIGHT_BASE = 0.3;
export const PALETTE_BRIGHT_TEMPERATURE = 0.4;
export const PALETTE_BRIGHT_SATURATION = 0.3;
/** Celestial and depth contributions to the continuous warmth/wonder rails. */
export const DAYLIGHT_WARMTH_SCALE = 0.85;
export const DAYLIGHT_WARMTH_FLOOR = 0.1;
export const NIGHT_WONDER_SCALE = 0.55;
export const SPACE_WONDER_LIFT = 0.5;
export const SUBMERGENCE_WONDER_LIFT = 0.35;
export const WONDER_FLOOR = 0.15;

// --- Period-authentic era rungs (§8.5, P5) --------------------------------------------------------

/**
 * Bare monophony: while the lone chip arp speaks, the pulse drone yields to
 * this fraction of its level (one PSG voice at a time — 1-bit soul).
 */
export const CHIP_MONO_DUCK = 0;
/** Story-score PSG channel budgets before material synthesis unlocks. */
export const SCORE_BARE_PULSE_VOICE_CAP = 1;
export const SCORE_COLOR_PULSE_VOICE_CAP = 2;
export const SCORE_NO_VOICE_CAP = 0;
export const SCORE_BARE_TRIANGLE_VOICE_CAP = 0;
export const SCORE_COLOR_TRIANGLE_VOICE_CAP = 1;
/** Shared hit-palette voice ceilings at each era rung. */
export const HIT_BARE_UPPER_VOICE_CAP = 0;
export const HIT_COLOR_UPPER_VOICE_CAP = 0;
export const HIT_MATERIAL_UPPER_VOICE_CAP = 4;
export const HIT_ALIVE_UPPER_VOICE_CAP = 4;
export const HIT_BARE_MAX_PITCHED_VOICES = 0;
export const HIT_COLOR_MAX_PITCHED_VOICES = 0;
/** NES vibrato (unlocks at `color`): rate and depth of the chip-lead pitch LFO. */
export const CHIP_VIBRATO_HZ = 5.5;
export const CHIP_VIBRATO_CENTS = 12;
/** Pulse-harmony voice (the NES trio's second pulse), level × the lead note. */
export const CHIP_HARMONY_LEVEL = 0.55;
/** Shimmer floor at `material` (§8.5 FM bells); the rest arrives at `alive` (granular). */
export const SHIMMER_MATERIAL_PORTION = 0.35;
/** Paradox widens the mediant freedom: ration per phrase beyond `alive`'s 1 (§8.5). */
export const PARADOX_MEDIANT_RATION = 2;
/**
 * Paradox may split the world-clock into TWO clocks (§8.5): the second runs at
 * this ratio of the first — the golden-ratio conjugate, so the two clocks
 * never re-phase (Eno's incommensurable-period principle at tick scale).
 */
export const PARADOX_TICK_RATIO = 0.618;
/** Second-clock loudness, × the first clock's level. */
export const PARADOX_TICK2_LEVEL = 0.6;

// --- Story-mood melody generalization (§10.5 / §8.5 note, P5) --------------------------------------
//
// A mood's `melody.scale` becomes a FILTER over the planet's motif genome —
// the planet's tune haunts the story beats, played in the mood's mode. No
// MOODS schema change; the shipped random walk survives only as the fallback
// when no planet genome is known.

/** Register center of mood-melody phrases, semitones above the current chord root. */
export const MOOD_MELODY_CENTER_SEMIS = 7;
/** Seeded operator-chain candidates tried before falling back to the base figure. */
export const MOOD_CHAIN_CANDIDATES = 4;
/** Mood-melody velocity floor (seeded velocities span floor..1, like the shipped walk). */
export const MOOD_VELOCITY_FLOOR = 0.8;

// --- Arrangement state machine (§8.3) ------------------------------------------------------------

/** REST floor pad level — the quiet bed never fully drops out (owner ruling #4). */
export const REST_FLOOR_PAD_LEVEL = 0.22;
/** Per-family layer levels for each arrangement state (multipliers on voice gains). */
export interface BedLayerLevels {
  sub: number;
  pad: number;
  ostinato: number;
  texture: number;
  lead: number;
  percussion: number;
  riser: number;
}
export const ARRANGEMENT_LEVELS: Record<ArrangementStateName, BedLayerLevels> = {
  REST: { sub: 0.8, pad: REST_FLOOR_PAD_LEVEL, ostinato: 0, texture: 0.15, lead: 0, percussion: 0, riser: 0 },
  BED: { sub: 1, pad: 1, ostinato: 1, texture: 1, lead: 1, percussion: 0.6, riser: 0 },
  BUILD: { sub: 1, pad: 1.05, ostinato: 1.25, texture: 1.1, lead: 0, percussion: 1, riser: 1 },
  BLOOM: { sub: 1.1, pad: 1.2, ostinato: 1.1, texture: 1.2, lead: 1.2, percussion: 1, riser: 0 },
  EBB: { sub: 1, pad: 0.7, ostinato: 0.5, texture: 0.6, lead: 0.4, percussion: 0.3, riser: 0 }
};
/** Dwell bounds per state, in phrases (BUILD is always exactly one phrase). */
export const DWELL_MIN: Record<ArrangementStateName, number> = { REST: 1, BED: 2, BUILD: 1, BLOOM: 1, EBB: 1 };
export const DWELL_MAX: Record<ArrangementStateName, number> = { REST: 4, BED: 6, BUILD: 1, BLOOM: 2, EBB: 2 };
/** BED → BUILD probability: base + energy boost (needs era ≥ material for the full gesture). */
export const BED_TO_BUILD_P_BASE = 0.1;
export const BED_TO_BUILD_ENERGY_BOOST = 0.35;
/** BED → REST sink probability per phrase past DWELL_MIN (restraint rises with dwell). */
export const BED_TO_REST_P_PER_PHRASE = 0.12;
/** REST → BED lift probability: base + wonder/energy boosts (the sub-swell gesture). */
export const REST_TO_BED_P_BASE = 0.3;
export const REST_LIFT_WONDER_BOOST = 0.25;
export const REST_LIFT_ENERGY_BOOST = 0.3;
/** BLOOM → EBB probability once past DWELL_MIN (forced at DWELL_MAX). */
export const BLOOM_TO_EBB_P = 0.6;
/** EBB → REST probability (else EBB → BED). */
export const EBB_TO_REST_P = 0.45;

// --- Bed scene policies (§8.4 scene rows) -----------------------------------------------------------

export interface BedScenePolicy {
  /** Scene gain on the bed master. */
  gain: number;
  /** Melody statements permitted. */
  melody: boolean;
  /** Percussion family permitted. */
  percussion: boolean;
  /** Extra REST weighting (deepSpace is the quiet-bed floor at its most exposed). */
  restBoost: number;
  /** Scene forces a BUILD phrase on entry (launch). */
  forceBuild?: boolean;
  /** Scene forces tick presence (descent). */
  tickForce?: boolean;
  /** Near-silence: single sub only (storyTerminal). */
  subOnly?: boolean;
}
export const BED_SCENE_POLICY: Record<MusicScene, BedScenePolicy> = {
  menu: { gain: 0.5, melody: false, percussion: false, restBoost: 0.2 },
  surface: { gain: 1, melody: true, percussion: true, restBoost: 0 },
  surfaceShip: { gain: 0.7, melody: false, percussion: false, restBoost: 0.1 },
  launch: { gain: 1, melody: false, percussion: true, restBoost: 0, forceBuild: true },
  deepSpace: { gain: 0.85, melody: false, percussion: false, restBoost: 0.5 },
  approach: { gain: 0.9, melody: false, percussion: true, restBoost: 0 },
  descent: { gain: 1, melody: false, percussion: true, restBoost: 0, tickForce: true },
  storyTerminal: { gain: 0.25, melody: false, percussion: false, restBoost: 1, subOnly: true }
};

// --- Melody statements (§7.2 C418 restraint: entrances carry emotion because they are rare) ---------

/** Statement probability per phrase by arrangement state (BLOOM guarantees one). */
export const MELODY_BLOOM_P = 1;
export const MELODY_BED_P = 0.22;
export const MELODY_EBB_P = 0.15;
/** Curated operator-chain pool for statements (the unit of variation, §7.2). */
export const MELODY_CHAIN_POOL: ReadonlyArray<readonly MotifOp[]> = [
  [],
  [{ kind: 'transpose', amount: 2 }],
  [{ kind: 'transpose', amount: -2 }],
  [{ kind: 'invert' }],
  [{ kind: 'augment' }],
  [{ kind: 'extend', amount: 1 }],
  [{ kind: 'octaveShift', amount: 1 }],
  [{ kind: 'invert' }, { kind: 'augment' }],
  [{ kind: 'fragment', amount: 4 }, { kind: 'extend', amount: -1 }],
  [{ kind: 'retrograde' }]
];
/** How many seeded candidates the tabu filter may try before composing silence instead. */
export const MELODY_TABU_CANDIDATES = 4;

// --- Ostinato / subdivision (§8.1 ODESZA law: energy pushes subdivision, never bpm) ------------------

/** Above this energy the ostinato cell renders double-time (diminish). */
export const SUBDIV_DOUBLE_ENERGY = 0.65;
/** Below this energy the ostinato may drop notes (seeded, breathing). */
export const OST_CALM_ENERGY = 0.45;
export const OST_DROP_P = 0.08;
/** Ostinato velocity floor (seeded velocities span floor..1). */
export const OST_VELOCITY_FLOOR = 0.78;

// --- Percussion / texture generators (§8.2) -----------------------------------------------------------

/** Euclidean onset count bounds: k = round(min + energy·detail·(max−min)). */
export const PERC_K_MIN = 2;
export const PERC_K_MAX = 7;
/** World-position quantum (blocks) for the region salt — travel turns the rhythm. */
export const REGION_QUANT_BLOCKS = 48;

// --- Macro-drift wiring (§7.3 co-prime clocks; periods above under phrase memory) ---------------------

/** Mode-drift clock: warmth-bias amplitude added to the rail (weather, not events). */
export const DRIFT_MODE_DEPTH = 0.25;
/** Register-drift clock amplitude, semitones (± a fourth). */
export const DRIFT_REGISTER_SEMIS = 5;
/** Texture-drift reweight span: family gains scale in [1−span, 1+span]. */
export const DRIFT_TEXTURE_SPAN = 0.4;
/** Night sinks the voicing band by up to this many semitones (§8.3). */
export const NIGHT_REGISTER_SINK = 5;
/** Register shift clamp (semitones) after drift + night sink. */
export const REGISTER_SHIFT_MAX = 9;

// --- Underwater (§8.4) ----------------------------------------------------------------------------------

/** Start/end of the ostinato → tuned-sub motif crossfade. */
export const SUB_MOTIF_BLEND_START = 0.1;
export const SUB_MOTIF_BLEND_END = 0.9;
/** Submergence scales effective energy down (harmonic rhythm slows underwater). */
export const SUBMERGE_ENERGY_SCALE = 1;

// --- Shared visual/audio gust field (§8.4 wind rows) --------------------------------------------

/** GLSL-compatible value-noise hash constants (mirrors treeMaterials.ts). */
export const WIND_HASH_SCALE_X = 123.34;
export const WIND_HASH_SCALE_Y = 345.45;
export const WIND_HASH_DOT_OFFSET = 34.345;
/** Second octave of the shared moving gust field. */
export const WIND_GUST_SECONDARY_SCALE = 1.73;
export const WIND_GUST_SECONDARY_SPEED = 0.63;
/** Tree-field shaping: broad gust cells, then a secondary-cell modulation. */
export const WIND_GUST_SMOOTH_LOW = 0.22;
export const WIND_GUST_SMOOTH_HIGH = 0.88;
export const WIND_GUST_MIX_BASE = 0.52;
export const WIND_GUST_MIX_SECONDARY = 0.48;
/** Turbulence contribution to the local direction veer (mirrors the tree field). */
export const WIND_GUST_TURBULENCE_VEER = 1.1;
/** Degenerate-direction guard used by the visual shader too. */
export const WIND_DIRECTION_EPSILON = 0.0001;
/** WindProfile's maximum authored base strength, used to normalize audio drive. */
export const WIND_STRENGTH_NORM = 1.7;
/** Quiet air floor before the shared gust cell lifts the wash/tremolo drive. */
export const WIND_AUDIO_DRIVE_BASE = 0.42;

// --- Approach modulation (§8.4 guard, owner ruling #1) ---------------------------------------------------

/** The arrival chord must land ON the landing: modulate only if cost ≤ budget − margin. */
export const MODULATE_MARGIN = 1;
/** No modulation when the approach window is shorter than this many bars. */
export const MODULATE_MIN_BARS = 8;
/** Expected approach window, bars (approach length is player-driven; this is the planning budget). */
export const APPROACH_EXPECTED_BARS = 16;

// --- Sidechain breathing (§8.2; depth above under rhythm generators) --------------------------------------

/** Sidechain release, in felt beats (a dotted 8th). */
export const SIDECHAIN_RELEASE_BEATS = 0.75;

// --- Bed voice registers and mix levels (P3 rim — retune after LISTENING, not by eye) ----------------------

/** Bed master gain into the shared music bus. */
export const BED_MASTER_GAIN = 0.85;
/** Per-family base gains (multiplied by arrangement levels and era gates). */
export const BED_PAD_LEVEL = 0.085;
export const BED_SUB_LEVEL = 0.11;
export const BED_OST_LEVEL = 0.06;
export const BED_LEAD_LEVEL = 0.09;
export const BED_SHIMMER_LEVEL = 0.035;
export const BED_WASH_LEVEL = 0.05;
export const BED_PERC_LEVEL = 0.05;
export const BED_RISER_LEVEL = 0.16;
export const BED_TICK_LEVEL = 0.12;
/** Voice register placement, semitones relative to the voicing (A1 base). */
export const PAD_OCTAVE_SHIFT = 12;
export const SUB_OCTAVE_SHIFT = -12;
export const SHIMMER_OCTAVE_SHIFT = 36;
/** Motif anchor targets relative to the voicing-band center. */
export const OST_ANCHOR_OFFSET_SEMIS = 12;
export const LEAD_ANCHOR_OFFSET_SEMIS = 24;
/** Pad supersaw detune, cents (chroma/era widen from min toward max). */
export const PAD_DETUNE_CENTS_MIN = 4;
export const PAD_DETUNE_CENTS_MAX = 10;
/** Max stereo spread of the pad choir (×era stereoWidth gate). */
export const PAD_WIDTH_MAX = 0.7;
/** Generated-impulse reverb: length, decay exponent, max wet (×era reverb gate ×atmosphere). */
export const REVERB_SECONDS = 2.6;
export const REVERB_DECAY = 3.2;
export const REVERB_WET_MAX = 0.45;
/** Pad brightness: filter-cutoff mix (base + warmth lift + palette luminance lean). */
export const PAD_BRIGHT_BASE = 0.3;
export const PAD_BRIGHT_WARMTH = 0.5;
export const PAD_BRIGHT_PALETTE = 0.3;
/** Bed fade when a story mood takes/returns authority, seconds. */
export const BED_YIELD_FADE_S = 2.5;
export const BED_RESUME_FADE_S = 4;

// --- Stage 1 bed timbre and mastering (audio-10x; retune after LISTENING) ------------------------------
//
// The instrument under the notes. Harmony, arrangement and the era ladder are
// untouched; these constants shape the pad ensemble, the drive stages, the
// designed sub, the shared room and the music-bus glue. Every gain/cutoff/blend
// they feed is written as a named slew through rampParamAt (SYMPHONY LAW).

/** Pad ensemble voice count by quality tier (colour tones sound from voice 4 up). */
export const PAD_VOICES_FULL = 5;
export const PAD_VOICES_LEAN = 3;
/** Saws per pad voice by tier. */
export const PAD_UNISON_FULL = 6;
export const PAD_UNISON_LEAN = 3;
/** Symmetric unison offsets, cents (±); the lean tier uses the first (n−1)/2 pairs plus centre. */
export const PAD_UNISON_CENTS: readonly number[] = [3, 9, 17];
/** Per-saw pan spread (× era stereoWidth × slot in −1..1). */
export const PAD_UNISON_PAN_SPREAD = 0.6;
/** Octave-doubling saw level, dB below the voice. */
export const PAD_OCTAVE_LEVEL_DB = -12;
/** Per-voice lowpass: base + brightness span (replaces the one shared pad filter). */
export const PAD_VOICE_LP_MIN_HZ = 520;
export const PAD_VOICE_LP_SPAN_HZ = 2400;
export const PAD_VOICE_LP_Q = 0.6;
/** Seeded per-voice cutoff wander LFO band, Hz, and depth, Hz (× padChoir). */
export const PAD_WANDER_HZ_MIN = 0.03;
export const PAD_WANDER_HZ_MAX = 0.07;
export const PAD_WANDER_DEPTH_HZ = 140;
/** Attack breath: filtered-noise puff on every voicing retune (material+). */
export const PAD_BREATH_LEVEL = 0.012;
export const PAD_BREATH_S = 0.06;
export const PAD_BREATH_HZ = 1800;
export const PAD_BREATH_Q = 0.9;
/** Drive curves (unity small-signal tanh, see generative/timbre.ts) per family. */
export const DRIVE_PAD_K = 1.8;
export const DRIVE_SUB_K = 1.2;
export const DRIVE_LEAD_K = 1.5;
/** Pad drive pre-gain, dB, and parallel wet blends. */
export const DRIVE_PAD_PRE_DB = 6;
export const DRIVE_PAD_WET_ALIVE = 0.45;
/** Thermal worlds push the wet blend up by this fraction (drive, not level). */
export const DRIVE_THERMAL_WET_LIFT = 0.2;
export const DRIVE_SUB_WET = 0.35;
export const DRIVE_LEAD_WET = 0.3;
/** Designed sub path: highpass floor, lowpass ceiling, whole-bed mono-below crossover. */
export const SUB_HP_HZ = 28;
export const SUB_LP_HZ = 120;
export const BED_XOVER_HZ = 120;
/** Shared impulse generator (bed spaces + story convolver). */
export const REVERB_PREDELAY_MS = 22;
export const REVERB_HF_DAMP_HZ = 3200;
export const REVERB_EARLY_TAPS = 8;
export const REVERB_EARLY_WINDOW_MS: readonly [number, number] = [8, 60];
export const REVERB_EARLY_LEVEL = 0.8;
export const REVERB_LATE_LEVEL = 1;
export const REVERB_LATE_ONSET_MS = 30;
/** Music-bus glue before the (untouched) safety compressor. */
export const GLUE_THRESH_DB = -18;
export const GLUE_RATIO = 2.5;
export const GLUE_ATTACK_S = 0.03;
export const GLUE_RELEASE_S = 0.25;
export const GLUE_KNEE_DB = 12;
export const SOFTCLIP_K = 1.4;
/**
 * Chrome's DynamicsCompressor bakes a makeup gain in (pow(1/fullRangeGain, 0.6)).
 * Measured +4.27 dB for the glue settings above (soak page
 * measureGlueStaticGainDb); this trim returns the glue stage to unity static
 * gain, so no makeup exists anywhere in the chain and an authored quiet survives.
 */
export const GLUE_MAKEUP_COMP_DB = -4.27;
/** Loudness targets (summed bus −18 LUFS I; bed alone at alive 2.5 LU under; BLOOM short-term). */
export const TARGET_LUFS_I = -18;
export const TARGET_TP_DBTP = -1;
export const BED_ALIVE_LUFS_I = -20.5;
export const BLOOM_ST_LUFS = -14;
/**
 * Whole-bed level lift that fades in with padChoir (material+): the bed bus and
 * both room returns scale by 1 − (1 − BED_ALIVE_LIFT)·padChoir. The chip eras
 * (bare/colour) sit at padChoir 0 and are untouched by construction; the value
 * lands the alive bed at BED_ALIVE_LUFS_I alone (measured, not asserted).
 */
export const BED_ALIVE_LIFT = 1.1;
export const BED_ALIVE_LIFT_SLEW_S = 1.5;
/** Signed v6: negative material-plus lean calibration at the existing bed/room trim. */
export const BED_LEAN_BALANCE_DB = -1.25;
/**
 * Night trim on the alive bed, dB at full night. The shipped world mappings
 * deepen the sub (SUB_NIGHT_GAIN_LIFT) and raise the shimmer
 * (NIGHT_SHIMMER_GAIN_LIFT) as TEXTURE, but together they also lifted the night
 * bed ~1.5 LU over the daylight reference — outside the unconditional
 * BED_ALIVE_LUFS_I ±1 term. The trim rides the same padChoir-gated bed-bus rail
 * as BED_ALIVE_LIFT (so bare/colour are untouched by construction), engages
 * through dusk (daylight < BED_NIGHT_TRIM_DAYLIGHT_ONSET, smoothstep) and is
 * full at night; every daylight ≥ onset render is bit-identical to before.
 */
export const BED_NIGHT_TRIM_DB = -2.0;
export const BED_NIGHT_TRIM_DAYLIGHT_ONSET = 0.5;
/** Named slews for every Stage 1 rail (95%-settled seconds). */
export const DRIVE_WET_SLEW_S = 1.2;
export const PAD_VOICE_LP_SLEW_S = 0.9;
export const UNISON_PAN_SLEW_S = 1.5;
export const PAD_VOICE_GAIN_SLEW_S = 1.2;
export const XOVER_BLEND_SLEW_S = 1.5;
export const SUB_DESIGN_SLEW_S = 1.4;

// --- Stage 5 long form (audio-10x): section planner, whole-bar memory, the pulse, the BLOOM rail ---------
//
// Every knob below is APPEND-ONLY Stage 5 grammar (contract draft-v4 acceptanceCriteria[14..16]).
// Nothing above this line changed; the chip eras (bare/colour) never reach a section with a
// bloom budget, a pulse, or a lift, so their renders are untouched by construction.

/** The layer a section withholds before its bloom (paid back when the bloom enters). */
export type WithheldLayer = 'shimmer' | 'percussion' | 'lead' | 'ostinato';
/** Register arc of a section: the voicing band's shape across its phrases. */
export type RegisterArcName = 'rise' | 'fall' | 'arch' | 'plateau';
/** Section length bounds, phrases (≈ 1.5–3 minutes at the shipped tempo band). */
export const SECTION_PHRASES_MIN = 4;
export const SECTION_PHRASES_MAX = 8;
/** Bloom-budget draw per section: base + energy boost. The run's opening section always carries 1. */
export const SECTION_BLOOM_P_BASE = 0.45;
export const SECTION_BLOOM_P_ENERGY = 0.4;
/** Consecutive budget-0 sections before a bloom is guaranteed (restraint has a ceiling too). */
export const SECTION_MAX_DRY_RUN = 2;
/** Extra statements per section besides the bloom's own (C418 law: entrances stay rare). */
export const SECTION_STATEMENTS_MIN = 1;
export const SECTION_STATEMENTS_MAX = 2;
/** The opening section's BUILD starts on one of these phrase offsets (the planet introduces itself). */
export const SECTION_INTRO_BUILD_PHRASES: readonly number[] = [2, 3];
/** The opening gesture is compact: a one-phrase build (the planet introduces itself, then breathes). */
export const SECTION_INTRO_BUILD_SPAN = 1;
/** BUILD span, phrases (the shipped machine used exactly 1); energy weights the longer spans. */
export const BUILD_SPAN_MIN = 1;
export const BUILD_SPAN_MAX = 3;
export const BUILD_SPAN_WEIGHTS: ReadonlyArray<readonly [span: number, weight: number, energyBoost: number]> = [
  [1, 1, 0],
  [2, 0.6, 0.9],
  [3, 0.25, 0.9]
];
/** Planned BLOOM length, phrases (1 crest phrase, or crest + sustain). */
export const BLOOM_PHRASES_MIN = 1;
export const BLOOM_PHRASES_MAX = 2;
export const BLOOM_TWO_PHRASE_P = 0.45;
/** Register-arc amplitude on the voicing band, semitones (added to the drift clocks, clamped by REGISTER_SHIFT_MAX). */
export const SECTION_REGISTER_SEMIS = 5;
export const REGISTER_ARC_WEIGHTS: ReadonlyArray<readonly [arc: RegisterArcName, weight: number]> = [
  ['rise', 1],
  ['fall', 0.8],
  ['arch', 1],
  ['plateau', 0.7]
];
/** Density arc range across a section (ostinato cell length + percussion onsets). */
export const SECTION_DENSITY_MIN = 0.25;
export const SECTION_DENSITY_MAX = 1;
/** Level multipliers while a layer is withheld ('percussion'/'lead' are silent until the bloom). */
export const WITHHELD_LEVEL: Record<WithheldLayer, number> = { shimmer: 0.3, percussion: 0, lead: 0, ostinato: 0.5 };
export const WITHHELD_LAYERS: readonly WithheldLayer[] = ['shimmer', 'percussion', 'lead', 'ostinato'];
/** Probability a budget-0 section still withholds a layer (variation, not payment). */
export const SECTION_WITHHOLD_DRY_P = 0.5;
/** Recapitulation probability: the run's first statement chain returns once, transposed by the centre. */
export const SECTION_RECAP_P = 0.4;
/** Re-draws before the planner accepts a section whose (statementSchedule, registerArc) pair repeats. */
export const SECTION_PLAN_MAX_TRIES = 12;
/** Whole-bar fingerprint tabu window, bars; audited bypass budget per 32 minutes; variation tries. */
export const BAR_TABU = 32;
export const BAR_TABU_BYPASS_BUDGET = 4;
export const BAR_TABU_BUDGET_MINUTES = 32;
export const BAR_VARIATION_MAX_TRIES = 6;
/** Level quantum in the bar fingerprint (0.05 lin ≈ 0.4 dB — below it two bars share a dynamic). */
export const BAR_LEVEL_QUANTUM = 0.05;
/** REST sub-swell amplitude (the sub-swell IS the REST gesture, owner ruling #4); peak bar bounds. */
export const REST_SUB_SWELL = 0.18;
export const REST_SWELL_PEAK_MIN = 2;
export const REST_SWELL_PEAK_MAX = 5;
/** Per-bar ostinato ornament probability (one note displaced an octave — still a chord/scale tone). */
export const OST_ORNAMENT_P = 0.3;
/** Percussion fill: extra onsets on a phrase's last bar; rotation swings per phrase (region still turns it). */
export const PERC_FILL_K = 2;
export const PERC_PHRASE_ROTATION_SLOTS = 4;
/** Reality `detail` mixes into density: at detail 0 the mix floor keeps half the density. */
export const DETAIL_DENSITY_FLOOR = 0.5;
/** BLOOM rail (contract [16]): arrangement-level lift, dB, on pad/ostinato/texture/lead/percussion; sub separately. */
export const BLOOM_RAIL_DB = 10.5;
export const BLOOM_RAIL_SUB_DB = 4.5;
/**
 * Per-family shares of the rail: the pads and texture carry the swell; the short
 * voices (ostinato, lead, percussion) lift less so note offsets at the crest never
 * step the programme (smoothness battery) and the tune never shouts over the bed.
 */
export const BLOOM_RAIL_OSTINATO_DB = 5;
export const BLOOM_RAIL_LEAD_DB = 3;
export const BLOOM_RAIL_PERCUSSION_DB = 7;
/** The crest: the bloom's first bars at full lift (the impact), then the groove settles to the sustain. */
export const BLOOM_CREST_BARS = 2;
/** The BUILD rises to this fraction of the lift; the crest jumps to 1 — the drop is a drop. */
export const BUILD_LIFT_CAP = 0.2;
/** Second BLOOM phrase sits at this fraction of the crest. */
export const BLOOM_LIFT_SUSTAIN = 0.09836813546324956;
/** Last bars of the final BLOOM phrase pre-release lift and pulse so the EBB is not a cliff. */
export const BLOOM_PRE_RELEASE_BARS = 2;
/** Largest bar-to-bar step of the lift / pulse envelopes (normalized; the symphony law, < SOAK 0.7). */
export const LIFT_BAR_SLEW = 0.5;
/** The pulse: level by state (× era sidechain gate), every PULSE_BUILD_BEAT_STEP-th felt beat in BUILD, every beat in BLOOM. */
export const PULSE_LEVEL_BUILD = 0.5;
export const PULSE_LEVEL_BLOOM = 1;
export const PULSE_BUILD_BEAT_STEP = 2;
/** Breath depth per unit pulse level (× SIDECHAIN_DEPTH): the dip the pulse carves out of the pads. */
export const PULSE_BREATH_SCALE = 0.6;
/**
 * Pulse body: sine pitch-drop from PULSE_BODY_HZ_FROM to the chord root's sub, folded by
 * octaves into [MIN, MAX). The band is exactly one octave so every root has one landing
 * pitch in it (the treatment's 40–60 Hz band is narrower than an octave and cannot hold
 * every pitch class — the body stays root-tuned rather than clamped off-pitch).
 */
export const PULSE_BODY_HZ_FROM = 80;
export const PULSE_BODY_HZ_MIN = 40;
export const PULSE_BODY_HZ_MAX = 80;
export const PULSE_BODY_DECAY_S = 0.12;
/** Pulse click (highpassed noise) and tail (bandpassed noise). */
export const PULSE_CLICK_S = 0.002;
export const PULSE_CLICK_HP_HZ = 2000;
export const PULSE_TAIL_S = 0.06;
export const PULSE_TAIL_BP_HZ = 200;
/** Rim levels for the pulse voice (BED_*_LEVEL family). */
export const BED_PULSE_BODY_LEVEL = 0.22;
export const BED_PULSE_CLICK_LEVEL = 0.06;
export const BED_PULSE_TAIL_LEVEL = 0.05;
/** Oxygen (dive): strain rises as oxygen falls below the onset; thins the sub motif and rolls the pads off. */
export const OXYGEN_STRAIN_ONSET = 0.5;
export const OXYGEN_PAD_ROLLOFF = 0.5;
export const OXYGEN_DENSITY_THIN = 0.5;
/** Material+ biome vote in neighboring mode choice; never skips an accidental rung. */
export const BIOME_MODE_DRIFT_WEIGHT = 0.2;
export const BIOME_MODE_PREFERENCE = {
  forest: 'dorian', grassland: 'mixolydian', coast: 'ionian',
  highland: 'lydian', mesa: 'aeolian', cave: 'phrygian',
  volcanic_scar: 'phrygian', crystal_field: 'lydian'
} as const;
