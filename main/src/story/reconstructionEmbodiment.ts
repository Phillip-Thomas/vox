import type { ActorId } from '../game/playerActors.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { recordAccomplishment } from '../game/systems/accomplishmentLedger.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { atLeast, type ShipRepairStage } from './emergentCapabilities.ts';
import { activateSignedSceneSemanticEvent } from './signedSceneAvRuntime.ts';
import type { StoryBeat } from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { hasReconstructionCalibrationReceipt } from './reconstructionCalibration.ts';
import { GRAVITY_STRENGTH } from '../utils/surfaceControls.ts';

export const RECONSTRUCTION_EMBODIMENT_MILESTONES = Object.freeze({
  diagnosis: 'story:reconstruct:relationships-diagnosed-physical',
  firstHover: 'story:reconstruct:first-legal-hover-physical',
  firstHoverRecovered: 'story:reconstruct:first-hover-grounded-return'
});

export const WRECK_DIAGNOSIS_REACH = 5.6;
export const WRECK_DIAGNOSIS_MIN_ALIGNMENT = 0.58;
export const FIRST_HOVER_MIN_CLEARANCE = 0.8;
export const FIRST_HOVER_MAX_CLEARANCE = 5.5;
export const FIRST_HOVER_MAX_LATERAL_DISTANCE = 7;
export const FIRST_HOVER_SOCKET_REACH = 1.55;
export const FIRST_HOVER_HOLD_SECONDS = 1.05;
export const FIRST_HOVER_STABLE_FALL_SPEED = -1.25;
export const FIRST_HOVER_STABLE_RISE_SPEED = 3.25;
export const FIRST_HOVER_AUTO_APEX_MARGIN = 0.18;
export const FIRST_HOVER_AUTO_CEILING = 0.65;
export const FIRST_HOVER_AUTO_CATCH_SPEED = -0.65;

type Vec3Tuple = readonly [number, number, number];

interface PhysicalWreckBinding {
  actorId: ActorId;
  worldId: string;
  position: Vec3Tuple;
  hoverSocketPosition: Vec3Tuple;
}

let wreckBinding: PhysicalWreckBinding | null = null;

export interface WreckDiagnosisProof {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  repairStage: ShipRepairStage;
  keelMemoryBanked: boolean;
  distanceSquared: number;
  viewAlignment: number;
}

export interface WreckDiagnosisReceipt {
  ok: boolean;
  idempotent: boolean;
  avActivated: boolean;
  reason?:
    | 'wrong-beat'
    | 'wrong-world'
    | 'unbound-wreck'
    | 'keel-not-banked'
    | 'out-of-reach'
    | 'not-looking-at-scar';
}

export function registerPhysicalWreckBinding(binding: {
  actorId: ActorId;
  worldId: string;
  position: Vec3Tuple;
  hoverSocketPosition: Vec3Tuple;
}): () => void {
  const registered: PhysicalWreckBinding = {
    actorId: binding.actorId,
    worldId: binding.worldId,
    position: [...binding.position],
    hoverSocketPosition: [...binding.hoverSocketPosition]
  };
  wreckBinding = registered;
  return () => {
    if (wreckBinding === registered) wreckBinding = null;
  };
}

export function hasWreckDiagnosisReceipt(actorId?: ActorId): boolean {
  return hasMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis, actorId);
}

export function validateWreckDiagnosisProof(proof: WreckDiagnosisProof): WreckDiagnosisReceipt {
  if (proof.storyBeat !== 'ch7-reconstruct') {
    return { ok: false, idempotent: false, avActivated: false, reason: 'wrong-beat' };
  }
  if (proof.worldId !== STORY_PRIMARY_WORLD_ID) {
    return { ok: false, idempotent: false, avActivated: false, reason: 'wrong-world' };
  }
  // Compatibility saves and co-op authority may already expose a later shared
  // hull stage. The scar remains physical at every stage, so diagnosis is still
  // recoverable in place; later code requires a fresh bounded lift rehearsal
  // before Story can accept that scalar as locally embodied.
  if (!proof.keelMemoryBanked) {
    return { ok: false, idempotent: false, avActivated: false, reason: 'keel-not-banked' };
  }
  if (!Number.isFinite(proof.distanceSquared)
    || proof.distanceSquared > WRECK_DIAGNOSIS_REACH ** 2) {
    return { ok: false, idempotent: false, avActivated: false, reason: 'out-of-reach' };
  }
  if (!Number.isFinite(proof.viewAlignment)
    || proof.viewAlignment < WRECK_DIAGNOSIS_MIN_ALIGNMENT) {
    return { ok: false, idempotent: false, avActivated: false, reason: 'not-looking-at-scar' };
  }
  return { ok: true, idempotent: false, avActivated: false };
}

