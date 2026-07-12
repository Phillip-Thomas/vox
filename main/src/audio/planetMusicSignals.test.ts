import { describe, expect, it } from 'vitest';
import {
  celestialMusicPrimitives,
  DAYLIGHT_WARMTH_FLOOR,
  PALETTE_BRIGHT_BASE,
  PALETTE_BRIGHT_SATURATION,
  PALETTE_BRIGHT_TEMPERATURE,
  paletteBrightnessOf,
  SPACE_WONDER_LIFT,
  SUBMERGENCE_WONDER_LIFT,
  WONDER_FLOOR
} from './planetMusicSignals.ts';

describe('planet music signal mapping', () => {
  it('shares the exact temperature+saturation palette proxy with live and offline paths', () => {
    const palette = {
      temperature: 0.75,
      saturation: 0.4,
      vegetationHue: 0,
      alien: false
    };
    expect(paletteBrightnessOf({ palette })).toBeCloseTo(
      PALETTE_BRIGHT_BASE +
        PALETTE_BRIGHT_TEMPERATURE * palette.temperature +
        PALETTE_BRIGHT_SATURATION * palette.saturation
    );
  });

  it('maps daylight, space, and submergence continuously without leaving 0..1', () => {
    expect(celestialMusicPrimitives(0, false, 0).warmth).toBe(DAYLIGHT_WARMTH_FLOOR);
    expect(celestialMusicPrimitives(1, false, 0).wonder).toBe(WONDER_FLOOR);
    expect(celestialMusicPrimitives(1, true, 1).wonder).toBe(
      WONDER_FLOOR + SPACE_WONDER_LIFT + SUBMERGENCE_WONDER_LIFT
    );
    expect(celestialMusicPrimitives(0, true, 1).wonder).toBe(1);
  });
});
