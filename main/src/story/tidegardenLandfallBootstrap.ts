import {
  buildStarSystemManifest,
  type PlanetDescriptor
} from '../game/starSystem.ts';
import {
  resetSystemFlightForInterstellarArrival,
  type InterstellarSystemReset
} from '../state/systemFlight.ts';
import { restoreFlightAtLocation } from '../state/spaceFlight.ts';
import { getShipRestorationSnapshot } from '../game/systems/shipRestoration.ts';
import {
  contextFromDescriptor,
  persistShipFlightLocation,
  restoreShipFlightForWorld
} from '../state/shipFlightContinuity.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

/**
 * The debug landfall starts inside the atmosphere, but outside the complete
 * spherical bound of Tidegarden. This is deliberately independent of terrain
 * generation: ShipController may restore it before the validated landing field
 * has mounted, and the pilot still owns the physical descent and touchdown.
 */
export const TIDEGARDEN_DEBUG_APPROACH_CLEARANCE = 30;

export interface TidegardenLandfallBootstrap {
  readonly world: PlanetDescriptor;
  readonly systemReset: InterstellarSystemReset;
}

export interface TidegardenLandfallResume extends TidegardenLandfallBootstrap {
  readonly restoredPersistedPose: boolean;
}

export function createTidegardenLandfallBootstrap(): TidegardenLandfallBootstrap {
  const manifest = buildStarSystemManifest(STORY_COORDINATE, { bodyCountOverride: 2 });
  const world = manifest.planets.find(planet => planet.worldId === TIDEGARDEN_WORLD_ID);
  if (!world) throw new Error('Tidegarden is missing from the authored Story system.');

  const localRadius = world.surfaceBoundRadius + TIDEGARDEN_DEBUG_APPROACH_CLEARANCE;
  const systemReset: InterstellarSystemReset = {
    system: manifest.coordinate,
    layoutVersion: manifest.layoutVersion,
    locationMode: 'atmosphere',
    activePlanetId: world.worldId,
    pose: {
      position: [
        world.systemPosition[0],
        world.systemPosition[1] + localRadius,
        world.systemPosition[2]
      ],
      velocity: [0, 0, 0],
      // Local -Z faces local -Y, so the restored cockpit opens on the planet.
      quaternion: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]
    },
    renderOrigin: world.systemPosition
  };

  return { world, systemReset };
}

/** Debug-only boundary action; normal interplanetary handoff remains untouched. */
export function bootstrapTidegardenLandfallDebug(): TidegardenLandfallBootstrap {
  const bootstrap = createTidegardenLandfallBootstrap();
  resetSystemFlightForInterstellarArrival(bootstrap.systemReset);
  restoreFlightAtLocation('atmosphere');
  persistShipFlightLocation({
    ...contextFromDescriptor(
      bootstrap.world,
      bootstrap.systemReset.layoutVersion ?? 1
    ),
    locationMode: 'atmosphere',
    parkedPose: null
  });
  return bootstrap;
}

/**
 * Debug/movie entry for scenes that begin after the player has already landed
 * and left the ship. Unlike the atmospheric rehearsal above, this grants no
 * touchdown or egress Story receipt; it only makes the selected voxel world,
 * system-flight owner, and on-foot flight state agree before React mounts the
 * Tidegarden interaction surface.
 */
export function bootstrapTidegardenSurfaceDebug(): TidegardenLandfallBootstrap {
  const bootstrap = createTidegardenLandfallBootstrap();
  resetSystemFlightForInterstellarArrival({
    ...bootstrap.systemReset,
    locationMode: 'surface',
    pose: {
      position: bootstrap.world.systemPosition,
      velocity: [0, 0, 0],
      quaternion: [0, 0, 0, 1]
    },
    renderOrigin: bootstrap.world.systemPosition
  });
  restoreFlightAtLocation('surface');
  persistShipFlightLocation({
    ...contextFromDescriptor(
      bootstrap.world,
      bootstrap.systemReset.layoutVersion ?? 1
    ),
    locationMode: 'surface',
    parkedPose: null
  });
  return bootstrap;
}

/**
 * Production checkpoint resume for a crossed-but-not-landed Story save. A valid
 * Tidegarden atmospheric pose wins. Missing, stale, surface, or local-space data
 * starts a fresh approach outside the planet bound; it never calls the landing
 * or egress actions, so touchdown and first-footfall remain physical evidence.
 */
export function resumeTidegardenLandfallFromSave(): TidegardenLandfallResume {
  const bootstrap = createTidegardenLandfallBootstrap();
  const restored = getShipRestorationSnapshot();
  const context = contextFromDescriptor(
    bootstrap.world,
    bootstrap.systemReset.layoutVersion ?? 1
  );
  if (restored.locationMode === 'atmosphere') {
    const result = restoreShipFlightForWorld(context, restored);
    if (result.restored) return { ...bootstrap, restoredPersistedPose: true };
  }

  resetSystemFlightForInterstellarArrival(bootstrap.systemReset);
  restoreFlightAtLocation('atmosphere');
  persistShipFlightLocation({
    ...context,
    locationMode: 'atmosphere',
    parkedPose: null
  });
  return { ...bootstrap, restoredPersistedPose: false };
}
