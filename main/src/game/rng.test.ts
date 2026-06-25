import { describe, expect, it } from 'vitest';
import { createSimulationRng, hashRngSeed } from './rng.ts';

describe('simulation RNG seam', () => {
  it('produces deterministic sequences for the same seed and salt', () => {
    const a = createSimulationRng('mine-command-1', 'world:0,0');
    const b = createSimulationRng('mine-command-1', 'world:0,0');

    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('separates sequences by salt', () => {
    const a = createSimulationRng('mine-command-1', 'world:0,0');
    const b = createSimulationRng('mine-command-1', 'world:1,0');

    expect([a.next(), a.next(), a.next()]).not.toEqual([b.next(), b.next(), b.next()]);
  });

  it('rolls inclusive integer ranges and clamped chances', () => {
    const rng = createSimulationRng(42);

    for (let i = 0; i < 20; i++) {
      const rolled = rng.int(2, 4);
      expect(rolled).toBeGreaterThanOrEqual(2);
      expect(rolled).toBeLessThanOrEqual(4);
    }

    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it('hashes string seeds stably', () => {
    expect(hashRngSeed('paravoxia')).toBe(hashRngSeed('paravoxia'));
    expect(hashRngSeed('paravoxia')).not.toBe(hashRngSeed('paravox'));
  });
});
