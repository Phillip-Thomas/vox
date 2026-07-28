import type { Vec3Tuple } from '../starSystem.ts';
import type { SpaceStationCell, SpaceStationGraph, SpaceStationPortal, CellId } from './spaceStationTypes.ts';

/**
 * Portal visibility for spaceStation interiors.
 *
 * Three.js has no occlusion culling, and GPU occlusion queries cost a frame or two
 * of readback latency that shows up as popping. Interiors do not need either: the
 * generator already knows which volumes connect to which, so exact visibility is a
 * breadth-first walk of that graph, clipping a screen-space rectangle at every
 * opening. It runs on the CPU over tens of cells and is free of latency artifacts.
 *
 * Everything here is pure. No renderer, no THREE import — the caller passes a
 * view-projection matrix and gets back the set of cells that can be seen.
 */

/** Axis-aligned rectangle in normalized device coordinates, -1..1 on both axes. */
export interface NdcRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Column-major 4x4, matching the layout of `THREE.Matrix4.elements`. */
export type Mat4 = ArrayLike<number>;

export const FULL_NDC_RECT: NdcRect = Object.freeze({ minX: -1, minY: -1, maxX: 1, maxY: 1 });

export interface VisibleCellsOptions {
  /** Portal chains deeper than this stop expanding. Long sightlines rarely exceed 6. */
  maxDepth?: number;
  /** Hard backstop against pathological graphs. Never hit by a sane layout. */
  maxSteps?: number;
}

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_STEPS = 512;
/** Clip-space w below this is at or behind the eye and cannot be divided through. */
const W_EPSILON = 1e-6;

type ClipVertex = [number, number, number, number];

export function cellContainingPoint(graph: SpaceStationGraph, point: Vec3Tuple): CellId | null {
  for (const cell of graph.cells) {
    if (pointInCell(cell, point)) return cell.id;
  }
  return null;
}

export function pointInCell(cell: SpaceStationCell, point: Vec3Tuple): boolean {
  return (
    point[0] >= cell.min[0] && point[0] <= cell.max[0] &&
    point[1] >= cell.min[1] && point[1] <= cell.max[1] &&
    point[2] >= cell.min[2] && point[2] <= cell.max[2]
  );
}

/**
 * The four corners of a portal opening, in local space.
 *
 * Exactly one half-extent component must be zero — that axis is the portal normal.
 * Anything else is a malformed portal and yields no corners, which reads downstream
 * as "cannot see through it" rather than as a crash.
 */
export function portalCorners(portal: SpaceStationPortal): Vec3Tuple[] {
  const spanAxes: number[] = [];
  for (let axis = 0; axis < 3; axis++) {
    if (portal.halfExtents[axis] !== 0) spanAxes.push(axis);
  }
  if (spanAxes.length !== 2) return [];

  const [u, v] = spanAxes;
  const corners: Vec3Tuple[] = [];
  for (const signU of [-1, 1]) {
    for (const signV of [-1, 1]) {
      const corner: Vec3Tuple = [portal.center[0], portal.center[1], portal.center[2]];
      corner[u] += signU * portal.halfExtents[u];
      corner[v] += signV * portal.halfExtents[v];
      corners.push(corner);
    }
  }
  // Reorder from (--, -+, +-, ++) into a proper ring so polygon clipping walks edges.
  return [corners[0], corners[1], corners[3], corners[2]];
}

/**
 * Project a portal to its NDC bounding rectangle, or null when it cannot be seen.
 *
 * The polygon is clipped against the near plane before the perspective divide.
 * Skipping that step is the classic portal-culling bug: a vertex behind the eye has
 * negative w and projects to a mirrored position, silently inflating the rectangle
 * and revealing cells that are actually behind the camera.
 */
export function projectPortalToNdcRect(portal: SpaceStationPortal, viewProjection: Mat4): NdcRect | null {
  const corners = portalCorners(portal);
  if (corners.length < 3) return null;

  const clipped = clipPolygonToNearPlane(corners.map(corner => transformToClip(corner, viewProjection)));
  if (clipped.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const vertex of clipped) {
    const ndcX = vertex[0] / vertex[3];
    const ndcY = vertex[1] / vertex[3];
    if (ndcX < minX) minX = ndcX;
    if (ndcX > maxX) maxX = ndcX;
    if (ndcY < minY) minY = ndcY;
    if (ndcY > maxY) maxY = ndcY;
  }
  return { minX, minY, maxX, maxY };
}

