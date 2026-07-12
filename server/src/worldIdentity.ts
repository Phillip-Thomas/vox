import {
  addressToSeed,
  canonicalWorldId,
  parseWorldId,
  type ServerPlanetSlot
} from './worldAuthority.js';

export interface WorldMetadata {
  worldId: string;
  coordinateX: number;
  coordinateY: number;
  planetSlot: ServerPlanetSlot;
  seed: number;
  generationSchemaVersion: number;
}

const GENERATION_SCHEMA_VERSION = 1;

export function metadataForWorldId(worldId: string): WorldMetadata {
  const address = parseWorldId(worldId);
  const canonicalId = canonicalWorldId(worldId);
  if (!address || !canonicalId) {
    throw new Error(`Invalid world ID: ${worldId}`);
  }
  return {
    worldId: canonicalId,
    coordinateX: address.x,
    coordinateY: address.y,
    planetSlot: address.slot,
    seed: addressToSeed(address),
    generationSchemaVersion: GENERATION_SCHEMA_VERSION
  };
}
