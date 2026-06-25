import { FIXED_PHYSICS_STEP, TRANSITION_LOCK_TIME } from '../utils/cubeGravityConstants.ts';

export const VITALS_RENDER_DELTA_CLAMP = 0.05;

export const TICK_DISCIPLINE = {
  physics: {
    stepSeconds: FIXED_PHYSICS_STEP,
    owner: 'Rapier fixed-step loop',
    reconciliation: 'cube-edge transitions are treated as non-correctable until their lock window ends'
  },
  render: {
    owner: 'react-three-fiber frame loop',
    use: 'visual updates, looked-at labels, local-only presentation'
  },
  vitals: {
    owner: 'local player frame loop until server policy exists',
    deltaClampSeconds: VITALS_RENDER_DELTA_CLAMP
  },
  oxygen: {
    owner: 'local player frame loop until server policy exists',
    deltaClampSeconds: VITALS_RENDER_DELTA_CLAMP
  },
  stamina: {
    owner: 'fixed physics loop',
    tickSeconds: FIXED_PHYSICS_STEP
  },
  worldClock: {
    owner: 'offline local client through server-ownable world clock seam'
  },
  edgeTransition: {
    lockSeconds: TRANSITION_LOCK_TIME,
    reconciliation: 'do not correct discrete cube-face transition frames mid-lock'
  }
} as const;

export function clampVitalsDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, VITALS_RENDER_DELTA_CLAMP);
}
