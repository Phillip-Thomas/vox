export interface ServerWorldCoordinate {
  x: number;
  y: number;
}

export type ServerPlanetSlot = 0 | 1 | 2;

export interface ServerWorldAddress extends ServerWorldCoordinate {
  slot: ServerPlanetSlot;
}

export type ServerCoord3 = [number, number, number];

export const WORLD_SEED_NAMESPACE = 'paravox:v1';
export const PLANET_SEED_NAMESPACE = 'paravox:planet:v1';
export const SERVER_PLANET_RADIUS = 25;
export const SERVER_CORE_RADIUS = SERVER_PLANET_RADIUS * 0.15;
export const SERVER_SURFACE_SHELL_DEPTH = 8;
const MAX_WORLD_COORDINATE_ABS = 1_000_000;
const WORLD_ID_PATTERN = /^(-?\d+),(-?\d+)(?::p([12]))?$/;

export function canonicalWorldId(value: string): string | null {
  const address = parseWorldId(value);
  if (!address) return null;
  const primaryId = `${address.x},${address.y}`;
  return address.slot === 0 ? primaryId : `${primaryId}:p${address.slot}`;
}

export function parseWorldId(value: string): ServerWorldAddress | null {
  const match = WORLD_ID_PATTERN.exec(value.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (Math.abs(x) > MAX_WORLD_COORDINATE_ABS || Math.abs(y) > MAX_WORLD_COORDINATE_ABS) return null;
  const slot = match[3] === undefined ? 0 : Number(match[3]) as ServerPlanetSlot;
  return { x, y, slot };
}

export function coordinateToSeed(x: number, y: number): number {
  const hash = fnv1a32(`${WORLD_SEED_NAMESPACE}:${Math.trunc(x)}:${Math.trunc(y)}`);
  return hash === 0 ? 1 : hash;
}

export function addressToSeed(address: ServerWorldAddress): number {
  if (address.slot === 0) return coordinateToSeed(address.x, address.y);
  const hash = fnv1a32(
    `${PLANET_SEED_NAMESPACE}:${Math.trunc(address.x)}:${Math.trunc(address.y)}:${address.slot}`
  );
  return hash === 0 ? 1 : hash;
}

export function seedForWorldId(worldId: string): number | null {
  const address = parseWorldId(worldId);
  return address ? addressToSeed(address) : null;
}

export function isTerrainCoordInBounds(coord: ServerCoord3): boolean {
  return coord.every(value => Math.abs(value) <= SERVER_PLANET_RADIUS);
}

export function isCollectibleCoordPlausible(coord: ServerCoord3): boolean {
  return isTerrainCoordInBounds(coord) && distanceFromCenter(coord) > SERVER_CORE_RADIUS;
}

/** Cheap authoritative surface bound for deterministic ground collectibles.
 * Terrain height varies by seed, but real surface nodes always live in this
 * outer cube shell; interior coordinates cannot mint surface resources. */
export function isCollectibleSurfaceCoordPlausible(coord: ServerCoord3): boolean {
  return isCollectibleCoordPlausible(coord)
    && Math.max(Math.abs(coord[0]), Math.abs(coord[1]), Math.abs(coord[2]))
      >= SERVER_PLANET_RADIUS - SERVER_SURFACE_SHELL_DEPTH;
}

export function sameCoord(a: ServerCoord3, b: ServerCoord3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function distanceFromCenter(coord: ServerCoord3): number {
  return Math.sqrt(coord[0] * coord[0] + coord[1] * coord[1] + coord[2] * coord[2]);
}

function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
