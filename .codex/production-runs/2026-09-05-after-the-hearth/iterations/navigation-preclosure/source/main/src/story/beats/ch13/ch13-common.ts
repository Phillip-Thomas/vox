import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch13CommonObjective } from '../objectivePrimitives.ts';
import { tick } from '../../autopilot/rail-ch13-common.ts';

/** The authored behaviour and journey declaration for ch13-common. */
export const beatCh13Common = defineBeat({
  id: 'ch13-common',
  chapter: 'ch13',
  disposition: 'objective',
  entry: 'sequence',
  objective: facts => ch13CommonObjective(facts.ch13CommonState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
    feedEffects: false,
    embodiedGuidance: true,
    earlyTouchDpad: false,
    externalCamera: false
  },
  rail: { stuckAfterSeconds: 420, waitReason: 'HOLDING THE FAR REFERENCE', tick },
  marker: (handles, candidate) => handles.commonGround(candidate.id),
  journey: [
    {
      id: 'objective:ch13:ch13-common',
      beat: 'ch13-common',
      criticality: 'mandatory',
      interaction: {
        intent: 'Walk the full eighteen-unit common span under the reference W-7744 maintains at H, then stand at the separate far reference, offer that end, and remain there while he makes his own complete test.',
        completionEvidenceRefs: [
          'milestone:story:ch13-reciprocal-crossed',
          'milestone:story:ch13-complete'
        ],
        forbiddenInteractionIds: [],
        feedbackWithinMs: 1000
      },
      postconditions: {
        clearPromptWithinFrames: 2,
        clearMarkerWithinFrames: 2,
        mustNotReappearWithoutStateChange: true
      },
      placementFitness: {
        whyNow: 'She has just watched a route become demonstrable because somebody else held an end; this is where she needs one held for her, and then holds one back.',
        capability: 'Following the visible common guide, standing still, and one [F]. The guide is a planned, unverified line and not a route she has walked; the two uncredited two-unit positioning legs are his, and prove nothing.',
        storyFunction: 'She accepts another body necessary contribution to a result she wants, and their accounts stay different.',
        expectedPlayerSeconds: { min: 90, max: 600 },
        spatialTolerance: 'Looking away is free and changes nothing; leaving the release cylinder holds the test rather than failing it, and reentry resumes it without a second input.',
        recovery: 'A lapsed reference publishes a return objective and retains every earned fact. Neither saved evidence nor elapsed time exempts a resumed test from live range, sight, occupancy and clearance.',
        blocking: true,
        reviewOwners: ['story', 'score', 'cinematography', 'ux']
      }
    }
  ]
});
