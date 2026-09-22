import type { StoryObjectiveGuidanceFacts } from '../objectivePrimitives.ts';
import type { GuidedStoryObjective } from '../../ux/objectiveDirector.ts';

/** Pure presentation from durable/runtime facts. Authored beside ch6-dive. */
export function resolveObjective(facts: Readonly<StoryObjectiveGuidanceFacts>): GuidedStoryObjective {
  if (facts.dive.banked) {
    return {
      id: 'dive:shore-handoff',
      kind: 'wait',
      markerLabel: 'KEEL MEMORY · SECURED',
      workOrder: ['KEEL MEMORY SECURED.', 'BREATHE. LET THE SHORE RETURN.'],
      requiresMarker: false
    };
  }
  if (
    facts.dive.recovered
    && !facts.dive.surfaced
  ) {
    return {
      id: 'dive:surface-with-keel',
      kind: 'travel',
      markerLabel: 'WATERLINE · SURFACE WITH KEEL',
      workOrder: [
        'CARRY THE KEEL MEMORY THROUGH THE WATERLINE.',
        'IF RECOVERY MOVED YOU TO SHORE, RE-ENTER THE WATER AND SURFACE.'
      ]
    };
  }
  return facts.dive.recovered
    ? {
        id: 'dive:return-to-shore',
        kind: 'travel',
        markerLabel: 'DRY SHORE · SECURE KEEL MEMORY',
        workOrder: ['FOLLOW THE DRY SHORE MARKER.', 'RETURN THE KEEL MEMORY TO DRY GROUND.']
      }
    : {
        id: 'dive:recover-keel-memory',
        kind: 'interact',
        markerLabel: 'KEEL MEMORY',
        workOrder: ['FOLLOW THE KEEL MEMORY MARKER BELOW.', 'INTERACT TO RECOVER THE KEEL MEMORY.']
      };
}
