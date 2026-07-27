import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import type {
  AnchorageCell,
  AnchorageCellKind,
  AnchorageGraph,
  AnchoragePortal
} from './anchorageTypes.ts';

/**
 * The anchorage layout generator.
 *
 * Deliberately dumb to begin with: the macro topology is authored — apron, counter,
 * floor, shelves, blank, in that order — and only dimensions vary by seed. Purely
 * procedural layout reliably produces topologically valid, visually monotonous
 * mush; what ships elsewhere is authored structure with generated fill, and the
 * knobs that make instances feel different (primitive vocabulary, occupancy ratio)
 * are worth adding once one instance is proven rather than before.
 *
 * The spatial program is a test harness as much as a place. Each cell exercises
 * something different: a fully enclosed volume, an unskippable corridor, a vast
 * dark hall, a dense warehouse, and a sealed volume that must stay in the graph
 * for streaming and probe placement without being enterable.
 */

export const ANCHORAGE_LAYOUT_VERSION = 1;

/** Salts are arbitrary but frozen — changing one re-rolls every existing anchorage. */
const SALT = {
  apronLength: 211,
  apronHeight: 223,
  counterLength: 227,
  concourseLength: 257,
  concourseHeight: 263,
  concourseHalfWidth: 269,
  floorLength: 229,
  floorHeight: 233,
  floorHalfWidth: 239,
  shelvesLength: 241,
  blankSize: 251
} as const;

function lerp(min: number, max: number, unit: number): number {
  return min + (max - min) * unit;
}

/** Metre-scale dimensions read better as whole numbers in debug overlays. */
function dimension(seed: number, salt: number, min: number, max: number): number {
  return Math.round(lerp(min, max, seededUnit(seed, salt)));
}

export function buildAnchorageGraph(seed: number): AnchorageGraph {
  // Rooms are sized to be filled, not to impress. A 180x60x25m dock read as a void
  // with two lamps in it; the concourse works precisely because it is small enough
  // that its contents reach the walls. Scale is delivered by what is in a room.
  const apronLength = dimension(seed, SALT.apronLength, 92, 124);
  const apronHeight = dimension(seed, SALT.apronHeight, 13, 17);
  const counterLength = dimension(seed, SALT.counterLength, 80, 110);
  const concourseLength = dimension(seed, SALT.concourseLength, 130, 175);
  const concourseHeight = dimension(seed, SALT.concourseHeight, 11, 15);
  const concourseHalfWidth = dimension(seed, SALT.concourseHalfWidth, 42, 58);
  // The bureaucratic hall, cut again. At 260x400x130m it was still a void; a real
  // open-plan floor is wide and low, and the cubicle grid needs to reach the walls
  // for the room to read as administered rather than abandoned.
  const floorLength = dimension(seed, SALT.floorLength, 150, 195);
  const floorHeight = dimension(seed, SALT.floorHeight, 34, 46);
  const floorHalfWidth = dimension(seed, SALT.floorHalfWidth, 62, 84);
  const shelvesLength = dimension(seed, SALT.shelvesLength, 100, 140);
  const blankSize = dimension(seed, SALT.blankSize, 180, 220);

  // The whole structure runs along +X so that a single sightline from the dock can
  // reach the market — the reveal the interior is built around.
  const apronStart = 0;
  const counterStart = apronStart + apronLength;
  const concourseStart = counterStart + counterLength;
  const floorStart = concourseStart + concourseLength;
  const shelvesStart = floorStart + floorLength;
  const blankStart = shelvesStart + shelvesLength;

  const APRON_HALF_WIDTH = 17;
  const COUNTER_HALF_WIDTH = 6;
  const COUNTER_HEIGHT = 6;
  const SHELVES_HALF_WIDTH = 34;
  const SHELVES_HEIGHT = 16;

  const cells: AnchorageCell[] = [
    box('apron', 'apron', [apronStart, 0, -APRON_HALF_WIDTH], [counterStart, apronHeight, APRON_HALF_WIDTH]),
    box('counter', 'counter', [counterStart, 0, -COUNTER_HALF_WIDTH], [concourseStart, COUNTER_HEIGHT, COUNTER_HALF_WIDTH]),
    box('concourse', 'concourse', [concourseStart, 0, -concourseHalfWidth], [floorStart, concourseHeight, concourseHalfWidth]),
    box('floor', 'floor', [floorStart, 0, -floorHalfWidth], [shelvesStart, floorHeight, floorHalfWidth]),
    box('shelves', 'shelves', [shelvesStart, 0, -SHELVES_HALF_WIDTH], [blankStart, SHELVES_HEIGHT, SHELVES_HALF_WIDTH]),
    box('blank', 'blank', [blankStart, 0, -blankSize / 2], [blankStart + blankSize, blankSize, blankSize / 2], false)
  ];

  const portals: AnchoragePortal[] = [
    opening('apron-counter', 'apron', 'counter', counterStart, 2.6, 0, 2.6, COUNTER_HALF_WIDTH),
    opening('counter-concourse', 'counter', 'concourse', concourseStart, 2.6, 0, 2.6, COUNTER_HALF_WIDTH),
    // Wide, so the concourse announces itself as a public room rather than a door.
    opening('concourse-floor', 'concourse', 'floor', floorStart, 3.4, 0, 3.4, 14),
    opening('floor-shelves', 'floor', 'shelves', shelvesStart, 6, 0, 6, 24),
    // Sealed: the volume stays in the graph so streaming, probes and reverb still
    // account for it, but nothing sees or walks through.
    { ...opening('shelves-blank', 'shelves', 'blank', blankStart, 6, 0, 6, 14), sealed: true }
  ];

  return { cells, portals };
}

