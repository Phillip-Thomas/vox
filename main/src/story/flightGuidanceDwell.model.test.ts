import { describe, expect, it } from 'vitest';
import {
  advanceFlightGuidanceDwell,
  CH8_FLIGHT_GUIDANCE_DWELL_SECONDS,
  createFlightGuidanceDwell,
  resetFlightGuidanceDwell
} from './flightGuidanceDwell.model.ts';

const DWELL = CH8_FLIGHT_GUIDANCE_DWELL_SECONDS;

/** Feed [rawState, nowSeconds] samples; return the published state per frame. */
function feed(samples: Array<[string, number]>, dwell = DWELL): string[] {
  const state = createFlightGuidanceDwell();
  return samples.map(([raw, now]) => advanceFlightGuidanceDwell(state, raw, now, dwell));
}

/** Count how many times the published state changes across a series. */
function transitions(series: string[]): number {
  let n = 0;
  for (let i = 1; i < series.length; i++) if (series[i] !== series[i - 1]) n += 1;
  return n;
}

describe('advanceFlightGuidanceDwell', () => {
  it('latches the first sample immediately (guidance appears at beat entry)', () => {
    expect(feed([['acquire-sibling', 0]])[0]).toBe('acquire-sibling');
  });

  it('holds a stable state with no spurious transitions', () => {
    const out = feed([
      ['descent', 0], ['descent', 0.1], ['descent', 0.2], ['descent', 5]
    ]);
    expect(out.every(s => s === 'descent')).toBe(true);
    expect(transitions(out)).toBe(0);
  });

  it('collapses an oscillating boundary into a SINGLE transition after the dwell', () => {
    // Latch 'descent', then flip descent<->surface-fps every ~16 ms for 3 s.
    const samples: Array<[string, number]> = [['descent', 0]];
    for (let i = 1; i <= 180; i++) {
      const t = i * 0.016; // ~60 fps
      samples.push([i % 2 === 0 ? 'descent' : 'surface-fps', t]);
    }
    const out = feed(samples);
    // Neither value ever persists a full dwell, so the id never leaves 'descent'.
    expect(out.every(s => s === 'descent')).toBe(true);
    expect(transitions(out)).toBe(0);
  });

  it('transitions exactly once for a genuine, sustained state change', () => {
    // 'descent' latched; then 'surface-fps' held continuously past the dwell.
    const samples: Array<[string, number]> = [['descent', 0]];
    for (let i = 1; i <= 200; i++) samples.push(['surface-fps', i * 0.016]);
    const out = feed(samples);
    expect(transitions(out)).toBe(1);
    expect(out[out.length - 1]).toBe('surface-fps');
    // The change lands only AFTER the dwell has elapsed, not before.
    const firstChangeAt = samples[out.findIndex(s => s === 'surface-fps')][1];
    expect(firstChangeAt).toBeGreaterThanOrEqual(DWELL);
  });

  it('restarts the dwell timer when the candidate changes mid-window', () => {
    const state = createFlightGuidanceDwell();
    expect(advanceFlightGuidanceDwell(state, 'acquire-sibling', 0)).toBe('acquire-sibling');
    // 'hold-course' for almost a full dwell, then switch to 'approach-envelope'.
    advanceFlightGuidanceDwell(state, 'hold-course', 0.1);
    advanceFlightGuidanceDwell(state, 'hold-course', DWELL); // ~at threshold from 0.1 start
    // Different candidate resets the clock; neither has now held a full dwell.
    expect(advanceFlightGuidanceDwell(state, 'approach-envelope', DWELL + 0.1)).toBe('acquire-sibling');
    expect(advanceFlightGuidanceDwell(state, 'approach-envelope', DWELL + 0.5)).toBe('acquire-sibling');
    // Once 'approach-envelope' itself persists a full dwell, it latches.
    expect(advanceFlightGuidanceDwell(state, 'approach-envelope', 2 * DWELL + 0.2)).toBe('approach-envelope');
  });

  it('a flicker back to the latched state cancels a pending change', () => {
    const state = createFlightGuidanceDwell();
    advanceFlightGuidanceDwell(state, 'surface-flight', 0);
    advanceFlightGuidanceDwell(state, 'descent', 0.1); // pending starts
    advanceFlightGuidanceDwell(state, 'surface-flight', 0.2); // back to latched: cancel
    expect(state.pendingState).toBeNull();
    // A later, brief 'descent' must still wait a full dwell from ITS start.
    expect(advanceFlightGuidanceDwell(state, 'descent', 0.3)).toBe('surface-flight');
    expect(advanceFlightGuidanceDwell(state, 'descent', 0.3 + DWELL + 0.05)).toBe('descent');
  });

  it('reset makes the next sample latch immediately (fresh beat entry)', () => {
    const state = createFlightGuidanceDwell();
    advanceFlightGuidanceDwell(state, 'descent', 10);
    resetFlightGuidanceDwell(state);
    expect(state).toEqual({ stableState: null, pendingState: null, pendingSince: 0 });
    // Time going "backwards" to 0 (elapsed resets at entry) is fine after reset.
    expect(advanceFlightGuidanceDwell(state, 'acquire-sibling', 0)).toBe('acquire-sibling');
  });

  it('ships a dwell in the intended 1.5-2 s band', () => {
    expect(CH8_FLIGHT_GUIDANCE_DWELL_SECONDS).toBeGreaterThanOrEqual(1.5);
    expect(CH8_FLIGHT_GUIDANCE_DWELL_SECONDS).toBeLessThanOrEqual(2);
  });
});
