import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch13HomeObjective } from '../objectivePrimitives.ts';
import { tick } from '../../autopilot/rail-ch13-home.ts';

/** The authored behaviour and journey declaration for ch13-home. */
export const beatCh13Home = defineBeat({
  id: 'ch13-home',
  chapter: 'ch13',
  disposition: 'objective',
  // The SAME shape chapter 10 uses, for the same reason and at a different
  // door: free play is `active: false`, so the chapter has to be re-activated
  // from inside it. The door here is the actual restored second-hearth core.
  entry: 'reactivation-from-done',
  objective: facts => ch13HomeObjective(facts.ch13HomeState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
    feedEffects: false,
    embodiedGuidance: true,
    earlyTouchDpad: false,
    externalCamera: false
  },
  // The invitation may stand open indefinitely, so a "stuck" report here is
  // about the RAIL, never about the player: nothing in this beat expires.
  rail: { stuckAfterSeconds: 200, waitReason: null, tick },
  marker: (handles, candidate) => handles.commonGround(candidate.id),
  journey: [
    {
      id: 'objective:ch13:ch13-home',
      beat: 'ch13-home',
      criticality: 'mandatory',
      interaction: {
        intent: 'Review the stored audit fault at the working core, then either accept the return to the Origin audit site or leave the invitation standing.',
        completionEvidenceRefs: [
          'milestone:story:ch13-fault-reviewed',
          'milestone:story:ch13-return-chosen'
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
        whyNow: 'The home works again, which is the only condition under which going back to the thing she left unfinished is a choice rather than an errand.',
        capability: 'The shipped [F] interaction at the certified habitat core, against a fault record that has been on the books since chapter 4.',
        storyFunction: 'Turns a mechanical repair into an acknowledged home, and turns the old fault from a loose end into an invitation she owns.',
        expectedPlayerSeconds: { min: 30, max: 600 },
        spatialTolerance: 'The core is a fixed shipped handle; the player may wander freely and the invitation never worsens or expires.',
        recovery: 'Both rungs persist until performed. There is no failure state, no timer and no summons.',
        blocking: true,
        reviewOwners: ['story', 'score', 'cinematography', 'ux']
      }
    }
  ]
});
