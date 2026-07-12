import { useSyncExternalStore } from 'react';
import {
  SYSTEM_LAYOUT_VERSION,
  canonicalPlanetWorldId,
  normalizePlanetAddress,
  parsePlanetWorldId,
  planetWorldId,
  type PlanetAddress,
  type SystemCoordinate
} from '../game/starSystem.ts';
import { coordinateKey, normalizeCoordinate, sameSystemCoordinate } from '../utils/worldCoordinates.ts';

export type SystemLocationMode = 'surface' | 'atmosphere' | 'local_space' | 'system_cruise';
export type SystemVectorTuple = readonly [number, number, number];
export type SystemQuaternionTuple = readonly [number, number, number, number];

export interface SystemShipPose {
  readonly position: SystemVectorTuple;
  readonly velocity: SystemVectorTuple;
  readonly quaternion: SystemQuaternionTuple;
}

export type SystemFlightTarget =
  | {
      readonly kind: 'system_body';
      readonly address: PlanetAddress;
      readonly worldId: string;
    }
  | {
      readonly kind: 'star_system';
      readonly coordinate: SystemCoordinate;
      readonly systemId: string;
    };

export interface SystemFlightSnapshot {
  readonly systemId: string;
  readonly layoutVersion: number;
  readonly locationMode: SystemLocationMode;
  readonly activePlanetId: string | null;
  readonly lastActivePlanetId: string | null;
  readonly pose: SystemShipPose;
  readonly target: SystemFlightTarget | null;
  readonly renderOrigin: SystemVectorTuple;
  readonly activationEpoch: number;
}

export interface SystemPoseWriterLease {
  readonly owner: string;
  readonly leaseId: number;
}

export interface InterstellarSystemReset {
  system: SystemCoordinate;
  layoutVersion?: number;
  locationMode?: SystemLocationMode;
  activePlanetId?: string | null;
  pose: SystemShipPose;
  renderOrigin?: SystemVectorTuple;
}

type Listener = () => void;

const ZERO_VECTOR: SystemVectorTuple = Object.freeze([0, 0, 0]);
const IDENTITY_QUATERNION: SystemQuaternionTuple = Object.freeze([0, 0, 0, 1]);

let snapshot = initialSnapshot();
// Pose writes are intentionally not React-published every frame. Boundary actions
// copy the current live snapshot here before notifying useSyncExternalStore.
let reactSnapshot = snapshot;
let activePoseWriter: SystemPoseWriterLease | null = null;
let nextLeaseId = 1;
const listeners = new Set<Listener>();

export function getSystemFlightSnapshot(): SystemFlightSnapshot {
  return snapshot;
}

