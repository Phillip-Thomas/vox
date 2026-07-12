import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT,
  rampParamAt
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
});
