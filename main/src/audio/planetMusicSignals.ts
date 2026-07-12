import type { PlanetProfile } from '../game/PlanetProfile.ts';

// One shared palette-to-score mapping for live AudioDirector and offline
// evidence. This is a brightness proxy (temperature + saturation), not literal
// display luminance.
export const PALETTE_BRIGHT_BASE = 0.3;
export const PALETTE_BRIGHT_TEMPERATURE = 0.4;
export const PALETTE_BRIGHT_SATURATION = 0.3;
export const DAYLIGHT_WARMTH_SCALE = 0.85;
export const DAYLIGHT_WARMTH_FLOOR = 0.1;
export const NIGHT_WONDER_SCALE = 0.55;
export const SPACE_WONDER_LIFT = 0.5;
export const SUBMERGENCE_WONDER_LIFT = 0.35;
export const WONDER_FLOOR = 0.15;

export function paletteBrightnessOf(profile: Pick<PlanetProfile, 'palette'>): number {
  return Math.min(
    1,
    Math.max(
      0,
      PALETTE_BRIGHT_BASE +
        PALETTE_BRIGHT_TEMPERATURE * profile.palette.temperature +
        PALETTE_BRIGHT_SATURATION * profile.palette.saturation
    )
  );
}

/** Exact daylight/depth rails shared by live wiring and isolated A/B evidence. */
export function celestialMusicPrimitives(
  daylight: number,
  inSpace: boolean,
  submergence: number
): { warmth: number; wonder: number } {
  return {
    warmth: daylight * DAYLIGHT_WARMTH_SCALE + DAYLIGHT_WARMTH_FLOOR,
    wonder: Math.min(
      1,
      (1 - daylight) * NIGHT_WONDER_SCALE +
        (inSpace ? SPACE_WONDER_LIFT : 0) +
        submergence * SUBMERGENCE_WONDER_LIFT +
        WONDER_FLOOR
    )
  };
}
