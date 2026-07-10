// --- Prologue vector scene state -------------------------------------------------
//
// The prologue's phosphor vector layer is ONE persistent scene (starfield, the
// hauler, the destination cube) that every terminal phase plays inside — no
// frame ever swaps, the camera and the ship carry the eye between modes.
// Written by TerminalPrologue (mode) and VoyageLedger (progress/anomaly), read
// by PrologueVector's rAF loop. Plain module store: zero React churn.

export type VectorMode =
  | 'void'   // crawl: deep space, stars only
  | 'enter'  // the ship flies INTO frame as the crawl's last words fade
  | 'dock'   // manifest: holding at the berthing gantry
  | 'voyage' // the Oregon Trail formation: ship left, destination cube growing
  | 'dive'   // voyage end: debris streams off the planet, the ship dives, the camera chases
  | 'court'; // deflect/corruption: dim residual starfield under the oscilloscope

export const vectorScene = {
  mode: 'void' as VectorMode,
  modeAt: typeof performance !== 'undefined' ? performance.now() : 0,
  /** Voyage progress 0..1 (cube approach + ship detail resolution). */
  progress: 0,
  /** Nav-anomaly flag (vertex jitter). */
  anomaly: false
};

export function setVectorMode(mode: VectorMode): void {
  if (vectorScene.mode === mode) return;
  vectorScene.mode = mode;
  vectorScene.modeAt = performance.now();
}

/** Seconds the dive (debris stream + chase + CRT collapse) plays before Pong. */
export const DIVE_SECONDS = 3.6;
/** Final slice of the dive: the picture collapses to a scanline (CRT mode switch). */
export const COLLAPSE_SECONDS = 0.45;
