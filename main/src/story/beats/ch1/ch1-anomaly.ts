import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-anomaly.ts';

/** The authored behaviour and journey declaration for ch1-anomaly. */
export const beatCh1Anomaly = defineBeat({
  id: "ch1-anomaly",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: facts => facts.anomalyDesignated
    ? objective(
        'ch1:anomaly:classify-mass',
        'interact',
        'UNCHARTED MASS',
        [
          // The one line that tells the player the marker points over a gravity
          // edge used to live in CH1_ANOMALY_MASS_ORDER, which this beat writes
          // to the feed's work-order channel — a channel the embodied HUD has
          // already taken over by ch1-anomaly, and which the next tick
          // overwrites anyway. It reached no surface at all. It belongs here,
          // on the store the embodied HUD actually reads.
          'THE MASS IS NOT ON THIS FACE. THE SITE HAS OTHERS.',
          'FOLLOW THE UNCHARTED MASS MARKER.',
          '[F] TOUCH THE MASS.'
        ]
      )
    : objective(
        'ch1:anomaly:calibrate-pan-tilt',
        'interact',
        'PAN-TILT SURVEY · CALIBRATE',
        ['SURVEY THE FULL PERIMETER.', 'LOOK ACROSS EVERY HEADING.'],
        false
      ),
  input: input.embodiedSurveyPolicy(),
  hud: {
  "feedEffects": true,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 62, waitReason: null, tick },
  marker: (handles) => handles.target('anomaly'),
  journey: [
  {
    "id": "objective:ch1:ch1-anomaly",
    "beat": "ch1-anomaly",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Attend to the anomaly and complete the first reality-stage handoff.",
      "completionEvidenceRefs": [
        "beat:a1-ramp"
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
      "whyNow": "The player has exhausted the imposed spatial grammar and is ready for evidence that exceeds it.",
      "capability": "Directed attention and anomaly inspection.",
      "storyFunction": "Pays off the chapter ladder by breaking its apparently complete model.",
      "expectedPlayerSeconds": {
        "min": 10,
        "max": 120
      },
      "spatialTolerance": "The observation cue tolerates a natural gaze cone and provides directional guidance when off-screen.",
      "recovery": "Looking away retains the cue and returning attention can complete it without replaying prior work.",
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
