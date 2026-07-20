import { describe, it, expect, beforeEach } from 'vitest';
import {
  NIGHT_DAYLIGHT_THRESHOLD,
  NIGHT_DWELL_SECONDS,
  NIGHT_END_PHASE,
  NIGHT_START_PHASE,
  sunElevationFromDayPhase,
  daylightFromDayPhase,
  isDarkDaylight,
  isNightPhase,
  updateNightDwell,
  isNightNow,
  nightDwellProgress,
  resetNightDwell
} from './nightState.ts';
import { daylightFromElevation } from './dayNight.ts';

describe('daylight from day phase (agrees with the visual sun-elevation signal)', () => {
  it('mirrors the sky sun elevation: noon up, sunset/sunrise on the horizon, midnight under', () => {
    expect(sunElevationFromDayPhase(0.25)).toBeCloseTo(1, 5);  // noon overhead
    expect(sunElevationFromDayPhase(0.0)).toBeCloseTo(0, 5);   // sunrise horizon
    expect(sunElevationFromDayPhase(0.5)).toBeCloseTo(0, 5);   // sunset horizon
    expect(sunElevationFromDayPhase(0.75)).toBeCloseTo(-1, 5); // midnight
  });

  it('derives daylight through the SAME curve the visuals use (forced-phase agreement)', () => {
    for (const phase of [0.0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
      expect(daylightFromDayPhase(phase))
        .toBeCloseTo(daylightFromElevation(sunElevationFromDayPhase(phase)), 6);
    }
    expect(daylightFromDayPhase(0.25)).toBeCloseTo(1, 5); // full daylight at noon
    expect(daylightFromDayPhase(0.75)).toBeCloseTo(0, 5); // full dark at midnight
  });

  it('normalizes out-of-range / wrapped phases', () => {
    expect(daylightFromDayPhase(1.25)).toBeCloseTo(daylightFromDayPhase(0.25), 6);
    expect(daylightFromDayPhase(-0.25)).toBeCloseTo(daylightFromDayPhase(0.75), 6);
  });
});

describe('isDarkDaylight threshold', () => {
  it('cuts at the shared threshold', () => {
    expect(isDarkDaylight(NIGHT_DAYLIGHT_THRESHOLD - 0.001)).toBe(true);
    expect(isDarkDaylight(NIGHT_DAYLIGHT_THRESHOLD)).toBe(false);
    expect(isDarkDaylight(1)).toBe(false);
    expect(isDarkDaylight(0)).toBe(true);
  });
});

describe('isNightPhase (pure rest gate)', () => {
  it('opens the instant the sky darkens — earlier than the old 0.55 lockout', () => {
    expect(NIGHT_START_PHASE).toBeGreaterThan(0.5);   // after the 0.5 sunset
    expect(NIGHT_START_PHASE).toBeLessThan(0.52);     // but promptly, ~0.505
    expect(NIGHT_START_PHASE).toBeLessThan(0.55);     // strictly earlier than before
  });

  it('is day before the darkness crossing and night after', () => {
    expect(isNightPhase(0.25)).toBe(false);                    // noon
    expect(isNightPhase(0.5)).toBe(false);                     // sunset horizon, still lit
    expect(isNightPhase(NIGHT_START_PHASE - 0.002)).toBe(false);
    expect(isNightPhase(NIGHT_START_PHASE + 0.002)).toBe(true);
    expect(isNightPhase(0.75)).toBe(true);                     // midnight
  });

  it('closes at the dawn wrap so rest ends at sunrise', () => {
    expect(isNightPhase(NIGHT_END_PHASE)).toBe(true);          // inclusive boundary
    expect(isNightPhase(NIGHT_END_PHASE + 0.0001)).toBe(false);
    expect(isNightPhase(0.02)).toBe(false);                    // morning, past the wrap
  });
});

describe('live night dwell (occlusion guard)', () => {
  beforeEach(() => resetNightDwell());

  it('latches only after ~5s of sustained darkness', () => {
    expect(updateNightDwell(0, NIGHT_DWELL_SECONDS - 1)).toBe(false); // 4s dark, not yet
    expect(isNightNow()).toBe(false);
    expect(nightDwellProgress()).toBeCloseTo((NIGHT_DWELL_SECONDS - 1) / NIGHT_DWELL_SECONDS, 5);
    expect(updateNightDwell(0, 1)).toBe(true);                         // 5s total — latched
    expect(isNightNow()).toBe(true);
  });

  it('a momentary occlusion does not count as night', () => {
    updateNightDwell(0, 2);          // 2s of dark (e.g. under a cliff)
    expect(isNightNow()).toBe(false);
    updateNightDwell(1, 0.1);        // light returns — dwell resets
    expect(nightDwellProgress()).toBe(0);
    updateNightDwell(0, 2);          // 2s dark again — still short of the dwell
    expect(isNightNow()).toBe(false);
  });

  it('clears the moment real light returns', () => {
    updateNightDwell(0, 10);         // firmly night
    expect(isNightNow()).toBe(true);
    expect(updateNightDwell(1, 0.016)).toBe(false); // one lit frame
    expect(isNightNow()).toBe(false);
  });

  it('ignores non-finite / non-positive deltas', () => {
    expect(updateNightDwell(0, Number.NaN)).toBe(false);
    expect(updateNightDwell(0, -5)).toBe(false);
    expect(nightDwellProgress()).toBe(0);
  });

  it('resets cleanly', () => {
    updateNightDwell(0, 10);
    resetNightDwell();
    expect(isNightNow()).toBe(false);
    expect(nightDwellProgress()).toBe(0);
  });
});
