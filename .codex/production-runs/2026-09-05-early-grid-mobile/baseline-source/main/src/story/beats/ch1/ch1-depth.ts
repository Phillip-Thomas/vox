import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-depth.ts';

/** The authored behaviour and journey declaration for ch1-depth. */
export const beatCh1Depth = defineBeat({
  id: "ch1-depth",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch1:depth:recover-supply-pods',
    'interact',
    'SUPPLY POD',
    ['FOLLOW THE NEXT SUPPLY POD MARKER.', 'RECOVER THE SUPPLY POD.']
  ),
  input: { ...input.rasterPolicy(), allowMine: false },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": true,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 60, waitReason: null, tick },
  marker: (handles) => handles.target('pod'),
  journey: [
  {
    "id": "objective:ch1:ch1-depth",
    "beat": "ch1-depth",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Resolve the supply-pod work order as depth begins to emerge.",
      "completionEvidenceRefs": [
        "milestone:story:ch1:depth"
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
      "whyNow": "The player has learned the flat work grammar and can now feel spatial depth as a meaningful reveal.",
      "capability": "Depth reading and supply-pod interaction.",
      "storyFunction": "Turns a rendering change into an embodied expansion of the possible.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 180
      },
      "spatialTolerance": "Pods remain reachable from ordinary approaches with markers that survive perspective transition.",
      "recovery": "The objective preserves completed pods and redirects to the nearest unresolved pod.",
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
