import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { vigilObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch4-vigil.ts';

/** The authored behaviour and journey declaration for ch4-vigil. */
export const beatCh4Vigil = defineBeat({
  id: "ch4-vigil",
  chapter: "ch4",
  disposition: "objective",
  entry: "sequence",
  objective: facts => vigilObjective(facts.vigilPhase),
  input: { ...input.ch3Policy(), recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id) },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 140, waitReason: "KEEPING THE VIGIL", tick },
  marker: (handles, candidate) => handles.target(candidate.id.includes('rest') ? 'fire' : 'relay'),
  journey: [
  {
    "id": "objective:ch4:ch4-vigil",
    "beat": "ch4-vigil",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Hold vigil at the fire and observe the arrival without abandoning embodied control.",
      "completionEvidenceRefs": [
        "milestone:story:ch4:vigil"
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
      "whyNow": "The player has built attachment to the hearth, so waiting there gives the arriving audit something felt to threaten.",
      "capability": "Sustained attention and cinematic handoff.",
      "storyFunction": "Frames institutional return against a player-made source of warmth.",
      "expectedPlayerSeconds": {
        "min": 12,
        "max": 120
      },
      "spatialTolerance": "A generous fireside envelope accepts standing or seated-looking positions without exact gaze lock.",
      "recovery": "Leaving pauses the vigil and returning resumes it without replaying the entire approach.",
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
