import { afterEach, expect, it, vi } from 'vitest';
import { playSfx } from '../../audio/sfxEngine.ts';
import { acknowledgeObjectiveStoryEvent } from './objectiveEventFeedback.ts';
import { activateGuidedStoryObjective, resetGuidedObjectiveFeedbackForTests } from './objectiveDirector.ts';
vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));
afterEach(() => { resetGuidedObjectiveFeedbackForTests(); vi.clearAllMocks(); });
it('completes the exact accepted local objective once, never a different or remote objective', () => {
  activateGuidedStoryObjective({ id: 'dive:recover-keel-memory', kind: 'interact', markerLabel: 'KEEL', workOrder: ['RECOVER'] });
  vi.clearAllMocks();
  const event = { id: 'receipt', type: 'keel_memory_acquired' as const, actorId: 'local', sequence: 1, payload: { componentId: 'keel' } };
  acknowledgeObjectiveStoryEvent(event, 'remote'); expect(playSfx).not.toHaveBeenCalled();
  acknowledgeObjectiveStoryEvent(event, 'local'); acknowledgeObjectiveStoryEvent(event, 'local');
  expect(playSfx).toHaveBeenCalledExactlyOnceWith('objectiveComplete');
});
