import type { Vec3Tuple } from '../game/starSystem.ts';

export interface SystemTravelAssistTarget {
  readonly worldId: string;
  readonly systemPosition: Vec3Tuple;
  readonly ready: boolean;
}

const MAX_CRUISE_SPEED = 320;
const READY_ACTIVATION_DISTANCE = 185;
const READY_ENTRY_SPEED = 55;
const READY_SLOWDOWN_DISTANCE = 715;
const UNREADY_HOLD_DISTANCE = 300;

let target: SystemTravelAssistTarget | null = null;

export function setSystemTravelAssistTarget(next: SystemTravelAssistTarget | null): void {
  if (
    target
    && next
    && target.worldId === next.worldId
    && target.ready === next.ready
    && target.systemPosition[0] === next.systemPosition[0]
    && target.systemPosition[1] === next.systemPosition[1]
    && target.systemPosition[2] === next.systemPosition[2]
  ) {
    return;
  }
  target = next
    ? {
        worldId: next.worldId,
        systemPosition: [...next.systemPosition],
        ready: next.ready
      }
    : null;
}

export function getSystemTravelAssistTarget(): SystemTravelAssistTarget | null {
  return target;
}

/**
 * Speed allowed toward a local body. Late payloads stop outside the activation
 * envelope; ready targets receive a smooth corridor slowdown for safe streaming.
 */
export function systemApproachSpeedLimit(centerDistance: number, ready: boolean): number {
  if (!Number.isFinite(centerDistance) || centerDistance < 0) return 0;
  if (!ready) {
    return clamp((centerDistance - UNREADY_HOLD_DISTANCE) * 0.65, 0, MAX_CRUISE_SPEED);
  }
  const span = READY_SLOWDOWN_DISTANCE - READY_ACTIVATION_DISTANCE;
  const progress = clamp(
    (centerDistance - READY_ACTIVATION_DISTANCE) / span,
    0,
    1
  );
  return READY_ENTRY_SPEED + (MAX_CRUISE_SPEED - READY_ENTRY_SPEED) * progress;
}

export function resetSystemTravelAssistForTests(): void {
  target = null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
