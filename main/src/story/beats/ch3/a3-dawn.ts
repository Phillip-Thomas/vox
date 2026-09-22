import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for a3-dawn. */
export const beatA3Dawn = defineBeat({
  id: "a3-dawn",
  chapter: "ch3",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: { ...input.ch3Policy(), moveSpeedScale: 0, allowCraft: false },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: "DAWN" },
  marker: null,
  journey: []
});
