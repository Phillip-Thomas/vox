import type { StoryObjectiveGuidanceFacts } from '../objectivePrimitives.ts';
import type { GuidedStoryObjective } from '../../ux/objectiveDirector.ts';

/** Pure presentation from durable/runtime facts. Authored beside ch7-reconstruct. */
export function resolveObjective(facts: Readonly<StoryObjectiveGuidanceFacts>): GuidedStoryObjective {
  if (!facts.reconstruction.diagnosed) {
    return {
      id: 'reconstruct:diagnose',
      kind: 'interact',
      markerLabel: 'WRECK SCAR · TRACE RELATIONSHIPS',
      workOrder: ['FOLLOW THE WRECK MARKER.', 'AIM AT THE SCAR. [F] TRACE RELATIONSHIPS.']
    };
  }

  const target = facts.reconstruction.target;
  if (!target || target === 'wrecked') {
    if (!facts.reconstruction.calibrated) {
      return {
        id: 'reconstruct:calibrating',
        kind: 'wait',
        markerLabel: 'KESTREL · CALIBRATING',
        workOrder: ['FLIGHT CALIBRATION IN PROGRESS.'],
        requiresMarker: false
      };
    }
    return {
      id: 'reconstruct:ready',
      kind: 'wait',
      markerLabel: 'WRECK · FLIGHT READY',
      workOrder: ['FLIGHT CONTROLS CALIBRATED.'],
      requiresMarker: false
    };
  }
  const action = facts.reconstruction.action;
  if (action) {
    return {
      id: `reconstruct:repair:${target}`,
      kind: 'interact',
      markerLabel: `WRECK BENCH · ${action.verb.toUpperCase()}`,
      workOrder: [`RETURN TO THE WRECK BENCH.`, `[F] ${action.verb.toUpperCase()}.`]
    };
  }
  return {
    id: `reconstruct:craft:${target}`,
    kind: 'craft',
    markerLabel: `WRECK BENCH · CRAFT ${facts.reconstruction.craftLabel}`,
    workOrder: ['RETURN TO THE WRECK BENCH.', `[C] OPEN FABRICATOR. CRAFT ${facts.reconstruction.craftLabel}.`]
  };
}
