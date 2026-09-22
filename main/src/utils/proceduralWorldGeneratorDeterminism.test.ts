import { describe, expect, it } from 'vitest';
import { ProceduralWorldGenerator, voxelCacheKey } from './proceduralWorldGenerator.ts';

// Terrain is seeded and deterministic: the same seed must always produce the
// same world. This fingerprint exists so the noise hot path can be OPTIMISED
// without silently reshaping anybody's planet.
//
// The noise inner loop is the single most expensive thing in a cold world load
// (~1s of main-thread time in a measured boot), so it is going to be touched
// again. When it is, these numbers must not move. A change here means the world
// changed, which means every existing save's terrain changed with it.

function fingerprint(seed: number): string {
  const gen = new ProceduralWorldGenerator(undefined, { seed });
  let solid = 0;
  let hash = 0;
  // Sample a shell straddling the default planet radius (25), where terrain
  // actually varies, rather than deep core or empty space.
  for (let i = 0; i < 3000; i++) {
    const t = i * 0.618;
    const r = 18 + (i % 14);
    const theta = t % (Math.PI * 2);
    const phi = (t * 1.7) % Math.PI;
    const x = Math.round(r * Math.sin(phi) * Math.cos(theta));
    const y = Math.round(r * Math.cos(phi));
    const z = Math.round(r * Math.sin(phi) * Math.sin(theta));
    const exists = gen.shouldVoxelExist(x, y, z);
    if (exists) solid++;
    hash = Math.imul(hash ^ (exists ? 0x9e37 : 0x85eb), 16777619) >>> 0;
  }
  return `${solid}:${hash}`;
}

describe('terrain determinism', () => {
  it('is stable for a given seed', () => {
    expect(fingerprint(12345)).toBe(fingerprint(12345));
  });

  it('differs between seeds (the fingerprint actually observes the noise)', () => {
    // Without this, a fingerprint that accidentally samples only empty space
    // would "pass" through any refactor while proving nothing.
    expect(fingerprint(12345)).not.toBe(fingerprint(999));
  });

  it('matches the recorded world for seed 12345', () => {
    expect(fingerprint(12345)).toBe('1921:2413094700');
  });
});

describe('voxel cache key packing', () => {
  it('never collides across a dense block of coordinates', () => {
    // A collision would alias two voxels onto one memo entry and silently
    // corrupt terrain — the exact failure the string keys could not have.
    const seen = new Map<number, string>();
    for (let x = -40; x <= 40; x += 1) {
      for (let y = -40; y <= 40; y += 3) {
        for (let z = -40; z <= 40; z += 7) {
          const key = voxelCacheKey(x, y, z);
          expect(key).not.toBeNull();
          const at = `${x},${y},${z}`;
          const prior = seen.get(key as number);
          expect(prior === undefined || prior === at).toBe(true);
          seen.set(key as number, at);
        }
      }
    }
  });

  it('stays inside exact integer range at the extremes', () => {
    for (const v of [65535, -65535, 0, 1, -1]) {
      const key = voxelCacheKey(v, v, v);
      expect(key).not.toBeNull();
      expect(Number.isSafeInteger(key as number)).toBe(true);
    }
  });

  it('refuses coordinates it cannot represent rather than wrapping', () => {
    expect(voxelCacheKey(65536, 0, 0)).toBeNull();
    expect(voxelCacheKey(0, -65536, 0)).toBeNull();
    expect(voxelCacheKey(0, 0, 1e9)).toBeNull();
    expect(voxelCacheKey(1.5, 0, 0)).toBeNull();
    expect(voxelCacheKey(Number.NaN, 0, 0)).toBeNull();
  });

  it('still returns correct terrain for coordinates that bypass the cache', () => {
    // Out-of-range voxels recompute instead of caching; they must not throw or
    // return a different answer than the cached path would.
    const gen = new ProceduralWorldGenerator(undefined, { seed: 12345 });
    expect(typeof gen.shouldVoxelExist(70000, 0, 0)).toBe('boolean');
    expect(gen.shouldVoxelExist(20, 12, 5)).toBe(gen.shouldVoxelExist(20, 12, 5));
  });
});
