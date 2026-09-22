import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for ch3-dusk. */
export const beatCh3Dusk = defineBeat({
  id: "ch3-dusk",
  chapter: "ch3",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: input.ch3Policy(),
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: "DUSK" },
  marker: null,
  journey: []
});
