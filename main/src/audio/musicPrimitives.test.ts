import { describe, expect, it } from 'vitest';
import {
  getMusicChord,
  getMusicPrimitives,
  setMusicChord,
  setMusicPrimitiveTargets,
  tickMusicPrimitives
} from './musicPrimitives.ts';
import { resolveMusicMix } from './musicDirector.ts';

describe('musicPrimitives', () => {
  it('targets clamp and smooth toward the set values', () => {
    setMusicPrimitiveTargets({ tension: 2, wonder: -1 });
    for (let i = 0; i < 120; i++) tickMusicPrimitives(1 / 30);
    expect(getMusicPrimitives().tension).toBeGreaterThan(0.95);
    expect(getMusicPrimitives().wonder).toBeLessThan(0.05);
  });

  it('publishes a harmonic center every voice can read', () => {
    setMusicChord(5, [5, 12, 17]);
    expect(getMusicChord().root).toBe(5);
    expect(getMusicChord().chord).toEqual([5, 12, 17]);
  });

  it('era scales the recorded surface layer (the music fidelity ladder)', () => {
    const base = { warmth: 0.8, wonder: 0.5, tension: 0 };
    const loFi = resolveMusicMix('surface', 0, undefined, 1, { ...base, era: 0.05 });
    const hiFi = resolveMusicMix('surface', 0, undefined, 1, { ...base, era: 1 });
    expect(loFi.layers.surface ?? 0).toBeLessThan((hiFi.layers.surface ?? 1) * 0.2);
  });

  it('tension makes room in the ambient beds for the score', () => {
    const calm = resolveMusicMix('surface', 0, undefined, 1, { era: 1, warmth: 0.8, wonder: 0.5, tension: 0 });
    const tense = resolveMusicMix('surface', 0, undefined, 1, { era: 1, warmth: 0.8, wonder: 0.5, tension: 1 });
    expect(tense.layers.shimmer ?? 0).toBeLessThan(calm.layers.shimmer ?? 1);
  });
});
