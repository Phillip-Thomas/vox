import * as THREE from 'three';
import type { CubeFace } from '../types/cube.ts';
import {
  PLAYER_CENTER_CLEARANCE,
  VOXEL_SCALE,
  voxelCoordToWorld
} from './cubeGravityConstants.ts';
import { dominantFaceForPosition } from './surfaceControls.ts';

/** Minimal terrain contract usable by procedural worlds, live edit overlays, and tests. */
export interface AgentSurfaceTerrainQuery {
  isSolidVoxel(x: number, y: number, z: number): boolean;
  isWaterVoxel(x: number, y: number, z: number): boolean;
  isHazardousVoxel?(x: number, y: number, z: number): boolean;
}

export interface AgentSurfaceRouteOptions {
  /** Force an owning face near a cube edge; otherwise the start/goal positions decide. */
  face?: CubeFace;
  /** Cross-face pathfinding is intentionally out of scope; direct is an explicit fallback. */
  differentFaceFallback?: 'direct' | 'unreachable';
  clearanceCells?: number;
  maxSlopeCells?: number;
  edgeMarginCells?: number;
  maxVisitedCells?: number;
  maxSearchDistanceCells?: number;
  maxGoalApproachRadiusCells?: number;
  maxGoalCandidates?: number;
  waypointClearanceWorld?: number;
  allowJetpackCrossing?: boolean;
  /** Maximum cells in the one contiguous water segment a route may cross. */
  maxJetpackWaterCells?: number;
  /** Maximum water depth that may be cleared by the generated jetpack waypoints. */
  maxJetpackWaterDepthCells?: number;
  /** A dry path must be at least this many cells longer before jetpack wins. */
  jetpackDetourExtraCells?: number;
  /** And this multiple longer; both thresholds make the fallback deliberate. */
  jetpackDetourRatio?: number;
  jetpackWaterStepCost?: number;
}

export type AgentSurfaceRouteMode = 'walk' | 'jetpack' | 'direct' | 'unreachable';

export type AgentSurfaceRouteReason =
  | 'dry-surface-path'
  | 'wet-goal-resolved-to-dry-approach'
  | 'goal-resolved-to-dry-approach'
  | 'dry-route-unavailable-short-water-crossing'
  | 'dry-detour-substantially-longer'
  | 'already-at-resolved-goal'
  | 'different-face-direct-fallback'
  | 'different-face-routing-disabled'
  | 'start-column-not-traversable'
  | 'no-dry-goal-approach'
  | 'search-budget-exhausted'
  | 'no-safe-route';

export interface AgentSurfaceWaterCrossing {
  waterCellCount: number;
  maxConsecutiveWaterCells: number;
  firstWaterWaypointIndex: number;
  lastWaterWaypointIndex: number;
  entryWorld: THREE.Vector3;
  exitWorld: THREE.Vector3;
  dryPathCost: number | null;
  selectedPathCost: number;
  reason: 'dry-route-unavailable' | 'dry-detour-substantially-longer';
}

export interface AgentSurfaceRoute {
  mode: AgentSurfaceRouteMode;
  face: CubeFace;
  waypoints: THREE.Vector3[];
  requestedGoal: THREE.Vector3;
  resolvedGoal: THREE.Vector3 | null;
  requestedGoalWasWet: boolean;
  waterCrossing: AgentSurfaceWaterCrossing | null;
  reason: AgentSurfaceRouteReason;
  visitedCells: number;
}

type Axis = readonly [number, number, number];

interface FaceFrame {
  up: Axis;
  tangentU: Axis;
  tangentV: Axis;
}

