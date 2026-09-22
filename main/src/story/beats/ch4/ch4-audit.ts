import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { auditObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch4-audit.ts';

/** The authored behaviour and journey declaration for ch4-audit. */
export const beatCh4Audit = defineBeat({
  id: "ch4-audit",
  chapter: "ch4",
  disposition: "objective",
  entry: "sequence",
  objective: facts => auditObjective(facts.auditStage),
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
  marker: (handles) => handles.audit('ch4-audit'),
  journey: [
  {
    "id": "objective:ch4:ch4-audit",
    "beat": "ch4-audit",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Perform the three physical mismatch observations while W-7744 remains constrained to believable movement.",
      "completionEvidenceRefs": [
        "milestone:story:ch4:audit-complete"
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
      "whyNow": "The audit must expose incompatible perception before asking the player to comply with its conclusions.",
      "capability": "Multi-target observation and actor following.",
      "storyFunction": "Shows W-7744's limited world through actions rather than interior exposition.",
      "expectedPlayerSeconds": {
        "min": 45,
        "max": 360
      },
      "spatialTolerance": "All audit targets and actor routes use flat dry ground with visible off-screen direction cues.",
      "recovery": "Completed mismatches persist and the actor waits or reroutes without walking through water.",
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
