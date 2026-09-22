import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { launchObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch8-launch.ts';

/** The authored behaviour and journey declaration for ch8-launch. */
export const beatCh8Launch = defineBeat({
  id: "ch8-launch",
  chapter: "ch8",
  disposition: "objective",
  entry: "sequence",
  objective: facts => launchObjective(facts.ch8LaunchState),
  input: { ...input.SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: input.allowNone },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: "LEAVING THE ORIGIN WORLD", tick },
  marker: (handles) => handles.target('hatch'),
  journey: [
  {
    "id": "objective:ch8:ch8-launch",
    "beat": "ch8-launch",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Ignite, leave the Origin surface, and establish stable flight control.",
      "completionEvidenceRefs": [
        "milestone:story:ch8:launched",
        "state:space-flight/phase=deep_space"
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
      "whyNow": "The player has repaired, calibrated, and boarded the ship, so launch is the earned release of stored capability.",
      "capability": "Ship ignition, ascent, and flight stabilization.",
      "storyFunction": "Turns leaving into a physical choice while preserving Origin as a returnable home.",
      "expectedPlayerSeconds": {
        "min": 25,
        "max": 210
      },
      "spatialTolerance": "Launch clearance and control handoff tolerate supported frame rates and do not require exact steering input.",
      "recovery": "Interrupted launch restores a stable ship state or resumes from the last authoritative flight phase.",
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