/** Commit only after the live interaction resolver proves distance and gaze. */
export function commitWreckDiagnosis(proof: WreckDiagnosisProof): WreckDiagnosisReceipt {
  if (hasWreckDiagnosisReceipt(proof.actorId)) {
    return { ok: true, idempotent: true, avActivated: false };
  }
  if (!wreckBinding
    || wreckBinding.actorId !== proof.actorId
    || wreckBinding.worldId !== proof.worldId) {
    return { ok: false, idempotent: false, avActivated: false, reason: 'unbound-wreck' };
  }
  const validation = validateWreckDiagnosisProof(proof);
  if (!validation.ok) return validation;
  markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis, proof.actorId);
  return {
    ok: true,
    idempotent: false,
    avActivated: activateSignedSceneSemanticEvent('ev.reconstruct.relationships-diagnosed')
  };
}

export interface FirstHoverProofState {
  holdSeconds: number;
  complete: boolean;
  thrustObserved: boolean;
}

export interface FirstHoverSample {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  repairStage: ShipRepairStage;
  position: Vec3Tuple;
  surfaceUp: Vec3Tuple;
  wreckPosition: Vec3Tuple;
  hoverSocketPosition: Vec3Tuple;
  grounded: boolean;
  jetpackActive: boolean;
  verticalSpeed: number;
  dt: number;
}

export interface FirstHoverAdvance {
  state: FirstHoverProofState;
  eligible: boolean;
  clearance: number;
  lateralDistance: number;
  socketDistance: number;
  completedNow: boolean;
}

export function createFirstHoverProofState(): FirstHoverProofState {
  return { holdSeconds: 0, complete: false, thrustObserved: false };
}

/** Pure bounded proof: real suit thrust, airborne separation, and wreck envelope. */
export function advanceFirstHoverProof(
  state: FirstHoverProofState,
  sample: FirstHoverSample
): FirstHoverAdvance {
  if (state.complete) {
    return {
      state,
      eligible: true,
      clearance: vectorClearance(sample.position, sample.wreckPosition, sample.surfaceUp),
      lateralDistance: vectorLateralDistance(sample.position, sample.wreckPosition, sample.surfaceUp),
      socketDistance: distance(sample.position, sample.hoverSocketPosition),
      completedNow: false
    };
  }
  const clearance = vectorClearance(sample.position, sample.wreckPosition, sample.surfaceUp);
  const lateralDistance = vectorLateralDistance(sample.position, sample.wreckPosition, sample.surfaceUp);
  const socketDistance = distance(sample.position, sample.hoverSocketPosition);
  const withinWreckEnvelope = sample.worldId === STORY_PRIMARY_WORLD_ID
    && sample.storyBeat === 'ch7-reconstruct'
    && sample.repairStage === 'lift_online'
    && !sample.grounded
    && clearance >= FIRST_HOVER_MIN_CLEARANCE
    && clearance <= FIRST_HOVER_MAX_CLEARANCE
    && lateralDistance <= FIRST_HOVER_MAX_LATERAL_DISTANCE;
  const thrustObserved = withinWreckEnvelope
    && (state.thrustObserved || sample.jetpackActive);
  const insideSocket = socketDistance <= FIRST_HOVER_SOCKET_REACH;
  const stableVertical = Number.isFinite(sample.verticalSpeed)
    && sample.verticalSpeed >= FIRST_HOVER_STABLE_FALL_SPEED
    && sample.verticalSpeed <= FIRST_HOVER_STABLE_RISE_SPEED;
  // A believable hover is a thrust-authored dwell, not necessarily a held
  // binary key on every sample. Feathered coasting may pause accumulation but
  // does not erase already stable time while the body remains in the socket.
  const eligible = withinWreckEnvelope
    && thrustObserved
    && insideSocket;
  const stableEligible = eligible && stableVertical;
  const holdSeconds = stableEligible
    ? state.holdSeconds + clampDt(sample.dt)
    : eligible
      ? state.holdSeconds
      : 0;
  const complete = holdSeconds >= FIRST_HOVER_HOLD_SECONDS;
  return {
    state: { holdSeconds, complete, thrustObserved },
    eligible: stableEligible,
    clearance,
    lateralDistance,
    socketDistance,
    completedNow: complete && !state.complete
  };
}

let hoverRuntime = createFirstHoverProofState();
let hoverRuntimeKey = '';

