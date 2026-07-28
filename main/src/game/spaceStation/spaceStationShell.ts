import type { Vec3Tuple } from '../starSystem.ts';
import type { SpaceStationCell, SpaceStationGraph, SpaceStationPortal } from './spaceStationTypes.ts';

/**
 * Cell shells: turning a cell volume into actual architecture.
 *
 * A cell rendered as one inverted box is a room-shaped hole, not a room — adjacent
 * cells butt against each other with no visible way through. Here every cell becomes
 * a floor, a ceiling and four walls built from thin boxes, and any wall carrying a
 * portal is split into four pieces around the opening with a frame around it.
 *
 * Everything is an axis-aligned box so the whole structure still renders as instances
 * of one unit cube, and the doorway you can see is the same doorway the portal graph
 * culls through and the locomotion code lets you walk through.
 */

export type BoxKind = 'structure' | 'trim' | 'lamp' | 'prop';

/**
 * How a surface is articulated. One universal panel grid on every object reads as
 * graph paper wrapped around the world; each family gets its own scale and rhythm.
 */
export const SURFACE_STYLE = {
  /** Large welded hull plate. Walls, ceilings, columns. */
  hull: 0,
  /** Smaller deck tiles with a tread band. Floors. */
  deck: 1,
  /** Brushed, unpanelled. Rails, conduit, cornice, frames. */
  smooth: 2,
  /** Horizontal banding and a corner rib. Crates, containers, lockers. */
  container: 3,
  /** Soft weave, no seams at all. Awnings, banners, sign boards. */
  fabric: 4
} as const;

export type SurfaceStyle = (typeof SURFACE_STYLE)[keyof typeof SURFACE_STYLE];

/** The treatment a box gets when it does not ask for one. */
export function defaultStyleForKind(kind: BoxKind): SurfaceStyle {
  switch (kind) {
    case 'structure':
      return SURFACE_STYLE.hull;
    case 'trim':
      return SURFACE_STYLE.smooth;
    case 'prop':
      return SURFACE_STYLE.container;
    default:
      return SURFACE_STYLE.smooth;
  }
}

export interface SpaceStationBox {
  center: Vec3Tuple;
  size: Vec3Tuple;
  kind: BoxKind;
  /** Palette index resolved by the renderer, not a colour, so tiers can re-map. */
  tone: number;
  /** Owning cell, stamped by the top-level builders so the renderer can cull by cell. */
  cellId?: string;
  /**
   * Surface treatment family. Left undefined it is derived from `kind`, so a caller
   * only sets it when a box wants something other than its default — an awning is a
   * 'prop' but must not be panelled like a crate.
   */
  style?: SurfaceStyle;
  /**
   * For lamps: the reach this fitting is meant to have, in metres. A corridor
   * fitting and a fitting hung 180m above a market floor need wildly different
   * intensities, so the fitting carries its own scale rather than the lighting
   * code guessing from one global constant.
   */
  radius?: number;
}

export const WALL_THICKNESS = 0.6;
const FRAME_THICKNESS = 0.35;
const FRAME_DEPTH = 0.9;
/** Anything thinner than this is a rendering artifact rather than a surface. */
const MIN_PIECE = 0.02;

export function buildSpaceStationShell(graph: SpaceStationGraph): SpaceStationBox[] {
  const boxes: SpaceStationBox[] = [];
  for (const cell of graph.cells) {
    if (!cell.enterable) continue;
    const portals = graph.portals.filter(portal => touchesCell(portal, cell));
    for (const box of buildCellShell(cell, portals)) {
      boxes.push({ ...box, cellId: cell.id });
    }
  }
  return boxes;
}

export function buildCellShell(cell: SpaceStationCell, portals: SpaceStationPortal[]): SpaceStationBox[] {
  const boxes: SpaceStationBox[] = [];
  const size: Vec3Tuple = [
    cell.max[0] - cell.min[0],
    cell.max[1] - cell.min[1],
    cell.max[2] - cell.min[2]
  ];

  // Floor and ceiling sit inside the volume so the walkable height is the cell height.
  boxes.push({
    center: [mid(cell, 0), cell.min[1] - WALL_THICKNESS / 2, mid(cell, 2)],
    size: [size[0], WALL_THICKNESS, size[2]],
    kind: 'structure',
    tone: 0,
    style: SURFACE_STYLE.deck
  });
  boxes.push({
    center: [mid(cell, 0), cell.max[1] + WALL_THICKNESS / 2, mid(cell, 2)],
    size: [size[0], WALL_THICKNESS, size[2]],
    kind: 'structure',
    tone: 1
  });

  // Four vertical walls, one per horizontal face.
  for (const axis of [0, 2] as const) {
    for (const side of ['min', 'max'] as const) {
      const plane = side === 'min' ? cell.min[axis] : cell.max[axis];
      const openings = portals.filter(portal => portalLiesOnFace(portal, axis, plane));
      boxes.push(...buildWall(cell, axis, plane, side, openings));
      for (const opening of openings) {
        boxes.push(...buildFrame(opening, axis, plane));
      }
    }
  }

  return boxes;
}

/**
 * One wall face, split around its openings.
 *
 * Only the first opening on a face is cut. Two openings in one wall would need a
 * real polygon split; the layout never produces that, and `validateSpaceStationShell`
 * reports it rather than silently rendering a wall over a doorway.
 */
