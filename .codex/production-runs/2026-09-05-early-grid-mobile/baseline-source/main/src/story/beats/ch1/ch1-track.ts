import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';

/** The authored behaviour and journey declaration for ch1-track. */
export const beatCh1Track = defineBeat({
  id: "ch1-track",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch1:track:tracking-transfer',
    'wait',
    'TRACKING VIEW · CALIBRATING',
    ['TRACKING VIEW IS REASSIGNING.', 'HOLD POSITION.'],
    false
  ),
  input: { ...input.rasterPolicy(), moveSpeedScale: 0 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": false,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 20, waitReason: "TRACKING VIEW REASSIGNING" },
  marker: null,
  journey: [
  {
    "id": "objective:ch1:ch1-track",
    "beat": "ch1-track",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Follow the readable side-on task path and establish directional movement.",
      "completionEvidenceRefs": [
        "milestone:story:ch1:track"
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
      "whyNow": "A clear traversal beat teaches authored direction before collection and dimensional expansion add complexity.",
      "capability": "Directional traversal in the two-dimensional frame.",
      "storyFunction": "Makes the imposed track physically legible to the player.",
      "expectedPlayerSeconds": {
        "min": 10,
        "max": 120
      },
      "spatialTolerance": "All mandatory targets occupy the one legal task row and tolerate ordinary approach angles.",
      "recovery": "Backtracking remains possible and movie navigation cannot leave the legal row.",
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
