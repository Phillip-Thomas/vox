import type { StoryObjectiveGuidanceFacts } from '../objectivePrimitives.ts';
import type { GuidedStoryObjective } from '../../ux/objectiveDirector.ts';

/** Pure presentation from durable/runtime facts. Authored beside ch9-settle. */
export function resolveObjective(facts: Readonly<StoryObjectiveGuidanceFacts>): GuidedStoryObjective {
  const { coreCarried, foundationPlaced, night } = facts.settlement;
  if (!facts.settlement.scanned) {
    return {
      id: 'settle:scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    };
  }
  if (!facts.settlement.attended) {
    return {
      id: 'settle:attend-waterline',
      kind: 'interact',
      markerLabel: 'LIVING WATERLINE · ATTEND',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', '[F] ATTEND THE RELATIONSHIP.']
    };
  }
  const habitat = facts.settlement.habitat;
  if (!habitat) {
    const chosen = facts.settlement.chosen;
    if (!chosen) {
      return {
        id: 'settle:choose-site',
        kind: 'interact',
        markerLabel: 'RECOMMENDED HABITAT SITE · CHOOSE',
        workOrder: ['FOLLOW THE HABITAT SITE MARKER.', '[F] CHOOSE THIS DRY, LEVEL SITE.']
      };
    }
    if (!coreCarried) {
      return {
        id: 'settle:craft-core',
        kind: 'craft',
        markerLabel: 'KESTREL FABRICATOR · CRAFT HABITAT CORE',
        workOrder: [
          'RETURN TO THE FLIGHT-READY KESTREL FABRICATOR.',
          '[C] CRAFT HABITAT CORE.'
        ]
      };
    }
    if (!foundationPlaced) {
      return {
        id: 'settle:foundation',
        kind: 'build',
        markerLabel: 'CHOSEN SITE · PLACE FOUNDATION',
        workOrder: ['[B] PLACE A FOUNDATION AT THE CHOSEN SITE.']
      };
    }
    return {
      id: 'settle:install-core',
      kind: 'interact',
      markerLabel: 'CHOSEN SITE · INSTALL HABITAT CORE',
      workOrder: ['RETURN TO THE CHOSEN FOUNDATION.', '[F] INSTALL HABITAT CORE.']
    };
  }
  if (!habitat.shelterCertification) {
    return {
      id: 'settle:certify-shelter',
      kind: 'build',
      markerLabel: 'HABITAT CORE · ENCLOSE AND CERTIFY',
      workOrder: ['BUILD A CLOSED SHELTER AROUND THE CORE.', '[F] CERTIFY THE WORKING SHELTER.']
    };
  }
  return night
    ? {
        id: 'settle:rest',
        kind: 'interact',
        markerLabel: 'SECOND HEARTH · REST INSIDE',
        workOrder: ['RETURN INSIDE THE CERTIFIED SHELTER.', '[F] REST AT THE SECOND HEARTH.']
      }
    : {
        id: 'settle:wait-night',
        kind: 'wait',
        markerLabel: 'SECOND HEARTH · WAIT FOR NIGHT',
        workOrder: ['RETURN TO THE SECOND HEARTH.', 'REST BECOMES AVAILABLE AT NIGHT.']
      };
}
