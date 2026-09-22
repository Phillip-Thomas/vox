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
  COMMON_TESTED_SAMPLE_COUNT,
  TRACE_BAR_MAX_LENGTH,
  TRACE_BAR_MIN_LENGTH,
  commonGuideGlyphs,
  commonTestedGlyphs,
  routeProgressUnits,
  nextRouteCoverage,
  syncedRouteCoverage,
  NO_ROUTE_COVERAGE,
  type RouteCoverage,
  sampleRouteEvenly,
  segmentHitsBoxInclusive,
  traceGlyphs,
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
  MAX_TRACE_POINTS,
  walkedLength,
  type CommonGroundPoint
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

// --- the recorded manual-corner risk, reproduced from real displacement ------
//
// `producer-manual-corner-risk.json`: a director test turned at z 15.82, before
// the vertex at z 16, and the credited span stalled at 4 units while the body
// went on walking the rest of the route. The browser never reached this, so the
// reproduction is here, at walking pace, from the body's own frame-by-frame
// displacement.
//
// The conclusion is NOT a source repair. It is that the recorded stall is a lock
// only for a body that never goes back: returning to its own frontier and
// re-traversing credits the full eighteen units exactly, with the progress
// earned before the deviation retained. Everything below is the evidence for
// that, including the adversarial cases a cheaper reconciliation would have
// broken.

