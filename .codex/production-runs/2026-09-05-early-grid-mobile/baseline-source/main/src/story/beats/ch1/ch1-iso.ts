import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-iso.ts';

/** The authored behaviour and journey declaration for ch1-iso. */
export const beatCh1Iso = defineBeat({
  id: "ch1-iso",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch1:iso:reach-signal-source',
    'travel',
    'SIGNAL SOURCE',
    ['FOLLOW THE SIGNAL SOURCE MARKER.', 'ASCEND TO THE SUMMIT.']
  ),
  input: { ...input.rasterPolicy(), targetDpr: input.ISO_DPR, targetFov: 38 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": true,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 75, waitReason: null, tick },
  marker: (handles) => handles.target('summit'),
  journey: [
  {
    "id": "objective:ch1:ch1-iso",
    "beat": "ch1-iso",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Reach and inspect the signal mesa from the expanded navigable field.",
      "completionEvidenceRefs": [
        "milestone:story:ch1:iso"
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
      "whyNow": "The signal becomes a destination only after the player can choose paths in more than one direction.",
      "capability": "Landmark navigation and elevation approach.",
      "storyFunction": "Makes distant evidence interrupt the Authority task sequence.",
      "expectedPlayerSeconds": {
        "min": 25,
        "max": 210
      },
      "spatialTolerance": "The summit trigger accepts natural arrival positions and never demands a hidden row alignment.",
      "recovery": "Directional guidance points around hazards and reset returns to nearby flat ground.",
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
