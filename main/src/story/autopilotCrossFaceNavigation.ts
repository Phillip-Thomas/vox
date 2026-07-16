import * as THREE from 'three';
import {
  planAgentSurfaceRoute,
  type AgentSurfaceRoute,
  type AgentSurfaceTerrainQuery
} from '../utils/agentSurfaceNavigation.ts';
import {
  PLAYER_CENTER_CLEARANCE,
  PLAYER_EDGE_RADIUS,
  VOXEL_SCALE
} from '../utils/cubeGravityConstants.ts';
import type { CubeFace } from '../types/cube.ts';
import { FACE_NORMALS } from '../utils/surfaceControls.ts';
import {
  crossFaceApproachCandidates,
  type CrossFaceSurfaceLeg
} from './autopilotSteering.ts';

export interface ReachableCrossFaceRouteInput {
  terrain: AgentSurfaceTerrainQuery;
  planetSize: number;
  player: THREE.Vector3;
  goal: THREE.Vector3;
  face: CubeFace;
  crossFaceLeg: CrossFaceSurfaceLeg | null;
  jetpackAvailable: boolean;
}

export interface ReachableCrossFaceRoutePlan {
  route: AgentSurfaceRoute;
  crossFaceLeg: CrossFaceSurfaceLeg | null;
  attemptedApproaches: number;
  /** First destination-face support from which ordinary A* owns the trip. */
  destinationEntry: THREE.Vector3 | null;
  /** Destination-face route proven from destinationEntry to the next safe leg. */
  destinationRoute: AgentSurfaceRoute | null;
  /** Maximum inward handoff travel needed to reach destinationEntry. */
  safeContinuationDistance: number | null;
  /** Whether the edge-to-entry handoff is dry walking or water-capable flight. */
  destinationContinuationMode: 'dry' | 'jetpack' | null;
}

/**
 * An unreachable route has no waypoint, so the ordinary off-route invalidation
 * cannot observe a body that is still coasting/falling after the failed plan.
 * Replan only after a full voxel of real displacement or after an unsupported
 * body physically acquires support. The replacement route records both states,
 * which makes a stationary rejection stable instead of a per-frame A* loop.
 */
export interface NavigationSurfaceContactSignature {
  feetInWater: boolean;
  physicallySupported: boolean;
}

export function shouldReplanUnreachableRoute(input: {
  routeMode: AgentSurfaceRoute['mode'];
  plannedFrom: THREE.Vector3;
  player: THREE.Vector3;
  plannedContact: NavigationSurfaceContactSignature;
  currentContact: NavigationSurfaceContactSignature;
}): boolean {
  return input.routeMode === 'unreachable'
    && (input.player.distanceToSquared(input.plannedFrom) >= VOXEL_SCALE * VOXEL_SCALE
      // Low-FPS edge flight can reject a route while the body is unsupported,
      // then settle on a traversable bank with less than one final voxel of
      // drift. Support acquisition is a material planning-state change. The
      // reverse transition is intentionally ignored so a noisy ground probe
      // cannot create a stationary A* loop.
      || (!input.plannedContact.physicallySupported
        && input.currentContact.physicallySupported));
}

export type CrossFaceDestinationValidationReason =
  | 'valid'
  | 'departure-route-not-dry'
  | 'departure-route-not-jetpack'
  | 'departure-approach-gap'
  | 'destination-edge-water'
  | 'destination-edge-hazard'
  | 'destination-entry-unavailable';

export interface CrossFaceDestinationEntryValidation {
  accepted: boolean;
  reason: CrossFaceDestinationValidationReason;
  destinationEdge: THREE.Vector3 | null;
  destinationEntry: THREE.Vector3 | null;
  destinationRoute: AgentSurfaceRoute | null;
  safeContinuationDistance: number | null;
  continuationMode: 'dry' | 'jetpack' | null;
  blockedAt: THREE.Vector3 | null;
}

export interface CrossFaceDestinationEntryInput {
  terrain: AgentSurfaceTerrainQuery;
  planetSize: number;
  goal: THREE.Vector3;
  crossFaceLeg: CrossFaceSurfaceLeg;
  approach: THREE.Vector3;
  departureRoute: AgentSurfaceRoute;
}

const MAX_DEPARTURE_APPROACH_GAP_CELLS = 1.5;
const MAX_DESTINATION_ENTRY_SCAN_CELLS = 16;
const DESTINATION_EDGE_COLUMN_SCAN_CELLS = 4;

interface DestinationEdgeColumnBlocker {
  reason: 'destination-edge-water' | 'destination-edge-hazard';
  world: THREE.Vector3;
}

