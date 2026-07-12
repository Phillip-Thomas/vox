import { describe, expect, it } from 'vitest';
import {
  getAuditWorkerPath,
  getPondPose,
  getStorySidePlane,
  getWreckRelayPose,
  isStoryWorld,
  STORY_COORDINATE,
  STORY_SEED
} from './storyWorld.ts';
import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import { coordinateToSeed } from '../../utils/worldCoordinates.ts';

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
