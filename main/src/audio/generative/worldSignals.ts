import type { MusicScene } from '../musicDirector.ts';
import type { VoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
import { seededUnit } from '../../utils/worldCoordinates.ts';
import {
  SALT_DRIFT_MODE_PHASE,
  SALT_DRIFT_REGISTER_PHASE,
  SALT_DRIFT_TEXTURE_PHASE
} from './seededMusic.ts';
import {
  CHIP_FOLDBACK_LEVEL,
  DRIFT_MODE_DEPTH,
  DRIFT_MODE_MIN,
  DRIFT_REGISTER_MIN,
  DRIFT_REGISTER_SEMIS,
  DRIFT_TEXTURE_MIN,
  ERA_ALIVE,
  ERA_COLOR,
  ERA_FADE_WIDTH,
  ERA_MATERIAL,
  NIGHT_REGISTER_SINK,
  PARADOX_TICK_RATIO,
  REGISTER_SHIFT_MAX,
  SHIMMER_MATERIAL_PORTION,
  TICK_DESCENT_PRESSURE,
  TICK_DESCENT_RAMP_BASE,
  TICK_DESCENT_RAMP_SPAN,
  TICK_FORCED_LEVEL_FLOOR,
  TICK_GATE,
  TICK_GATE_FADE_WIDTH,
  TICK_HZ_BASE,
  TICK_HZ_MAX,
  TICK_HZ_MIN,
  TICK_LEVEL_GAIN,
  TICK_SUBMERGE_FLOOR,
  TICK_WARP_MULT,
  WIND_AUDIO_DRIVE_BASE,
  WIND_DIRECTION_EPSILON,
  WIND_GUST_MIX_BASE,
  WIND_GUST_MIX_SECONDARY,
  WIND_GUST_SECONDARY_SCALE,
  WIND_GUST_SECONDARY_SPEED,
  WIND_GUST_SMOOTH_HIGH,
  WIND_GUST_SMOOTH_LOW,
  WIND_GUST_TURBULENCE_VEER,
  WIND_HASH_DOT_OFFSET,
  WIND_HASH_SCALE_X,
  WIND_HASH_SCALE_Y,
  WIND_STRENGTH_NORM
} from './tuning.ts';

// --- World signals → musical meaning (§8.4, pure resolvers) ------------------------------------
//
// The rAF conductor snapshots the world into a BedSignals record (intent
// only); the bed's scheduler and the pure planner consume it. Everything in
// this module is a pure function of the snapshot — testable without WebAudio.

export interface BedSignals {
  // Rails (musicPrimitives) + reality.
  era: number;
  stage: VoxelRealityStage;
  tension: number;
  energy: number;
  warmth: number;
  wonder: number;
  // Reality effect uniforms (0..1).
  chroma: number;
  detail: number;
  organic: number;
  atmosphere: number;
  thermal: number;
  crystalline: number;
  metal: number;
  // World state.
  daylight: number;
  golden: number;
  submergence: number;
  /** Live local-player survival oxygen, normalized to 0..1. */
  oxygen: number;
  /** WindProfile prevailing direction in the local tangent plane. */
  windDirectionX: number;
  windDirectionY: number;
  windStrength: number;
  windGustStrength: number;
  windGustScale: number;
  windTurbulence: number;
  windGustSpeed: number;
  windVeer: number;
  windOffsetX: number;
  windOffsetY: number;
  /** Player world X/Z: audio samples the same moving gust cell as vegetation. */
  playerX: number;
  playerZ: number;
  scene: MusicScene;
  warpActive: boolean;
  warpProgress: number;
  /** Region unit (0..1) from quantized world position — travel turns the rhythm. */
  regionUnit: number;
  /** Elapsed real seconds (macro-drift clocks). */
  timeSec: number;
  /** Canonical body id while approaching; null for coordinate-only interstellar travel. */
  destinationWorldId: string | null;
  /** Destination planet seed while approaching (null = no destination). */
  destinationSeed: number | null;
  /** Canonical profile identity carried with the seed for sibling-safe routing. */
  destinationProfileId: string | null;
  destinationProfileVersion: number | null;
  destinationProfileHash: string | null;
  /** Destination archetype id string when known (mode weighting of the target key). */
  destinationArchetype: string | null;
  /** A story mood leads the score — the bed yields (frozen contract). */
  storyLeads: boolean;
}

/** A neutral snapshot (tests, and the rim before the first rAF write). */
export function neutralBedSignals(): BedSignals {
  return {
    era: 1,
    stage: 'alive',
    tension: 0.15,
    energy: 0.2,
    warmth: 0.6,
    wonder: 0.4,
    chroma: 1,
    detail: 1,
    organic: 1,
    atmosphere: 0.5,
    thermal: 0.3,
    crystalline: 0.3,
    metal: 0.2,
    daylight: 0.7,
    golden: 0,
    submergence: 0,
    oxygen: 1,
    windDirectionX: 1,
    windDirectionY: 0,
    windStrength: 0.6,
    windGustStrength: 1,
    windGustScale: 0.04,
    windTurbulence: 0.3,
    windGustSpeed: 0.4,
    windVeer: 0.6,
    windOffsetX: 0,
    windOffsetY: 0,
    playerX: 0,
    playerZ: 0,
    scene: 'surface',
    warpActive: false,
    warpProgress: 0,
    regionUnit: 0,
    timeSec: 0,
    destinationWorldId: null,
    destinationSeed: null,
    destinationProfileId: null,
    destinationProfileVersion: null,
    destinationProfileHash: null,
    destinationArchetype: null,
    storyLeads: false
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const fract = (v: number): number => v - Math.floor(v);

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// --- Shared visual/audio gust field (§8.4) ------------------------------------------------------

/** Persistent-audio controls sampled from the same moving cells as treeMaterials.ts. */
export interface AudioGustControls {
  /** Shaped gust-cell value, 0..1. */
  gust: number;
  /** Normalized wash/tremolo drive from authored strength × the local gust. */
  drive: number;
  /** Local prevailing direction after field-driven veer, -1..1 in stereo X. */
  pan: number;
  /** Normalized micro-detune/noise disorder intent. */
  turbulence: number;
}

/** GLSL-compatible hash used by the tree gust field (pure and deterministic). */
function windHash21(x: number, y: number): number {
  let px = fract(x * WIND_HASH_SCALE_X);
  let py = fract(y * WIND_HASH_SCALE_Y);
  const dot = px * (px + WIND_HASH_DOT_OFFSET) + py * (py + WIND_HASH_DOT_OFFSET);
  px += dot;
  py += dot;
  return fract(px * py);
}

/** Bilinear value noise matching `twNoise` in treeMaterials.ts. */
function windNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx0 = fract(x);
  const fy0 = fract(y);
  const fx = fx0 * fx0 * (3 - 2 * fx0);
  const fy = fy0 * fy0 * (3 - 2 * fy0);
  const a = windHash21(ix, iy);
  const b = windHash21(ix + 1, iy);
  const c = windHash21(ix, iy + 1);
  const d = windHash21(ix + 1, iy + 1);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

/**
 * Sample the visual gust field at the player and resolve audio-ready controls.
 * No stochastic draw occurs here: identical BedSignals always produce identical
 * controls, and walking into a visual gust cell moves the audio wash with it.
 */
export function resolveAudioGust(s: BedSignals): AudioGustControls {
  const rawX = s.windDirectionX + WIND_DIRECTION_EPSILON;
  const rawY = s.windDirectionY;
  const dirLength = Math.hypot(rawX, rawY);
  const dirX = dirLength > Number.EPSILON ? rawX / dirLength : 1;
  const dirY = dirLength > Number.EPSILON ? rawY / dirLength : 0;
  const crossX = -dirY;
  const crossY = dirX;
  const travel = s.timeSec * s.windGustSpeed;
  const gustAX = s.playerX * s.windGustScale + dirX * travel + s.windOffsetX;
  const gustAY = s.playerZ * s.windGustScale + dirY * travel + s.windOffsetY;
  const gustA = windNoise(gustAX, gustAY);
  const secondaryScale = s.windGustScale * WIND_GUST_SECONDARY_SCALE;
  const secondaryTravel = travel * WIND_GUST_SECONDARY_SPEED;
  const gustBX = s.playerZ * secondaryScale - crossX * secondaryTravel + s.windOffsetY;
  const gustBY = s.playerX * secondaryScale - crossY * secondaryTravel + s.windOffsetX;
  const gustB = windNoise(gustBX + gustA, gustBY + gustA);
  const gust =
    smoothstep(WIND_GUST_SMOOTH_LOW, WIND_GUST_SMOOTH_HIGH, gustA) *
    (WIND_GUST_MIX_BASE + WIND_GUST_MIX_SECONDARY * gustB);
  const turbulence = clamp01(s.windTurbulence);
  const veer =
    (gustA - 0.5) * s.windVeer +
    (gustB - 0.5) * turbulence * WIND_GUST_TURBULENCE_VEER;
  const cos = Math.cos(veer);
  const sin = Math.sin(veer);
  const pan = Math.max(-1, Math.min(1, dirX * cos - dirY * sin));
  const strength = clamp01(s.windStrength / WIND_STRENGTH_NORM);
  const drive = clamp01(
    strength * (WIND_AUDIO_DRIVE_BASE + Math.max(0, s.windGustStrength) * gust)
  );
  return { gust, drive, pan, turbulence };
}

// --- Stage ordering (§8.5 rungs — transitions are EVENTS, §8.4 stage row) -------------------------

/** Rung rank of each reality stage (upward transitions fire the stage event). */
export const STAGE_RANK: Record<VoxelRealityStage, number> = {
  bare: 0,
  color: 1,
  material: 2,
  alive: 3,
  paradox: 4
};

// --- The world-clock tick (§8.1, owner ruling #2) -----------------------------------------------

export interface WorldClockTick {
  /** Tick rate, Hz — NEVER quantized to the musical grid (that rule is the device). */
  hz: number;
  /** Audible at all (fades over whole bars in the rim). */
  present: boolean;
  /** Continuous counterpart to `present`; the rim fades level with this scalar. */
  presence: number;
  /** Loudness/attack intent, 0..1 (tension × clock pressure). */
  level: number;
  /**
   * Paradox split (§8.5): a SECOND clock at hz × PARADOX_TICK_RATIO (golden
   * conjugate — the two never re-phase). Null everywhere below paradox.
   */
  splitHz: number | null;
}

/**
 * Clock pressure: descent urgency × warp time-compression × depth dilation.
 * Tension does NOT drive rate (§8.1) — it drives presence and level only.
 */
export function resolveClockPressure(s: BedSignals): number {
  let pressure = 1;
  if (s.scene === 'descent') {
    // Radar-altimeter urgency. The current world contract has no separate
    // descent-progress rail: ordinary descent therefore uses the named BASE;
    // only a genuinely co-occurring active warp can contribute progress.
    pressure *=
      TICK_DESCENT_PRESSURE * (TICK_DESCENT_RAMP_BASE + TICK_DESCENT_RAMP_SPAN * clamp01(s.warpProgress));
  }
  if (s.warpActive) pressure *= TICK_WARP_MULT;
  // Depth dilates time: slow toward the floor as the player submerges.
  pressure *= 1 - clamp01(s.submergence) * (1 - TICK_SUBMERGE_FLOOR);
  return pressure;
}

export function resolveWorldClockTick(s: BedSignals): WorldClockTick {
  const pressure = resolveClockPressure(s);
  const hz = Math.min(TICK_HZ_MAX, Math.max(TICK_HZ_MIN, TICK_HZ_BASE * pressure));
  const forced = s.scene === 'descent' || s.warpActive;
  const present = forced || s.tension > TICK_GATE;
  const presence = forced
    ? 1
    : smoothstep(TICK_GATE - TICK_GATE_FADE_WIDTH, TICK_GATE + TICK_GATE_FADE_WIDTH, s.tension);
  const level = clamp01(
    Math.max(forced ? TICK_FORCED_LEVEL_FLOOR : 0, s.tension) *
      clamp01(pressure / TICK_HZ_MAX) *
      TICK_LEVEL_GAIN *
      presence
  );
  const splitHz = s.stage === 'paradox' ? hz * PARADOX_TICK_RATIO : null;
  return { hz, present, presence, level, splitHz };
}

// --- The era instrumentation ladder (§8.5 — voice unlocks fade in; a ramp, not a staircase) -------

export interface EraGates {
  /** PSG/chip voices: full below `color`, fading out through `material`; paradox folds back. */
  chip: number;
  /** Detuned pad choir (material+). */
  padChoir: number;
  /** Stereo width, 0..1 (material unlocks, alive completes). */
  stereoWidth: number;
  /** Reverb depth, 0..1 (material short, alive full — scaled by `atmosphere` in the mix). */
  reverb: number;
  /** Sidechain breathing (material+). */
  sidechain: number;
  /** Percussion family (noise Euclid tick from color; full kit toward alive). */
  percussion: number;
  /** Bell/granular shimmer texture (FM-bell floor at material, full at alive — §8.5). */
  shimmer: number;
  /** Tuned sub (triangle bass from color, sine sub toward alive). */
  sub: number;
  /** Riser swells (material+). */
  riser: number;
  /** Slapback/delay space (color+). */
  delay: number;
  /** Chip-lead vibrato (§8.5: vibrato unlocks at `color`). */
  vibrato: number;
  /** The NES trio's second pulse — a chord tone below the lead (color era only). */
  chipHarmony: number;
}

/** Fade that completes exactly AT the threshold, starting ERA_FADE_WIDTH below it. */
export function eraFade(era: number, threshold: number): number {
  return clamp01((era - (threshold - ERA_FADE_WIDTH)) / ERA_FADE_WIDTH);
}

export function resolveEraGates(era: number, stage: VoxelRealityStage): EraGates {
  const e = clamp01(era);
  const material = eraFade(e, ERA_MATERIAL);
  const alive = eraFade(e, ERA_ALIVE);
  const color = eraFade(e, ERA_COLOR);
  const foldback = stage === 'paradox' ? CHIP_FOLDBACK_LEVEL : 0;
  return {
    chip: Math.max(1 - material, foldback),
    padChoir: material,
    stereoWidth: 0.5 * material + 0.5 * alive,
    reverb: 0.5 * material + 0.5 * alive,
    sidechain: material,
    percussion: 0.4 * color + 0.6 * alive,
    shimmer: SHIMMER_MATERIAL_PORTION * material + (1 - SHIMMER_MATERIAL_PORTION) * alive,
    sub: color,
    riser: material,
    delay: color,
    vibrato: color,
    chipHarmony: color * (1 - material)
  };
}

// --- Macro-drift clocks (§7.3 — three CO-PRIME periods, phase-seeded per planet) ------------------

export interface MacroDrift {
  /** Added to the warmth rail (mode-drift direction weather), ±DRIFT_MODE_DEPTH. */
  warmthBias: number;
  /** Voicing-band shift, semitones (register clock + night sink), clamped. */
  registerShift: number;
  /** Texture reweight, 0..1 (0 → wash-leaning, 1 → shimmer-leaning). */
  textureLean: number;
}

export function resolveMacroDrift(planetSeed: number, timeSec: number, daylight: number): MacroDrift {
  const phase = (periodMin: number, salt: number): number =>
    Math.sin(2 * Math.PI * (timeSec / (periodMin * 60) + seededUnit(planetSeed, salt)));
  const warmthBias = DRIFT_MODE_DEPTH * phase(DRIFT_MODE_MIN, SALT_DRIFT_MODE_PHASE);
  const drift = DRIFT_REGISTER_SEMIS * phase(DRIFT_REGISTER_MIN, SALT_DRIFT_REGISTER_PHASE);
  const nightSink = NIGHT_REGISTER_SINK * (1 - clamp01(daylight));
  const registerShift = Math.max(
    -REGISTER_SHIFT_MAX,
    Math.min(REGISTER_SHIFT_MAX, Math.round(drift - nightSink))
  );
  const textureLean = 0.5 + 0.5 * phase(DRIFT_TEXTURE_MIN, SALT_DRIFT_TEXTURE_PHASE);
  return { warmthBias, registerShift, textureLean };
}
