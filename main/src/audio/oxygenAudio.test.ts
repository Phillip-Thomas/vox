import { describe, expect, it } from 'vitest';
import { resolveWorldClockTick, neutralBedSignals } from './generative/worldSignals.ts';
import {
  initialOxygenAudioClockState,
  resolveOxygenAudioPlan,
  stepOxygenAudioClock,
  type OxygenAudioInput
} from './oxygenAudio.ts';

const input = (patch: Partial<OxygenAudioInput> = {}): OxygenAudioInput => ({
  oxygen: 0.75,
  submergence: 1,
  enabled: true,
  muted: false,
  reducedMotion: false,
  ...patch
});

describe('Chapter 6 physiological audio clock', () => {
  it('accelerates and intensifies continuously as live oxygen falls', () => {
    const healthy = resolveOxygenAudioPlan(input({ oxygen: 0.9 }));
    const pressured = resolveOxygenAudioPlan(input({ oxygen: 0.5 }));
    const critical = resolveOxygenAudioPlan(input({ oxygen: 0.1 }));

    expect(pressured.pulseIntervalSeconds).toBeLessThan(healthy.pulseIntervalSeconds);
    expect(critical.pulseIntervalSeconds).toBeLessThan(pressured.pulseIntervalSeconds);
    expect(pressured.pulseGain).toBeGreaterThan(healthy.pulseGain);
    expect(critical.pulseGain).toBeGreaterThan(pressured.pulseGain);
    expect(healthy.criticalBreathGain).toBe(0);
    expect(critical.criticalBreathGain).toBeGreaterThan(0);
  });

  it('keeps the world clock and body clock moving in opposite directions underwater', () => {
    const dryWorld = resolveWorldClockTick(neutralBedSignals());
    const deepWorld = resolveWorldClockTick({
      ...neutralBedSignals(),
      submergence: 1,
      oxygen: 0.15
    });
    const earlyBody = resolveOxygenAudioPlan(input({ oxygen: 0.9 }));
    const lateBody = resolveOxygenAudioPlan(input({ oxygen: 0.15 }));

    expect(deepWorld.hz).toBeLessThan(dryWorld.hz);
    expect(lateBody.pulseIntervalSeconds).toBeLessThan(earlyBody.pulseIntervalSeconds);
  });

  it('stays silent outside the authored dive, above the medium, or while muted', () => {
    expect(resolveOxygenAudioPlan(input({ enabled: false })).active).toBe(false);
    expect(resolveOxygenAudioPlan(input({ submergence: 0.2 })).active).toBe(false);
    expect(resolveOxygenAudioPlan(input({ muted: true })).active).toBe(false);
    expect(resolveOxygenAudioPlan(input({ oxygen: 1 })).active).toBe(false);
  });

  it('softens repetitive sensory pressure for reduced-motion players without hiding danger', () => {
    const standard = resolveOxygenAudioPlan(input({ oxygen: 0.05 }));
    const reduced = resolveOxygenAudioPlan(input({ oxygen: 0.05, reducedMotion: true }));

    expect(reduced.active).toBe(true);
    expect(reduced.pulseIntervalSeconds).toBeGreaterThan(standard.pulseIntervalSeconds);
    expect(reduced.pulseGain).toBeLessThan(standard.pulseGain);
    expect(reduced.criticalBreathGain).toBeLessThan(standard.criticalBreathGain);
    expect(reduced.criticalBreathGain).toBeGreaterThan(0);
  });

  it('runs from real time and never catches up with a burst after a long frame', () => {
    let state = initialOxygenAudioClockState(10);
    const entered = stepOxygenAudioClock(state, input({ oxygen: 0.5 }), 10);
    expect(entered.emitPulse).toBe(false);
    state = entered.state;

    const before = stepOxygenAudioClock(state, input({ oxygen: 0.5 }), 10.1);
    expect(before.emitPulse).toBe(false);

    const first = stepOxygenAudioClock(state, input({ oxygen: 0.5 }), 10.5);
    expect(first.emitPulse).toBe(true);
    expect(first.state.nextPulseAtSeconds).toBeCloseTo(
      10.5 + first.plan.pulseIntervalSeconds,
      10
    );

    const afterStall = stepOxygenAudioClock(first.state, input({ oxygen: 0.1 }), 100);
    expect(afterStall.emitPulse).toBe(true);
    expect(afterStall.state.nextPulseAtSeconds).toBeCloseTo(
      100 + afterStall.plan.pulseIntervalSeconds,
      10
    );
  });

  it('resets its pending pulse while muted instead of firing on unmute', () => {
    const entered = stepOxygenAudioClock(
      initialOxygenAudioClockState(0),
      input({ oxygen: 0.2 }),
      0
    );
    const muted = stepOxygenAudioClock(entered.state, input({ oxygen: 0.2, muted: true }), 5);
    expect(muted.emitPulse).toBe(false);
    expect(muted.state.active).toBe(false);

    const resumed = stepOxygenAudioClock(muted.state, input({ oxygen: 0.2 }), 5.01);
    expect(resumed.emitPulse).toBe(false);
    expect(resumed.state.active).toBe(true);
  });
});
