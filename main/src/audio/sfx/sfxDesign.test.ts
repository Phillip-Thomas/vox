import { describe, expect, it } from 'vitest';
import { sfxNoiseSeed, sfxRecipe } from '../sfxEngine.ts';
import { varySfxRecipe, SFX_VARIATION } from './sfxVariation.ts';
import { resolveSpatialSfx, NEUTRAL_SFX_LISTENER } from './spatialSfx.ts';
import { SFX_ROOM_PRESETS, sfxRoomForTier, resolveSfxRoomWeights } from './roomPresets.ts';
import { makeImpulseResponse } from '../generative/timbre.ts';

describe('designed SFX bounds and identity', () => {
  it('keeps bare/colour rooms dry and crosses the waterline on the shared scalar', () => {
    expect(Object.values(resolveSfxRoomWeights({ era: 0, submergence: 0.8 })).every(value => value === 0)).toBe(true);
    const half = resolveSfxRoomWeights({ era: 1, submergence: 0.5 });
    expect(half.plain).toBe(0.5); expect(half.underwater).toBe(0.5);
    const seal = resolveSfxRoomWeights({ era: 1, submergence: 0, interior: 0.25 });
    expect(seal.plain).toBe(0.75); expect(seal.interior).toBe(0.25); expect(seal.cave).toBe(0);
  });
  it('creates 200 distinct deterministic mine descriptors within the recipe-preserving bounds', () => {
    const nominal = sfxRecipe('mine');
    const unique = new Set<string>();
    for (let ordinal = 1; ordinal <= 200; ordinal++) {
      const seed = sfxNoiseSeed('mine', ordinal, 0, 5);
      const voices = varySfxRecipe('mine', nominal, seed, ordinal);
      expect(voices).toEqual(varySfxRecipe('mine', nominal, seed, ordinal));
      unique.add(JSON.stringify(voices));
      voices.forEach((voice, i) => {
        expect(voice.type).toBe(nominal[i].type);
        expect(Math.abs(voice.gain / nominal[i].gain - 1)).toBeLessThanOrEqual(SFX_VARIATION.gain);
        expect(Math.abs(voice.duration / nominal[i].duration - 1)).toBeLessThanOrEqual(SFX_VARIATION.duration);
      });
    }
    expect(unique.size).toBe(200);
  });

  it.each(['terminalKey', 'terminalAlarm', 'objectiveComplete', 'markerAcquired'] as const)('%s remains REGULATION without variation', (event) => {
    expect(varySfxRecipe(event, sfxRecipe(event), 5, 1)).toEqual(sfxRecipe(event));
    expect(varySfxRecipe(event, sfxRecipe(event), 7, 100)).toEqual(sfxRecipe(event));
  });

  it('pans in the camera frame, attenuates distance, and folds the bare era to mono', () => {
    expect(resolveSpatialSfx({ x: -4, y: 0, z: 0 }, NEUTRAL_SFX_LISTENER)).toMatchObject({ pan: -0.85, gain: 1 });
    expect(resolveSpatialSfx({ x: 4, y: 0, z: 0 }, NEUTRAL_SFX_LISTENER)).toMatchObject({ pan: 0.85, gain: 1 });
    expect(resolveSpatialSfx({ x: 20, y: 0, z: 0 }, NEUTRAL_SFX_LISTENER).gain).toBeCloseTo(4 / 23.2);
    expect(resolveSpatialSfx({ x: 48, y: 0, z: 0 }, NEUTRAL_SFX_LISTENER).gain).toBe(0);
    expect(resolveSpatialSfx({ x: 4, y: 0, z: 0 }, { ...NEUTRAL_SFX_LISTENER, era: 0 }).pan).toBe(0);
  });

  it('provides five physically distinct full room tails and two lean spaces', () => {
    const lengths = new Set<number>();
    for (const [id, room] of Object.entries(SFX_ROOM_PRESETS)) {
      const [impulse] = makeImpulseResponse({ seconds: room.seconds, sampleRate: 8000, decay: 3, seed: 5, channels: 1, preDelayMs: room.preDelayMs, hfDampHz: room.dampingHz, earlyTaps: 8, earlyWindowMs: [8, 60], earlyLevel: 0.3, lateLevel: 0.5, lateOnsetMs: 30 });
      lengths.add(impulse.length);
      expect(impulse.some((sample) => sample !== 0), id).toBe(true);
    }
    expect(lengths.size).toBe(5);
    expect(new Set(Object.keys(SFX_ROOM_PRESETS).map((room) => sfxRoomForTier(room as keyof typeof SFX_ROOM_PRESETS, 'lean')))).toEqual(new Set(['plain', 'underwater']));
  });
});
