import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTopFaceColumns,
  clearWorldGenCache,
  ensureWorldGen,
  getWorldArrivalCandidate,
  getWorldGen,
  hasWorldGenCacheEntry,
  type WorldPrepClientLike
} from './worldGenCache.ts';
import { buildPackedWorldPrepPayload, type WorldPrepRequest } from './worldPrepProtocol.ts';
import { TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID } from '../game/PlanetProfile.ts';
import { findTopFaceSurfaceVoxel } from './worldArrival.ts';

// `ensureWorldGen` is the cold-boot seam of PARAVOXIA_WORLD_GEN_OFFTHREAD_PLAN.md
// (Batch 1). These pin its contract: it must never leave a world missing, it
// must share one preparation between concurrent callers, and the world it
// produces through the worker path must be the same world the synchronous
// path produces — vitest runs in node with no Worker, so the worker is a mock
// client that packs the payload in-process, exactly as the real worker does.

const SIZE = 24;

/** A client that does the worker's job on the calling thread. */
function inProcessClient(onPrepare?: () => void): WorldPrepClientLike {
  return {
    prepare: async (request: WorldPrepRequest) => {
      onPrepare?.();
      await Promise.resolve();
      return buildPackedWorldPrepPayload(request);
    }
  };
}

function failingClient(): WorldPrepClientLike {
  return { prepare: async () => { throw new Error('worker exploded'); } };
}

afterEach(() => clearWorldGenCache());

describe('ensureWorldGen', () => {
  it('resolves a cache hit with the existing entry, unchanged', async () => {
    const sync = getWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID);
    const entry = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: failingClient() // must never be consulted on a hit
    });
    expect(entry).toBe(sync);
  });

  it('hydrates a canonical world through the worker path and populates the cache', async () => {
    expect(hasWorldGenCacheEntry(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)).toBe(false);
    const entry = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: inProcessClient(),
      yieldControl: async () => {}
    } as never);
    expect(hasWorldGenCacheEntry(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)).toBe(true);
    expect(entry.worldId).toBe(TIDEGARDEN_WORLD_ID);
    expect(entry.voxels.length).toBeGreaterThan(0);
    // The synchronous call now hits the cache and returns the hydrated entry.
    expect(getWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)).toBe(entry);
  });

  it('produces the same world the synchronous build produces', async () => {
    const hydrated = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: inProcessClient()
    });
    const hydratedVoxels = hydrated.voxels.map(v => `${v.x},${v.y},${v.z}`).sort();
    clearWorldGenCache();
    const sync = getWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID);
    const syncVoxels = sync.voxels.map(v => `${v.x},${v.y},${v.z}`).sort();
    expect(hydratedVoxels).toEqual(syncVoxels);
    // Spot-check the generator answers identically on both paths.
    for (const [x, y, z] of [[3, 11, -2], [-9, 4, 7], [0, 12, 0], [11, -3, 5]]) {
      expect(hydrated.generator.shouldVoxelExist(x, y, z)).toBe(sync.generator.shouldVoxelExist(x, y, z));
      expect(hydrated.generator.isWaterVoxel(x, y, z)).toBe(sync.generator.isWaterVoxel(x, y, z));
    }
  });

  it('shares one preparation between concurrent callers', async () => {
    let prepares = 0;
    const client = inProcessClient(() => { prepares++; });
    const [a, b, c] = await Promise.all([
      ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, { client }),
      ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, { client }),
      ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, { client })
    ]);
    expect(prepares).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('falls back to the synchronous build when the worker fails', async () => {
    const entry = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: failingClient()
    });
    expect(entry.voxels.length).toBeGreaterThan(0);
    expect(hasWorldGenCacheEntry(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)).toBe(true);
  });

  it('keeps seed-only (non-canonical) worlds on the synchronous path', async () => {
    let prepares = 0;
    const entry = await ensureWorldGen(8, 4242, undefined, {
      client: inProcessClient(() => { prepares++; })
    });
    expect(prepares).toBe(0);
    expect(entry.voxels.length).toBeGreaterThan(0);
    expect(hasWorldGenCacheEntry(8, 4242)).toBe(true);
  });

  it('rejects a non-canonical worldId exactly as the synchronous path does', async () => {
    // A worldId that is not a planet address is refused by resolvePlanetProfile
    // on BOTH paths. The seam must not invent a world the sync path would have
    // refused — parity with `getWorldGen`, including its failure.
    expect(() => getWorldGen(8, 4242, 'not-a-planet')).toThrow(/canonical world ID/);
    await expect(
      ensureWorldGen(8, 4242, 'not-a-planet', { client: inProcessClient() })
    ).rejects.toThrow(/canonical world ID/);
  });
});

