import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { complianceObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch4-comply.ts';

/** The authored behaviour and journey declaration for ch4-comply. */
export const beatCh4Comply = defineBeat({
  id: "ch4-comply",
  chapter: "ch4",
  disposition: "objective",
  entry: "sequence",
  objective: facts => complianceObjective(facts.complianceStage),
  input: {
        ...input.ch3Policy(),
        allowCraft: false,
        recipeAllowed: input.allowNone,
        allowBaseInteraction: id => id === 'drink' || id === 'door'
      },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null, tick },
  marker: (handles) => handles.audit('ch4-comply'),
  journey: [
  {
    "id": "objective:ch4:ch4-comply",
    "beat": "ch4-comply",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Perform both compliance transactions and witness their material regression.",
      "completionEvidenceRefs": [
        "milestone:story:ch4:compliance-complete"
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
      "whyNow": "The player must understand the audit mismatch before obedience can carry legible consequence.",
      "capability": "Causal interaction and consequence recognition.",
      "storyFunction": "Makes compliance self-diminishing without converting it into an abstract morality score.",
      "expectedPlayerSeconds": {
        "min": 35,
        "max": 300
      },
      "spatialTolerance": "Each transaction has a broad reachable interaction zone and cannot be obscured by optional prompts.",
      "recovery": "Each committed transaction persists and the remaining required act receives exclusive prompt priority.",
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
