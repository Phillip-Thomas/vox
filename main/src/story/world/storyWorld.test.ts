import { describe, expect, it } from 'vitest';
import {
  AUDIT_WORKER_GROUND_CLEARANCE,
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
import { planAgentSurfaceRoute } from '../../utils/agentSurfaceNavigation.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import { DEFAULT_MOVE_SPEED } from '../../utils/surfaceControls.ts';
import { ARRIVAL } from '../storyScript.ts';
import {
  easedGroundedTravelProgress,
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute
} from '../../utils/groundedSurfaceMotion.ts';
import { AUDIT_WORKER_BOOT_SOLE_Y } from './AuditWorker.tsx';

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
    const generator = getWorldGen(50, STORY_SEED).generator;
    const surfaceCell = pond!.surface.clone().divideScalar(2).round();
    const shoreCell = pond!.shore.clone().divideScalar(2).round();
    expect(generator.isWaterVoxel(surfaceCell.x, surfaceCell.y, surfaceCell.z)).toBe(true);
    expect(generator.isWaterVoxel(shoreCell.x, shoreCell.y, shoreCell.z)).toBe(false);
    expect(generator.isWaterVoxel(shoreCell.x, shoreCell.y + 1, shoreCell.z)).toBe(false);
    expect(pond!.up.toArray()).toEqual([0, 1, 0]);
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

  it('gives the first-day agent a fully dry route to the validated pond shore', () => {
    const size = 50;
    const pond = getPondPose(size, STORY_SEED)!;
    const generator = getWorldGen(size, STORY_SEED).generator;
    const start = getWreckRelayPose(size, STORY_SEED).position;
    const route = planAgentSurfaceRoute({
      isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
    }, size, start, pond.shore, { allowJetpackCrossing: true });

    expect(route.mode).toBe('walk');
    expect(route.waterCrossing).toBeNull();
    expect(route.waypoints.length).toBeGreaterThan(1);
    for (const waypoint of route.waypoints) {
      const cell = waypoint.clone().divideScalar(2).round();
      expect(
        generator.isWaterVoxel(cell.x, cell.y, cell.z),
        `route entered water at ${cell.toArray().join(',')}`
      ).toBe(false);
    }
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

  it('gives the arriving auditor a contiguous dry and body-clear top-face route', () => {
    const size = 50;
    const radiusCells = Math.floor(size / VOXEL_SCALE);
    const generator = getWorldGen(size, STORY_SEED).generator;
    const path = getAuditWorkerPath(size, STORY_SEED);
    const supportAt = (x: number, z: number) => {
      for (let y = radiusCells; y >= 0; y--) {
        if (generator.shouldVoxelExist(x, y, z)) return y;
      }
      return null;
    };

    expect(AUDIT_WORKER_GROUND_CLEARANCE).toBeCloseTo(1.05, 8);
    expect(AUDIT_WORKER_GROUND_CLEARANCE + AUDIT_WORKER_BOOT_SOLE_Y)
      .toBeCloseTo(VOXEL_SCALE / 2, 8);
    expect(path.length).toBeGreaterThanOrEqual(2);

    const supportCells = path.map(({ position }, index) => {
      const x = Math.round(position.x / VOXEL_SCALE);
      const z = Math.round(position.z / VOXEL_SCALE);
      const y = supportAt(x, z);
      expect(y, `auditor waypoint ${index} has no top-face support at ${x},${z}`).not.toBeNull();
      const supportY = y!;

      // The support owns the top face with the same one-cell dominance margin
      // as the planner. No edge/corner waypoint may silently resolve sideways.
      expect(supportY, `auditor waypoint ${index} left the owned top face`).toBeGreaterThanOrEqual(
        Math.max(Math.abs(x), Math.abs(z)) + 1
      );
      expect(
        position.y - supportY * VOXEL_SCALE,
        `auditor waypoint ${index} lost its exact root clearance`
      ).toBeCloseTo(AUDIT_WORKER_GROUND_CLEARANCE, 8);
      expect(generator.generateBlockForPosition(x, supportY, z)).not.toBe('lava');
      expect(
        generator.isWaterVoxel(x, supportY, z),
        `auditor support flooded at waypoint ${index}`
      ).toBe(false);

      // The actor occupies the first two cells outward from his support. Both
      // must be collider-clear and dry. Generator bulges beyond the rendered
      // cube do not create colliders, matching the planner's terrain contract.
      for (let lift = 1; lift <= 2; lift++) {
        const bodyY = supportY + lift;
        const insideRenderedTerrain = Math.max(Math.abs(x), Math.abs(bodyY), Math.abs(z)) <= radiusCells;
        expect(
          insideRenderedTerrain && generator.shouldVoxelExist(x, bodyY, z),
          `auditor body blocked at waypoint ${index}, lift ${lift}`
        ).toBe(false);
        expect(
          generator.isWaterVoxel(x, bodyY, z),
          `auditor body flooded at waypoint ${index}, lift ${lift}`
        ).toBe(false);
      }
      return { x, y: supportY, z };
    });

    expect(new Set(supportCells.map(cell => `${cell.x},${cell.y},${cell.z}`)).size).toBe(path.length);
    for (let index = 1; index < supportCells.length; index++) {
      const previous = supportCells[index - 1];
      const current = supportCells[index];
      const tangentStep = Math.abs(current.x - previous.x) + Math.abs(current.z - previous.z);
      expect(tangentStep, `auditor route leg ${index - 1}->${index} is not cardinal/contiguous`).toBe(1);
      expect(
        Math.abs(current.y - previous.y),
        `auditor route leg ${index - 1}->${index} exceeds one voxel of slope`
      ).toBeLessThanOrEqual(1);
    }
  });

  it('keeps every interpolated auditor footstep dry, grounded, and below player speed', () => {
    const size = 50;
    const radiusCells = Math.floor(size / VOXEL_SCALE);
    const generator = getWorldGen(size, STORY_SEED).generator;
    const path = getAuditWorkerPath(size, STORY_SEED);
    expect(path.length).toBeGreaterThanOrEqual(2);
    const up = path[0]!.up;
    const supportAt = (x: number, z: number) => {
      for (let y = radiusCells; y >= 0; y--) {
        if (generator.shouldVoxelExist(x, y, z)) return y;
      }
      return null;
    };
    const assertDryGroundedSample = (position: { x: number; y: number; z: number }, label: string) => {
      const x = Math.round(position.x / VOXEL_SCALE);
      const z = Math.round(position.z / VOXEL_SCALE);
      const supportY = supportAt(x, z);
      expect(supportY, `${label} has no support at ${x},${z}`).not.toBeNull();
      expect(generator.isWaterVoxel(x, supportY!, z), `${label} crossed flooded support`).toBe(false);
      expect(position.y - supportY! * VOXEL_SCALE, `${label} floated or entered terrain`).toBeCloseTo(
        AUDIT_WORKER_GROUND_CLEARANCE,
        6
      );
      for (let lift = 1; lift <= 2; lift++) {
        const bodyY = supportY! + lift;
        const insideRenderedTerrain = Math.max(Math.abs(x), Math.abs(bodyY), Math.abs(z)) <= radiusCells;
        expect(
          insideRenderedTerrain && generator.shouldVoxelExist(x, bodyY, z),
          `${label} hit solid body clearance`
        ).toBe(false);
        expect(generator.isWaterVoxel(x, bodyY, z), `${label} entered water`).toBe(false);
      }
    };

    // Sample the same adjacent-segment interpolation the arrival driver consumes,
    // densely enough that a one-cell flooded strip cannot hide between endpoints.
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1].position;
      const to = path[index].position;
      const steps = Math.max(1, Math.ceil(from.distanceTo(to) / (VOXEL_SCALE / 8)));
      for (let step = 0; step <= steps; step++) {
        assertDryGroundedSample(
          from.clone().lerp(to, step / steps),
          `auditor interpolated leg ${index - 1}->${index} sample ${step}`
        );
      }
    }

    const routeLength = groundedSurfaceRouteLength(path, up);
    const spatialSamples = Math.max(1, Math.ceil(routeLength / (VOXEL_SCALE / 8)));
    for (let step = 0; step <= spatialSamples; step++) {
      const sample = sampleGroundedSurfaceRoute(path, routeLength * step / spatialSamples, up);
      assertDryGroundedSample(sample.position, `auditor grounded-route sample ${step}`);
    }

    // The arrival envelope may ease briefly at either end. Numerically measure
    // its peak rather than checking only average speed, so future timing/path
    // edits cannot turn W-7744 into a faster runner than the playable body.
    const timeSlices = 2400;
    let peakSpeed = 0;
    for (let slice = 1; slice <= timeSlices; slice++) {
      const previousProgress = easedGroundedTravelProgress((slice - 1) / timeSlices);
      const currentProgress = easedGroundedTravelProgress(slice / timeSlices);
      const distance = routeLength * (currentProgress - previousProgress);
      const seconds = ARRIVAL.walkSeconds / timeSlices;
      peakSpeed = Math.max(peakSpeed, distance / seconds);
    }
    expect(peakSpeed).toBeLessThanOrEqual(DEFAULT_MOVE_SPEED);
  });
});
