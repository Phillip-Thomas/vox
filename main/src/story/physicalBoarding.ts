import type { ActorId } from '../game/playerActors.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import type { ControlMode, FlightPhase } from '../game/playerFlight.ts';
import { isTouchDevice } from '../utils/mobileInput.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { activateSignedSceneSemanticEvent } from './signedSceneAvRuntime.ts';
import type { StoryBeat } from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { setChapter7BoardingPhase } from './emergentScoreDirector.ts';
import {
  PHYSICAL_BOARDING_MILESTONE,
  PHYSICAL_BOARDING_SEALED_MILESTONE
} from './physicalBoardingReceipts.ts';

export {
  PHYSICAL_BOARDING_MILESTONE,
  PHYSICAL_BOARDING_SEALED_MILESTONE
} from './physicalBoardingReceipts.ts';

export const PHYSICAL_BOARDING_REACH = 3.8;
export const PHYSICAL_BOARDING_HATCH_SECONDS = 0.72;
export const PHYSICAL_BOARDING_SEAL_SECONDS = 0.38;
// The pressure-seal score/acoustic envelope needs 260 ms to close and recover.
// Keep handback inside ch7-board long enough that beat-exit cannot truncate it.
export const PHYSICAL_BOARDING_HANDBACK_SECONDS = 0.3;

type Vec3Tuple = readonly [number, number, number];

export type PhysicalBoardingPhase =
  | 'idle'
  | 'hatch_entering'
  | 'transfer_requested'
  | 'sealing'
  | 'handback'
  | 'complete'
  | 'cancelled';

export interface PhysicalBoardingState {
  phase: PhysicalBoardingPhase;
  transactionId: string | null;
  actorId: ActorId | null;
  worldId: string | null;
  exteriorPosition: Vec3Tuple | null;
  surfaceUp: Vec3Tuple | null;
  shipPosition: Vec3Tuple | null;
  elapsed: number;
  hatchProgress: number;
  sealProgress: number;
  cancelReason: string | null;
}

export type PhysicalBoardingEffect =
  | 'activate-hatch-entered'
  | 'request-vehicle-transfer'
  | 'activate-camera-owner-vehicle'
  | 'activate-cockpit-sealed'
  | 'complete-physical-boarding';

export interface PhysicalBoardingAdvance {
  state: PhysicalBoardingState;
  effects: PhysicalBoardingEffect[];
}

export interface BeginPhysicalBoardingInput {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  repairStage: string;
  phase: FlightPhase;
  controlMode: ControlMode;
  boardable: boolean;
  exteriorPosition: Vec3Tuple;
  surfaceUp: Vec3Tuple;
  shipPosition: Vec3Tuple;
}

export interface TickPhysicalBoardingInput {
  actorId: ActorId;
  worldId: string;
  storyBeat: StoryBeat | null;
  phase: FlightPhase;
  controlMode: ControlMode;
  boardable: boolean;
  playerPosition: Vec3Tuple;
  focused: boolean;
  paused: boolean;
  dt: number;
}

export function createPhysicalBoardingState(): PhysicalBoardingState {
  return {
    phase: 'idle',
    transactionId: null,
    actorId: null,
    worldId: null,
    exteriorPosition: null,
    surfaceUp: null,
    shipPosition: null,
    elapsed: 0,
    hatchProgress: 0,
    sealProgress: 0,
    cancelReason: null
  };
}

export function beginPhysicalBoardingState(
  current: PhysicalBoardingState,
  input: BeginPhysicalBoardingInput,
  sequence = 1
): PhysicalBoardingState {
  if (isPhysicalBoardingInProgressState(current)) return current;
  const distance = distanceSquared(input.exteriorPosition, input.shipPosition);
  if (input.storyBeat !== 'ch7-board'
    || input.worldId !== STORY_PRIMARY_WORLD_ID
    || input.repairStage !== 'flight_ready'
    || input.phase !== 'surface'
    || input.controlMode !== 'fps'
    || !input.boardable
    || distance > PHYSICAL_BOARDING_REACH ** 2) return current;
  return {
    phase: 'hatch_entering',
    transactionId: `story:board:${input.actorId}:${input.worldId}:${sequence}`,
    actorId: input.actorId,
    worldId: input.worldId,
    exteriorPosition: [...input.exteriorPosition],
    surfaceUp: normalized(input.surfaceUp),
    shipPosition: [...input.shipPosition],
    elapsed: 0,
    hatchProgress: 0,
    sealProgress: 0,
    cancelReason: null
  };
}