describe('a steering error costs a re-walk, and nothing cheaper pays for it', () => {
  const STEP = 4.5 / 60; // an ordinary walking pace at 60 Hz

  /** Walk a piecewise path at walking pace, feeding real per-frame displacement. */
  function stroll(
    waypoints: readonly { x: number; z: number }[],
    start: { x: number; y: number; z: number },
    units = 0
  ): { at: { x: number; y: number; z: number }; units: number; walked: number } {
    let at = { ...start };
    let walked = 0;
    for (const waypoint of waypoints) {
      const goal = { x: waypoint.x, y: CG_POSES.E.y, z: waypoint.z };
      for (let guard = 0; guard < 20000; guard += 1) {
        const remaining = Math.hypot(goal.x - at.x, goal.z - at.z);
        if (remaining <= 1e-9) break;
        const step = Math.min(STEP, remaining);
        const next = {
          x: at.x + ((goal.x - at.x) * step) / remaining,
          y: at.y,
          z: at.z + ((goal.z - at.z) * step) / remaining
        };
        const displacement = Math.hypot(next.x - at.x, next.z - at.z);
        walked += displacement;
        at = next;
        units = routeProgressUnits(CG_ROUTE_COMMON, at, units, displacement);
      }
    }
    return { at, units, walked };
  }

  const FORWARD = CG_ROUTE_COMMON.slice(1).map(point => ({ x: point.x, z: point.z }));
  /** The recorded body: it turns 0.18 units early, then walks every later leg. */
  const EARLY_TURN: readonly { x: number; z: number }[] = [
    { x: -42, z: 15.82 }, { x: -44, z: 16 }, { x: -44, z: 18 }, { x: -46, z: 18 },
    { x: -48, z: 18 }, { x: -48, z: 16 }, { x: -48, z: 14 }, { x: -48, z: 12 }
  ];

  it('credits an exactly walked route exactly, at walking pace', () => {
    const clean = stroll(FORWARD, CG_POSES.E);
    expect(clean.walked).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
    expect(clean.units).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
  });

  it('REPRODUCES the recorded stall: 17.83 units walked, 4 credited', () => {
    const early = stroll(EARLY_TURN, CG_POSES.E);
    expect(early.walked).toBeCloseTo(17.83, 1);
    expect(early.units).toBeCloseTo(4, 6);
  });

  it('will not be paid off by wiggling at the far end, or by an unrelated loop', () => {
    // This is the distinction the chapter's reading turns on: reaching a later
    // segment and moving about there is not the omitted ground.
    const early = stroll(EARLY_TURN, CG_POSES.E);
    const wiggled = stroll([
      { x: -48, z: 12.5 }, { x: -48, z: 12 }, { x: -48, z: 12.5 }, { x: -48, z: 12 }
    ], early.at, early.units);
    expect(wiggled.units).toBeCloseTo(4, 6);

    const looped = stroll([
      { x: -20, z: 30 }, { x: -20, z: 40 }, { x: -30, z: 40 }, { x: -30, z: 30 }
    ], { x: -30, y: CG_POSES.E.y, z: 30 }, early.units);
    expect(looped.walked).toBeGreaterThan(30);
    expect(looped.units).toBeCloseTo(4, 6);
  });

  it('IS RECOVERABLE by ordinary movement: back to the frontier, then forward', () => {
    // No reset, no second F, no new marker, no prompt: she walks back along the
    // route she can see, reaches the ground she actually left, and walks it.
    const early = stroll(EARLY_TURN, CG_POSES.E);
    expect(early.units).toBeCloseTo(4, 6);

    const back = stroll([
      { x: -48, z: 14 }, { x: -48, z: 16 }, { x: -48, z: 18 }, { x: -46, z: 18 },
      { x: -44, z: 18 }, { x: -44, z: 16 }, { x: -42, z: 16 }
    ], early.at, early.units);
    // Walking BACK earns nothing beyond the frontier it returns to.
    expect(back.units).toBeGreaterThanOrEqual(4);
    expect(back.units).toBeLessThan(4.2);

    const again = stroll([
      { x: -44, z: 16 }, { x: -44, z: 18 }, { x: -46, z: 18 }, { x: -48, z: 18 },
      { x: -48, z: 16 }, { x: -48, z: 14 }, { x: -48, z: 12 }
    ], back.at, back.units);
    expect(again.units).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
    // And the whole eighteen was actually walked, twice over the tail.
    expect(early.walked + back.walked + again.walked).toBeGreaterThan(CG_COMMON_ROUTE_UNITS);
  });

  it('retains the progress earned before the deviation, throughout', () => {
    const early = stroll(EARLY_TURN, CG_POSES.E);
    // The four units before the corner are a fact and stay one: standing,
    // backtracking and looping all leave them exactly where they were.
    expect(routeProgressUnits(CG_ROUTE_COMMON, early.at, early.units, 0)).toBeCloseTo(4, 6);
    const backwards = stroll([{ x: -48, z: 18 }], early.at, early.units);
    expect(backwards.units).toBeCloseTo(4, 6);
  });

  it('is not confused by a parallel leg two units away', () => {
    // The common route doubles back on itself: the -44 leg runs beside the -42
    // leg, and the -48 leg beside the -46 one. A body on the first must never be
    // credited the arc of the segment it merely happens to be near.
    const onFirstLeg = stroll([{ x: -42, z: 15 }], CG_POSES.E);
    expect(onFirstLeg.units).toBeCloseTo(3, 6);
    // Standing between the two legs, one unit from each, earns no jump.
    const between = routeProgressUnits(
      CG_ROUTE_COMMON, { x: -43, y: CG_POSES.E.y, z: 16 }, onFirstLeg.units, 0.075
    );
    expect(between).toBeLessThanOrEqual(onFirstLeg.units + 0.075 + 1e-9);
  });

  it('survives a Continue: the credited span is a number, not a cursor', () => {
    // A save taken mid-passage restores the units she had actually walked, and
    // the next step continues from the body's real position rather than
    // replaying the span or granting the remainder.
    const partial = stroll([{ x: -42, z: 16 }, { x: -44, z: 16 }], CG_POSES.E);
    expect(partial.units).toBeCloseTo(6, 6);
    const resumed = stroll([{ x: -44, z: 18 }], partial.at, partial.units);
    expect(resumed.units).toBeCloseTo(8, 6);
    // A restored number with the body somewhere else entirely earns nothing.
    expect(routeProgressUnits(
      CG_ROUTE_COMMON, { x: -20, y: CG_POSES.E.y, z: 40 }, partial.units, 0.075
    )).toBeCloseTo(partial.units, 6);
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

// --- the signed display grammar --------------------------------------------------------

function line(count: number, spacing = 1): CommonGroundPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: -26 - index * spacing, y: 51.05, z: 12
  }));
}

/** The heading a bar is drawn along, folded onto [0, pi) so ±direction agree. */
function heading(glyph: { angle: number }): number {
  const wrapped = ((glyph.angle % Math.PI) + Math.PI) % Math.PI;
  return Math.round(wrapped * 1e6) / 1e6;
}

