import { defineBeat } from '../beatContract.ts';
import * as input from '../inputPrimitives.ts';

/** The authored behaviour and journey declaration for manifest. */
export const beatManifest = defineBeat({
  id: "manifest",
  chapter: "prologue",
  disposition: "cinematic",
  entry: "sequence",
  objective: null,
  input: { ...input.rasterPolicy(), moveSpeedScale: 0 },
  hud: {
  "feedEffects": false,
  "embodiedGuidance": false,
  "earlyTouchDpad": false,
  "externalCamera": false
},
  rail: { stuckAfterSeconds: 120, waitReason: null },
  marker: null,
  journey: []
});
