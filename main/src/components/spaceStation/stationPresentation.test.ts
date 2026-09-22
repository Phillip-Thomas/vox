import { describe, expect, it } from 'vitest';
import { createStationPresentation, presentationOpacity, startPresentationOnce, updateStationLowLine } from './stationPresentation.ts';
describe('station presentation lifecycle', () => {
  it('keeps the physical crossing clock through HUD updates and a panel interruption', () => {
    const visit = createStationPresentation(false);
    const crossing = startPresentationOnce(visit.lowLines, 'concourse-warmth', 1000);
    for (let elapsed = 0; elapsed <= 1400; elapsed += 10) {
      expect(startPresentationOnce(visit.lowLines, 'concourse-warmth', 1000 + elapsed)).toBe(crossing);
      const opacity = presentationOpacity(crossing, 1000 + elapsed, 800, 400, false);
      if (elapsed <= 800) expect(opacity).toBe(0);
      if (elapsed >= 1200) expect(opacity).toBe(1);
    }
    expect(presentationOpacity(crossing, 1900, 800, 400, false)).toBe(0.25);
    expect(presentationOpacity(crossing, 2000, 800, 400, false)).toBe(0.5);
  });
  it('publishes complete opacity before the first renderer frame after1.2s', () => {
    const visit = createStationPresentation(false);
    const style = { opacity: '0' }, dataset: Record<string, string> = {};
    visit.lowLine = { element: { style, dataset }, startedAt: 8585.1, delayMs: 800, durationMs: 400, reduced: false };
    updateStationLowLine(visit, 9370);
    expect(style.opacity).toBe('0');
    updateStationLowLine(visit, 9770.6);
    expect(Number(style.opacity)).toBeCloseTo(0.96375);
    // Candidate3 used the preceding rAF's value here; both paint and a probe
    // must now see the value for9786 itself, without waiting for another callback.
    updateStationLowLine(visit, 9786);
    expect(style.opacity).toBe('1');
    expect(dataset.stationFrameTimestampMs).toBe('9786');
    visit.lowLine = null;
    updateStationLowLine(visit, 9790);
    expect(style.opacity).toBe('1');
  });

  it('steps reduced motion at the authored full-opacity instant after the warmth arrives', () => {
    expect(presentationOpacity(1000, 1799, 800, 400, true)).toBe(0);
    expect(presentationOpacity(1000, 1800, 800, 400, true)).toBe(0);
    // Actual C5 failure: at +0.834s the lighting was only 0.675128 complete,
    // but the old reduced-motion branch already made the line fully opaque.
    expect(presentationOpacity(1000, 1834, 800, 400, true)).toBe(0);
    expect(presentationOpacity(1000, 2199, 800, 400, true)).toBe(0);
    expect(presentationOpacity(1000, 2200, 800, 400, true)).toBe(1);
    expect(presentationOpacity(1000, 2400, 800, 400, true)).toBe(1);
    expect(presentationOpacity(1000, 1834, 800, 400, false)).toBeCloseTo(0.085);
  });
  it('does not announce restored milestones and resets clocks on a new visit', () => {
    const restored = createStationPresentation(true);
    const start = startPresentationOnce(restored.lowLines, 'concourse-warmth', 1000);
    expect(presentationOpacity(start, 1000, 800, 400, false)).toBe(1);
    const previous = createStationPresentation(false);
    startPresentationOnce(previous.objectives, 'registry', 100);
    expect(createStationPresentation(false).objectives.has('registry')).toBe(false);
  });
});