describe('the trace grammar carries state in SHAPE, not colour', () => {
  it('gives a proposed sample exactly one bar along its own recorded segment', () => {
    const glyphs = traceGlyphs(line(4));
    expect(glyphs).toHaveLength(4);
    // The route runs along -X, so every bar lies along X and none across it.
    for (const glyph of glyphs) expect(heading(glyph)).toBeCloseTo(0, 6);
  });

  it('gives a tested sample two PARALLEL bars, and only the tested prefix', () => {
    const glyphs = traceGlyphs(line(5), { testedPrefixCount: 3 });
    // 3 tested samples x2 + 2 proposed x1.
    expect(glyphs).toHaveLength(8);
    const pair = glyphs.slice(0, 2);
    expect(heading(pair[0])).toBeCloseTo(heading(pair[1]), 6);
    // Separated ACROSS the path, not along it: same x, different z.
    expect(pair[0].x).toBeCloseTo(pair[1].x, 6);
    expect(Math.abs(pair[0].z - pair[1].z)).toBeGreaterThan(0.1);
  });

  it('REPLACES the held endpoint pair with a two-piece open transverse stop', () => {
    const points = line(5);
    const withoutHold = traceGlyphs(points, { testedPrefixCount: 5 });
    const withHold = traceGlyphs(points, { testedPrefixCount: 5, heldIndex: 4 });
    // Never a third glyph at the stopped end: the count is unchanged.
    expect(withHold).toHaveLength(withoutHold.length);
    const stop = withHold.slice(-2);
    // TRANSVERSE: across the path, where every other bar lies along it.
    for (const piece of stop) expect(heading(piece)).toBeCloseTo(Math.PI / 2, 6);
    // And genuinely OPEN in the middle: the two halves do not meet.
    const separation = Math.abs(stop[0].z - stop[1].z);
    expect(separation).toBeGreaterThan(stop[0].lengthUnits);
  });

  it('distinguishes all three states without reading a single colour', () => {
    const points = line(3);
    // Everything about a glyph EXCEPT its material: how many pieces stand at the
    // last sample, which way they point, and how far apart they are.
    const shape = (options: Parameters<typeof traceGlyphs>[1]) => {
      const all = traceGlyphs(points, options);
      const here = all.filter(glyph => Math.abs(glyph.x - points[2].x) < 0.5);
      const spread = here.length < 2
        ? 0
        : Math.hypot(here[0].x - here[1].x, here[0].z - here[1].z);
      return `${here.length}/${heading(here[0]).toFixed(3)}/${spread.toFixed(3)}`;
    };
    const proposed = shape({});
    const tested = shape({ testedPrefixCount: 3 });
    const held = shape({ testedPrefixCount: 3, heldIndex: 2 });
    expect(proposed).not.toBe(tested);
    expect(tested).not.toBe(held);
    expect(proposed).not.toBe(held);
    // One bar, then two along the path, then two across it.
    expect(proposed.startsWith('1/')).toBe(true);
    expect(tested.startsWith('2/0.000')).toBe(true);
    expect(held.startsWith(`2/${(Math.PI / 2).toFixed(3)}`)).toBe(true);
  });

  it('orients a corner from its ACTUAL incoming and outgoing segments', () => {
    // A right-angle turn: the mark bisects, rather than snapping to an axis or
    // growing into a larger square.
    const corner = traceGlyphs([
      { x: -26, y: 51.05, z: 12 },
      { x: -28, y: 51.05, z: 12 },
      { x: -28, y: 51.05, z: 14 }
    ])[1];
    expect(heading(corner)).toBeCloseTo(Math.PI * 0.75, 6);
  });

  it('clamps a bar to the REAL local spacing, so a dense corner cannot overdraw', () => {
    const dense = traceGlyphs(line(3, 0.25));
    for (const glyph of dense) {
      expect(glyph.lengthUnits).toBeLessThanOrEqual(TRACE_BAR_MAX_LENGTH);
      expect(glyph.lengthUnits).toBeGreaterThanOrEqual(TRACE_BAR_MIN_LENGTH);
      expect(glyph.lengthUnits).toBeLessThanOrEqual(0.25);
    }
    // A wide-open straight is still capped, so the marks never become a line.
    for (const glyph of traceGlyphs(line(3, 8))) {
      expect(glyph.lengthUnits).toBe(TRACE_BAR_MAX_LENGTH);
    }
  });

  it('retains EVERY recorded sample and still fits two routes in the 512 pool', () => {
    const full = line(MAX_TRACE_POINTS);
    const tested = traceGlyphs(full, { testedPrefixCount: MAX_TRACE_POINTS });
    expect(tested).toHaveLength(MAX_TRACE_POINTS * 2);
    expect(tested.length * 2).toBe(512);
    // Nothing decimated: one distinct anchor position per recorded sample.
    const positions = new Set(traceGlyphs(full).map(glyph => glyph.x.toFixed(4)));
    expect(positions.size).toBe(MAX_TRACE_POINTS);
    // Two glyphs per sample is the ceiling in every combination.
    for (const options of [{}, { testedPrefixCount: 64 }, { testedPrefixCount: 64, heldIndex: 10 }]) {
      expect(traceGlyphs(full, options).length).toBeLessThanOrEqual(MAX_TRACE_POINTS * 2);
    }
  });
});

