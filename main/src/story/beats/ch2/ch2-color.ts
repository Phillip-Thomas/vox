import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch2-color.ts';

/** The authored behaviour and journey declaration for ch2-color. */
export const beatCh2Color = defineBeat({
  id: "ch2-color",
  chapter: "ch2",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch2:color:approach-redaction',
    'travel',
    'REDACTED SUBJECT',
    ['FOLLOW THE REDACTED SUBJECT INDICATOR.', 'APPROACH THE SUBJECT.']
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
    "id": "objective:ch2:ch2-color",
    "beat": "ch2-color",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Explore the newly chromatic surface and identify the changed environmental language.",
      "completionEvidenceRefs": [
        "beat:ch2-approach"
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
      "whyNow": "Color arrives as a causal consequence and needs a quiet playable interval before another task competes.",
      "capability": "Chromatic landmark and environmental reading.",
      "storyFunction": "Lets the player inhabit rather than merely witness the first reality expansion.",
      "expectedPlayerSeconds": {
        "min": 15,
        "max": 150
      },
      "spatialTolerance": "Several nearby valid observation positions support different camera and movement choices.",
      "recovery": "Guidance returns after wandering without moving the player or auto-completing observation.",
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
