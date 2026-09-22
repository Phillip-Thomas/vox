import type { EmergentStoryEvent } from '../emergentStoryEvents.ts';
import { acknowledgeGuidedStoryCompletion, acknowledgeGuidedStoryProgress, clearGuidedStoryObjective, getActiveGuidedStoryObjective } from './objectiveDirector.ts';

/** Accepted durable event edges only: replay/seeding does not emit these events. */
export function acknowledgeObjectiveStoryEvent(event: EmergentStoryEvent, localActorId: string): void {
  if (event.actorId !== localActorId) return;
  const objective = getActiveGuidedStoryObjective();
  if (!objective) return;
  const completing: Partial<Record<EmergentStoryEvent['type'], readonly string[]>> = {
    maw_direction_resolved: ['maw:choose-first-direction'],
    keel_memory_acquired: ['dive:recover-keel-memory'],
    keel_memory_banked: ['dive:return-to-shore'],
    maw_repaired: ['maw:attend-repair']
  };
  if (completing[event.type]?.includes(objective.id)) { acknowledgeGuidedStoryCompletion(objective.id, true); clearGuidedStoryObjective('satisfied'); }
  else if (event.type === 'keel_revealed' && objective.id === 'dive:recover-keel-memory') acknowledgeGuidedStoryProgress(event.id);
}
