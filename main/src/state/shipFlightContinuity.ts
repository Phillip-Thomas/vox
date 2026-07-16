import {
  buildStarSystemManifest,
  parsePlanetWorldId,
  planetWorldId,
  type PlanetDescriptor,
  type SystemCoordinate
} from '../game/starSystem.ts';
import {
  getShipRestorationSnapshot,
  hydrateShipRestorationState,
  setShipRestorationLocation,
  type ShipPose,
  type ShipRestorationState
} from '../game/systems/shipRestoration.ts';
import type { CurrentWorld } from '../utils/worldCoordinates.ts';
import { coordinateKey } from '../utils/worldCoordinates.ts';
import { restoreFlightAtLocation } from './spaceFlight.ts';
import {
  getSystemFlightSnapshot,
  planetLocalPoseToSystemPose,
  resetSystemFlightForInterstellarArrival,
  systemPoseToPlanetLocalPose,
  type SystemShipPose,
  type SystemVectorTuple
} from './systemFlight.ts';

export interface ShipFlightWorldContext {
  readonly system: SystemCoordinate;
  readonly systemId: string;
  readonly worldId: string;
  readonly systemPosition: SystemVectorTuple;
  readonly layoutVersion: number;
}

export interface ShipFlightRestoreResult {
  readonly restored: boolean;
  readonly locationMode: ShipRestorationState['locationMode'] | null;
}

export interface PersistShipFlightLocationInput extends ShipFlightWorldContext {
  readonly locationMode: ShipRestorationState['locationMode'];
  /** Planet-local parked pose. Undefined retains a pose only on the same world. */
  readonly parkedPose?: ShipPose | null;
}

/** Resolve the canonical descriptor without allowing a p1/p2 save to collapse to p0. */
export function shipFlightWorldContext(world: CurrentWorld): ShipFlightWorldContext | null {
  const address = parsePlanetWorldId(world.worldId);
  if (!address || planetWorldId(address) !== world.worldId) return null;
  const bodyCountOverride = (address.slot + 1) as 1 | 2 | 3;
  const manifest = buildStarSystemManifest(address.system, { bodyCountOverride });
  const descriptor = manifest.planets.find(planet => planet.worldId === world.worldId);
  return descriptor ? contextFromDescriptor(descriptor, manifest.layoutVersion) : null;
}

export function contextFromDescriptor(
  descriptor: PlanetDescriptor,
  layoutVersion: number
): ShipFlightWorldContext {
  return {
    system: { ...descriptor.coordinate },
    systemId: descriptor.systemId,
    worldId: descriptor.worldId,
    systemPosition: [...descriptor.systemPosition],
    layoutVersion
  };
}

/**
 * Return the world a structurally valid saved ship location belongs to. Callers
 * may use this to prefer an in-flight craft over a stale last-surface pointer.
 */
export function restorableShipWorldId(value: unknown): string | null {
  const restored = hydrateShipRestorationState(value);
  const address = restored.currentWorldId
    ? parsePlanetWorldId(restored.currentWorldId)
    : null;
  if (!address || planetWorldId(address) !== restored.currentWorldId) return null;
  if (coordinateKey(address.system) !== restored.currentSystemId) return null;
  const hasRequiredPose = restored.locationMode === 'surface'
    ? restored.parkedPose !== null || restored.systemPose !== null
    : restored.systemPose !== null;
  return hasRequiredPose ? restored.currentWorldId : null;
}

/**
 * Restore live flight stores only when the saved system and planet identities
 * exactly match the world being mounted. A surface save may reconstruct its
 * system pose from the planet-local parked pose; airborne saves require the
 * canonical system-space pose and never fall back to an arrival pad.
 */
export function restoreShipFlightForWorld(
  context: ShipFlightWorldContext,
  restored: ShipRestorationState = getShipRestorationSnapshot()
): ShipFlightRestoreResult {
  if (
    restored.currentSystemId !== context.systemId
    || restored.currentWorldId !== context.worldId
  ) return { restored: false, locationMode: null };

  const pose = resolveSystemPose(context, restored);
  if (!pose) return { restored: false, locationMode: null };

  resetSystemFlightForInterstellarArrival({
    system: context.system,
    layoutVersion: context.layoutVersion,
    locationMode: restored.locationMode,
    activePlanetId: context.worldId,
    pose,
    renderOrigin: context.systemPosition
  });
  restoreFlightAtLocation(restored.locationMode);
  return { restored: true, locationMode: restored.locationMode };
}

/** Planet-local parked pose, cloned and identity-scoped for a scene mount. */
export function persistedParkedShipPose(
  context: Pick<ShipFlightWorldContext, 'systemId' | 'worldId'>,
  restored: ShipRestorationState = getShipRestorationSnapshot()
): ShipPose | null {
  if (
    restored.currentSystemId !== context.systemId
    || restored.currentWorldId !== context.worldId
    || !restored.parkedPose
  ) return null;
  return clonePose(restored.parkedPose);
}

/**
 * Capture a real surface/atmosphere/local-space boundary from the canonical live
 * system pose. Changing planets clears the previous world's local parked pose;
 * staying on one planet retains it until a new touchdown supplies a replacement.
 */
export function persistShipFlightLocation(input: PersistShipFlightLocationInput): boolean {
  const live = getSystemFlightSnapshot();
  if (live.systemId !== input.systemId || live.activePlanetId !== input.worldId) return false;

  const previous = getShipRestorationSnapshot();
  const sameWorld = previous.currentSystemId === input.systemId
    && previous.currentWorldId === input.worldId;
  let parkedPose = input.parkedPose === undefined
    ? (sameWorld ? previous.parkedPose : null)
    : input.parkedPose;

  if (input.locationMode === 'surface' && !parkedPose) {
    const local = systemPoseToPlanetLocalPose(live.pose, input.systemPosition);
    parkedPose = {
      position: mutableVector(local.position),
      quaternion: mutableQuaternion(local.quaternion)
    };
  }

  setShipRestorationLocation({
    currentSystemId: input.systemId,
    currentWorldId: input.worldId,
    parkedPose: parkedPose ? clonePose(parkedPose) : null,
    systemPose: {
      position: mutableVector(live.pose.position),
      quaternion: mutableQuaternion(live.pose.quaternion),
      velocity: mutableVector(live.pose.velocity)
    },
    locationMode: input.locationMode
  });
  return true;
}

function resolveSystemPose(
  context: ShipFlightWorldContext,
  restored: ShipRestorationState
): SystemShipPose | null {
  if (restored.systemPose) {
    return {
      position: [...restored.systemPose.position],
      velocity: [...restored.systemPose.velocity],
      quaternion: [...restored.systemPose.quaternion]
    };
  }
  if (restored.locationMode !== 'surface' || !restored.parkedPose) return null;
  return planetLocalPoseToSystemPose({
    position: [...restored.parkedPose.position],
    velocity: [0, 0, 0],
    quaternion: [...restored.parkedPose.quaternion]
  }, context.systemPosition);
}

function clonePose(pose: ShipPose): ShipPose {
  return {
    position: [...pose.position],
    quaternion: [...pose.quaternion]
  };
}

function mutableVector(value: readonly [number, number, number]): [number, number, number] {
  return [value[0], value[1], value[2]];
}

function mutableQuaternion(
  value: readonly [number, number, number, number]
): [number, number, number, number] {
  return [value[0], value[1], value[2], value[3]];
}
