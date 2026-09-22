import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  THRESHOLD_FADE_EASE, THRESHOLD_FADE_SECONDS,
  LOW_LINE_PRESENTATION_DELAY_SECONDS, LOW_LINE_FADE_SECONDS,
  createDistrictRamp, advanceDistrictRamp, DISTRICT_FILL
} from './SpaceStationLighting.tsx';
import { STATION_FRAME_PRIORITY, stationFrameTime } from './stationFrameOrder.ts';

describe('signed station threshold timing', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('starts the physical crossing at zero without charging the incoming frame delta', () => {
    const ramp = createDistrictRamp();
    advanceDistrictRamp(ramp, 'counter', 16);
    advanceDistrictRamp(ramp, 'counter', 816);
    const previous = ramp.live.ambientIntensity;
    advanceDistrictRamp(ramp, 'concourse', 1166);
    expect(ramp.toKind).toBe('concourse');
    expect(ramp.duration).toBe(1.4);
    expect(ramp.elapsed).toBe(0);
    expect(ramp.progress).toBe(0);
    expect(ramp.live.ambientIntensity).toBe(previous);
    advanceDistrictRamp(ramp, 'concourse', 2366);
    expect(ramp.progress).toBeGreaterThanOrEqual(0.95);
    advanceDistrictRamp(ramp, 'concourse', 2566);
    expect(ramp.progress).toBe(1);
    expect(ramp.live.ambientIntensity).toBe(DISTRICT_FILL.concourse.ambientIntensity);
  });

  it('retargets from the actually displayed fill during a mid-ramp reversal', () => {
    const ramp = createDistrictRamp();
    advanceDistrictRamp(ramp, 'concourse', 10);
    advanceDistrictRamp(ramp, 'concourse', 710);
    const displayed = ramp.live.ambientIntensity;
    advanceDistrictRamp(ramp, 'counter', 810);
    expect(ramp.live.ambientIntensity).toBe(displayed);
    expect(ramp.duration).toBe(0.8);
    expect(ramp.progress).toBe(0);
    expect(ramp.from.ambientIntensity).toBe(displayed);
  });

  it('publishes walking before portal culling and fill without taking over PostFX', () => {
    expect(STATION_FRAME_PRIORITY.walk).toBeLessThan(STATION_FRAME_PRIORITY.interior);
    expect(STATION_FRAME_PRIORITY.interior).toBeLessThan(STATION_FRAME_PRIORITY.fill);
    expect(STATION_FRAME_PRIORITY.fill).toBeLessThan(STATION_FRAME_PRIORITY.presentation);
    expect(STATION_FRAME_PRIORITY.presentation).toBeLessThan(0);
  });

  it('uses the shared rAF time even when individual callbacks run several milliseconds later', () => {
    const timeline = { currentTime: 8585.1 };
    vi.stubGlobal('document', { timeline });
    const ramp = createDistrictRamp();
    advanceDistrictRamp(ramp, 'concourse', stationFrameTime());
    expect(ramp.crossingTimestampMs).toBe(8585.1);
    timeline.currentTime = 9986.1;
    advanceDistrictRamp(ramp, 'concourse', stationFrameTime());
    expect(ramp.elapsed).toBe(1.4);
    expect(ramp.progress).toBe(1);
    expect(ramp.frameTimestampMs).toBe(9986.1);
  });

  it('finishes the concourse ramp at 1.4 seconds and clears the 1.2-second handoff', () => {
    const duration = THRESHOLD_FADE_SECONDS.concourse;
    expect(duration).toBe(1.4);
    expect(THRESHOLD_FADE_EASE(1.2 / duration)).toBeGreaterThanOrEqual(0.95);
    expect(THRESHOLD_FADE_EASE(1)).toBe(1);
    expect(THRESHOLD_FADE_EASE(2)).toBe(1);
    expect(THRESHOLD_FADE_EASE(-1)).toBe(0);
    const samples = Array.from({ length: 141 }, (_, i) => THRESHOLD_FADE_EASE(i / 140));
    expect(samples.every((value, i) => value >= (samples[i - 1] ?? 0) && value <= 1)).toBe(true);
  });

  it('withdraws warmth faster and retains the low-line timing exports for the audio contract', () => {
    expect(THRESHOLD_FADE_SECONDS.floor).toBe(1);
    for (const district of ['apron', 'counter', 'shelves'] as const) {
      expect(THRESHOLD_FADE_SECONDS[district]).toBe(0.8);
    }
    expect(LOW_LINE_PRESENTATION_DELAY_SECONDS).toBe(0.8);
    expect(LOW_LINE_FADE_SECONDS).toBe(0.4);
    expect(THRESHOLD_FADE_EASE(LOW_LINE_PRESENTATION_DELAY_SECONDS / 1.4)).toBeGreaterThanOrEqual(0.6);
  });
});