export function advancePhysicalBoardingState(
  current: PhysicalBoardingState,
  input: TickPhysicalBoardingInput
): PhysicalBoardingAdvance {
  if (!isPhysicalBoardingInProgressState(current)) return { state: current, effects: [] };
  if (current.actorId !== input.actorId || current.worldId !== input.worldId) {
    return { state: cancelState(current, 'actor-or-world-changed'), effects: [] };
  }

  const vehicleAlreadyOwns = current.phase === 'transfer_requested'
    && input.phase === 'surface'
    && input.controlMode === 'flight';
  const beforeTransfer = current.phase === 'hatch_entering'
    || (current.phase === 'transfer_requested' && !vehicleAlreadyOwns);
  if (beforeTransfer) {
    if (!input.focused || input.paused) {
      return { state: cancelState(current, input.paused ? 'paused' : 'focus-lost'), effects: [] };
    }
    if (input.storyBeat !== 'ch7-board') {
      return { state: cancelState(current, 'beat-changed'), effects: [] };
    }
    if (input.phase !== 'surface' || input.controlMode !== 'fps') {
      if (current.phase !== 'transfer_requested' || input.controlMode !== 'flight') {
        return { state: cancelState(current, 'controller-state-changed'), effects: [] };
      }
    }
    if (current.phase === 'hatch_entering' && (
      !input.boardable
      || !current.shipPosition
      || distanceSquared(input.playerPosition, current.shipPosition) > PHYSICAL_BOARDING_REACH ** 2
    )) {
      return { state: cancelState(current, 'left-hatch-envelope'), effects: [] };
    }
  } else if (!input.focused || input.paused) {
    // Once camera ownership has transferred, never strand the player outside by
    // cancelling. Freeze the seal transaction until the game visibly resumes.
    return { state: current, effects: [] };
  }

  const dt = clampDt(input.dt);
  if (current.phase === 'hatch_entering') {
    const elapsed = current.elapsed + dt;
    const hatchProgress = smoothstep(Math.min(1, elapsed / PHYSICAL_BOARDING_HATCH_SECONDS));
    if (elapsed < PHYSICAL_BOARDING_HATCH_SECONDS) {
      return { state: { ...current, elapsed, hatchProgress }, effects: [] };
    }
    return {
      state: {
        ...current,
        phase: 'transfer_requested',
        elapsed: 0,
        hatchProgress: 1
      },
      effects: ['activate-hatch-entered', 'request-vehicle-transfer']
    };
  }

  if (current.phase === 'transfer_requested') {
    if (input.phase === 'surface' && input.controlMode === 'flight') {
      return {
        state: { ...current, phase: 'sealing', elapsed: 0 },
        effects: ['activate-camera-owner-vehicle']
      };
    }
    return { state: current, effects: [] };
  }

  if (current.phase === 'sealing') {
    if (input.phase !== 'surface' || input.controlMode !== 'flight') {
      return { state: current, effects: [] };
    }
    const elapsed = current.elapsed + dt;
    const sealProgress = smoothstep(Math.min(1, elapsed / PHYSICAL_BOARDING_SEAL_SECONDS));
    if (elapsed < PHYSICAL_BOARDING_SEAL_SECONDS) {
      return {
        state: {
          ...current,
          elapsed,
          sealProgress,
          hatchProgress: 1 - sealProgress
        },
        effects: []
      };
    }
    return {
      state: {
        ...current,
        phase: 'handback',
        elapsed: 0,
        sealProgress: 1,
        hatchProgress: 0
      },
      effects: ['activate-cockpit-sealed']
    };
  }

  if (current.phase === 'handback') {
    if (input.phase !== 'surface' || input.controlMode !== 'flight') {
      return { state: current, effects: [] };
    }
    const elapsed = current.elapsed + dt;
    if (elapsed < PHYSICAL_BOARDING_HANDBACK_SECONDS) {
      return { state: { ...current, elapsed }, effects: [] };
    }
    return {
      state: { ...current, phase: 'complete', elapsed: 0 },
      effects: ['complete-physical-boarding']
    };
  }

  return { state: current, effects: [] };
}

let state = createPhysicalBoardingState();
let sequence = 0;

export function beginPhysicalBoarding(input: BeginPhysicalBoardingInput): boolean {
  if (hasCompletedPhysicalBoarding(input.actorId, input.worldId)) return false;
  const next = beginPhysicalBoardingState(state, input, ++sequence);
  const started = next !== state && next.phase === 'hatch_entering';
  state = next;
  if (started) {
    setChapter7BoardingPhase('hatch-entered', {
      live: true,
      transactionId: state.transactionId ?? undefined
    });
  }
  return started;
}

