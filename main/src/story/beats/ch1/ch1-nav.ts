import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { objective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch1-nav.ts';

/** The authored behaviour and journey declaration for ch1-nav. */
export const beatCh1Nav = defineBeat({
  id: "ch1-nav",
  chapter: "ch1",
  disposition: "objective",
  entry: "sequence",
  objective: facts => {
    const markerLabel = `TRIANGULATION ${facts.navWaypointIndex + 1}/${facts.navWaypointCount}`;
    return objective(
      `ch1:nav:triangulation-${facts.navWaypointIndex + 1}-of-${facts.navWaypointCount}`,
      'travel',
      markerLabel,
      ['FOLLOW THE ACTIVE TRIANGULATION MARKER.', 'ENTER THE TRIANGULATION POINT.']
    );
  },
  input: { ...input.rasterPolicy(), targetFov: 36 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": true,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 75, waitReason: null, tick },
  marker: (handles) => handles.target('waypoint'),
  journey: [
  {
    "id": "objective:ch1:ch1-nav",
    "beat": "ch1-nav",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Traverse the navigation waypoints after the world permits broader movement.",
      "completionEvidenceRefs": [
        "milestone:story:ch1:nav"
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
      "whyNow": "Expanded space should be exercised immediately so the camera transition becomes player-owned knowledge.",
      "capability": "Two-axis navigation and waypoint reading.",
      "storyFunction": "Converts a new viewpoint into genuine agency rather than spectacle alone.",
      "expectedPlayerSeconds": {
        "min": 20,
        "max": 180
      },
      "spatialTolerance": "Waypoint capture volumes allow varied grounded paths without requiring water traversal.",
      "recovery": "A missed waypoint remains marked and can be approached by a dry or intelligent jetpack route.",
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
