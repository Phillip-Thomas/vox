import type { StoryObjectiveGuidanceFacts } from '../objectivePrimitives.ts';
import type { GuidedStoryObjective } from '../../ux/objectiveDirector.ts';

/** Pure presentation from durable/runtime facts. Authored beside ch7-board. */
export function resolveObjective(facts: Readonly<StoryObjectiveGuidanceFacts>): GuidedStoryObjective {
  if (facts.boarding.phase === 'hatch_entering' || facts.boarding.phase === 'transfer_requested') {
    return {
      id: 'board:hatch-in-progress',
      kind: 'wait',
      markerLabel: 'KESTREL HATCH · ENTERING',
      workOrder: [
        'HATCH TRANSFER IN PROGRESS.',
        facts.boarding.inputMode === 'touch'
          ? 'HOLD POSITION · USE TO STEP BACK.'
          : 'HOLD POSITION · ESC TO STEP BACK.'
      ],
      requiresMarker: false
    };
  }
  if (facts.boarding.phase === 'sealing' || facts.boarding.phase === 'handback') {
    return {
      id: 'board:pressure-seal',
      kind: 'wait',
      markerLabel: 'KESTREL · PRESSURE SEAL',
      workOrder: ['PRESSURE BOUNDARY CLOSING.'],
      requiresMarker: false
    };
  }
  if (facts.boarding.phase === 'complete') {
    return {
      id: 'board:cockpit-secured',
      kind: 'wait',
      markerLabel: 'KESTREL · COCKPIT SECURED',
      workOrder: ['COCKPIT CONTROL ESTABLISHED.'],
      requiresMarker: false
    };
  }
  return {
    id: facts.boarding.phase === 'cancelled' ? 'board:return-to-hatch' : 'board:enter-hatch',
    kind: 'interact',
    markerLabel: 'KESTREL HATCH · BOARD',
    workOrder: [
      facts.boarding.phase === 'cancelled' ? 'RETURN TO THE KESTREL HATCH.' : 'APPROACH THE KESTREL HATCH.',
      facts.boarding.inputMode === 'touch' ? 'USE · ENTER THROUGH THE HATCH.' : '[F] ENTER THROUGH THE HATCH.'
    ],
    requiresMarker: true
  };
}
