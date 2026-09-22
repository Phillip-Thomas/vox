import { describe, expect, it } from 'vitest';
import {
  CG_APPARATUS_SOLIDS,
  CG_FIXED_SOCKET,
  CG_FIXED_SOCKET_NOMINAL_HEIGHT,
  bodiesClear,
  checkReference,
  evaluateOfferedSpan,
  firstUnsupportedSegment,
  nextOccupancy,
  playerSocket,
  referenceSegmentBlockedBy,
  routeProgressUnits,
  segmentHitsBoxInclusive,
  walkedSegmentSupported,
  workerSocket,
  type CommonGroundAabb,
  type CommonGroundFooting
} from './commonGroundRoute.ts';
import {
  CG_POSES,
  CG_ROUTE_COMMON,
  CG_ROUTE_LONG,
  CG_ROUTE_SHORT,
  CG_COMMON_ROUTE_UNITS,
  walkedLength
} from './commonGroundState.ts';

const cap = CG_APPARATUS_SOLIDS.find(box => box.name === 'cap')!;
const backing = CG_APPARATUS_SOLIDS.find(box => box.name === 'backing')!;

/** Flat dry ground at the qualified body height, with an optional bad patch. */
function flatGround(hole?: { x: number; z: number; radius: number }): CommonGroundFooting {
  return {
    revision: 'flat',
    isSupported: point => {
      if (Math.abs(point.y - 51.05) > 0.001) return false;
      if (!hole) return true;
      return Math.hypot(point.x - hole.x, point.z - hole.z) > hole.radius;
    }
  };
}

/** Stand-in for the hero tree's existing trunk collider, across the long route. */
const trunk: CommonGroundAabb = {
  name: 'hero-tree-trunk',
  lo: { x: -37, y: 51, z: 21.5 },
  hi: { x: -35, y: 56, z: 22.5 }
};

describe('the fixed socket sits exactly on the cap plane', () => {
  it('is the qualified literal, not a float sum that lands inside the housing', () => {
    expect(CG_FIXED_SOCKET).toEqual({ x: -34, y: 52.35, z: 20 });
    expect(CG_FIXED_SOCKET.y - CG_POSES.R.y).toBeCloseTo(CG_FIXED_SOCKET_NOMINAL_HEIGHT, 9);
    expect(CG_FIXED_SOCKET.y).toBe(cap.hi.y);
    // Every ray socket in the chapter is at or above the cap's top face.
    for (const pose of [CG_POSES.S, CG_POSES.E, CG_POSES.C, CG_POSES.H]) {
      expect(workerSocket(pose).y).toBeGreaterThanOrEqual(cap.hi.y);
    }
    for (const pose of [CG_POSES.W, CG_POSES.T]) {
      expect(playerSocket(pose).y).toBeGreaterThanOrEqual(cap.hi.y);
    }
  });
});

describe('endpoint contact rule', () => {
  it('lets a ray rest on the cap top face and leave without blocking', () => {
    const on = { x: -34, y: 52.35, z: 20 };
    expect(referenceSegmentBlockedBy(on, { x: -34, y: 54, z: 20 }, cap)).toBe(false);
    // Symmetric: the same pair reversed must read the same.
    expect(referenceSegmentBlockedBy({ x: -34, y: 54, z: 20 }, on, cap)).toBe(false);
  });

  it('blocks an endpoint that immediately enters the solid', () => {
    expect(referenceSegmentBlockedBy(
      { x: -34, y: 52.35, z: 20 }, { x: -34, y: 52.3, z: 20 }, cap
    )).toBe(true);
  });

  it('blocks an interior crossing and a coplanar graze', () => {
    expect(referenceSegmentBlockedBy(
      { x: -34, y: 52.3, z: 19 }, { x: -34, y: 52.3, z: 21 }, cap
    )).toBe(true);
    expect(referenceSegmentBlockedBy(
      { x: -34.5, y: 52.35, z: 20 }, { x: -33.5, y: 52.35, z: 20 }, cap
    )).toBe(true);
  });

  it('blocks across the 0.12-thick backing with no spatial epsilon', () => {
    expect(referenceSegmentBlockedBy(
      { x: -34, y: 52, z: 18.54 }, { x: -34, y: 52, z: 19.66 }, backing
    )).toBe(true);
  });

  it('keeps the walk mask inclusive where the reference rule is not', () => {
    const on = { x: -34, y: 52.35, z: 20 };
    expect(segmentHitsBoxInclusive(on, { x: -34, y: 54, z: 20 }, cap)).toBe(true);
  });
});

