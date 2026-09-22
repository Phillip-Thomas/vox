import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { gatherObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch3-gather.ts';

/** The authored behaviour and journey declaration for ch3-gather. */
export const beatCh3Gather = defineBeat({
  id: "ch3-gather",
  chapter: "ch3",
  disposition: "objective",
  entry: "sequence",
  objective: facts => gatherObjective(facts.gatherStage),
  input: input.ch3Policy(),
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 34, waitReason: null, tick },
  marker: (handles, candidate) => handles.gather(candidate.id === 'ch3:gather:recover-flint' ? 'flint' : 'current'),
  journey: [
  {
    "id": "objective:ch3:ch3-gather",
    "beat": "ch3-gather",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Gather the materials required for the first campfire without obscuring the next task.",
      "completionEvidenceRefs": [
        "beat:ch3-dusk"
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
      "whyNow": "The living world first asks for reciprocal material attention rather than another abstract perception test.",
      "capability": "Resource gathering and recipe comprehension.",
      "storyFunction": "Begins the fire metaphor through player labor and local materials.",
      "expectedPlayerSeconds": {
        "min": 30,
        "max": 300
      },
      "spatialTolerance": "Nearby resources remain quality-independent and reachable by safe grounded routes.",
      "recovery": "Partial inventory persists and guidance identifies the remaining ingredient rather than a generic goal.",
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
