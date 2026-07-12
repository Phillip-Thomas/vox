import { describe, expect, it } from 'vitest';
import { ERA_ALIVE, ERA_COLOR, ERA_MATERIAL } from './generative/tuning.ts';
import {
  partitionScheduledBedHits,
  resolveLegacyScoreHitRenderPlan,
  resolveScoreHitPitchPlan,
  resolveScoreHitPalette,
  resolveScoreEraChannelBudget,
  resolveScorePadLayerGains,
  resolveScorePadMembershipGain,
  resolveScorePadVoiceStates,
  resolveScoreOstinatoTiming,
  resolveScoreSubLayerGains,
  resolveScheduledScoreHitPitchPlan,
  resolveScheduledScoreHitRenderPlan,
  resolveTimedScoreHitRenderPlan
} from './scoreEngine.ts';

const SEMITONES_PER_OCTAVE = 12;
const BARE_ERA = 0;
const TEST_WARMTH = 0.5;
const TEST_LAST_STEP_BEFORE_CHORD_TURN = 15;
const TEST_FIRST_STEP_AFTER_CHORD_TURN = 16;
const TEST_STORY_CUE_TIME_S = 54;
const TEST_STORY_TEMPO = 88;

const pitchClass = (semis: number): number =>
  ((semis % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;

describe('scoreEngine pitched-hit law', () => {
  const harmonies = [
    { name: 'major', root: 0, chord: [0, 4, 7] },
    { name: 'minor', root: 0, chord: [0, 3, 7] },
    { name: 'sus', root: 2, chord: [2, 7, 9, 14] },
    { name: 'cluster', root: -1, chord: [-1, 0, 1, 6, 11] }
  ] as const;

  it.each(harmonies)('$name blooms and impact glides use published harmony only', ({ root, chord }) => {
    const plan = resolveScoreHitPitchPlan({ root, chord });
    const chordPitchClasses = new Set(chord.map(pitchClass));
    const legalImpactPitchClasses = new Set([...chordPitchClasses, pitchClass(root)]);

    expect(plan.bloomSemis).toEqual([...plan.bloomSemis].sort((a, b) => a - b));
    expect(new Set(plan.bloomSemis.map(pitchClass)).size).toBe(plan.bloomSemis.length);
    expect(plan.bloomSemis.every((tone) => chordPitchClasses.has(pitchClass(tone)))).toBe(true);
    expect(plan.bloomBassSemis).not.toBeNull();
    expect(chordPitchClasses.has(pitchClass(plan.bloomBassSemis!))).toBe(true);

    for (const endpoint of [
      plan.boomBody.startSemis,
      plan.boomBody.endSemis,
      plan.boomAir.startSemis,
      plan.boomAir.endSemis
    ]) {
      expect(legalImpactPitchClasses.has(pitchClass(endpoint))).toBe(true);
    }
  });

  it('deduplicates pitch classes and registers an unordered published voicing safely', () => {
    const plan = resolveScoreHitPitchPlan({ root: 0, chord: [19, 0, 7, 12, 4, 7] });

    expect(plan.bloomSemis).toEqual([24, 28, 31]);
    expect(plan.chordPitchClasses).toEqual([7, 0, 4]);
  });

  it('does not invent a bloom tone for a malformed empty chord', () => {
    const plan = resolveScoreHitPitchPlan({ root: 5, chord: [] });

    expect(plan.bloomSemis).toEqual([]);
    expect(plan.bloomBassSemis).toBeNull();
    expect(plan.boomBody).toEqual({ startSemis: 5, endSemis: 5 });
    expect(plan.boomAir).toEqual({ startSemis: 17, endSemis: 5 });
  });

  it('captures the next progression chord when a quantized hit lands on its boundary', () => {
    const scoreMood = {
      chord: [0, 4, 7],
      progression: [[0, 4, 7], [1, 5, 8]]
    };

    const before = resolveScheduledScoreHitPitchPlan(
      scoreMood,
      TEST_LAST_STEP_BEFORE_CHORD_TURN
    );
    const boundary = resolveScheduledScoreHitPitchPlan(
      scoreMood,
      TEST_FIRST_STEP_AFTER_CHORD_TURN
    );

    expect(before.bloomSemis.map(pitchClass)).toEqual([0, 4, 7]);
    expect(boundary.bloomSemis.map(pitchClass)).toEqual([1, 5, 8]);
    expect(boundary.rootSemis).toBe(1);
  });

  it('captures harmony and material palette together at a scheduled boundary', () => {
    const plan = resolveScheduledScoreHitRenderPlan(
      { chord: [0, 4, 7], progression: [[0, 4, 7], [1, 5, 8]] },
      TEST_FIRST_STEP_AFTER_CHORD_TURN,
      ERA_MATERIAL
    );

    expect(plan.pitch.rootSemis).toBe(1);
    expect(plan.palette.rung).toBe('material');
  });

  it('forecasts the 54-second offline cue against its onset progression chord', () => {
    const plan = resolveTimedScoreHitRenderPlan(
      {
        chord: [0, 4, 7, 11],
        progression: [
          [0, 4, 7, 11],
          [5, 9, 12, 16],
          [7, 11, 14],
          [0, 4, 7, 12]
        ],
        tempo: TEST_STORY_TEMPO
      },
      BARE_ERA,
      TEST_STORY_CUE_TIME_S,
      ERA_ALIVE
    );

    expect(plan.pitch.rootSemis).toBe(5);
    expect(plan.palette.rung).toBe('alive');
  });

  it('partitions queued bed hits on half-open bar boundaries', () => {
    const partition = partitionScheduledBedHits(
      [
        { kind: 'boom', time: 9 },
        { kind: 'bloom', time: 10 },
        { kind: 'braam', time: 19.999 },
        { kind: 'boom', time: 20 }
      ],
      10,
      20
    );

    expect(partition.due.map((event) => event.time)).toEqual([10, 19.999]);
    expect(partition.future.map((event) => event.time)).toEqual([20]);
  });
});

describe('scoreEngine era-aware hit palette', () => {
  it('keeps frozen immediate scoreHit semantics on the full chord-opening palette', () => {
    const plan = resolveLegacyScoreHitRenderPlan({ root: 0, chord: [0, 3, 7] });

    expect(plan.palette).toMatchObject({
      rung: 'alive',
      braamEnabled: true,
      upperVoiceCap: 4,
      bassWave: 'sine',
      boomBodyWave: 'sine'
    });
    expect(plan.pitch.bloomSemis.map(pitchClass)).toEqual([0, 3, 7]);
  });

  it('uses noise-only punctuation at bare so the ambient pulse keeps the mono budget', () => {
    expect(resolveScoreHitPalette(BARE_ERA)).toMatchObject({
      rung: 'bare',
      braamEnabled: false,
      upperVoiceCap: 0,
      bassWave: null,
      boomBodyWave: null,
      boomAirWave: null,
      noiseAccent: true,
      maxPitchedVoices: 0
    });
  });

  it('uses the NES noise channel at color without stealing pulse/triangle voices', () => {
    expect(resolveScoreHitPalette(ERA_COLOR)).toMatchObject({
      rung: 'color',
      braamEnabled: false,
      upperWave: 'square',
      upperVoiceCap: 0,
      bassWave: null,
      boomBodyWave: null,
      boomAirWave: null,
      noiseAccent: true,
      maxPitchedVoices: 0
    });
  });

  it('admits 16-bit triangle chord texture at material but not the saw braam', () => {
    expect(resolveScoreHitPalette(ERA_MATERIAL)).toMatchObject({
      rung: 'material',
      braamEnabled: false,
      upperWave: 'triangle',
      upperVoiceCap: 4,
      bassWave: 'triangle',
      boomBodyWave: 'triangle',
      boomAirWave: 'triangle',
      noiseAccent: false
    });
  });

  it('reserves saw braam and sine impact body for alive', () => {
    expect(resolveScoreHitPalette(ERA_ALIVE)).toMatchObject({
      rung: 'alive',
      braamEnabled: true,
      bassWave: 'sine',
      boomBodyWave: 'sine',
      boomAirWave: 'triangle',
      noiseAccent: false
    });
    expect(resolveScoreHitPalette(BARE_ERA, 'alive').rung).toBe('alive');
    expect(resolveScoreHitPalette(ERA_ALIVE, 'paradox').rung).toBe('alive');
  });
});

describe('scoreEngine persistent story voice state', () => {
  it('marks every removed slot inactive through four-to-three-to-two-tone transitions', () => {
    expect(resolveScorePadVoiceStates([0, 4, 7, 11])).toEqual([
      { active: true, semis: 0 },
      { active: true, semis: 4 },
      { active: true, semis: 7 },
      { active: true, semis: 11 }
    ]);
    expect(resolveScorePadVoiceStates([0, 3, 7])).toEqual([
      { active: true, semis: 0 },
      { active: true, semis: 3 },
      { active: true, semis: 7 },
      { active: false, semis: null }
    ]);
    expect(resolveScorePadVoiceStates([0, 7])).toEqual([
      { active: true, semis: 0 },
      { active: true, semis: 7 },
      { active: false, semis: null },
      { active: false, semis: null }
    ]);
  });

  it('forces the combined membership output and every layer to zero when inactive', () => {
    expect(resolveScorePadMembershipGain(false)).toBe(0);
    expect(resolveScorePadLayerGains(false, ERA_MATERIAL, TEST_WARMTH)).toEqual({
      chip: 0,
      rich: 0,
      organ: 0
    });
  });

  it('keeps bare/color on chip and admits saw/organ richness only at material', () => {
    const bare = resolveScorePadLayerGains(true, BARE_ERA, TEST_WARMTH);
    const color = resolveScorePadLayerGains(true, ERA_COLOR, TEST_WARMTH);
    const material = resolveScorePadLayerGains(true, ERA_MATERIAL, TEST_WARMTH);

    expect(bare.chip).toBeGreaterThan(0);
    expect(bare.rich).toBe(0);
    expect(bare.organ).toBe(0);
    expect(color.chip).toBeGreaterThan(0);
    expect(color.rich).toBe(0);
    expect(color.organ).toBe(0);
    expect(resolveScorePadLayerGains(true, ERA_COLOR, TEST_WARMTH, 1).chip).toBe(0);
    expect(material.chip).toBe(0);
    expect(material.rich).toBeGreaterThan(0);
    expect(material.organ).toBeGreaterThan(0);
  });

  it('keeps bare sub-free, adds triangle bass at color, and admits sine only at material', () => {
    const bare = resolveScoreSubLayerGains(BARE_ERA, TEST_WARMTH);
    const color = resolveScoreSubLayerGains(ERA_COLOR, TEST_WARMTH);
    const material = resolveScoreSubLayerGains(ERA_MATERIAL, TEST_WARMTH);

    expect(bare.chip).toBe(0);
    expect(bare.rich).toBe(0);
    expect(bare.harmonic).toBe(0);
    expect(color.chip).toBeGreaterThan(0);
    expect(color.rich).toBe(0);
    expect(color.harmonic).toBe(0);
    expect(material.chip).toBe(0);
    expect(material.rich).toBeGreaterThan(0);
    expect(material.harmonic).toBeGreaterThan(0);
  });

  it('enforces one pitched channel at bare and at most two pulse voices at color', () => {
    expect(resolveScoreEraChannelBudget(BARE_ERA)).toEqual({
      pulseVoiceCap: 1,
      triangleBassVoiceCap: 0,
      pitchedVoiceCap: 1,
      melodyMayOverlapOstinato: false
    });
    expect(resolveScoreEraChannelBudget(ERA_COLOR)).toEqual({
      pulseVoiceCap: 2,
      triangleBassVoiceCap: 1,
      pitchedVoiceCap: 3,
      melodyMayOverlapOstinato: false
    });
    expect(resolveScoreEraChannelBudget(ERA_MATERIAL)).toEqual({
      pulseVoiceCap: 0,
      triangleBassVoiceCap: 0,
      pitchedVoiceCap: null,
      melodyMayOverlapOstinato: true
    });
    expect(resolveScoreOstinatoTiming(BARE_ERA).stopStepScale).toBeLessThanOrEqual(1);
    expect(resolveScoreOstinatoTiming(ERA_COLOR).stopStepScale).toBeLessThanOrEqual(1);
    expect(resolveScoreOstinatoTiming(ERA_MATERIAL).releaseStepScale).toBeGreaterThan(1);
  });
});
