import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for a4-exhale. */
export const beatA4Exhale = defineBeat({
  id: "a4-exhale",
  chapter: "ch4",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: {
        ...input.ch3Policy(),
        moveSpeedScale: 0,
        allowJump: false,
        allowSprint: false,
        allowCraft: false,
        recipeAllowed: input.allowNone,
        allowBaseInteraction: input.allowNone
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
