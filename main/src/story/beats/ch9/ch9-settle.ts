import { resolveObjective } from './objective-ch9-settle.ts';
import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { tick } from './rail-ch9-settle.ts';

/** The authored behaviour and journey declaration for ch9-settle. */
export const beatCh9Settle = defineBeat({
  id: "ch9-settle",
  chapter: "ch9",
  disposition: "objective",
  entry: "sequence",
  objective: resolveObjective,
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
    "id": "objective:ch9:ch9-settle",
    "beat": "ch9-settle",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Attend a local relationship, choose a valid site, place the habitat core, and certify shelter.",
      "completionEvidenceRefs": [
        "milestone:story:ch9:settled",
        "milestone:story:tidegarden:shelter-certified"
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
      "whyNow": "Landfall provides presence but not belonging, so settlement begins by attending before claiming a site.",
      "capability": "Observation, site choice, base placement, and shelter certification.",
      "storyFunction": "Frames abundance as relationship and choice rather than entitlement or extraction.",
      "expectedPlayerSeconds": {
        "min": 120,
        "max": 900
      },
      "spatialTolerance": "Many dry level clear sites remain valid and no exact prescribed settlement layout is required.",
      "recovery": "Rejected sites explain the failing condition and preserve resources until a valid choice is committed.",
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
