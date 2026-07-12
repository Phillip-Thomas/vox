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
  REGISTER_SHIFT_MAX,
  TICK_DESCENT_PRESSURE,
  TICK_GATE,
  TICK_HZ_BASE,
  TICK_HZ_MAX,
  TICK_HZ_MIN,
  TICK_SUBMERGE_FLOOR,
  TICK_WARP_MULT
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
  windStrength: number;
  windTurbulence: number;
  windGustSpeed: number;
  windVeer: number;
  scene: MusicScene;
  warpActive: boolean;
  warpProgress: number;
  /** Region unit (0..1) from quantized world position — travel turns the rhythm. */
  regionUnit: number;
  /** Elapsed real seconds (macro-drift clocks). */
  timeSec: number;
  /** Destination planet seed while approaching (null = no destination). */
  destinationSeed: number | null;
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
    windStrength: 0.6,
    windTurbulence: 0.3,
    windGustSpeed: 0.4,
    windVeer: 0.6,
    scene: 'surface',
    warpActive: false,
    warpProgress: 0,
    regionUnit: 0,
    timeSec: 0,
    destinationSeed: null,
    destinationArchetype: null,
    storyLeads: false
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// --- The world-clock tick (§8.1, owner ruling #2) -----------------------------------------------

export interface WorldClockTick {
  /** Tick rate, Hz — NEVER quantized to the musical grid (that rule is the device). */
  hz: number;
  /** Audible at all (fades over whole bars in the rim). */
  present: boolean;
  /** Loudness/attack intent, 0..1 (tension × clock pressure). */
  level: number;
}

/**
 * Clock pressure: descent urgency × warp time-compression × depth dilation.
 * Tension does NOT drive rate (§8.1) — it drives presence and level only.
 */
export function resolveClockPressure(s: BedSignals): number {
  let pressure = 1;
  if (s.scene === 'descent') {
    // Radar-altimeter urgency: accelerates toward the ceiling as the ground
    // nears (warp progress carries the approach-to-ground motion we have).
    pressure *= TICK_DESCENT_PRESSURE * (0.75 + 0.25 * clamp01(s.warpProgress));
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
  const level = clamp01(Math.max(forced ? 0.4 : 0, s.tension) * clamp01(pressure / TICK_HZ_MAX) * 2);
  return { hz, present, level };
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
  /** Granular shimmer / bell texture (alive). */
  shimmer: number;
  /** Tuned sub (triangle bass from color, sine sub toward alive). */
  sub: number;
  /** Riser swells (material+). */
  riser: number;
  /** Slapback/delay space (color+). */
  delay: number;
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
    shimmer: alive,
    sub: color,
    riser: material,
    delay: color
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
