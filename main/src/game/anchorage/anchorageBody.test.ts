import { describe, expect, it } from 'vitest';
import { MAX_COMPANION_DISTANCE_FROM_PRIMARY } from '../starSystem.ts';
import {
  BERTH_ENVELOPE,
  CORRIDOR_HALF_ANGLE,
  DOCK_SPEED_LIMIT,
  SCAN_RANGE,
  approachHold,
  evaluateApproach,
  offAxisAngle
} from './anchorageApproach.ts';
import {
  anchorageBody,
  anchorageFrame,
  stationLocalToSystem,
  systemAnchorageCount,
  systemAnchorages,
  systemToStationLocal
} from './anchorageBody.ts';
import { anchorageDockRoute, buildAnchorageDescriptor } from './anchorageDescriptor.ts';
import { buildAnchorageGraph } from './anchorageLayout.ts';
import type { Vec3Tuple } from '../starSystem.ts';

const ADDRESS = { system: { x: -19, y: -17 }, index: 0 };
const body = anchorageBody(ADDRESS);

function add(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(v: Vec3Tuple, k: number): Vec3Tuple {
  return [v[0] * k, v[1] * k, v[2] * k];
}
function distance(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('anchorage as a system body', () => {
  it('sits beyond the planet band so approach reads as deep space', () => {
    const radius = Math.hypot(...body.systemPosition);
    expect(radius).toBeGreaterThan(MAX_COMPANION_DISTANCE_FROM_PRIMARY);
  });

  it('is deterministic from its address', () => {
    expect(anchorageBody(ADDRESS)).toEqual(body);
  });

  it('agrees with the descriptor on where the station is', () => {
    expect(buildAnchorageDescriptor(ADDRESS).systemPosition).toEqual(body.systemPosition);
  });

  it('populates most systems with nothing at all', () => {
    let withStation = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (systemAnchorageCount({ x: 0, y: 0 }, seed * 2_654_435_761 >>> 0) > 0) withStation++;
    }
    // A station in every system is scenery; the point is that it is a destination.
    expect(withStation / 400).toBeLessThan(0.5);
    expect(withStation).toBeGreaterThan(0);
  });

  it('gives every anchorage in a system a distinct id and place', () => {
    // Find a seed that actually produces two, rather than asserting on one that may not.
    let pair: ReturnType<typeof systemAnchorages> = [];
    for (let seed = 1; seed <= 4_000 && pair.length < 2; seed++) {
      pair = systemAnchorages({ x: 3, y: 4 }, (seed * 2_246_822_519) >>> 0);
    }
    expect(pair.length).toBe(2);
    expect(pair[0].worldId).not.toBe(pair[1].worldId);
    expect(distance(pair[0].systemPosition, pair[1].systemPosition)).toBeGreaterThan(100);
  });

  it('does not lie along a world axis', () => {
    // A station squared up to the world axes reads as a level asset.
    const axis = body.approachAxis;
    const alignment = Math.max(Math.abs(axis[0]), Math.abs(axis[1]), Math.abs(axis[2]));
    expect(alignment).toBeLessThan(0.999);
  });

  it('has a unit approach axis', () => {
    expect(Math.hypot(...body.approachAxis)).toBeCloseTo(1, 9);
  });
});

describe('station frame', () => {
  const frame = anchorageFrame(buildAnchorageGraph(body.seed));

  it('recentres the graph on its own middle', () => {
    // Origin sits inside the box, and the half-extents actually span it.
    expect(frame.half[0]).toBeGreaterThan(300);
    expect(frame.half[1]).toBeGreaterThan(50);
    expect(frame.half[2]).toBeGreaterThan(50);
  });

  it('round-trips station space through system space', () => {
    for (const local of [[0, 0, 0], [120, -30, 44], [-frame.half[0], 8, -12]] as Vec3Tuple[]) {
      const back = systemToStationLocal(body, stationLocalToSystem(body, local));
      expect(back[0]).toBeCloseTo(local[0], 6);
      expect(back[1]).toBeCloseTo(local[1], 6);
      expect(back[2]).toBeCloseTo(local[2], 6);
    }
  });

  it('encloses the whole station in its bound radius', () => {
    expect(body.boundRadius).toBeGreaterThan(Math.hypot(...frame.half));
  });
});

describe('the berth lines up with the airlock', () => {
  it('sits off the dock end of the station, on the dock mouth axis', () => {
    // The single claim this whole file exists to protect: a ship parks in front of
    // the door the player walks out of.
    //
    // Note what is NOT asserted — that the berth is near local (0, 0). It is not,
    // and requiring it was the bug: the bounding box is dominated by the sealed
    // volume at the far end, whose height dwarfs the dock's, so the box centre sits
    // in the roof of a different district. The berth belongs on the apron's axis.
    const local = systemToStationLocal(body, body.berth);
    expect(local[0]).toBeLessThan(-body.frame.half[0]);

    const graph = buildAnchorageGraph(body.seed);
    const apron = graph.cells.find(cell => cell.kind === 'apron')!;
    const frame = anchorageFrame(graph);
    expect(local[1]).toBeCloseTo((apron.min[1] + apron.max[1]) / 2 - frame.origin[1], 4);
    expect(local[2]).toBeCloseTo((apron.min[2] + apron.max[2]) / 2 - frame.origin[2], 4);
    expect(local).toEqual(
      expect.arrayContaining([expect.closeTo(body.berthLocal[0], 4)])
    );
  });

  it('agrees with itself about where the berth is in both spaces', () => {
    const local = systemToStationLocal(body, body.berth);
    for (const axis of [0, 1, 2] as const) {
      expect(local[axis]).toBeCloseTo(body.berthLocal[axis], 4);
    }
  });

  it('is on the same end of the spine as the interior dock route', () => {
    const descriptor = buildAnchorageDescriptor(ADDRESS);
    const frame = anchorageFrame(descriptor.graph);
    const lock = anchorageDockRoute(descriptor).lock;
    const deck = anchorageDockRoute(descriptor).deck;
    // In graph space the lock is at the low-X end and you walk toward +X, which is
    // the direction a ship is travelling on final.
    expect(lock[0] - frame.origin[0]).toBeLessThan(0);
    expect(deck[0]).toBeGreaterThan(lock[0]);
  });

  it('puts the approach axis pointing into the dock mouth', () => {
    // Standing at the berth and moving along the approach axis should reduce the
    // distance to the station centre.
    const ahead = add(body.berth, scale(body.approachAxis, 50));
    expect(distance(ahead, body.systemPosition)).toBeLessThan(
      distance(body.berth, body.systemPosition)
    );
  });
});

describe('approach corridor', () => {
  const still: Vec3Tuple = [0, 0, 0];

  it('reports nothing at all beyond scan range', () => {
    const far = approachHold(body, SCAN_RANGE + 500);
    const readout = evaluateApproach(body, { position: far, velocity: still });
    expect(readout.phase).toBe('unknown');
    expect(readout.canDock).toBe(false);
    expect(readout.advisory).not.toBe('');
  });

  it('picks the station up on instruments inside scan range', () => {
    const readout = evaluateApproach(body, {
      position: approachHold(body, SCAN_RANGE - 400),
      velocity: still
    });
    expect(readout.phase).toBe('detected');
    expect(readout.advisory).toMatch(/anchorage/);
  });

  it('measures zero off-axis error dead on the corridor', () => {
    expect(offAxisAngle(body, approachHold(body, 600))).toBeCloseTo(0, 6);
  });

  it('refuses an approach from the side, however close', () => {
    // Perpendicular to the corridor, right at the berth.
    const lateral = stationLocalToSystem(body, [
      -body.frame.half[0] - 210,
      0,
      BERTH_ENVELOPE * 0.7
    ]);
    const readout = evaluateApproach(body, { position: lateral, velocity: still });
    expect(readout.insideCorridor).toBe(false);
    expect(readout.canDock).toBe(false);
    expect(readout.blocker).toBe('alignment');
  });

  it('refuses a correct line flown too fast', () => {
    const position = approachHold(body, BERTH_ENVELOPE * 0.5);
    const readout = evaluateApproach(body, {
      position,
      velocity: scale(body.approachAxis, DOCK_SPEED_LIMIT + 20)
    });
    expect(readout.insideCorridor).toBe(true);
    expect(readout.canDock).toBe(false);
    expect(readout.blocker).toBe('speed');
    expect(readout.advisory).toMatch(/too fast/);
  });

  it('clears a slow approach on the corridor', () => {
    const readout = evaluateApproach(body, {
      position: approachHold(body, BERTH_ENVELOPE * 0.5),
      velocity: scale(body.approachAxis, DOCK_SPEED_LIMIT * 0.5)
    });
    expect(readout.phase).toBe('cleared');
    expect(readout.canDock).toBe(true);
    expect(readout.blocker).toBeNull();
  });

  it('does not read flying past at speed as a fast approach', () => {
    // Velocity perpendicular to the line to the berth: closing speed is ~zero.
    const position = approachHold(body, BERTH_ENVELOPE * 0.5);
    const sideways = stationLocalToSystem(body, [0, 1, 0]);
    const lateralVelocity: Vec3Tuple = [
      (sideways[0] - body.systemPosition[0]) * 200,
      (sideways[1] - body.systemPosition[1]) * 200,
      (sideways[2] - body.systemPosition[2]) * 200
    ];
    const readout = evaluateApproach(body, { position, velocity: lateralVelocity });
    expect(Math.abs(readout.closingSpeed)).toBeLessThan(1);
    expect(readout.canDock).toBe(true);
  });

  it('walks a full approach through every phase in order', () => {
    const seen: string[] = [];
    for (let out = SCAN_RANGE + 400; out >= 10; out -= 40) {
      const readout = evaluateApproach(body, {
        position: approachHold(body, out),
        velocity: scale(body.approachAxis, 12)
      });
      if (seen[seen.length - 1] !== readout.phase) seen.push(readout.phase);
    }
    expect(seen).toEqual(['unknown', 'detected', 'approach', 'cleared']);
  });

  it('never returns an empty advisory at any point on that approach', () => {
    for (let out = SCAN_RANGE + 400; out >= 10; out -= 60) {
      const readout = evaluateApproach(body, {
        position: approachHold(body, out),
        velocity: scale(body.approachAxis, 12)
      });
      expect(readout.advisory.trim().length).toBeGreaterThan(4);
    }
  });

  it('clears a ship sitting exactly on the berth', () => {
    // The apex case. A true cone apex at the berth makes `-dx` negative zero, and
    // atan2(0, -0) is pi — so the one position a perfect approach ends at reported
    // a hundred and eighty degrees off. It is also exactly where a ship that has
    // just undocked is sitting.
    const readout = evaluateApproach(body, { position: body.berth, velocity: still });
    expect(readout.offAxis).toBeCloseTo(0, 6);
    expect(readout.insideCorridor).toBe(true);
    expect(readout.canDock).toBe(true);
  });

  it('clears a ship that has drifted just past the berth into the mouth', () => {
    // Past the berth means inside the dock, which is the most aligned a ship can
    // be — not a hundred and eighty degrees out.
    const inside = stationLocalToSystem(body, [
      body.berthLocal[0] + 40,
      body.berthLocal[1],
      body.berthLocal[2]
    ]);
    const readout = evaluateApproach(body, { position: inside, velocity: still });
    expect(readout.insideCorridor).toBe(true);
  });

  it('keeps the corridor tolerance usable rather than an exam', () => {
    // A ship a corridor-half-angle off at range is still inside; the speed gate is
    // the one meant to ask something of the player.
    expect(CORRIDOR_HALF_ANGLE).toBeGreaterThan(0.3);
    expect(BERTH_ENVELOPE).toBeGreaterThan(40);
  });
});
