import { peekAudioContext, isMusicMuted, getMusicAudioTime, scheduleMusicSceneEnvelope,
  setMusicSceneEnvelopeImmediate } from '../audio/audioCore.ts';
import { commonGroundFinalTextureHolds, commonGroundMood } from './commonGroundScore.ts';
import { clearStoryScoreMoodOverride, setScoreBeat, setStoryScoreMoodOverride } from './storyScore.ts';
import type { StoryBeat } from './storyState.ts';

/** Chapter-local use of the existing voice and music-only scene envelope. */
let cue: { beat: StoryBeat; startedAt: number; audioStartedAt: number | null;
  endsAt: number; releasesAt: number; anchor: string } | null = null;
let ownsEnvelope = false;
let lastOutcome = 'silent';
function envelope(value: number, seconds: number): void {
  const now = getMusicAudioTime();
  if (now === null || scheduleMusicSceneEnvelope([{ offsetSeconds: seconds, value }], now) === null) {
    setMusicSceneEnvelopeImmediate(value);
  }
}
export function stopMapScore(): void {
  if (cue) {
    const beat = cue.beat;
    cue = null;
    setScoreBeat(null);
    clearStoryScoreMoodOverride(beat);
  }
  if (ownsEnvelope) envelope(0, 0.15);
  lastOutcome = 'cancelled-without-replay';
}
/** Focus events must cancel even when the browser has suspended frame ticks. */
export function bindMapScoreInterruptions(windowTarget: EventTarget, documentTarget: EventTarget,
  isHidden: () => boolean): () => void {
  const hidden = () => { if (isHidden()) stopMapScore(); };
  windowTarget.addEventListener('blur', stopMapScore);
  documentTarget.addEventListener('visibilitychange', hidden);
  return () => {
    windowTarget.removeEventListener('blur', stopMapScore);
    documentTarget.removeEventListener('visibilitychange', hidden);
    stopMapScore();
  };
}
/** Presentation-only hold: never consulted by progression or input. */
export function mapScoreFinalTextureHolds(): boolean {
  return cue?.anchor === 'anc.um.return-recorded' && performance.now() < cue.releasesAt;
}
export function mapScoreAnchor(anchor: string): void {
  if (anchor === 'anc.um.handback') return;
  if (anchor !== 'anc.um.record-opened' && anchor !== 'anc.um.return-recorded') {
    stopMapScore(); return;
  }
  stopMapScore();
  const context = peekAudioContext();
  if (!context || context.state !== 'running' || isMusicMuted() || commonGroundFinalTextureHolds()) {
    lastOutcome = 'omitted-unavailable-or-prior-release'; return;
  }
  const returning = anchor === 'anc.um.return-recorded';
  const beat: StoryBeat = returning ? 'ch14-return' : 'ch14-record';
  const source = commonGroundMood('independent-action-settled');
  setStoryScoreMoodOverride(beat, {
    ...source, progression: undefined,
    pattern: returning ? [0, null, null, 6, null, null, null, 7, ...Array(24).fill(null)]
      : [0, ...Array(31).fill(null)],
    baseline: 0.20, pad: returning ? 0.025 : 0, sub: 0, ost: 0.018, riser: 0
  });
  setScoreBeat(beat);
  ownsEnvelope = true;
  const duration = returning ? 4 : 0.7;
  const release = returning ? 2 : 0.15;
  const now = getMusicAudioTime();
  if (now !== null) scheduleMusicSceneEnvelope([
    { offsetSeconds: 0.12, value: 1 },
    { offsetSeconds: duration, value: 1 },
    { offsetSeconds: duration + release, value: 0 }
  ], now, 0);
  const startedAt = performance.now();
  cue = { beat, startedAt, audioStartedAt: now, endsAt: startedAt + duration * 1000,
    releasesAt: startedAt + (duration + release) * 1000, anchor };
  lastOutcome = 'requested-existing-score-voice';
}
export function tickMapScore(foreground: boolean, ongoing: boolean): void {
  if (!foreground || isMusicMuted()) stopMapScore();
  if (cue && performance.now() >= cue.releasesAt) stopMapScore();
  if (!cue && ongoing && foreground && !commonGroundFinalTextureHolds()) {
    // null mood returns the celestial bed; it is not silence. Keep only the
    // music bus absent through scar, either question and destination travel.
    if (!ownsEnvelope) { ownsEnvelope = true; envelope(0, 0.15); }
  }
  if (ownsEnvelope && !cue && (!foreground || !ongoing)) {
    ownsEnvelope = false;
    envelope(1, 0.15);
  }
}
export function mapScoreSnapshot() {
  return { cue: cue ? { ...cue } : null, lastOutcome, ownsEnvelope, release: 'music-only-scene-envelope' };
}
