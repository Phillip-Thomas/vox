import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';

/** The authored behaviour and journey declaration for ch1-lift. */
export const beatCh1Lift = defineBeat({
  id: "ch1-lift",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch1:lift:perspective-transfer',
    'wait',
    'FIRST-PERSON LINK · CALIBRATING',
    ['PERSPECTIVE TRANSFER IS ACTIVE.', 'HOLD POSITION.'],
    false
  ),
  input: { ...input.rasterPolicy(), moveSpeedScale: 0, targetDpr: input.ISO_DPR },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": false,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 20, waitReason: "PERSPECTIVE TRANSFER" },
  marker: null,
  journey: [
  {
    "id": "objective:ch1:ch1-lift",
    "beat": "ch1-lift",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Use the newly revealed vertical affordance without losing grounded orientation.",
      "completionEvidenceRefs": [
        "beat:ch1-anomaly"
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
      "whyNow": "Vertical movement follows landmark navigation so the player expands one spatial assumption at a time.",
      "capability": "Controlled elevation and safe grounded return.",
      "storyFunction": "Prepares the body to encounter evidence outside the original plane.",
      "expectedPlayerSeconds": {
        "min": 8,
        "max": 90
      },
      "spatialTolerance": "A broad target envelope accepts natural ascent and landing rather than exact hovering.",
      "recovery": "Fuel, fall, and landing failures return the player to a safe nearby surface without completion.",
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
