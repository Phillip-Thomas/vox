import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { crossingObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch8-crossing.ts';

/** The authored behaviour and journey declaration for ch8-crossing. */
export const beatCh8Crossing = defineBeat({
  id: "ch8-crossing",
  chapter: "ch8",
  disposition: "objective",
  entry: "sequence",
  objective: facts => crossingObjective(facts.ch8CrossingState),
  input: { ...input.SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: input.allowNone },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: "CROSSING TO TIDEGARDEN", tick },
  marker: (handles) => handles.target('tidegarden'),
  journey: [
  {
    "id": "objective:ch8:ch8-crossing",
    "beat": "ch8-crossing",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Navigate the local system crossing and commit the full Tidegarden identity as destination.",
      "completionEvidenceRefs": [
        "milestone:story:ch8:crossed",
        "state:system-flight/active-planet=-1,-1:p1"
      ],
      "forbiddenInteractionIds": [],
      "feedbackWithinMs": 1000
    },
    "postconditions": {
      "clearPromptWithinFrames": 2,
      "clearMarkerWithinFrames": 2,
      "mustNotReappearWithoutStateChange": true
    },
    "placementFitness": {
      "whyNow": "After ascent clears the home surface, the player can experience distance without spending later interstellar spectacle.",
      "capability": "Local system navigation and destination commitment.",
      "storyFunction": "Creates a felt interval between fires and preserves both worlds as distinct places.",
      "expectedPlayerSeconds": {
        "min": 35,
        "max": 300
      },
      "spatialTolerance": "Course capture permits varied steering while binding the complete canonical planet identity.",
      "recovery": "Course deviation remains correctable and reload restores the authoritative phase and destination bundle.",
      "blocking": true,
      "reviewOwners": [
        "story",
        "score",
        "cinematography",
        "ux"
      ]
    }
  }
]
});
