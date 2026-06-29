import * as THREE from 'three';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { seededUnit } from './worldCoordinates';

export interface WindProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  /** Prevailing wind direction in a consumer's local tangent plane. */
  direction: THREE.Vector2;
  /** Base wind bend multiplier. */
  strength: number;
  /** How strongly moving gust cells amplify local motion. */
  gustStrength: number;
  /** World-space noise frequency for broad gust cells. */
  gustScale: number;
  /** Time multiplier for moving gust cells. */
  gustSpeed: number;
  /** Small-scale direction/strength disorder inside a gust. */
  turbulence: number;
  /** Max local direction bend, in radians, away from prevailing wind. */
  veer: number;
  /** Stable offset so planets do not share the same gust map origin. */
  offset: THREE.Vector2;
}

const SALT_DIR = 91;
const SALT_STRENGTH = 92;
const SALT_GUST = 93;
const SALT_SCALE = 94;
const SALT_SPEED = 95;
const SALT_TURB = 96;
const SALT_VEER = 97;
const SALT_OFF_X = 98;
const SALT_OFF_Y = 99;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Deterministic per-planet atmospheric wind. This is intentionally pure data:
 * renderers, audio, particles, trees, weather, and gameplay can consume the same
 * profile later without subscribing to a global runtime service.
 */
export function buildWindProfile(terrainSeed: number, biome = buildBiomeProfile(terrainSeed)): WindProfile {
  const s = terrainSeed | 0;
  const { aridity, lushness, temperature } = biome;
  const exposure = clamp(
    0.2 +
    aridity * 0.3 +
    (1 - lushness) * 0.18 +
    Math.abs(temperature - 0.5) * 0.2 +
    seededUnit(s, SALT_STRENGTH) * 0.34,
    0,
    1
  );

  const angle = seededUnit(s, SALT_DIR) * Math.PI * 2;
  const gustRoll = seededUnit(s, SALT_GUST);
  const turbRoll = seededUnit(s, SALT_TURB);
  const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  const strength = 0.58 + exposure * 1.12;
  const gustStrength = 0.45 + exposure * 0.9 + gustRoll * 0.25;
  const gustScale = 0.022 + seededUnit(s, SALT_SCALE) * 0.056;
  const gustSpeed = 0.22 + seededUnit(s, SALT_SPEED) * 0.46 + exposure * 0.24;
  const turbulence = clamp(0.16 + turbRoll * 0.54 + exposure * 0.28, 0.16, 0.98);
  const veer = 0.32 + turbulence * 1.05 + seededUnit(s, SALT_VEER) * 0.34;
  const offset = new THREE.Vector2(
    seededUnit(s, SALT_OFF_X) * 200 - 100,
    seededUnit(s, SALT_OFF_Y) * 200 - 100
  );

  return {
    terrainSeed: s,
    biome,
    direction,
    strength,
    gustStrength,
    gustScale,
    gustSpeed,
    turbulence,
    veer,
    offset
  };
}

