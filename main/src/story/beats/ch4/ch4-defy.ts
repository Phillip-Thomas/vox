import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { defianceObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch4-defy.ts';

/** The authored behaviour and journey declaration for ch4-defy. */
export const beatCh4Defy = defineBeat({
  id: "ch4-defy",
  chapter: "ch4",
  disposition: "objective",
  entry: "sequence",
  objective: facts => defianceObjective(facts.defianceStage),
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
  marker: (handles) => handles.audit('ch4-defy'),
  journey: [
  {
    "id": "objective:ch4:ch4-defy",
    "beat": "ch4-defy",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Commit the lowercase refusal through the real player interaction and retain its consequence.",
      "completionEvidenceRefs": [
        "milestone:story:ch4:refusal-complete"
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
      "whyNow": "Only after performing compliance and feeling its cost can refusal become an authored act rather than a menu preference.",
      "capability": "Explicit refusal and irreversible story choice.",
      "storyFunction": "Turns will into a player-performed verb and opens material-to-alive authority.",
      "expectedPlayerSeconds": {
        "min": 10,
        "max": 150
      },
      "spatialTolerance": "The refusal control remains focusable and legible across all profiles without competing interactions.",
      "recovery": "Invalid attempts give feedback while a committed refusal persists across reload and cannot double-fire.",
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
