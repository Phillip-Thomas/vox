import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The ORDER of the two release calls is the thing under test, and it is not
 * visible in the resulting state — both orders end with no beat and no override.
 * The difference is a frame in the middle: clearing the override while the beat
 * is still selected re-tunes the instrument to the beat's default mood before
 * the beat is dropped, which is an audible reassertion of the texture being
 * released. So the two calls are recorded, and the real implementations still run.
 */
const scoreCalls = vi.hoisted(() => [] as string[]);
vi.mock('./storyScore.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('./storyScore.ts')>();
  return {
    ...actual,
    setScoreBeat: (beat: Parameters<typeof actual.setScoreBeat>[0]) => {
      scoreCalls.push('setScoreBeat');
      return actual.setScoreBeat(beat);
    },
    clearStoryScoreMoodOverride: (beat?: Parameters<typeof actual.clearStoryScoreMoodOverride>[0]) => {
      scoreCalls.push('clearOverride');
      return actual.clearStoryScoreMoodOverride(beat);
    }
  };
});
import {
  COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS,
  releaseCommonGroundMood,
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
import { getStoryScoreMood, resetStoryScoreRuntime, setScoreBeat } from './storyScore.ts';

const ALL_MOODS: readonly CommonGroundMoodId[] = [
  'restored-home', 'unreconciled', 'demonstrating', 'refused-hold', 'revised',
  'independent-action-settled'
];

beforeEach(() => {
  resetCommonGroundScoreRuntime();
  resetStoryScoreRuntime();
  scoreCalls.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
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
    vi.useFakeTimers();
    enterCommonGroundScoreBeat('ch13-common');
    expect(beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false })).toBe(true);
    expect(commonGroundFinalTextureHolds()).toBe(true);
    vi.advanceTimersByTime((COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS - 0.1) * 1000);
    expect(tickCommonGroundFinalTexture()).toBe(false);
    expect(commonGroundFinalTextureHolds()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(tickCommonGroundFinalTexture()).toBe(true);
    expect(commonGroundFinalTextureHolds()).toBe(false);
    // Released, and never resumed.
    vi.advanceTimersByTime(10_000);
    expect(tickCommonGroundFinalTexture()).toBe(false);
  });

  it('measures MONOTONIC time, so a stalled or slow-frame chapter still releases', () => {
    // The deadline is five seconds of the player's life. A caller that never
    // advances a gameplay delta at all — the `done` frames after the handback,
    // a hitching machine, a throttled tab — must not be able to extend a bounded
    // exception, and a caller that floods enormous deltas must not shorten it.
    vi.useFakeTimers();
    enterCommonGroundScoreBeat('ch13-common');
    beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false });
    for (let frame = 0; frame < 400; frame += 1) {
      expect(tickCommonGroundFinalTexture(1000)).toBe(false);
    }
    expect(commonGroundFinalTextureHolds()).toBe(true);
    vi.advanceTimersByTime(COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS * 1000);
    // Zero gameplay delta, and it still releases on real elapsed time.
    expect(tickCommonGroundFinalTexture(0)).toBe(true);
  });

  it('keeps ticking on the inactive done frames after the handback', () => {
    vi.useFakeTimers();
    enterCommonGroundScoreBeat('ch13-common');
    beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false });
    // The chapter beat is gone; only the entry watch is still calling.
    enterCommonGroundScoreBeat(null);
    expect(commonGroundFinalTextureHolds()).toBe(true);
    vi.advanceTimersByTime(COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS * 1000 + 1);
    expect(tickCommonGroundFinalTexture()).toBe(true);
    expect(commonGroundFinalTextureHolds()).toBe(false);
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

describe('the chapter hands the instrument back in the signed order', () => {
  it('deselects the beat BEFORE clearing its override, at the return choice', () => {
    setScoreBeat('ch13-home');
    setCommonGroundMood('ch13-home', 'restored-home');
    scoreCalls.length = 0;

    expect(releaseCommonGroundMood('ch13-home')).toBe(true);
    expect(scoreCalls).toEqual(['setScoreBeat', 'clearOverride']);
    // Clearing first would have retuned to the beat's own mood for a frame.
    expect(scoreCalls.indexOf('setScoreBeat')).toBeLessThan(scoreCalls.indexOf('clearOverride'));
    expect(getStoryScoreMood('ch13-home')).toBeNull();
    expect(getCommonGroundScoreDiagnostic().beat).toBeNull();
  });

  it('uses the same order when the completion token reaches its bound', () => {
    vi.useFakeTimers();
    setScoreBeat('ch13-common');
    enterCommonGroundScoreBeat('ch13-common');
    beginCommonGroundFinalTexture('ch13-common', { restoredCompletion: false });
    scoreCalls.length = 0;
    vi.advanceTimersByTime(COMMON_GROUND_FINAL_TEXTURE_MAX_SECONDS * 1000 + 1);
    expect(tickCommonGroundFinalTexture()).toBe(true);
    expect(scoreCalls).toEqual(['setScoreBeat', 'clearOverride']);
  });

  it('releases nothing when the chapter never held the instrument', () => {
    expect(releaseCommonGroundMood('ch13-home')).toBe(false);
    expect(scoreCalls).toEqual([]);
  });
});
