import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { landfallObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch8-landfall.ts';

/** The authored behaviour and journey declaration for ch8-landfall. */
export const beatCh8Landfall = defineBeat({
  id: "ch8-landfall",
  chapter: "ch8",
  disposition: "objective",
  entry: "sequence",
  objective: facts => landfallObjective(facts.ch8LandfallState),
  input: { ...input.SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: input.allowNone },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: "MAKING LANDFALL", tick },
  marker: null,
  journey: [
  {
    "id": "objective:ch8:ch8-landfall",
    "beat": "ch8-landfall",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Descend to Tidegarden, land on validated terrain, and regain surface control.",
      "completionEvidenceRefs": [
        "milestone:story:ch8:landfall",
        "state:space-flight/phase=surface",
        "state:space-flight/control-mode=fps"
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
      "whyNow": "The crossing needs a physical handback on a visibly different abundant world before settlement work begins.",
      "capability": "Planetary descent, safe landing, and surface handoff.",
      "storyFunction": "Reveals verdant diversity without treating the second world as a hostile biome gimmick.",
      "expectedPlayerSeconds": {
        "min": 30,
        "max": 300
      },
      "spatialTolerance": "Ship and player spawn validation require flat dry ground and reject water or obstructed terrain.",
      "recovery": "Invalid landing candidates reroute before handback and never spawn ship or character in water.",
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
