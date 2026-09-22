import { beforeEach, describe, expect, it } from 'vitest';
import {
  COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS,
  beginCommonGroundFinalTexture,
  cancelCommonGroundFinalTexture,
  commonGroundFinalTextureHolds,
  commonGroundMood,
  enterCommonGroundScoreBeat,
  getCommonGroundScoreDiagnostic,
  releaseCommonGroundScore,
  resetCommonGroundScoreRuntime,
  setCommonGroundMood,
  tickCommonGroundFinalTexture,
  type CommonGroundMoodId,
  type CommonGroundScoreCancelReason
} from './commonGroundScore.ts';
import { getStoryScoreMood, resetStoryScoreRuntime } from './storyScore.ts';

const ALL_MOODS: readonly CommonGroundMoodId[] = [
  'restored-home', 'unreconciled', 'demonstrating', 'refused-hold', 'revised',
  'independent-action-settled'
];

beforeEach(() => {
  resetCommonGroundScoreRuntime();
  resetStoryScoreRuntime();
});

describe('exactly six moods, from the signed lane', () => {
  it('publishes each one through the existing facade', () => {
    for (const mood of ALL_MOODS) {
      expect(setCommonGroundMood('ch13-survey', mood), mood).toBe(true);
      expect(getStoryScoreMood('ch13-survey')).toEqual(commonGroundMood(mood));
    }
  });

  it('suppresses a repeat of the same variant so a held texture cannot stutter', () => {
    enterCommonGroundScoreBeat('ch13-survey');
    expect(setCommonGroundMood('ch13-survey', 'demonstrating')).toBe(true);
    expect(setCommonGroundMood('ch13-survey', 'demonstrating')).toBe(false);
    expect(setCommonGroundMood('ch13-survey', 'refused-hold')).toBe(true);
    // An established suspension re-asserting the same variant is not an event.
    expect(setCommonGroundMood('ch13-survey', 'refused-hold')).toBe(false);
  });

  it('keeps refusal as subtraction: the bar is literally empty', () => {
    expect(commonGroundMood('refused-hold').pattern.every(step => step === null)).toBe(true);
    // And the settled ending changes SPACING, not loudness.
    const demonstrating = commonGroundMood('demonstrating');
    const settled = commonGroundMood('independent-action-settled');
    expect(settled.baseline).toBe(demonstrating.baseline);
    expect(settled.pad).toBe(demonstrating.pad);
    expect(settled.pattern).not.toEqual(demonstrating.pattern);
  });
});

describe('the live-only final texture', () => {
  it('starts on a real first completion and releases at the five-second bound', () => {
    enterCommonGroundScoreBeat('ch13-common');
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false })).toBe(true);
    expect(commonGroundFinalTextureHolds()).toBe(true);
    expect(tickCommonGroundFinalTexture(COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS - 0.1)).toBe(false);
    expect(commonGroundFinalTextureHolds()).toBe(true);
    expect(tickCommonGroundFinalTexture(0.2)).toBe(true);
    expect(commonGroundFinalTextureHolds()).toBe(false);
    // Released, and never resumed.
    expect(tickCommonGroundFinalTexture(10)).toBe(false);
  });

  it('refuses a completion that was already true in the loaded save', () => {
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: true })).toBe(false);
    expect(commonGroundFinalTextureHolds()).toBe(false);
  });

  it('still fires for a save resumed mid-chapter that then earns its completion', () => {
    // The snapshot came from storage; the COMPLETION did not. Using the
    // snapshot's provenance as the predicate would ban this forever.
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false })).toBe(true);
  });

  it('cancels rather than queues when audio cannot carry it at that edge', () => {
    expect(beginCommonGroundFinalTexture('ch13-common', {
      restoredCompletion: false,
      audioUnavailable: true
    })).toBe(false);
    // And it is not waiting for an unlock: a later tick starts nothing.
    expect(tickCommonGroundFinalTexture(10)).toBe(false);
    expect(commonGroundFinalTextureHolds()).toBe(false);
  });

  it('cancels immediately on every signed trigger, and never resumes', () => {
    const triggers: readonly CommonGroundScoreCancelReason[] = [
      'new-story', 'optional-survey-action', 'actor-change', 'world-change', 'reset',
      'exit', 'pause', 'visibility-loss', 'music-mute', 'audio-unavailable'
    ];
    for (const trigger of triggers) {
      resetCommonGroundScoreRuntime();
      enterCommonGroundScoreBeat('ch13-common');
      beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false });
      expect(cancelCommonGroundFinalTexture(trigger), trigger).toBe(true);
      expect(commonGroundFinalTextureHolds(), trigger).toBe(false);
      expect(tickCommonGroundFinalTexture(1), trigger).toBe(false);
      expect(getCommonGroundScoreDiagnostic().finalTextureSeconds, trigger).toBeNull();
    }
  });

  it('is never started twice', () => {
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false })).toBe(true);
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false })).toBe(false);
  });

  it('drops chapter ownership on exit without leaving a pending token', () => {
    enterCommonGroundScoreBeat('ch13-common');
    beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false });
    releaseCommonGroundScore('ch13-common');
    expect(commonGroundFinalTextureHolds()).toBe(false);
    expect(getCommonGroundScoreDiagnostic()).toEqual({
      beat: null, mood: null, finalTextureSeconds: null
    });
  });
});
