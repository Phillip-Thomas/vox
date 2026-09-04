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
import {
  faceIndexForNormal,
  oppositeFace,
  placePiece
} from '../game/systems/structureSystem.ts';
import {
  certifyTidegardenShelter,
  findTidegardenRecommendedHabitatSite,
  type HabitatSiteProof
} from './tidegardenSettlement.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { createWorldArrivalPose } from '../utils/worldArrival.ts';
import { VOXEL_SCALE, voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';

/**
 * Tangential offset, in terrain cells, between the arrival pad and the
 * rehearsal hearth.
 *
 * Zero would stand the hearth inside the parked Kestrel, and inside
 * `CH10_CORE_INTERACT_DISTANCE` (4.2) of the spawn, so the chapter's first act
 * would already be under her hand before she had looked at it. More than
 * `CH10_HEARTH_NOTICE_RADIUS` (12 world units, both in emergentStoryDirector)
 * would open chapter 10 outside its own opening condition. Four cells is eight
 * world units, and the survey may slide a cell either way to reach dry level
 * ground: the hearth is the first thing in front of her, comfortably inside the
 * notice radius, and she still has to walk to it.
 */
const CH10_DEBUG_HEARTH_OFFSET_CELLS = 4;

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
 * Where the rehearsal hearth stands, resolved against the REAL terrain.
 *
 * The cell used to be a literal `[0, 5, 0]`, on the theory that a fixed cell is
 * more reproducible than a search. It is not: cell 5 is a depth, not a place,
 * and Tidegarden's surface in that column is cell 25. The hearth was therefore
 * committed forty world units inside the planet, which is where the owner found
 * chapter 10's first interactable.
 *
 * The correct fixed point is not a cell, it is the arrival pad — a pure
 * function of the world's size, seed and id, and the same one `EfficientScene`
 * mounts the player's own spawn from. Anchoring there and letting the shipped
 * habitat survey resolve the site keeps the rehearsal exactly as reproducible
 * as before while making the answer terrain-true: a hearth on the ground the
 * player wakes on, a few paces from her ship, the way chapter 9 leaves it.
 */
function tidegardenRehearsalHabitatSite(
  actorId: ActorId
): HabitatSiteProof | null {
  const { world } = createTidegardenLandfallBootstrap();
  const planetSize = world.nominalFaceRadius;
  // The generator IS the shipped SpawnTerrainQuery; `worldArrival` resolves the
  // canonical pad through this same handle. A `?story=` jump has just cleared
  // every voxel edit for this world, so pristine generation and the terrain the
  // player is about to stand on are the same terrain.
  const terrain = getWorldGen(planetSize, world.seed, world.worldId).generator;
  const arrival = createWorldArrivalPose(planetSize, world.seed, world.worldId);
  const anchor = arrival.playerSurfacePosition
    .clone()
    .setX(arrival.playerSurfacePosition.x + CH10_DEBUG_HEARTH_OFFSET_CELLS * VOXEL_SCALE);
  const site = findTidegardenRecommendedHabitatSite({
    worldId: TIDEGARDEN_WORLD_ID,
    planetSize,
    playerPosition: anchor,
    terrain,
    actorId
  });
  return site.ok ? site.proof : null;
}

/**
 * Panels the enclosure needs: a floor, a ceiling, and four walls on each of the
 * two interior cells. Topped up rather than minted outright, exactly as the
 * movie runtime provisions its own shelter build.
 */
const CH10_DEBUG_SHELTER_WOOD = 24;

/**
 * Chapter 10's rehearsal prerequisite: a certified second hearth.
 *
 * A `?story=` beat jump starts from pristine terrain and a pristine spawn, which
 * is exactly right for every beat that builds its own world and exactly wrong
 * for chapter 10 — it opens INSIDE finished free play, at a hearth the player
 * spent chapter 9 earning. This reconstructs that hearth through the same three
 * shipped authorities the player's own run commits it through: the site survey
 * and core placement, the physical enclosure, and the flood-fill certification.
 * Nothing is faked past them; if any one refuses, the rehearsal is honestly
 * without a hearth rather than quietly pretending to have one.
 *
 * Debug/rehearsal only. Returns true when a certified shelter exists afterwards.
 */
export function bootstrapTidegardenHabitatDebug(
  actorId: ActorId = getLocalActorId()
): boolean {
  const existing = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (existing?.shelterCertification) return true;

  const core = existing?.core ?? null;
  const site = core ? null : tidegardenRehearsalHabitatSite(actorId);
  const lowerCell: HabitatCell = core ? [...core.cell] : site ? [...site.cell] : [0, 0, 0];
  const up = core
    ? new THREE.Vector3(core.up[0], core.up[1], core.up[2])
    : site?.up.clone() ?? null;
  if (!up) return false;
  const upperCell: HabitatCell = [
    lowerCell[0] + up.x,
    lowerCell[1] + up.y,
    lowerCell[2] + up.z
  ];
  const upFace = faceIndexForNormal(up.x, up.y, up.z);
  const floorFace = oppositeFace(upFace);
  const wallFaces = [0, 1, 2, 3, 4, 5].filter(face => face !== upFace && face !== floorFace);
  // WORLD units, not cell indices: the certification's flood fill divides this
  // by VOXEL_SCALE to find the cell the player is standing in. Cell arithmetic
  // passed here read as a point three cells underground and the shelter never
  // certified at all.
  const playerPosition = voxelCoordToWorld(lowerCell[0], lowerCell[1], lowerCell[2]);

  if (site) {
    const placed = commitHabitatCorePlacement({
      actorId,
      worldId: TIDEGARDEN_WORLD_ID,
      shelterId: site.shelterId,
      cell: lowerCell,
      supportCell: [...site.supportCell],
      position: site.position.toArray(),
      up: up.toArray(),
      eventId: `story:debug:${actorId}:ch10-habitat-core`
    });
    if (!placed) return false;
  }

  // The enclosure the certification will read: floor and ceiling on the up axis,
  // walls on the four lateral faces of both cells. `placePiece` charges the
  // build, so the rehearsal must be able to afford its own hearth.
  const wood = getItemCount('wood', actorId);
  if (wood < CH10_DEBUG_SHELTER_WOOD) {
    addItem('wood', CH10_DEBUG_SHELTER_WOOD - wood, actorId);
  }
  placePiece(upperCell, upFace, 'ceiling', 'wood', upFace, actorId);
  placePiece(lowerCell, floorFace, 'foundation', 'wood', upFace, actorId);
  for (const cell of [lowerCell, upperCell]) {
    for (const face of wallFaces) {
      placePiece(cell, face, 'wall', 'wood', upFace, actorId);
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
