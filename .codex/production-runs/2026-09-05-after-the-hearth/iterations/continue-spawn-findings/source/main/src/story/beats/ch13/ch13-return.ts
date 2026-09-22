import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch13ReturnObjective } from '../objectivePrimitives.ts';
import { tick } from '../../autopilot/rail-ch13-return.ts';

/** The authored behaviour and journey declaration for ch13-return. */
export const beatCh13Return = defineBeat({
  id: 'ch13-return',
  chapter: 'ch13',
  disposition: 'objective',
  entry: 'sequence',
  objective: facts => ch13ReturnObjective(facts.ch13ReturnState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
    feedEffects: false,
    embodiedGuidance: true,
    earlyTouchDpad: false,
    externalCamera: false
  },
  rail: { stuckAfterSeconds: 300, waitReason: 'HOLDING THE COURSE', tick },
  marker: (handles, candidate) => handles.commonGround(candidate.id),
  journey: [
    {
      id: 'objective:ch13:ch13-return',
      beat: 'ch13-return',
      criticality: 'mandatory',
      interaction: {
        intent: 'Board the Kestrel, hold the ignition control to lift, fly to Origin and land at the audit site, then approach W-7744 on foot.',
        completionEvidenceRefs: [
          'state:control/flight',
          'state:system-flight/active-planet=p1',
          'milestone:story:ch13-origin-landed'
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
        whyNow: 'Going back is the choice she just made, so the trip is hers to fly and nothing about it is new.',
        capability: 'The shipped boarding, held-ignition and landing grammar, unchanged, aimed at a place the story already owns.',
        storyFunction: 'Puts real distance between the decision and its consequence without narrating either.',
        expectedPlayerSeconds: { min: 90, max: 600 },
        spatialTolerance: 'Travel rungs do not fail on course drift; the audit-site marker is a fixed pose and the approach is walked.',
        recovery: 'Shipped flight rescue applies unchanged and never lands, claims or advances on the player behalf.',
        blocking: true,
        reviewOwners: ['story', 'score', 'cinematography', 'ux']
      }
    }
  ]
});
