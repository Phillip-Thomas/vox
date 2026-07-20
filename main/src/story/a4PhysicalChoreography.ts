import * as THREE from 'three';
import {
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute,
  type GroundedSurfaceRoutePoint,
  type GroundedSurfaceSample
} from '../utils/groundedSurfaceMotion.ts';
import {
  planAgentSurfaceRoute,
  type AgentSurfaceTerrainQuery
} from '../utils/agentSurfaceNavigation.ts';

export interface A4GroundedRoute {
  readonly points: ReadonlyArray<GroundedSurfaceRoutePoint>;
  readonly up: THREE.Vector3;
  readonly length: number;
  readonly branchDistance: number;
}

/**
 * One dry route owns the herd silhouettes, W-7744's flight, the rendered branch
 * and the pack landing. Sharing it makes their causal depth stack testable: the
 * worker cannot reach the tear by a different, wet, or airborne path.
 */
export function planA4GroundedRoute(
  terrain: AgentSurfaceTerrainQuery,
  planetSize: number,
  start: THREE.Vector3,
  dryPackPosition: THREE.Vector3,
  up = new THREE.Vector3(0, 1, 0)
): A4GroundedRoute | null {
  const planned = planAgentSurfaceRoute(terrain, planetSize, start, dryPackPosition, {
    face: 'top',
    differentFaceFallback: 'unreachable',
    clearanceCells: 2,
    maxSlopeCells: 1,
    edgeMarginCells: 1,
    maxVisitedCells: 16384,
    maxGoalApproachRadiusCells: 10,
    waypointClearanceWorld: 1.05,
    allowJetpackCrossing: false
  });
  if ((planned.mode !== 'walk' && planned.mode !== 'direct') || planned.waypoints.length < 2) {
    return null;
  }
  const points = planned.waypoints.map(position => ({ position: position.clone() }));
  const length = groundedSurfaceRouteLength(points, up);
  if (length < 2) return null;
  return {
    points,
    up: up.clone(),
    length,
    // The strap meets a rendered branch shortly before the validated landing
    // patch. It is never a timer-only drop.
    branchDistance: Math.max(1, length - 1.15)
  };
}

export function sampleA4GroundedRoute(
  route: A4GroundedRoute,
  distance: number,
  out?: GroundedSurfaceSample
): GroundedSurfaceSample {
  return sampleGroundedSurfaceRoute(route.points, distance, route.up, out);
}

export function a4HerdDistance(
  route: A4GroundedRoute,
  elapsedSeconds: number,
  herdIndex: number
): number {
  const entry = Math.max(0, route.length * 0.08 - herdIndex * 0.7);
  const travelled = Math.max(0, elapsedSeconds) * (2.25 + herdIndex * 0.12);
  const trailSpacing = herdIndex * Math.min(0.72, route.length * 0.035);
  const crestDistance = Math.max(route.length * 0.25, route.length * 0.68 - trailSpacing);
  return Math.min(crestDistance, entry + travelled);
}

/**
 * A continuous run keeps W-7744 visible for the short grounded tail beyond the
 * branch tear. A reload that already owns the durable pack receipt must never
 * reconstruct that transient exit body, even if its old route distance was
 * persisted or recovered at an earlier sample.
 */
export function shouldShowA4WorkerAfterPackDrop(input: {
  reconstructedFromReceipt: boolean;
  workerDistance: number;
  routeLength: number;
}): boolean {
  if (input.reconstructedFromReceipt) return false;
  if (!Number.isFinite(input.workerDistance) || !Number.isFinite(input.routeLength)) return false;
  return input.workerDistance < input.routeLength;
}
