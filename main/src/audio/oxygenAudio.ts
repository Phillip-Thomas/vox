// Chapter 6's second clock is physiological, not musical. This module keeps
// its cadence on elapsed real time so it can never phase-lock to the score's
// transport, while leaving WebAudio rendering to the SFX bus.

const ACTIVE_SUBMERGENCE = 0.55;
const FULL_BREATH_INTERVAL_SECONDS = 1.65;
const EMPTY_BREATH_INTERVAL_SECONDS = 0.47;
const REDUCED_MOTION_MIN_INTERVAL_SECONDS = 0.72;
const CRITICAL_OXYGEN_START = 0.35;

export interface OxygenAudioInput {
  /** Normalized live survival oxygen, 0 (empty) .. 1 (full). */
  oxygen: number;
  /** Camera medium depth, 0 (dry) .. 1 (fully underwater). */
  submergence: number;
  /** The authored body clock is only enabled for the bounded dive scene. */
  enabled: boolean;
  muted: boolean;
  reducedMotion: boolean;
}

export interface OxygenAudioPlan {
  active: boolean;
  oxygen: number;
  urgency: number;
  /** Free-running real-time interval. It is never quantized to a score grid. */
  pulseIntervalSeconds: number;
  pulseGain: number;
  criticalBreathGain: number;
  criticalBreathDurationSeconds: number;
}

export interface OxygenAudioClockState {
  active: boolean;
  nextPulseAtSeconds: number;
}

export interface OxygenAudioClockStep {
  state: OxygenAudioClockState;
  plan: OxygenAudioPlan;
  emitPulse: boolean;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Resolve one continuous, non-musical body-clock state from the live dive. */
export function resolveOxygenAudioPlan(input: OxygenAudioInput): OxygenAudioPlan {
  const oxygen = clamp01(input.oxygen);
  const submergence = clamp01(input.submergence);
  const urgency = 1 - oxygen;
  const acceleration = smoothstep(0, 1, urgency);
  const rawInterval = FULL_BREATH_INTERVAL_SECONDS
    + (EMPTY_BREATH_INTERVAL_SECONDS - FULL_BREATH_INTERVAL_SECONDS) * acceleration;
  const pulseIntervalSeconds = input.reducedMotion
    ? Math.max(REDUCED_MOTION_MIN_INTERVAL_SECONDS, rawInterval)
    : rawInterval;
  const mediumPresence = smoothstep(ACTIVE_SUBMERGENCE, 0.85, submergence);
  const sensoryScale = input.reducedMotion ? 0.7 : 1;
  const critical = smoothstep(0, CRITICAL_OXYGEN_START, CRITICAL_OXYGEN_START - oxygen);

  return {
    active: input.enabled
      && !input.muted
      && submergence >= ACTIVE_SUBMERGENCE
      && oxygen < 0.995,
    oxygen,
    urgency,
    pulseIntervalSeconds,
    pulseGain: (0.012 + urgency * 0.034) * mediumPresence * sensoryScale,
    criticalBreathGain: critical * 0.032 * mediumPresence * (input.reducedMotion ? 0.62 : 1),
    criticalBreathDurationSeconds: 0.3 + critical * 0.34
  };
}

export function initialOxygenAudioClockState(nowSeconds = 0): OxygenAudioClockState {
  return { active: false, nextPulseAtSeconds: nowSeconds };
}

/**
 * Advance the free-running body clock. Long frames emit at most one pulse and
 * restart from observed real time, preventing pause/focus stalls from producing
 * a burst of queued breaths.
 */
export function stepOxygenAudioClock(
  state: OxygenAudioClockState,
  input: OxygenAudioInput,
  nowSeconds: number
): OxygenAudioClockStep {
  const safeNow = Number.isFinite(nowSeconds) ? Math.max(0, nowSeconds) : 0;
  const plan = resolveOxygenAudioPlan(input);

  if (!plan.active) {
    return {
      plan,
      emitPulse: false,
      state: {
        active: false,
        nextPulseAtSeconds: safeNow + plan.pulseIntervalSeconds
      }
    };
  }

  if (!state.active) {
    return {
      plan,
      emitPulse: false,
      state: {
        active: true,
        nextPulseAtSeconds: safeNow + Math.min(0.38, plan.pulseIntervalSeconds * 0.35)
      }
    };
  }

  if (safeNow + Number.EPSILON < state.nextPulseAtSeconds) {
    return { plan, emitPulse: false, state };
  }

  return {
    plan,
    emitPulse: true,
    state: {
      active: true,
      nextPulseAtSeconds: safeNow + plan.pulseIntervalSeconds
    }
  };
}