export function tickPhysicalBoarding(input: TickPhysicalBoardingInput): PhysicalBoardingEffect[] {
  const previousPhase = state.phase;
  const advanced = advancePhysicalBoardingState(state, input);
  state = advanced.state;
  if (state.phase === 'cancelled' && previousPhase !== 'cancelled') {
    // Validation-driven cancellation has no gameplay effect token, but it is
    // still an authoritative phase edge for the score's hatch ownership.
    setChapter7BoardingPhase('cancelled', {
      live: true,
      transactionId: state.transactionId ?? undefined
    });
  }
  for (const effect of advanced.effects) {
    if (effect === 'activate-hatch-entered') {
      setChapter7BoardingPhase('hatch-entered', {
        live: true,
        transactionId: state.transactionId ?? undefined
      });
      activateSignedSceneSemanticEvent('ev.board.hatch-entered');
    } else if (effect === 'activate-camera-owner-vehicle') {
      setChapter7BoardingPhase('vehicle-owner', {
        live: true,
        transactionId: state.transactionId ?? undefined
      });
      activateSignedSceneSemanticEvent('ev.board.camera-owner-vehicle');
    } else if (effect === 'activate-cockpit-sealed') {
      // The pressure silence begins on the same authoritative effect edge as
      // the signed seal anchor; frame-loop observation would be one frame late.
      setChapter7BoardingPhase('cockpit-sealed', {
        live: true,
        transactionId: state.transactionId ?? undefined
      });
      activateSignedSceneSemanticEvent('ev.board.cockpit-sealed');
      markMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE, input.actorId);
    } else if (effect === 'complete-physical-boarding') {
      setChapter7BoardingPhase('cockpit-handback', {
        live: true,
        transactionId: state.transactionId ?? undefined
      });
      // Publish the physical handback before exposing durable completion.
      // Progression subscribers are allowed to leave ch7-board synchronously,
      // so marking the milestone first can swallow this final signed anchor.
      activateSignedSceneSemanticEvent('ship_boarded');
      emitEmergentStoryEvent({
        id: `${state.transactionId ?? `story:board:${input.actorId}:${input.worldId}`}:complete`,
        type: 'ship_boarded',
        actorId: input.actorId,
        worldId: input.worldId,
        payload: { worldId: input.worldId }
      });
      markMilestone(PHYSICAL_BOARDING_MILESTONE, input.actorId);
    }
  }
  return advanced.effects;
}

export function getPhysicalBoardingSnapshot(): PhysicalBoardingState {
  return {
    ...state,
    exteriorPosition: state.exteriorPosition ? [...state.exteriorPosition] : null,
    surfaceUp: state.surfaceUp ? [...state.surfaceUp] : null,
    shipPosition: state.shipPosition ? [...state.shipPosition] : null
  };
}

/**
 * One progression-derived objective contract for the complete hatch sequence.
 * The actionable state points at the physical hatch; once the player commits,
 * the marker deliberately yields to the camera-owned pressure transaction.
 */
export function getPhysicalBoardingGuidance(
  current: PhysicalBoardingState = state,
  inputMode: 'keyboard' | 'touch' = isTouchDevice() ? 'touch' : 'keyboard'
): GuidedStoryObjective {
  if (current.phase === 'hatch_entering' || current.phase === 'transfer_requested') {
    return {
      id: 'board:hatch-in-progress',
      kind: 'wait',
      markerLabel: 'KESTREL HATCH · ENTERING',
      workOrder: [
        'HATCH TRANSFER IN PROGRESS.',
        inputMode === 'touch'
          ? 'HOLD POSITION · USE TO STEP BACK.'
          : 'HOLD POSITION · ESC TO STEP BACK.'
      ],
      requiresMarker: false
    };
  }
  if (current.phase === 'sealing' || current.phase === 'handback') {
    return {
      id: 'board:pressure-seal',
      kind: 'wait',
      markerLabel: 'KESTREL · PRESSURE SEAL',
      workOrder: ['PRESSURE BOUNDARY CLOSING.'],
      requiresMarker: false
    };
  }
  if (current.phase === 'complete') {
    return {
      id: 'board:cockpit-secured',
      kind: 'wait',
      markerLabel: 'KESTREL · COCKPIT SECURED',
      workOrder: ['COCKPIT CONTROL ESTABLISHED.'],
      requiresMarker: false
    };
  }
  return {
    id: current.phase === 'cancelled' ? 'board:return-to-hatch' : 'board:enter-hatch',
    kind: 'interact',
    markerLabel: 'KESTREL HATCH · BOARD',
    workOrder: [
      current.phase === 'cancelled' ? 'RETURN TO THE KESTREL HATCH.' : 'APPROACH THE KESTREL HATCH.',
      inputMode === 'touch' ? 'USE · ENTER THROUGH THE HATCH.' : '[F] ENTER THROUGH THE HATCH.'
    ],
    requiresMarker: true
  };
}

