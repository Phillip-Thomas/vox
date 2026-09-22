import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for a1-ramp. */
export const beatA1Ramp = defineBeat({
  id: "a1-ramp",
  chapter: "ch1",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: { ...input.embodiedSurveyPolicy(), moveSpeedScale: 0 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 30, waitReason: "THE FIRST AWAKENING" },
  marker: null,
  journey: []
});
