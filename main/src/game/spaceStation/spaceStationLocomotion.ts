import type { Vec3Tuple } from '../starSystem.ts';
import {
  headroomAt,
  slideAgainstProps,
  supportHeightAt,
  type BlockerIndex,
  type BodyMetrics
} from './spaceStationCollision.ts';
import { WALL_THICKNESS } from './spaceStationShell.ts';
import type { SpaceStationCell, SpaceStationGraph, SpaceStationPortal, CellId } from './spaceStationTypes.ts';

/**
 * Walking inside an spaceStation.
 *
 * Cells are convex boxes and the only way between them is a portal, which makes
 * collision cheap and exact: clamp to the current cell, and permit a transition
 * only when the move actually passes through an opening. No physics world, no
 * broadphase, no tunnelling — and it is pure, so it can be tested without a renderer.
 *
 * Props are solid too, when a blocker index is supplied. That stays optional
 * because the shell is what makes a space navigable and the furniture is what makes
 * it inhabited — the two are separable, and a caller that only wants the first
 * (a layout test, a fly-through) should not have to build the second.
 */

export const PLAYER_RADIUS = 0.42;
export const PLAYER_EYE_HEIGHT = 1.68;
/** Floor to crown. Slightly above the eye, which is what has to clear an overhang. */
export const PLAYER_BODY_HEIGHT = PLAYER_EYE_HEIGHT + 0.1;
export const GRAVITY = -19;
export const TERMINAL_FALL_SPEED = -55;
/** Feet must clear the bottom of an opening by this much to walk through it. */
const STEP_TOLERANCE = 0.45;
const MAX_STEP_SECONDS = 0.05;

/** The player's body, as prop collision sees it. */
export const PLAYER_BODY: BodyMetrics = {
  radius: PLAYER_RADIUS,
  height: PLAYER_BODY_HEIGHT,
  step: STEP_TOLERANCE
};

export interface WalkState {
  /** Feet position. Eye position is this plus PLAYER_EYE_HEIGHT. */
  position: Vec3Tuple;
  velocityY: number;
  grounded: boolean;
  cellId: CellId | null;
}

export function createWalkState(graph: SpaceStationGraph, spawn: Vec3Tuple): WalkState {
  const cell = enterableCellAt(graph, spawn);
  return {
    position: [spawn[0], spawn[1], spawn[2]],
    velocityY: 0,
    grounded: false,
    cellId: cell?.id ?? null
  };
}

export interface WalkInput {
  /** World-space horizontal intent, already scaled by speed and time. */
  dx: number;
  dz: number;
  jump?: boolean;
}

export const JUMP_SPEED = 6.4;

/**
 * Advance one step. Returns a new state; the input state is not mutated, so a
 * caller can speculatively test a move.
 */
export function stepWalk(
  graph: SpaceStationGraph,
  state: WalkState,
  input: WalkInput,
  deltaSeconds: number,
  props?: BlockerIndex
): WalkState {
  const dt = Math.min(Math.max(deltaSeconds, 0), MAX_STEP_SECONDS);
  const current = cellById(graph, state.cellId) ?? enterableCellAt(graph, state.position);
  if (!current) return state;

  const horizontal = resolveHorizontal(graph, current, state.position, input.dx, input.dz);

  // Props resolve after the shell, not instead of it. The cell clamp decides which
  // room you are in and whether the move is through a doorway at all; the furniture
  // only ever narrows the answer further, so it can never push you through a wall.
  let [x, z] = [horizontal.position[0], horizontal.position[2]];
  if (props) {
    [x, z] = slideAgainstProps(props, state.position[0], state.position[2], x, z, state.position[1], PLAYER_BODY);
  }

  let velocityY = state.velocityY;
  if (state.grounded && input.jump) velocityY = JUMP_SPEED;
  velocityY = Math.max(TERMINAL_FALL_SPEED, velocityY + GRAVITY * dt);

  const cell = cellById(graph, horizontal.cellId) ?? current;
  let y = horizontal.position[1] + velocityY * dt;
  let grounded = false;

  const floor = props
    ? supportHeightAt(props, x, z, state.position[1], cell.min[1], PLAYER_BODY)
    : cell.min[1];
  if (y <= floor) {
    y = floor;
    velocityY = 0;
    grounded = true;
  }

  let ceiling = cell.max[1] - PLAYER_BODY_HEIGHT;
  if (props) {
    const overhead = headroomAt(props, x, z, state.position[1], PLAYER_BODY);
    if (overhead < Infinity) ceiling = Math.min(ceiling, overhead - PLAYER_BODY_HEIGHT);
  }
  // A body already standing taller than its headroom must not be shoved through the
  // floor: the overhang stops a rise, it does not press you down.
  ceiling = Math.max(ceiling, floor);
  if (y > ceiling) {
    y = ceiling;
    if (velocityY > 0) velocityY = 0;
  }

  return {
    position: [x, y, z],
    velocityY,
    grounded,
    cellId: cell.id
  };
}

