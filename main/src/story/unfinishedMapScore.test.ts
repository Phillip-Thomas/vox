import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => ({ muted: false, prior: false,
  envelope: vi.fn(), beat: vi.fn(), override: vi.fn(), clear: vi.fn() }));
vi.mock('../audio/audioCore.ts', () => ({
  peekAudioContext: () => ({ state: 'running' }), isMusicMuted: () => audio.muted,
  getMusicAudioTime: () => 10, scheduleMusicSceneEnvelope: audio.envelope,
  setMusicSceneEnvelopeImmediate: vi.fn()
}));
vi.mock('./commonGroundScore.ts', () => ({
  commonGroundFinalTextureHolds: () => audio.prior,
  commonGroundMood: () => ({ chord: [0, 6, 7], tempo: 58, wave: 'square', octave: 24 })
}));
vi.mock('./storyScore.ts', () => ({ setScoreBeat: audio.beat,
  setStoryScoreMoodOverride: audio.override, clearStoryScoreMoodOverride: audio.clear }));
import { bindMapScoreInterruptions, mapScoreAnchor, mapScoreFinalTextureHolds,
  mapScoreSnapshot, stopMapScore, tickMapScore } from './unfinishedMapScore.ts';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance'] });
  stopMapScore(); tickMapScore(false, false);
  vi.clearAllMocks(); audio.muted = false; audio.prior = false;
  audio.envelope.mockReturnValue(10);
});
afterEach(() => { stopMapScore(); vi.useRealTimers(); });
it('preserves earned return through handback and the complete scheduled release', () => {
  mapScoreAnchor('anc.um.return-selected');
  expect(audio.override).not.toHaveBeenCalled();
  mapScoreAnchor('anc.um.return-recorded');
  const start = mapScoreSnapshot().cue!;
  expect(start.endsAt - start.startedAt).toBe(4000);
  expect(start.releasesAt - start.endsAt).toBe(2000);
  expect(start.audioStartedAt).toBe(10);
  expect(audio.envelope).toHaveBeenLastCalledWith([
    { offsetSeconds: 0.12, value: 1 }, { offsetSeconds: 4, value: 1 },
    { offsetSeconds: 6, value: 0 }
  ], 10, 0);
  mapScoreAnchor('anc.um.handback'); tickMapScore(true, false);
  vi.advanceTimersByTime(5999); tickMapScore(true, false);
  expect(mapScoreFinalTextureHolds()).toBe(true);
  vi.advanceTimersByTime(1); tickMapScore(true, false);
  expect(mapScoreSnapshot().cue).toBeNull();
  expect(audio.override).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'visibilitychange'])('cancels on %s without a frame tick or resume replay', event => {
  const win = new EventTarget(); const doc = new EventTarget();
  let hidden = false;
  const dispose = bindMapScoreInterruptions(win, doc, () => hidden);
  mapScoreAnchor('anc.um.return-recorded'); hidden = true;
  (event === 'blur' ? win : doc).dispatchEvent(new Event(event));
  expect(mapScoreSnapshot().cue).toBeNull();
  hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('focus')); tickMapScore(true, false);
  expect(audio.override).toHaveBeenCalledTimes(1); dispose();
});
it('restores pending and completed records silently on Continue', () => {
  tickMapScore(true, true); tickMapScore(true, false);
  expect(audio.override).not.toHaveBeenCalled();
  expect(mapScoreSnapshot().cue).toBeNull();
});
it.each(['pause', 'mute'])('cancels on %s without restarting the discarded phrase', reason => {
  mapScoreAnchor('anc.um.return-recorded');
  audio.muted = reason === 'mute'; tickMapScore(reason !== 'pause', false);
  expect(mapScoreSnapshot().cue).toBeNull();
  audio.muted = false; tickMapScore(true, false);
  expect(audio.override).toHaveBeenCalledTimes(1);
});
it('omits rather than defers a fragment during the previous release', () => {
  audio.prior = true; mapScoreAnchor('anc.um.record-opened');
  audio.prior = false; tickMapScore(true, true);
  expect(audio.override).not.toHaveBeenCalled();
});
it('keeps scar, retained question and destination silent', () => {
  mapScoreAnchor('anc.um.record-opened');
  for (const anchor of ['anc.um.scar-observed', 'anc.um.question-retained', 'anc.um.return-selected']) {
    mapScoreAnchor(anchor); tickMapScore(true, true);
    expect(mapScoreSnapshot().cue).toBeNull();
  }
  expect(audio.override).toHaveBeenCalledTimes(1);
});