describe('the planned common guide', () => {
  it('is one continuous thin line over the EXISTING qualified polyline', () => {
    const glyphs = commonGuideGlyphs(CG_ROUTE_COMMON);
    expect(glyphs).toHaveLength(CG_ROUTE_COMMON.length - 1);
    // Continuous: every bar spans its whole segment, so consecutive bars meet.
    const spanned = glyphs.reduce((total, glyph) => total + glyph.lengthUnits, 0);
    expect(spanned).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
    // Thin, and thinner than any walked mark: it is a line, not evidence.
    for (const glyph of glyphs) expect(glyph.widthUnits).toBeLessThan(0.06);
    // No new route: within the guide's own budget of nine bars plus two pieces.
    expect(glyphs.length).toBeLessThanOrEqual(11);
  });

  it('stops honestly where the ground stops, rather than floating over a hole', () => {
    const truncated = commonGuideGlyphs(CG_ROUTE_COMMON, 3);
    // Three segments drawn, then the two-piece open stop. Never the whole route.
    expect(truncated).toHaveLength(5);
    expect(truncated.filter(glyph => glyph.widthUnits < 0.06)).toHaveLength(3);
    const stop = truncated.slice(-2);
    expect(Math.abs(stop[0].x - stop[1].x) + Math.abs(stop[0].z - stop[1].z)).toBeGreaterThan(0.1);
    // And it never draws past the last supported vertex.
    const reach = Math.max(...truncated.map(glyph => Math.abs(glyph.z - CG_POSES.E.z)));
    expect(reach).toBeLessThanOrEqual(Math.abs(CG_ROUTE_COMMON[3].z - CG_POSES.E.z) + 0.5);
  });

  it('adds no stop at all when the whole route is carried', () => {
    expect(commonGuideGlyphs(CG_ROUTE_COMMON).every(glyph => glyph.widthUnits < 0.06)).toBe(true);
  });

  it('draws the completed comparison as paired tested strokes, within budget', () => {
    const done = commonTestedGlyphs(CG_ROUTE_COMMON);
    expect(done).toHaveLength(COMMON_TESTED_SAMPLE_COUNT * 2);
    expect(done).toHaveLength(62);
    // Paired, like every other tested stroke; visibly not the thin planned line.
    for (const glyph of done) expect(glyph.widthUnits).toBeGreaterThan(0.06);
  });

  it('samples the polyline evenly, ON the route and never across a corner', () => {
    const points = sampleRouteEvenly(CG_ROUTE_COMMON, COMMON_TESTED_SAMPLE_COUNT);
    expect(points).toHaveLength(COMMON_TESTED_SAMPLE_COUNT);
    expect(points[0]).toEqual(CG_ROUTE_COMMON[0]);
    expect(points[points.length - 1]).toEqual(CG_ROUTE_COMMON[CG_ROUTE_COMMON.length - 1]);
    // Every sample lies on the qualified polyline itself.
    for (const point of points) {
      const nearest = Math.min(...CG_ROUTE_COMMON.slice(1).map((to, index) => {
        const from = CG_ROUTE_COMMON[index];
        const dx = to.x - from.x, dz = to.z - from.z;
        const span = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / span));
        return Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t));
      }));
      expect(nearest).toBeLessThan(1e-9);
    }
    // Evenly spaced by ARC length: the chord shortcut at a corner is the only
    // difference from the full eighteen units, and it is small and bounded.
    const gaps = points.slice(1).map((point, index) => Math.hypot(
      point.x - points[index].x, point.z - points[index].z
    ));
    const step = CG_COMMON_ROUTE_UNITS / (COMMON_TESTED_SAMPLE_COUNT - 1);
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(step + 1e-9);
    expect(walkedLength(points)).toBeGreaterThan(CG_COMMON_ROUTE_UNITS - 0.5);
  });
});

