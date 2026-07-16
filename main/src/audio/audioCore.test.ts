import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT,
  rampParamAt,
  scheduleMusicSceneEnvelopeParam
} from './audioCore.ts';

const FALLBACK_AT_S = 5;
const FALLBACK_SLEW_S = 1.2;
const FALLBACK_TARGET = 0.25;

describe('audioCore continuity-safe automation', () => {
  it('uses a start-timed target curve when cancelAndHoldAtTime is unavailable', () => {
    const cancelScheduledValues = vi.fn();
    const setTargetAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const param = {
      cancelScheduledValues,
      setTargetAtTime,
      linearRampToValueAtTime
    } as unknown as AudioParam;

    rampParamAt(param, FALLBACK_TARGET, FALLBACK_AT_S, FALLBACK_SLEW_S);

    expect(cancelScheduledValues).toHaveBeenCalledExactlyOnceWith(FALLBACK_AT_S);
    expect(setTargetAtTime).toHaveBeenCalledExactlyOnceWith(
      FALLBACK_TARGET,
      FALLBACK_AT_S,
      FALLBACK_SLEW_S / AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT
    );
    expect(linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it('start-anchors literal scene-envelope points without target-curve drift', () => {
    const cancelAndHoldAtTime = vi.fn();
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const param = {
      value: 0.65,
      cancelAndHoldAtTime,
      cancelScheduledValues: vi.fn(),
      setValueAtTime,
      linearRampToValueAtTime
    } as unknown as AudioParam;

    scheduleMusicSceneEnvelopeParam(
      param,
      5,
      [
        { offsetSeconds: 0.04, value: 0 },
        { offsetSeconds: 0.14, value: 0 },
        { offsetSeconds: 0.26, value: 1 }
      ],
      0.65
    );

    expect(cancelAndHoldAtTime).toHaveBeenCalledExactlyOnceWith(5);
    expect(setValueAtTime).toHaveBeenCalledExactlyOnceWith(0.65, 5);
    expect(linearRampToValueAtTime.mock.calls).toEqual([
      [0, 5.04],
      [0, 5.14],
      [1, 5.26]
    ]);
  });
});
