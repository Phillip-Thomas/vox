import * as THREE from 'three';

export type AutopilotSwimMode = 'dive' | 'surface';

export interface AutopilotSwimPlanInput {
  player: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  submergence: number;
  stopDistance: number;
  mode: AutopilotSwimMode;
  /** Once physically centered at depth, never re-enter lateral lip alignment. */
  columnLocked?: boolean;
}

export interface AutopilotSwimPlan {
  distance: number;
  lateralDistance: number;
  lookDirection: THREE.Vector3;
  /** First clear the lip beside a submerged goal, then pitch into its column. */
  aligningOverTarget: boolean;
  /** Swim/walk along the camera's full pitched look vector. */
  forward: boolean;
  /** Player-equivalent jump axis: positive local-up while submerged. */
  ascend: boolean;
  /** Dive aim begins on approach so pitch is established before buoyancy acts. */
  useFluidLook: boolean;
  /** Surface gait remains tangent-constrained until the eye actually enters water. */
  useFluidMovement: boolean;
  /** Movie-only gait precision while centering over a one-voxel water column. */
  surfaceMoveScale: number;
  /** Aligned over the authored water cell: release gait and let gravity enter it. */
  settlingIntoWater: boolean;
}

const FLUID_LOOK_THRESHOLD = 0.05;
const ASCEND_THRESHOLD = 0.15;
const DIVE_COLUMN_ALIGNMENT = 0.7;
const FLOOR_LIP_ALIGNMENT_MARGIN = 2.2;
const FLOOR_COLUMN_LOCK_MARGIN = 0.5;
const DIVE_PRECISION_RADIUS = 4;
const DIVE_PRECISION_MOVE_SCALE = 0.12;
const FLOOR_LIP_SUBMERGENCE = 0.7;
// A world voxel is 2m wide and the player capsule radius is 0.5m. This radius
// is tight enough to clear the rim, but wider than one low-FPS binary gait step
// so the controller can actually enter the settle state instead of orbiting it.
const WATER_CELL_SETTLE_RADIUS = 0.58;
// Camera/water presentation becomes materially wet at 0.01. Engaging the
// fixed-step forward ray at that same boundary prevents a low-FPS body from
// touching the pond, receiving an idle buoyancy step, and being thrown back
// onto the lip before the next rendered autopilot update.
export const DIVE_ENTRY_SUBMERGENCE = 0.01;

export type AutopilotSwimPhysicsOverride = 'hold' | 'dive' | 'ascend' | null;

/**
 * Physics-step control edge for slow renderers. Autopilot framing is rendered
 * once per frame, but the player can cross and leave the waterline between two
 * frames. EfficientPlayer asks for virtual controls on every fixed step, so this
 * pure decision starts the real swim immediately after the eye becomes wet.
 */
export function autopilotSwimPhysicsOverride(input: {
  submergence: number;
  acquired: boolean;
  surfaceReceipt?: boolean;
  recoveryActive: boolean;
  oxygen: number;
  columnLocked: boolean;
}): AutopilotSwimPhysicsOverride {
  if (clamp01(input.submergence) <= DIVE_ENTRY_SUBMERGENCE) return null;
  if (
    input.recoveryActive
    || (input.acquired && input.surfaceReceipt === true)
    || clamp100(input.oxygen) <= RECOVER_AT_OXYGEN
  ) {
    return 'ascend';
  }
  // At the physical floor column, stop pushing into the Keel/floor lip. That
  // forward contact can legitimately activate the player's exit mantle and
  // surface the body before the authored oxygen/sonar observation completes.
  if (input.columnLocked) return 'hold';
  // Once the eye is materially wet, preserve the pitched player-equivalent
  // forward input between render frames. Clearing it here lets buoyancy win
  // before a slow renderer can publish the next camera-readiness sample.
  return 'dive';
}

/** Hold at the shore until the embodied camera has actually pitched into the pond. */
export function nextDiveAimReady(input: {
  active: boolean;
  pitch: number;
  shoreDistance: number;
  submergence: number;
}): boolean {
  return input.active
    || clamp01(input.submergence) > DIVE_ENTRY_SUBMERGENCE
    || (Number.isFinite(input.shoreDistance)
      && input.shoreDistance <= 3.1
      && Number.isFinite(input.pitch)
      && input.pitch <= -0.95);
}

