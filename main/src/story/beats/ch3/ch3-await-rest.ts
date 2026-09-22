import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch3-await-rest.ts';

/** The authored behaviour and journey declaration for ch3-await-rest. */
export const beatCh3AwaitRest = defineBeat({
  id: "ch3-await-rest",
  chapter: "ch3",
  disposition: "objective",
  entry: "sequence",
  objective: facts => facts.restPhase === 'rest-at-fire'
    ? objective(
        'ch3:rest:rest-at-fire',
        'interact',
        'CAMPFIRE · REST',
        ['RETURN TO THE CAMPFIRE.', '[F] REST.']
      )
    : objective(
        'ch3:rest:wait-for-night',
        'wait',
        'CAMPFIRE · WAIT FOR NIGHT',
        ['REMAIN NEAR THE CAMPFIRE.', 'WAIT FOR NIGHT.']
      ),
  input: input.ch3Policy(),
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 70, waitReason: "WAITING FOR NIGHT", tick },
  marker: (handles) => handles.target('fire'),
  journey: [
  {
    "id": "objective:ch3:ch3-await-rest",
    "beat": "ch3-await-rest",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Rest at the completed campfire and allow the night-to-dawn transition to settle.",
      "completionEvidenceRefs": [
        "milestone:story:a3"
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
      "whyNow": "Crafting the fire needs immediate embodied payoff before survival needs redirect attention elsewhere.",
      "capability": "Rest interaction and safe-state recognition.",
      "storyFunction": "Makes the first hearth a temporal shelter rather than a decorative prop.",
      "expectedPlayerSeconds": {
        "min": 8,
        "max": 90
      },
      "spatialTolerance": "Rest accepts a broad safe radius and closes any crafting panel before cinematic control begins.",
      "recovery": "Interrupted rest returns control cleanly and can be resumed without rebuilding the fire.",
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
