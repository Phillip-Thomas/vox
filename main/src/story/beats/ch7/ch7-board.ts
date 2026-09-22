import { resolveObjective } from './objective-ch7-board.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch7-board.ts';

/** The authored behaviour and journey declaration for ch7-board. */
export const beatCh7Board = defineBeat({
  id: "ch7-board",
  chapter: "ch7",
  disposition: "objective",
  entry: "sequence",
  objective: resolveObjective,
  input: { ...input.SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: input.allowNone },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null, tick },
  marker: (handles) => handles.target('hatch'),
  journey: [
  {
    "id": "objective:ch7:ch7-board",
    "beat": "ch7-board",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Enter the restored hatch, complete pressure transfer, and receive cockpit flight control.",
      "completionEvidenceRefs": [
        "milestone:story:ch7:boarded",
        "state:space-flight/control-mode=flight"
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
      "whyNow": "Boarding follows verified flight readiness so a cinematic transfer cannot conceal unfinished physical repair.",
      "capability": "Physical boarding and control-mode transfer.",
      "storyFunction": "Lets the player inhabit the repaired vessel before asking it to leave home.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 180
      },
      "spatialTolerance": "The hatch transaction tolerates ordinary approach angles and cannot trigger from outside the boarding envelope.",
      "recovery": "Cancelled boarding restores surface control and can restart without duplicating pressure or receipt events.",
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