export function cancelPhysicalBoarding(reason = 'player-cancelled'): boolean {
  if (state.phase !== 'hatch_entering' && state.phase !== 'transfer_requested') return false;
  state = cancelState(state, reason);
  setChapter7BoardingPhase('cancelled', {
    live: true,
    transactionId: state.transactionId ?? undefined
  });
  return true;
}

export function canCommitStagedShipEntry(): boolean {
  return state.phase === 'transfer_requested';
}

export function isPhysicalBoardingInputLocked(): boolean {
  return state.phase === 'hatch_entering' || state.phase === 'transfer_requested';
}

/**
 * Camera ownership transfers before the pressure boundary closes, but vehicle
 * authority does not. Launch/exit callers must hold until sealing + handback
 * finish or they can move the ship (or abandon it) underneath the transaction.
 */
export function isPhysicalBoardingVehicleControlLocked(): boolean {
  return isPhysicalBoardingInProgressState(state);
}

export function isPhysicalBoardingInProgress(): boolean {
  return isPhysicalBoardingInProgressState(state);
}

export function hasCompletedPhysicalBoarding(actorId?: ActorId, worldId?: string): boolean {
  if (worldId !== undefined && worldId !== STORY_PRIMARY_WORLD_ID) return false;
  return hasMilestone(PHYSICAL_BOARDING_MILESTONE, actorId);
}

export function hasSealedPhysicalBoarding(actorId?: ActorId, worldId?: string): boolean {
  if (worldId !== undefined && worldId !== STORY_PRIMARY_WORLD_ID) return false;
  return hasMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE, actorId);
}

/** Restore the signed causal rail from the persisted completed transaction. */
export function reconcilePhysicalBoardingSignedAvFromReceipt(
  actorId: ActorId,
  worldId: string
): boolean {
  if (worldId !== STORY_PRIMARY_WORLD_ID || !hasCompletedPhysicalBoarding(actorId, worldId)) {
    return false;
  }
  activateSignedSceneSemanticEvent('ev.board.hatch-entered');
  activateSignedSceneSemanticEvent('ev.board.camera-owner-vehicle');
  activateSignedSceneSemanticEvent('ev.board.cockpit-sealed');
  activateSignedSceneSemanticEvent('ship_boarded');
  return true;
}

/** Lifecycle reset only: a Story restart/world teardown must not retain a half-transfer. */
export function resetPhysicalBoardingRuntime(reason = 'reset'): void {
  if (isPhysicalBoardingInProgressState(state)) {
    setChapter7BoardingPhase('cancelled', {
      live: true,
      transactionId: state.transactionId ?? undefined
    });
  }
  state = { ...createPhysicalBoardingState(), cancelReason: reason };
}

export function resetPhysicalBoardingRuntimeForTests(): void {
  resetPhysicalBoardingRuntime('test-reset');
  sequence = 0;
}

function isPhysicalBoardingInProgressState(candidate: PhysicalBoardingState): boolean {
  return candidate.phase === 'hatch_entering'
    || candidate.phase === 'transfer_requested'
    || candidate.phase === 'sealing'
    || candidate.phase === 'handback';
}

function cancelState(current: PhysicalBoardingState, reason: string): PhysicalBoardingState {
  return {
    ...current,
    phase: 'cancelled',
    elapsed: 0,
    hatchProgress: 0,
    sealProgress: 0,
    cancelReason: reason
  };
}

function normalized(tuple: Vec3Tuple): [number, number, number] {
  const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
  return length > 1e-9
    ? [tuple[0] / length, tuple[1] / length, tuple[2] / length]
    : [0, 1, 0];
}

function distanceSquared(left: Vec3Tuple, right: Vec3Tuple): number {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  const dz = left[2] - right[2];
  return dx * dx + dy * dy + dz * dz;
}

function clampDt(dt: number): number {
  return Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
