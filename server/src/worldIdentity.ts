export interface WorldMetadata {
  worldId: string;
  coordinateX: number;
  coordinateY: number;
  seed: number;
  generationSchemaVersion: number;
}

const WORLD_SEED_NAMESPACE = 'paravox:v1';
const GENERATION_SCHEMA_VERSION = 1;

export function metadataForWorldId(worldId: string): WorldMetadata {
  const [rawX, rawY] = worldId.split(',', 2);
  const coordinateX = normalizeCoordinatePart(Number(rawX));
  const coordinateY = normalizeCoordinatePart(Number(rawY));
  return {
    worldId: `${coordinateX},${coordinateY}`,
    coordinateX,
    coordinateY,
    seed: coordinateToSeed(coordinateX, coordinateY),
    generationSchemaVersion: GENERATION_SCHEMA_VERSION
  };
}

function normalizeCoordinatePart(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

function coordinateToSeed(x: number, y: number): number {
  const hash = fnv1a32(`${WORLD_SEED_NAMESPACE}:${x}:${y}`);
  return hash === 0 ? 1 : hash;
}

function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
