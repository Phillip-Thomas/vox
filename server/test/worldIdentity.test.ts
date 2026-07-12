import { describe, expect, it } from 'vitest';
import { metadataForWorldId } from '../src/worldIdentity.js';

describe('server world identity metadata', () => {
  it('keeps all legacy metadata fields and adds slot zero', () => {
    expect(metadataForWorldId('4,-2')).toEqual({
      worldId: '4,-2',
      coordinateX: 4,
      coordinateY: -2,
      planetSlot: 0,
      seed: 1711462742,
      generationSchemaVersion: 1
    });
  });

  it('returns canonical secondary metadata with a stable distinct seed', () => {
    expect(metadataForWorldId(' 004,-002:p2 ')).toEqual({
      worldId: '4,-2:p2',
      coordinateX: 4,
      coordinateY: -2,
      planetSlot: 2,
      seed: 1626527782,
      generationSchemaVersion: 1
    });
    expect(metadataForWorldId('4,-2:p2').seed).not.toBe(metadataForWorldId('4,-2').seed);
  });

  it.each(['4,-2:p0', '4,-2:p3', '1000001,0:p1', 'not-a-world'])(
    'rejects invalid metadata world ID %s',
    worldId => {
      expect(() => metadataForWorldId(worldId)).toThrow(`Invalid world ID: ${worldId}`);
    }
  );
});