export function hasFirstLegalHoverReceipt(actorId?: ActorId): boolean {
  return hasMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHover, actorId);
}

export function hasFirstHoverGroundedReturn(actorId?: ActorId): boolean {
  return hasMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHoverRecovered, actorId);
}

/** Called from the real Rapier player loop after grounded/thrust are resolved. */
export function observeFirstLegalHover(
  input: Omit<FirstHoverSample, 'wreckPosition' | 'hoverSocketPosition'>
): boolean {
  const binding = wreckBinding;
  if (!binding
    || input.worldId !== STORY_PRIMARY_WORLD_ID
    || binding.actorId !== input.actorId
    || binding.worldId !== input.worldId
    || !hasWreckDiagnosisReceipt(input.actorId)) return false;
  const proofStage = hoverProofStage(input.repairStage, input.actorId);
  if (hasFirstLegalHoverReceipt(input.actorId)) {
    if (input.grounded
      && input.storyBeat === 'ch7-reconstruct'
      && proofStage === 'lift_online'
      && distanceSquared(input.position, binding.position)
        <= FIRST_HOVER_MAX_LATERAL_DISTANCE ** 2) {
      markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHoverRecovered, input.actorId);
    }
    return true;
  }
  const key = `${input.actorId}\u0000${input.worldId}`;
  if (hoverRuntimeKey !== key || hoverRuntime.complete) {
    hoverRuntimeKey = key;
    hoverRuntime = createFirstHoverProofState();
  }
  const advanced = advanceFirstHoverProof(hoverRuntime, {
    ...input,
    repairStage: proofStage,
    wreckPosition: binding.position,
    hoverSocketPosition: binding.hoverSocketPosition
  });
  hoverRuntime = advanced.state;
  if (!advanced.completedNow) return false;
  markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.firstHover, input.actorId);
  activateSignedSceneSemanticEvent('ev.reconstruct.first-legal-hover');
  if (recordAccomplishment('ground_relents', {
    id: `story:first-hover:${input.actorId}:${input.worldId}`,
    worldId: input.worldId,
    sourceKey: 'physical-upper-route-socket'
  }, input.actorId)) {
    emitEmergentStoryEvent({
      id: `story:first-hover:${input.actorId}:${input.worldId}:accomplishment`,
      type: 'accomplishment_recorded',
      actorId: input.actorId,
      worldId: input.worldId,
      payload: { accomplishmentId: 'ground_relents' }
    });
  }
  return true;
}

/** Movie mode still uses the normal jump/jet controller; this only holds its jump input. */
export function needsAutomatedFirstHover(input: {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  repairStage: ShipRepairStage;
  position: Vec3Tuple;
  surfaceUp: Vec3Tuple;
  grounded?: boolean;
  verticalSpeed?: number;
}): boolean {
  const binding = wreckBinding;
  if (!binding
    || input.worldId !== STORY_PRIMARY_WORLD_ID
    || binding.actorId !== input.actorId
    || binding.worldId !== input.worldId
    || !hasWreckDiagnosisReceipt(input.actorId)
    || input.storyBeat !== 'ch7-reconstruct'
    || hoverProofStage(input.repairStage, input.actorId) !== 'lift_online'
    || hasFirstLegalHoverReceipt(input.actorId)) return false;
  if (distanceSquared(input.position, binding.position)
    > FIRST_HOVER_MAX_LATERAL_DISTANCE ** 2) return false;
  const up = normalized(input.surfaceUp);
  const toSocket: Vec3Tuple = [
    binding.hoverSocketPosition[0] - input.position[0],
    binding.hoverSocketPosition[1] - input.position[1],
    binding.hoverSocketPosition[2] - input.position[2]
  ];
  const verticalDelta = toSocket[0] * up[0] + toSocket[1] * up[1] + toSocket[2] * up[2];
  const lateralSquared = Math.max(0, distanceSquared(input.position, binding.hoverSocketPosition)
    - verticalDelta * verticalDelta);
  if (lateralSquared > FIRST_HOVER_SOCKET_REACH ** 2) return false;
  return automatedFirstHoverThrustDecision({
    verticalDelta,
    verticalSpeed: input.verticalSpeed ?? 0,
    grounded: input.grounded ?? false
  });
}

/**
 * Player-equivalent pulse controller for movie mode. It releases early enough
 * for the current rise to coast into the socket, then catches a fall with real
 * jet thrust. It never changes pose, velocity, fuel, or proof state directly.
 */
