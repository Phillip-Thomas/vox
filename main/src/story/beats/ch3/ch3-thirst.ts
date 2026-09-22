import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch3-thirst.ts';

/** The authored behaviour and journey declaration for ch3-thirst. */
export const beatCh3Thirst = defineBeat({
  id: "ch3-thirst",
  chapter: "ch3",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch3:thirst:drink-water',
    'interact',
    'DRINKABLE WATER',
    ['FOLLOW THE WATER MARKER.', 'LOOK AT THE WATER AND [F] DRINK.']
  ),
  input: { ...input.ch3Policy(), recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id) },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 75, waitReason: null, tick },
  marker: (handles) => handles.target('pond-surface'),
  journey: [
  {
    "id": "objective:ch3:ch3-thirst",
    "beat": "ch3-thirst",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Find safe water, look down naturally when near it, and drink through the real interaction.",
      "completionEvidenceRefs": [
        "milestone:story:ch3:drank"
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
      "whyNow": "Dawn converts the protected camp into a body with needs and teaches attention below the horizon.",
      "capability": "Water discovery, contextual gaze, and drinking.",
      "storyFunction": "Grounds awakening in dependence on the world rather than power over it.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 210
      },
      "spatialTolerance": "The drink gaze cone includes natural downward angles while off-screen guidance points toward water.",
      "recovery": "Unsafe approaches redirect to a dry bank and reset never spawns the player in water.",
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
