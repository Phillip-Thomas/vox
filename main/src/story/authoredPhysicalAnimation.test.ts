import { describe, expect, it } from 'vitest';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock
} from './authoredFrameTime.ts';
import {
  fieldPackCorePulseAt,
  fieldPackSegmentHeightAt,
  mawResonanceRingFrameAt
} from './authoredPhysicalAnimation.ts';

describe('authored physical animation foreground time', () => {
  it('holds Field Pack and pond-ring poses through pause and its resume boundary', () => {
    const clock = createAuthoredForegroundClock(3.25);
    const packBefore = {
      pulse: fieldPackCorePulseAt(clock.elapsedSeconds),
      segmentY: fieldPackSegmentHeightAt(clock.elapsedSeconds, 1, 0.45)
    };
    const ringBefore = mawResonanceRingFrameAt(clock.elapsedSeconds, 2);

    expect(advanceAuthoredForegroundClock(clock, 20, { paused: true })).toBe(0);
    expect(advanceAuthoredForegroundClock(clock, 20, { paused: false })).toBe(0);
    expect({
      pulse: fieldPackCorePulseAt(clock.elapsedSeconds),
      segmentY: fieldPackSegmentHeightAt(clock.elapsedSeconds, 1, 0.45)
    }).toEqual(packBefore);
    expect(mawResonanceRingFrameAt(clock.elapsedSeconds, 2)).toEqual(ringBefore);

    expect(advanceAuthoredForegroundClock(clock, 0.1)).toBeCloseTo(0.1, 8);
    expect(fieldPackCorePulseAt(clock.elapsedSeconds)).not.toBe(packBefore.pulse);
    expect(mawResonanceRingFrameAt(clock.elapsedSeconds, 2)).not.toEqual(ringBefore);
  });
});
