import * as THREE from 'three';
import { seededUnit } from './worldCoordinates';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';

// --- Per-planet water profile (derived from the BIOME) -----------------------
//
// Pure, deterministic: terrainSeed -> an ocean appearance, driven by the shared
// biomeProfile so water coheres with the planet's grass/trees/climate instead of
// being the same teal on every world. The biome's vegetation hue carries the
// planet's colour identity into the sea — a violet world gets amethyst shallows,
// a toxic world gets jade — while a cool "open water" anchor keeps every ocean
// reading as WATER (alien worlds lean harder into their own hue).
//
// Restraint mirrors grassProfile: depths stay low-saturation and dark, the
// shallow tone is the one vivid "hero" colour, foam stays near-white (whitecaps
// read white on every planet). Colours authored sRGB then .convertSRGBToLinear()
// ONCE (R3F enables THREE.ColorManagement — a second convert crushes toward
// black; see the bark double-convert bug).

export interface WaterProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  /** Trough / deep-body colour (linear). */
  deepColor: THREE.Color;
  /** Crest / shoreline "hero" colour (linear). */
  shallowColor: THREE.Color;
  /** Backlit subsurface glow tint (linear). */
  sssColor: THREE.Color;
  /** Whitecap colour (near-white, faint biome pull) (linear). */
  foamColor: THREE.Color;
  /** Dim night ocean-floor ambient (linear). */
  nightFloor: THREE.Color;
}

// Salt disjoint from biomeProfile (51..57), grassProfile (34..38), treeProfile (1..10).
const SALT_WATER_HUE = 70;

// Cyan-blue "open water" anchor every ocean is pulled toward so it still reads as
// water even when the planet's vegetation hue is exotic.
const WATER_ANCHOR_HUE = 0.55;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Shortest-path circular interpolation between two hues (0..1). */
function mixHue(a: number, b: number, t: number): number {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (a + d * t + 1) % 1;
}

/**
 * Build the deterministic per-planet water profile. Same seed -> identical.
 */
export function buildWaterProfile(terrainSeed: number): WaterProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const { hue, saturation, lushness, aridity, temperature, alien } = biome;

  // Water hue: blend the biome's vegetation hue toward the cool water anchor.
  // Alien worlds carry their hue harder so the sea keeps the planet's identity;
  // green worlds stay closer to a believable blue-teal. A small temperature nudge
  // (cold -> bluer, hot -> greener) and a faint per-seed jitter add individuality.
  const towardBiome = alien ? 0.6 : 0.32;
  let wHue = mixHue(WATER_ANCHOR_HUE, hue, towardBiome);
  wHue = (wHue + (temperature - 0.5) * 0.04 + (seededUnit(s, SALT_WATER_HUE) - 0.5) * 0.03 + 1) % 1;

  // Deep body: dark + moderately saturated so depths read moody, never neon.
  const deepSat = clamp(0.5 + saturation * 0.18, 0.4, 0.72);
  const deepL = clamp(0.13 + lushness * 0.05, 0.12, 0.2);
  const deepColor = new THREE.Color().setHSL(wHue, deepSat, deepL).convertSRGBToLinear();

  // Shallow: the planet's one vivid "hero" water tone (medium sat + lightness),
  // nudged a hair brighter in hue. Arid worlds desaturate slightly.
  const shalSat = clamp(0.42 + saturation * 0.12 - aridity * 0.1, 0.3, 0.62);
  const shalL = clamp(0.46 + lushness * 0.06, 0.42, 0.58);
  const shallowColor = new THREE.Color()
    .setHSL((wHue + 0.02) % 1, shalSat, shalL)
    .convertSRGBToLinear();

  // Subsurface glow: a brighter, more saturated sibling of the shallow tone.
  const sssColor = new THREE.Color()
    .setHSL((wHue + 0.04) % 1, clamp(shalSat + 0.12, 0.3, 0.75), clamp(shalL - 0.02, 0.4, 0.55))
    .convertSRGBToLinear();

  // Foam stays near-white (whitecaps read white everywhere); a faint pull toward
  // the shallow tone keeps it from clashing on strongly-hued seas. Linear blend.
  const foamColor = new THREE.Color(0xeef7ff).convertSRGBToLinear().lerp(shallowColor, 0.08);

  // Night floor: a dim, dark version of the deep body.
  const nightFloor = deepColor.clone().multiplyScalar(0.4);

  return { terrainSeed: s, biome, deepColor, shallowColor, sssColor, foamColor, nightFloor };
}
