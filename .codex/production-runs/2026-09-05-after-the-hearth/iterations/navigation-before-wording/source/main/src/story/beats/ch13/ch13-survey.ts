import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch13SurveyObjective } from '../objectivePrimitives.ts';
import { tick } from '../../autopilot/rail-ch13-survey.ts';

/** The authored behaviour and journey declaration for ch13-survey. */
export const beatCh13Survey = defineBeat({
  id: 'ch13-survey',
  chapter: 'ch13',
  disposition: 'objective',
  entry: 'sequence',
  objective: facts => ch13SurveyObjective(facts.ch13SurveyState, facts.ch13HoldReason),
  input: { ...input.SANDBOX_POLICY },
  hud: {
    feedEffects: false,
    embodiedGuidance: true,
    earlyTouchDpad: false,
    externalCamera: false
  },
  // His test takes as long as his legs take, and a revision is unlimited and
  // free, so the ceiling is generous. A rail timeout is a STUCK REPORT and is
  // never permitted to pass the transaction.
  rail: { stuckAfterSeconds: 420, waitReason: 'W-7744 IS TESTING THE OFFERED SPAN', tick },
  marker: (handles, candidate) => handles.commonGround(candidate.id),
  journey: [
    {
      id: 'objective:ch13:ch13-survey',
      beat: 'ch13-survey',
      criticality: 'mandatory',
      interaction: {
        intent: 'Offer to demonstrate a route, walk a trace from the survey start to the survey end, offer the walked span, and then either hold the intermediate reference or revise the untested tail until a route is actually tested.',
        completionEvidenceRefs: ['milestone:story:ch13-route-tested'],
        forbiddenInteractionIds: [],
        feedbackWithinMs: 1000
      },
      postconditions: {
        clearPromptWithinFrames: 2,
        clearMarkerWithinFrames: 2,
        mustNotReappearWithoutStateChange: true
      },
      placementFitness: {
        whyNow: 'She arrives believing her crossing finished the proof; this is the first time anything has asked her to make it demonstrable to somebody else.',
        capability: 'Walking, and one [F]. Nothing here needs a new verb, and nothing here is a puzzle.',
        storyFunction: 'Separates traversability from demonstrability, and makes the difference physical rather than stated.',
        expectedPlayerSeconds: { min: 120, max: 900 },
        spatialTolerance: 'Both measured route classes complete. A first-try success on the longer supported route is legal and is not a lesser outcome.',
        recovery: 'Every refusal names its literal physical cause and has a reachable repair: revise the tail, revise unsafe footing, or occupy the marked reference. Revision is unlimited, free, and preserves the tested prefix.',
        blocking: true,
        reviewOwners: ['story', 'score', 'cinematography', 'ux']
      }
    }
  ]
});
