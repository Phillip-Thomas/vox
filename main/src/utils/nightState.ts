// --- Shared night state ------------------------------------------------------
//
// ONE canonical "is it night" predicate so every survival, story, and rest system
// agrees with what the SCREEN shows. Previously two clocks disagreed: the visuals
// darkened on sun-elevation daylight (dayNight.ts), while rest gating waited for a
// scalar dayPhase band (0.55..0.95) that opened ~12s AFTER the sun had visibly set.
//
// This module derives night from the SAME sun-elevation daylight signal the sky,
// fog, and ambient use, so "dark on screen" and "night for gameplay" are the same
// event. It exposes two agreeing views of the one clock:
//
//   • Phase view (pure): isNightPhase(phase) — for rest gates that only hold a
//     dayPhase (tidegarden, ch3/ch4 dusk & vigil). Opens the instant the sky
//     darkens (~phase 0.505, just after the 0.5 sunset) and closes at the dawn
//     wrap so rest still ends at sunrise.
//   • Live view (dwelled): updateNightDwell(daylight, dt) — for the survival tick,
//     which already samples the live LOCAL daylight each frame. A short dwell means
//     a momentary occlusion (a shadow, a cliff) can't flip the world to "night".
//
// Both read the same daylightFromElevation() curve, so a story that FORCES dayPhase
// (storyDirector holds the sun through the scripted dusk) and the sandbox's live
// cycle produce identical night decisions.

import { daylightFromElevation } from './dayNight.ts';
import { normalizeDayPhase } from '../game/worldClock.ts';

/** Below this daylight (0..1) the scene reads as night. Matches survivalVitals'
 *  long-standing `atNight` cut and the point the sky/ambient have gone dark. */
export const NIGHT_DAYLIGHT_THRESHOLD = 0.2;

/** Sustained darkness (seconds) before the LIVE night latches — long enough that a
 *  momentary shadow/occlusion doesn't count, short enough that rest opens promptly
 *  after real dusk (the owner's "dark for ~5s and I should be able to rest"). */
export const NIGHT_DWELL_SECONDS = 5;

/** Dawn wrap: night (and therefore rest) closes by this phase so the player can't
 *  keep resting into the morning. Preserves the historical 0.95 end-of-night bound. */
export const NIGHT_END_PHASE = 0.95;

/** Global sun elevation for a day phase — mirrors SkyController.applyDayPhase's
 *  vertical sun component (sin of the day angle): +1 at noon (phase 0.25), 0 at the
 *  0.0 sunrise / 0.5 sunset horizon, −1 at midnight (0.75). This is the canonical
 *  "how high is the sun" the whole world shares when reasoning from a forced clock. */
export function sunElevationFromDayPhase(phase: number): number {
  return Math.sin(normalizeDayPhase(phase) * Math.PI * 2);
}

/** Canonical daylight 0..1 for a day phase, through the SAME curve the visuals use. */
export function daylightFromDayPhase(phase: number): number {
  return daylightFromElevation(sunElevationFromDayPhase(phase));
}

/** Is this daylight sample dark enough to read as night? */
export function isDarkDaylight(daylight: number): boolean {
  return daylight < NIGHT_DAYLIGHT_THRESHOLD;
}

/** First phase after noon at which the sky has darkened to night. daylight is
 *  monotonic on (0.25, 0.75), so a bisection pins the crossing exactly to whatever
 *  the daylight curve does — no magic constant to drift out of sync. ~0.5054. */
function computeNightStartPhase(): number {
  let lo = 0.25; // noon — fully lit
  let hi = 0.75; // midnight — fully dark
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (isDarkDaylight(daylightFromDayPhase(mid))) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** The phase at which the visible sky crosses into night (~0.5054, just after the
 *  0.5 sunset). Rest and night-aware story beats open here instead of the old 0.55. */
export const NIGHT_START_PHASE = computeNightStartPhase();

/** Pure night predicate for a day phase: dark on screen AND before the dawn wrap.
 *  Used by every rest gate that only carries a dayPhase (survival's live path uses
 *  updateNightDwell instead). Because the story FORCES this same phase into the
 *  world clock the visuals read, screen-night and rest-night are one event. */
export function isNightPhase(phase: number): boolean {
  const p = normalizeDayPhase(phase);
  return isDarkDaylight(daylightFromDayPhase(p)) && p <= NIGHT_END_PHASE;
}

// --- Live (dwelled) night ----------------------------------------------------
// Fed by the survival tick from the live LOCAL daylight sample. A global singleton
// because night is a world property, not a per-actor one.

let darkElapsed = 0;
let nightLatched = false;

/** Feed a live daylight sample. Night latches only after NIGHT_DWELL_SECONDS of
 *  sustained darkness (so a momentary occlusion doesn't count) and clears the moment
 *  real light returns (the sun warms/lights immediately). Returns the latched night. */
export function updateNightDwell(daylight: number, dtSeconds: number): boolean {
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  if (isDarkDaylight(daylight)) {
    darkElapsed += dt;
    if (darkElapsed >= NIGHT_DWELL_SECONDS) nightLatched = true;
  } else {
    darkElapsed = 0;
    nightLatched = false;
  }
  return nightLatched;
}

/** Current latched live-night state (no sample). */
export function isNightNow(): boolean {
  return nightLatched;
}

/** 0..1 progress toward the live night latching (dwell fill), for UI/telemetry. */
export function nightDwellProgress(): number {
  return Math.min(1, darkElapsed / NIGHT_DWELL_SECONDS);
}

/** Reset the live dwell — call on full world/vitals reset so a new game doesn't
 *  inherit a stale latch. */
export function resetNightDwell(): void {
  darkElapsed = 0;
  nightLatched = false;
}
