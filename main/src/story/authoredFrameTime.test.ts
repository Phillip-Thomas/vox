import { describe, expect, it } from 'vitest';
import {
  advanceAuthoredForegroundClock,
  authoredFrameDelta,
  createAuthoredForegroundClock,
  DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS
} from './authoredFrameTime.ts';

describe('authored foreground frame time', () => {
  it('preserves ordinary frame cadence and bounds degraded foreground frames', () => {
    expect(authoredFrameDelta(1 / 60)).toBeCloseTo(1 / 60, 8);
    expect(authoredFrameDelta(2.4)).toBe(DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS);
  });

  it('never converts pause, visibility loss, invalid time, or reverse time into progress', () => {
    expect(authoredFrameDelta(2.4, { paused: true })).toBe(0);
    expect(authoredFrameDelta(2.4, { hidden: true })).toBe(0);
    expect(authoredFrameDelta(Number.POSITIVE_INFINITY)).toBe(0);
    expect(authoredFrameDelta(-1)).toBe(0);
  });

  it('keeps the cap explicit for lanes that intentionally retain a tighter cadence', () => {
    expect(authoredFrameDelta(2.4, { maxSeconds: 0.1 })).toBe(0.1);
  });

  it('discards the first visible callback after a hidden interval without losing visible low-FPS catch-up', () => {
    const fakeDocument = new EventTarget() as EventTarget & { visibilityState: string };
    fakeDocument.visibilityState = 'visible';
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });
    try {
      const clock = createAuthoredForegroundClock();
      expect(advanceAuthoredForegroundClock(clock, 2.4)).toBe(
        DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS
      );

      // No authored callback runs while hidden: visibility events are the only
      // evidence carried into the first returning, currently-visible frame.
      fakeDocument.visibilityState = 'hidden';
      fakeDocument.dispatchEvent(new Event('visibilitychange'));
      fakeDocument.visibilityState = 'visible';
      fakeDocument.dispatchEvent(new Event('visibilitychange'));

      expect(advanceAuthoredForegroundClock(clock, 30)).toBe(0);
      expect(clock.elapsedSeconds).toBe(DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS);
      expect(advanceAuthoredForegroundClock(clock, 2.4)).toBe(
        DEFAULT_AUTHORED_FRAME_DELTA_CAP_SECONDS
      );
    } finally {
      if (previousDocument === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as { document?: Document }).document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          value: previousDocument
        });
      }
    }
  });

  it('freezes accumulated animation time and consumes the first frame after pause', () => {
    const clock = createAuthoredForegroundClock(4);
    expect(advanceAuthoredForegroundClock(clock, 1 / 60, { paused: true })).toBe(0);
    expect(clock.elapsedSeconds).toBe(4);
    expect(advanceAuthoredForegroundClock(clock, 3, { paused: false })).toBe(0);
    expect(clock.elapsedSeconds).toBe(4);
    expect(advanceAuthoredForegroundClock(clock, 1 / 60)).toBeCloseTo(1 / 60, 8);
  });
});
