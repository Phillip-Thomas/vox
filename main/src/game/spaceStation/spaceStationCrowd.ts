import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import type { SpaceStationCell, SpaceStationGraph, CellId } from './spaceStationTypes.ts';

/**
 * The crowd.
 *
 * A public space is people, not furniture. These are deliberately simple: each
 * figure walks a seeded loop of stations inside one cell, pauses at each, and is
 * drawn from a handful of boxes with a hand-written gait. That is the same shape as
 * the audit worker already in the game, and it is enough — at concourse density what
 * reads is silhouette, motion and count, not articulation.
 *
 * Pure and deterministic: given a graph, a seed and a time, the crowd is fully
 * determined, so a capture at t=12s is identical every run.
 */

/**
 * A shopper moves through the room; a trader is posted at one spot and stays there.
 * The distinction is what the renderer keys idle behaviour and palette off, and it
 * is the difference between a market with staff and a market whose stalls are props.
 */
export type CrowdRole = 'shopper' | 'trader';

export interface CrowdAgent {
  id: number;
  cellId: CellId;
  role: CrowdRole;
  /** Loop of waypoints in local space; the agent walks between them and pauses. */
  route: Vec3Tuple[];
  /** Metres per second. Varied so the crowd does not pulse in lockstep. */
  speed: number;
  /** Seconds paused on arrival at each waypoint. */
  dwell: number;
  /** Offset into the loop so agents are not synchronised. */
  phase: number;
  height: number;
  /** Palette index for the figure. */
  tone: number;
  /**
   * Which way a posted figure faces. A one-stop route has no next waypoint to aim
   * at, and a trader who defaults to yaw zero is a trader standing sideways to her
   * own counter.
   */
  stationFacing?: number;
}

export interface CrowdPose {
  agent: CrowdAgent;
  position: Vec3Tuple;
  facing: number;
  /** 0 while paused, 1 while walking — drives the gait. */
  moving: number;
  /** Distance walked, for the leg cycle. */
  travelled: number;
}

const AGENTS_PER_CONCOURSE = 46;
const AGENTS_PER_COUNTER = 9;
const AGENTS_PER_FLOOR = 14;
const AGENTS_PER_APRON = 7;

export function buildSpaceStationCrowd(graph: SpaceStationGraph, seed: number): CrowdAgent[] {
  const agents: CrowdAgent[] = [];
  let nextId = 0;

  for (const cell of graph.cells) {
    if (!cell.enterable) continue;
    const count = populationFor(cell.kind);
    if (count === 0) continue;

    const cellSeed = (seed ^ Math.imul(cell.id.length + 7, 2246822519)) >>> 0;
    for (let i = 0; i < count; i++) {
      agents.push(createAgent(nextId++, cell, cellSeed, i));
    }
  }
  return agents;
}

function populationFor(kind: SpaceStationCell['kind']): number {
  switch (kind) {
    case 'concourse':
      return AGENTS_PER_CONCOURSE;
    case 'counter':
      return AGENTS_PER_COUNTER;
    case 'floor':
      return AGENTS_PER_FLOOR;
    case 'apron':
      return AGENTS_PER_APRON;
    default:
      return 0;
  }
}

