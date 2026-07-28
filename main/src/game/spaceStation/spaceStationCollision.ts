import type { SpaceStationBox } from './spaceStationShell.ts';

/**
 * Prop collision.
 *
 * Cells and portals already make walls, floors and doorways solid, which is what
 * makes the station read as built. This is the refinement on top: the furniture in
 * it. Without it a market stall is a picture of a market stall — you walk through
 * the counter, through the trader, and out the back of the booth.
 *
 * Deliberately not a physics engine. Every prop is an axis-aligned box and the
 * player is a vertical cylinder, so the whole problem is three cheap tests:
 *
 *  - can I move here?      horizontal overlap, resolved per axis so you slide
 *  - what am I standing on? the highest reachable top under my feet
 *  - what is above me?      the lowest overhang, so a canopy stops a jump
 *
 * Pure and renderer-free, so the answer to "can the player walk into the stall"
 * is a unit test rather than a play session.
 */

export interface Blocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
}

/**
 * A uniform grid over the station footprint.
 *
 * The concourse alone carries most of a thousand props and the query runs several
 * times per frame; bucketing by a coarse grid turns that into a handful of tests.
 * Uniform rather than hierarchical because the props are evenly spread by
 * construction — a BVH would be more code for the same answer.
 */
export interface BlockerIndex {
  readonly cell: number;
  readonly originX: number;
  readonly originZ: number;
  readonly cols: number;
  readonly rows: number;
  readonly buckets: readonly Blocker[][];
  readonly count: number;
}

const GRID_CELL = 4;

/**
 * Whether a box is something you have to walk around.
 *
 * Lamps are the one exclusion: every fitting in the station is either bracketed to
 * something already solid or hung overhead, and a player who can get wedged on a
 * light fixture has found a bug rather than a wall. Everything else earns its
 * exemption at query time from its own geometry — a bench is stepped over because
 * it is low, a banner is passed under because it is high, and neither needs to be
 * special-cased here.
 */
export function isSolidProp(box: SpaceStationBox): boolean {
  return box.kind !== 'lamp';
}

export function buildBlockerIndex(boxes: readonly SpaceStationBox[]): BlockerIndex {
  const blockers: Blocker[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const box of boxes) {
    if (!isSolidProp(box)) continue;
    const blocker: Blocker = {
      minX: box.center[0] - box.size[0] / 2,
      maxX: box.center[0] + box.size[0] / 2,
      minZ: box.center[2] - box.size[2] / 2,
      maxZ: box.center[2] + box.size[2] / 2,
      bottom: box.center[1] - box.size[1] / 2,
      top: box.center[1] + box.size[1] / 2
    };
    blockers.push(blocker);
    if (blocker.minX < minX) minX = blocker.minX;
    if (blocker.maxX > maxX) maxX = blocker.maxX;
    if (blocker.minZ < minZ) minZ = blocker.minZ;
    if (blocker.maxZ > maxZ) maxZ = blocker.maxZ;
  }

  if (blockers.length === 0) {
    return { cell: GRID_CELL, originX: 0, originZ: 0, cols: 0, rows: 0, buckets: [], count: 0 };
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / GRID_CELL) + 1);
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / GRID_CELL) + 1);
  const buckets: Blocker[][] = Array.from({ length: cols * rows }, () => []);

  // A prop spanning several buckets is listed in each of them. Duplicated
  // references, not duplicated boxes — a rack thirty metres long has to be found
  // from anywhere along its length.
  for (const blocker of blockers) {
    const c0 = columnOf(blocker.minX, minX);
    const c1 = columnOf(blocker.maxX, minX);
    const r0 = columnOf(blocker.minZ, minZ);
    const r1 = columnOf(blocker.maxZ, minZ);
    for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
      for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) {
        buckets[c * rows + r].push(blocker);
      }
    }
  }

  return { cell: GRID_CELL, originX: minX, originZ: minZ, cols, rows, buckets, count: blockers.length };
}

function columnOf(value: number, origin: number): number {
  return Math.floor((value - origin) / GRID_CELL);
}

/** Every blocker whose bucket covers the given footprint. May repeat; callers only test. */
function forEachNear(
  index: BlockerIndex,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  visit: (blocker: Blocker) => void
): void {
  if (index.count === 0) return;
  const c0 = Math.max(0, columnOf(minX, index.originX));
  const c1 = Math.min(index.cols - 1, columnOf(maxX, index.originX));
  const r0 = Math.max(0, columnOf(minZ, index.originZ));
  const r1 = Math.min(index.rows - 1, columnOf(maxZ, index.originZ));
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      const bucket = index.buckets[c * index.rows + r];
      for (const blocker of bucket) visit(blocker);
    }
  }
}

export interface BodyMetrics {
  radius: number;
  /** Floor to crown. What has to fit under an overhang. */
  height: number;
  /** How far up you can walk without jumping. */
  step: number;
}

