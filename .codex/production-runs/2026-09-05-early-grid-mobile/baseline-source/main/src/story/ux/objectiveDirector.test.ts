import { afterEach, describe, expect, it, vi } from 'vitest';
import { playSfx } from '../../audio/sfxEngine.ts';
import { getStoryText, clearStoryText } from '../storyText.ts';
import { subscribeStoryUxFeedback } from './feedbackCues.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  observeGuidedStoryMarker,
  subscribeGuidedStoryObjective,
  beginGuidedObjectiveRestore,
  resetGuidedObjectiveFeedbackForTests,
  acknowledgeGuidedStoryProgress
} from './objectiveDirector.ts';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

afterEach(() => {
  resetGuidedObjectiveFeedbackForTests();
  clearStoryText();
  vi.clearAllMocks();
});

describe('guided story objective contract', () => {
  it('publishes a resolved initial marker atomically and acknowledges it once', () => {
    const health: string[] = [];
    const unsubscribe = subscribeGuidedStoryObjective(() => health.push(getGuidedStoryObjectiveHealth()));
    activateGuidedStoryObjective({ id: 'atomic', kind: 'travel', markerLabel: 'WATER', workOrder: ['FOLLOW WATER'] }, 'WATER');
    observeGuidedStoryMarker('WATER');
    unsubscribe();
    expect(health).toEqual(['ready']);
    expect(vi.mocked(playSfx).mock.calls.map(call => call[0])).toEqual(['objectiveEnter', 'markerAcquired']);
  });
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
    expect(playSfx).toHaveBeenCalledWith('objectiveEnter');
  });
});

describe('objective feedback never claims unearned completion', () => {
  const objective = { id: 'test:recover', kind: 'interact' as const, markerLabel: 'Recover', workOrder: ['RECOVER THE CELL'], requiresMarker: true };
  it.each(['seed', 'resume', 'transition'] as const)('%s reconstructs silently until actual progress', reason => {
    beginGuidedObjectiveRestore(reason);
    activateGuidedStoryObjective(objective);
    observeGuidedStoryMarker('Recover');
    expect(playSfx).not.toHaveBeenCalled();
    activateGuidedStoryObjective({ ...objective, id: 'test:next' }, 'Recover');
    expect(playSfx).toHaveBeenCalledWith('objectiveEnter');
    expect(playSfx).toHaveBeenCalledWith('markerAcquired');
  });
  it.each(['transition', 'resume', 'reset'] as const)('%s clears silently', (reason) => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    clearGuidedStoryObjective(reason);
    expect(playSfx).not.toHaveBeenCalled();
  });
  it('sounds completion once only for a satisfied objective', () => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    clearGuidedStoryObjective('satisfied'); clearGuidedStoryObjective('satisfied');
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
  });
  it('acknowledges each progress edge and marker acquisition only once', () => {
    activateGuidedStoryObjective(objective); vi.clearAllMocks();
    acknowledgeGuidedStoryProgress('receipt'); acknowledgeGuidedStoryProgress('receipt');
    observeGuidedStoryMarker('Recover'); observeGuidedStoryMarker(null); observeGuidedStoryMarker('Recover');
    expect(playSfx).toHaveBeenCalledTimes(2);
    expect(playSfx).toHaveBeenCalledWith('objectiveProgress');
    expect(playSfx).toHaveBeenCalledWith('markerAcquired');
  });
});
