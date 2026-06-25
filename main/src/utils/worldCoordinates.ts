export interface WorldCoordinate {
  x: number;
  y: number;
}

export interface CurrentWorld {
  worldId: string;
  coordinate: WorldCoordinate;
  seed: number;
}

export const WORLD_SEED_NAMESPACE = 'paravox:v1';

export function normalizeCoordinatePart(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

export function normalizeCoordinate(coordinate: WorldCoordinate): WorldCoordinate {
  return {
    x: normalizeCoordinatePart(coordinate.x),
    y: normalizeCoordinatePart(coordinate.y)
  };
}

export function coordinateKey(coordinate: WorldCoordinate): string {
  const normalized = normalizeCoordinate(coordinate);
  return `${normalized.x},${normalized.y}`;
}

export function coordinatesEqual(a: WorldCoordinate, b: WorldCoordinate): boolean {
  return coordinateKey(a) === coordinateKey(b);
}

export function coordinateToSeed(x: number, y: number): number {
  const nx = normalizeCoordinatePart(x);
  const ny = normalizeCoordinatePart(y);
  const hash = fnv1a32(`${WORLD_SEED_NAMESPACE}:${nx}:${ny}`);
  return hash === 0 ? 1 : hash;
}

export function createCurrentWorld(coordinate: WorldCoordinate): CurrentWorld {
  const normalized = normalizeCoordinate(coordinate);
  return {
    worldId: coordinateKey(normalized),
    coordinate: normalized,
    seed: coordinateToSeed(normalized.x, normalized.y)
  };
}

export function seededUnit(seed: number, salt: number): number {
  let hash = Math.imul(seed | 0, 374761393) ^ Math.imul(salt | 0, 668265263);
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
