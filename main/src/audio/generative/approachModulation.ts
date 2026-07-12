import {
  MODE_BRIGHTNESS_CHAIN,
  MODE_DEGREE_SETS,
  modeTonicTriad,
  tonnetzDistance,
  tonnetzPath,
  type ChordQuality,
  type ModeName
} from './theory.ts';
import { APPROACH_EXPECTED_BARS, MODULATE_MARGIN, MODULATE_MIN_BARS } from './tuning.ts';

// --- Approach modulation (§8.4, owner ruling #1: "modulate when it makes sense") -----------------
//
// The approach IS the modulation: a progressive pivot-chord walk from the
// current key toward the destination planet's tonic/mode, arriving home
// exactly as you land. The GUARD: modulate only when the walk fits the
// approach window (cost ≤ budget − margin); otherwise fall back to the
// LANDING PIVOT — one chromatic-mediant awe-chord at the landing bloom, then
// single-accidental mode drift settles the rest. Pure planning only; the bed
// conductor executes waypoints at chord changes and handles early landings.

export interface KeySpec {
  tonicPc: number;
  mode: ModeName;
}

export type ModulationDecision =
  | { kind: 'none' }
  | { kind: 'landingPivot' }
  | { kind: 'modulate'; waypoints: KeySpec[] };

const chainIndex = (mode: ModeName): number => MODE_BRIGHTNESS_CHAIN.indexOf(mode);
const modeTonicQuality = (mode: ModeName): ChordQuality => MODE_DEGREE_SETS[mode][0].quality;

/**
 * Transit mode for an intermediate pivot triad: keep `mode` when its tonic
 * quality matches, else the safe home-ish mode of the matching quality
 * (aeolian for minor, mixolydian for major). Transit through any chain mode
 * is permitted during a modulation — the §8.4 budget formula counts those
 * accidental steps explicitly.
 */
function transitMode(mode: ModeName, quality: ChordQuality): ModeName {
  if (modeTonicQuality(mode) === quality) return mode;
  return quality === 'min' ? 'aeolian' : 'mixolydian';
}

/**
 * Modulation cost (§8.4): mode-chain steps (one accidental each) + shortest
 * pivot-chord path between the tonic triads on the P/L/R graph.
 */
export function modulationCost(current: KeySpec, dest: KeySpec): number {
  const modeSteps = Math.abs(chainIndex(current.mode) - chainIndex(dest.mode));
  const tonicSteps = tonnetzDistance(
    modeTonicTriad(current.tonicPc, dest.mode),
    modeTonicTriad(dest.tonicPc, dest.mode)
  );
  return modeSteps + tonicSteps;
}

/**
 * The waypoint walk: first the mode steps along the brightness chain (tonic
 * held), then the tonic steps along the P/L/R path (each one P/L/R move).
 * The final waypoint is EXACTLY the destination key.
 */
export function modulationWaypoints(current: KeySpec, dest: KeySpec): KeySpec[] {
  const waypoints: KeySpec[] = [];
  // Mode walk: one accidental per step.
  let modeIdx = chainIndex(current.mode);
  const destIdx = chainIndex(dest.mode);
  while (modeIdx !== destIdx) {
    modeIdx += destIdx > modeIdx ? 1 : -1;
    waypoints.push({ tonicPc: current.tonicPc, mode: MODE_BRIGHTNESS_CHAIN[modeIdx] });
  }
  // Tonic walk: shortest PLR path between the tonic triads (dest-mode quality).
  const path = tonnetzPath(
    modeTonicTriad(current.tonicPc, dest.mode),
    modeTonicTriad(dest.tonicPc, dest.mode)
  );
  for (const triad of path.slice(1)) {
    waypoints.push({ tonicPc: triad.rootPc, mode: transitMode(dest.mode, triad.quality) });
  }
  // Arrive home exactly (transitMode may have detoured the final mode).
  if (waypoints.length === 0) return [];
  waypoints[waypoints.length - 1] = { tonicPc: dest.tonicPc, mode: dest.mode };
  return waypoints;
}

export interface ModulationWindow {
  /** Bars expected in the approach window (APPROACH_EXPECTED_BARS by default). */
  approachBars?: number;
  /** Bars per chord at the current harmonic rhythm. */
  harmonyBars: number;
  /** A story mood leads — never modulate under story authority (frozen contract). */
  storyLeads: boolean;
}

export function planApproachModulation(
  current: KeySpec,
  dest: KeySpec,
  window: ModulationWindow
): ModulationDecision {
  if (window.storyLeads) return { kind: 'none' };
  if (current.tonicPc === dest.tonicPc && current.mode === dest.mode) return { kind: 'none' };
  const approachBars = window.approachBars ?? APPROACH_EXPECTED_BARS;
  if (approachBars < MODULATE_MIN_BARS) return { kind: 'landingPivot' };
  const budget = Math.floor(approachBars / Math.max(1, window.harmonyBars));
  const cost = modulationCost(current, dest);
  if (cost > budget - MODULATE_MARGIN) return { kind: 'landingPivot' };
  return { kind: 'modulate', waypoints: modulationWaypoints(current, dest) };
}