/**
 * Whether a body standing at (x, z) with its feet at `feetY` intersects a blocker.
 *
 * The two early exits are what keep the rule set small: anything whose top is
 * within a step is walked over rather than into, and anything whose underside
 * clears your crown is passed beneath.
 */
function intersects(blocker: Blocker, x: number, z: number, feetY: number, body: BodyMetrics): boolean {
  if (blocker.top <= feetY + body.step) return false;
  if (blocker.bottom >= feetY + body.height) return false;
  return (
    x > blocker.minX - body.radius &&
    x < blocker.maxX + body.radius &&
    z > blocker.minZ - body.radius &&
    z < blocker.maxZ + body.radius
  );
}

/**
 * Whether a body could stand at (x, z) at all.
 *
 * Exported because placement wants the same answer movement does — a trader posted
 * inside her own shelving, or a spawn point inside a crate stack, is the kind of
 * defect that is invisible until someone walks up to it.
 */
export function positionBlocked(
  index: BlockerIndex,
  x: number,
  z: number,
  feetY: number,
  body: BodyMetrics
): boolean {
  let hit = false;
  forEachNear(index, x - body.radius, x + body.radius, z - body.radius, z + body.radius, blocker => {
    if (!hit && intersects(blocker, x, z, feetY, body)) hit = true;
  });
  return hit;
}

/**
 * Move from one horizontal position toward another, stopping at props.
 *
 * Resolved one axis at a time so a body pressed against a counter still slides
 * along it. Moving diagonally into a corner therefore stops on both axes, which is
 * the correct answer and the reason this is not a single combined test.
 *
 * Swept in substeps no longer than the body's radius. Testing only the endpoint
 * would let a long move step clean over a thin prop — a per-frame walk never moves
 * far enough for that, but a teleport, a camera move or a future sprint speed
 * would, and a collision system that is correct only at the speeds it was written
 * for is a bug waiting for a tuning pass.
 */
export function slideAgainstProps(
  index: BlockerIndex,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  feetY: number,
  body: BodyMetrics
): [number, number] {
  if (index.count === 0) return [toX, toZ];

  // Already inside something — a teleport, a spawn on a crate, a prop set that
  // changed underfoot. Refusing the move here would trap the player permanently,
  // so every move is legal until they are clear.
  if (positionBlocked(index, fromX, fromZ, feetY, body)) return [toX, toZ];

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / Math.max(body.radius, 1e-3)));

  let x = fromX;
  let z = fromZ;
  // An axis stops at first contact and stays stopped. Re-testing it on later
  // substeps would find the far side of the obstacle clear and let the body finish
  // the move on the other side of it — which is the tunnelling the sweep exists to
  // prevent, reintroduced one substep at a time.
  let xStopped = false;
  let zStopped = false;

  for (let i = 1; i <= steps && !(xStopped && zStopped); i++) {
    if (!xStopped) {
      const stepX = fromX + (dx * i) / steps;
      if (positionBlocked(index, stepX, z, feetY, body)) xStopped = true;
      else x = stepX;
    }
    if (!zStopped) {
      const stepZ = fromZ + (dz * i) / steps;
      if (positionBlocked(index, x, stepZ, feetY, body)) zStopped = true;
      else z = stepZ;
    }
  }
  return [x, z];
}

/**
 * Height of the surface under (x, z): the floor, or the top of whatever prop is
 * standing on it.
 *
 * The reachability test is against the feet rather than the floor, so it answers
 * both questions at once — a crate two metres tall is not something you can step
 * onto from the ground, but it is something you land on when you are falling past
 * its top.
 *
 * Support uses the body's centre, not its radius: a figure that keeps standing
 * while its centre is out past the edge of a crate is hovering.
 */
export function supportHeightAt(
  index: BlockerIndex,
  x: number,
  z: number,
  feetY: number,
  floorY: number,
  body: BodyMetrics
): number {
  let best = floorY;
  forEachNear(index, x, x, z, z, blocker => {
    if (blocker.top <= best) return;
    if (blocker.top > feetY + body.step) return;
    if (x < blocker.minX || x > blocker.maxX || z < blocker.minZ || z > blocker.maxZ) return;
    best = blocker.top;
  });
  return best;
}

/**
 * Underside of the lowest thing overhead at (x, z), or Infinity when the sky is
 * clear. This is what makes a market canopy something you duck under rather than
 * jump through.
 */
export function headroomAt(
  index: BlockerIndex,
  x: number,
  z: number,
  feetY: number,
  body: BodyMetrics
): number {
  let lowest = Infinity;
  forEachNear(index, x - body.radius, x + body.radius, z - body.radius, z + body.radius, blocker => {
    // Anything at or below the feet is what you are standing on, not an overhang.
    if (blocker.bottom <= feetY + body.step) return;
    if (blocker.bottom >= lowest) return;
    if (
      x <= blocker.minX - body.radius ||
      x >= blocker.maxX + body.radius ||
      z <= blocker.minZ - body.radius ||
      z >= blocker.maxZ + body.radius
    ) {
      return;
    }
    lowest = blocker.bottom;
  });
  return lowest;
}
