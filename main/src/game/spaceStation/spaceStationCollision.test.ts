import { describe, expect, it } from 'vitest';
import {
  buildBlockerIndex,
  headroomAt,
  isSolidProp,
  positionBlocked,
  slideAgainstProps,
  supportHeightAt,
  type BodyMetrics
} from './spaceStationCollision.ts';
import { buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import { buildSpaceStationDressing } from './spaceStationDressing.ts';
import { createWalkState, PLAYER_BODY, stepWalk, type WalkState } from './spaceStationLocomotion.ts';
import type { SpaceStationBox } from './spaceStationShell.ts';
import { spaceStationVendorSites } from './spaceStationVendors.ts';

const BODY: BodyMetrics = { radius: 0.4, height: 1.8, step: 0.45 };

function box(
  center: [number, number, number],
  size: [number, number, number],
  kind: SpaceStationBox['kind'] = 'prop'
): SpaceStationBox {
  return { center, size, kind, tone: 0 };
}

describe('blocker index', () => {
  it('skips lamps, so a light fitting is never something to get wedged on', () => {
    const index = buildBlockerIndex([box([0, 1, 0], [1, 1, 1], 'lamp'), box([6, 1, 0], [1, 1, 1])]);
    expect(index.count).toBe(1);
    expect(isSolidProp(box([0, 0, 0], [1, 1, 1], 'lamp'))).toBe(false);
    expect(isSolidProp(box([0, 0, 0], [1, 1, 1], 'structure'))).toBe(true);
  });

  it('finds a prop that spans many grid buckets from anywhere along it', () => {
    // A thirty-metre rack: far longer than the grid pitch, so it lives in many
    // buckets at once and has to be found from every one of them.
    const index = buildBlockerIndex([box([15, 1, 0], [30, 2, 1])]);
    for (const x of [1, 8, 15, 22, 29]) {
      expect(positionBlocked(index, x, 0, 0, BODY)).toBe(true);
    }
    expect(positionBlocked(index, 31, 0, 0, BODY)).toBe(false);
  });

  it('is empty and inert when nothing is solid', () => {
    const index = buildBlockerIndex([]);
    expect(slideAgainstProps(index, 0, 0, 5, 5, 0, BODY)).toEqual([5, 5]);
    expect(supportHeightAt(index, 0, 0, 0, -3, BODY)).toBe(-3);
    expect(headroomAt(index, 0, 0, 0, BODY)).toBe(Infinity);
  });
});

describe('walking into things', () => {
  const counter = buildBlockerIndex([box([0, 0.48, 0], [4, 0.96, 1.1])]);

  it('stops at a counter instead of walking through it', () => {
    // Six metres in one call: far enough to step clean over the counter without a
    // swept test, which is exactly the move that must not tunnel.
    const [, z] = slideAgainstProps(counter, 0, 3, 0, -3, 0, BODY);
    expect(z).toBeGreaterThan(0.95); // clear of the counter's near face
    expect(z).toBeLessThan(3); // but it did advance up to it
  });

  it('slides along the counter rather than stopping dead', () => {
    // Pushed diagonally into the face: the blocked axis stops at contact, the free
    // one runs to the end of the move.
    const [x, z] = slideAgainstProps(counter, 0, 2, 2, 0.5, 0, BODY);
    expect(x).toBe(2);
    expect(z).toBeGreaterThan(0.95);
    expect(z).toBeLessThan(2);
  });

  it('lets a body already inside a prop walk back out', () => {
    // A teleport can land you inside furniture. Refusing every move would trap you.
    expect(positionBlocked(counter, 0, 0, 0, BODY)).toBe(true);
    expect(slideAgainstProps(counter, 0, 0, 0, 4, 0, BODY)).toEqual([0, 4]);
  });

  it('walks over anything low enough to step on', () => {
    const bench = buildBlockerIndex([box([0, 0.2, 0], [2, 0.4, 0.6])]);
    const [, z] = slideAgainstProps(bench, 0, 2, 0, -2, 0, BODY);
    expect(z).toBe(-2);
  });

  it('walks under anything hung above head height', () => {
    const canopy = buildBlockerIndex([box([0, 2.4, 0], [4, 0.12, 3])]);
    const [, z] = slideAgainstProps(canopy, 0, 4, 0, -4, 0, BODY);
    expect(z).toBe(-4);
  });
});

describe('standing on things', () => {
  const crate = buildBlockerIndex([box([0, 0.6, 0], [1.2, 1.2, 1.2])]);

  it('lands on a crate when falling past its top', () => {
    expect(supportHeightAt(crate, 0, 0, 3, 0, BODY)).toBeCloseTo(1.2, 6);
  });

  it('does not lift you onto anything taller than a stride', () => {
    expect(supportHeightAt(crate, 0, 0, 0, 0, BODY)).toBe(0);
  });

  it('steps up onto something within a stride', () => {
    const kerb = buildBlockerIndex([box([0, 0.15, 0], [2, 0.3, 2])]);
    expect(supportHeightAt(kerb, 0, 0, 0, 0, BODY)).toBeCloseTo(0.3, 6);
  });

  it('supports the body centre, not its radius — no hovering off an edge', () => {
    expect(supportHeightAt(crate, 0.8, 0, 3, 0, BODY)).toBe(0);
  });
});

describe('headroom', () => {
  const canopy = buildBlockerIndex([box([0, 2.4, 0], [4, 0.12, 3])]);

  it('reports the underside of an overhang', () => {
    expect(headroomAt(canopy, 0, 0, 0, BODY)).toBeCloseTo(2.34, 6);
  });

  it('ignores the thing you are standing on', () => {
    const crate = buildBlockerIndex([box([0, 0.6, 0], [1.2, 1.2, 1.2])]);
    expect(headroomAt(crate, 0, 0, 1.2, BODY)).toBe(Infinity);
  });

  it('is clear where nothing is hung', () => {
    expect(headroomAt(canopy, 12, 0, 0, BODY)).toBe(Infinity);
  });
});

describe('walking the real concourse', () => {
  const descriptor = buildSpaceStationDescriptor({ system: { x: -19, y: -17 }, index: 0 });
  const graph = descriptor.graph;
  const props = buildBlockerIndex(buildSpaceStationDressing(graph, descriptor.seed));
  const concourse = graph.cells.find(cell => cell.kind === 'concourse')!;
  const centreZ = (concourse.min[2] + concourse.max[2]) / 2;

  function walk(state: WalkState, dx: number, dz: number, seconds: number): WalkState {
    const step = 1 / 60;
    let current = state;
    for (let t = 0; t < seconds; t += step) {
      current = stepWalk(graph, current, { dx: dx * step, dz: dz * step }, step, props);
    }
    return current;
  }

  it('builds a substantial index from the shipped dressing', () => {
    expect(props.count).toBeGreaterThan(500);
  });

  it('cannot walk through a vendor counter into the stall', () => {
    const site = spaceStationVendorSites(descriptor).find(entry => entry.side === 1)!;
    const start = createWalkState(graph, [site.counter[0], concourse.min[1], site.counter[2] - 3]);
    expect(start.cellId).toBe('concourse');

    const after = walk(start, 0, 6, 3);

    // Stopped short of the counter's aisle face rather than ending up behind it.
    expect(after.position[2]).toBeLessThan(site.counter[2] - 0.5);
    expect(Math.abs(after.position[0] - site.counter[0])).toBeLessThan(0.5);
  });

  it('leaves the trader standing clear of her own stall', () => {
    for (const site of spaceStationVendorSites(descriptor)) {
      expect(positionBlocked(props, site.stand[0], site.stand[2], concourse.min[1], PLAYER_BODY)).toBe(false);
    }
  });

  it('leaves a walkable line down the whole length of the aisle', () => {
    // The property that matters is not "a straight push travels far" — furniture in
    // the aisle is deliberate — but that the aisle is never sealed across.
    for (let x = concourse.min[0] + 2; x < concourse.max[0] - 2; x += 2) {
      let open = false;
      for (let z = centreZ - 6; z <= centreZ + 6 && !open; z += 0.5) {
        if (!positionBlocked(props, x, z, concourse.min[1], PLAYER_BODY)) open = true;
      }
      expect(open, `aisle sealed at x=${x.toFixed(1)}`).toBe(true);
    }
  });

  it('leaves the doorway to the counter corridor passable', () => {
    // Prop collision must never seal a portal the shell deliberately opened.
    const start = createWalkState(graph, [concourse.min[0] + 5, concourse.min[1], centreZ]);
    expect(walk(start, -5, 0, 6).cellId).toBe('counter');
  });

  it('uses the same body metrics the locomotion module publishes', () => {
    expect(PLAYER_BODY.height).toBeGreaterThan(PLAYER_BODY.step);
    expect(PLAYER_BODY.radius).toBeGreaterThan(0);
  });
});
