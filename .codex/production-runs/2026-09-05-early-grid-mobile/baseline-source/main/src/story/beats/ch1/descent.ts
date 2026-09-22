import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for descent. */
export const beatDescent = defineBeat({
  id: "descent",
  chapter: "ch1",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: { ...input.rasterPolicy(), moveSpeedScale: 0 },
  hud: {
  "feedEffects": true,
  "embodiedGuidance": false,
  "earlyTouchDpad": false,
  "externalCamera": true
},
  rail: { stuckAfterSeconds: 30, waitReason: "THE CRASH" },
  marker: null,
  journey: []
});
