import type { ActorId } from '../game/playerActors.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import type { ShipRepairStage } from './emergentCapabilities.ts';
import { activateSignedSceneSemanticEvent } from './signedSceneAvRuntime.ts';
import type { StoryBeat } from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

export const RECONSTRUCTION_CALIBRATION_MILESTONE =
  'story:reconstruct:calibration-completed-physical';
export const RECONSTRUCTION_CALIBRATION_SECONDS = 8;

type Vec3Tuple = readonly [number, number, number];

export interface ReconstructionCalibrationState {
  phase: 'idle' | 'running' | 'complete';
  actorId: ActorId | null;
  worldId: string | null;
  elapsed: number;
}

export interface ReconstructionCalibrationFrame {
  eyeLocal: Vec3Tuple;
  targetLocal: Vec3Tuple;
  weight: number;
  fov: number;
}

let state: ReconstructionCalibrationState = createReconstructionCalibrationState();

export function createReconstructionCalibrationState(): ReconstructionCalibrationState {
  return { phase: 'idle', actorId: null, worldId: null, elapsed: 0 };
}

export function beginReconstructionCalibration(input: {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  repairStage: ShipRepairStage;
  groundedReturnComplete: boolean;
}): boolean {
  if (hasReconstructionCalibrationReceipt(input.actorId)) return false;
  if (state.phase === 'running') return false;
  if (
    input.worldId !== STORY_PRIMARY_WORLD_ID
    || input.storyBeat !== 'ch7-reconstruct'
    || input.repairStage !== 'flight_ready'
    || !input.groundedReturnComplete
  ) return false;
  state = {
    phase: 'running',
    actorId: input.actorId,
    worldId: input.worldId,
    elapsed: 0
  };
  return true;
}

export function tickReconstructionCalibration(input: {
  dt: number;
  paused: boolean;
  focused: boolean;
}): boolean {
  if (state.phase !== 'running' || input.paused || !input.focused) return false;
  const elapsed = Math.min(
    RECONSTRUCTION_CALIBRATION_SECONDS,
    state.elapsed + clampDt(input.dt)
  );
  state = { ...state, elapsed };
  if (elapsed + 1e-6 < RECONSTRUCTION_CALIBRATION_SECONDS) return false;
  const actorId = state.actorId;
  state = { ...state, phase: 'complete' };
  if (actorId) markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, actorId);
  activateSignedSceneSemanticEvent('ev.reconstruct.calibration-completed');
  return true;
}

export function hasReconstructionCalibrationReceipt(actorId?: ActorId): boolean {
  return hasMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, actorId);
}

export function getReconstructionCalibrationSnapshot(): ReconstructionCalibrationState {
  return { ...state };
}

/**
 * The only exterior hero move in Chapter 7: a low 52-degree three-quarter
 * travel along the scarred spine, then a physical approach through the hatch
 * silhouette. Reduced motion keeps the same reveal in one fixed composition.
 */
export function sampleReconstructionCalibrationFrame(
  elapsed: number,
  reducedMotion = false
): ReconstructionCalibrationFrame {
  const t = clamp01(elapsed / RECONSTRUCTION_CALIBRATION_SECONDS);
  const fadeIn = smoothstep(clamp01(t / 0.08));
  const fadeOut = 1 - smoothstep(clamp01((t - 0.94) / 0.06));
  const weight = Math.min(fadeIn, fadeOut);

  if (reducedMotion) {
    return {
      eyeLocal: [-2.8, 1.9, 4.8],
      targetLocal: [0.2, 0.35, 0],
      weight,
      fov: 52
    };
  }

  if (t < 0.78) {
    const travel = smoothstep(t / 0.78);
    return {
      eyeLocal: lerpTuple([-4.8, 1.75, 5.1], [3.65, 2.3, 4.0], travel),
      targetLocal: lerpTuple([-0.9, 0.18, 0], [1.0, 0.35, 0], travel),
      weight,
      fov: 52
    };
  }

  const enclosure = smoothstep((t - 0.78) / 0.22);
  return {
    eyeLocal: lerpTuple([3.65, 2.3, 4.0], [0.5, 1.18, 0.18], enclosure),
    targetLocal: lerpTuple([1.0, 0.35, 0], [0.5, 0.92, -0.5], enclosure),
    weight,
    fov: 52
  };
}

export function resetReconstructionCalibrationRuntime(): void {
  state = createReconstructionCalibrationState();
}

function clampDt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(0.1, value)) : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerpTuple(left: Vec3Tuple, right: Vec3Tuple, t: number): Vec3Tuple {
  return [
    left[0] + (right[0] - left[0]) * t,
    left[1] + (right[1] - left[1]) * t,
    left[2] + (right[2] - left[2]) * t
  ];
}
