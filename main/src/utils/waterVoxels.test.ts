import { describe, expect, it } from 'vitest';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';
import { buildWaterVoxels, buildWaterFaces, FACE_NORMALS } from './waterVoxels';

// Neighbour offsets indexed to match FACE_NORMALS / getExposedWaterFaces.
const FACE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
];

// Use the SHARED terrain config (the same one EfficientPlanet + the water
// generator use) so the test exercises a world that actually has oceans.
const worldConfig = {
  planetRadius: 12,
  coreRadiusPercent: 0.15
};

function makeGenerator() {
  return new ProceduralWorldGenerator(worldConfig, createTerrainConfig(12345, worldConfig.planetRadius));
}

describe('water voxel classification', () => {
  it('raises the default seed sea level by one voxel', () => {
    const raisedConfig = createTerrainConfig(12345, worldConfig.planetRadius);
    const baselineConfig = { ...raisedConfig, seaLevelOffset: 0 };
    const raised = new ProceduralWorldGenerator(worldConfig, raisedConfig);
    const baseline = new ProceduralWorldGenerator(worldConfig, baselineConfig);

    expect(raisedConfig.seaLevelOffset).toBe(1);
    expect(createTerrainConfig(54321, worldConfig.planetRadius).seaLevelOffset ?? 0).toBe(0);
    expect(raised.getSeaLevelRadius()).toBeCloseTo(baseline.getSeaLevelRadius() + 1);
  });

  it('water and air partition the empty cells by sea level', () => {
    const gen = makeGenerator();
    // Sea level is now the percentile-derived waterline from the generator
    // itself (no longer the fixed SEA_LEVEL_RADIUS_PERCENT fraction).
    const seaLevel = gen.getSeaLevelRadius();
    const R = Math.floor(worldConfig.planetRadius);

    for (let x = -R; x <= R; x += 3) {
      for (let y = -R; y <= R; y += 3) {
        for (let z = -R; z <= R; z += 3) {
          const water = gen.isWaterVoxel(x, y, z);
          const air = gen.isAirVoxel(x, y, z);
          // A cell is never both water and air.
          expect(water && air).toBe(false);

          if (water) {
            const radius = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
            expect(radius).toBeLessThanOrEqual(seaLevel);
          }
        }
      }
    }
  });

  it('only emits exposed water voxels (>=1 air face-neighbour)', () => {
    const gen = makeGenerator();
    const exposed = gen.getExposedWaterVoxels();
    expect(exposed.length).toBeGreaterThan(0);

    for (const { x, y, z } of exposed) {
      expect(gen.isWaterVoxel(x, y, z)).toBe(true);
      const hasAirNeighbor =
        gen.isAirVoxel(x + 1, y, z) || gen.isAirVoxel(x - 1, y, z) ||
        gen.isAirVoxel(x, y + 1, z) || gen.isAirVoxel(x, y - 1, z) ||
        gen.isAirVoxel(x, y, z + 1) || gen.isAirVoxel(x, y, z - 1);
      expect(hasAirNeighbor).toBe(true);
    }
  });

  it('is deterministic for a given seed/size and changes with seed', () => {
    const a = buildWaterVoxels(24, 12345);
    const b = buildWaterVoxels(24, 12345);
    expect(a.length).toEqual(b.length);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));

    const c = buildWaterVoxels(24, 54321);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });
});

describe('water surface faces', () => {
  it('emits one face per air-facing neighbour of each exposed water voxel', () => {
    const gen = makeGenerator();
    const faces = gen.getExposedWaterFaces();
    expect(faces.length).toBeGreaterThan(0);

    for (const { x, y, z, faceDir } of faces) {
      // Every emitted face must be a water voxel...
      expect(gen.isWaterVoxel(x, y, z)).toBe(true);
      // ...with a valid face index whose neighbour in that direction is AIR.
      expect(faceDir).toBeGreaterThanOrEqual(0);
      expect(faceDir).toBeLessThan(6);
      const [dx, dy, dz] = FACE_OFFSETS[faceDir];
      expect(gen.isAirVoxel(x + dx, y + dy, z + dz)).toBe(true);
    }
  });

  it('the face count equals the total air-facing neighbours over exposed voxels', () => {
    const gen = makeGenerator();
    const faces = gen.getExposedWaterFaces();

    // Independently recompute: sum of air neighbours across all water voxels.
    // The generator's water scan reaches a few shells past the terrain edge (to
    // float oceans on planets whose surface bulges past the cube), so scan a
    // generous super-range here to cover every possible water voxel.
    let expected = 0;
    const R = Math.floor(worldConfig.planetRadius) + 8;
    for (let x = -R; x <= R; x++) {
      for (let y = -R; y <= R; y++) {
        for (let z = -R; z <= R; z++) {
          if (!gen.isWaterVoxel(x, y, z)) continue;
          for (const [dx, dy, dz] of FACE_OFFSETS) {
            if (gen.isAirVoxel(x + dx, y + dy, z + dz)) expected++;
          }
        }
      }
    }
    expect(faces.length).toEqual(expected);
  });

  it('the vast majority of faces are outward/top faces (the ocean sheet)', () => {
    const gen = makeGenerator();
    const faces = gen.getExposedWaterFaces();

    // A face is "outward" when its normal points away from the planet centre
    // (dot with the voxel's outward direction > 0). The ocean surface should be
    // dominated by these.
    let outward = 0;
    for (const { x, y, z, faceDir } of faces) {
      const [nx, ny, nz] = FACE_NORMALS[faceDir];
      if (nx * x + ny * y + nz * z > 0) outward++;
    }
    expect(outward / faces.length).toBeGreaterThan(0.5);
  });

  it('buildWaterFaces is deterministic for a seed/size and changes with seed', () => {
    const a = buildWaterFaces(24, 12345);
    const b = buildWaterFaces(24, 12345);
    expect(a.length).toEqual(b.length);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));

    const c = buildWaterFaces(24, 54321);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
  });
});

// Part A guarantee: EVERY terrain preset must produce visible water at the real
// gameplay planet size (EfficientScene.planetSize = 50), with coverage VARYING
// per preset (valleys >> mountains). This is the core "every preset has water"
// assertion the bug report demands.
describe('every terrain preset has visible water (planetSize 50)', () => {
  const PLANET_SIZE = 50;
  const PRESETS: Array<{ name: string; seed: number }> = [
    { name: 'default', seed: 12345 },
    { name: 'mountains', seed: 54321 },
    { name: 'hills', seed: 98765 },
    { name: 'valleys', seed: 13579 },
    { name: 'islands', seed: 24680 }
  ];

  for (const { name, seed } of PRESETS) {
    it(`${name} (seed ${seed}) produces a non-empty exposed water surface`, () => {
      const faces = buildWaterFaces(PLANET_SIZE, seed);
      expect(faces.length).toBeGreaterThan(0);
    });
  }

  it('coverage varies: valleys flood more than mountains', () => {
    const valleys = buildWaterFaces(PLANET_SIZE, 13579).length;
    const mountains = buildWaterFaces(PLANET_SIZE, 54321).length;
    expect(valleys).toBeGreaterThan(mountains);
  });
});
