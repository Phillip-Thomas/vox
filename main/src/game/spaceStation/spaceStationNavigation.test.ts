import { describe, expect, it } from 'vitest';
import { STATION_DEPART_TIMEOUT_MS } from '../../components/spaceStation/StationScreeningDriver.tsx';
import { buildSpaceStationDescriptor, spaceStationDockRoute, spaceStationSpawnPoint } from './spaceStationDescriptor.ts';
import { buildSpaceStationDressing } from './spaceStationDressing.ts';
import { buildBlockerIndex } from './spaceStationCollision.ts';
import { createWalkState, stepWalk, type WalkState } from './spaceStationLocomotion.ts';
import { buildSpaceStationVendors, certifiedComponentIssuer } from './spaceStationVendors.ts';
import { planStationWalk } from './spaceStationNavigation.ts';
import type { Vec3Tuple } from '../starSystem.ts';

// Exercise actual authored geometry and the player's collision integrator. No
// direct assignment to position after spawn; every frame walks at normal speed.
function follow(descriptor: ReturnType<typeof buildSpaceStationDescriptor>, blockers: ReturnType<typeof buildBlockerIndex>,
  start: WalkState, target: Vec3Tuple, reach: number, maxSeconds = 45): { state: WalkState; seconds: number; planningMs: number } {
  const before = performance.now();
  const route = planStationWalk(descriptor.graph, blockers, start, target, reach);
  const planningMs = performance.now() - before;
  expect(route, JSON.stringify({ start, target })).not.toBeNull();
  let state = start, index = 0, yaw = -Math.PI / 2;
  for (let frame = 0; frame < 60 * maxSeconds; frame++) {
    if (Math.hypot(...state.position.map((n, i) => n - target[i])) <= reach) {
      return { state, seconds: frame / 60, planningMs };
    }
    let point = route![index];
    while (point && Math.hypot(point[0] - state.position[0], point[2] - state.position[2]) < 0.18) point = route![++index];
    expect(point, `route exhausted before target: ${JSON.stringify(state)}`).toBeDefined();
    const desired = Math.atan2(-(point[0] - state.position[0]), -(point[2] - state.position[2]));
    const error = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
    const turn = Math.max(-1.6 / 60, Math.min(1.6 / 60, error));
    yaw += turn;
    const speed = Math.abs(error - turn) < 0.08 ? 4.4 : 0;
    state = stepWalk(descriptor.graph, state, { dx: -Math.sin(yaw) * speed / 60, dz: -Math.cos(yaw) * speed / 60 }, 1 / 60, blockers);
  }
  throw new Error(`did not reach ${JSON.stringify(target)} in${maxSeconds}s: ${JSON.stringify({ state, route, index, planningMs })}`);
}

describe('station screening navigation', () => {
  for (const address of [{ x: -19, y: -17 }, { x: -1, y: -1 }, { x: 0, y: 0 }, { x: 4, y: 9 }]) {
    it(`walks the registry and issuer through solid furniture at ${JSON.stringify(address)}`, () => {
      const descriptor = buildSpaceStationDescriptor({ system: address, index: 0 });
      const blockers = buildBlockerIndex(buildSpaceStationDressing(descriptor.graph, descriptor.seed));
      const counter = descriptor.graph.cells.find(cell => cell.kind === 'counter')!;
      const registry: Vec3Tuple = [(counter.min[0] + counter.max[0]) / 2, counter.min[1], counter.max[2] - 3.4];
      const first = follow(descriptor, blockers, createWalkState(descriptor.graph, spaceStationSpawnPoint(descriptor)), registry, 4.2);
      const issuer = certifiedComponentIssuer(buildSpaceStationVendors(descriptor))!;
      const second = follow(descriptor, blockers, first.state, issuer.counter, 3.4);
      console.info(JSON.stringify({ address, registrySeconds: first.seconds, issuerSeconds: second.seconds,
        planningMs: [first.planningMs, second.planningMs] }));
      expect(second.state.cellId).toBe('concourse');
      const departure = follow(descriptor, blockers, second.state, spaceStationDockRoute(descriptor).lock, 8, STATION_DEPART_TIMEOUT_MS / 1000);
      expect(departure.state.cellId).toBe('apron');
      console.info(JSON.stringify({ address, departureSeconds: departure.seconds }));
    });
  }
  it('routes around a solid obstacle instead of clipping through it', () => {
    const original = buildSpaceStationDescriptor({ system: { x: -19, y: -17 }, index: 0 });
    const descriptor = { ...original, graph: { cells: [{ id: 'test', kind: 'apron' as const,
      min: [0, 0, -10] as Vec3Tuple, max: [35, 8, 10] as Vec3Tuple, enterable: true }], portals: [] } };
    const blockers = buildBlockerIndex([{ kind: 'prop', tone: 0, center: [17, 2, 0], size: [3, 4, 9] }]);
    const result = follow(descriptor, blockers, createWalkState(descriptor.graph, [2, 0, 0]), [31, 0, 0], 1.5);
    expect(result.state.position[0]).toBeGreaterThan(29.5);
  });
  it('refuses an objective beyond a sealed portal', () => {
    const descriptor = buildSpaceStationDescriptor({ system: { x: -19, y: -17 }, index: 0 });
    const blockers = buildBlockerIndex([]);
    const target = descriptor.graph.cells.find(cell => cell.kind === 'blank')!;
    expect(planStationWalk(descriptor.graph, blockers,
      createWalkState(descriptor.graph, spaceStationSpawnPoint(descriptor)),
      [target.min[0] + 10, target.min[1], 0], 4)).toBeNull();
  });
});
