import { tick } from '../../autopilot/rail-ch14.ts';
import { defineBeat } from '../beatContract.ts';
import { SANDBOX_POLICY } from '../inputPrimitives.ts';
import { unfinishedMapObjective, unfinishedMapMarker } from '../../unfinishedMapDirector.ts';

export const beatCh14Scar = defineBeat({
  id: 'ch14-scar', chapter: 'ch14', disposition: 'objective',
  entry: 'sequence',
  objective: () => unfinishedMapObjective(), input: { ...SANDBOX_POLICY },
  hud: { feedEffects: false, embodiedGuidance: true, earlyTouchDpad: false, externalCamera: false },
  rail: { tick, stuckAfterSeconds: 600, waitReason: 'THE FIELD RECORD WAITS FOR YOUR ACTION' },
  marker: () => unfinishedMapMarker(),
  journey: [
  {
    "id": "objective:ch14:ch14-scar",
    "beat": "ch14-scar",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Walk to the existing repaired hull and press F within physical reach of its surviving scar.",
      "completionEvidenceRefs": [
        "milestone:story:ch14:scar-observed"
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
      "whyNow": "The earned reciprocal proof becomes a deliberately unfinished field record.",
      "capability": "Existing walking, F interaction and visible record controls.",
      "storyFunction": "Keep useful observations and their limits separate.",
      "expectedPlayerSeconds": {
        "min": 5,
        "max": 600
      },
      "spatialTolerance": "No gaze predicate; actual Origin attendance on foot. Detours preserve entries.",
      "recovery": "Resume or Continue restores receipts. Revalidate actor, world and physical reach before the next visit.",
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