function destinationEdgeColumnBlocker(
  terrain: AgentSurfaceTerrainQuery,
  planetSize: number,
  face: CubeFace,
  probe: THREE.Vector3,
  allowWater = false
): DestinationEdgeColumnBlocker | null {
  const up = FACE_NORMALS[face];
  const radiusCells = Math.max(1, Math.floor(planetSize / VOXEL_SCALE));
  const cell = new THREE.Vector3(
    Math.round(probe.x / VOXEL_SCALE),
    Math.round(probe.y / VOXEL_SCALE),
    Math.round(probe.z / VOXEL_SCALE)
  );
  // The destination normal is supplied by the height scan; preserve only the
  // two edge coordinates from the crossing trajectory.
  cell.addScaledVector(up, -cell.dot(up));
  const coord = new THREE.Vector3();
  const outward = new THREE.Vector3();
  let support: THREE.Vector3 | null = null;
  for (let height = radiusCells; height >= 0; height--) {
    coord.copy(cell).addScaledVector(up, height);
    if (!terrain.isSolidVoxel(coord.x, coord.y, coord.z)) continue;
    outward.copy(coord).add(up);
    if (height < radiusCells && terrain.isSolidVoxel(outward.x, outward.y, outward.z)) continue;
    support = coord.clone();
    break;
  }
  if (!support) return null;

  for (let lift = 0; lift <= DESTINATION_EDGE_COLUMN_SCAN_CELLS; lift++) {
    coord.copy(support).addScaledVector(up, lift);
    if (terrain.isHazardousVoxel?.(coord.x, coord.y, coord.z)) {
      return {
        reason: 'destination-edge-hazard',
        world: coord.multiplyScalar(VOXEL_SCALE).clone()
      };
    }
    if (!allowWater && terrain.isWaterVoxel(coord.x, coord.y, coord.z)) {
      return {
        reason: 'destination-edge-water',
        world: coord.multiplyScalar(VOXEL_SCALE).clone()
      };
    }
  }
  return null;
}

function rejectedDestination(
  reason: Exclude<CrossFaceDestinationValidationReason, 'valid'>,
  destinationEdge: THREE.Vector3 | null = null,
  blockedAt: THREE.Vector3 | null = null
): CrossFaceDestinationEntryValidation {
  return {
    accepted: false,
    reason,
    destinationEdge,
    destinationEntry: null,
    destinationRoute: null,
    safeContinuationDistance: null,
    continuationMode: null,
    blockedAt
  };
}

/**
 * Prove both halves of a walking seam before it can win selection. The old
 * face must actually reach the requested edge fan (not a distant dry fallback),
 * and every sampled destination-edge column must be free of water/hazards until
 * the ordinary destination-face planner owns a complete dry route.
 */
export function validateCrossFaceDestinationEntry(
  input: CrossFaceDestinationEntryInput
): CrossFaceDestinationEntryValidation {
  const route = input.departureRoute;
  if ((route.mode !== 'walk' && route.mode !== 'direct')
    || route.waterCrossing
    || !route.resolvedGoal) {
    return rejectedDestination('departure-route-not-dry');
  }
  if (route.resolvedGoal.distanceTo(input.approach)
    > MAX_DEPARTURE_APPROACH_GAP_CELLS * VOXEL_SCALE) {
    return rejectedDestination('departure-approach-gap');
  }

  const nextUp = FACE_NORMALS[input.crossFaceLeg.nextFace];
  const direction = input.crossFaceLeg.continuationDirection.clone().normalize();
  const destinationEdge = route.resolvedGoal.clone().addScaledVector(
    nextUp,
    input.planetSize + PLAYER_CENTER_CLEARANCE - route.resolvedGoal.dot(nextUp)
  );
  const probe = new THREE.Vector3();
  for (let distanceCells = 0;
    distanceCells <= MAX_DESTINATION_ENTRY_SCAN_CELLS;
    distanceCells++) {
    const scanDistance = distanceCells * VOXEL_SCALE;
    probe.copy(destinationEdge).addScaledVector(direction, scanDistance);
    const blocker = destinationEdgeColumnBlocker(
      input.terrain,
      input.planetSize,
      input.crossFaceLeg.nextFace,
      probe
    );
    if (blocker) {
      return rejectedDestination(blocker.reason, destinationEdge, blocker.world);
    }

    // A self-route is a cheap exact ownership probe: it exercises the same
    // clearance, slope, edge-margin, water, and hazard rules as runtime A*.
    const entryProbe = planAgentSurfaceRoute(
      input.terrain,
      input.planetSize,
      probe,
      probe,
      {
        face: input.crossFaceLeg.nextFace,
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: false,
        maxVisitedCells: 1
      }
    );
    if (entryProbe.mode === 'unreachable' || !entryProbe.resolvedGoal) continue;

    const destinationRoute = planAgentSurfaceRoute(
      input.terrain,
      input.planetSize,
      probe,
      input.goal,
      {
        face: input.crossFaceLeg.nextFace,
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: false,
        maxVisitedCells: 4096
      }
    );
    if (destinationRoute.mode === 'unreachable'
      || destinationRoute.waterCrossing
      || !destinationRoute.resolvedGoal) continue;
    const destinationEntry = destinationRoute.waypoints[0]?.clone()
      ?? entryProbe.resolvedGoal.clone();
    return {
      accepted: true,
      reason: 'valid',
      destinationEdge,
      destinationEntry,
      destinationRoute,
      safeContinuationDistance: Math.max(
        scanDistance,
        destinationEntry.clone().sub(destinationEdge).dot(direction)
      ),
      continuationMode: 'dry',
      blockedAt: null
    };
  }
  return rejectedDestination('destination-entry-unavailable', destinationEdge);
}

