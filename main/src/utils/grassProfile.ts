import * as THREE from 'three';
import { seededUnit } from './worldCoordinates';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildWindProfile, type WindProfile } from './windProfile';

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
  /** Shared per-planet atmosphere profile for visual/audio/gameplay consumers. */
  wind: WindProfile;
  /** Rounded-normal amount (cross-section curvature for lush shading). */
  roundness: number;
}

// Salts disjoint from biomeProfile / treeProfile.
const SALT_HEIGHT = 34;
const SALT_WIDTH = 35;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Build the deterministic per-planet grass profile. Same seed -> identical.
 */
export function buildGrassProfile(terrainSeed: number): GrassProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const wind = buildWindProfile(s, biome);
  const { grassHue, saturation, lushness, aridity, temperature } = biome;

  // --- Colours ---------------------------------------------------------------
  // Lush worlds are a touch brighter/deeper; arid worlds desaturate. Temperature
  // nudges hue a hair (cold -> cooler/bluer, hot -> warmer/yellower). Grass reads
  // the warm/yellow side of the biome's split-complementary veg pair (the canopy
  // takes the cool side), so grass + leaves complement rather than match.
  const tHue = (grassHue + (temperature - 0.5) * 0.04 + 1) % 1;
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
  // Dry patches: a SUN-BLEACHED version of THIS planet's hue (paler, desaturated,
  // nudged warm) — not a fixed gold. A fixed gold turned alien (teal/violet)
  // biomes olive when they dried; this keeps each planet's identity even arid.
  const dryColor = new THREE.Color()
    .setHSL((tHue + 0.04) % 1, clamp(sat * 0.45, 0.08, 0.4), 0.52)
    .convertSRGBToLinear();

  const dryness = clamp(aridity * 0.85, 0, 0.85);

  // --- Density (the headline per-planet knob) --------------------------------
  // 0.45x (sparse) .. ~1.8x (jungle) of the global quality density. The renderer's
  // per-density unit is now finer, so this raises perceived coverage without
  // returning to broad leaves.
  const densityMul = 0.45 + lushness * 1.35;
  // Bare-ground patches: lush worlds fully covered, arid/sparse worlds thin out.
  const coverage = clamp(0.5 + lushness * 0.5 - aridity * 0.3, 0.35, 1.0);

  // --- Stature ---------------------------------------------------------------
  // Wide, readable height range: short turf (~0.6) .. tall grass (~1.9). Lushness
  // adds height; a per-seed draw keeps even similar biomes individual.
  const heightMul = clamp(0.6 + lushness * 0.7 + seededUnit(s, SALT_HEIGHT) * 0.6, 0.6, 1.9);
  const widthMul = 0.58 + seededUnit(s, SALT_WIDTH) * 0.32;

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
    windDir: wind.direction.clone(),
    windStrength: wind.strength,
    wind,
    roundness: 0.85
  };
}
