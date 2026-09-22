import { describe, expect, it } from 'vitest';
import {
  DIVE_ENTER_AT_S,
  DIVE_EXIT_AT_S,
  DIVE_RAMP_S,
  DIVE_SUBMERGENCE_PLATEAU,
  diveSubmergence
} from './excerpts.ts';

// audioCore.ts:97-98 — module-private, restated here so the ramp is checked
// against the slew it must outlast.
const MUSIC_SUBMERGE_ENTER_SLEW_S = 0.42;
const MUSIC_SUBMERGE_EXIT_SLEW_S = 0.65;

// S2-J2: the dive stress script must represent a swim, not a switch. A stepped
// submergence made the music path's own 0.42 s slew read to a blind listener as
// a brick-wall lowpass "switching in" at 8.5 s.
describe('dive stress script submergence', () => {
  it('ramps in and out over at least one second, longer than either music slew', () => {
    expect(DIVE_RAMP_S).toBeGreaterThanOrEqual(1);
    expect(DIVE_RAMP_S).toBeGreaterThan(MUSIC_SUBMERGE_ENTER_SLEW_S);
    expect(DIVE_RAMP_S).toBeGreaterThan(MUSIC_SUBMERGE_EXIT_SLEW_S);
  });

  it('never steps: no 100 ms of the script moves submergence by more than a tenth', () => {
    let previous = diveSubmergence(0);
    for (let t = 0.1; t <= 60; t += 0.1) {
      const next = diveSubmergence(t);
      expect(Math.abs(next - previous)).toBeLessThanOrEqual(0.1 * (DIVE_SUBMERGENCE_PLATEAU / DIVE_RAMP_S) + 1e-9);
      previous = next;
    }
  });

  it('keeps the dry, plateau and dry states the render was contracted on', () => {
    expect(diveSubmergence(0)).toBe(0);
    expect(diveSubmergence(DIVE_ENTER_AT_S)).toBe(0);
    expect(diveSubmergence(DIVE_ENTER_AT_S + DIVE_RAMP_S)).toBeCloseTo(DIVE_SUBMERGENCE_PLATEAU, 6);
    expect(diveSubmergence(30)).toBe(DIVE_SUBMERGENCE_PLATEAU);
    expect(diveSubmergence(DIVE_EXIT_AT_S)).toBeCloseTo(DIVE_SUBMERGENCE_PLATEAU, 6);
    expect(diveSubmergence(DIVE_EXIT_AT_S + DIVE_RAMP_S)).toBeCloseTo(0, 6);
    expect(diveSubmergence(59)).toBe(0);
  });
});
