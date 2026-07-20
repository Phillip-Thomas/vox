import { describe, expect, it } from 'vitest';
import { CINEMATIC_HUD_HIDE_THRESHOLD, cinematicHidesHud } from './cinematicHud.ts';

describe('cinematic HUD hide threshold', () => {
  it('keeps the HUD visible with no cinematic in', () => {
    expect(cinematicHidesHud(0)).toBe(false);
    expect(cinematicHidesHud(CINEMATIC_HUD_HIDE_THRESHOLD)).toBe(false); // exactly at the edge
  });

  it('hides the HUD once the letterbox envelope crosses the small threshold', () => {
    expect(cinematicHidesHud(CINEMATIC_HUD_HIDE_THRESHOLD + 0.001)).toBe(true);
    expect(cinematicHidesHud(0.5)).toBe(true);
    expect(cinematicHidesHud(1)).toBe(true);
  });

  it('respects a custom threshold', () => {
    expect(cinematicHidesHud(0.3, 0.4)).toBe(false);
    expect(cinematicHidesHud(0.5, 0.4)).toBe(true);
  });

  it('treats a non-finite envelope as not hiding', () => {
    expect(cinematicHidesHud(Number.NaN)).toBe(false);
    expect(cinematicHidesHud(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
