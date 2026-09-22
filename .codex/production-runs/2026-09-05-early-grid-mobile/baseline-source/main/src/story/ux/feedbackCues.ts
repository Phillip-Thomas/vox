import { playSfx } from '../../audio/sfxEngine.ts';
import { peekAudioContext } from '../../audio/audioCore.ts';
import { voiceTypewriterGapMs } from '../../audio/voice/voicePresentation.ts';

export type StoryUxFeedbackCue =
  | {
    type: 'objective-enter';
    objectiveId: string;
    action: 'travel' | 'interact' | 'craft' | 'build' | 'wait';
  }
  | { type: 'objective-progress' | 'objective-complete' | 'objective-fail' | 'marker-acquired'; objectiveId: string };

type StoryUxFeedbackListener = (cue: StoryUxFeedbackCue) => void;
const listeners = new Set<StoryUxFeedbackListener>();

/**
 * Semantic, presentation-only feedback. Score and cinema may subscribe, but
 * this module deliberately cannot write milestones or advance story state.
 */
export function emitStoryUxFeedbackCue(cue: StoryUxFeedbackCue): void {
  const events = {
    'objective-enter': 'objectiveEnter', 'objective-progress': 'objectiveProgress',
    'objective-complete': 'objectiveComplete', 'objective-fail': 'objectiveFail', 'marker-acquired': 'markerAcquired'
  } as const;
  const context = peekAudioContext();
  const gapMs = voiceTypewriterGapMs(typeof performance === 'undefined' ? 0 : performance.now());
  if (context && gapMs > 0) playSfx(events[cue.type], { atAudioTime: context.currentTime + gapMs / 1000 });
  else playSfx(events[cue.type]);
  for (const listener of listeners) listener(cue);
}

export function subscribeStoryUxFeedback(listener: StoryUxFeedbackListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
