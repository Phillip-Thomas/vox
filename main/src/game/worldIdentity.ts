import { coordinateKey, createCurrentWorld, type CurrentWorld, type WorldCoordinate } from '../utils/worldCoordinates.ts';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';

export interface WorldIdentity extends CurrentWorld {
  generationSchemaVersion: number;
}

export function createWorldIdentity(
  coordinate: WorldCoordinate,
  generationSchemaVersion = GENERATION_SCHEMA_VERSION
): WorldIdentity {
  return {
    ...createCurrentWorld(coordinate),
    generationSchemaVersion
  };
}

export function worldIdentityFromCurrentWorld(
  world: CurrentWorld,
  generationSchemaVersion = GENERATION_SCHEMA_VERSION
): WorldIdentity {
  return {
    ...world,
    worldId: world.worldId ?? coordinateKey(world.coordinate),
    generationSchemaVersion
  };
}

export function sameWorldIdentity(a: Pick<WorldIdentity, 'worldId'>, b: Pick<WorldIdentity, 'worldId'>): boolean {
  return a.worldId === b.worldId;
}
