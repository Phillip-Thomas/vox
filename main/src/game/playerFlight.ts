import type { WorldCoordinate } from '../utils/worldCoordinates.ts';
import type { ActorId } from './playerActors.ts';
import type { Vec3Tuple } from './playerPose.ts';

export type FlightPhase = 'surface' | 'launch' | 'deep_space' | 'approach' | 'descent';
export type ControlMode = 'fps' | 'flight';

/**
 * 'travel' = the full interstellar jump (swaps the voxel world at the midpoint).
 * 'enter'/'leave' = the short atmosphere transition that only flips flight phase.
 */
export type WarpKind = 'travel' | 'enter' | 'leave';

export interface SpaceFlightSnapshot {
  phase: FlightPhase;
  controlMode: ControlMode;
  /** Locked-in destination once a travel warp has begun. */
  destination: WorldCoordinate | null;
  /** Impostor currently aimed at / locked while flying before travel. */
  target: WorldCoordinate | null;
}

export interface WarpRuntime {
  active: boolean;
  /** 0..1 across the whole effect; peak white-out at 0.5. */
  progress: number;
  kind: WarpKind;
  /** Seconds for this particular warp. */
  duration: number;
  /** Peak overlay strength (0..1). */
  intensity: number;
  /** Set once midpoint side effects have fired. */
  midpointFired: boolean;
}

export interface ShipPose {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  forward: Vec3Tuple;
  up: Vec3Tuple;
}

export interface ShardHandoffState {
  status: 'requested' | 'midpoint' | 'complete';
  destination: WorldCoordinate | null;
}

export interface PlayerFlightState extends SpaceFlightSnapshot {
  playerId: ActorId;
  seq: number;
  timeMs: number;
  shipPose?: ShipPose;
  handoff?: ShardHandoffState;
}

export type PlayerFlightInput = Pick<PlayerFlightState, 'playerId'> &
  Partial<Omit<PlayerFlightState, 'playerId'>>;

export function createPlayerFlightState(input: PlayerFlightInput): PlayerFlightState {
  return {
    playerId: input.playerId,
    seq: Math.max(0, Math.trunc(finite(input.seq ?? 0))),
    timeMs: Math.max(0, finite(input.timeMs ?? Date.now())),
    phase: input.phase ?? 'surface',
    controlMode: input.controlMode ?? 'fps',
    destination: input.destination ?? null,
    target: input.target ?? null,
    shipPose: input.shipPose,
    handoff: input.handoff
  };
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
