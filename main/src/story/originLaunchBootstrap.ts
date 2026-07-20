import { buildStarSystemManifest, type PlanetDescriptor } from '../game/starSystem.ts';
import { restoreBoardedSurfaceFlight } from '../state/spaceFlight.ts';
import { resetSystemFlightForInterstellarArrival } from '../state/systemFlight.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';

/**
 * Direct-entry reconstruction for the Chapter 7 -> 8 handoff. It establishes
 * canonical Origin ownership and parked cockpit control without persisting a
 * fabricated ship pose; the mounted ShipController validates the real wreck
 * pad and captures that exact pose.
 */
export function bootstrapOriginLaunchDebug(): PlanetDescriptor {
  const manifest = buildStarSystemManifest(STORY_COORDINATE, { bodyCountOverride: 2 });
  const world = manifest.planets.find(planet => planet.worldId === STORY_PRIMARY_WORLD_ID);
  if (!world) throw new Error('Origin is missing from the authored Story system.');

  resetSystemFlightForInterstellarArrival({
    system: manifest.coordinate,
    layoutVersion: manifest.layoutVersion,
    locationMode: 'surface',
    activePlanetId: world.worldId,
    // This staging pose is intentionally non-persistent. Surface flight mounts
    // from the validated repaired-wreck boarding pose, then replaces it.
    pose: {
      position: [
        world.systemPosition[0],
        world.systemPosition[1] + world.surfaceBoundRadius,
        world.systemPosition[2]
      ],
      velocity: [0, 0, 0],
      quaternion: [0, 0, 0, 1]
    },
    renderOrigin: world.systemPosition
  });
  restoreBoardedSurfaceFlight();
  return world;
}
