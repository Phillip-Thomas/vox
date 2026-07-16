import { describe, expect, it } from 'vitest';
import { waterRenderBudget } from './waterRenderBudget.ts';

describe('water render budget', () => {
  it('removes the analytic transparent water path on POTATO', () => {
    expect(waterRenderBudget('POTATO')).toEqual({
      faceSegments: 1,
      edgeArcSegments: 2,
      edgeLengthSegments: 1,
      material: 'opaque-biome'
    });
  });

  it.each(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const)(
    'preserves the authored ocean treatment on %s',
    profile => {
      expect(waterRenderBudget(profile)).toEqual({
        faceSegments: 6,
        edgeArcSegments: 8,
        edgeLengthSegments: 6,
        material: 'authored-shader'
      });
    }
  );
});