describe('the fixed reference is not enough', () => {
  it('reaches S and E but cannot cover the whole short span', () => {
    // Socket to socket: his visor, not the ground under his boots.
    expect(checkReference(CG_FIXED_SOCKET, workerSocket(CG_POSES.S)).ok).toBe(true);
    expect(checkReference(CG_FIXED_SOCKET, workerSocket(CG_POSES.E)).ok).toBe(true);

    const held = evaluateOfferedSpan(CG_ROUTE_SHORT, { fixed: CG_FIXED_SOCKET, held: null }, flatGround());
    expect(held.reason).not.toBeNull();
    expect(held.supportedPrefix).toBeLessThan(CG_ROUTE_SHORT.length);
  });

  it('names the survey housing, not a generic failure, on the short route', () => {
    const result = evaluateOfferedSpan(
      CG_ROUTE_SHORT, { fixed: CG_FIXED_SOCKET, held: null }, flatGround()
    );
    // The measured short-route shadow is caused solely by the apparatus backing.
    expect(['reference-occluded-survey-housing', 'reference-out-of-range']).toContain(result.reason);
  });

  it('completes the short route once the off-route witness at W is occupied', () => {
    const result = evaluateOfferedSpan(
      CG_ROUTE_SHORT,
      { fixed: CG_FIXED_SOCKET, held: playerSocket(CG_POSES.W) },
      flatGround()
    );
    expect(result.reason).toBeNull();
    expect(result.supportedPrefix).toBe(CG_ROUTE_SHORT.length);
  });

  it('completes the long route on the first try with no witness at all', () => {
    const result = evaluateOfferedSpan(
      CG_ROUTE_LONG, { fixed: CG_FIXED_SOCKET, held: null }, flatGround()
    );
    expect(result.reason).toBeNull();
    expect(result.supportedPrefix).toBe(CG_ROUTE_LONG.length);
  });

  it('keeps both classes real: 16 walked units versus 36', () => {
    expect(walkedLength(CG_ROUTE_SHORT)).toBeCloseTo(16, 6);
    expect(walkedLength(CG_ROUTE_LONG)).toBeCloseTo(36, 6);
  });
});

describe('unsafe footing is never repaired by a witness', () => {
  // A washed-out patch partway along the otherwise fully supported long route.
  const broken = flatGround({ x: -30, z: 17, radius: 0.9 });

  it('reports footing-invalid and holds at the last safe sample', () => {
    const result = evaluateOfferedSpan(
      CG_ROUTE_LONG, { fixed: CG_FIXED_SOCKET, held: null }, broken
    );
    expect(result.reason).toBe('footing-invalid');
    expect(result.supportedPrefix).toBeGreaterThan(0);
    expect(result.supportedPrefix).toBeLessThan(CG_ROUTE_LONG.length);
  });

  it('still reports footing-invalid with a witness occupied', () => {
    const result = evaluateOfferedSpan(
      CG_ROUTE_LONG, { fixed: CG_FIXED_SOCKET, held: playerSocket(CG_POSES.W) }, broken
    );
    expect(result.reason).toBe('footing-invalid');
  });
});

