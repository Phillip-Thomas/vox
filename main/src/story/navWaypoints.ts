import type * as THREE from 'three';
import { playSfx } from '../audio/sfxEngine.ts';

// --- Triangulation waypoints (the top-down era's verb) --------------------------------
//
// NAV VIEW asks for three triangulation fixes IN ORDER — a route, not a
// scavenger hunt — so the player learns to read the world as a map. Session
// state only (a reload mid-leg just replays the short route; the checkpoint is
// the beat milestone, consistent with "sub-beats re-derive").

export const NAV_WAYPOINT_COUNT = 3;

let reached = 0;
let positions: THREE.Vector3[] = [];

export function resetNavWaypoints(): void {
  reached = 0;
}

export function setNavWaypointPositions(next: THREE.Vector3[]): void {
  positions = next;
}

export function getNavWaypointPositions(): readonly THREE.Vector3[] {
  return positions;
}

/** Index of the waypoint currently being sought (== count when done). */
export function currentNavWaypointIndex(): number {
  return reached;
}

export function reachedNavWaypointCount(): number {
  return reached;
}

export function navWaypointsComplete(): boolean {
  return reached >= NAV_WAYPOINT_COUNT;
}

/** The active waypoint's world position (null once the route is complete). */
export function currentNavWaypointPosition(): THREE.Vector3 | null {
  return reached < positions.length ? positions[reached] : null;
}

/** Proximity fix on the ACTIVE waypoint only — the route is ordered. */
export function reachNavWaypoint(index: number): void {
  if (index !== reached || reached >= NAV_WAYPOINT_COUNT) return;
  reached += 1;
  playSfx('terminalKey');
}

/** Dev-jump / screening seeding. */
export function seedNavWaypointsReached(): void {
  reached = NAV_WAYPOINT_COUNT;
}
