import { describe, expect, it } from 'vitest';
import {
  spaceStationBoundRadius,
  buildSpaceStationGraph,
  reachableCells,
  validateSpaceStationGraph
} from './spaceStationLayout.ts';
import { spaceStationSeedForAddress } from './spaceStationAddress.ts';
import { cellContainingPoint, visibleCells } from './portalGraph.ts';
import type { SpaceStationGraph } from './spaceStationTypes.ts';

const SEEDS = Array.from({ length: 64 }, (_, index) =>
  spaceStationSeedForAddress({ system: { x: index - 32, y: index * 7 - 11 }, index: 0 })
);

describe('spaceStation layout generation', () => {
  it('produces a valid graph for every seed it can be handed', () => {
    for (const seed of SEEDS) {
      const problems = validateSpaceStationGraph(buildSpaceStationGraph(seed));
      expect(problems, `seed ${seed}`).toEqual([]);
    }
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const first = buildSpaceStationGraph(SEEDS[0]);
    expect(buildSpaceStationGraph(SEEDS[0])).toEqual(first);

    const footprints = new Set(SEEDS.map(seed => JSON.stringify(buildSpaceStationGraph(seed).cells)));
    expect(footprints.size).toBeGreaterThan(1);
  });

  it('keeps every enterable cell walkable and the blank sealed off', () => {
    const graph = buildSpaceStationGraph(SEEDS[0]);
    const reachable = reachableCells(graph);
    expect(reachable).toEqual(new Set(['apron', 'counter', 'concourse', 'floor', 'shelves']));

    const blank = graph.cells.find(cell => cell.id === 'blank');
    expect(blank?.enterable).toBe(false);
    expect(graph.portals.find(portal => portal.id === 'shelves-blank')?.sealed).toBe(true);
  });

  it('leaves no gap between consecutive volumes along the spine', () => {
    const graph = buildSpaceStationGraph(SEEDS[3]);
    const order = ['apron', 'counter', 'concourse', 'floor', 'shelves', 'blank'];
    for (let i = 0; i < order.length - 1; i++) {
      const current = graph.cells.find(cell => cell.id === order[i])!;
      const next = graph.cells.find(cell => cell.id === order[i + 1])!;
      expect(current.max[0]).toBe(next.min[0]);
    }
  });

  it('reports a bound radius enclosing the whole structure', () => {
    const graph = buildSpaceStationGraph(SEEDS[1]);
    const radius = spaceStationBoundRadius(graph);
    for (const cell of graph.cells) {
      for (const corner of [cell.min, cell.max]) {
        expect(Math.hypot(corner[0], corner[1], corner[2])).toBeLessThanOrEqual(radius);
      }
    }
  });

  it('places the dock spawn inside the apron', () => {
    const graph = buildSpaceStationGraph(SEEDS[2]);
    const apron = graph.cells.find(cell => cell.id === 'apron')!;
    const spawn: [number, number, number] = [
      (apron.min[0] + apron.max[0]) / 2,
      1,
      0
    ];
    expect(cellContainingPoint(graph, spawn)).toBe('apron');
  });
});

describe('layout and visibility together', () => {
  it('lets the counter corridor see into the market it opens onto', () => {
    const graph = buildSpaceStationGraph(SEEDS[0]);
    const counter = graph.cells.find(cell => cell.id === 'counter')!;
    const eye: [number, number, number] = [counter.min[0] + 4, 2, 0];
    const target: [number, number, number] = [counter.max[0] + 200, 2, 0];

    const seen = visibleCells(graph, 'counter', viewProjectionAlongX(eye, target));
    expect(seen.has('floor')).toBe(true);
    // The sealed blank must never appear, however long the sightline.
    expect(seen.has('blank')).toBe(false);
  });
});

/**
 * A minimal perspective view-projection looking down +X, built by hand so the
 * layout tests stay free of a renderer dependency.
 */
function viewProjectionAlongX(eye: [number, number, number], target: [number, number, number]): number[] {
  const forward = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  // View matrix rows are the camera basis; translation is -basis·eye.
  const view = [
    right[0], up[0], -forward[0], 0,
    right[1], up[1], -forward[1], 0,
    right[2], up[2], -forward[2], 0,
    -dot(right, eye), -dot(up, eye), dot(forward, eye), 1
  ];

  const fov = (60 * Math.PI) / 180;
  const f = 1 / Math.tan(fov / 2);
  const near = 0.1;
  const far = 5_000;
  const aspect = 16 / 9;
  const projection = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0
  ];

  return multiplyColumnMajor(projection, view);
}

function multiplyColumnMajor(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: number[]): number[] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

describe('generator assertions actually bite', () => {
  const mutate = (mutation: (graph: SpaceStationGraph) => void): string[] => {
    const graph = buildSpaceStationGraph(SEEDS[0]);
    mutation(graph);
    return validateSpaceStationGraph(graph);
  };

  it('catches an opening that extends beyond the wall it sits in', () => {
    expect(mutate(graph => {
      graph.portals[0].halfExtents = [0, 2.6, 500];
    }).join(' ')).toMatch(/extends outside cell/);
  });

  it('catches an opening with no well-defined normal', () => {
    expect(mutate(graph => {
      graph.portals[0].halfExtents = [1, 1, 1];
    }).join(' ')).toMatch(/exactly one zero half-extent/);
  });

  it('catches a stranded enterable cell', () => {
    expect(mutate(graph => {
      graph.portals = graph.portals.filter(portal => portal.id !== 'counter-concourse');
    }).join(' ')).toMatch(/unreachable through open portals/);
  });

  it('catches a portal pointing at a cell that does not exist', () => {
    expect(mutate(graph => {
      graph.portals[0].b = 'ghost';
    }).join(' ')).toMatch(/missing cell/);
  });
});
