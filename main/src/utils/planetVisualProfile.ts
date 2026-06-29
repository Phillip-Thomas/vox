import * as THREE from 'three';
import {
  buildPlanetArtDirection,
  type PaletteRoleColor,
  type PlanetArtDirection
} from './planetArtDirection';

export interface PlanetAtmosphereProfile {
  artDirection: PlanetArtDirection;
  /** Luminous horizon / low-sky color consumed by SpaceSky (linear). */
  lowSky: THREE.Color;
  /** Deeper upper-sky color consumed by SpaceSky (linear). */
  highSky: THREE.Color;
  /** Sun bloom / aureole tint consumed by SpaceSky (linear). */
  sunGlow: THREE.Color;
  /** Subtle scene fog tint, kept low-strength in SkyController (sRGB). */
  fogTint: THREE.Color;
  /** Atmosphere density multiplier, still bounded for flight readability. */
  fogDensityMul: number;
}

export interface PlanetPostGradeProfile {
  artDirection: PlanetArtDirection;
  /** Near-white planet tint consumed by ColorGradeEffect (linear). */
  tint: THREE.Color;
  tintAmount: number;
  saturation: number;
  contrast: number;
  warmthBias: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function roleColor(role: PaletteRoleColor, patch: Partial<Pick<PaletteRoleColor, 'h' | 's' | 'l'>> = {}): THREE.Color {
  return new THREE.Color()
    .setHSL(
      patch.h ?? role.h,
      clamp(patch.s ?? role.s, 0, 1),
      clamp(patch.l ?? role.l, 0, 1)
    )
    .convertSRGBToLinear();
}

export function paletteRoleToLinearColor(role: PaletteRoleColor): THREE.Color {
  return roleColor(role);
}

export function buildPlanetAtmosphereProfile(terrainSeed: number): PlanetAtmosphereProfile {
  const artDirection = buildPlanetArtDirection(terrainSeed | 0);
  const { palette, ecology, windDrama, archetype } = artDirection;

  const lowSky = roleColor(palette.skyHigh, {
    s: clamp(palette.skyHigh.s * 0.72, 0.12, 0.62),
    l: clamp(Math.max(palette.skyHigh.l, 0.74), 0.62, 0.9)
  });
  const highSky = roleColor(palette.skyLow, {
    s: clamp(palette.skyLow.s * 1.08, 0.14, 0.78),
    l: clamp(palette.skyLow.l * 0.68, 0.22, 0.46)
  });
  const sunGlow = roleColor(palette.sunGlow, {
    s: clamp(palette.sunGlow.s * 0.88, 0.16, 0.74),
    l: clamp(palette.sunGlow.l, 0.58, 0.82)
  });

  const fogTint = new THREE.Color().setHSL(
    palette.fogTint.h,
    clamp(palette.fogTint.s, 0.08, 0.32),
    clamp(palette.fogTint.l, 0.46, 0.72)
  );

  const sparseAir = archetype === 'arid' || archetype === 'metallic' || archetype === 'crystal';
  const fogDensityMul = clamp(
    0.82 + ecology.richness * 0.34 + windDrama * 0.12 - (sparseAir ? 0.1 : 0),
    0.74,
    1.28
  );

  return { artDirection, lowSky, highSky, sunGlow, fogTint, fogDensityMul };
}

export function buildPlanetPostGradeProfile(terrainSeed: number): PlanetPostGradeProfile {
  const artDirection = buildPlanetArtDirection(terrainSeed | 0);
  const { palette, budgets, shape, paletteFamily, archetype } = artDirection;
  const accentFamily = paletteFamily === 'alien-iridescent' || paletteFamily === 'fungal-bioglow';

  const tint = roleColor(palette.postGradeTint, {
    s: clamp(palette.postGradeTint.s * (accentFamily ? 1.22 : 1.0), 0.08, 0.38),
    l: clamp(palette.postGradeTint.l, 0.46, 0.62)
  });

  const tintAmount = clamp(
    0.055 + budgets.accent * 0.32 + (accentFamily ? 0.018 : 0) + (archetype === 'volcanic' ? 0.012 : 0),
    0.05,
    0.12
  );
  const saturation = clamp(
    0.99 + budgets.saturationBudget * 0.105 - shape.negativeSpace * 0.035,
    0.96,
    1.08
  );
  const contrast = clamp(
    0.99 + budgets.valueContrast * 0.045 + shape.angularity * 0.025,
    0.98,
    1.08
  );
  const warmthBias = archetype === 'volcanic' || archetype === 'arid'
    ? 0.06
    : archetype === 'frozen' || archetype === 'metallic'
      ? -0.045
      : 0;

  return { artDirection, tint, tintAmount, saturation, contrast, warmthBias };
}
