import * as THREE from 'three';
import { seededUnit } from './worldCoordinates';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';

// --- Per-planet grass profile (derived from the BIOME) -----------------------
//
// Pure, deterministic: terrainSeed -> a grass appearance, driven by the shared
// biomeProfile so grass cohere with the planet's trees/climate. The biome's
// climate axes (lushness / aridity / temperature) drive the DRAMATIC, readable
// differences the field needs:
//   • lushness -> density + coverage + height (sparse short turf <-> dense tall meadow)
//   • aridity  -> dryness + golden bleaching + bare patches
//   • hue/sat  -> colour family (cohered with trees; alien planets pop)
//
// Colours authored sRGB then .convertSRGBToLinear() (matching grassField).

export interface GrassProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  /** Darker root colour (linear). */
  baseColor: THREE.Color;
  /** Brighter tip colour (linear). */
  tipColor: THREE.Color;
  /** Golden/arid colour mixed into dry patches (linear). */
  dryColor: THREE.Color;
  /** Backlit subsurface glow tint (linear). */
  sssColor: THREE.Color;
  /** 0..1 how much of the field dries out in patches. */
  dryness: number;
  /** Blade-count multiplier vs the global quality density (per-planet density). */
  densityMul: number;
  /** 0..1 fraction of grass voxels that actually grow blades (bare patches < 1). */
  coverage: number;
  /** Blade height multiplier (wide range: short turf .. tall savanna). */
  heightMul: number;
  /** Blade width multiplier. */
  widthMul: number;
  /** Unit wind direction in the blade's local XZ (tangent) plane. */
  windDir: THREE.Vector2;
  /** Per-planet wind strength multiplier. */
  windStrength: number;
  /** Rounded-normal amount (cross-section curvature for lush shading). */
  roundness: number;
}

// Salts disjoint from biomeProfile / treeProfile.
const SALT_HEIGHT = 34;
const SALT_WIDTH = 35;
const SALT_WIND_DIR = 37;
const SALT_WIND_STR = 38;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Build the deterministic per-planet grass profile. Same seed -> identical.
 */
export function buildGrassProfile(terrainSeed: number): GrassProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const { hue, saturation, lushness, aridity, temperature } = biome;

  // --- Colours ---------------------------------------------------------------
  // Lush worlds are a touch brighter/deeper; arid worlds desaturate. Temperature
  // nudges hue a hair (cold -> cooler/bluer, hot -> warmer/yellower).
  const tHue = (hue + (temperature - 0.5) * 0.04 + 1) % 1;
  const sat = clamp(saturation - aridity * 0.15, 0.1, 0.9);
  const baseColor = new THREE.Color()
    .setHSL(tHue, clamp(sat + 0.08, 0, 1), 0.24 + lushness * 0.08)
    .convertSRGBToLinear();
  const tipColor = new THREE.Color()
    .setHSL((tHue + 0.02) % 1, clamp(sat - 0.04, 0, 1), 0.48 + lushness * 0.08)
    .convertSRGBToLinear();
  const sssColor = new THREE.Color()
    .setHSL((tHue + 0.015) % 1, clamp(sat + 0.14, 0, 1), 0.6)
    .convertSRGBToLinear();
  // Dry patches: warm straw/gold, hue-shifted toward amber regardless of veg hue.
  const dryColor = new THREE.Color()
    .setHSL(clamp(0.09 + temperature * 0.04, 0.06, 0.16), 0.55, 0.46)
    .convertSRGBToLinear();

  const dryness = clamp(aridity * 0.9, 0, 0.9);

  // --- Density (the headline per-planet knob) --------------------------------
  // 0.35x (sparse) .. ~1.85x (jungle) of the global quality density.
  const densityMul = 0.35 + lushness * 1.5;
  // Bare-ground patches: lush worlds fully covered, arid/sparse worlds thin out.
  const coverage = clamp(0.5 + lushness * 0.5 - aridity * 0.3, 0.35, 1.0);

  // --- Stature ---------------------------------------------------------------
  // Wide, readable height range: short turf (~0.6) .. tall grass (~1.9). Lushness
  // adds height; a per-seed draw keeps even similar biomes individual.
  const heightMul = clamp(0.6 + lushness * 0.7 + seededUnit(s, SALT_HEIGHT) * 0.6, 0.6, 1.9);
  const widthMul = 0.8 + seededUnit(s, SALT_WIDTH) * 0.55;

  const windAng = seededUnit(s, SALT_WIND_DIR) * Math.PI * 2;
  const windDir = new THREE.Vector2(Math.cos(windAng), Math.sin(windAng));
  const windStrength = 0.7 + seededUnit(s, SALT_WIND_STR) * 0.7;

  return {
    terrainSeed: s,
    biome,
    baseColor,
    tipColor,
    dryColor,
    sssColor,
    dryness,
    densityMul,
    coverage,
    heightMul,
    widthMul,
    windDir,
    windStrength,
    roundness: 0.85
  };
}
