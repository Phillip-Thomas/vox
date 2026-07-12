import type { PlanetProfile } from '../game/PlanetProfile.ts';
import {
  DAYLIGHT_WARMTH_FLOOR,
  DAYLIGHT_WARMTH_SCALE,
  NIGHT_WONDER_SCALE,
  PALETTE_BRIGHT_BASE,
  PALETTE_BRIGHT_SATURATION,
  PALETTE_BRIGHT_TEMPERATURE,
  SPACE_WONDER_LIFT,
  SUBMERGENCE_WONDER_LIFT,
  WONDER_FLOOR
} from './generative/tuning.ts';

export {
  DAYLIGHT_WARMTH_FLOOR,
  DAYLIGHT_WARMTH_SCALE,
  NIGHT_WONDER_SCALE,
  PALETTE_BRIGHT_BASE,
  PALETTE_BRIGHT_SATURATION,
  PALETTE_BRIGHT_TEMPERATURE,
  SPACE_WONDER_LIFT,
  SUBMERGENCE_WONDER_LIFT,
  WONDER_FLOOR
};

// One shared palette-to-score mapping for live AudioDirector and offline
// evidence. This is a brightness proxy (temperature + saturation), not literal
// display luminance.
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
