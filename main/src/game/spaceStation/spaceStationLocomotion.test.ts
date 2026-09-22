import { describe, expect, it } from 'vitest';
import { spaceStationSpawnPoint, buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import {
  createWalkState,
  eyePosition,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  stepWalk,
  stepWalkFrame,
  type WalkState
} from './spaceStationLocomotion.ts';
import type { SpaceStationGraph } from './spaceStationTypes.ts';
import { buildBlockerIndex } from './spaceStationCollision.ts';
import { buildSpaceStationDressing } from './spaceStationDressing.ts';

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

describe('foreground frame time at ordinary walking speed', () => {
  it('covers the same6.16metres in1.4seconds at60FPS and the captured software cadence', () => {
    const counter = graph.cells.find(cell => cell.id === 'counter')!;
    const props = buildBlockerIndex(buildSpaceStationDressing(graph, descriptor.seed));
    const start = createWalkState(graph, [counter.max[0] - 0.5, 0, 0]);
    let hardware = start, software = start;
    for (let i = 0; i < 84; i++) hardware = stepWalkFrame(graph, hardware, { x: 4.4, z: 0 }, 1 / 60, props);
    // Actual C4 consecutive intervals after its first concourse frame.
    for (const delta of [0.3333, 0.0334, 0.0333, 1]) {
      software = stepWalkFrame(graph, software, { x: 4.4, z: 0 }, delta, props);
    }
    expect(software.position[0] - start.position[0]).toBeCloseTo(6.16, 6);
    expect(software.position[0]).toBeCloseTo(hardware.position[0], 6);
    expect(software.cellId).toBe('concourse');
    expect(software.grounded).toBe(true);
  });

  it('resolves a thin solid obstacle on every substep instead of skipping it', () => {
    const counter = graph.cells.find(cell => cell.id === 'counter')!;
    const x = counter.min[0] + 10;
    const props = buildBlockerIndex([{ kind: 'prop', tone: 5,
      center: [x + 2, 1.5, 0], size: [0.2, 3, 3] }]);
    const state = stepWalkFrame(graph, createWalkState(graph, [x, 0, 0]), { x: 4.4, z: 0 }, 1.4, props);
    expect(state.position[0]).toBeGreaterThan(x + 1);
    expect(state.position[0]).toBeLessThanOrEqual(x + 1.9 - PLAYER_RADIUS);
    expect(state.cellId).toBe('counter');
  });

  it('retains sealed-portal and off-axis wall collisions under slow frames', () => {
    const shelves = graph.cells.find(cell => cell.id === 'shelves')!;
    const sealed = stepWalkFrame(graph, createWalkState(graph, [shelves.max[0] - 1, 0, 0]), { x: 4.4, z: 0 }, 2);
    expect(sealed.cellId).toBe('shelves');
    expect(sealed.position[0]).toBeLessThanOrEqual(shelves.max[0] - PLAYER_RADIUS);
    const apron = graph.cells.find(cell => cell.id === 'apron')!;
    const wall = stepWalkFrame(graph, createWalkState(graph, [apron.max[0] - 1, 0, apron.max[2] - 2]), { x: 4.4, z: 0 }, 2);
    expect(wall.cellId).toBe('apron');
    expect(wall.position[0]).toBeLessThanOrEqual(apron.max[0] - PLAYER_RADIUS);
  });

  it('discards paused/resumed zero-time frames and bounds an unreported long suspension', () => {
    const start = createWalkState(graph, spaceStationSpawnPoint(descriptor));
    // The controller supplies zero for a resumed frame and clears held/scripted
    // input on visibility changes. A missed event still cannot charge30seconds.
    expect(stepWalkFrame(graph, start, { x: 4.4, z: 0 }, 0)).toBe(start);
    expect(stepWalkFrame(graph, start, { x: 4.4, z: 0 }, NaN)).toBe(start);
    expect(stepWalkFrame(graph, start, { x: 4.4, z: 0 }, 30).position[0] - start.position[0]).toBeCloseTo(0.22, 6);
    const resumed = stepWalkFrame(graph, start, { x: 4.4, z: 0 }, 1 / 60);
    expect(resumed.position[0] - start.position[0]).toBeCloseTo(4.4 / 60, 6);
  });
});
