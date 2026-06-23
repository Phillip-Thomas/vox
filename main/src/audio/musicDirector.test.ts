import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_PLANET_MOOD,
  resolveMusicMix,
  resolveMusicScene,
  transitionCueForScene,
  type PlanetMusicMood
} from './musicDirector.ts';

const lushMood: PlanetMusicMood = {
  ...NEUTRAL_PLANET_MOOD,
  lush: 0.9,
  ocean: 0.2
};

const anomalyMood: PlanetMusicMood = {
  ...NEUTRAL_PLANET_MOOD,
  anomaly: 0.95,
  crystal: 0.45
};

describe('music director mix resolver', () => {
  it('prefers the landing menu over live flight state', () => {
    expect(resolveMusicScene('menu', 'deep_space', 'flight')).toBe('menu');
  });

  it('maps gameplay travel states to distinct music scenes', () => {
    expect(resolveMusicScene('playing', 'surface', 'fps')).toBe('surface');
    expect(resolveMusicScene('playing', 'surface', 'flight')).toBe('surfaceShip');
    expect(resolveMusicScene('playing', 'deep_space', 'flight')).toBe('deepSpace');
    expect(resolveMusicScene('playing', 'approach', 'flight')).toBe('approach');
    expect(resolveMusicScene('playing', 'descent', 'flight')).toBe('descent');
  });

  it('marks major scene changes with transition cues', () => {
    expect(transitionCueForScene('surface', 'deepSpace')).toBe('space');
    expect(transitionCueForScene('deepSpace', 'descent')).toBe('atmosphere');
    expect(transitionCueForScene('descent', 'surface')).toBe('surface');
    expect(transitionCueForScene('menu', 'menu')).toBeNull();
  });

  it('ducks base music and raises warp layers during warp', () => {
    const calm = resolveMusicMix('deepSpace', 0);
    const warping = resolveMusicMix('deepSpace', 1);

    expect(warping.layers.deepSpace).toBeLessThan(calm.layers.deepSpace ?? 0);
    expect(warping.layers.warp).toBeGreaterThan(0.3);
    expect(warping.procedural.warp).toBe(1);
    expect(warping.fadeSeconds).toBeLessThan(calm.fadeSeconds);
  });

  it('keeps beautiful daytime planets away from the darker surface accent', () => {
    const day = resolveMusicMix('surface', 0, lushMood, 1);
    const night = resolveMusicMix('surface', 0, lushMood, 0);

    expect(day.layers.surface).toBeLessThan(0.04);
    expect(day.layers.shimmer).toBeGreaterThan(0.14);
    expect(day.procedural.life).toBe(0);
    expect(night.procedural.night).toBe(0);
  });

  it('lets strange night-side planets lean into darker accents', () => {
    const strangeNight = resolveMusicMix('surface', 0, anomalyMood, 0);
    const lushDay = resolveMusicMix('surface', 0, lushMood, 1);

    expect(strangeNight.layers.surface).toBeGreaterThan(lushDay.layers.surface ?? 0);
    expect(strangeNight.layers.warp).toBeGreaterThan(0);
    expect(strangeNight.procedural.glass).toBe(0);
  });

  it('does not add persistent generated noise or tone to planet ambience', () => {
    const lushNight = resolveMusicMix('surface', 0, lushMood, 0);

    expect(lushNight.procedural.wind).toBe(0);
    expect(lushNight.procedural.glass).toBe(0);
    expect(lushNight.procedural.rumble).toBe(0);
    expect(lushNight.procedural.life).toBe(0);
    expect(lushNight.procedural.water).toBe(0);
    expect(lushNight.procedural.night).toBe(0);
  });
});
