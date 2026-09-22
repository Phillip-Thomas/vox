import { describe, expect, it } from 'vitest';
import { buildSpaceStationDescriptor, spaceStationDockRoute } from './spaceStationDescriptor.ts';
import { buildSpaceStationDressing, UNLIT_TRIM_RADIUS } from './spaceStationDressing.ts';
import type { SpaceStationBox } from './spaceStationShell.ts';

const ADDRESSES = Array.from({ length: 12 }, (_, index) => ({
  system: { x: index * 3 - 7, y: index * 5 - 11 },
  index: 0
}));

const isTrim = (box: SpaceStationBox) => box.kind === 'lamp' && box.radius === UNLIT_TRIM_RADIUS;

describe('spaceStation wayfinding trim', () => {
  it('restrains only registry ceiling emission while keeping exit jambs at full output', () => {
    for (const address of ADDRESSES) {
      const descriptor = buildSpaceStationDescriptor(address);
      const counter = descriptor.graph.cells.find(cell => cell.kind === 'counter')!;
      const boxes = buildSpaceStationDressing(descriptor.graph, descriptor.seed);
      const restrained = boxes.filter(box => (box.emissionScale ?? 1) < 1);
      expect(restrained.length).toBeGreaterThan(0);
      for (const box of restrained) {
        expect(box.cellId).toBe(counter.id);
        expect(box.kind).toBe('lamp');
        expect(box.tone).toBe(1);
        expect(box.center[1]).toBe(counter.max[1] - 0.5);
        expect(box.emissionScale).toBeGreaterThan(0);
        expect(box.radius).toBe(2.2);
      }
      const exits = boxes.filter(box => box.cellId === counter.id && isTrim(box) && box.size[1] > 1);
      expect(exits.length).toBeGreaterThan(0);
      expect(exits.every(box => (box.emissionScale ?? 1) === 1)).toBe(true);
      expect(boxes.filter(box => box.cellId !== counter.id || box.tone === 0)
        .every(box => box.emissionScale === undefined)).toBe(true);
    }
  });
  it('is deterministic and every lamp either has a reach or is unlit trim', () => {
    for (const address of ADDRESSES) {
      const descriptor = buildSpaceStationDescriptor(address);
      const first = buildSpaceStationDressing(descriptor.graph, descriptor.seed);
      expect(buildSpaceStationDressing(descriptor.graph, descriptor.seed)).toEqual(first);
      for (const box of first.filter(entry => entry.kind === 'lamp')) {
        expect(box.radius === UNLIT_TRIM_RADIUS || (box.radius ?? 10) > 0).toBe(true);
      }
    }
  });

  it('puts jamb strips on both faces of every walkable portal and none on a sealed one', () => {
    for (const address of ADDRESSES) {
      const descriptor = buildSpaceStationDescriptor(address);
      const graph = descriptor.graph;
      const enterable = new Set(graph.cells.filter(cell => cell.enterable).map(cell => cell.id));
      const trim = buildSpaceStationDressing(graph, descriptor.seed).filter(isTrim);

      for (const portal of graph.portals) {
        const normal = portal.halfExtents[0] === 0 ? 0 : 2;
        const near = (cellId: string) =>
          trim.filter(
            box =>
              box.cellId === cellId &&
              Math.abs(box.center[normal] - portal.center[normal]) < 1 &&
              box.size[1] > 1 &&
              Math.abs(box.center[1] - portal.center[1]) < 0.01
          );
        const walkable = !portal.sealed && enterable.has(portal.a) && enterable.has(portal.b);
        if (walkable) {
          expect(near(portal.a).length, `${portal.id} face ${portal.a}`).toBe(2);
          expect(near(portal.b).length, `${portal.id} face ${portal.b}`).toBe(2);
          // Strips stand on their own cell's side of the plane, on both faces.
          const sideOf = (box: SpaceStationBox) => Math.sign(box.center[normal] - portal.center[normal]);
          expect(new Set([...near(portal.a), ...near(portal.b)].map(sideOf)).size).toBe(2);
        } else {
          expect(near(portal.a).length + near(portal.b).length, portal.id).toBe(0);
        }
      }
    }
  });

  it('lays one dashed deck strip per side of the counter-concourse spine and none into the hall', () => {
    for (const address of ADDRESSES) {
      const descriptor = buildSpaceStationDescriptor(address);
      const kindOf = new Map(descriptor.graph.cells.map(cell => [cell.id, cell.kind]));
      const dashes = buildSpaceStationDressing(descriptor.graph, descriptor.seed)
        .filter(isTrim)
        .filter(box => box.size[1] < 0.1);
      const kinds = new Set(dashes.map(box => kindOf.get(box.cellId ?? '')));
      expect([...kinds].sort()).toEqual(['concourse', 'counter']);
      for (const kind of kinds) {
        expect(dashes.filter(box => kindOf.get(box.cellId ?? '') === kind).length).toBeGreaterThanOrEqual(4);
      }
      for (const dash of dashes) {
        const cell = descriptor.graph.cells.find(entry => entry.id === dash.cellId)!;
        expect(dash.center[1]).toBeCloseTo(cell.min[1] + 0.02, 5);
        expect(dash.center[0] - dash.size[0] / 2).toBeGreaterThanOrEqual(cell.min[0]);
        expect(dash.center[0] + dash.size[0] / 2).toBeLessThanOrEqual(cell.max[0]);
      }
    }
  });

  it('gives every hall column two edge strips', () => {
    const descriptor = buildSpaceStationDescriptor(ADDRESSES[0]);
    const boxes = buildSpaceStationDressing(descriptor.graph, descriptor.seed);
    const hall = descriptor.graph.cells.find(cell => cell.kind === 'floor')!;
    const columns = boxes.filter(box => box.cellId === hall.id && box.kind === 'structure' && box.size[0] > 3);
    const strips = boxes.filter(
      box => box.cellId === hall.id && isTrim(box) && box.size[0] === 0.12 && box.size[2] === 0.22
    );
    expect(columns.length).toBeGreaterThan(0);
    expect(strips.length).toBe(columns.length * 2);
  });

  it('leaves the Kestrel airlock without a jamb strip', () => {
    for (const address of ADDRESSES) {
      const descriptor = buildSpaceStationDescriptor(address);
      const lock = spaceStationDockRoute(descriptor).lock;
      const trim = buildSpaceStationDressing(descriptor.graph, descriptor.seed).filter(isTrim);
      const nearLock = trim.filter(
        box => Math.hypot(box.center[0] - lock[0], box.center[2] - lock[2]) < 6
      );
      expect(nearLock, `lock at ${lock.join(',')}`).toEqual([]);
    }
  });

  it('keeps the added instances well inside the per-district budget', () => {
    const descriptor = buildSpaceStationDescriptor(ADDRESSES[0]);
    const trim = buildSpaceStationDressing(descriptor.graph, descriptor.seed).filter(isTrim);
    const perCell = new Map<string, number>();
    for (const box of trim) perCell.set(box.cellId ?? '', (perCell.get(box.cellId ?? '') ?? 0) + 1);
    for (const [cellId, count] of perCell) expect(count, cellId).toBeLessThanOrEqual(80);
  });
});
