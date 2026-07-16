import { unlockMusicAudio } from './musicEngine.ts';
import { unlockSfxAudio } from './sfxEngine.ts';
import { unlockStoryScore } from '../story/storyScore.ts';

const TRUSTED_GESTURE_TYPES = ['pointerdown', 'keydown', 'touchstart'] as const;

let unlockInFlight: Promise<void> | null = null;

/**
 * Resume every game-audio owner from one browser gesture.
 *
 * Calls made during the same gesture collapse into one attempt. Once that
 * attempt settles, a later trusted gesture may retry `resume()`; browsers can
 * suspend an otherwise-built AudioContext after navigation, focus changes, or
 * a direct/deep-linked chapter load.
 */
export function unlockGameAudio(): Promise<void> {
  if (unlockInFlight) return unlockInFlight;

  unlockStoryScore();
  const attempt = Promise.allSettled([
    unlockMusicAudio(),
    unlockSfxAudio()
  ]).then(results => {
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[audio] unlock attempt failed', result.reason);
      }
    }
  });
  unlockInFlight = attempt;
  void attempt.then(() => {
    if (unlockInFlight === attempt) unlockInFlight = null;
  });
  return attempt;
}

/**
 * Direct/resumed story entries may already be in `playing` without ever
 * mounting LandingMenu. Their first real input is therefore also an audio
 * resume gesture. Programmatic events are intentionally ignored.
 */
export function installGameAudioUnlockOnFirstTrustedGesture(
  target: EventTarget = window
): () => void {
  let installed = true;
  const cleanup = () => {
    if (!installed) return;
    installed = false;
    for (const type of TRUSTED_GESTURE_TYPES) {
      target.removeEventListener(type, onGesture, true);
    }
  };
  const onGesture: EventListener = event => {
    if (!event.isTrusted) return;
    void unlockGameAudio();
    cleanup();
  };

  for (const type of TRUSTED_GESTURE_TYPES) {
    target.addEventListener(type, onGesture, true);
  }
  return cleanup;
}
