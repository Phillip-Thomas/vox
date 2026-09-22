import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch3-signal.ts';

/** The authored behaviour and journey declaration for ch3-signal. */
export const beatCh3Signal = defineBeat({
  id: "ch3-signal",
  chapter: "ch3",
  disposition: "objective",
  entry: "sequence",
  objective: () => objective(
    'ch3:signal:report-to-wreck',
    'travel',
    'THE WRECK',
    ['FOLLOW THE WRECK MARKER.', 'SPRINT TO THE RELAY.']
  ),
  input: { ...input.ch3Policy(), recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id) },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 60, waitReason: null, tick },
  marker: (handles) => handles.target('relay'),
  journey: [
  {
    "id": "objective:ch3:ch3-signal",
    "beat": "ch3-signal",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Leave the immediate hearth area and investigate the incoming signal.",
      "completionEvidenceRefs": [
        "milestone:story:ch3:signal"
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
      "whyNow": "Once immediate bodily needs are met, an external signal can interrupt the new home without confusing survival guidance.",
      "capability": "Long-range directional guidance and signal investigation.",
      "storyFunction": "Carries the player from private recovery toward the returning institutional gaze.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 210
      },
      "spatialTolerance": "The source occupies navigable two-axis space and never requires task-row alignment.",
      "recovery": "Directional indicators persist off-screen and routes avoid water unless a safe jetpack crossing is chosen.",
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
