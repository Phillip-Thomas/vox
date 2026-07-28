import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { SpaceStationBox } from './spaceStationShell.ts';
import type { SpaceStationCell, SpaceStationGraph, SpaceStationPortal } from './spaceStationTypes.ts';

/**
 * Architectural detail: the layer that turns a room-shaped volume into a built room.
 *
 * A wall with a panel shader on it still reads as a smooth plane, because a real
 * bulkhead is not a plane — it is ribs, a skirting band, a cornice, conduit chased
 * along the ceiling line, and recessed panels between the ribs. Those give a surface
 * three things a shader cannot: a silhouette, self-shadowing under N8AO, and a second
 * and third readable scale as you walk toward it.
 *
 * Everything here is an axis-aligned box so it joins the same instanced draw as the
 * shell and dressing. Density scales with room size, and openings are respected —
 * a rib across a doorway is worse than no rib at all.
 */

const RIB_PITCH = 6.4;
const RIB_DEPTH = 0.38;
const RIB_WIDTH = 0.7;
const SKIRT_HEIGHT = 0.55;
const SKIRT_DEPTH = 0.16;
const CORNICE_HEIGHT = 0.42;
const CONDUIT_RADIUS = 0.16;
/** Clearance kept either side of an opening so nothing crosses a doorway. */
const OPENING_MARGIN = 2.2;

export function buildSpaceStationArchitecture(graph: SpaceStationGraph, seed: number): SpaceStationBox[] {
  const boxes: SpaceStationBox[] = [];
  for (const [index, cell] of graph.cells.entries()) {
    if (!cell.enterable) continue;
    const cellSeed = (seed ^ Math.imul(index + 13, 374761393)) >>> 0;
    const portals = graph.portals.filter(
      portal => portal.a === cell.id || portal.b === cell.id
    );
    for (const box of detailCell(cell, portals, cellSeed)) {
      boxes.push({ ...box, cellId: cell.id });
    }
  }
  return boxes;
}

