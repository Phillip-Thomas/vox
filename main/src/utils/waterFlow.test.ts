import { describe, it, expect } from 'vitest';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { createTerrainConfig } from './terrainConfig';

const R = 25; // planetRadius for planetSize 50

function makeGen(seed: number) {
  return new ProceduralWorldGenerator(
    { planetRadius: R, coreRadiusPercent: 0.15 },
    createTerrainConfig(seed, R)
  );
}

const NEIGH: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];
const dom = (x: number, y: number, z: number) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z));

// Simulate digging cell `dug`: live solidity = static terrain minus the dug cell.
function liveSolidExcept(gen: ProceduralWorldGenerator, dug: Set<string>) {
  return (x: number, y: number, z: number) => gen.shouldVoxelExist(x, y, z) && !dug.has(`${x},${y},${z}`);
}

describe('dig-to-fill water flow', () => {
  it('floods a dug seabed/coast cell below the waterline that touches water', () => {
    const gen = makeGen(13579); // valleys — plenty of water
    const sea = gen.getSeaLevelRadius();

    // Find a SOLID, below-sea cell adjacent to existing water (the seabed/coast
    // wall just under or beside the ocean).
    let target: { x: number; y: number; z: number } | null = null;
    for (const w of gen.getExposedWaterVoxels()) {
      for (const [dx, dy, dz] of NEIGH) {
        const x = w.x + dx, y = w.y + dy, z = w.z + dz;
        if (gen.shouldVoxelExist(x, y, z) && dom(x, y, z) <= sea && !gen.isWaterVoxel(x, y, z)) {
          target = { x, y, z };
          break;
        }
      }
      if (target) break;
    }
    expect(target).not.toBeNull();
    const t = target!;
    expect(gen.isWaterVoxel(t.x, t.y, t.z)).toBe(false); // dry before the dig

    const dug = new Set([`${t.x},${t.y},${t.z}`]);
    const added = gen.extendFloodForDugCell(t.x, t.y, t.z, liveSolidExcept(gen, dug));

    expect(added.length).toBeGreaterThan(0);                 // water flowed in
    expect(gen.isWaterVoxel(t.x, t.y, t.z)).toBe(true);      // the cell is now water
    expect(gen.getDynamicWaterCells().length).toBe(added.length);
    expect(gen.getWaterEditVersion()).toBeGreaterThan(0);
  });

  it('does NOT flood a dug cell above the waterline (water never climbs)', () => {
    const gen = makeGen(13579);
    const sea = gen.getSeaLevelRadius();

    const dry = gen.getAllVoxelPositions().find(p => dom(p.x, p.y, p.z) > sea + 1);
    expect(dry).toBeDefined();
    const d = dry!;
    const dug = new Set([`${d.x},${d.y},${d.z}`]);
    const added = gen.extendFloodForDugCell(d.x, d.y, d.z, liveSolidExcept(gen, dug));

    expect(added.length).toBe(0);
    expect(gen.isWaterVoxel(d.x, d.y, d.z)).toBe(false);
  });

  it('cascades down a dug shaft (water follows you as you dig below the surface)', () => {
    const gen = makeGen(24680); // islands — broad shallow sea over a seabed

    // A water surface cell, then dig the solid column straight inward from it.
    const surf = gen.getExposedWaterVoxels().find(w => w.isTopSurface);
    expect(surf).toBeDefined();
    const s = surf!;
    // Inward step = toward 0 along the dominant axis.
    const ax = Math.abs(s.x), ay = Math.abs(s.y), az = Math.abs(s.z);
    const step: [number, number, number] =
      ax >= ay && ax >= az ? [-(Math.sign(s.x) || 1), 0, 0]
        : ay >= ax && ay >= az ? [0, -(Math.sign(s.y) || 1), 0]
          : [0, 0, -(Math.sign(s.z) || 1)];

    const dug = new Set<string>();
    let flooded = 0;
    let cx = s.x, cy = s.y, cz = s.z;
    for (let i = 0; i < 3; i++) {
      cx += step[0]; cy += step[1]; cz += step[2];
      if (!gen.shouldVoxelExist(cx, cy, cz)) break; // hit a void/core; stop
      dug.add(`${cx},${cy},${cz}`);
      const added = gen.extendFloodForDugCell(cx, cy, cz, liveSolidExcept(gen, dug));
      flooded += added.length;
      expect(gen.isWaterVoxel(cx, cy, cz)).toBe(true); // each dug cell fills
    }
    expect(flooded).toBeGreaterThan(0);
  });
});
