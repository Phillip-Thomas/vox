import type { ControlMode, FlightPhase } from '../game/playerFlight.ts';
import type { SystemLocationMode } from '../state/systemFlight.ts';
import {
  activateSignedSceneSemanticEvent,
  enterSignedSceneAvBeat
} from './signedSceneAvRuntime.ts';
import type { StoryBeat } from './storyState.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

/** Frozen semantic keys from the signed council contract. Physical systems use
 * these keys without learning anything about shots, score, or PostFX. */
export const VEHICLE_SCENE_AV_EVENTS = Object.freeze({
  launchIgnition: 'ship_launched',
  launchLiftoff: 'ev.launch.legal-liftoff',
  launchAtmosphereExit: 'ev.launch.origin-atmosphere-exited',
  crossingLocalHandoff: 'ev.crossing.world-owner-transferred',
  crossingApproach: 'ev.crossing.approach-established',
  landfallEgress: 'ev.landfall.egress-cleared',
  landfallFirstFootfall: 'ev.landfall.first-footfall',
  landfallHandback: 'ev.landfall.on-foot-authority-restored'
} as const);

export type VehicleSceneAvEvent = typeof VEHICLE_SCENE_AV_EVENTS[keyof typeof VEHICLE_SCENE_AV_EVENTS];

export function activateVehicleSceneAvEvent(event: VehicleSceneAvEvent): boolean {
  return activateSignedSceneSemanticEvent(event);
}

/** ch8-launch's signed entry anchor is ignition itself. The AV beat is held
 * dormant until a real launch sequence exists, then entered and semantically
 * authenticated in the same synchronous boundary. */
export function activateLaunchIgnitionFromCreatedSequence(storyBeat: StoryBeat | null): void {
  if (storyBeat !== 'ch8-launch') return;
  enterSignedSceneAvBeat('ch8-launch');
  activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.launchIgnition);
}

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** True only after the craft has moved outward along its authored ascent, not
 * merely because Space was pressed or a launch timer exists. */
export function hasLaunchPhysicallyDeparted(
  from: Vector3Like,
  current: Vector3Like,
  to: Vector3Like,
  minimumOutwardDistance = 0.01
): boolean {
  const axisX = to.x - from.x;
  const axisY = to.y - from.y;
  const axisZ = to.z - from.z;
  const axisLength = Math.hypot(axisX, axisY, axisZ);
  if (!Number.isFinite(axisLength) || axisLength <= 1e-6) return false;
  const movedX = current.x - from.x;
  const movedY = current.y - from.y;
  const movedZ = current.z - from.z;
  const outwardDistance = (
    movedX * axisX + movedY * axisY + movedZ * axisZ
  ) / axisLength;
  return Number.isFinite(outwardDistance) && outwardDistance >= minimumOutwardDistance;
}

export interface ApproachAuthorityProof {
  targetWorldId: string;
  currentWorldId: string;
  activePlanetId: string | null;
  committedEpoch: number | null;
  activationEpoch: number;
  sceneReady: boolean;
  locationMode: SystemLocationMode;
  controlMode: ControlMode;
  phase: FlightPhase;
}

/** The approach cue may not lead the ownership handoff. All render, system,
 * flight, and scene-paint authorities must describe the same p1 world. */
export function isTidegardenApproachAuthorityReady(proof: ApproachAuthorityProof): boolean {
  return proof.targetWorldId === TIDEGARDEN_WORLD_ID
    && proof.currentWorldId === proof.targetWorldId
    && proof.activePlanetId === proof.targetWorldId
    && proof.committedEpoch !== null
    && proof.activationEpoch === proof.committedEpoch
    && proof.sceneReady
    && proof.locationMode === 'atmosphere'
    && proof.controlMode === 'flight'
    && proof.phase === 'descent';
}

export interface LandfallAvState {
  readonly egressCleared: boolean;
  readonly firstFootfall: boolean;
  readonly handback: boolean;
}

export const INITIAL_LANDFALL_AV_STATE: LandfallAvState = Object.freeze({
  egressCleared: false,
  firstFootfall: false,
  handback: false
});

export type LandfallAvEvidence =
  | {
    kind: 'egress';
    worldId: string;
    activePlanetId: string | null;
    previousControlMode: ControlMode;
    controlMode: ControlMode;
    egressResolved: boolean;
  }
  | {
    kind: 'grounded';
    worldId: string;
    activePlanetId: string | null;
    controlMode: ControlMode;
    grounded: boolean;
  };

export interface LandfallAvAdvance {
  state: LandfallAvState;
  events: VehicleSceneAvEvent[];
}

/** Monotonic physical ordering for the hatch-to-foot sequence. A grounded
 * callback that arrives before a validated exit cannot manufacture footfall. */
export function advanceLandfallAvState(
  state: LandfallAvState,
  evidence: LandfallAvEvidence
): LandfallAvAdvance {
  const events: VehicleSceneAvEvent[] = [];
  let next = state;
  const ownsTidegarden = evidence.worldId === TIDEGARDEN_WORLD_ID
    && evidence.activePlanetId === TIDEGARDEN_WORLD_ID;

  if (evidence.kind === 'egress') {
    if (
      ownsTidegarden
      && !state.egressCleared
      && evidence.previousControlMode === 'flight'
      && evidence.controlMode === 'fps'
      && evidence.egressResolved
    ) {
      next = { ...state, egressCleared: true };
      events.push(VEHICLE_SCENE_AV_EVENTS.landfallEgress);
    }
    return { state: next, events };
  }

  if (
    ownsTidegarden
    && state.egressCleared
    && evidence.controlMode === 'fps'
    && evidence.grounded
  ) {
    if (!next.firstFootfall) {
      next = { ...next, firstFootfall: true };
      events.push(VEHICLE_SCENE_AV_EVENTS.landfallFirstFootfall);
    }
    if (!next.handback) {
      next = { ...next, handback: true };
      events.push(VEHICLE_SCENE_AV_EVENTS.landfallHandback);
    }
  }
  return { state: next, events };
}