describe('hydration installs the prepared fields', () => {
  it('a hydrated generator already holds the worker\'s memoised answers', async () => {
    const entry = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: inProcessClient()
    });
    const fields = entry.generator.exportPreparedFields();
    // The point of protocol v3: nothing on the main thread has queried this
    // generator yet, and it already knows every cell the worker scanned.
    expect(fields.existence.keys.length).toBeGreaterThan(1000);
    expect(fields.surfaceHeight.keys.length).toBeGreaterThan(1000);
    expect(fields.landOffset.keys.length).toBeGreaterThan(0);
  });
});

describe('validated arrival pad from the worker', () => {
  it('matches the synchronous search exactly and spares the main thread the search', async () => {
    // Sync path: findTopFaceSurfaceVoxel runs findValidSpawnSite on main and
    // memoises the pad on the cache entry.
    const syncPad = findTopFaceSurfaceVoxel(SIZE, TIDEGARDEN_SEED, undefined, TIDEGARDEN_WORLD_ID);
    clearWorldGenCache();
    // Worker path: the pad arrives IN the payload; the entry is born validated.
    const entry = await ensureWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID, {
      client: inProcessClient()
    });
    expect(entry.validatedArrivalCandidate).toEqual(syncPad);
    // And the main-thread call now returns without searching (same answer).
    expect(findTopFaceSurfaceVoxel(SIZE, TIDEGARDEN_SEED, undefined, TIDEGARDEN_WORLD_ID)).toEqual(syncPad);
  });
});

describe('top-face column memo', () => {
  it('answers every preferred column exactly as the per-call scan did, scanning once', () => {
    const entry = getWorldGen(SIZE, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID);
    // The old implementation, inline, for parity.
    const legacy = (preferred: { x: number; z: number }) => {
      const top = new Map<string, { x: number; y: number; z: number }>();
      for (const v of entry.voxels) {
        if (v.y < 0) continue;
        const k = `${v.x},${v.z}`; const c = top.get(k);
        if (!c || v.y > c.y) top.set(k, v);
      }
      let best: { x: number; y: number; z: number } | null = null; let bestD = Infinity;
      for (const v of top.values()) {
        const d = (v.x - preferred.x) ** 2 + (v.z - preferred.z) ** 2;
        if (d < bestD || (d === bestD && best && v.y > best.y)) { best = v; bestD = d; }
      }
      return best ? { ...best } : { x: 0, y: Math.floor(SIZE / 2), z: 0 };
    };
    for (const preferred of [{ x: 4, z: -4 }, { x: 7, z: -1 }, { x: -3, z: 9 }, { x: 0, z: 0 }, { x: 11, z: 11 }]) {
      expect(getWorldArrivalCandidate(SIZE, TIDEGARDEN_SEED, preferred, TIDEGARDEN_WORLD_ID)).toEqual(legacy(preferred));
    }
    // Built once, then reused: the same Map instance across calls.
    const first = entry.topFaceColumns;
    getWorldArrivalCandidate(SIZE, TIDEGARDEN_SEED, { x: 2, z: 2 }, TIDEGARDEN_WORLD_ID);
    expect(entry.topFaceColumns).toBe(first);
    expect(first).toEqual(buildTopFaceColumns(entry.voxels));
  });
});
