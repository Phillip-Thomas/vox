import { describe, expect, it } from 'vitest';
import {
  sharedMutationClaimForCommand,
  sharedMutationValidationError
} from '../src/commandAuthority.js';
import { resolveServerCanonicalCommandPayload } from '../src/economyAuthority.js';

describe('resource authority', () => {
  it('derives one stable claim from source + integer voxel coord, never client yield fields', () => {
    const forged = {
      source: 'tree',
      coord: [2, 2, 3],
      id: 'void_glass',
      qty: 999
    };
    const canonical = resolveServerCanonicalCommandPayload(
      'resource_taken',
      forged,
      { worldId: '0,0' }
    );

    expect(canonical).not.toBeNull();
    expect(canonical).not.toHaveProperty('code');
    if (!canonical || 'code' in canonical) return;

    expect(canonical.commandPayload).toMatchObject({
      source: 'tree',
      coord: [2, 2, 3],
      id: 'wood'
    });
    expect(canonical.commandPayload.qty).toEqual(expect.any(Number));
    expect(canonical.commandPayload.qty).not.toBe(forged.qty);

    const forgedClaim = sharedMutationClaimForCommand('resource_taken', forged);
    const canonicalClaim = sharedMutationClaimForCommand(
      'resource_taken',
      canonical.commandPayload
    );
    expect(canonicalClaim).toEqual(forgedClaim);
    expect(canonicalClaim).toMatchObject({
      kind: 'resource_taken',
      coord: [2, 2, 3]
    });

    const otherTree = sharedMutationClaimForCommand('resource_taken', {
      source: 'tree',
      coord: [2, 2, 4]
    });
    const stoneAtSameCoord = sharedMutationClaimForCommand('resource_taken', {
      source: 'loose_stone',
      coord: [2, 2, 3]
    });
    expect(otherTree?.key).not.toBe(canonicalClaim?.key);
    expect(stoneAtSameCoord?.key).not.toBe(canonicalClaim?.key);
  });

  it.each([
    { source: 'tree', coord: [2, 2] },
    { source: 'tree', coord: [2, 2.5, 3] },
    { source: 'tree', coord: ['2', 2, 3] },
    { source: 'unknown', coord: [2, 2, 3] },
    { coord: [2, 2, 3] }
  ])('rejects malformed tree claim payload %#', payload => {
    expect(sharedMutationClaimForCommand('resource_taken', payload)).toBeNull();
    expect(sharedMutationValidationError('resource_taken', payload)).toContain(
      'Malformed resource_taken payload'
    );
  });

  it.each([
    { kind: 'cactus', id: 'cactus_pulp', min: 1, max: 2 },
    { kind: 'fan', id: 'fan_frond', min: 1, max: 2 },
    { kind: 'flower', id: 'wild_bloom', min: 1, max: 2 },
    { kind: 'seedhead', id: 'seedpod', min: 2, max: 3 },
    { kind: 'shrub', id: 'berry', min: 1, max: 2 }
  ])('canonicalizes forged $kind flora yields to $id', ({ kind, id, min, max }) => {
    const forged = {
      source: 'flora',
      kind,
      coord: [4, 24, -3],
      id: 'void_glass',
      qty: 999
    };
    const first = resolveServerCanonicalCommandPayload(
      'resource_taken',
      forged,
      { worldId: '2,-1:p1' }
    );
    const second = resolveServerCanonicalCommandPayload(
      'resource_taken',
      forged,
      { worldId: '2,-1:p1' }
    );

    expect(first).not.toBeNull();
    expect(first).not.toHaveProperty('code');
    expect(second).toEqual(first);
    if (!first || 'code' in first) return;

    expect(first.commandPayload).toMatchObject({
      source: 'flora',
      kind,
      coord: [4, 24, -3],
      id
    });
    expect(first.commandPayload.qty).toEqual(expect.any(Number));
    expect(first.commandPayload.qty).toBeGreaterThanOrEqual(min);
    expect(first.commandPayload.qty).toBeLessThanOrEqual(max);
    expect(first.commandPayload.qty).not.toBe(forged.qty);
  });

  it('rejects an unknown flora kind before inventory credit', () => {
    expect(resolveServerCanonicalCommandPayload(
      'resource_taken',
      { source: 'flora', kind: 'void_orchid', coord: [4, 24, -3], id: 'void_glass', qty: 999 },
      { worldId: '0,0' }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Flora harvest requires a known flora kind.'
    });
  });

  it('uses one flora mutation claim per coordinate regardless of submitted kind', () => {
    const flower = sharedMutationClaimForCommand('resource_taken', {
      source: 'flora',
      kind: 'flower',
      coord: [4, 24, -3]
    });
    const shrub = sharedMutationClaimForCommand('resource_taken', {
      source: 'flora',
      kind: 'shrub',
      coord: [4, 24, -3]
    });
    const otherCoord = sharedMutationClaimForCommand('resource_taken', {
      source: 'flora',
      kind: 'flower',
      coord: [5, 24, -3]
    });

    expect(flower).toEqual(shrub);
    expect(flower).toMatchObject({
      kind: 'resource_taken',
      key: 'collectible:flora:4,24,-3',
      collectibleType: 'flora',
      coord: [4, 24, -3]
    });
    expect(otherCoord?.key).not.toBe(flower?.key);
  });

  it('preserves legacy forage claim types while adding flora source claims', () => {
    expect(sharedMutationClaimForCommand('resource_taken', {
      source: 'forage',
      kind: 'berry',
      coord: [4, 24, -3]
    })).toMatchObject({
      key: 'collectible:forage:berry:4,24,-3',
      collectibleType: 'forage:berry'
    });
    expect(sharedMutationValidationError('resource_taken', {
      source: 'flora',
      kind: 'flower',
      coord: [4, 24, -3]
    })).toBeNull();
  });
});
