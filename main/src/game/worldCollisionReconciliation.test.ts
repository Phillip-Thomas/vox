import { beforeEach, describe, expect, it } from 'vitest';
import {
  getWorldCollisionChangeSnapshot,
  notifyWorldCollisionChanged,
  resetWorldCollisionChangesForTests,
  shouldDisplacePlayerForWorldCollisionChange,
  shouldReconcilePlayerForWorldCollisionChange,
  subscribeWorldCollisionChanges,
  WORLD_COLLISION_PLAYER_RECONCILE_DISTANCE
} from './worldCollisionReconciliation.ts';

beforeEach(() => {
  resetWorldCollisionChangesForTests();
});

describe('world collision reconciliation signals', () => {
  it('publishes deduped collision changes to subscribers', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeWorldCollisionChanges(change => seen.push(change.seq));

    const change = notifyWorldCollisionChanged({
      kind: 'door_toggled',
      worldId: '0,0',
      cells: [[1, 2, 3], [1, 2, 3], [1, 3, 3]],
      solidAfter: true,
      timeMs: 123
    });

    expect(change).toMatchObject({
      seq: 1,
      kind: 'door_toggled',
      worldId: '0,0',
      cells: [[1, 2, 3], [1, 3, 3]],
      solidAfter: true,
      timeMs: 123
    });
    expect(getWorldCollisionChangeSnapshot()).toBe(change);
    expect(seen).toEqual([1]);

    unsubscribe();
    notifyWorldCollisionChanged({ kind: 'structure_removed', cells: [[0, 0, 0]] });
    expect(seen).toEqual([1]);
  });

  it('filters player reconciliation by world, distance, and affected cells', () => {
    const change = notifyWorldCollisionChanged({
      kind: 'structure_placed',
      worldId: '0,0',
      cells: [[2, 0, 0]],
      solidAfter: true
    });

    expect(shouldReconcilePlayerForWorldCollisionChange(change, { x: 4, y: 0, z: 0 }, '0,0')).toBe(true);
    expect(shouldReconcilePlayerForWorldCollisionChange(change, { x: 4, y: 0, z: 0 }, '1,0')).toBe(false);
    expect(shouldReconcilePlayerForWorldCollisionChange(
      change,
      { x: 4 + WORLD_COLLISION_PLAYER_RECONCILE_DISTANCE + 0.01, y: 0, z: 0 },
      '0,0'
    )).toBe(false);

    const noCells = notifyWorldCollisionChanged({ kind: 'terrain_diff', worldId: '0,0' });
    expect(shouldReconcilePlayerForWorldCollisionChange(noCells, { x: 0, y: 0, z: 0 }, '0,0')).toBe(false);
  });

  it('only displaces the player for solidifying collision changes', () => {
    expect(shouldDisplacePlayerForWorldCollisionChange(
      notifyWorldCollisionChanged({ kind: 'door_toggled', cells: [[0, 0, 0]], solidAfter: true })
    )).toBe(true);
    expect(shouldDisplacePlayerForWorldCollisionChange(
      notifyWorldCollisionChanged({ kind: 'door_toggled', cells: [[0, 0, 0]], solidAfter: false })
    )).toBe(false);
    expect(shouldDisplacePlayerForWorldCollisionChange(
      notifyWorldCollisionChanged({ kind: 'terrain_diff', cells: [[0, 0, 0]] })
    )).toBe(false);
  });
});
