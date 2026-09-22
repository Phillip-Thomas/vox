import { describe, expect, it } from 'vitest';
import { biomeModeDirectionBias } from './harmonyBrain.ts';
import { runPureSoak } from './soak.ts';

describe('recovered Stage 5 harmonic gates', () => {
  it.each([
    { planetSeed: 5, archetype: 'verdant' as const },
    { planetSeed: 8, archetype: 'frozen' as const },
    { planetSeed: 10, archetype: 'volcanic' as const }
  ])('seed $planetSeed meets the original 32-minute vocabulary and repetition budgets', (planet) => {
    const { report } = runPureSoak({ ...planet, minutes: 32, scenario: 'fullSoak' });
    expect(report.pass).toBe(true);
    expect(report.stats.distinctChords).toBeGreaterThanOrEqual(30);
    expect(report.stats.tabuBypasses).toBeLessThanOrEqual(4);
    expect(report.stats.barTabuBypasses).toBeLessThanOrEqual(4);
    expect(report.stats.barNovelty).toBeGreaterThanOrEqual(0.85);
  });

  it('blends biome direction votes proportionally and leaves missing/invalid profiles neutral', () => {
    expect(biomeModeDirectionBias('dorian', { cave: 3, coast: 1 })).toBeCloseTo(-0.1);
    expect(biomeModeDirectionBias('dorian', { cave: 1, coast: 3 })).toBeCloseTo(0.1);
    expect(biomeModeDirectionBias('dorian', undefined)).toBe(0);
    expect(biomeModeDirectionBias('dorian', { cave: NaN, coast: -1 })).toBe(0);
  });
});
