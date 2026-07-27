import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Vec3Tuple } from '../starSystem.ts';
import type { AnchorageCell, AnchorageGraph, AnchoragePortal } from './anchorageTypes.ts';
import {
  cellContainingPoint,
  intersectNdcRect,
  portalCorners,
  projectPortalToNdcRect,
  visibleCells
} from './portalGraph.ts';

function viewProjection(
  position: Vec3Tuple,
  target: Vec3Tuple,
  { fov = 60, aspect = 16 / 9, near = 0.1, far = 5_000 } = {}
): number[] {
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
  camera.updateMatrixWorld(true);
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return Array.from(matrix.elements);
}

const cell = (id: string, minX: number, maxX: number): AnchorageCell => ({
  id,
  kind: 'floor',
  min: [minX, 0, -6],
  max: [maxX, 4, 6],
  enterable: true
});

/** A → B → C in a straight line along +X, joined by narrow centred openings. */
function corridorGraph(overrides: Partial<AnchoragePortal> = {}): AnchorageGraph {
  return {
    cells: [cell('a', 0, 10), cell('b', 10, 20), cell('c', 20, 30)],
    portals: [
      { id: 'ab', a: 'a', b: 'b', center: [10, 2, 0], halfExtents: [0, 1.5, 0.5] },
      { id: 'bc', a: 'b', b: 'c', center: [20, 2, 0], halfExtents: [0, 1.5, 0.5], ...overrides }
    ]
  };
}

describe('cell containment', () => {
  it('locates the cell holding a point and reports nothing outside the graph', () => {
    const graph = corridorGraph();
    expect(cellContainingPoint(graph, [5, 2, 0])).toBe('a');
    expect(cellContainingPoint(graph, [15, 2, 0])).toBe('b');
    expect(cellContainingPoint(graph, [500, 2, 0])).toBeNull();
  });
});

describe('portal corners', () => {
  it('builds four corners spanning the two non-degenerate axes', () => {
    const corners = portalCorners({ id: 'p', a: 'a', b: 'b', center: [10, 2, 0], halfExtents: [0, 1.5, 0.5] });
    expect(corners).toHaveLength(4);
    expect(corners.every(corner => corner[0] === 10)).toBe(true);
    expect(new Set(corners.map(corner => corner[1]))).toEqual(new Set([0.5, 3.5]));
    expect(new Set(corners.map(corner => corner[2]))).toEqual(new Set([-0.5, 0.5]));
  });

  it('treats a malformed portal as impassable to sight rather than throwing', () => {
    // Two zero components is a line, not an opening.
    expect(portalCorners({ id: 'p', a: 'a', b: 'b', center: [0, 0, 0], halfExtents: [0, 0, 1] })).toEqual([]);
    // No zero component has no well-defined normal.
    expect(portalCorners({ id: 'p', a: 'a', b: 'b', center: [0, 0, 0], halfExtents: [1, 1, 1] })).toEqual([]);
  });
});

describe('ndc rect intersection', () => {
  it('returns the overlap, and null when rectangles only touch or miss', () => {
    const a = { minX: -1, minY: -1, maxX: 0, maxY: 0 };
    const b = { minX: -0.5, minY: -0.5, maxX: 1, maxY: 1 };
    expect(intersectNdcRect(a, b)).toEqual({ minX: -0.5, minY: -0.5, maxX: 0, maxY: 0 });
    expect(intersectNdcRect(a, { minX: 0, minY: 0, maxX: 1, maxY: 1 })).toBeNull();
    expect(intersectNdcRect(a, { minX: 0.5, minY: 0.5, maxX: 1, maxY: 1 })).toBeNull();
  });
});

describe('visibility through portals', () => {
  it('sees down an aligned corridor through both openings', () => {
    const graph = corridorGraph();
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [30, 2, 0]));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('sees only the current cell when facing away from the opening', () => {
    const graph = corridorGraph();
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [-30, 2, 0]));
    expect(seen).toEqual(new Set(['a']));
  });

  it('stops at a sealed portal while leaving the cell in the graph', () => {
    const graph = corridorGraph({ sealed: true });
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [30, 2, 0]));
    expect(seen).toEqual(new Set(['a', 'b']));
    expect(graph.cells.map(entry => entry.id)).toContain('c');
  });

  it('narrows the aperture down a chain so an off-axis far opening is culled', () => {
    // Looking through the centred a→b opening from x=5 admits roughly |z| < 1.5 at
    // x=20. An opening at z≈4 is outside that cone even though b is fully visible.
    const graph = corridorGraph({ center: [20, 2, 4] });
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [30, 2, 0]));
    expect(seen).toEqual(new Set(['a', 'b']));

    // Standing in b, the same opening is plainly in view.
    const fromB = visibleCells(graph, 'b', viewProjection([15, 2, 2], [25, 2, 5]));
    expect(fromB.has('c')).toBe(true);
  });

  it('ignores an opening behind the camera', () => {
    const graph: AnchorageGraph = {
      cells: [cell('a', 0, 10), cell('behind', -10, 0)],
      portals: [{ id: 'back', a: 'a', b: 'behind', center: [0, 2, 0], halfExtents: [0, 1.5, 2] }]
    };
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [30, 2, 0]));
    expect(seen).toEqual(new Set(['a']));
  });

  it('clips an opening that straddles the near plane instead of mirroring it', () => {
    // This portal lies parallel to the view direction and runs from behind the eye
    // to well in front of it. Projecting without a near-plane clip flips the behind
    // vertices across the origin and inflates the rectangle, which is the classic
    // way portal culling leaks cells that are not actually visible.
    const straddling: AnchoragePortal = {
      id: 'straddle',
      a: 'a',
      b: 'side',
      center: [10, 2, 6],
      halfExtents: [8, 1.5, 0]
    };
    const rect = projectPortalToNdcRect(straddling, viewProjection([10, 2, 0], [40, 2, 0]));
    expect(rect).not.toBeNull();
    // Everything genuinely in front of the eye sits on one side of centre.
    expect(rect!.minX).toBeGreaterThan(0);
  });

  it('terminates on a cyclic graph', () => {
    const graph: AnchorageGraph = {
      cells: [cell('a', 0, 10), cell('b', 10, 20), cell('c', 20, 30)],
      portals: [
        { id: 'ab', a: 'a', b: 'b', center: [10, 2, 0], halfExtents: [0, 1.5, 2] },
        { id: 'bc', a: 'b', b: 'c', center: [20, 2, 0], halfExtents: [0, 1.5, 2] },
        { id: 'ca', a: 'c', b: 'a', center: [15, 2, 5], halfExtents: [4, 1.5, 0] }
      ]
    };
    const seen = visibleCells(graph, 'a', viewProjection([5, 2, 0], [30, 2, 0]));
    expect(seen.size).toBeLessThanOrEqual(3);
    expect(seen.has('a')).toBe(true);
  });

  it('returns nothing for an origin cell that is not in the graph', () => {
    expect(visibleCells(corridorGraph(), 'nowhere', viewProjection([5, 2, 0], [30, 2, 0])).size).toBe(0);
  });
});
