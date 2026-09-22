import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for ch4-arrival. */
export const beatCh4Arrival = defineBeat({
  id: "ch4-arrival",
  chapter: "ch4",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: {
        ...input.ch3Policy(),
        recipeAllowed: id => input.CH3_TAIL_RECIPES.has(id),
        moveSpeedScale: 0,
        allowCraft: false
      },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": true,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null },
  marker: null,
  journey: []
});
