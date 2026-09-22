import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for a2-awakening. */
export const beatA2Awakening = defineBeat({
  id: "a2-awakening",
  chapter: "ch2",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: { ...input.embodiedSurveyPolicy(), lookMode: 'free', feedBlend: 1, moveSpeedScale: 0 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null },
  marker: null,
  journey: []
});
