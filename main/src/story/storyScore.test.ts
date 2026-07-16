import { beforeEach, describe, expect, it, vi } from 'vitest';

const score = vi.hoisted(() => ({
  setScoreMood: vi.fn(),
  unlockScore: vi.fn(),
  setScoreIntensity: vi.fn(),
  scoreHit: vi.fn()
}));

vi.mock('../audio/scoreEngine.ts', () => score);

import {
  clearStoryScoreMoodOverride,
  getChapter7BoardingScoreMood,
  getChapter7ReconstructionScoreMood,
  getStoryScoreMood,
  hasStoryScoreMoodOverride,
  resetStoryScoreRuntime,
  setScoreBeat,
  setStoryScoreMoodOverride,
  type Chapter7BoardingScoreVariant,
  type Chapter7ReconstructionScoreVariant
} from './storyScore.ts';

const RECONSTRUCTION_VARIANTS: readonly Chapter7ReconstructionScoreVariant[] = [
  'diagnosis',
  'bench',
  'frame',
  'hull',
  'lift',
  'hover',
  'route',
  'calibration'
];

const BOARDING_VARIANTS: readonly Chapter7BoardingScoreVariant[] = [
  'outside',
  'hatch',
  'vehicle-owner',
  'cockpit'
];

describe('storyScore chapter 7 reconstruction', () => {
  beforeEach(() => {
    resetStoryScoreRuntime();
    vi.clearAllMocks();
  });

  it('keeps every cumulative reconstruction state on the signed 64 BPM clock', () => {
    const moods = RECONSTRUCTION_VARIANTS.map(getChapter7ReconstructionScoreMood);
    expect(moods.every(value => value.tempo === 64)).toBe(true);

    for (let index = 1; index < moods.length; index += 1) {
      expect(moods[index].pad).toBeGreaterThanOrEqual(moods[index - 1].pad);
      expect(moods[index].sub).toBeGreaterThanOrEqual(moods[index - 1].sub);
      expect(moods[index].ost).toBeGreaterThanOrEqual(moods[index - 1].ost);
      expect(moods[index].riser).toBeGreaterThanOrEqual(moods[index - 1].riser);
    }
    expect(
      getChapter7ReconstructionScoreMood('calibration').progression?.[1]
    ).toContain(15);
  });

  it('keeps boarding on 64 BPM and hands launch to a restrained 72 BPM pulse', () => {
    expect(
      BOARDING_VARIANTS
        .map(getChapter7BoardingScoreMood)
        .every(value => value.tempo === 64)
    ).toBe(true);
    expect(getStoryScoreMood('ch8-launch')?.tempo).toBe(72);
    const vehiclePulse = getChapter7BoardingScoreMood('vehicle-owner').pattern;
    const cockpitPulse = getChapter7BoardingScoreMood('cockpit').pattern;
    expect(cockpitPulse.filter(value => value !== null).length).toBeGreaterThan(
      vehiclePulse.filter(value => value !== null).length
    );
  });

  it('returns defensive mood copies so integration code cannot mutate the palette', () => {
    const first = getChapter7ReconstructionScoreMood('route');
    first.chord[0] = 99;
    first.pattern[0] = 99;
    expect(getChapter7ReconstructionScoreMood('route').chord[0]).toBe(0);
    expect(getChapter7ReconstructionScoreMood('route').pattern[0]).toBe(0);
  });

  it('retunes an active beat immediately and restores its authored default on clear', () => {
    setScoreBeat('ch7-reconstruct');
    const override = getChapter7ReconstructionScoreMood('hull');
    score.setScoreMood.mockClear();

    setStoryScoreMoodOverride('ch7-reconstruct', override);

    expect(hasStoryScoreMoodOverride('ch7-reconstruct')).toBe(true);
    expect(score.setScoreMood).toHaveBeenCalledTimes(1);
    expect(score.setScoreMood).toHaveBeenLastCalledWith(override);

    expect(clearStoryScoreMoodOverride('ch7-reconstruct')).toBe(true);
    expect(hasStoryScoreMoodOverride('ch7-reconstruct')).toBe(false);
    expect(score.setScoreMood).toHaveBeenCalledTimes(2);
    expect(score.setScoreMood).toHaveBeenLastCalledWith(
      getStoryScoreMood('ch7-reconstruct')
    );
    expect(score.scoreHit).not.toHaveBeenCalled();
  });
});
