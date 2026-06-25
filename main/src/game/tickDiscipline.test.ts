import { describe, expect, it } from 'vitest';
import { FIXED_PHYSICS_STEP, TRANSITION_LOCK_TIME } from '../utils/cubeGravityConstants.ts';
import { clampVitalsDelta, TICK_DISCIPLINE, VITALS_RENDER_DELTA_CLAMP } from './tickDiscipline.ts';

describe('tick discipline', () => {
  it('documents the fixed physics and transition assumptions used by the player loop', () => {
    expect(TICK_DISCIPLINE.physics.stepSeconds).toBe(FIXED_PHYSICS_STEP);
    expect(TICK_DISCIPLINE.stamina.tickSeconds).toBe(FIXED_PHYSICS_STEP);
    expect(TICK_DISCIPLINE.edgeTransition.lockSeconds).toBe(TRANSITION_LOCK_TIME);
    expect(TICK_DISCIPLINE.physics.reconciliation).toContain('non-correctable');
  });

  it('keeps vitals and oxygen deltas intentionally clamped', () => {
    expect(VITALS_RENDER_DELTA_CLAMP).toBe(0.05);
    expect(clampVitalsDelta(0.016)).toBe(0.016);
    expect(clampVitalsDelta(3)).toBe(0.05);
    expect(clampVitalsDelta(Number.NaN)).toBe(0);
    expect(clampVitalsDelta(-1)).toBe(0);
  });

  it('records the current offline ownership policy for clocks and passive meters', () => {
    expect(TICK_DISCIPLINE.vitals.owner).toContain('local player');
    expect(TICK_DISCIPLINE.oxygen.owner).toContain('local player');
    expect(TICK_DISCIPLINE.worldClock.owner).toContain('offline local client');
  });
});
