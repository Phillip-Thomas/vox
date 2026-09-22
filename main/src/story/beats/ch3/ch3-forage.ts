import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { forageObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch3-forage.ts';

/** The authored behaviour and journey declaration for ch3-forage. */
export const beatCh3Forage = defineBeat({
  id: "ch3-forage",
  chapter: "ch3",
  disposition: "objective",
  entry: "sequence",
  objective: facts => forageObjective(facts),
  input: { ...input.ch3Policy(), recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id) },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 60, waitReason: null, tick },
  marker: (handles) => handles.target('forage'),
  journey: [
  {
    "id": "objective:ch3:ch3-forage",
    "beat": "ch3-forage",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Forage from the living tree and register nourishment without consuming its story role.",
      "completionEvidenceRefs": [
        "milestone:story:ch3:ate"
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
      "whyNow": "Thirst establishes dependence first, allowing food to deepen relationship rather than feel like generic loot.",
      "capability": "Foraging and nourishment interaction.",
      "storyFunction": "Establishes the tree as provider and later protected subject.",
      "expectedPlayerSeconds": {
        "min": 15,
        "max": 150
      },
      "spatialTolerance": "Several reachable fruit interactions support ordinary ground-level approaches.",
      "recovery": "A consumed fruit records immediately and guidance advances instead of leaving the player directionless.",
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
