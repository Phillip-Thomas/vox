import { describe, expect, it } from 'vitest';
import { spaceStationSpawnPoint, buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import {
  createWalkState,
  eyePosition,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  stepWalk,
  type WalkState
} from './spaceStationLocomotion.ts';
import type { SpaceStationGraph } from './spaceStationTypes.ts';

const descriptor = buildSpaceStationDescriptor({ system: { x: -19, y: -17 }, index: 0 });
const graph = descriptor.graph;

/** Run a straight walk for `seconds`, returning the final state. */
function walk(state: WalkState, dx: number, dz: number, seconds: number, world: SpaceStationGraph = graph): WalkState {
  const stepSeconds = 1 / 60;
  let current = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += stepSeconds) {
    current = stepWalk(world, current, { dx: dx * stepSeconds, dz: dz * stepSeconds }, stepSeconds);
  }
  return current;
}

describe('walk state', () => {
  it('spawns standing in the apron', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    expect(state.cellId).toBe('apron');
    const settled = walk(state, 0, 0, 1);
    expect(settled.grounded).toBe(true);
    expect(settled.position[1]).toBeCloseTo(0, 5);
  });

  it('puts the eye a human height above the feet', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    expect(eyePosition(state)[1] - state.position[1]).toBeCloseTo(PLAYER_EYE_HEIGHT, 5);
  });

  it('falls to the floor when spawned in the air', () => {
    const spawn = spaceStationSpawnPoint(descriptor);
    const state = createWalkState(graph, [spawn[0], spawn[1] + 12, spawn[2]]);
    expect(walk(state, 0, 0, 3).position[1]).toBeCloseTo(0, 4);
  });
});

describe('walls are solid', () => {
  it('cannot leave the apron sideways through a blank wall', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    const apron = graph.cells.find(cell => cell.id === 'apron')!;
    const pushed = walk(state, 0, 400, 6);
    expect(pushed.cellId).toBe('apron');
    expect(pushed.position[2]).toBeLessThanOrEqual(apron.max[2] - PLAYER_RADIUS + 1e-6);
  });

  it('cannot walk backwards out of the front of the dock', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    const apron = graph.cells.find(cell => cell.id === 'apron')!;
    const pushed = walk(state, -400, 0, 6);
    expect(pushed.position[0]).toBeGreaterThanOrEqual(apron.min[0] + PLAYER_RADIUS - 1e-6);
  });

  it('slides along a wall instead of stopping dead', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    // Push hard into the +Z wall while also moving along +X.
    const moved = walk(state, 6, 400, 4);
    expect(moved.position[0]).toBeGreaterThan(state.position[0] + 10);
  });
});

describe('doorways are the only way through', () => {
  it('walks the whole spine from the dock to the warehouse', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    const visited = new Set<string>([state.cellId!]);

    let current = state;
    const stepSeconds = 1 / 60;
    for (let i = 0; i < 60 * 90; i++) {
      current = stepWalk(graph, current, { dx: 9 * stepSeconds, dz: 0 }, stepSeconds);
      if (current.cellId) visited.add(current.cellId);
    }

    expect(visited).toEqual(new Set(['apron', 'counter', 'concourse', 'floor', 'shelves']));
    expect(current.cellId).toBe('shelves');
  });

  it('never reaches the sealed blank volume', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    let current = state;
    const stepSeconds = 1 / 60;
    for (let i = 0; i < 60 * 200; i++) {
      current = stepWalk(graph, current, { dx: 14 * stepSeconds, dz: 0 }, stepSeconds);
      expect(current.cellId).not.toBe('blank');
    }
    const shelves = graph.cells.find(cell => cell.id === 'shelves')!;
    expect(current.position[0]).toBeLessThanOrEqual(shelves.max[0] - PLAYER_RADIUS + 1e-6);
  });

  it('is blocked by the wall when approaching the opening off-axis', () => {
    const apron = graph.cells.find(cell => cell.id === 'apron')!;
    // Start hard against the +Z side, far from the centred doorway.
    const offAxis = createWalkState(graph, [
      apron.max[0] - 6,
      0,
      apron.max[2] - 2
    ]);
    const pushed = walk(offAxis, 60, 0, 5);
    expect(pushed.cellId).toBe('apron');
    expect(pushed.position[0]).toBeLessThanOrEqual(apron.max[0] - PLAYER_RADIUS + 1e-6);
  });
});

describe('step determinism', () => {
  it('produces identical results for identical inputs', () => {
    const a = walk(createWalkState(graph, spaceStationSpawnPoint(descriptor)), 7, 3, 5);
    const b = walk(createWalkState(graph, spaceStationSpawnPoint(descriptor)), 7, 3, 5);
    expect(a).toEqual(b);
  });

  it('does not mutate the state it is given', () => {
    const state = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    const snapshot = JSON.parse(JSON.stringify(state));
    stepWalk(graph, state, { dx: 5, dz: 5 }, 1 / 60);
    expect(state).toEqual(snapshot);
  });
});
