import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';
import { ch10AskObjective } from '../objectivePrimitives.ts';
import { tick } from './rail-ch10-ask.ts';

/** The authored behaviour and journey declaration for ch10-ask. */
export const beatCh10Ask = defineBeat({
  id: "ch10-ask",
  chapter: "ch10",
  disposition: "objective",
  entry: "sequence",
  objective: facts => ch10AskObjective(facts.ch10AskState),
  input: { ...input.SANDBOX_POLICY },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 320, waitReason: null, tick },
  marker: (handles, candidate) => candidate.id === 'station:return:crossing' ? handles.target('origin') : candidate.id === 'station:return:reboard' ? handles.target('fabricator') : candidate.id === 'station:return:landfall' ? (() => { const target = handles.target('origin-relay'); return target ? { ...target, projectionSpace: 'spatial' as const } : null; })() : handles.target('origin-relay'),
  journey: [
  {
    "id": "objective:ch10:ch10-ask",
    "beat": "ch10-ask",
    "criticality": "mandatory",
    "interaction": {
      "intent": "Fly the crossing back to the first world, land at the wreck, request a source at the relay, and claim the attached bearing.",
      "completionEvidenceRefs": [
        "milestone:story:ch10-relay-asked",
        "milestone:story:ch10-relay-answered",
        "milestone:story:ch10-bearing-claimed"
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
      "whyNow": "Asking must cost a journey, or it is a menu: the channel that never closed is on the world she left.",
      "capability": "Reboard, cross in ch8 flight grammar, land, interact at the relay, and commit the station target.",
      "storyFunction": "Turns 'one fire behind you' from an image into a route, and makes the reply's speed the chapter's single hidden-pillar spend.",
      "expectedPlayerSeconds": {
        "min": 180,
        "max": 900
      },
      "spatialTolerance": "Landing anywhere on the first world is accepted; landfall-to-relay marker guidance persists and detour is never punished.",
      "recovery": "Shipped ch8 flight rescue applies unchanged; a rescue moves the vehicle and never performs the ask or the claim.",
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
