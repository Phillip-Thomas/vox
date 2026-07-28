import type { SystemCoordinate, Vec3Tuple } from '../starSystem.ts';

/**
 * An spaceStation is a built deep-space destination: you fly to it, dock, and walk
 * around inside. It is deliberately NOT a PlanetSlot. Planet addresses are durable
 * save data with a frozen world-id grammar shared with the state server, so
 * spaceStations carry their own parallel address space instead of widening that union.
 */
export interface SpaceStationAddress {
  system: SystemCoordinate;
  /** Index within the system. Systems may eventually hold more than one. */
  index: number;
}

export interface SpaceStationIdentity {
  worldId: string;
  seed: number;
  systemId: string;
  address: SpaceStationAddress;
  spaceStationIdentityVersion: number;
}

export type SpaceStationCellKind =
  /** Dock interior. The only fully enclosed volume; orthogonal and legible. */
  | 'apron'
  /** Registry corridor. Trade onboarding, unskippable because it is the through-route. */
  | 'counter'
  /**
   * The common area: vendors, crowds, noise. Deliberately the smallest-ceilinged
   * and densest volume in the station — bustle is a density effect, and a public
   * space that is too large simply reads as abandoned.
   */
  | 'concourse'
  /** The bureaucratic hall — a grid of desk lamps and cubicles on a dark plain. */
  | 'floor'
  /** Warehousing and habitation. */
  | 'shelves'
  /** Sealed volume. Present in the graph, not enterable yet. */
  | 'blank';

export type CellId = string;

/**
 * A cell is a convex-ish volume treated as one visibility and streaming unit.
 * Axis-aligned bounds keep containment and projection cheap; the rendered
 * geometry inside a cell is free to be arbitrary.
 */
export interface SpaceStationCell {
  id: CellId;
  kind: SpaceStationCellKind;
  /** Local-space AABB minimum corner, in metres. */
  min: Vec3Tuple;
  /** Local-space AABB maximum corner, in metres. */
  max: Vec3Tuple;
  /** Whether the player may currently enter. `blank` is sealed. */
  enterable: boolean;
}

/**
 * A portal is the shared opening between exactly two cells. It is the unit of
 * visibility (see `visibleCells`), of streaming residency, of light-probe
 * placement, and eventually of reverb zoning — one structure, four jobs.
 */
export interface SpaceStationPortal {
  id: string;
  a: CellId;
  b: CellId;
  /** Local-space centre of the opening. */
  center: Vec3Tuple;
  /**
   * Half-extents of the opening. Exactly one component is zero: that axis is the
   * portal's normal, so the quad is axis-aligned and its corners are trivial.
   */
  halfExtents: Vec3Tuple;
  /**
   * A sealed portal keeps its cell in the graph — streaming, probe placement and
   * reverb still want to know the volume is there — but blocks sight through it.
   */
  sealed?: boolean;
}

export interface SpaceStationGraph {
  cells: SpaceStationCell[];
  portals: SpaceStationPortal[];
}

export interface SpaceStationDescriptor extends SpaceStationIdentity {
  /** Position in system space, matching the convention used by PlanetDescriptor. */
  systemPosition: Vec3Tuple;
  /** Spherical bound enclosing the whole structure, for residency and targeting. */
  boundRadius: number;
  graph: SpaceStationGraph;
}
