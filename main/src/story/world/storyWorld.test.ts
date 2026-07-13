import { describe, expect, it } from 'vitest';
import {
  getAuditWorkerPath,
  getDebrisPoses,
  getNavWaypointPoses,
  getPondPose,
  getSignalMesaPose,
  getSignalMesaSummit,
  getStorySidePlane,
  getSupplyPodPoses,
  getWreckRelayPose,
  isStoryWorld,
  STORY_COORDINATE,
  STORY_SEED
} from './storyWorld.ts';
import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import { coordinateToSeed } from '../../utils/worldCoordinates.ts';
import { taskRowMoveIntent, STORY_TASK_ROW_DEPTH_BAND } from '../taskRowNavigation.ts';
import { SUPPLY_POD_COUNT } from '../supplyPods.ts';
import { NAV_WAYPOINT_COUNT } from '../navWaypoints.ts';
import { mesaBlockLayout } from './SignalMesa.tsx';
import { findTopFaceSurfaceVoxel } from '../../utils/worldArrival.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';

describe('storyWorld', () => {
  it('pins a verdant planet (trees/grass/biofiber/stone, no hazards)', () => {
    const seed = coordinateToSeed(STORY_COORDINATE.x, STORY_COORDINATE.y);
    expect(archetypeForSeed(seed)).toBe('verdant');
  });

  it('the pin is stable (art direction + saves depend on this exact coordinate)', () => {
    // If a generation-schema change legitimately moves the scan result, bump the
    // expectation AND the persistence schema so stale story saves are dropped.
    expect(STORY_COORDINATE).toEqual(findExpected());
    function findExpected() {
      // mirror of the ring scan, kept independent enough to catch accidental edits
      for (let radius = 1; radius <= 100; radius++) {
        for (let x = -radius; x <= radius; x++) {
          const ys = x === -radius || x === radius
            ? Array.from({ length: radius * 2 + 1 }, (_, i) => i - radius)
            : [-radius, radius];
          for (const y of ys) {
            if (archetypeForSeed(coordinateToSeed(x, y)) === 'verdant') return { x, y };
          }
        }
      }
      return { x: 0, y: 0 };
    }
  });

  it('isStoryWorld matches only the pinned coordinate', () => {
    expect(isStoryWorld(STORY_COORDINATE)).toBe(true);
    expect(isStoryWorld({ x: STORY_COORDINATE.x + 1, y: STORY_COORDINATE.y })).toBe(false);
  });

  it('the pinned world keeps a pond within the first day\'s walk (ch3-thirst depends on it)', () => {
    const pond = getPondPose(50, STORY_SEED);
    expect(pond).not.toBeNull();
    const relay = getWreckRelayPose(50, STORY_SEED);
    const walk = pond!.surface.distanceTo(relay.position);
    // Close enough to find by following the seek cue, far enough that the
    // klaxon sprint has ground to spend stamina on.
    expect(walk).toBeGreaterThan(10);
    expect(walk).toBeLessThan(130);
    // The dive (ch4, later) wants a floor below the surface where possible;
    // depth ≥ 1 is the hard floor for the drink itself.
    expect(pond!.depth).toBeGreaterThanOrEqual(1);
  });

  it('the raster side plane is strictly world-axis-aligned (true 2D elevation)', () => {
    const plane = getStorySidePlane(50, STORY_SEED);
    const t = plane.travelAxis;
    const d = plane.depthAxis;
    // travel is exactly ±X or ±Z — one component ±1, the others 0
    const travelComponents = [Math.abs(t.x), Math.abs(t.y), Math.abs(t.z)].sort();
    expect(travelComponents).toEqual([0, 0, 1]);
    expect(t.y).toBe(0);
    // depth is the perpendicular horizontal axis; up is grid +Y
    expect(Math.abs(t.dot(d))).toBeLessThan(1e-9);
    expect(plane.up.toArray()).toEqual([0, 1, 0]);
    expect(d.y).toBe(0);
  });

  it('keeps every task required to unlock NAV VIEW on the one 2D terrain row', () => {
    const plane = getStorySidePlane(50, STORY_SEED);
    const requiredTargets = [
      ...getDebrisPoses(50, STORY_SEED).map(p => ({ kind: 'debris', position: p.position })),
      ...getSupplyPodPoses(50, STORY_SEED).map(p => ({ kind: 'supply', position: p.position }))
    ];

    expect(getSupplyPodPoses(50, STORY_SEED)).toHaveLength(SUPPLY_POD_COUNT);
    expect(getNavWaypointPoses(50, STORY_SEED)).toHaveLength(NAV_WAYPOINT_COUNT);
    expect(STORY_TASK_ROW_DEPTH_BAND).toBe(0);
    for (const target of requiredTargets) {
      const depth = target.position.clone().sub(plane.origin).dot(plane.depthAxis);
      expect(depth, `${target.kind} left the task row`).toBeCloseTo(0, 8);
    }
  });

  it('keeps the complete pre-NAV work corridor dry and level, not merely coplanar', () => {
    const size = 50;
    const arrival = findTopFaceSurfaceVoxel(size, STORY_SEED);
    const plane = getStorySidePlane(size, STORY_SEED);
    const generator = getWorldGen(size, STORY_SEED).generator;

    // All authored debris and pods lie within this inclusive interval. Checking
    // every intervening column catches submerged endpoints, shoreline gaps, and
    // cliffs that a target-only depth assertion cannot see.
    for (let offset = -14; offset <= 14; offset++) {
      const x = arrival.x + Math.round(plane.travelAxis.x * offset);
      const z = arrival.z + Math.round(plane.travelAxis.z * offset);
      const support = findTopFaceSurfaceVoxel(size, STORY_SEED, { x, z });
      expect(support.y, `work row changed height at offset ${offset}`).toBe(arrival.y);
      expect(
        generator.isWaterVoxel(x, support.y + 1, z),
        `work row entered water at offset ${offset}`
      ).toBe(false);
      expect(
        generator.isWaterVoxel(x, support.y + 2, z),
        `work row had submerged headroom at offset ${offset}`
      ).toBe(false);
    }
  });

  it('the movie route reaches every pre-NAV target with A/D only and no jetpack intent', () => {
    const plane = getStorySidePlane(50, STORY_SEED);
    const route = [
      ...getDebrisPoses(50, STORY_SEED),
      ...getSupplyPodPoses(50, STORY_SEED)
    ];
    const simulatedPlayer = plane.origin.clone();

    for (const target of route) {
      // The authored route intentionally revisits both sides of the crash; 400
      // quarter-unit ticks covers the widest end-to-end recovery leg.
      for (let step = 0; step < 400; step++) {
        const intent = taskRowMoveIntent(plane, simulatedPlayer, target.position);
        expect(intent.forward).toBe(false);
        expect(intent.backward).toBe(false);
        expect(intent.jump).toBe(false);
        expect(intent.crossRowOffset).toBeCloseTo(0, 8);
        if (!intent.left && !intent.right) break;
        simulatedPlayer.addScaledVector(plane.travelAxis, intent.right ? 0.25 : -0.25);
      }
      const remaining = target.position.clone().sub(simulatedPlayer).dot(plane.travelAxis);
      expect(Math.abs(remaining)).toBeLessThanOrEqual(0.4);
    }
  });

  it('uses the newly unlocked second axis for NAV fixes and the signal mesa', () => {
    const plane = getStorySidePlane(50, STORY_SEED);
    const postReveal = [
      ...getNavWaypointPoses(50, STORY_SEED),
      getSignalMesaPose(50, STORY_SEED),
      getSignalMesaSummit(50, STORY_SEED)
    ];
    const depths = postReveal.map(target =>
      target.position.clone().sub(plane.origin).dot(plane.depthAxis)
    );

    expect(depths.some(depth => Math.abs(depth) > 1)).toBe(true);
    expect(Math.abs(depths[depths.length - 1] ?? 0)).toBeGreaterThan(1);
  });

  it('the post-NAV mesa approach is a contiguous one-unit staircase', () => {
    const blocks = mesaBlockLayout();
    const topAt = (x: number) => Math.max(
      ...blocks.filter(block => block.x === x && block.z === 0).map(block => block.y + 1)
    );
    const stairTops = [-3, -2, -1, 0].map(topAt);
    expect(stairTops).toEqual([1, 2, 3, 3]);
    for (let i = 1; i < stairTops.length; i++) {
      expect(stairTops[i] - stairTops[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the arriving auditor upright to the cube face near its edge', () => {
    const path = getAuditWorkerPath(50, STORY_SEED);
    expect(path.length).toBeGreaterThan(1);
    for (const waypoint of path) {
      expect(waypoint.up.toArray()).toEqual([0, 1, 0]);
    }

    // The far waypoint is deliberately far enough across the top face that its
    // radial normal is visibly slanted. This guards the exact regression: the
    // actor's up must remain the cube-face normal, not position.normalize().
    const far = path[0];
    const radialUp = far.position.clone().normalize();
    expect(radialUp.dot(far.up)).toBeLessThan(0.95);
  });
});
