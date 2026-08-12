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
import * as THREE from 'three';
import { STORY_COORDINATE } from './world/storyWorld.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import {
  commitHabitatCorePlacement,
  getHabitatWorldState,
  type HabitatCell
} from '../game/systems/habitatSystem.ts';
import { placePiece } from '../game/systems/structureSystem.ts';
import { certifyTidegardenShelter } from './tidegardenSettlement.ts';

/**
 * The rehearsal hearth's cell. Deliberately a fixed, flat, inland cell rather
 * than a search: a deep link is a reproducible rehearsal, and a rehearsal that
 * lands somewhere new each time is not one.
 */
const CH10_DEBUG_HABITAT_CELL: HabitatCell = [0, 5, 0];
const CH10_DEBUG_HABITAT_EYE_HEIGHT = 1.2;
const CH10_DEBUG_SHELTER_ID = 'ch10-debug-second-hearth';
/** +Y up, its opposite as the floor, and the four lateral faces as walls. */
const CH10_DEBUG_UP_FACE = 2;
const CH10_DEBUG_FLOOR_FACE = 3;
const CH10_DEBUG_WALL_FACES = [0, 1, 4, 5] as const;

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
 * Chapter 10's rehearsal prerequisite: a certified second hearth.
 *
 * A `?story=` beat jump starts from pristine terrain and a pristine spawn, which
 * is exactly right for every beat that builds its own world and exactly wrong
 * for chapter 10 — it opens INSIDE finished free play, at a hearth the player
 * spent chapter 9 earning. This reconstructs that hearth through the same three
 * shipped authorities the player's own run commits it through: the core
 * placement, the physical enclosure, and the flood-fill certification. Nothing
 * is faked past them; if any one refuses, the rehearsal is honestly without a
 * hearth rather than quietly pretending to have one.
 *
 * Debug/rehearsal only. Returns true when a certified shelter exists afterwards.
 */
export function bootstrapTidegardenHabitatDebug(
  actorId: ActorId = getLocalActorId()
): boolean {
  const existing = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (existing?.shelterCertification) return true;

  const lowerCell: HabitatCell = [...CH10_DEBUG_HABITAT_CELL];
  const upperCell: HabitatCell = [lowerCell[0], lowerCell[1] + 1, lowerCell[2]];
  const supportCell: HabitatCell = [lowerCell[0], lowerCell[1] - 1, lowerCell[2]];
  const playerPosition = new THREE.Vector3(
    lowerCell[0] + 0.5,
    lowerCell[1] + CH10_DEBUG_HABITAT_EYE_HEIGHT,
    lowerCell[2] + 0.5
  );

  if (!existing) {
    const placed = commitHabitatCorePlacement({
      actorId,
      worldId: TIDEGARDEN_WORLD_ID,
      shelterId: CH10_DEBUG_SHELTER_ID,
      cell: lowerCell,
      supportCell,
      position: [playerPosition.x, lowerCell[1], playerPosition.z],
      up: [0, 1, 0],
      eventId: `story:debug:${actorId}:ch10-habitat-core`
    });
    if (!placed) return false;
  }

  // The enclosure the certification will read: floor and ceiling on the up axis,
  // walls on the four lateral faces of both cells.
  placePiece(upperCell, CH10_DEBUG_UP_FACE, 'ceiling', 'wood', CH10_DEBUG_UP_FACE, actorId);
  placePiece(lowerCell, CH10_DEBUG_FLOOR_FACE, 'foundation', 'wood', CH10_DEBUG_UP_FACE, actorId);
  for (const cell of [lowerCell, upperCell]) {
    for (const face of CH10_DEBUG_WALL_FACES) {
      placePiece(cell, face, 'wall', 'wood', CH10_DEBUG_UP_FACE, actorId);
    }
  }

  const certified = certifyTidegardenShelter({
    worldId: TIDEGARDEN_WORLD_ID,
    playerPosition,
    eventId: `story:debug:${actorId}:ch10-shelter-certified`,
    actorId
  });
  return certified.ok;
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
