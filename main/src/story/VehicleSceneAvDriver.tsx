import { useEffect } from 'react';
import { subscribeAtmosphereExit } from '../state/spaceFlight.ts';
import {
  getSystemFlightSnapshot,
  subscribeSystemPlanetHandoffCommits
} from '../state/systemFlight.ts';
import {
  VEHICLE_SCENE_AV_EVENTS,
  activateVehicleSceneAvEvent
} from './vehicleSceneAvAnchors.ts';
import {
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID
} from './tidegardenRoute.ts';

/** Synchronous receipt bridge from successful vehicle commands into the signed
 * presentation rail. Generic store changes and elapsed time cannot trigger it. */
export function installVehicleSceneAvBoundaryBridge(): () => void {
  const unsubscribeAtmosphereExit = subscribeAtmosphereExit(() => {
    if (getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID) {
      activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.launchAtmosphereExit);
    }
  });

  const unsubscribeSystemHandoff = subscribeSystemPlanetHandoffCommits(receipt => {
    if (receipt.worldId === TIDEGARDEN_WORLD_ID) {
      activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.crossingLocalHandoff);
    }
  });

  return () => {
    unsubscribeAtmosphereExit();
    unsubscribeSystemHandoff();
  };
}

export default function VehicleSceneAvDriver(): null {
  useEffect(() => installVehicleSceneAvBoundaryBridge(), []);

  return null;
}
