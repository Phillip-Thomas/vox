import {
  coordinateKey,
  coordinateToSeed,
  fnv1a32,
  normalizeCoordinate,
  sameSystemCoordinate,
  seededUnit,
  type WorldCoordinate
} from '../utils/worldCoordinates.ts';
import { createWorldIdentity, type WorldIdentity } from './worldIdentity.ts';

/** A legacy galaxy coordinate now names a star system. */
export type SystemCoordinate = WorldCoordinate;
export type PlanetSlot = 0 | 1 | 2;
export type Vec3Tuple = [number, number, number];
export type QuaternionTuple = [number, number, number, number];

export interface PlanetAddress {
  system: SystemCoordinate;
  slot: PlanetSlot;
}

export interface PlanetIdentity extends WorldIdentity {
  systemId: string;
  address: PlanetAddress;
  planetIdentityVersion: number;
}

export interface PlanetDescriptor extends PlanetIdentity {
  systemPosition: Vec3Tuple;
  /** Existing terrain is never rotated during the identity migration. */
  terrainQuaternion: QuaternionTuple;
  /** Nominal center-to-face radius in rendered world units. */
  nominalFaceRadius: number;
  /** Spherical bound enclosing cube corners, terrain, and water bulges. */
  surfaceBoundRadius: number;
}

export interface StarProfile {
  seed: number;
  hue: number;
  intensity: number;
}

export interface StarSystemManifest {
  systemId: string;
  coordinate: SystemCoordinate;
  systemSeed: number;
  layoutVersion: number;
  planetIdentityVersion: number;
  star: StarProfile;
  planets: PlanetDescriptor[];
}

export interface BuildStarSystemOptions {
  /** Story and authored fixtures can retain a strict one-body system. */
  forceSingleBody?: boolean;
  /** Deterministic visual/test fixtures may request a specific valid body count. */
  bodyCountOverride?: 1 | 2 | 3;
}

/**
 * Planet identity and layout have deliberately separate versions. Planet identity
 * is durable save data; layout may evolve without changing a planet's terrain.
 */
export const PLANET_IDENTITY_VERSION = 1;
export const SYSTEM_LAYOUT_VERSION = 1;

/** Frozen durable namespace. Never change this for existing p1/p2 world IDs. */
export const SECONDARY_PLANET_SEED_NAMESPACE = 'paravox:planet:v1';
/** Layout-only namespace. A future layout version must not alter planet seeds. */
export const SYSTEM_LAYOUT_SEED_NAMESPACE = 'paravox:system-layout:v1';

export const NOMINAL_PLANET_FACE_RADIUS = 50;
export const PLANET_SURFACE_BOUND_RADIUS = 89;
export const MIN_PLANET_CENTER_SEPARATION = 2_000;
export const MAX_COMPANION_DISTANCE_FROM_PRIMARY = 4_800;
export const MAX_SYSTEM_COORDINATE_ABS = 1_000_000;

const IDENTITY_TERRAIN_QUATERNION: QuaternionTuple = [0, 0, 0, 1];
const BODY_COUNT_SALT = 17;

export function normalizePlanetAddress(address: PlanetAddress): PlanetAddress {
  return {
    system: normalizeCoordinate(address.system),
    slot: address.slot
  };
}

export function planetWorldId(address: PlanetAddress): string {
  const normalized = normalizePlanetAddress(address);
  const systemId = coordinateKey(normalized.system);
  return normalized.slot === 0 ? systemId : `${systemId}:p${normalized.slot}`;
}

export function planetSeedForAddress(address: PlanetAddress): number {
  const normalized = normalizePlanetAddress(address);
  if (normalized.slot === 0) {
    return coordinateToSeed(normalized.system.x, normalized.system.y);
  }
  return nonZeroHash(
    `${SECONDARY_PLANET_SEED_NAMESPACE}:${normalized.system.x}:${normalized.system.y}:${normalized.slot}`
  );
}

export function createPlanetIdentity(address: PlanetAddress): PlanetIdentity {
  const normalized = normalizePlanetAddress(address);
  const legacyIdentity = createWorldIdentity(normalized.system);
  return {
    ...legacyIdentity,
    worldId: planetWorldId(normalized),
    seed: planetSeedForAddress(normalized),
    systemId: coordinateKey(normalized.system),
    address: normalized,
    planetIdentityVersion: PLANET_IDENTITY_VERSION
  };
}

