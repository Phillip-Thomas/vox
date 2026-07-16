import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthoritativeStructureReceipts,
  hasAuthoritativeStructureReceipt,
  recordAuthoritativeStructureReceipt,
  removeAuthoritativeStructureReceipt
} from './authoritativeStructureReceipts.ts';

beforeEach(() => clearAuthoritativeStructureReceipts());

describe('authoritative structure receipts', () => {
  it('distinguishes a server-accepted slot from local optimism and replaces it monotonically', () => {
    const slot = { worldId: '-1,-1:p1', cell: [4, 25, -4] as const, face: 3 };
    expect(hasAuthoritativeStructureReceipt({ ...slot, type: 'foundation' })).toBe(false);
    expect(recordAuthoritativeStructureReceipt({
      ...slot,
      playerId: 'alice',
      type: 'foundation',
      material: 'wood',
      commandId: 'foundation:1'
    })).toBe(true);
    expect(hasAuthoritativeStructureReceipt({
      ...slot,
      type: 'foundation',
      playerId: 'alice'
    })).toBe(true);
    expect(hasAuthoritativeStructureReceipt({ ...slot, playerId: 'bob' })).toBe(false);

    expect(recordAuthoritativeStructureReceipt({
      ...slot,
      playerId: 'bob',
      type: 'wall',
      material: 'stone'
    })).toBe(true);
    expect(hasAuthoritativeStructureReceipt({ ...slot, type: 'foundation' })).toBe(false);
    expect(hasAuthoritativeStructureReceipt({ ...slot, type: 'wall', playerId: 'bob' })).toBe(true);
  });

  it('forgets removals and full-world replacement boundaries', () => {
    const receipt = {
      worldId: '-1,-1:p1',
      playerId: 'alice',
      cell: [4, 25, -4] as const,
      face: 3,
      type: 'foundation' as const,
      material: 'wood'
    };
    recordAuthoritativeStructureReceipt(receipt);
    expect(removeAuthoritativeStructureReceipt(receipt.worldId, receipt.cell, receipt.face)).toBe(true);
    expect(hasAuthoritativeStructureReceipt(receipt)).toBe(false);

    recordAuthoritativeStructureReceipt(receipt);
    clearAuthoritativeStructureReceipts(receipt.worldId);
    expect(hasAuthoritativeStructureReceipt(receipt)).toBe(false);
  });
});