export function automatedFirstHoverThrustDecision(input: {
  verticalDelta: number;
  verticalSpeed: number;
  grounded: boolean;
}): boolean {
  if (input.grounded) return true;
  const verticalDelta = Number.isFinite(input.verticalDelta) ? input.verticalDelta : 0;
  const verticalSpeed = Number.isFinite(input.verticalSpeed) ? input.verticalSpeed : 0;
  if (verticalDelta < -FIRST_HOVER_AUTO_CEILING) return false;
  if (verticalSpeed < FIRST_HOVER_AUTO_CATCH_SPEED) return true;
  if (verticalSpeed <= 0) return verticalDelta > FIRST_HOVER_AUTO_APEX_MARGIN;
  const ballisticStop = (verticalSpeed * verticalSpeed) / (2 * GRAVITY_STRENGTH);
  return verticalDelta > ballisticStop + FIRST_HOVER_AUTO_APEX_MARGIN;
}

/**
 * Rebuild the signed presentation rail from durable physical receipts after a
 * reload/authority snapshot. Activations happen synchronously in causal order,
 * so the next rendered frame presents only the latest earned state; no gameplay
 * event or progression fact is replayed.
 */
export function reconcileReconstructionSignedAvFromReceipts(
  actorId: ActorId,
  repairStage: ShipRepairStage
): void {
  if (!hasWreckDiagnosisReceipt(actorId)) return;
  activateSignedSceneSemanticEvent('ev.reconstruct.relationships-diagnosed');
  if (atLeast(repairStage, 'bench_online')) {
    activateSignedSceneSemanticEvent('ship_repair_stage:bench_online');
  }
  if (atLeast(repairStage, 'frame_restored')) {
    activateSignedSceneSemanticEvent('ship_repair_stage:frame_restored');
  }
  if (atLeast(repairStage, 'hull_sealed')) {
    activateSignedSceneSemanticEvent('ship_repair_stage:hull_sealed');
  }
  if (atLeast(repairStage, 'lift_online')) {
    activateSignedSceneSemanticEvent('ship_repair_stage:lift_online');
  }
  if (hasFirstLegalHoverReceipt(actorId)) {
    activateSignedSceneSemanticEvent('ev.reconstruct.first-legal-hover');
  }
  if (repairStage === 'flight_ready' && hasFirstHoverGroundedReturn(actorId)) {
    activateSignedSceneSemanticEvent('ev.reconstruct.flight-ready');
    if (hasReconstructionCalibrationReceipt(actorId)) {
      activateSignedSceneSemanticEvent('ev.reconstruct.calibration-completed');
    }
  }
}

export function resetReconstructionEmbodimentRuntimeForTests(): void {
  wreckBinding = null;
  hoverRuntime = createFirstHoverProofState();
  hoverRuntimeKey = '';
}

function clampDt(dt: number): number {
  return Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
}

function normalized(tuple: Vec3Tuple): [number, number, number] {
  const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
  return length > 1e-9
    ? [tuple[0] / length, tuple[1] / length, tuple[2] / length]
    : [0, 1, 0];
}

function vectorClearance(position: Vec3Tuple, origin: Vec3Tuple, upTuple: Vec3Tuple): number {
  const up = normalized(upTuple);
  return (position[0] - origin[0]) * up[0]
    + (position[1] - origin[1]) * up[1]
    + (position[2] - origin[2]) * up[2];
}

function vectorLateralDistance(position: Vec3Tuple, origin: Vec3Tuple, upTuple: Vec3Tuple): number {
  const clearance = vectorClearance(position, origin, upTuple);
  const up = normalized(upTuple);
  const dx = position[0] - origin[0] - up[0] * clearance;
  const dy = position[1] - origin[1] - up[1] * clearance;
  const dz = position[2] - origin[2] - up[2] * clearance;
  return Math.hypot(dx, dy, dz);
}

function distanceSquared(left: Vec3Tuple, right: Vec3Tuple): number {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  const dz = left[2] - right[2];
  return dx * dx + dy * dy + dz * dz;
}

function distance(left: Vec3Tuple, right: Vec3Tuple): number {
  return Math.sqrt(distanceSquared(left, right));
}

function hoverProofStage(stage: ShipRepairStage, actorId: ActorId): ShipRepairStage {
  // A legacy/shared flight-ready hull cannot be rolled back. Rehearsing its
  // installed lift cell under the same bounded physical proof is the explicit
  // compatibility transaction; no receipt is inferred from the later scalar.
  return stage === 'flight_ready' && hasWreckDiagnosisReceipt(actorId)
    ? 'lift_online'
    : stage;
}