/**
 * Validate a water-capable cross-face fallback without laundering it into a
 * dry seam. Water is permitted throughout the fixed inward corridor, hazards
 * are not, and the target is the first destination column from which the
 * ordinary jetpack-aware planner can own an egress/goal route.
 */
export function validateCrossFaceJetpackDestinationEntry(
  input: CrossFaceDestinationEntryInput
): CrossFaceDestinationEntryValidation {
  const route = input.departureRoute;
  const jetpackDeparture = route.mode === 'jetpack'
    || route.reason === 'partial-water-crossing-egress'
    || route.waterCrossing !== null;
  if (!jetpackDeparture || !route.resolvedGoal) {
    return rejectedDestination('departure-route-not-jetpack');
  }

  const nextUp = FACE_NORMALS[input.crossFaceLeg.nextFace];
  const direction = input.crossFaceLeg.continuationDirection.clone().normalize();
  const destinationEdge = route.resolvedGoal.clone().addScaledVector(
    nextUp,
    input.planetSize + PLAYER_CENTER_CLEARANCE - route.resolvedGoal.dot(nextUp)
  );
  const probe = new THREE.Vector3();
  for (let distanceCells = 0;
    distanceCells <= MAX_DESTINATION_ENTRY_SCAN_CELLS;
    distanceCells++) {
    const scanDistance = distanceCells * VOXEL_SCALE;
    probe.copy(destinationEdge).addScaledVector(direction, scanDistance);
    const blocker = destinationEdgeColumnBlocker(
      input.terrain,
      input.planetSize,
      input.crossFaceLeg.nextFace,
      probe,
      true
    );
    if (blocker) {
      return rejectedDestination(blocker.reason, destinationEdge, blocker.world);
    }

    const destinationRoute = planAgentSurfaceRoute(
      input.terrain,
      input.planetSize,
      probe,
      input.goal,
      {
        face: input.crossFaceLeg.nextFace,
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: true,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        jetpackDetourExtraCells: 4,
        jetpackDetourRatio: 1.5,
        maxVisitedCells: 4096
      }
    );
    if (destinationRoute.mode === 'unreachable'
      || !destinationRoute.resolvedGoal
      || destinationRoute.waypoints.length === 0) continue;
    const destinationEntry = destinationRoute.waypoints[0]?.clone() ?? probe.clone();
    return {
      accepted: true,
      reason: 'valid',
      destinationEdge,
      destinationEntry,
      destinationRoute,
      safeContinuationDistance: Math.max(
        scanDistance,
        destinationEntry.clone().sub(destinationEdge).dot(direction)
      ),
      continuationMode: 'jetpack',
      blockedAt: null
    };
  }
  return rejectedDestination('destination-entry-unavailable', destinationEdge);
}

/** The edge roll is not complete until the destination-face planner owns a real column. */
export function shouldExtendCrossFaceContinuation(route: AgentSurfaceRoute): boolean {
  return route.mode === 'unreachable'
    && (route.reason === 'start-column-not-traversable'
      || route.reason === 'no-safe-route');
}

/**
 * Find a reachable dry inset for a cross-face leg. Terrain may isolate the
 * geometrically shortest seam; bounded alternatives stay on the same physical
 * edge and still use the ordinary dry/water-aware A* planner.
 */