export function intersectNdcRect(a: NdcRect, b: NdcRect): NdcRect | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (minX >= maxX || minY >= maxY) return null;
  return { minX, minY, maxX, maxY };
}

export function ndcRectContains(outer: NdcRect, inner: NdcRect): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.minY <= inner.minY &&
    outer.maxX >= inner.maxX &&
    outer.maxY >= inner.maxY
  );
}

/**
 * The set of cells visible from `originCell`, including it.
 *
 * A neighbour is reached only through an opening whose projected rectangle still
 * overlaps the rectangle we arrived with, so the aperture narrows down every chain
 * and long sightlines terminate on their own.
 */
export function visibleCells(
  graph: SpaceStationGraph,
  originCell: CellId,
  viewProjection: Mat4,
  options: VisibleCellsOptions = {}
): Set<CellId> {
  const visible = new Set<CellId>();
  if (!graph.cells.some(cell => cell.id === originCell)) return visible;
  visible.add(originCell);

  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const adjacency = buildAdjacency(graph);
  // Per cell, the apertures we have already expanded through. A new arrival that is
  // fully contained by one of them cannot reveal anything further, so it is dropped.
  const expanded = new Map<CellId, NdcRect[]>();

  const queue: Array<{ cell: CellId; rect: NdcRect; depth: number }> = [
    { cell: originCell, rect: FULL_NDC_RECT, depth: 0 }
  ];
  let steps = 0;

  while (queue.length > 0 && steps < maxSteps) {
    const current = queue.shift()!;
    steps++;
    if (current.depth >= maxDepth) continue;

    for (const portal of adjacency.get(current.cell) ?? []) {
      if (portal.sealed) continue;
      const neighbour = portal.a === current.cell ? portal.b : portal.a;

      const portalRect = projectPortalToNdcRect(portal, viewProjection);
      if (!portalRect) continue;
      const aperture = intersectNdcRect(current.rect, portalRect);
      if (!aperture) continue;

      const seen = expanded.get(neighbour);
      if (seen && seen.some(rect => ndcRectContains(rect, aperture))) continue;

      if (seen) seen.push(aperture);
      else expanded.set(neighbour, [aperture]);

      visible.add(neighbour);
      queue.push({ cell: neighbour, rect: aperture, depth: current.depth + 1 });
    }
  }

  return visible;
}

export function buildAdjacency(graph: SpaceStationGraph): Map<CellId, SpaceStationPortal[]> {
  const adjacency = new Map<CellId, SpaceStationPortal[]>();
  for (const portal of graph.portals) {
    pushPortal(adjacency, portal.a, portal);
    pushPortal(adjacency, portal.b, portal);
  }
  return adjacency;
}

function pushPortal(adjacency: Map<CellId, SpaceStationPortal[]>, cell: CellId, portal: SpaceStationPortal): void {
  const existing = adjacency.get(cell);
  if (existing) existing.push(portal);
  else adjacency.set(cell, [portal]);
}

function transformToClip(point: Vec3Tuple, m: Mat4): ClipVertex {
  const [x, y, z] = point;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15]
  ];
}

/** Sutherland-Hodgman against the half-space w > epsilon. */
function clipPolygonToNearPlane(polygon: ClipVertex[]): ClipVertex[] {
  const output: ClipVertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currentInside = current[3] > W_EPSILON;
    const nextInside = next[3] > W_EPSILON;

    if (currentInside) output.push(current);
    if (currentInside !== nextInside) {
      const t = (W_EPSILON - current[3]) / (next[3] - current[3]);
      output.push([
        current[0] + (next[0] - current[0]) * t,
        current[1] + (next[1] - current[1]) * t,
        current[2] + (next[2] - current[2]) * t,
        W_EPSILON
      ]);
    }
  }
  return output;
}