export function parsePlanetWorldId(worldId: string): PlanetAddress | null {
  const match = /^(-?\d+),(-?\d+)(?::p([12]))?$/.exec(worldId.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (Math.abs(x) > MAX_SYSTEM_COORDINATE_ABS || Math.abs(y) > MAX_SYSTEM_COORDINATE_ABS) return null;
  const slot = match[3] ? Number(match[3]) as PlanetSlot : 0;
  return { system: { x, y }, slot };
}

export function canonicalPlanetWorldId(worldId: string): string | null {
  const address = parsePlanetWorldId(worldId);
  return address ? planetWorldId(address) : null;
}

export function samePlanetAddress(a: PlanetAddress, b: PlanetAddress): boolean {
  return a.slot === b.slot && sameSystemCoordinate(a.system, b.system);
}

type PlanetWorldRef = string | Pick<PlanetIdentity, 'worldId'>;

export function samePlanetWorldId(a: PlanetWorldRef, b: PlanetWorldRef): boolean {
  return worldIdOf(a) === worldIdOf(b);
}

export function buildStarSystemManifest(
  coordinate: SystemCoordinate,
  options: BuildStarSystemOptions = {}
): StarSystemManifest {
  const system = normalizeCoordinate(coordinate);
  const systemId = coordinateKey(system);
  const systemSeed = nonZeroHash(`${SYSTEM_LAYOUT_SEED_NAMESPACE}:${system.x}:${system.y}`);
  const planetCount = options.forceSingleBody
    ? 1
    : options.bodyCountOverride ?? planetCountForSystemSeed(systemSeed);
  const planets: PlanetDescriptor[] = [];

  for (let slot = 0; slot < planetCount; slot++) {
    const address: PlanetAddress = { system, slot: slot as PlanetSlot };
    planets.push({
      ...createPlanetIdentity(address),
      systemPosition: systemPositionForSlot(systemSeed, slot as PlanetSlot),
      terrainQuaternion: [...IDENTITY_TERRAIN_QUATERNION],
      nominalFaceRadius: NOMINAL_PLANET_FACE_RADIUS,
      surfaceBoundRadius: PLANET_SURFACE_BOUND_RADIUS
    });
  }

  return {
    systemId,
    coordinate: system,
    systemSeed,
    layoutVersion: SYSTEM_LAYOUT_VERSION,
    planetIdentityVersion: PLANET_IDENTITY_VERSION,
    star: {
      seed: nonZeroHash(`${SYSTEM_LAYOUT_SEED_NAMESPACE}:star:${system.x}:${system.y}`),
      hue: 0.06 + seededUnit(systemSeed, 701) * 0.1,
      intensity: 0.9 + seededUnit(systemSeed, 709) * 0.35
    },
    planets
  };
}

function planetCountForSystemSeed(systemSeed: number): 1 | 2 | 3 {
  const roll = seededUnit(systemSeed, BODY_COUNT_SALT);
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

function systemPositionForSlot(systemSeed: number, slot: PlanetSlot): Vec3Tuple {
  if (slot === 0) return [0, 0, 0];

  const azimuth = seededUnit(systemSeed, 101) * Math.PI * 2;
  const elevation = (seededUnit(systemSeed, 103) - 0.5) * 0.36;
  const primaryDirection = directionFromAngles(azimuth, elevation);

  if (slot === 1) {
    const radius = 2_200 + seededUnit(systemSeed, 107) * 1_100;
    return quantizedPosition(primaryDirection, radius);
  }

  // Keep the third body nearly opposite p1. This constructively guarantees the
  // pairwise separation instead of relying on retry loops or probabilistic tests.
  const tangent: Vec3Tuple = [-primaryDirection[2], 0, primaryDirection[0]];
  const tangentLength = Math.hypot(tangent[0], tangent[2]);
  tangent[0] /= tangentLength;
  tangent[2] /= tangentLength;
  const offset = 0.12 + seededUnit(systemSeed, 109) * 0.16;
  const direction: Vec3Tuple = [
    -primaryDirection[0] * Math.cos(offset) + tangent[0] * Math.sin(offset),
    -primaryDirection[1] * Math.cos(offset),
    -primaryDirection[2] * Math.cos(offset) + tangent[2] * Math.sin(offset)
  ];
  const normalized = normalizeTuple(direction);
  const radius = 3_400 + seededUnit(systemSeed, 113) * 1_200;
  return quantizedPosition(normalized, radius);
}

function directionFromAngles(azimuth: number, elevation: number): Vec3Tuple {
  const horizontal = Math.cos(elevation);
  return [
    Math.cos(azimuth) * horizontal,
    Math.sin(elevation),
    Math.sin(azimuth) * horizontal
  ];
}

function normalizeTuple(value: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function quantizedPosition(direction: Vec3Tuple, radius: number): Vec3Tuple {
  return [
    Math.round(direction[0] * radius),
    Math.round(direction[1] * radius),
    Math.round(direction[2] * radius)
  ];
}

function nonZeroHash(value: string): number {
  const hash = fnv1a32(value);
  return hash === 0 ? 1 : hash;
}

function worldIdOf(value: PlanetWorldRef): string {
  return typeof value === 'string' ? value : value.worldId;
}

export { sameSystemCoordinate } from '../utils/worldCoordinates.ts';
