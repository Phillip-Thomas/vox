import * as THREE from 'three';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildPlanetArtDirection, type PaletteRoleColor } from './planetArtDirection';

// --- Per-planet terrain tint (derived from the BIOME) ------------------------
//
// Pure, deterministic: terrainSeed -> a gentle hue nudge for the ORGANIC ground
// (dirt / grass-block / sand) so the soil coheres with the planet's grass, trees
// and water instead of being the same browns on every world. A whisper, not a
// recolour — mineral materials (stone/basalt/ice/crystal/ores) are left neutral
// in the shader because they read as geology, not biome.
//
// The voxel palette is baked as GLSL literals (not uniforms), so we don't change
// the palette per planet; instead the shader does a luma-preserving blend of the
// soil diffuse toward `tintColor` by `tintStrength` (see voxelMaterial.ts).
//
// Colour authored sRGB then .convertSRGBToLinear() ONCE (R3F enables
// THREE.ColorManagement; a second convert crushes toward black).

export interface TerrainProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  /** Hue the organic ground is nudged toward (linear). */
  tintColor: THREE.Color;
  /** 0..~0.2 luma-preserving blend amount (soil only). */
  tintStrength: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function roleColor(role: PaletteRoleColor): THREE.Color {
  return new THREE.Color()
    .setHSL(role.h, role.s, role.l)
    .convertSRGBToLinear();
}

/**
 * Build the deterministic per-planet terrain tint. Same seed -> identical.
 */
export function buildTerrainProfile(terrainSeed: number): TerrainProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const art = buildPlanetArtDirection(s);
  const { aridity, alien } = biome;

  // Tint follows the planet-level terrain role. Overall subtlety is governed by
  // tintStrength below so organic ground remains a whisper, not a repaint.
  const tintColor = roleColor(art.palette.terrainSecondary);

  // Whisper by default. Arid worlds read a touch dustier (more tint); alien worlds
  // carry their exotic hue into the ground a little harder so soil isn't plain
  // brown under teal/violet flora.
  const tintStrength = clamp(0.08 + aridity * 0.06 + (alien ? 0.05 : 0), 0.05, 0.2);

  return { terrainSeed: s, biome, tintColor, tintStrength };
}
