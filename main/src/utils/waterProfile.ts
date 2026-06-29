import * as THREE from 'three';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildPlanetArtDirection, type PaletteRoleColor } from './planetArtDirection';

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

function roleColor(role: PaletteRoleColor): THREE.Color {
  return new THREE.Color()
    .setHSL(role.h, role.s, role.l)
    .convertSRGBToLinear();
}

/**
 * Build the deterministic per-planet water profile. Same seed -> identical.
 */
export function buildWaterProfile(terrainSeed: number): WaterProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const art = buildPlanetArtDirection(s);

  // Deep body: dark + moderately saturated so depths read moody, never neon.
  const deepColor = roleColor(art.palette.waterDeep);

  // Shallow: the planet's one vivid "hero" water tone (medium sat + lightness),
  // nudged a hair brighter in hue. Arid worlds desaturate slightly.
  const shallowColor = roleColor(art.palette.waterShallow);

  // Subsurface glow: a brighter, more saturated sibling of the shallow tone.
  const sssColor = roleColor(art.palette.waterSSS);

  // Foam stays near-white (whitecaps read white everywhere); a faint pull toward
  // the shallow tone keeps it from clashing on strongly-hued seas. Linear blend.
  const foamColor = roleColor(art.palette.waterFoam);

  // Night floor: a dim, dark version of the deep body.
  const nightFloor = deepColor.clone().multiplyScalar(0.4);

  return { terrainSeed: s, biome, deepColor, shallowColor, sssColor, foamColor, nightFloor };
}
