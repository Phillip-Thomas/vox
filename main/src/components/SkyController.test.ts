import { describe, expect, it } from 'vitest';
import { shouldUpdateWorldDayPhase } from './SkyController.tsx';

describe('SkyController world-clock policy', () => {
  it.each(['LOW', 'POTATO'])(
    'keeps surface gameplay time live when %s disables animated shaders',
    () => {
      expect(shouldUpdateWorldDayPhase({
        inSpace: false,
        animatedShaders: false,
        clockOwner: 'local_client',
        forcedDayPhase: null,
        needsGradeBlend: false
      })).toBe(true);
    }
  );

  it('allows settled local deep space to keep its static grade', () => {
    expect(shouldUpdateWorldDayPhase({
      inSpace: true,
      animatedShaders: false,
      clockOwner: 'local_client',
      forcedDayPhase: null,
      needsGradeBlend: false
    })).toBe(false);
  });

  it('still updates deep-space boundaries for server, forced, and blended clocks', () => {
    for (const override of [
      { clockOwner: 'server' as const },
      { forcedDayPhase: 0.75 },
      { needsGradeBlend: true }
    ]) {
      expect(shouldUpdateWorldDayPhase({
        inSpace: true,
        animatedShaders: false,
        clockOwner: 'local_client',
        forcedDayPhase: null,
        needsGradeBlend: false,
        ...override
      })).toBe(true);
    }
  });
});
