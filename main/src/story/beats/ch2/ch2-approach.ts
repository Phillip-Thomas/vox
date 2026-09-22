import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch2-approach.ts';

/** The authored behaviour and journey declaration for ch2-approach. */
export const beatCh2Approach = defineBeat({
  id: "ch2-approach",
  chapter: "ch2",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch2:approach:eat-fruit',
    'interact',
    'REDACTED SUBJECT · FRUIT',
    ['APPROACH THE FRUIT AT HAND HEIGHT.', '[F] EAT.']
  ),
  input: { ...input.embodiedSurveyPolicy(), lookMode: 'free', feedBlend: 1 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 45, waitReason: null, tick },
  marker: (handles) => handles.target('tree'),
  journey: [
  {
    "id": "objective:ch2:ch2-approach",
    "beat": "ch2-approach",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Approach the awakened landmark and accept the embodied camera handoff.",
      "completionEvidenceRefs": [
        "beat:a2-awakening"
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
      "whyNow": "Free exploration needs a precise emotional destination before the next survival chapter opens.",
      "capability": "Natural approach and embodied first-person attention.",
      "storyFunction": "Turns expanded perception into an intimate encounter with the living world.",
      "expectedPlayerSeconds": {
        "min": 15,
        "max": 150
      },
      "spatialTolerance": "The approach volume accepts multiple grounded paths and a natural forward gaze.",
      "recovery": "Leaving the area preserves the marker and returning resumes the handoff cleanly.",
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
