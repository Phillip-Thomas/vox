export interface ServerWorldCoordinate {
  x: number;
  y: number;
}

export type ServerCoord3 = [number, number, number];

export const WORLD_SEED_NAMESPACE = 'paravox:v1';
export const SERVER_PLANET_RADIUS = 25;
export const SERVER_CORE_RADIUS = SERVER_PLANET_RADIUS * 0.15;
const MAX_WORLD_COORDINATE_ABS = 1_000_000;
const WORLD_ID_PATTERN = /^(-?\d+),(-?\d+)$/;

export function canonicalWorldId(value: string): string | null {
  const coordinate = parseWorldId(value);
  return coordinate ? `${coordinate.x},${coordinate.y}` : null;
}

export function parseWorldId(value: string): ServerWorldCoordinate | null {
  const match = WORLD_ID_PATTERN.exec(value.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (Math.abs(x) > MAX_WORLD_COORDINATE_ABS || Math.abs(y) > MAX_WORLD_COORDINATE_ABS) return null;
  return { x, y };
}

export function coordinateToSeed(x: number, y: number): number {
  const hash = fnv1a32(`${WORLD_SEED_NAMESPACE}:${Math.trunc(x)}:${Math.trunc(y)}`);
  return hash === 0 ? 1 : hash;
}

export function seedForWorldId(worldId: string): number | null {
  const coordinate = parseWorldId(worldId);
  return coordinate ? coordinateToSeed(coordinate.x, coordinate.y) : null;
}

export function isTerrainCoordInBounds(coord: ServerCoord3): boolean {
  return coord.every(value => Math.abs(value) <= SERVER_PLANET_RADIUS);
}

export function isCollectibleCoordPlausible(coord: ServerCoord3): boolean {
  return isTerrainCoordInBounds(coord) && distanceFromCenter(coord) > SERVER_CORE_RADIUS;
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
