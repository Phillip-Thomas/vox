import type { Vec3Tuple } from '../starSystem.ts';
import { createSpaceStationIdentity } from './spaceStationAddress.ts';
import { spaceStationBody } from './spaceStationBody.ts';
import type { DockRoute } from './spaceStationDock.ts';
import { spaceStationBoundRadius, buildSpaceStationGraph, validateSpaceStationGraph } from './spaceStationLayout.ts';
import type { SpaceStationAddress, SpaceStationCell, SpaceStationDescriptor } from './spaceStationTypes.ts';

/**
 * Build the full descriptor for an spaceStation address: identity, system placement,
 * bound, and the cell/portal graph.
 *
 * Generation is deterministic from the address alone, so a descriptor is cheap to
 * rebuild and never needs to be persisted — the same rule the planet manifests follow.
 */
export function buildSpaceStationDescriptor(address: SpaceStationAddress): SpaceStationDescriptor {
  const identity = createSpaceStationIdentity(address);
  const graph = buildSpaceStationGraph(identity.seed);

  if (import.meta.env?.DEV) {
    const problems = validateSpaceStationGraph(graph);
    if (problems.length > 0) {
      console.error(`[spaceStation] invalid layout for ${identity.worldId}:\n  ${problems.join('\n  ')}`);
    }
  }

  return {
    ...identity,
    // Placement comes from the body descriptor, which is also what the exterior
    // and the approach model read. Deriving it twice is how a station ends up
    // rendered in one place and flown to in another.
    systemPosition: spaceStationBody(address, graph).systemPosition,
    boundRadius: spaceStationBoundRadius(graph),
    graph
  };
}

/**
 * The arrival: standing in the lock, and the point on the deck you are set down at.
 *
 * The station is generated along +X from the dock end, so the airlock is the -X
 * wall of the apron and the whole spine runs away from you as you step out. The
 * dolly is five metres — a walk out of a hatch, not a ride across a hangar.
 */
export function spaceStationDockRoute(descriptor: SpaceStationDescriptor): DockRoute {
  const apron = descriptor.graph.cells.find(cell => cell.kind === 'apron')
    ?? descriptor.graph.cells.find(cell => cell.enterable);
  if (!apron) return { lock: [0, 0, 0], deck: [0, 0, 0] };
  const centreZ = (apron.min[2] + apron.max[2]) / 2;
  return {
    lock: [apron.min[0] + 2.4, apron.min[1], centreZ],
    deck: [apron.min[0] + 7.4, apron.min[1], centreZ]
  };
}

/**
 * Where the player first stands after stepping out of the airlock.
 *
 * The same point the dock sequence sets you down at, so arriving with the
 * choreography and arriving without it put you in the same place. Two spawn points
 * is how a capture and a play session end up describing different rooms.
 */
export function spaceStationSpawnPoint(descriptor: SpaceStationDescriptor): Vec3Tuple {
  return spaceStationDockRoute(descriptor).deck;
}

export function cellCenter(cell: SpaceStationCell): Vec3Tuple {
  return [
    (cell.min[0] + cell.max[0]) / 2,
    (cell.min[1] + cell.max[1]) / 2,
    (cell.min[2] + cell.max[2]) / 2
  ];
}

export function cellSize(cell: SpaceStationCell): Vec3Tuple {
  return [
    cell.max[0] - cell.min[0],
    cell.max[1] - cell.min[1],
    cell.max[2] - cell.min[2]
  ];
}

