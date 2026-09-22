import type { StoryObjectiveGuidanceFacts } from '../objectivePrimitives.ts';
import type { GuidedStoryObjective } from '../../ux/objectiveDirector.ts';

/** Pure presentation from durable/runtime facts. Authored beside ch5-maw. */
export function resolveObjective(facts: Readonly<StoryObjectiveGuidanceFacts>): GuidedStoryObjective {
  if (!facts.maw.kit) {
    return {
      id: 'maw:recover-field-kit',
      kind: 'interact',
      markerLabel: 'W-7744 FIELD PACK · RECOVER KIT',
      workOrder: ['FOLLOW THE FIELD PACK MARKER.', '[F] RECOVER THE FIELD KIT.']
    };
  }

  const ritual = facts.maw.ritual;
  if (!facts.maw.repaired) {
    return ritual.phase === 'repairing' || ritual.phase === 'ready'
      ? {
          id: 'maw:attend-repair',
          kind: 'wait',
          markerLabel: 'W-7744 FIELD PACK · REPAIR MAW',
          workOrder: ['REMAIN AT THE OPEN FIELD PACK.', 'HOLD POSITION UNTIL THE MAW REPAIR COMPLETES.']
        }
      : {
          id: 'maw:begin-repair',
          kind: 'interact',
          markerLabel: 'W-7744 FIELD PACK · REPAIR MAW',
          workOrder: ['RETURN TO THE OPEN FIELD PACK.', '[F] BEGIN MAW REPAIR.']
        };
  }

  if (!facts.maw.direction) {
    return ritual.directionAvailable
      ? {
          id: 'maw:choose-first-direction',
          kind: 'interact',
          markerLabel: 'REPAIRED MAW · CHOOSE DIRECTION',
          workOrder: [
            'TEST THE MAW ON STONE OR BASE METAL.',
            'OR REMAIN WITH IT AND [F] LOWER IT TO LISTEN.'
          ]
        }
      : {
          id: 'maw:purpose-gap',
          kind: 'wait',
          markerLabel: 'REPAIRED MAW · LISTEN',
          workOrder: ['REMAIN WITH THE REPAIRED MAW.', 'WAIT. LISTEN BEFORE ASSIGNING IT A PURPOSE.']
        };
  }

  if (!facts.maw.resonance) {
    return {
      id: 'maw:observe-pond-response',
      kind: 'interact',
      markerLabel: 'POND RESPONSE · ATTEND',
      workOrder: ['FOLLOW THE RESPONSE TO THE DRY SHORE.', 'WATCH IT, OR [F] ATTEND THE POND RESPONSE.']
    };
  }

  return {
    id: 'maw:resonance-settling',
    kind: 'wait',
    markerLabel: 'POND RESPONSE · RESOLVED',
    workOrder: ['REMAIN WITH THE RESONANCE.', 'LET THE STRUCTURE SETTLE.']
  };
}
