import { resolveObjective } from './objective-ch7-reconstruct.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch7-reconstruct.ts';

/** The authored behaviour and journey declaration for ch7-reconstruct. */
export const beatCh7Reconstruct = defineBeat({
  id: "ch7-reconstruct",
  chapter: "ch7",
  disposition: "objective",
  entry: "sequence",
  objective: resolveObjective,
  input: {
        ...input.SANDBOX_POLICY,
        allowBuild: false,
        recipeAllowed: input.ch7RecipeAllowed,
        allowBaseInteraction: id => id !== 'board'
      },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null, tick },
  marker: (handles, candidate) => handles.target(candidate.id === 'reconstruct:diagnose' ? 'wreck' : 'workstation'),
  journey: [
  {
    "id": "objective:ch7:ch7-reconstruct",
    "beat": "ch7-reconstruct",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Diagnose the scar, restore the same wreck through every stage, calibrate it, and bring the Tidegarden route online.",
      "completionEvidenceRefs": [
        "milestone:story:ch7:flight-ready",
        "state:ship-restoration/flight_ready",
        "milestone:story:route:tidegarden:online"
      ],
      "forbiddenInteractionIds": [
        "story-wreck-scar-attend"
      ],
      "feedbackWithinMs": 1000
    },
    "postconditions": {
      "clearPromptWithinFrames": 2,
      "clearMarkerWithinFrames": 2,
      "mustNotReappearWithoutStateChange": true
    },
    "placementFitness": {
      "whyNow": "The banked Keel memory and repaired Maw make the scarred ship legible as a recoverable relationship rather than a replacement prize.",
      "capability": "Staged ship restoration, diagnosis, and calibration.",
      "storyFunction": "Converts accumulated local knowledge into chosen travel capability while retaining visible damage.",
      "expectedPlayerSeconds": {
        "min": 90,
        "max": 720
      },
      "spatialTolerance": "Required bench interactions accept broad grounded access and always outrank optional scar observation.",
      "recovery": "Every stage and calibration receipt persists; reload resumes at the next incomplete physical transaction.",
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