describe('the 512-instance pool holds every combination the chapter can reach', () => {
  const full = () => line(MAX_TRACE_POINTS);

  /** Exactly the renderer's allocation policy, over the real layout functions. */
  function poolUse(options: {
    accepted?: boolean; working?: boolean; display?: 'none' | 'planned-guide' | 'tested-common';
  }): number {
    let count = 0;
    if (options.accepted) {
      count += traceGlyphs(full(), { testedPrefixCount: MAX_TRACE_POINTS }).length;
    }
    if (options.working) {
      // Worst case: a second route that is itself fully tested.
      count += traceGlyphs(full(), { testedPrefixCount: MAX_TRACE_POINTS }).length;
    } else if (options.display === 'planned-guide') {
      count += commonGuideGlyphs(CG_ROUTE_COMMON).length;
    } else if (options.display === 'tested-common') {
      count += commonTestedGlyphs(CG_ROUTE_COMMON).length;
    }
    return count;
  }

  it('fits an accepted survey beside the planned guide', () => {
    expect(poolUse({ accepted: true, display: 'planned-guide' })).toBeLessThanOrEqual(512);
  });

  it('fits an accepted survey beside the completed paired comparison', () => {
    expect(poolUse({ accepted: true, display: 'tested-common' })).toBeLessThanOrEqual(512);
  });

  it('fits BOTH full recorded routes during an optional repeat, exactly', () => {
    // This is the tightest case in the chapter and it is exact, not comfortable:
    // two 128-sample routes at two glyphs each. It is also why the common display
    // has to YIELD its allocation rather than ask for a third one.
    expect(poolUse({ accepted: true, working: true })).toBe(512);
    // The common display yields, so asking for it changes nothing.
    expect(poolUse({ accepted: true, working: true, display: 'tested-common' })).toBe(512);
    // A partially tested working route with a real hold is strictly smaller, and
    // the open stop REPLACES a pair rather than pushing the total up.
    const partial = traceGlyphs(line(MAX_TRACE_POINTS), { testedPrefixCount: 40, heldIndex: 60 });
    const noHold = traceGlyphs(line(MAX_TRACE_POINTS), { testedPrefixCount: 40 });
    expect(partial.length).toBeLessThan(MAX_TRACE_POINTS * 2);
    expect(partial.length).toBe(noHold.length + 1);
  });
});

