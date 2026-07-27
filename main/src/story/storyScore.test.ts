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

/**
 * Early-ladder calm laws (owner brief 2026-07): the prologue/ch1/ch2 moods
 * must be pleasing, subtle, and patient — no constant low tone riding the
 * mix, no wall of fast beeps — while the awakening ramps keep their full
 * build energy. These are the measured invariants behind that ruling.
 */
const EARLY_CALM_BEATS = [
  'crawl',
  'manifest',
  'voyage',
  'deflect',
  'crash',
  'descent',
  'ch1-fixed',
  'ch1-track',
  'ch1-raster',
  'ch1-depth',
  'ch1-nav',
  'ch1-iso',
  'ch1-lift',
  'ch1-anomaly',
  'ch2-color',
  'ch2-approach'
] as const;
const EARLY_SUB_CAP = 0.10;
const EARLY_CHIP_TEMPO_CAP = 112;
const EARLY_MIN_RESTS_PER_BAR = 3;
const EARLY_MAX_NOTES_PER_SECOND = 2.4;
const STEPS_PER_BAR = 8;
const AWAKENING_RISER_FLOOR = 0.3;

describe('storyScore early-ladder calm laws', () => {
  it('caps the constant low end: every pre-A2 beat keeps sub at or under the cap', () => {
    for (const beat of EARLY_CALM_BEATS) {
      const value = getStoryScoreMood(beat);
      expect(value, beat).not.toBeNull();
      expect(value!.sub, `${beat} sub`).toBeLessThanOrEqual(EARLY_SUB_CAP);
    }
  });

  it('keeps space in every early pattern and the beeping unhurried', () => {
    for (const beat of EARLY_CALM_BEATS) {
      const value = getStoryScoreMood(beat)!;
      const rests = value.pattern.filter(step => step === null).length;
      const filled = value.pattern.length - rests;
      expect(value.pattern.length, `${beat} bar length`).toBe(STEPS_PER_BAR);
      expect(rests, `${beat} rests`).toBeGreaterThanOrEqual(EARLY_MIN_RESTS_PER_BAR);
      // Notes per second on the 8th-note grid: tempo/60 quarters × 2 steps.
      const notesPerSecond = (value.tempo / 60) * 2 * (filled / STEPS_PER_BAR);
      expect(notesPerSecond, `${beat} notes/s`).toBeLessThanOrEqual(EARLY_MAX_NOTES_PER_SECOND);
      if (value.wave === 'square') {
        expect(value.tempo, `${beat} tempo`).toBeLessThanOrEqual(EARLY_CHIP_TEMPO_CAP);
      }
    }
  });

  it('leaves the awakening builds at full energy — the calm ladder exists to earn them', () => {
    expect(getStoryScoreMood('a1-ramp')!.riser).toBeGreaterThanOrEqual(AWAKENING_RISER_FLOOR);
    expect(getStoryScoreMood('a2-awakening')!.riser).toBeGreaterThanOrEqual(
      AWAKENING_RISER_FLOOR
    );
    expect(
      getStoryScoreMood('a1-ramp')!.pattern.filter(step => step !== null).length
    ).toBe(STEPS_PER_BAR);
  });
});

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