function createAgent(id: number, cell: SpaceStationCell, cellSeed: number, index: number): CrowdAgent {
  const salt = index * 61 + 3;
  const inset = 2.4;
  const minX = cell.min[0] + inset;
  const maxX = cell.max[0] - inset;
  const minZ = cell.min[2] + inset;
  const maxZ = cell.max[2] - inset;

  // Concourse traffic runs mostly along the aisle, which is what makes a corridor of
  // people rather than a milling blob. Elsewhere the routes wander.
  const alongAisle = cell.kind === 'concourse';
  const stops = 2 + Math.floor(seededUnit(cellSeed, salt) * 3);
  const route: Vec3Tuple[] = [];

  for (let i = 0; i < stops; i++) {
    const t = seededUnit(cellSeed, salt + i * 13 + 1);
    const spread = seededUnit(cellSeed, salt + i * 17 + 2);
    const x = minX + (maxX - minX) * (alongAisle ? t : t);
    const z = alongAisle
      ? (cell.min[2] + cell.max[2]) / 2 + (spread - 0.5) * 11
      : minZ + (maxZ - minZ) * spread;
    route.push([x, cell.min[1], z]);
  }

  return {
    id,
    cellId: cell.id,
    role: 'shopper',
    route,
    speed: 1.1 + seededUnit(cellSeed, salt + 5) * 0.75,
    dwell: 1.5 + seededUnit(cellSeed, salt + 7) * 5,
    phase: seededUnit(cellSeed, salt + 11) * 60,
    height: 1.62 + seededUnit(cellSeed, salt + 13) * 0.22,
    tone: Math.floor(seededUnit(cellSeed, salt + 17) * 4)
  };
}

/** Where a trader is posted, and which way she looks. */
export interface CrowdStation {
  stand: Vec3Tuple;
  facing: number;
}

/**
 * The people behind the counters.
 *
 * Kept separate from the wandering crowd because their placement is not the crowd's
 * to decide: a trader stands where her stall is, and the stall sites are authored
 * by the same seed that builds the vendor records. This function takes those
 * positions rather than deriving them, so the figure you see and the trader you
 * open a panel with are the same person by construction.
 */
export function buildStallTraders(
  cellId: CellId,
  stations: readonly CrowdStation[],
  seed: number,
  firstId: number
): CrowdAgent[] {
  return stations.map((station, index) => {
    const salt = index * 89 + 41;
    return {
      id: firstId + index,
      cellId,
      role: 'trader',
      // One stop: a posted figure. The gait code sees `moving: 0` and leaves the
      // legs alone, which is what a person standing at a counter looks like.
      route: [[station.stand[0], station.stand[1], station.stand[2]]],
      speed: 0,
      dwell: 1,
      phase: seededUnit(seed, salt) * 60,
      height: 1.6 + seededUnit(seed, salt + 3) * 0.26,
      tone: Math.floor(seededUnit(seed, salt + 5) * 4),
      stationFacing: station.facing
    };
  });
}

/** Where every agent is at time `seconds`. Deterministic. */
export function crowdPosesAt(agents: CrowdAgent[], seconds: number): CrowdPose[] {
  const poses: CrowdPose[] = [];
  for (const agent of agents) {
    poses.push(poseAt(agent, seconds));
  }
  return poses;
}

export function poseAt(agent: CrowdAgent, seconds: number): CrowdPose {
  const route = agent.route;
  if (route.length < 2) {
    return {
      agent,
      position: route[0] ?? [0, 0, 0],
      facing: agent.stationFacing ?? 0,
      moving: 0,
      travelled: 0
    };
  }

  // Precompute the loop's leg lengths and total cycle time.
  let total = 0;
  const legs: number[] = [];
  for (let i = 0; i < route.length; i++) {
    const a = route[i];
    const b = route[(i + 1) % route.length];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    legs.push(length);
    total += length;
  }
  if (total <= 0) {
    return { agent, position: route[0], facing: 0, moving: 0, travelled: 0 };
  }

  const walkTime = total / agent.speed;
  const cycle = walkTime + agent.dwell * route.length;
  let t = (seconds + agent.phase) % cycle;

  for (let i = 0; i < route.length; i++) {
    const a = route[i];
    const b = route[(i + 1) % route.length];
    const legTime = legs[i] / agent.speed;

    if (t < agent.dwell) {
      return {
        agent,
        position: [a[0], a[1], a[2]],
        facing: Math.atan2(b[0] - a[0], b[2] - a[2]),
        moving: 0,
        travelled: 0
      };
    }
    t -= agent.dwell;

    if (t < legTime) {
      const u = legTime > 0 ? t / legTime : 0;
      return {
        agent,
        position: [a[0] + (b[0] - a[0]) * u, a[1], a[2] + (b[2] - a[2]) * u],
        facing: Math.atan2(b[0] - a[0], b[2] - a[2]),
        moving: 1,
        travelled: legs[i] * u + sumTo(legs, i)
      };
    }
    t -= legTime;
  }

  return { agent, position: route[0], facing: 0, moving: 0, travelled: 0 };
}

