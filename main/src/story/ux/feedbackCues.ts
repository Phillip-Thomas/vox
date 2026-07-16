import { playSfx } from '../../audio/sfxEngine.ts';

export type StoryUxFeedbackCue =
  | {
    type: 'objective-enter';
    objectiveId: string;
    action: 'travel' | 'interact' | 'craft' | 'build' | 'wait';
  };

type StoryUxFeedbackListener = (cue: StoryUxFeedbackCue) => void;
const listeners = new Set<StoryUxFeedbackListener>();

/**
 * Semantic, presentation-only feedback. Score and cinema may subscribe, but
 * this module deliberately cannot write milestones or advance story state.
 */
export function emitStoryUxFeedbackCue(cue: StoryUxFeedbackCue): void {
  if (cue.type === 'objective-enter') playSfx('terminalAdvance');
  for (const listener of listeners) listener(cue);
}

export function subscribeStoryUxFeedback(listener: StoryUxFeedbackListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
