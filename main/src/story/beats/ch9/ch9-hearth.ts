import { resolveObjective } from './objective-ch9-settle.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch9-hearth.ts';

/** The authored behaviour and journey declaration for ch9-hearth. */
export const beatCh9Hearth = defineBeat({
  id: "ch9-hearth",
  chapter: "ch9",
  disposition: "objective",
  entry: "sequence",
  objective: facts => facts.secondHearthComplete ? {
    id: 'settle:second-hearth-settling',
    kind: 'wait',
    markerLabel: 'SECOND HEARTH · SETTLING',
    workOrder: ['THE SECOND HEARTH IS SAFE.', 'LET THE TWO-WORLD HANDOFF SETTLE.'],
    requiresMarker: false
  } : resolveObjective(facts),
  input: {
        ...input.SANDBOX_POLICY,
        recipeAllowed: input.ch9RecipeAllowed,
        // The landed Kestrel remains a fabricator and narrative anchor, but
        // re-boarding cannot preempt the mandatory settlement/hearth rail.
        allowBaseInteraction: id => id !== 'board'
      },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null, tick },
  marker: (handles, candidate) => handles.settlement(candidate.id.replace(/^settle:/, '')),
  journey: [
  {
    "id": "objective:ch9:ch9-hearth",
    "beat": "ch9-hearth",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Complete a safe rest at the second hearth and return control to two-world free play.",
      "completionEvidenceRefs": [
        "milestone:story:ch9:hearth",
        "milestone:story:tidegarden:two-world-handoff"
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
      "whyNow": "A certified shelter becomes home only after the player safely rests and experiences the new hearth as returnable.",
      "capability": "Safe rest, hearth completion, and free-play handoff.",
      "storyFunction": "Completes the distance-between-fires metaphor without replacing Origin or closing future questions.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 210
      },
      "spatialTolerance": "Rest works throughout the certified shelter envelope and closes transient build interfaces automatically.",
      "recovery": "Interrupted rest preserves the shelter and can resume without replaying settlement transactions.",
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
