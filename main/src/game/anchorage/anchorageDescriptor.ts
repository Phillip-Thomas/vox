import type { Vec3Tuple } from '../starSystem.ts';
import { createAnchorageIdentity } from './anchorageAddress.ts';
import { anchorageBody } from './anchorageBody.ts';
import type { DockRoute } from './anchorageDock.ts';
import { anchorageBoundRadius, buildAnchorageGraph, validateAnchorageGraph } from './anchorageLayout.ts';
import type { AnchorageAddress, AnchorageCell, AnchorageDescriptor } from './anchorageTypes.ts';

/**
 * Build the full descriptor for an anchorage address: identity, system placement,
 * bound, and the cell/portal graph.
 *
 * Generation is deterministic from the address alone, so a descriptor is cheap to
 * rebuild and never needs to be persisted — the same rule the planet manifests follow.
 */
export function buildAnchorageDescriptor(address: AnchorageAddress): AnchorageDescriptor {
  const identity = createAnchorageIdentity(address);
  const graph = buildAnchorageGraph(identity.seed);

  if (import.meta.env?.DEV) {
    const problems = validateAnchorageGraph(graph);
    if (problems.length > 0) {
      console.error(`[anchorage] invalid layout for ${identity.worldId}:\n  ${problems.join('\n  ')}`);
    }
  }

  return {
    ...identity,
    // Placement comes from the body descriptor, which is also what the exterior
    // and the approach model read. Deriving it twice is how a station ends up
    // rendered in one place and flown to in another.
    systemPosition: anchorageBody(address, graph).systemPosition,
    boundRadius: anchorageBoundRadius(graph),
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
export function anchorageDockRoute(descriptor: AnchorageDescriptor): DockRoute {
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
export function anchorageSpawnPoint(descriptor: AnchorageDescriptor): Vec3Tuple {
  return anchorageDockRoute(descriptor).deck;
}

export function cellCenter(cell: AnchorageCell): Vec3Tuple {
  return [
    (cell.min[0] + cell.max[0]) / 2,
    (cell.min[1] + cell.max[1]) / 2,
    (cell.min[2] + cell.max[2]) / 2
  ];
}

export function cellSize(cell: AnchorageCell): Vec3Tuple {
  return [
    cell.max[0] - cell.min[0],
    cell.max[1] - cell.min[1],
    cell.max[2] - cell.min[2]
  ];
}

