import { describe, expect, it } from 'vitest';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';
import { createWorldIdentity, sameWorldIdentity, worldIdentityFromCurrentWorld } from './worldIdentity.ts';
import { coordinateToSeed, createCurrentWorld } from '../utils/worldCoordinates.ts';

describe('world identity', () => {
  it('uses coordinate key as durable world id and seed as generation metadata', () => {
    const identity = createWorldIdentity({ x: 4.8, y: -2.2 });

    expect(identity.worldId).toBe('4,-2');
    expect(identity.coordinate).toEqual({ x: 4, y: -2 });
    expect(identity.seed).toBe(coordinateToSeed(4, -2));
    expect(identity.generationSchemaVersion).toBe(GENERATION_SCHEMA_VERSION);
  });

  it('upgrades a current world to full identity', () => {
    const current = createCurrentWorld({ x: 1, y: 3 });
    expect(worldIdentityFromCurrentWorld(current)).toEqual({
      ...current,
      generationSchemaVersion: GENERATION_SCHEMA_VERSION
    });
  });

  it('compares by world id only', () => {
    expect(sameWorldIdentity(createWorldIdentity({ x: 0, y: 0 }), createWorldIdentity({ x: 0, y: 0 }))).toBe(true);
    expect(sameWorldIdentity(createWorldIdentity({ x: 0, y: 0 }), createWorldIdentity({ x: 1, y: 0 }))).toBe(false);
  });
});
