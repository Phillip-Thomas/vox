import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-fixed.ts';

/** The authored behaviour and journey declaration for ch1-fixed. */
export const beatCh1Fixed = defineBeat({
  id: "ch1-fixed",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: facts => facts.ch1FixedState === 'salvage'
    ? objective('ch1:fixed:recover-first-debris', 'interact', 'DEBRIS', ['WALK OVER THE DEBRIS TO RECOVER IT.'], false)
    : facts.ch1FixedState === 'traverse'
      ? objective('ch1:fixed:cross-camera-cell', 'travel', 'NEXT CAMERA', ['WALK [A]/[D] TO THE NEXT CAMERA.'], false)
      : objective('ch1:fixed:calibrate-extractor', 'interact', 'BIOFIBER', ['HOLD [E] TO HARVEST BIOFIBER.'], false),
  input: input.rasterPolicy(),
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": true,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 55, waitReason: null, tick },
  marker: null,
  journey: [
  {
    "id": "objective:ch1:ch1-fixed",
    "beat": "ch1-fixed",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Regain embodied control after impact and traverse the fixed presentation safely.",
      "completionEvidenceRefs": [
        "beat:ch1-track"
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
      "whyNow": "The crash must become playable before the perception ladder can ask the player to interpret it.",
      "capability": "Embodied locomotion and task-row orientation.",
      "storyFunction": "Turns passive survival into the first deliberate movement.",
      "expectedPlayerSeconds": {
        "min": 8,
        "max": 90
      },
      "spatialTolerance": "The complete task remains reachable on the single traversable row without jetpack correction.",
      "recovery": "Reset restores a safe surface position without awarding the objective.",
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
