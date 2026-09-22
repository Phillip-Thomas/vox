import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch10TransitObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch10-transit.ts';

/** The authored behaviour and journey declaration for ch10-transit. */
export const beatCh10Transit = defineBeat({
  id: "ch10-transit",
  chapter: "ch10",
  disposition: "objective",
  entry: "sequence",
  objective: facts => ch10TransitObjective(facts.ch10TransitState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 260, waitReason: "HOLDING THE BEARING", tick },
  marker: (handles, candidate) => handles.target(candidate.id === 'station:transit:reboard' ? 'fabricator' : 'station'),
  journey: [
  {
    "id": "objective:ch10:ch10-transit",
    "beat": "ch10-transit",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Launch on the claimed bearing and hold course until the source resolves at standoff; after the threshold hand-back, close the final corridor and request docking clearance if desired.",
      "completionEvidenceRefs": [
        "milestone:story:ch10-transit-ignited",
        "milestone:story:ch10-seam-passed",
        "milestone:story:ch10-station-resolved"
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
      "whyNow": "The bearing was issued but the going is the player's, so the last act of the chapter is a flight nobody ordered.",
      "capability": "ch8 launch and cruise grammar aimed at a non-planet target for the first time in the story.",
      "storyFunction": "Scale and smallness, then threshold restraint: the station resolves before the hand-back opens the already-earned bearing into a real place the player may enter.",
      "expectedPlayerSeconds": {
        "min": 120,
        "max": 600
      },
      "spatialTolerance": "Travel objectives do not fail if course drifts; the seam latch fires once from either its view-cone or its look-independent range condition.",
      "recovery": "Shipped ch8 flight rescue applies unchanged; a rescue never claims or docks on the player's behalf. After the hand-back, normal approach alignment, range, and speed gates remain player-owned.",
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
