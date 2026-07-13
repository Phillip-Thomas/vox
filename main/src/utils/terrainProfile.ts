import * as THREE from 'three';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildPlanetArtDirection, type PaletteRoleColor } from './planetArtDirection';
import { seededUnit } from './worldCoordinates';

// --- Per-planet terrain tint (derived from the BIOME) ------------------------
//
// Pure, deterministic: terrainSeed -> a gentle hue nudge for the ORGANIC ground
// (dirt / grass-block / sand) so the soil coheres with the planet's grass, trees
// and water instead of being the same browns on every world. Seeded geology
// uniforms separately vary rock, mineral, and hazard families without changing
// their authored value hierarchy.
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
  /** Seeded domain transform prevents identical geology on every planet. */
  surfaceOffset: THREE.Vector3;
  surfaceScale: number;
  surfaceRelief: number;
  weathering: number;
  /** 0..1 exposed mineral flecks in host rock; strongest on metallic worlds. */
  mineralization: number;
  rockTint: THREE.Color;
  mineralTint: THREE.Color;
  hazardTint: THREE.Color;
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

  const surfaceOffset = new THREE.Vector3(
    (seededUnit(s, 701) - 0.5) * 384,
    (seededUnit(s, 702) - 0.5) * 384,
    (seededUnit(s, 703) - 0.5) * 384
  );
  const surfaceScale = 0.82 + seededUnit(s, 704) * 0.36;
  const weathering = 0.18 + seededUnit(s, 705) * 0.82;

  return {
    terrainSeed: s,
    biome,
    tintColor,
    tintStrength,
    surfaceOffset,
    surfaceScale,
    surfaceRelief: art.shape.surfaceReliefScale,
    weathering,
    mineralization: clamp(art.materialPhenomena.metallicFlecks / 1.2, 0, 1),
    rockTint: roleColor(art.palette.rockBase),
    mineralTint: roleColor(art.palette.mineralAccent),
    hazardTint: roleColor(art.palette.hazardAccent)
  };
}
