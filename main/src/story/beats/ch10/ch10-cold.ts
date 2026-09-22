import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch10ColdObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch10-cold.ts';

/** The authored behaviour and journey declaration for ch10-cold. */
export const beatCh10Cold = defineBeat({
  id: "ch10-cold",
  chapter: "ch10",
  disposition: "objective",
  entry: "reactivation-from-done",
  objective: facts => ch10ColdObjective(facts.ch10ColdState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 200, waitReason: null, tick },
  marker: (handles, candidate) => handles.target(candidate.id === 'station:fault-read' ? 'core' : 'fabricator'),
  journey: [
  {
    "id": "objective:ch10:ch10-cold",
    "beat": "ch10-cold",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Read the habitat core's fault record, then carry it to the Kestrel Fabricator and receive the refusal.",
      "completionEvidenceRefs": [
        "milestone:story:ch10-fault-read",
        "milestone:story:ch10-fabrication-refused"
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
      "whyNow": "The finished home is the only place a need a world cannot answer can be noticed, and it must be noticed rather than announced.",
      "capability": "Diagnose a machine's own account of itself, then attempt the shipped craft verb against an issued component.",
      "storyFunction": "Exhausts self-sufficiency on camera before anything is asked of another party.",
      "expectedPlayerSeconds": {
        "min": 60,
        "max": 420
      },
      "spatialTolerance": "The core and the fabricator are both fixed shipped handles; the player may wander freely between them and the fault never worsens on a timer.",
      "recovery": "Both objectives persist until performed and there is no failure state to recover from.",
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