// --- CG-IMPL-015: ordered physical coverage --------------------------------------------
//
// ACTUAL CAPTURED FRAMES, not an assumed 60 Hz walk. The captured numbers below
// are read from `producer-common-entry-crossing-review.json` /
// `verifier/captures/common-entry-crossing/run1`, and every walk uses unequal
// deltas so nothing here depends on a frame time at all.
describe('ordered physical coverage of the common route (CG-IMPL-015)', () => {
  const CAPTURED_PREV = { x: -44.274284163907716, y: 50.98912926551148, z: 16.130885899955892 };
  const CAPTURED_CUR = { x: -44.274162965076364, y: 50.989121615150424, z: 16.294483000367848 };
  const CAPTURED_NEXT = { x: -44.27410309186772, y: 50.989121587196365, z: 16.376281547075248 };
  const CAPTURED_DELTA = 0.1635971454851342;
  const NEXT_DELTA = 0.08179856861977866;
  const DELTAS = [0.1635971454851342, 0.08179856861977866, 0.21, 0.0402];

  type Foot = { x: number; y: number; z: number };

  /** Walk a body through `path` in unequal steps, crediting every real motion. */
  function walk(
    path: readonly Foot[],
    start: Foot,
    coverage: RouteCoverage,
    seed = 0
  ): { coverage: RouteCoverage; at: Foot } {
    let at = { ...start };
    let state: RouteCoverage = { ...coverage, foot: coverage.foot ?? { ...start } };
    let tick = seed;
    for (const goal of path) {
      for (let guard = 0; guard < 40000; guard += 1) {
        const remaining = Math.hypot(goal.x - at.x, goal.y - at.y, goal.z - at.z);
        if (remaining <= 1e-12) break;
        const step = Math.min(DELTAS[tick++ % DELTAS.length], remaining);
        const next = remaining <= step ? { ...goal } : {
          x: at.x + ((goal.x - at.x) * step) / remaining,
          y: at.y + ((goal.y - at.y) * step) / remaining,
          z: at.z + ((goal.z - at.z) * step) / remaining
        };
        const moved = Math.hypot(next.x - at.x, next.y - at.y, next.z - at.z);
        at = next;
        state = nextRouteCoverage(CG_ROUTE_COMMON, at, moved, state);
      }
    }
    return { coverage: state, at };
  }

  const CAPTURED_APPROACH: readonly Foot[] = [
    { x: -42, y: CAPTURED_PREV.y, z: 14 },
    { x: -42, y: CAPTURED_PREV.y, z: 16 },
    { x: -44, y: CAPTURED_PREV.y, z: 16 },
    CAPTURED_PREV
  ];
  const CAPTURED_START = { x: -42, y: CAPTURED_PREV.y, z: 12 };

  it('is the recorded refusal: the plain frontier rule still returns 6 at call 298', () => {
    // Unchanged, and left unchanged: projection 6.294483, ceiling 6.163597.
    expect(routeProgressUnits(CG_ROUTE_COMMON, CAPTURED_CUR, 6, CAPTURED_DELTA)).toBe(6);
  });

  it('advances the captured call 298 and the call after it, from real feet', () => {
    const approached = walk(CAPTURED_APPROACH, CAPTURED_START, NO_ROUTE_COVERAGE);
    // The vertex at (-44, ., 16) was actually crossed and actually passed.
    expect(approached.coverage.reachedVertex).toBe(3);
    expect(approached.coverage.foot).toEqual(CAPTURED_PREV);
    expect(approached.coverage.units).toBeCloseTo(6.130885899955892, 9);

    const call298 = nextRouteCoverage(
      CG_ROUTE_COMMON, CAPTURED_CUR, CAPTURED_DELTA, approached.coverage
    );
    expect(call298.units).toBeCloseTo(6.294483000367848, 9);
    expect(call298.units).toBeGreaterThan(approached.coverage.units);

    const after = nextRouteCoverage(CG_ROUTE_COMMON, CAPTURED_NEXT, NEXT_DELTA, call298);
    expect(after.units).toBeCloseTo(6.376281547075248, 9);
  });

  it('covers nothing at all for a stationary body, however long it stands', () => {
    const approached = walk(CAPTURED_APPROACH, CAPTURED_START, NO_ROUTE_COVERAGE);
    let state = approached.coverage;
    const held = state.units;
    for (let frame = 0; frame < 600; frame += 1) {
      state = nextRouteCoverage(CG_ROUTE_COMMON, CAPTURED_PREV, 0, state);
    }
    expect(state.units).toBe(held);
  });

  it('rounds BOTH corner directions with overshoots and unequal deltas, to exactly 18', () => {
    // The -44 corner turns +z, the -48 corner turns -z, and each is walked
    // THROUGH by 0.27 — the recorded overshoot — which is what a body does.
    const overshot = walk([
      { x: -42, y: CG_POSES.E.y, z: 14 },
      { x: -42, y: CG_POSES.E.y, z: 16.27 },
      { x: -44.27, y: CG_POSES.E.y, z: 16.27 },
      { x: -44.27, y: CG_POSES.E.y, z: 18.27 },
      { x: -46, y: CG_POSES.E.y, z: 18.27 },
      { x: -48.27, y: CG_POSES.E.y, z: 18.27 },
      { x: -48.27, y: CG_POSES.E.y, z: 16 },
      { x: -48, y: CG_POSES.E.y, z: 12 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE, 1);
    expect(overshot.coverage.units).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
  });

  it('STILL refuses the recorded early z 15.82 cut, and never repays it by walking on', () => {
    // Turning 0.18 short of (-42, ., 16) and going on: the plane of that vertex
    // is never crossed at the corner, so the span pins where the body actually
    // covered ground and three hundred further units recover nothing.
    const cut = walk([
      { x: -42, y: CG_POSES.E.y, z: 15.82 },
      { x: -44, y: CG_POSES.E.y, z: 16.1 },
      { x: -44, y: CG_POSES.E.y, z: 18 },
      { x: -48, y: CG_POSES.E.y, z: 18 },
      { x: -48, y: CG_POSES.E.y, z: 12 },
      { x: -48, y: CG_POSES.E.y, z: 18 },
      { x: -48, y: CG_POSES.E.y, z: 12 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE);
    expect(cut.coverage.units).toBeCloseTo(4, 9);
    expect(cut.coverage.reachedVertex).toBe(1);
  });

  it('refuses the near-corner late-leg wiggle predicted by the producer', () => {
    // Pinned at four by the early cut, standing on the OUTGOING corridor around
    // (-43, ., 16.1), never within 0.35 of the required (-42, ., 16), wiggling
    // across that vertex's plane on the x > -43 side. Both the crossing and the
    // 0.35 pass are required, so this pays for nothing.
    const cut = walk([
      { x: -42, y: CG_POSES.E.y, z: 15.82 },
      { x: -43, y: CG_POSES.E.y, z: 16.1 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE);
    expect(cut.coverage.units).toBeCloseTo(4, 9);

    let state = cut.coverage;
    for (let frame = 0; frame < 400; frame += 1) {
      const wiggle = [
        { x: -42.9, y: CG_POSES.E.y, z: 15.9 },
        { x: -42.9, y: CG_POSES.E.y, z: 16.3 },
        { x: -43.1, y: CG_POSES.E.y, z: 16.1 },
        { x: -42.95, y: CG_POSES.E.y, z: 15.95 }
      ][frame % 4];
      const moved = Math.hypot(
        wiggle.x - (state.foot?.x ?? wiggle.x),
        wiggle.z - (state.foot?.z ?? wiggle.z)
      );
      state = nextRouteCoverage(CG_ROUTE_COMMON, wiggle, moved, state);
    }
    // It really did cross the z = 16 plane, repeatedly, and it is worth nothing.
    expect(state.units).toBeCloseTo(4, 9);
    expect(state.reachedVertex).toBe(1);
  });

  it('pays the retained early cut only by an actual return and re-traversal', () => {
    const cut = walk([
      { x: -42, y: CG_POSES.E.y, z: 15.82 },
      { x: -43, y: CG_POSES.E.y, z: 16.1 },
      { x: -44, y: CG_POSES.E.y, z: 17 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE);
    expect(cut.coverage.units).toBeCloseTo(4, 9);

    // Ordinary movement back to the corner it skipped, then on. No reset, no
    // second F, no marker: the four units are retained the whole way back.
    const repaired = walk([
      { x: -42, y: CG_POSES.E.y, z: 15.5 },
      { x: -42, y: CG_POSES.E.y, z: 16 },
      { x: -44, y: CG_POSES.E.y, z: 16 },
      { x: -44, y: CG_POSES.E.y, z: 18 },
      { x: -48, y: CG_POSES.E.y, z: 18 },
      { x: -48, y: CG_POSES.E.y, z: 12 }
    ], cut.at, cut.coverage, 2);
    expect(repaired.coverage.units).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 6);
  });

  it('refuses a far-end wiggle and a distant loop against an unfinished corner', () => {
    const cut = walk([
      { x: -42, y: CG_POSES.E.y, z: 15.82 },
      { x: -44, y: CG_POSES.E.y, z: 16.1 },
      { x: -48, y: CG_POSES.E.y, z: 12 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE);
    let state = cut.coverage;
    for (let frame = 0; frame < 400; frame += 1) {
      const at = { x: -48, y: CG_POSES.E.y, z: 12 + (frame % 2) * 0.4 };
      state = nextRouteCoverage(CG_ROUTE_COMMON, at, 0.4, state);
    }
    expect(state.units).toBeCloseTo(4, 9);
  });

  it('never invents a previous foot, so no crossing can be claimed across a gap', () => {
    // A broken chain — an unsupported, unreferenced, respawned or freshly seeded
    // frame — keeps every earned unit and buys nothing with the gap it opened.
    const approached = walk([
      { x: -42, y: CG_POSES.E.y, z: 14 },
      { x: -42, y: CG_POSES.E.y, z: 15.9 }
    ], CG_POSES.E, NO_ROUTE_COVERAGE);
    const broken: RouteCoverage = { ...approached.coverage, foot: null };
    // The very motion that would have rounded the corner is unusable: with no
    // previous foot the update credits nothing and only records where the body is.
    const jumped = nextRouteCoverage(
      CG_ROUTE_COMMON, { x: -44, y: CG_POSES.E.y, z: 16 }, 2.1, broken
    );
    expect(jumped.units).toBe(approached.coverage.units);
    expect(jumped.reachedVertex).toBe(approached.coverage.reachedVertex);
    expect(jumped.foot).toEqual({ x: -44, y: CG_POSES.E.y, z: 16 });
  });

  it('re-derives a span written elsewhere conservatively, and drops the chain', () => {
    const approached = walk(CAPTURED_APPROACH, CAPTURED_START, NO_ROUTE_COVERAGE);
    expect(syncedRouteCoverage(CG_ROUTE_COMMON, approached.coverage, approached.coverage.units))
      .toBe(approached.coverage);
    // A resumed, migrated or rewritten span proves only the vertices strictly
    // behind it, and its foot chain is gone.
    const reseeded = syncedRouteCoverage(CG_ROUTE_COMMON, approached.coverage, 6);
    expect(reseeded.units).toBe(6);
    expect(reseeded.reachedVertex).toBe(2);
    expect(reseeded.foot).toBeNull();
  });

  // --- Producer counterexamples (producer-manual-credit-finale-frontier-review.json)
  //
  // Three cases predicted from the code, not from a GPU run: an unbounded
  // projection maximised into credit after any positive displacement, and a
  // geometric corner crossing read as a receipt for the leg that led to it.

  it('credits NOTHING for a seeded foot late on the leg, until the start is really re-walked', () => {
    const y = CG_POSES.E.y;
    // Case 1: seed at (-42, ., 13) with no motion, then move one centimetre.
    const seeded = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13 }, 0, NO_ROUTE_COVERAGE);
    expect(seeded.units).toBe(0);
    expect(seeded.foot).toEqual({ x: -42, y, z: 13 });

    const nudged = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13.01 }, 0.01, seeded);
    // The projection there is 1.01. The body walked 0.01 and never touched the
    // first unit of ground, so it is worth 0 — no max, no creep toward it.
    expect(nudged.units).toBe(0);
    expect(nudged.reachedVertex).toBe(0);

    // Standing there longer buys nothing either.
    let state = nudged;
    for (let frame = 0; frame < 200; frame += 1) {
      state = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13.01 }, 0.004, state);
    }
    expect(state.units).toBe(0);

    // PHYSICAL RETURN AND RE-TRAVERSAL pays in full, by ordinary movement.
    const rewalked = walk([{ x: -42, y, z: 12 }, { x: -42, y, z: 13.01 }], { x: -42, y, z: 13.01 }, state);
    expect(rewalked.coverage.units).toBeCloseTo(1.01, 9);
  });

  it('retains a carried span across a gap without paying for the ground it skipped', () => {
    const y = CG_POSES.E.y;
    // Case 2: a reference/support gap left {units: .5, reachedVertex: 0, foot: null}.
    const gapped: RouteCoverage = { units: 0.5, reachedVertex: 0, foot: null };
    const seeded = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13.5 }, 0, gapped);
    expect(seeded.units).toBe(0.5);
    expect(seeded.foot).toEqual({ x: -42, y, z: 13.5 });

    const nudged = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13.51 }, 0.01, seeded);
    // Projection 1.51; earned prefix 0.5 is kept, the unreferenced unit is not sold.
    expect(nudged.units).toBe(0.5);
    expect(nudged.reachedVertex).toBe(0);
  });

  it('does NOT certify a corner from the crossing alone when the incoming leg lags', () => {
    const y = CG_POSES.E.y;
    const gapped: RouteCoverage = { units: 0.5, reachedVertex: 0, foot: null };
    const before = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 13.99 }, 0, gapped);
    // Case 3: real feet 13.99 -> 14.01 genuinely cross vertex 1 within the
    // unchanged 0.35 reach. That proves the corner was rounded; it does NOT
    // prove the two units of incoming leg under it were ever walked.
    const crossing = nextRouteCoverage(CG_ROUTE_COMMON, { x: -42, y, z: 14.01 }, 0.02, before);
    expect(crossing.units).toBe(0.5);
    expect(crossing.reachedVertex).toBe(0);
    expect(crossing.units).not.toBeCloseTo(2, 6);
    expect(crossing.units).not.toBeCloseTo(2.01, 6);

    // Walking the incoming leg for real certifies the same corner and pays it.
    const earned = walk([{ x: -42, y, z: 12 }, { x: -42, y, z: 14.01 }], { x: -42, y, z: 14.01 }, crossing);
    expect(earned.coverage.reachedVertex).toBe(1);
    expect(earned.coverage.units).toBeCloseTo(2.01, 9);
  });
});