export function planReachableCrossFaceRoute(
  input: ReachableCrossFaceRouteInput
): ReachableCrossFaceRoutePlan {
  const approaches = input.crossFaceLeg
    ? crossFaceApproachCandidates({
        leg: input.crossFaceLeg,
        goal: input.goal,
        edgeEntryRadius: input.planetSize - PLAYER_EDGE_RADIUS,
        cornerInset: VOXEL_SCALE
      })
    : [input.goal.clone()];
  let firstRoute: AgentSurfaceRoute | null = null;
  const partialPlans: ReachableCrossFaceRoutePlan[] = [];
  const jetpackPlans: ReachableCrossFaceRoutePlan[] = [];
  let localEgressPlan: ReachableCrossFaceRoutePlan | null = null;
  let dryPlan: ReachableCrossFaceRoutePlan | null = null;
  let dryPlanScore = Infinity;

  for (let index = 0; index < approaches.length; index++) {
    const approach = approaches[index];
    if (!approach) continue;
    const route = planAgentSurfaceRoute(
      input.terrain,
      input.planetSize,
      input.player,
      approach,
      {
        face: input.face,
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: input.jetpackAvailable,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        jetpackDetourExtraCells: 4,
        jetpackDetourRatio: 1.5,
        maxVisitedCells: 4096
      }
    );
    firstRoute ??= route;
    if (route.mode === 'unreachable') continue;
    const plan: ReachableCrossFaceRoutePlan = {
      route,
      crossFaceLeg: input.crossFaceLeg
        ? { ...input.crossFaceLeg, approach: approach.clone() }
        : null,
      attemptedApproaches: index + 1,
      destinationEntry: null,
      destinationRoute: null,
      safeContinuationDistance: null,
      destinationContinuationMode: null
    };
    if ((route.reason === 'wet-start-egress'
        || route.reason === 'partial-water-crossing-egress')
      && !localEgressPlan) {
      // This route proves only the immediate water-to-bank recovery. Retain it
      // as a physical fallback, but deliberately detach the cross-face leg:
      // reaching this bank must trigger a fresh seam proof, not an edge roll
      // from a waypoint that is nowhere near the selected seam.
      localEgressPlan = {
        ...plan,
        crossFaceLeg: null
      };
    }
    if (route.reason === 'partial-water-crossing-egress') {
      partialPlans.push(plan);
      continue;
    }
    if (route.mode === 'jetpack') {
      // A nearby seam can be wet even when the same bounded edge fan contains
      // a complete dry route. Retain the first feasible water crossing as a
      // fallback, but prefer physical walking when another seam avoids water.
      jetpackPlans.push(plan);
      continue;
    }
    const destination = input.crossFaceLeg
      ? validateCrossFaceDestinationEntry({
          terrain: input.terrain,
          planetSize: input.planetSize,
          goal: input.goal,
          crossFaceLeg: input.crossFaceLeg,
          approach,
          departureRoute: route
        })
      : null;
    if (destination && !destination.accepted) continue;
    plan.destinationEntry = destination?.destinationEntry ?? null;
    plan.destinationRoute = destination?.destinationRoute ?? null;
    plan.safeContinuationDistance = destination?.safeContinuationDistance ?? null;
    plan.destinationContinuationMode = destination?.continuationMode ?? null;
    const approachGapCells = route.resolvedGoal
      ? route.resolvedGoal.distanceTo(approach) / VOXEL_SCALE
      : Infinity;
    const destinationCost = (destination?.destinationRoute?.waypoints.length ?? 0)
      + (destination?.safeContinuationDistance ?? 0) / VOXEL_SCALE;
    // Score the now-proven whole unfolded journey rather than an edge-axis
    // approximation: old-face A*, dry handoff distance, then destination A*.
    const score = route.waypoints.length + approachGapCells + destinationCost;
    if (score < dryPlanScore) {
      dryPlan = plan;
      dryPlanScore = score;
    }
  }

  if (dryPlan) return dryPlan;
  const validateFallback = (
    plan: ReachableCrossFaceRoutePlan
  ): ReachableCrossFaceRoutePlan | null => {
    if (!plan.crossFaceLeg) return plan;
    const destination = validateCrossFaceJetpackDestinationEntry({
      terrain: input.terrain,
      planetSize: input.planetSize,
      goal: input.goal,
      crossFaceLeg: plan.crossFaceLeg,
      approach: plan.crossFaceLeg.approach,
      departureRoute: plan.route
    });
    if (!destination.accepted) return null;
    plan.destinationEntry = destination.destinationEntry;
    plan.destinationRoute = destination.destinationRoute;
    plan.safeContinuationDistance = destination.safeContinuationDistance;
    plan.destinationContinuationMode = destination.continuationMode;
    return plan;
  };
  for (const plan of jetpackPlans) {
    const validated = validateFallback(plan);
    if (validated) return validated;
  }
  for (const plan of partialPlans) {
    const validated = validateFallback(plan);
    if (validated) return validated;
  }

  if (localEgressPlan) return localEgressPlan;

  if (!firstRoute) {
    throw new Error('cross-face route planning produced no candidate');
  }
  return {
    route: input.crossFaceLeg && firstRoute.mode !== 'unreachable'
      ? {
          ...firstRoute,
          mode: 'unreachable',
          waypoints: [],
          resolvedGoal: null,
          waterCrossing: null,
          reason: 'no-safe-route'
        }
      : firstRoute,
    crossFaceLeg: input.crossFaceLeg,
    attemptedApproaches: approaches.length,
    destinationEntry: null,
    destinationRoute: null,
    safeContinuationDistance: null,
    destinationContinuationMode: null
  };
}