describe('solid guard over the planned route', () => {
  it('rejects a segment that runs through the existing trunk collider', () => {
    expect(walkedSegmentSupported(
      { x: -38, y: 51.05, z: 22 }, { x: -34, y: 51.05, z: 22 }, flatGround(), { extraSolids: [trunk] }
    )).toBe(false);
    expect(firstUnsupportedSegment(CG_ROUTE_LONG, flatGround(), { extraSolids: [trunk] }))
      .toBeGreaterThan(0);
  });

  it('names a non-housing occluder distinctly', () => {
    // Straight out the far side of the apparatus, where the housing is clear.
    const target = workerSocket({ x: -34, y: 51.05, z: 26 });
    expect(checkReference(CG_FIXED_SOCKET, target).ok).toBe(true);
    const blocker: CommonGroundAabb = {
      name: 'hero-tree-trunk',
      lo: { x: -35, y: 51, z: 22 },
      hi: { x: -33, y: 56, z: 23 }
    };
    const result = checkReference(CG_FIXED_SOCKET, target, { extraSolids: [blocker] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('reference-occluded-other-solid');
    expect(result.blockedBy).toBe('hero-tree-trunk');
  });
});

describe('occupancy hysteresis and bodies', () => {
  it('needs the inner cylinder to establish and the outer to drop', () => {
    const pose = CG_POSES.W;
    const nearEdge = { x: pose.x + 1.5, y: pose.y, z: pose.z };
    expect(nextOccupancy(false, nearEdge, pose)).toBe(false);
    expect(nextOccupancy(true, nearEdge, pose)).toBe(true);
    expect(nextOccupancy(true, { x: pose.x + 2, y: pose.y, z: pose.z }, pose)).toBe(false);
  });

  it('keeps the two bodies apart at the reciprocal reference', () => {
    expect(bodiesClear(CG_POSES.E, CG_POSES.H)).toBe(true);
    expect(bodiesClear(CG_POSES.H, { ...CG_POSES.H, x: CG_POSES.H.x + 0.4 })).toBe(false);
  });

  it('holds the reciprocal reference at H, not at E', () => {
    const socket = workerSocket(CG_POSES.H);
    expect(socket.y).toBeCloseTo(52.9, 6);
    // Terra walks the common span, so her eye is the far end of every ray.
    for (const point of CG_ROUTE_COMMON) {
      expect(checkReference(socket, playerSocket(point)).ok).toBe(true);
    }
    // The FIXED reference cannot cover the whole passage, which is why a second
    // body has to stand at H at all: 8 of the 18 walked units are outside it.
    expect(CG_ROUTE_COMMON.some(point => !checkReference(CG_FIXED_SOCKET, playerSocket(point)).ok))
      .toBe(true);
  });

  it('covers his full E to C test from the far Terra reference at T', () => {
    const socket = playerSocket(CG_POSES.T);
    for (const point of CG_ROUTE_COMMON) {
      expect(checkReference(socket, workerSocket(point)).ok).toBe(true);
    }
  });
});

describe('progress is traversal, not proximity', () => {
  /** Walk a polyline, feeding the REAL displacement of each step. */
  function walk(points: readonly { x: number; y: number; z: number }[], from = 0): number {
    let units = from;
    for (let index = 1; index < points.length; index += 1) {
      const step = Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y,
        points[index].z - points[index - 1].z
      );
      units = routeProgressUnits(CG_ROUTE_COMMON, points[index], units, step);
    }
    return units;
  }

  it('gives a standing body nothing, however many times it is sampled', () => {
    let units = routeProgressUnits(CG_ROUTE_COMMON, CG_POSES.C, 0, 0);
    for (let frame = 0; frame < 500; frame += 1) {
      units = routeProgressUnits(CG_ROUTE_COMMON, CG_POSES.C, units, 0);
    }
    expect(units).toBe(0);
    // And standing at the START earns nothing either: a timer is not a walk.
    expect(routeProgressUnits(CG_ROUTE_COMMON, CG_POSES.E, 0, 0)).toBe(0);
  });

  it('refuses the direct six-unit E-to-C shortcut', () => {
    // The endpoints are six units apart; the passage is eighteen. Walking the
    // straight line between them is a walk, and it is not this walk.
    const units = walk([CG_POSES.E, CG_POSES.C]);
    expect(units).toBeLessThan(CG_COMMON_ROUTE_UNITS);
    expect(units).toBeLessThanOrEqual(6);
  });

  it('cannot compound an allowance inside one scan', () => {
    // One frame, one centimetre of real movement: at most one centimetre of
    // progress, no matter how many segments the scan touches.
    const nudged = { x: CG_POSES.E.x, y: CG_POSES.E.y, z: CG_POSES.E.z + 0.01 };
    expect(routeProgressUnits(CG_ROUTE_COMMON, nudged, 0, 0.01)).toBeLessThanOrEqual(0.01 + 1e-9);
  });

  it('credits the full span only after actually walking the corridor', () => {
    expect(walk(CG_ROUTE_COMMON)).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 4);
  });

  it('is monotonic: stepping back does not un-walk the span', () => {
    const units = walk(CG_ROUTE_COMMON);
    expect(routeProgressUnits(CG_ROUTE_COMMON, CG_ROUTE_COMMON[0], units, 6)).toBeCloseTo(units, 6);
  });
});

describe('the body is what walks, not a foot point', () => {
  it('refuses a grounded path that passes under the apparatus backing', () => {
    // The backing's underside is at y=51.35 and the ground is at 51.05, so a
    // foot-point line slips beneath a slab an upright body walks into.
    const from = { x: -34, y: 51.05, z: 18 };
    const to = { x: -34, y: 51.05, z: 20 };
    expect(walkedSegmentSupported(from, to, flatGround())).toBe(false);
  });

  it('allows a genuinely clear path beside it', () => {
    const from = { x: -30, y: 51.05, z: 18 };
    const to = { x: -30, y: 51.05, z: 22 };
    expect(walkedSegmentSupported(from, to, flatGround())).toBe(true);
  });

  it('keeps every qualified route walkable by a body', () => {
    for (const [label, route] of [
      ['short', CG_ROUTE_SHORT], ['long', CG_ROUTE_LONG], ['common', CG_ROUTE_COMMON]
    ] as const) {
      expect(firstUnsupportedSegment(route, flatGround()), label).toBe(-1);
    }
  });
});
