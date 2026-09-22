import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OxygenMeter, {
  OXYGEN_TICK_RM_STEPS,
  OXYGEN_TICK_RM_STEP_PX,
  pulseOxygenTick,
  readOxygenPulseCount,
  solveOxygenTickPresentation,
  subscribeOxygenTick
} from './OxygenMeter.tsx';

describe('the oxygen breath tick', () => {
  it('renders a tick element at every level, not only under the alarm threshold', () => {
    const markup = renderToStaticMarkup(<OxygenMeter />);
    expect(markup).toContain('data-oxygen-tick="breath"');
    // Dark until a pulse arrives; the shipped alarm pulse is untouched beside it.
    expect(markup).toContain('data-oxygen-pulse="0"');
    // The shipped low-oxygen alarm pulse is untouched beside the new tick.
    expect(markup).toContain('@keyframes oxPulse');
  });

  it('publishes one event per breath, in order', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeOxygenTick(pulse => seen.push(pulse));
    const before = readOxygenPulseCount();
    pulseOxygenTick();
    pulseOxygenTick();
    unsubscribe();
    expect(seen).toEqual([before + 1, before + 2]);
    expect(readOxygenPulseCount()).toBe(before + 2);
    // Unsubscribed listeners stop hearing breaths.
    pulseOxygenTick();
    expect(seen).toHaveLength(2);
  });

  it('brightens without moving when motion is allowed', () => {
    for (let pulse = 0; pulse < 6; pulse++) {
      expect(solveOxygenTickPresentation(pulse, false)).toEqual({ opacity: 1, offsetPx: 0 });
    }
  });

  it('moves without brightening under reduced motion, and wraps', () => {
    const offsets = [];
    for (let pulse = 0; pulse < OXYGEN_TICK_RM_STEPS * 2; pulse++) {
      const form = solveOxygenTickPresentation(pulse, true);
      expect(form.opacity).toBe(1);
      offsets.push(form.offsetPx);
    }
    expect(offsets.slice(0, OXYGEN_TICK_RM_STEPS)).toEqual([
      0,
      OXYGEN_TICK_RM_STEP_PX,
      OXYGEN_TICK_RM_STEP_PX * 2,
      OXYGEN_TICK_RM_STEP_PX * 3
    ]);
    // The marker advances per pulse and returns; it never fades.
    expect(offsets.slice(OXYGEN_TICK_RM_STEPS)).toEqual(offsets.slice(0, OXYGEN_TICK_RM_STEPS));
  });
});
