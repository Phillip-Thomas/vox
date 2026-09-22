import { resolveObjective } from './objective-ch6-dive.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch6-dive.ts';

/** The authored behaviour and journey declaration for ch6-dive. */
export const beatCh6Dive = defineBeat({
  id: "ch6-dive",
  chapter: "ch6",
  disposition: "objective",
  entry: "sequence",
  objective: resolveObjective,
  input: {
        ...input.SANDBOX_POLICY,
        allowBuild: false,
        recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id),
        allowBaseInteraction: id => id !== 'board'
      },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null, tick },
  marker: (handles, candidate) => handles.target(candidate.id === 'dive:surface-with-keel' ? 'pond-surface' : candidate.id === 'dive:return-to-shore' ? 'pond-shore' : 'keel'),
  journey: [
  {
    "id": "objective:ch6:ch6-dive",
    "beat": "ch6-dive",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Enter the water, manage oxygen, free the Keel memory, surface legally, and bank it on shore.",
      "completionEvidenceRefs": [
        "milestone:story:ch6:keel-banked"
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
      "whyNow": "Repairing the Maw gives the player a reason to enter a previously avoided medium and recover embodied ship memory.",
      "capability": "Swimming, oxygen management, recovery, and dry banking.",
      "storyFunction": "Makes knowledge physical, breath-limited, and carried back rather than downloaded.",
      "expectedPlayerSeconds": {
        "min": 60,
        "max": 480
      },
      "spatialTolerance": "Waterline, submerged target, surfacing, and bank zones support varied legal approaches with visible oxygen feedback.",
      "recovery": "Failed dives return the player to a dry bank without granting acquire, surface, or bank receipts.",
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
