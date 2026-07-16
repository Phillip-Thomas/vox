import { describe, expect, it } from 'vitest';
import { preserveUnchangedCollisionBodies } from './collisionBodyState.ts';

describe('preserveUnchangedCollisionBodies', () => {
  it('returns the existing state for identical streamed collider membership and order', () => {
    const previous = [{ key: 'a' }, { key: 'b' }];
    expect(preserveUnchangedCollisionBodies(previous, [{ key: 'a' }, { key: 'b' }])).toBe(previous);
  });

  it('publishes actual membership or order changes', () => {
    const previous = [{ key: 'a' }, { key: 'b' }];
    expect(preserveUnchangedCollisionBodies(previous, [{ key: 'a' }])).not.toBe(previous);
    expect(preserveUnchangedCollisionBodies(previous, [{ key: 'b' }, { key: 'a' }])).not.toBe(previous);
  });
});