export function anchorageBoundRadius(graph: AnchorageGraph): number {
  let maxDistance = 0;
  for (const cell of graph.cells) {
    for (const corner of cellCorners(cell)) {
      maxDistance = Math.max(maxDistance, Math.hypot(corner[0], corner[1], corner[2]));
    }
  }
  return Math.ceil(maxDistance);
}

/**
 * Generator assertions. A layout that violates these would render, but would leak
 * visibility or strand the player, so the generator must not be trusted until it
 * reports clean. Returns human-readable problems; empty means valid.
 */
export function validateAnchorageGraph(graph: AnchorageGraph): string[] {
  const problems: string[] = [];
  const byId = new Map(graph.cells.map(cell => [cell.id, cell]));

  if (byId.size !== graph.cells.length) problems.push('duplicate cell id');

  for (const cell of graph.cells) {
    for (let axis = 0; axis < 3; axis++) {
      if (cell.min[axis] >= cell.max[axis]) {
        problems.push(`cell ${cell.id} has non-positive extent on axis ${axis}`);
      }
    }
  }

  for (const portal of graph.portals) {
    const a = byId.get(portal.a);
    const b = byId.get(portal.b);
    if (!a || !b) {
      problems.push(`portal ${portal.id} references a missing cell`);
      continue;
    }
    if (portal.a === portal.b) problems.push(`portal ${portal.id} joins a cell to itself`);

    const zeroAxes = [0, 1, 2].filter(axis => portal.halfExtents[axis] === 0);
    if (zeroAxes.length !== 1) {
      problems.push(`portal ${portal.id} must have exactly one zero half-extent to define a normal`);
      continue;
    }

    // The opening has to lie inside both volumes, otherwise it is a hole in a wall
    // that does not exist and sight leaks into geometry the player cannot reach.
    for (const cell of [a, b]) {
      for (let axis = 0; axis < 3; axis++) {
        const low = portal.center[axis] - portal.halfExtents[axis];
        const high = portal.center[axis] + portal.halfExtents[axis];
        const tolerance = 1e-6;
        if (low < cell.min[axis] - tolerance || high > cell.max[axis] + tolerance) {
          problems.push(`portal ${portal.id} extends outside cell ${cell.id} on axis ${axis}`);
        }
      }
    }
  }

  const reachable = reachableCells(graph);
  for (const cell of graph.cells) {
    if (cell.enterable && !reachable.has(cell.id)) {
      problems.push(`cell ${cell.id} is enterable but unreachable through open portals`);
    }
  }

  return problems;
}

/** Cells reachable on foot from the first enterable cell, ignoring sealed portals. */
export function reachableCells(graph: AnchorageGraph): Set<string> {
  const start = graph.cells.find(cell => cell.enterable);
  const reached = new Set<string>();
  if (!start) return reached;

  reached.add(start.id);
  const queue = [start.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const portal of graph.portals) {
      if (portal.sealed) continue;
      const next = portal.a === current ? portal.b : portal.b === current ? portal.a : null;
      if (!next || reached.has(next)) continue;
      const cell = graph.cells.find(entry => entry.id === next);
      if (!cell?.enterable) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function box(
  id: string,
  kind: AnchorageCellKind,
  min: Vec3Tuple,
  max: Vec3Tuple,
  enterable = true
): AnchorageCell {
  return { id, kind, min, max, enterable };
}

/** An opening in the YZ plane at `x`, which is how every join in this layout runs. */
function opening(
  id: string,
  a: string,
  b: string,
  x: number,
  centerY: number,
  centerZ: number,
  halfHeight: number,
  halfWidth: number
): AnchoragePortal {
  return {
    id,
    a,
    b,
    center: [x, centerY, centerZ],
    halfExtents: [0, halfHeight, halfWidth]
  };
}

function cellCorners(cell: AnchorageCell): Vec3Tuple[] {
  const corners: Vec3Tuple[] = [];
  for (const x of [cell.min[0], cell.max[0]]) {
    for (const y of [cell.min[1], cell.max[1]]) {
      for (const z of [cell.min[2], cell.max[2]]) {
        corners.push([x, y, z]);
      }
    }
  }
  return corners;
}
