import { afterEach, describe, expect, it, vi } from 'vitest';
import { playSfx } from '../../audio/sfxEngine.ts';
import { getStoryText, clearStoryText } from '../storyText.ts';
import { subscribeStoryUxFeedback } from './feedbackCues.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  observeGuidedStoryMarker
} from './objectiveDirector.ts';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

afterEach(() => {
  clearGuidedStoryObjective();
  clearStoryText();
  vi.clearAllMocks();
});

describe('guided story objective contract', () => {
  it('publishes one actionable objective and detects a missing required marker', () => {
    expect(activateGuidedStoryObjective({
      id: 'settle:scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    })).toBe(true);
    expect(getStoryText().workorder).toEqual([
      'FOLLOW THE LIVING WATERLINE MARKER.',
      'READ THE SIGNAL FIELD.'
    ]);
    expect(getGuidedStoryObjectiveHealth()).toBe('missing-marker');

    observeGuidedStoryMarker('LIVING WATERLINE · SCAN');
    expect(getGuidedStoryObjectiveHealth()).toBe('ready');
    expect(activateGuidedStoryObjective({
      id: 'settle:scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    })).toBe(false);
  });

  it('rejects a supposedly guided objective with no player action', () => {
    expect(() => activateGuidedStoryObjective({
      id: 'broken',
      kind: 'wait',
      markerLabel: 'BROKEN',
      workOrder: []
    })).toThrow('actionable work-order');
  });

  it('emits one presentation-only entry cue per objective id', () => {
    const cues: string[] = [];
    const unsubscribe = subscribeStoryUxFeedback(cue => cues.push(cue.objectiveId));
    const objective = {
      id: 'dive:recover-keel-memory',
      kind: 'interact' as const,
      markerLabel: 'KEEL MEMORY',
      workOrder: ['[F] RECOVER THE KEEL MEMORY.']
    };

    expect(activateGuidedStoryObjective(objective)).toBe(true);
    expect(activateGuidedStoryObjective(objective)).toBe(false);
    unsubscribe();

    expect(cues).toEqual(['dive:recover-keel-memory']);
    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('terminalAdvance');
  });
});