function sumTo(values: number[], index: number): number {
  let sum = 0;
  for (let i = 0; i < index; i++) sum += values[i];
  return sum;
}

/**
 * The boxes making up one figure, in agent-local space (origin at the feet, facing
 * +Z). The caller rotates and places them.
 *
 * Proportions and features are taken directly from the audit worker in the story
 * layer, so the spaceStation crowd and W-7744 are recognisably the same species of
 * person: suit, backpack unit, arms held at the sides, and the visor slit that reads
 * as an ember from across a room. Measurements below are his, in his 1.66m frame,
 * scaled to each agent's height.
 */
export interface FigurePart {
  offset: Vec3Tuple;
  size: Vec3Tuple;
  /** Which limb, so the renderer can swing it. */
  limb: 'body' | 'head' | 'legLeft' | 'legRight' | 'armLeft' | 'armRight' | 'pack' | 'visor';
  /**
   * Local Y this part rotates about. A limb pivots at its joint, not its centre —
   * rotating a leg about its middle swings the hip as much as the foot and reads
   * as the figure pedalling from the ankles.
   */
  pivot?: number;
}

/** The reference frame these measurements were authored in. */
const REFERENCE_HEIGHT = 1.66;

const REFERENCE_PARTS: FigurePart[] = [
  { offset: [-0.14, 0.45, 0], size: [0.2, 1.0, 0.24], limb: 'legLeft', pivot: 0.95 },
  { offset: [0.14, 0.45, 0], size: [0.2, 1.0, 0.24], limb: 'legRight', pivot: 0.95 },
  { offset: [0, 1.3, 0], size: [0.56, 0.7, 0.34], limb: 'body' },
  { offset: [0, 1.35, -0.26], size: [0.42, 0.5, 0.2], limb: 'pack' },
  { offset: [-0.36, 1.25, 0], size: [0.14, 0.62, 0.2], limb: 'armLeft', pivot: 1.5 },
  { offset: [0.36, 1.25, 0], size: [0.14, 0.62, 0.2], limb: 'armRight', pivot: 1.5 },
  { offset: [0, 1.83, 0], size: [0.34, 0.36, 0.32], limb: 'head' },
  // The visor slit. Rendered on the unlit pass so it holds its ember through ACES.
  { offset: [0, 1.85, 0.145], size: [0.26, 0.08, 0.05], limb: 'visor' }
];

export function figureParts(height: number): FigurePart[] {
  const k = height / REFERENCE_HEIGHT;
  return REFERENCE_PARTS.map(part => ({
    ...part,
    offset: [part.offset[0] * k, part.offset[1] * k, part.offset[2] * k] as Vec3Tuple,
    size: [part.size[0] * k, part.size[1] * k, part.size[2] * k] as Vec3Tuple,
    pivot: part.pivot === undefined ? undefined : part.pivot * k
  }));
}

/**
 * Position of a part after the gait swing, in agent-local space.
 *
 * Rotating about `pivot` means solving for where the part's centre ends up when the
 * joint above it turns — which is the whole difference between a walk and a figure
 * scissoring its legs about their midpoints.
 */
export function swungOffset(part: FigurePart, tilt: number, lift: number): Vec3Tuple {
  if (!part.pivot || tilt === 0) {
    return [part.offset[0], part.offset[1] + lift, part.offset[2]];
  }
  const armY = part.offset[1] - part.pivot;
  const armZ = part.offset[2];
  return [
    part.offset[0],
    part.pivot + armY * Math.cos(tilt) - armZ * Math.sin(tilt),
    armY * Math.sin(tilt) + armZ * Math.cos(tilt)
  ];
}