function buildWall(
  cell: SpaceStationCell,
  normalAxis: 0 | 2,
  plane: number,
  side: 'min' | 'max',
  openings: SpaceStationPortal[]
): SpaceStationBox[] {
  const [u, v] = normalAxis === 0 ? ([2, 1] as const) : ([0, 1] as const);
  const offset = side === 'min' ? -WALL_THICKNESS / 2 : WALL_THICKNESS / 2;

  const uMin = cell.min[u];
  const uMax = cell.max[u];
  const vMin = cell.min[v];
  const vMax = cell.max[v];

  const makePiece = (
    pieceUMin: number,
    pieceUMax: number,
    pieceVMin: number,
    pieceVMax: number
  ): SpaceStationBox | null => {
    const uSize = pieceUMax - pieceUMin;
    const vSize = pieceVMax - pieceVMin;
    if (uSize <= MIN_PIECE || vSize <= MIN_PIECE) return null;
    const center: Vec3Tuple = [0, 0, 0];
    const boxSize: Vec3Tuple = [0, 0, 0];
    center[normalAxis] = plane + offset;
    boxSize[normalAxis] = WALL_THICKNESS;
    center[u] = (pieceUMin + pieceUMax) / 2;
    boxSize[u] = uSize;
    center[v] = (pieceVMin + pieceVMax) / 2;
    boxSize[v] = vSize;
    return { center, size: boxSize, kind: 'structure', tone: 2 };
  };

  const opening = openings[0];
  if (!opening) {
    const solid = makePiece(uMin, uMax, vMin, vMax);
    return solid ? [solid] : [];
  }

  const openUMin = opening.center[u] - opening.halfExtents[u];
  const openUMax = opening.center[u] + opening.halfExtents[u];
  const openVMin = opening.center[v] - opening.halfExtents[v];
  const openVMax = opening.center[v] + opening.halfExtents[v];

  return [
    makePiece(uMin, openUMin, vMin, vMax),
    makePiece(openUMax, uMax, vMin, vMax),
    makePiece(openUMin, openUMax, vMin, openVMin),
    makePiece(openUMin, openUMax, openVMax, vMax)
  ].filter((box): box is SpaceStationBox => box !== null);
}

/** A raised lip around an opening so a doorway reads as built rather than cut. */
function buildFrame(opening: SpaceStationPortal, normalAxis: 0 | 2, plane: number): SpaceStationBox[] {
  const [u, v] = normalAxis === 0 ? ([2, 1] as const) : ([0, 1] as const);
  const uHalf = opening.halfExtents[u];
  const vHalf = opening.halfExtents[v];

  const piece = (
    uCenter: number,
    vCenter: number,
    uSize: number,
    vSize: number
  ): SpaceStationBox => {
    const center: Vec3Tuple = [0, 0, 0];
    const size: Vec3Tuple = [0, 0, 0];
    center[normalAxis] = plane;
    size[normalAxis] = FRAME_DEPTH;
    center[u] = uCenter;
    size[u] = uSize;
    center[v] = vCenter;
    size[v] = vSize;
    return { center, size, kind: 'trim', tone: 3 };
  };

  const uCenter = opening.center[u];
  const vCenter = opening.center[v];
  const outerU = uHalf + FRAME_THICKNESS;

  return [
    piece(uCenter - uHalf - FRAME_THICKNESS / 2, vCenter, FRAME_THICKNESS, (vHalf + FRAME_THICKNESS) * 2),
    piece(uCenter + uHalf + FRAME_THICKNESS / 2, vCenter, FRAME_THICKNESS, (vHalf + FRAME_THICKNESS) * 2),
    piece(uCenter, vCenter + vHalf + FRAME_THICKNESS / 2, outerU * 2, FRAME_THICKNESS)
  ];
}

export function touchesCell(portal: SpaceStationPortal, cell: SpaceStationCell): boolean {
  return portal.a === cell.id || portal.b === cell.id;
}

function portalLiesOnFace(portal: SpaceStationPortal, axis: 0 | 2, plane: number): boolean {
  // The portal's normal is its zero half-extent axis.
  if (portal.halfExtents[axis] !== 0) return false;
  return Math.abs(portal.center[axis] - plane) < 1e-6;
}

function mid(cell: SpaceStationCell, axis: 0 | 1 | 2): number {
  return (cell.min[axis] + cell.max[axis]) / 2;
}

/** Reports layout shapes this shell builder cannot represent honestly. */
export function validateSpaceStationShell(graph: SpaceStationGraph): string[] {
  const problems: string[] = [];
  for (const cell of graph.cells) {
    if (!cell.enterable) continue;
    const portals = graph.portals.filter(portal => touchesCell(portal, cell));
    for (const axis of [0, 2] as const) {
      for (const side of ['min', 'max'] as const) {
        const plane = side === 'min' ? cell.min[axis] : cell.max[axis];
        const openings = portals.filter(portal => portalLiesOnFace(portal, axis, plane));
        if (openings.length > 1) {
          problems.push(
            `cell ${cell.id} has ${openings.length} openings on one face; the shell builder cuts only the first`
          );
        }
      }
    }
  }
  return problems;
}