export function subscribeSystemFlight(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSystemFlight(): SystemFlightSnapshot {
  return useSyncExternalStore(subscribeSystemFlight, getReactSnapshot, getReactSnapshot);
}

/**
 * Acquire the sole authority allowed to publish continuous ship poses. A second
 * controller cannot write until the current lease is explicitly released or an
 * interstellar reset invalidates it.
 */
export function acquireSystemPoseWriter(owner: string): SystemPoseWriterLease | null {
  if (activePoseWriter) return null;
  const lease = Object.freeze({ owner, leaseId: nextLeaseId++ });
  activePoseWriter = lease;
  return lease;
}

export function releaseSystemPoseWriter(lease: SystemPoseWriterLease): boolean {
  if (activePoseWriter !== lease) return false;
  activePoseWriter = null;
  return true;
}

/**
 * Per-frame pose publication. This replaces the immutable live snapshot without
 * notifying React; render/network loops read it through getSystemFlightSnapshot().
 */
export function updateSystemShipPose(
  lease: SystemPoseWriterLease,
  pose: SystemShipPose
): boolean {
  if (activePoseWriter !== lease) return false;
  snapshot = freezeSnapshot({ ...snapshot, pose: freezePose(pose) });
  return true;
}

/** Hot-path publication from a planet-local controller without an intermediate frozen pose. */
export function updateSystemShipPoseFromPlanetLocal(
  lease: SystemPoseWriterLease,
  pose: SystemShipPose,
  planetSystemPosition: SystemVectorTuple
): boolean {
  if (activePoseWriter !== lease) return false;
  return updateSystemShipPose(lease, {
    position: [
      pose.position[0] + planetSystemPosition[0],
      pose.position[1] + planetSystemPosition[1],
      pose.position[2] + planetSystemPosition[2]
    ],
    velocity: pose.velocity,
    quaternion: pose.quaternion
  });
}

export function setSystemLocationMode(locationMode: SystemLocationMode): void {
  if (snapshot.locationMode === locationMode) return;
  publishBoundary({ ...snapshot, locationMode });
}

export function setActiveSystemPlanet(worldId: string | null): number {
  if (worldId) assertPlanetBelongsToSystem(worldId, snapshot.systemId);
  if (snapshot.activePlanetId === worldId) return snapshot.activationEpoch;
  const activationEpoch = snapshot.activationEpoch + 1;
  publishBoundary({
    ...snapshot,
    activePlanetId: worldId,
    lastActivePlanetId: worldId ?? snapshot.lastActivePlanetId,
    activationEpoch
  });
  return activationEpoch;
}

/** A render rebase never touches canonical ship pose or activation state. */
export function rebaseSystemRenderOrigin(renderOrigin: SystemVectorTuple): void {
  const nextOrigin = freezeVector(renderOrigin);
  if (sameVector(snapshot.renderOrigin, nextOrigin)) return;
  publishBoundary({ ...snapshot, renderOrigin: nextOrigin });
}

export function commitSystemBodyTarget(address: PlanetAddress): number {
  const normalized = normalizePlanetAddress(address);
  if (coordinateKey(normalized.system) !== snapshot.systemId) {
    throw new Error('System-body target must belong to the current star system.');
  }
  const activationEpoch = snapshot.activationEpoch + 1;
  const target = freezeTarget({
    kind: 'system_body',
    address: normalized,
    worldId: planetWorldId(normalized)
  });
  publishBoundary({ ...snapshot, target, activationEpoch });
  return activationEpoch;
}

export function commitInterstellarTarget(coordinate: SystemCoordinate): number {
  const normalized = normalizeCoordinate(coordinate);
  if (coordinateKey(normalized) === snapshot.systemId) {
    throw new Error('Interstellar target must identify a different star system.');
  }
  const activationEpoch = snapshot.activationEpoch + 1;
  const target = freezeTarget({
    kind: 'star_system',
    coordinate: normalized,
    systemId: coordinateKey(normalized)
  });
  publishBoundary({ ...snapshot, target, activationEpoch });
  return activationEpoch;
}

/** Explicit cancellation advances the epoch so in-flight preparation becomes stale. */
export function cancelSystemTarget(): number {
  const activationEpoch = snapshot.activationEpoch + 1;
  publishBoundary({ ...snapshot, target: null, activationEpoch });
  return activationEpoch;
}

/**
 * The only boundary action allowed to replace canonical system position without a
 * pose-writer lease. Interstellar travel enters an unrelated coordinate frame, so
 * it also revokes the old system's writer token and invalidates pending activation.
 */
export function resetSystemFlightForInterstellarArrival(input: InterstellarSystemReset): number {
  const coordinate = normalizeCoordinate(input.system);
  const activePlanetId = input.activePlanetId ?? null;
  const systemId = coordinateKey(coordinate);
  if (activePlanetId) assertPlanetBelongsToSystem(activePlanetId, systemId);
  activePoseWriter = null;
  const activationEpoch = snapshot.activationEpoch + 1;
  publishBoundary({
    systemId,
    layoutVersion: input.layoutVersion ?? SYSTEM_LAYOUT_VERSION,
    locationMode: input.locationMode ?? 'local_space',
    activePlanetId,
    lastActivePlanetId: activePlanetId,
    pose: freezePose(input.pose),
    target: null,
    renderOrigin: freezeVector(input.renderOrigin ?? ZERO_VECTOR),
    activationEpoch
  });
  return activationEpoch;
}

export function planetLocalPoseToSystemPose(
  pose: SystemShipPose,
  planetSystemPosition: SystemVectorTuple
): SystemShipPose {
  return freezePose({
    position: addVectors(pose.position, planetSystemPosition),
    velocity: pose.velocity,
    quaternion: pose.quaternion
  });
}

export function systemPoseToPlanetLocalPose(
  pose: SystemShipPose,
  planetSystemPosition: SystemVectorTuple
): SystemShipPose {
  return freezePose({
    position: subtractVectors(pose.position, planetSystemPosition),
    velocity: pose.velocity,
    quaternion: pose.quaternion
  });
}

/** Project one canonical system-space point into the current render frame. */
export function projectSystemPosition(
  systemPosition: SystemVectorTuple,
  renderOrigin: SystemVectorTuple = snapshot.renderOrigin
): SystemVectorTuple {
  return freezeVector(subtractVectors(systemPosition, renderOrigin));
}

/** Test-only reset; production discontinuities must use the interstellar reset. */
export function resetSystemFlightStoreForTests(): void {
  snapshot = initialSnapshot();
  reactSnapshot = snapshot;
  activePoseWriter = null;
  nextLeaseId = 1;
  emit();
}

function initialSnapshot(): SystemFlightSnapshot {
  return freezeSnapshot({
    systemId: '0,0',
    layoutVersion: SYSTEM_LAYOUT_VERSION,
    locationMode: 'surface',
    activePlanetId: '0,0',
    lastActivePlanetId: '0,0',
    pose: freezePose({
      position: ZERO_VECTOR,
      velocity: ZERO_VECTOR,
      quaternion: IDENTITY_QUATERNION
    }),
    target: null,
    renderOrigin: ZERO_VECTOR,
    activationEpoch: 0
  });
}

function getReactSnapshot(): SystemFlightSnapshot {
  return reactSnapshot;
}

function publishBoundary(next: SystemFlightSnapshot): void {
  snapshot = freezeSnapshot(next);
  reactSnapshot = snapshot;
  emit();
}

function emit(): void {
  listeners.forEach(listener => listener());
}

function freezeSnapshot(value: SystemFlightSnapshot): SystemFlightSnapshot {
  return Object.freeze(value);
}

function freezePose(value: SystemShipPose): SystemShipPose {
  return Object.freeze({
    position: freezeVector(value.position),
    velocity: freezeVector(value.velocity),
    quaternion: freezeQuaternion(value.quaternion)
  });
}

function freezeTarget(value: SystemFlightTarget): SystemFlightTarget {
  if (value.kind === 'system_body') {
    const system = Object.freeze({ ...value.address.system });
    const address = Object.freeze({ system, slot: value.address.slot }) as PlanetAddress;
    return Object.freeze({ ...value, address });
  }
  return Object.freeze({
    ...value,
    coordinate: Object.freeze({ ...value.coordinate }) as SystemCoordinate
  });
}

function freezeVector(value: SystemVectorTuple): SystemVectorTuple {
  assertFinite(value, 3, 'vector');
  return Object.freeze([value[0], value[1], value[2]]);
}

function freezeQuaternion(value: SystemQuaternionTuple): SystemQuaternionTuple {
  assertFinite(value, 4, 'quaternion');
  return Object.freeze([value[0], value[1], value[2], value[3]]);
}

function assertFinite(value: readonly number[], size: number, label: string): void {
  if (value.length !== size || value.some(component => !Number.isFinite(component))) {
    throw new Error(`System-flight ${label} must contain ${size} finite numbers.`);
  }
}

function addVectors(a: SystemVectorTuple, b: SystemVectorTuple): SystemVectorTuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVectors(a: SystemVectorTuple, b: SystemVectorTuple): SystemVectorTuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function sameVector(a: SystemVectorTuple, b: SystemVectorTuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function assertPlanetBelongsToSystem(worldId: string, systemId: string): void {
  const address = parsePlanetWorldId(worldId);
  if (!address || canonicalPlanetWorldId(worldId) !== worldId) {
    throw new Error('Active planet ID must be canonical.');
  }
  if (coordinateKey(address.system) !== systemId) {
    throw new Error('Active planet must belong to the current star system.');
  }
}

export { sameSystemCoordinate };
