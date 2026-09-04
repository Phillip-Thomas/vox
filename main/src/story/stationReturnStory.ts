import * as THREE from 'three';
import { getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import { getItemCount, removeItem, subscribeInventory } from '../game/systems/inventorySystem.ts';
import {
  hasMilestone,
  markMilestone,
  subscribeProgression
} from '../game/systems/progressionSystem.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { readSystemCompanionBodyTarget } from '../state/systemCompanionBodyTargets.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

export const STATION_RETURN_MILESTONES = Object.freeze({
  stationDeparted: 'story:ch11-station-departed',
  bondedCellAcquired: 'story:ch11-bonded-cell-acquired',
  bondedCellInstalled: 'story:ch12-bonded-cell-installed',
  hearthRestored: 'story:ch12-hearth-restored'
});

const INSTALL_REACH = 4.2;
const _returnTarget = new THREE.Vector3();

export interface StationReturnMarkerTarget {
  position: THREE.Vector3;
  label: string;
  projectionSpace: 'surface' | 'spatial';
  surfaceUp?: THREE.Vector3 | null;
}

export interface InstallBondedCellResult {
  ok: boolean;
  changed: boolean;
  reason?: string;
}

export function stationReturnPending(actorId: ActorId = getLocalActorId()): boolean {
  return hasMilestone(STATION_RETURN_MILESTONES.stationDeparted, actorId)
    && hasMilestone(STATION_RETURN_MILESTONES.bondedCellAcquired, actorId)
    && !hasMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId)
    && getItemCount('bonded_cell', actorId) > 0;
}

/** One subscription for the overlay mount; both halves can close the objective. */
export function subscribeStationReturn(listener: () => void): () => void {
  const stopProgression = subscribeProgression(listener);
  const stopInventory = subscribeInventory(listener);
  return () => {
    stopProgression();
    stopInventory();
  };
}

export function stationReturnObjective(actorId: ActorId = getLocalActorId()): GuidedStoryObjective | null {
  if (!stationReturnPending(actorId)) return null;
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  const atHearthSurface = system.activePlanetId === TIDEGARDEN_WORLD_ID
    && flight.phase === 'surface'
    && flight.controlMode !== 'flight';
  if (atHearthSurface) {
    return {
      id: 'hearth:return:install-cell',
      kind: 'interact',
      markerLabel: 'SECOND HEARTH · INSTALL BONDED CELL',
      workOrder: [
        'DELIVER THE BONDED CELL TO THE SECOND HEARTH.',
        '[F] INSTALL THE SEALED CELL.'
      ]
    };
  }
  return {
    id: 'station:return:tidegarden',
    kind: 'travel',
    markerLabel: 'TIDEGARDEN · SECOND HEARTH',
    workOrder: [
      'RETURN TO TIDEGARDEN.',
      'DELIVER THE BONDED CELL TO THE SECOND HEARTH.'
    ]
  };
}

export function stationReturnMarkerTarget(
  actorId: ActorId = getLocalActorId()
): StationReturnMarkerTarget | null {
  const objective = stationReturnObjective(actorId);
  if (!objective) return null;
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();

  if (system.activePlanetId !== TIDEGARDEN_WORLD_ID) {
    const companion = readSystemCompanionBodyTarget(TIDEGARDEN_WORLD_ID);
    return companion
      ? { position: companion, label: objective.markerLabel, projectionSpace: 'spatial' }
      : null;
  }

  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) return null;
  return {
    position: _returnTarget.set(...habitat.core.position),
    label: objective.markerLabel,
    projectionSpace: flight.phase === 'surface' ? 'surface' : 'spatial'
  };
}

export function installTidegardenBondedCell(input: {
  actorId?: ActorId;
  worldId: string;
  playerPosition: THREE.Vector3;
}): InstallBondedCellResult {
  const actorId = input.actorId ?? getLocalActorId();
  if (hasMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId)) {
    return { ok: true, changed: false };
  }
  if (input.worldId !== TIDEGARDEN_WORLD_ID) {
    return { ok: false, changed: false, reason: 'wrong world' };
  }
  if (!stationReturnPending(actorId)) {
    return { ok: false, changed: false, reason: 'sealed bonded cell required' };
  }
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) return { ok: false, changed: false, reason: 'second hearth missing' };
  if (input.playerPosition.distanceTo(_returnTarget.set(...habitat.core.position)) > INSTALL_REACH) {
    return { ok: false, changed: false, reason: 'second hearth out of reach' };
  }
  if (!removeItem('bonded_cell', 1, actorId)) {
    return { ok: false, changed: false, reason: 'sealed bonded cell required' };
  }
  markMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId);
  markMilestone(STATION_RETURN_MILESTONES.hearthRestored, actorId);
  return { ok: true, changed: true };
}

export { INSTALL_REACH as STATION_RETURN_INSTALL_REACH };