/**
 * Latch the floor column after the body has genuinely reached it. The signed
 * oxygen/sonar scene can dwell here for many seconds; without hysteresis, tiny
 * collider drift would reactivate the lateral lip-clear and swim out of the pond.
 */
export function nextDiveColumnLock(input: {
  active: boolean;
  player: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  submergence: number;
  stopDistance: number;
}): boolean {
  if (clamp01(input.submergence) <= FLOOR_LIP_SUBMERGENCE) return false;
  if (input.active) return true;
  const up = input.up.clone().normalize();
  const delta = input.target.clone().sub(input.player);
  const vertical = delta.dot(up);
  const lateralDistance = delta.addScaledVector(up, -vertical).length();
  return lateralDistance <= 0.9
    && input.target.distanceTo(input.player) <= Math.max(0, input.stopDistance) + FLOOR_COLUMN_LOCK_MARGIN;
}

/**
 * Pure 6-DOF intent for the movie pilot. Underwater, `forward` is deliberately
 * paired with the raw pitched target direction consumed by composeSwimVelocity;
 * no fake vertical translation or terrain walker participates.
 */
export function planAutopilotSwim(input: AutopilotSwimPlanInput): AutopilotSwimPlan {
  const delta = input.target.clone().sub(input.player);
  const distance = delta.length();
  const submergence = clamp01(input.submergence);
  const up = input.up.clone().normalize();
  const vertical = delta.dot(up);
  const tangent = delta.clone().addScaledVector(up, -vertical);
  const lateralDistance = tangent.length();
  const aligningOverTarget = !input.columnLocked
    && input.mode === 'dive'
    && submergence > FLOOR_LIP_SUBMERGENCE
    && distance <= Math.max(0, input.stopDistance) + FLOOR_LIP_ALIGNMENT_MARGIN
    && lateralDistance > DIVE_COLUMN_ALIGNMENT;
  const settlingIntoWater = input.mode === 'dive'
    && submergence <= FLUID_LOOK_THRESHOLD
    && lateralDistance <= WATER_CELL_SETTLE_RADIUS;
  // Pond floors are voxel stairs. A direct steep ray can pin the capsule on
  // the upper cell beside a floor prop forever. Swim laterally over the prop's
  // column first, using the same camera-relative control a player would, then
  // pitch down once the body can clear the lip. No position is synthesized.
  const lookDirection = aligningOverTarget
    ? tangent.normalize()
    : distance > 1e-6
      ? delta.multiplyScalar(1 / distance)
      : up.multiplyScalar(input.mode === 'surface' ? 1 : -1);
  return {
    distance,
    lateralDistance,
    lookDirection,
    aligningOverTarget,
    forward: !settlingIntoWater && distance > Math.max(0, input.stopDistance),
    ascend: input.mode === 'surface' && submergence > ASCEND_THRESHOLD,
    useFluidLook: input.mode === 'dive' || submergence > FLUID_LOOK_THRESHOLD,
    useFluidMovement: submergence > FLUID_LOOK_THRESHOLD,
    surfaceMoveScale: input.mode === 'dive'
      && submergence <= FLUID_LOOK_THRESHOLD
      && lateralDistance <= DIVE_PRECISION_RADIUS
      ? DIVE_PRECISION_MOVE_SCALE
      : 1,
    settlingIntoWater
  };
}

export interface DiveRecoveryInput {
  active: boolean;
  oxygen: number;
  submergence: number;
}

const RECOVER_AT_OXYGEN = 38;
const RESUME_AT_OXYGEN = 85;
const SURFACED_THRESHOLD = 0.2;

/** Hysteretic oxygen policy: surface early, breathe fully, then retry. */
export function nextDiveRecoveryState(input: DiveRecoveryInput): boolean {
  const oxygen = clamp100(input.oxygen);
  const submergence = clamp01(input.submergence);
  if (input.active) {
    return !(submergence <= SURFACED_THRESHOLD && oxygen >= RESUME_AT_OXYGEN);
  }
  return submergence > SURFACED_THRESHOLD && oxygen <= RECOVER_AT_OXYGEN;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function clamp100(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}
