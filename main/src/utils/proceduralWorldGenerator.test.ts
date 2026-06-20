import { describe, expect, it } from 'vitest';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';

const worldConfig = {
  planetRadius: 6,
  coreRadiusPercent: 0.15
};

const terrainConfig = {
  seed: 12345,
  heightVariation: 4,
  mountainFrequency: 0.02,
  hillFrequency: 0.05,
  valleyDepth: 3,
  terrainScale: 0.1
};

function hashWorld(seed: number) {
  const generator = new ProceduralWorldGenerator(worldConfig, { ...terrainConfig, seed });
  return generator.getAllVoxelPositions()
    .map(({ x, y, z }) => `${x},${y},${z}:${generator.generateMaterialForPosition(x, y, z)}`)
    .join('|');
}

describe('ProceduralWorldGenerator', () => {
  it('generates identical positions and materials for the same seed', () => {
    expect(hashWorld(12345)).toEqual(hashWorld(12345));
  });

  it('changes terrain for different seeds', () => {
    expect(hashWorld(12345)).not.toEqual(hashWorld(54321));
  });
});
