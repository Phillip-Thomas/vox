import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-raster.ts';

/** The authored behaviour and journey declaration for ch1-raster. */
export const beatCh1Raster = defineBeat({
  id: "ch1-raster",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: facts => facts.ch1RasterState === 'quota'
    ? objective(
        'ch1:raster:extract-fiber-quota',
        'interact',
        'SITE QUOTA · BIOFIBER OUTSTANDING',
        [
          'HULL DEBRIS RECOVERED. BIOFIBER QUOTA OUTSTANDING.',
          // The line the chapter was missing. A standing extract exhausts the
          // ground within reach and then reports nothing at all.
          'A CELL YIELDS ONCE. HOLD [E] AND WALK [A]/[D] ALONG THE STRIP.'
        ],
        false
      )
    : objective(
        'ch1:raster:recover-quota',
        'interact',
        'SITE QUOTA · RECOVER MATERIALS',
        [
          // The beat will not advance until EVERY scattered piece is recovered,
          // so the copy has to say the bracketed debris is the gate, not scenery.
          'RECOVER EVERY BRACKETED PIECE OF HULL DEBRIS.',
          // Debris is walk-over collection, NOT an extract verb.
          'WALK OVER EACH PIECE TO RECOVER IT.'
        ],
        false
      ),
  input: input.rasterPolicy(),
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": true,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 95, waitReason: null, tick },
  marker: null,
  journey: [
  {
    "id": "objective:ch1:ch1-raster",
    "beat": "ch1-raster",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Collect the complete raster quota from reachable objects on the task row.",
      "completionEvidenceRefs": [
        "milestone:story:ch1:quota"
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
      "whyNow": "Collection gives the flat world material stakes before depth and free navigation become available.",
      "capability": "Reachable collection and quota comprehension.",
      "storyFunction": "Embodies the Authority habit of reducing survival to counted work.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 180
      },
      "spatialTolerance": "Every required collectible is on the legal row with redundant interaction reach.",
      "recovery": "Collected state persists while missed targets remain explicitly marked.",
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