function resolveHorizontal(
  graph: SpaceStationGraph,
  current: SpaceStationCell,
  position: Vec3Tuple,
  dx: number,
  dz: number
): { position: Vec3Tuple; cellId: CellId } {
  const desired: Vec3Tuple = [position[0] + dx, position[1], position[2] + dz];

  // Staying inside the current cell is the common case.
  if (withinCellFootprint(current, desired, PLAYER_RADIUS)) {
    return { position: desired, cellId: current.id };
  }

  // Otherwise the only legal ground is a doorway. A cell footprint is inset by the
  // player radius, so the strip between two cells belongs to neither of them — the
  // doorway slab is what bridges that gap, and standing in it is legal.
  for (const portal of graph.portals) {
    if (portal.sealed) continue;
    if (portal.a !== current.id && portal.b !== current.id) continue;

    const neighbour = cellById(graph, portal.a === current.id ? portal.b : portal.a);
    if (!neighbour?.enterable) continue;
    if (!inDoorwaySlab(portal, desired)) continue;

    // Hand the player over once they are past the threshold, so floor height and
    // visibility come from the room they are actually entering.
    const normalAxis = portalNormalAxis(portal);
    const pastThreshold = normalAxis >= 0
      && Math.sign(desired[normalAxis] - portal.center[normalAxis])
        === Math.sign(cellCentreAxis(neighbour, normalAxis) - portal.center[normalAxis]);

    return { position: desired, cellId: pastThreshold ? neighbour.id : current.id };
  }

  // Blocked. Slide along the wall rather than stopping dead.
  const slid: Vec3Tuple = [
    clampAxis(current, 0, position[0] + dx),
    position[1],
    clampAxis(current, 2, position[2] + dz)
  ];
  return { position: slid, cellId: current.id };
}

/**
 * Whether a point stands inside the passable volume of an opening: within its
 * lateral bounds, clear of its sill and head, and close enough to its plane to be
 * in the threshold rather than inside a wall.
 */
function inDoorwaySlab(portal: SpaceStationPortal, point: Vec3Tuple): boolean {
  const normalAxis = portalNormalAxis(portal);
  if (normalAxis < 0) return false;

  // Deep enough to bridge both cells' inset footprints plus the wall itself.
  const slabHalf = WALL_THICKNESS / 2 + PLAYER_RADIUS + 0.5;
  if (Math.abs(point[normalAxis] - portal.center[normalAxis]) > slabHalf) return false;

  for (let axis = 0; axis < 3; axis++) {
    if (axis === normalAxis) continue;
    const half = portal.halfExtents[axis];
    const low = portal.center[axis] - half;
    const high = portal.center[axis] + half;
    const at = point[axis];

    if (axis === 1) {
      // Feet may sit a little below the sill (a low step) but the head must clear.
      if (at < low - STEP_TOLERANCE) return false;
      if (at > high - 0.2) return false;
    } else if (at < low + PLAYER_RADIUS || at > high - PLAYER_RADIUS) {
      return false;
    }
  }
  return true;
}

function portalNormalAxis(portal: SpaceStationPortal): number {
  return portal.halfExtents.findIndex(extent => extent === 0);
}

function cellCentreAxis(cell: SpaceStationCell, axis: number): number {
  return (cell.min[axis] + cell.max[axis]) / 2;
}

export function eyePosition(state: WalkState): Vec3Tuple {
  return [state.position[0], state.position[1] + PLAYER_EYE_HEIGHT, state.position[2]];
}

function withinCellFootprint(cell: SpaceStationCell, point: Vec3Tuple, radius: number): boolean {
  return (
    point[0] >= cell.min[0] + radius && point[0] <= cell.max[0] - radius &&
    point[2] >= cell.min[2] + radius && point[2] <= cell.max[2] - radius
  );
}

function clampAxis(cell: SpaceStationCell, axis: 0 | 2, value: number): number {
  return Math.min(Math.max(value, cell.min[axis] + PLAYER_RADIUS), cell.max[axis] - PLAYER_RADIUS);
}

function cellById(graph: SpaceStationGraph, id: CellId | null): SpaceStationCell | null {
  if (!id) return null;
  return graph.cells.find(cell => cell.id === id) ?? null;
}

function enterableCellAt(graph: SpaceStationGraph, point: Vec3Tuple): SpaceStationCell | null {
  return (
    graph.cells.find(
      cell =>
        cell.enterable &&
        point[0] >= cell.min[0] && point[0] <= cell.max[0] &&
        point[2] >= cell.min[2] && point[2] <= cell.max[2]
    ) ?? null
  );
}
