import type { Vec3Tuple } from '../starSystem.ts';
import { positionBlocked, type BlockerIndex } from './spaceStationCollision.ts';
import { PLAYER_BODY, type WalkState } from './spaceStationLocomotion.ts';
import type { SpaceStationCell, SpaceStationGraph, SpaceStationPortal } from './spaceStationTypes.ts';

const GRID = 0.75;
const CLEARANCE = PLAYER_BODY.radius + 0.12;
const MAX_VISITS = 32_000;
const distance = (a: Vec3Tuple, b: Vec3Tuple): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Movie navigation plans inputs only. The live controller still applies stepWalk. */
export function planStationWalk(
  graph: SpaceStationGraph, blockers: BlockerIndex, start: WalkState,
  target: Vec3Tuple, reach: number
): Vec3Tuple[] | null {
  const from = graph.cells.find(cell => cell.id === start.cellId && cell.enterable);
  const to = graph.cells.find(cell => cell.enterable
    && target[0] >= cell.min[0] && target[0] <= cell.max[0]
    && target[2] >= cell.min[2] && target[2] <= cell.max[2]);
  if (!from || !to || !Number.isFinite(reach) || reach <= 0) return null;
  const parents = new Map<string, { cell: string; portal: SpaceStationPortal }>();
  const queue = [from.id];
  const seen = new Set(queue);
  for (let index = 0; index < queue.length && !seen.has(to.id); index++) {
    for (const portal of graph.portals) {
      if (portal.sealed) continue;
      const next = portal.a === queue[index] ? portal.b : portal.b === queue[index] ? portal.a : null;
      if (!next || seen.has(next) || !graph.cells.some(cell => cell.id === next && cell.enterable)) continue;
      seen.add(next);
      parents.set(next, { cell: queue[index], portal });
      queue.push(next);
    }
  }
  if (!seen.has(to.id)) return null;
  const crossings: Array<{ cell: SpaceStationCell; next: SpaceStationCell; portal: SpaceStationPortal }> = [];
  for (let id = to.id; id !== from.id;) {
    const entry = parents.get(id)!;
    crossings.unshift({ cell: graph.cells.find(cell => cell.id === entry.cell)!,
      next: graph.cells.find(cell => cell.id === id)!, portal: entry.portal });
    id = entry.cell;
  }
  let position: Vec3Tuple = [...start.position];
  const result: Vec3Tuple[] = [];
  for (const { cell, next, portal } of crossings) {
    const axis = portal.halfExtents[0] === 0 ? 0 : portal.halfExtents[2] === 0 ? 2 : null;
    if (axis === null || Math.abs(cell.min[1] - next.min[1]) > PLAYER_BODY.step) return null;
    const sign = Math.sign((next.min[axis] + next.max[axis]) / 2 - portal.center[axis]);
    const before: Vec3Tuple = [portal.center[0], cell.min[1], portal.center[2]];
    const after: Vec3Tuple = [portal.center[0], next.min[1], portal.center[2]];
    before[axis] -= sign * 1.1;
    after[axis] += sign * 1.1;
    const path = pathInCell(cell, blockers, position, before, 0);
    if (!path || positionBlocked(blockers, after[0], after[2], after[1], PLAYER_BODY)) return null;
    result.push(...path, after);
    position = after;
  }
  const final = pathInCell(to, blockers, position, target, Math.max(0, reach - 0.8));
  return final ? [...result, ...final] : null;
}

/** Bounded local A*, against the same furniture footprints and body as walking. */
function pathInCell(
  cell: SpaceStationCell, blockers: BlockerIndex, start: Vec3Tuple, goal: Vec3Tuple, radius: number
): Vec3Tuple[] | null {
  const clear = (point: Vec3Tuple): boolean => point[0] >= cell.min[0] + CLEARANCE
    && point[0] <= cell.max[0] - CLEARANCE && point[2] >= cell.min[2] + CLEARANCE
    && point[2] <= cell.max[2] - CLEARANCE
    && !positionBlocked(blockers, point[0], point[2], cell.min[1], { ...PLAYER_BODY, radius: CLEARANCE });
  const line = (a: Vec3Tuple, b: Vec3Tuple): boolean => {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.25));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!clear([a[0] + (b[0] - a[0]) * t, cell.min[1], a[2] + (b[2] - a[2]) * t])) return false;
    }
    return true;
  };
  if (distance(start, goal) <= radius) return [];
  const directDistance = distance(start, goal);
  const direct: Vec3Tuple = [goal[0] + (start[0] - goal[0]) * radius / directDistance,
    cell.min[1], goal[2] + (start[2] - goal[2]) * radius / directDistance];
  if (line(start, direct)) return [direct];
  type Node = { x: number; z: number; point: Vec3Tuple; cost: number; score: number; parent: Node | null };
  const initial: Node = { x: 0, z: 0, point: start, cost: 0, score: directDistance, parent: null };
  // A sorted frontier is sufficient for these small rooms; visits are capped.
  const frontier: Node[] = [initial];
  const costs = new Map<string, number>([['0,0', 0]]);
  const push = (node: Node): void => {
    let lo = 0, hi = frontier.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (frontier[mid].score < node.score) lo = mid + 1; else hi = mid; }
    frontier.splice(lo, 0, node);
  };
  for (let visited = 0; frontier.length && visited < MAX_VISITS; visited++) {
    const current = frontier.shift()!;
    if (current.cost !== costs.get(`${current.x},${current.z}`)) continue;
    const remaining = distance(current.point, goal);
    let end: Vec3Tuple | null = remaining <= radius ? current.point : null;
    if (!end && remaining <= GRID * 2 + radius) {
      const endpoint: Vec3Tuple = [goal[0] + (current.point[0] - goal[0]) * radius / remaining,
        cell.min[1], goal[2] + (current.point[2] - goal[2]) * radius / remaining];
      if (line(current.point, endpoint)) end = endpoint;
    }
    if (end) {
      const points: Vec3Tuple[] = [end];
      for (let node: Node | null = current; node?.parent; node = node.parent) points.unshift(node.point);
      points.unshift(start);
      const smooth: Vec3Tuple[] = [];
      for (let i = 0; i < points.length - 1;) {
        let next = points.length - 1;
        while (next > i + 1 && !line(points[i], points[next])) next--;
        smooth.push(points[next]); i = next;
      }
      return smooth;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const x = current.x + dx, z = current.z + dz;
      const cost = current.cost + GRID * Math.hypot(dx, dz);
      const key = `${x},${z}`;
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      const point: Vec3Tuple = [start[0] + x * GRID, cell.min[1], start[2] + z * GRID];
      if (!line(current.point, point)) continue;
      costs.set(key, cost);
      push({ x, z, point, cost, score: cost + Math.max(0, distance(point, goal) - radius), parent: current });
    }
  }
  return null;
}