const FACE_FRAMES: Record<CubeFace, FaceFrame> = {
  top: { up: [0, 1, 0], tangentU: [1, 0, 0], tangentV: [0, 0, 1] },
  bottom: { up: [0, -1, 0], tangentU: [1, 0, 0], tangentV: [0, 0, 1] },
  right: { up: [1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  left: { up: [-1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  front: { up: [0, 0, 1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] },
  back: { up: [0, 0, -1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] }
};

interface ResolvedOptions {
  differentFaceFallback: 'direct' | 'unreachable';
  clearanceCells: number;
  maxSlopeCells: number;
  edgeMarginCells: number;
  maxVisitedCells: number;
  maxSearchDistanceCells: number;
  maxGoalApproachRadiusCells: number;
  maxGoalCandidates: number;
  waypointClearanceWorld: number;
  allowJetpackCrossing: boolean;
  maxJetpackWaterCells: number;
  maxJetpackWaterDepthCells: number;
  jetpackDetourExtraCells: number;
  jetpackDetourRatio: number;
  jetpackWaterStepCost: number;
}

interface GridPoint {
  u: number;
  v: number;
}

interface SurfaceCell extends GridPoint {
  support: { x: number; y: number; z: number };
  height: number;
  dry: boolean;
  wet: boolean;
  jetpackSafe: boolean;
  waterDepthCells: number;
}

interface SearchNode extends GridPoint {
  key: string;
  parentKey: string | null;
  cell: SurfaceCell;
  g: number;
  h: number;
  f: number;
  wet: boolean;
  waterRun: number;
  waterCells: number;
  crossingComplete: boolean;
}

interface SearchResult {
  path: SurfaceCell[] | null;
  cost: number;
  waterCells: number;
  visited: number;
  exhausted: boolean;
}

interface CandidatePlan {
  goal: SurfaceCell;
  path: SurfaceCell[];
  cost: number;
  waterCells: number;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [0, 1], [-1, 0], [0, -1]
];

function clampInt(value: number | undefined, fallback: number, min: number): number {
  return Math.max(min, Math.floor(value ?? fallback));
}

function resolvedOptions(
  radiusCells: number,
  options: AgentSurfaceRouteOptions
): ResolvedOptions {
  return {
    differentFaceFallback: options.differentFaceFallback ?? 'direct',
    clearanceCells: clampInt(options.clearanceCells, 2, 1),
    // Surface walking never steps more than one voxel; callers may tighten to
    // flat-only but cannot silently turn this into a cliff-climbing planner.
    maxSlopeCells: Math.min(1, clampInt(options.maxSlopeCells, 1, 0)),
    edgeMarginCells: clampInt(options.edgeMarginCells, 1, 0),
    maxVisitedCells: clampInt(options.maxVisitedCells, 4096, 1),
    maxSearchDistanceCells: clampInt(options.maxSearchDistanceCells, radiusCells * 4, 1),
    maxGoalApproachRadiusCells: clampInt(options.maxGoalApproachRadiusCells, 8, 1),
    maxGoalCandidates: clampInt(options.maxGoalCandidates, 32, 1),
    waypointClearanceWorld: Math.max(0, options.waypointClearanceWorld ?? PLAYER_CENTER_CLEARANCE),
    allowJetpackCrossing: options.allowJetpackCrossing ?? true,
    maxJetpackWaterCells: clampInt(options.maxJetpackWaterCells, 3, 1),
    maxJetpackWaterDepthCells: clampInt(options.maxJetpackWaterDepthCells, 2, 1),
    jetpackDetourExtraCells: Math.max(0, options.jetpackDetourExtraCells ?? 4),
    jetpackDetourRatio: Math.max(1, options.jetpackDetourRatio ?? 1.5),
    jetpackWaterStepCost: Math.max(1, options.jetpackWaterStepCost ?? 1.2)
  };
}

function dotCoord(x: number, y: number, z: number, axis: Axis): number {
  return x * axis[0] + y * axis[1] + z * axis[2];
}

function composeCoord(frame: FaceFrame, height: number, u: number, v: number) {
  return {
    x: frame.up[0] * height + frame.tangentU[0] * u + frame.tangentV[0] * v,
    y: frame.up[1] * height + frame.tangentU[1] * u + frame.tangentV[1] * v,
    z: frame.up[2] * height + frame.tangentU[2] * u + frame.tangentV[2] * v
  };
}

function addAxis(coord: { x: number; y: number; z: number }, axis: Axis, amount: number) {
  return {
    x: coord.x + axis[0] * amount,
    y: coord.y + axis[1] * amount,
    z: coord.z + axis[2] * amount
  };
}

function worldToGrid(position: THREE.Vector3, frame: FaceFrame): GridPoint {
  const x = Math.round(position.x / VOXEL_SCALE);
  const y = Math.round(position.y / VOXEL_SCALE);
  const z = Math.round(position.z / VOXEL_SCALE);
  return {
    u: dotCoord(x, y, z, frame.tangentU),
    v: dotCoord(x, y, z, frame.tangentV)
  };
}

function gridKey(point: GridPoint): string {
  return `${point.u},${point.v}`;
}

function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.u - b.u) + Math.abs(a.v - b.v);
}

function orderedOffsets(radius: number): Array<{ du: number; dv: number; distanceSq: number }> {
  const result: Array<{ du: number; dv: number; distanceSq: number }> = [];
  for (let du = -radius; du <= radius; du++) {
    for (let dv = -radius; dv <= radius; dv++) {
      const distanceSq = du * du + dv * dv;
      if (distanceSq > radius * radius) continue;
      result.push({ du, dv, distanceSq });
    }
  }
  result.sort((a, b) =>
    a.distanceSq - b.distanceSq
    || Math.abs(a.du) + Math.abs(a.dv) - Math.abs(b.du) - Math.abs(b.dv)
    || a.du - b.du
    || a.dv - b.dv
  );
  return result;
}

class MinHeap<T> {
  private readonly values: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.values.length;
  }

  push(value: T): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentValue = this.values[parent];
      if (parentValue === undefined || this.compare(parentValue, value) <= 0) break;
      this.values[index] = parentValue;
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): T | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (first === undefined || last === undefined || this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      let child = left;
      const leftValue = this.values[left];
      const rightValue = this.values[right];
      if (leftValue === undefined) break;
      if (rightValue !== undefined && this.compare(rightValue, leftValue) < 0) child = right;
      const childValue = this.values[child];
      if (childValue === undefined || this.compare(last, childValue) <= 0) break;
      this.values[index] = childValue;
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

/**
 * Plan a bounded same-face route over exposed terrain columns. Dry A* always
 * gets first refusal. A second search may cross one short, shallow water segment,
 * but is selected only when the dry route is absent or materially longer.
 */
export function planAgentSurfaceRoute(
  terrain: AgentSurfaceTerrainQuery,
  planetSize: number,
  startWorld: THREE.Vector3,
  goalWorld: THREE.Vector3,
  options: AgentSurfaceRouteOptions = {}
): AgentSurfaceRoute {
  const radiusCells = Math.max(1, Math.floor(planetSize / VOXEL_SCALE));
  const config = resolvedOptions(radiusCells, options);
  const startFace = options.face ?? dominantFaceForPosition(startWorld);
  const goalFace = options.face ?? dominantFaceForPosition(goalWorld);

  const base = (mode: AgentSurfaceRouteMode, reason: AgentSurfaceRouteReason): AgentSurfaceRoute => ({
    mode,
    face: startFace,
    waypoints: [],
    requestedGoal: goalWorld.clone(),
    resolvedGoal: null,
    requestedGoalWasWet: false,
    waterCrossing: null,
    reason,
    visitedCells: 0
  });

  if (startFace !== goalFace) {
    if (config.differentFaceFallback === 'direct') {
      return {
        ...base('direct', 'different-face-direct-fallback'),
        waypoints: [startWorld.clone(), goalWorld.clone()],
        resolvedGoal: goalWorld.clone()
      };
    }
    return base('unreachable', 'different-face-routing-disabled');
  }

  const frame = FACE_FRAMES[startFace];
  const up = new THREE.Vector3(frame.up[0], frame.up[1], frame.up[2]);
  const startGrid = worldToGrid(startWorld, frame);
  const requestedGoalGrid = worldToGrid(goalWorld, frame);
  const cache = new Map<string, SurfaceCell | null>();

  const hazardous = (coord: { x: number; y: number; z: number }) =>
    terrain.isHazardousVoxel?.(coord.x, coord.y, coord.z) ?? false;

  const cellAt = (u: number, v: number): SurfaceCell | null => {
    const key = `${u},${v}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    let support: { x: number; y: number; z: number } | null = null;
    let height = -1;
    for (let h = radiusCells; h >= 0; h--) {
      const coord = composeCoord(frame, h, u, v);
      if (!terrain.isSolidVoxel(coord.x, coord.y, coord.z)) continue;
      const outward = addAxis(coord, frame.up, 1);
      if (h < radiusCells && terrain.isSolidVoxel(outward.x, outward.y, outward.z)) continue;
      support = coord;
      height = h;
      break;
    }
    if (
      !support
      || height < Math.max(Math.abs(u), Math.abs(v)) + config.edgeMarginCells
      || hazardous(support)
    ) {
      cache.set(key, null);
      return null;
    }

    let bodyBlocked = false;
    let jetpackBlocked = false;
    let waterDepthCells = terrain.isWaterVoxel(support.x, support.y, support.z) ? 1 : 0;
    const scanCells = config.maxJetpackWaterDepthCells + config.clearanceCells;
    for (let lift = 1; lift <= scanCells; lift++) {
      const coord = addAxis(support, frame.up, lift);
      // Procedural terrain can logically bulge one or more cells beyond the
      // rendered/collider cube. Boundary support is exposed by definition; an
      // unrendered logical voxel outside that cube must not become an invisible
      // ceiling for agents (spawnValidation follows the same contract).
      const insideRenderedTerrain = Math.max(
        Math.abs(coord.x),
        Math.abs(coord.y),
        Math.abs(coord.z)
      ) <= radiusCells;
      const solid = insideRenderedTerrain && terrain.isSolidVoxel(coord.x, coord.y, coord.z);
      const hazard = insideRenderedTerrain && hazardous(coord);
      const water = terrain.isWaterVoxel(coord.x, coord.y, coord.z);
      if (water) waterDepthCells = Math.max(waterDepthCells, lift);
      if (lift <= config.clearanceCells && (solid || hazard)) bodyBlocked = true;
      if (solid || hazard) jetpackBlocked = true;
    }
    const wet = waterDepthCells > 0;
    const dry = !wet && !bodyBlocked;
    const jetpackSafe = wet
      && !bodyBlocked
      && !jetpackBlocked
      && waterDepthCells <= config.maxJetpackWaterDepthCells;
    const result: SurfaceCell = {
      u,
      v,
      support,
      height,
      dry,
      wet,
      jetpackSafe,
      waterDepthCells
    };
    cache.set(key, result);
    return result;
  };

  const startCell = cellAt(startGrid.u, startGrid.v);
  if (!startCell || (!startCell.dry && !(config.allowJetpackCrossing && startCell.jetpackSafe))) {
    return base('unreachable', 'start-column-not-traversable');
  }

  const rawGoalCell = cellAt(requestedGoalGrid.u, requestedGoalGrid.v);
  const requestedGoalWasWet = rawGoalCell?.wet ?? false;
  const candidates: SurfaceCell[] = [];
  if (rawGoalCell?.dry) {
    candidates.push(rawGoalCell);
  } else {
    const offsets = orderedOffsets(config.maxGoalApproachRadiusCells);
    const seen = new Set<string>();
    for (const { du, dv } of offsets) {
      if (du === 0 && dv === 0) continue;
      const candidate = cellAt(requestedGoalGrid.u + du, requestedGoalGrid.v + dv);
      if (!candidate?.dry) continue;
      const key = gridKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
      if (candidates.length >= config.maxGoalCandidates) break;
    }
  }
  if (candidates.length === 0) {
    return {
      ...base('unreachable', 'no-dry-goal-approach'),
      requestedGoalWasWet
    };
  }

  const stateKey = (
    point: GridPoint,
    allowWet: boolean,
    waterRun: number,
    waterCells: number,
    crossingComplete: boolean
  ) => allowWet
    ? `${point.u},${point.v}|${waterRun}|${waterCells}|${crossingComplete ? 1 : 0}`
    : `${point.u},${point.v}`;

  const search = (goal: SurfaceCell, allowWet: boolean): SearchResult => {
    if ((!startCell.dry && !allowWet) || (startCell.wet && !startCell.jetpackSafe)) {
      return { path: null, cost: Infinity, waterCells: 0, visited: 0, exhausted: false };
    }
    const startWaterCells = startCell.wet ? 1 : 0;
    if (startWaterCells > config.maxJetpackWaterCells) {
      return { path: null, cost: Infinity, waterCells: 0, visited: 0, exhausted: false };
    }
    const startKey = stateKey(startCell, allowWet, startWaterCells, startWaterCells, false);
    const startNode: SearchNode = {
      ...startCell,
      key: startKey,
      parentKey: null,
      cell: startCell,
      g: 0,
      h: manhattan(startCell, goal),
      f: manhattan(startCell, goal),
      wet: startCell.wet,
      waterRun: startWaterCells,
      waterCells: startWaterCells,
      crossingComplete: false
    };
    const compare = (a: SearchNode, b: SearchNode) =>
      a.f - b.f
      || a.h - b.h
      || a.waterCells - b.waterCells
      || a.g - b.g
      || a.u - b.u
      || a.v - b.v
      || a.key.localeCompare(b.key);
    const open = new MinHeap<SearchNode>(compare);
    const best = new Map<string, number>([[startKey, 0]]);
    const nodes = new Map<string, SearchNode>([[startKey, startNode]]);
    open.push(startNode);
    let visited = 0;

    while (open.size > 0) {
      const current = open.pop();
      if (!current) break;
      if (best.get(current.key) !== current.g) continue;
      visited++;
      if (visited > config.maxVisitedCells) {
        return { path: null, cost: Infinity, waterCells: 0, visited, exhausted: true };
      }
      if (current.u === goal.u && current.v === goal.v) {
        const path: SurfaceCell[] = [];
        let cursor: SearchNode | undefined = current;
        while (cursor) {
          path.push(cursor.cell);
          cursor = cursor.parentKey ? nodes.get(cursor.parentKey) : undefined;
        }
        path.reverse();
        return {
          path,
          cost: current.g,
          waterCells: current.waterCells,
          visited,
          exhausted: false
        };
      }

      for (const [du, dv] of NEIGHBORS) {
        const point = { u: current.u + du, v: current.v + dv };
        if (manhattan(startCell, point) > config.maxSearchDistanceCells) continue;
        const cell = cellAt(point.u, point.v);
        if (!cell || Math.abs(cell.height - current.cell.height) > config.maxSlopeCells) continue;
        if (!cell.dry && !(allowWet && cell.jetpackSafe)) continue;

        let waterRun = 0;
        let waterCells = current.waterCells;
        let crossingComplete = current.crossingComplete;
        if (cell.wet) {
          if (crossingComplete) continue; // one deliberate contiguous crossing only
          waterRun = current.wet ? current.waterRun + 1 : 1;
          waterCells += 1;
          if (waterRun > config.maxJetpackWaterCells || waterCells > config.maxJetpackWaterCells) continue;
        } else if (current.wet && current.waterCells > 0) {
          crossingComplete = true;
        }

        const key = stateKey(cell, allowWet, waterRun, waterCells, crossingComplete);
        const stepCost = cell.wet ? config.jetpackWaterStepCost : 1;
        const g = current.g + stepCost + Math.abs(cell.height - current.cell.height) * 0.05;
        if (g >= (best.get(key) ?? Infinity)) continue;
        const h = manhattan(cell, goal);
        const next: SearchNode = {
          ...cell,
          key,
          parentKey: current.key,
          cell,
          g,
          h,
          f: g + h,
          wet: cell.wet,
          waterRun,
          waterCells,
          crossingComplete
        };
        best.set(key, g);
        nodes.set(key, next);
        open.push(next);
      }
    }
    return { path: null, cost: Infinity, waterCells: 0, visited, exhausted: false };
  };

  let visitedCells = 0;
  let exhausted = false;
  let nearestJet: CandidatePlan | null = null;
  let selectedDry: CandidatePlan | null = null;
  let selectedJet: CandidatePlan | null = null;

  for (const goal of candidates) {
    const dry = search(goal, false);
    visitedCells += dry.visited;
    exhausted ||= dry.exhausted;
    if (dry.path) {
      selectedDry = { goal, path: dry.path, cost: dry.cost, waterCells: 0 };
      if (config.allowJetpackCrossing) {
        const jet = search(goal, true);
        visitedCells += jet.visited;
        exhausted ||= jet.exhausted;
        if (jet.path && jet.waterCells > 0) {
          selectedJet = { goal, path: jet.path, cost: jet.cost, waterCells: jet.waterCells };
        }
      }
      break; // candidates are nearest-first: this is the nearest reachable dry approach
    }
    if (config.allowJetpackCrossing) {
      const jet = search(goal, true);
      visitedCells += jet.visited;
      exhausted ||= jet.exhausted;
      if (!nearestJet && jet.path && jet.waterCells > 0) {
        nearestJet = { goal, path: jet.path, cost: jet.cost, waterCells: jet.waterCells };
      }
    }
  }

  const jetPlan = selectedJet ?? nearestJet;
  let chosen: CandidatePlan | null = selectedDry;
  let mode: AgentSurfaceRouteMode = 'walk';
  let reason: AgentSurfaceRouteReason = requestedGoalWasWet
    ? 'wet-goal-resolved-to-dry-approach'
    : rawGoalCell?.dry
      ? 'dry-surface-path'
      : 'goal-resolved-to-dry-approach';
  let crossingReason: AgentSurfaceWaterCrossing['reason'] | null = null;

  if (!selectedDry && jetPlan) {
    chosen = jetPlan;
    mode = 'jetpack';
    reason = 'dry-route-unavailable-short-water-crossing';
    crossingReason = 'dry-route-unavailable';
  } else if (selectedDry && jetPlan) {
    const extra = selectedDry.cost - jetPlan.cost;
    const ratio = selectedDry.cost / Math.max(1, jetPlan.cost);
    if (extra >= config.jetpackDetourExtraCells && ratio >= config.jetpackDetourRatio) {
      chosen = jetPlan;
      mode = 'jetpack';
      reason = 'dry-detour-substantially-longer';
      crossingReason = 'dry-detour-substantially-longer';
    }
  }

  if (!chosen) {
    return {
      ...base('unreachable', exhausted ? 'search-budget-exhausted' : 'no-safe-route'),
      requestedGoalWasWet,
      visitedCells
    };
  }

  const waypointFor = (cell: SurfaceCell) => voxelCoordToWorld(
    cell.support.x,
    cell.support.y,
    cell.support.z
  ).addScaledVector(
    up,
    config.waypointClearanceWorld + (cell.wet ? cell.waterDepthCells * VOXEL_SCALE : 0)
  );
  const waypoints = chosen.path.map(waypointFor);
  const resolvedGoal = waypoints[waypoints.length - 1]?.clone() ?? null;
  if (chosen.path.length === 1 && mode === 'walk') {
    mode = 'direct';
    reason = 'already-at-resolved-goal';
  }

  let waterCrossing: AgentSurfaceWaterCrossing | null = null;
  if (mode === 'jetpack' && crossingReason) {
    const wetIndices = chosen.path
      .map((cell, index) => cell.wet ? index : -1)
      .filter(index => index >= 0);
    const first = wetIndices[0] ?? 0;
    const last = wetIndices[wetIndices.length - 1] ?? first;
    waterCrossing = {
      waterCellCount: wetIndices.length,
      maxConsecutiveWaterCells: wetIndices.length,
      firstWaterWaypointIndex: first,
      lastWaterWaypointIndex: last,
      entryWorld: (waypoints[Math.max(0, first - 1)] ?? waypoints[first]).clone(),
      exitWorld: (waypoints[Math.min(waypoints.length - 1, last + 1)] ?? waypoints[last]).clone(),
      dryPathCost: selectedDry?.cost ?? null,
      selectedPathCost: chosen.cost,
      reason: crossingReason
    };
  }

  return {
    mode,
    face: startFace,
    waypoints,
    requestedGoal: goalWorld.clone(),
    resolvedGoal,
    requestedGoalWasWet,
    waterCrossing,
    reason,
    visitedCells
  };
}
