import { describe, expect, it } from 'vitest';
import { describeStressInputDeclaration } from './excerpts.ts';

describe('pre-render original stress declaration', () => {
  it('declares identical music/environment/events for sum and the existing muted-SFX diagnostic', async () => {
    const sum = await describeStressInputDeclaration({ name: 'stress-mining-burst', quality: 'lean', diagnosticVariant: 'sum' });
    const duck = await describeStressInputDeclaration({ name: 'stress-mining-burst', quality: 'lean', diagnosticVariant: 'music-ducked' });
    expect({ ...sum, variant: duck.variant }).toEqual(duck);
    expect(sum.sourceOptions.seconds).toBe(60);
    expect(sum.scheduledCues).toHaveLength(82);
    expect(sum.density.oneShots.find(row => row.family === 'mine')?.triggers).toBe(75);
    expect(sum.nominalDrivingSignalsSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('requires a measured crash window and preserves one crash plus one landing', async () => {
    await expect(describeStressInputDeclaration({ name: 'stress-shipcrash-bloom' })).rejects.toThrow('current standalone');
    const declaration = await describeStressInputDeclaration({ name: 'stress-shipcrash-bloom', quality: 'full' }, 78.1);
    expect(declaration.sourceOptions.seconds).toBe(210);
    expect(declaration.scheduledCues).toEqual([{ t: 79.3, event: 'shipCrash' }, { t: 84.3, event: 'shipLand' }]);
    expect(declaration.bloomWindowStartS).toBe(78.1);
  });
});
