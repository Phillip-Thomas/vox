import type { QualityProfile } from '../config/graphicsSettings.ts';

export interface WaterRenderBudget {
  faceSegments: number;
  edgeArcSegments: number;
  edgeLengthSegments: number;
  material: 'authored-shader' | 'opaque-biome';
}

const AUTHORED_WATER_BUDGET: WaterRenderBudget = {
  faceSegments: 6,
  edgeArcSegments: 8,
  edgeLengthSegments: 6,
  material: 'authored-shader'
};

/**
 * POTATO is a genuinely different renderer contract, not the full ocean shader
 * with its uniforms set to zero. A single opaque quad preserves the canonical
 * flooded cells and biome palette while avoiding transparent overdraw, the
 * custom analytic shader, and forty-nine vertices per exposed face.
 */
export function waterRenderBudget(profile: QualityProfile): WaterRenderBudget {
  if (profile === 'POTATO') {
    return {
      faceSegments: 1,
      edgeArcSegments: 2,
      edgeLengthSegments: 1,
      material: 'opaque-biome'
    };
  }
  return AUTHORED_WATER_BUDGET;
}
