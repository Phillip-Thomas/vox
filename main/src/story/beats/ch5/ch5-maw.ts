import { resolveObjective } from './objective-ch5-maw.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch5-maw.ts';

/** The authored behaviour and journey declaration for ch5-maw. */
export const beatCh5Maw = defineBeat({
  id: "ch5-maw",
  chapter: "ch5",
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
  marker: (handles, candidate) => handles.target(candidate.id === 'maw:observe-pond-response' || candidate.id === 'maw:resonance-settling' ? 'pond-shore' : 'maw-pack'),
  journey: [
  {
    "id": "objective:ch5:ch5-maw",
    "beat": "ch5-maw",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Attend the dropped pack, acquire the repair kit, and restore the Maw through physical steps.",
      "completionEvidenceRefs": [
        "milestone:story:ch5:maw-repaired",
        "milestone:maw_repaired"
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
      "whyNow": "W-7744's departure leaves capability without issued purpose, allowing repair to become the player's first chosen direction.",
      "capability": "Multi-stage tool repair and directional handback.",
      "storyFunction": "Transforms abandoned Authority equipment into a self-directed instrument.",
      "expectedPlayerSeconds": {
        "min": 45,
        "max": 360
      },
      "spatialTolerance": "Pack, kit, work target, and handback remain reachable on dry ground with exclusive required prompts.",
      "recovery": "Every completed repair stage persists across reload and guidance resumes at the next physical step.",
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
