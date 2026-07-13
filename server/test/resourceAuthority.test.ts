import { describe, expect, it } from 'vitest';
import {
  sharedMutationClaimForCommand,
  sharedMutationValidationError
} from '../src/commandAuthority.js';
import {
  isAuthoritativeDeadwoodNode,
  resolveServerAuthoritativeCommand,
  resolveServerCanonicalCommandPayload
} from '../src/economyAuthority.js';

function findDeadwoodCoord(worldId: string): [number, number, number] {
  for (let x = -25; x <= 25; x++) {
    for (let y = -25; y <= 25; y++) {
      for (let z = -25; z <= 25; z++) {
        const coord: [number, number, number] = [x, y, z];
        if (isAuthoritativeDeadwoodNode(coord, worldId)) return coord;
      }
    }
  }
  throw new Error(`No authoritative deadwood coordinate found for ${worldId}`);
}

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

  it('uses one forage mutation claim per coordinate across every submitted kind', () => {
    const berry = sharedMutationClaimForCommand('resource_taken', {
      source: 'forage',
      kind: 'berry',
      coord: [4, 24, -3]
    });
    const root = sharedMutationClaimForCommand('resource_taken', {
      source: 'forage',
      kind: 'root',
      coord: [4, 24, -3]
    });
    const deadwood = sharedMutationClaimForCommand('resource_taken', {
      source: 'forage',
      kind: 'deadwood',
      coord: [4, 24, -3]
    });
    expect(berry).toEqual(root);
    expect(root).toEqual(deadwood);
    expect(berry).toMatchObject({
      key: 'collectible:forage:4,24,-3',
      collectibleType: 'forage',
      conflictCollectibleTypes: ['forage', 'forage:berry', 'forage:root', 'forage:deadwood']
    });
    expect(sharedMutationValidationError('resource_taken', {
      source: 'flora',
      kind: 'flower',
      coord: [4, 24, -3]
    })).toBeNull();
  });

  it('canonicalizes deadwood to two wood and uses a stable first-wins claim', () => {
    const coord = findDeadwoodCoord('0,0');
    const payload = {
      source: 'forage',
      kind: 'deadwood',
      coord,
      id: 'void_glass',
      qty: 999
    };
    const canonical = resolveServerCanonicalCommandPayload(
      'resource_taken',
      payload,
      { worldId: '0,0' }
    );

    expect(canonical).toEqual({
      commandPayload: {
        source: 'forage',
        kind: 'deadwood',
        coord,
        id: 'wood',
        qty: 2
      }
    });
    expect(sharedMutationClaimForCommand('resource_taken', payload)).toEqual(
      sharedMutationClaimForCommand('resource_taken', {
        source: 'forage',
        kind: 'deadwood',
        coord
      })
    );
  });

  it('rejects forged deadwood coordinates and a wrong kind at a deadwood node', () => {
    const worldId = '0,0';
    const validCoord = findDeadwoodCoord(worldId);
    const invalidCoord = ([[25, 25, 25], [25, 25, 24], [25, 24, 24]] as Array<[number, number, number]>)
      .find(coord => !isAuthoritativeDeadwoodNode(coord, worldId))!;
    expect(invalidCoord).toBeTruthy();

    expect(resolveServerCanonicalCommandPayload(
      'resource_taken',
      { source: 'forage', kind: 'deadwood', coord: invalidCoord },
      { worldId }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Deadwood pickup does not match a deterministic surface node.'
    });
    expect(resolveServerCanonicalCommandPayload(
      'resource_taken',
      { source: 'forage', kind: 'berry', coord: validCoord },
      { worldId }
    )).toEqual({
      code: 'validation_failed',
      reason: 'Forage kind does not match the deterministic surface node.'
    });
  });

  it('guarantees one flint in every authoritative stone yield', () => {
    for (let x = -20; x <= 20; x++) {
      const canonical = resolveServerCanonicalCommandPayload(
        'voxel_mined',
        { coord: [x, 1, 0], blockId: 'stone' },
        { worldId: '0,0' }
      );
      expect(canonical).not.toBeNull();
      expect(canonical).not.toHaveProperty('code');
      if (!canonical || 'code' in canonical) continue;
      expect(canonical.commandPayload.drops).toEqual(expect.arrayContaining([
        { id: 'flint', qty: 1 }
      ]));
    }
  });

  it('rejects recipes beyond the public primitive field kit', () => {
    expect(resolveServerAuthoritativeCommand('recipe_crafted', { recipeId: 'torch' })).toMatchObject({
      commandPayload: { recipeId: 'torch' }
    });
    expect(resolveServerAuthoritativeCommand('recipe_crafted', { recipeId: 'refined_alloy' })).toEqual({
      code: 'validation_failed',
      reason: 'Recipe is not available in the primitive field kit.'
    });
  });
});
