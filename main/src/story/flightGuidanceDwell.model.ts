// Pure dwell / hysteresis for the flight-derived Chapter 8 guidance state.
// Extracted so the anti-flap behaviour is deterministically testable (node env)
// without the spaceFlight / systemFlight stores.
//
// THE BUG THIS SOLVES: the ch8 crossing/landfall (and launch) objective ids are
// derived every frame from live flight snapshots (`activePlanetId`, `flight.phase`,
// `controlMode`). At an atmosphere-envelope or surface boundary those snapshots
// can oscillate frame-to-frame, so the derived guidance id flapped — and because
// `activateGuidedStoryObjective` fires an objective-enter cue (terminalAdvance +
// card re-pop) on every id change, the boundary metronomed the chirp and re-popped
// the objective card each frame. This holds the derived state stable for a dwell
// before the guidance id is allowed to change; the id-equality guard in
// objectiveDirector stays the sole publish gate and is deliberately untouched.

/**
 * Sustained seconds a NEW flight-derived state must hold before the Ch8 guidance
 * id follows it. ~1.75 s (mid of the 1.5-2 s band) mirrors nightState's
 * NIGHT_DWELL_SECONDS pattern: long enough to absorb a sub-second envelope/surface
 * boundary oscillation, short enough that a genuine phase change (ascent, approach,
 * touchdown — each many seconds long) still updates the objective card promptly.
 */
export const CH8_FLIGHT_GUIDANCE_DWELL_SECONDS = 1.75;

export interface FlightGuidanceDwellState {
  /** The currently-latched (published) guidance state, or null before the first sample. */
  stableState: string | null;
  /** A differing candidate awaiting the dwell, or null when none is pending. */
  pendingState: string | null;
  /** Time (seconds) the pending candidate first appeared. */
  pendingSince: number;
}

export function createFlightGuidanceDwell(): FlightGuidanceDwellState {
  return { stableState: null, pendingState: null, pendingSince: 0 };
}

/** Clear the dwell (call at beat entry so a fresh beat latches its first sample). */
export function resetFlightGuidanceDwell(state: FlightGuidanceDwellState): void {
  state.stableState = null;
  state.pendingState = null;
  state.pendingSince = 0;
}

/**
 * Advance the dwell by one sample. Mutates and reflects `state`, and returns the
 * guidance state that should be PUBLISHED this frame.
 *
 *  - First sample after a reset/entry -> latch immediately (guidance appears the
 *    instant the beat opens; the dwell only ever guards CHANGES, never the first).
 *  - Sample equals the latched state -> cancel any pending; publish the latch.
 *  - A differing sample -> start (or continue) its dwell; publish the previous
 *    latch until the candidate has persisted `dwellSeconds`, then latch it.
 *    A candidate that changes again restarts its timer.
 */
export function advanceFlightGuidanceDwell(
  state: FlightGuidanceDwellState,
  rawState: string,
  nowSeconds: number,
  dwellSeconds: number = CH8_FLIGHT_GUIDANCE_DWELL_SECONDS
): string {
  if (state.stableState === null) {
    state.stableState = rawState;
    state.pendingState = null;
    return rawState;
  }
  if (rawState === state.stableState) {
    state.pendingState = null;
    return state.stableState;
  }
  if (rawState !== state.pendingState) {
    state.pendingState = rawState;
    state.pendingSince = nowSeconds;
  }
  if (nowSeconds - state.pendingSince >= dwellSeconds) {
    state.stableState = rawState;
    state.pendingState = null;
    return rawState;
  }
  return state.stableState;
}