function detailCell(
  cell: SpaceStationCell,
  portals: SpaceStationPortal[],
  seed: number
): SpaceStationBox[] {
  const boxes: SpaceStationBox[] = [];
  const length = cell.max[0] - cell.min[0];
  const height = cell.max[1] - cell.min[1];
  const floorY = cell.min[1];

  // Openings on the ±X end walls, so ribbing along those walls can dodge them.
  const endOpenings = portals
    .filter(portal => portal.halfExtents[0] === 0)
    .map(portal => ({ z: portal.center[2], half: portal.halfExtents[2] }));

  // --- ribs down the long walls ------------------------------------------------
  const ribs = Math.max(2, Math.floor(length / RIB_PITCH));
  for (let i = 0; i < ribs; i++) {
    const x = cell.min[0] + (length * (i + 0.5)) / ribs;
    for (const side of [-1, 1] as const) {
      const z = side > 0 ? cell.max[2] - RIB_DEPTH / 2 : cell.min[2] + RIB_DEPTH / 2;
      boxes.push({
        center: [x, floorY + height / 2, z],
        size: [RIB_WIDTH, height, RIB_DEPTH],
        kind: 'structure',
        tone: 2
      });
      // A recessed panel between ribs, one shade darker, sunk into the wall. The
      // recess is what makes the rib read as proud rather than as a painted stripe.
      if (i < ribs - 1) {
        const nextX = cell.min[0] + (length * (i + 1.5)) / ribs;
        const midX = (x + nextX) / 2;
        const panelWidth = Math.max(0.6, nextX - x - RIB_WIDTH - 0.5);
        boxes.push({
          center: [midX, floorY + height * 0.55, z + (side > 0 ? 0.14 : -0.14)],
          size: [panelWidth, height * 0.66, 0.12],
          kind: 'prop',
          tone: 6
        });
      }
    }
  }

  // --- skirting and cornice ----------------------------------------------------
  // Continuous bands at floor and ceiling. They terminate a wall the way a real
  // room does, and they catch a highlight that describes the room's extent.
  for (const side of [-1, 1] as const) {
    const z = side > 0 ? cell.max[2] - SKIRT_DEPTH / 2 : cell.min[2] + SKIRT_DEPTH / 2;
    boxes.push({
      center: [cell.min[0] + length / 2, floorY + SKIRT_HEIGHT / 2, z],
      size: [length, SKIRT_HEIGHT, SKIRT_DEPTH],
      kind: 'trim',
      tone: 3
    });
    boxes.push({
      center: [cell.min[0] + length / 2, cell.max[1] - CORNICE_HEIGHT / 2, z],
      size: [length, CORNICE_HEIGHT, SKIRT_DEPTH * 1.6],
      kind: 'structure',
      tone: 2
    });
  }

  // --- conduit chased along the ceiling line ------------------------------------
  // Three parallel runs at slightly different heights and gauges. Pipework is the
  // cheapest possible signal that a space is serviced rather than decorative.
  for (const side of [-1, 1] as const) {
    const wallZ = side > 0 ? cell.max[2] : cell.min[2];
    for (let run = 0; run < 3; run++) {
      const gauge = CONDUIT_RADIUS * (1 + run * 0.35);
      boxes.push({
        center: [
          cell.min[0] + length / 2,
          cell.max[1] - 1.1 - run * 0.42,
          wallZ - side * (0.5 + run * 0.34)
        ],
        size: [length, gauge, gauge],
        kind: 'trim',
        tone: 3
      });
    }
  }

  // --- ceiling trusses ----------------------------------------------------------
  // Skipped in the concourse, where canopies already own the overhead read and a
  // truss would fight them.
  if (cell.kind !== 'concourse') {
    const spanZ = cell.max[2] - cell.min[2];
    const trusses = Math.max(2, Math.floor(length / 9));
    for (let i = 0; i < trusses; i++) {
      const x = cell.min[0] + (length * (i + 0.5)) / trusses;
      boxes.push({
        center: [x, cell.max[1] - 0.9, (cell.min[2] + cell.max[2]) / 2],
        size: [0.55, 0.55, spanZ],
        kind: 'structure',
        tone: 2
      });
      // Chord below the main beam, so a truss has depth from underneath — which is
      // the only angle a walking player ever sees it from.
      boxes.push({
        center: [x, cell.max[1] - 1.75, (cell.min[2] + cell.max[2]) / 2],
        size: [0.3, 0.3, spanZ * 0.86],
        kind: 'trim',
        tone: 3
      });
    }
  }

  // --- end-wall articulation ----------------------------------------------------
  // Vertical ribs on the ±X walls, dodging any opening in them.
  const spanZ = cell.max[2] - cell.min[2];
  const endRibs = Math.max(2, Math.floor(spanZ / RIB_PITCH));
  for (const endSide of [-1, 1] as const) {
    const x = endSide > 0 ? cell.max[0] - RIB_DEPTH / 2 : cell.min[0] + RIB_DEPTH / 2;
    for (let i = 0; i < endRibs; i++) {
      const z = cell.min[2] + (spanZ * (i + 0.5)) / endRibs;
      const blocked = endOpenings.some(
        opening => Math.abs(z - opening.z) < opening.half + OPENING_MARGIN
      );
      if (blocked) continue;
      boxes.push({
        center: [x, floorY + height / 2, z],
        size: [RIB_DEPTH, height, RIB_WIDTH],
        kind: 'structure',
        tone: 2
      });
    }
  }

  // --- floor markings -----------------------------------------------------------
  // Painted lanes down the working axis. Reads as procedure, and gives the floor a
  // direction so a long room tells you which way it wants you to walk.
  if (cell.kind === 'apron' || cell.kind === 'shelves') {
    for (const side of [-1, 1] as const) {
      const z = (cell.min[2] + cell.max[2]) / 2 + side * (spanZ * 0.24);
      boxes.push({
        center: [cell.min[0] + length / 2, floorY + 0.02, z],
        size: [length * 0.94, 0.04, 0.3],
        kind: 'trim',
        tone: 3
      });
    }
  }

  // --- scattered service boxes ---------------------------------------------------
  // Junction panels and lockers bolted to the walls at irregular intervals. Purely
  // to break the rhythm the ribs establish; a perfectly regular wall reads as tiling.
  const services = Math.max(3, Math.floor(length / 14));
  for (let i = 0; i < services; i++) {
    const t = (i + seededUnit(seed, 300 + i)) / services;
    const side = seededUnit(seed, 340 + i) > 0.5 ? 1 : -1;
    const z = side > 0 ? cell.max[2] - 0.55 : cell.min[2] + 0.55;
    const h = 0.7 + seededUnit(seed, 380 + i) * 0.9;
    boxes.push({
      center: [cell.min[0] + length * t, floorY + 1.1 + seededUnit(seed, 420 + i) * 1.4, z],
      size: [0.6 + seededUnit(seed, 460 + i) * 0.8, h, 0.34],
      kind: 'prop',
      tone: 5
    });
  }

  return boxes;
}
