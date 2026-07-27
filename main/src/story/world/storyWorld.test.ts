import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AUDIT_WORKER_GROUND_CLEARANCE,
  getAnomalyStonePose,
  getAuditWorkerPath,
  getDebrisPoses,
  getFieldPackPose,
  getKeelMemoryPose,
  getNavWaypointPoses,
  getPodImpactPose,
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
import { CH1_2D_TRAVEL_BAND } from '../storyDirector.ts';
import { coordinateToSeed } from '../../utils/worldCoordinates.ts';
import { taskRowMoveIntent, STORY_TASK_ROW_DEPTH_BAND } from '../taskRowNavigation.ts';
import { SUPPLY_POD_COUNT } from '../supplyPods.ts';
import { NAV_WAYPOINT_COUNT } from '../navWaypoints.ts';
import { mesaBlockLayout } from './SignalMesa.tsx';
import { findTopFaceSurfaceVoxel } from '../../utils/worldArrival.ts';
import {
  clearWorldGenCache,
  getWorldGen,
  hasWorldGenCacheEntry
} from '../../utils/worldGenCache.ts';
import { planAgentSurfaceRoute } from '../../utils/agentSurfaceNavigation.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import { DEFAULT_MOVE_SPEED } from '../../utils/surfaceControls.ts';
import { SHIP_REST_CLEARANCE } from '../../utils/shipDesign.ts';
import { resolveSafeShipBoardingPosition } from '../../utils/spawnValidation.ts';
import { ARRIVAL } from '../storyScript.ts';
import {
  easedGroundedTravelProgress,
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute
} from '../../utils/groundedSurfaceMotion.ts';
import { AUDIT_WORKER_BOOT_SOLE_Y } from './AuditWorker.tsx';
import { STORY_PRIMARY_WORLD_ID } from '../tidegardenRoute.ts';

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

  it('keeps authored pose and route queries on the one canonical cache entry', () => {
    const size = 18;
    clearWorldGenCache();

    getStorySidePlane(size, STORY_SEED);
    getAnomalyStonePose(size, STORY_SEED);
    getAuditWorkerPath(size, STORY_SEED);

    expect(hasWorldGenCacheEntry(size, STORY_SEED, STORY_PRIMARY_WORLD_ID)).toBe(true);
    expect(hasWorldGenCacheEntry(size, STORY_SEED)).toBe(false);
  });

  it('the pinned world keeps a pond within the first day\'s walk (ch3-thirst depends on it)', () => {
    const pond = getPondPose(50, STORY_SEED);
    expect(pond).not.toBeNull();
    const generator = getWorldGen(50, STORY_SEED, STORY_PRIMARY_WORLD_ID).generator;
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

  it('places the unique repair kit on validated dry ground and the Keel in the pond medium', () => {
    const size = 50;
    const generator = getWorldGen(size, STORY_SEED).generator;
    const pack = getFieldPackPose(size, STORY_SEED);
    const keel = getKeelMemoryPose(size, STORY_SEED);
    expect(pack).not.toBeNull();
    expect(keel).not.toBeNull();

    const packCell = pack!.position.clone().divideScalar(VOXEL_SCALE).round();
    const support = findTopFaceSurfaceVoxel(size, STORY_SEED, {
      x: packCell.x,
      z: packCell.z
    });
    expect(generator.isWaterVoxel(support.x, support.y, support.z)).toBe(false);
    expect(generator.isWaterVoxel(support.x, support.y + 1, support.z)).toBe(false);
    expect(generator.generateBlockForPosition(support.x, support.y, support.z)).not.toBe('lava');

    const pond = getPondPose(size, STORY_SEED)!;
    expect(keel!.position.distanceTo(pond.floor)).toBeLessThan(1);
    const keelCell = keel!.position.clone().divideScalar(VOXEL_SCALE).round();
    expect(generator.isWaterVoxel(keelCell.x, keelCell.y + 1, keelCell.z)).toBe(true);
  });

  it('keeps the canonical repaired wreck physically perched and boardable', () => {
    const size = 50;
    const generator = getWorldGen(size, STORY_SEED, '-1,-1').generator;
    const impact = getPodImpactPose(size, STORY_SEED);
    const parked = impact.position.clone().addScaledVector(impact.up, SHIP_REST_CLEARANCE);
    const terrain = {
      shouldVoxelExist: (x: number, y: number, z: number) =>
        generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) =>
        generator.isWaterVoxel(x, y, z),
      generateBlockForPosition: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z)
    };

    expect(parked.toArray()).toEqual([3, 53.5, -6]);
    expect(resolveSafeShipBoardingPosition(terrain, size, parked, 0)?.toArray())
      .toEqual(parked.toArray());
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

  it('walls the pure-2D eras inside the dry plateau — bands keep both content reachable and the clamp rest dry', () => {
    // Owner note: on the pure-2D side-scroller the worker must not be able to
    // walk off the face (or switch faces). The travel band is a SOFT wall; it
    // must (a) keep every authored/movie target reachable and (b) keep the
    // RESTING clamp position on the authored dry plateau, so a beat that ends at
    // the wall never parks the actor in the shore (the ch1-depth → ch1-nav
    // regression: a band ~6 m past the plateau edge stranded the actor in the
    // shallows, then wedged the cross-face planner).
    const plane = getStorySidePlane(50, STORY_SEED);
    const along = (p: THREE.Vector3) => Math.abs(p.clone().sub(plane.origin).dot(plane.travelAxis));

    const debrisMax = Math.max(...getDebrisPoses(50, STORY_SEED).map(p => along(p.position)));
    const podMax = Math.max(...getSupplyPodPoses(50, STORY_SEED).map(p => along(p.position)));
    // Spawn (origin) is trivially at 0; the drift/march targets are relative to
    // the player and therefore bounded by the same clamp — the anchored targets
    // (debris, pods) are the only absolute ones the movie must actually reach.
    // Every target must stay reachable, with at least ~1 m before the wall (the
    // soft spring keeps content at the very edge reachable, but leave headroom).
    expect(debrisMax).toBeLessThan(CH1_2D_TRAVEL_BAND.gather); // ch1-fixed + ch1-raster
    expect(podMax).toBeLessThan(CH1_2D_TRAVEL_BAND.recovery); // ch1-depth
    expect(CH1_2D_TRAVEL_BAND.gather - debrisMax).toBeGreaterThanOrEqual(1);
    expect(CH1_2D_TRAVEL_BAND.recovery - podMax).toBeGreaterThanOrEqual(1);

    // Derive the dry plateau edge from world-gen data (rather than hardcoding):
    // scan outward from arrival along the travel axis until the column stops
    // being level+dry. The clamp rest must stay on that plateau, so every band
    // must be no farther than plateau-edge + 1 m.
    const size = 50;
    const arrival = findTopFaceSurfaceVoxel(size, STORY_SEED);
    const generator = getWorldGen(size, STORY_SEED).generator;
    const tx = Math.round(plane.travelAxis.x);
    const tz = Math.round(plane.travelAxis.z);
    const plateauEdgeMetres = (dir: 1 | -1): number => {
      let lastGood = 0;
      for (let offset = 1; offset <= 40; offset++) {
        const x = arrival.x + tx * offset * dir;
        const z = arrival.z + tz * offset * dir;
        const support = findTopFaceSurfaceVoxel(size, STORY_SEED, { x, z });
        const level = support.y === arrival.y;
        const dry = !generator.isWaterVoxel(x, support.y + 1, z)
          && !generator.isWaterVoxel(x, support.y + 2, z);
        if (level && dry) lastGood = offset;
        else break;
      }
      return lastGood * VOXEL_SCALE; // voxel offset → world metres
    };
    // The binding edge is the nearer of the two travel directions.
    const plateauEdge = Math.min(plateauEdgeMetres(1), plateauEdgeMetres(-1));
    expect(plateauEdge).toBeGreaterThanOrEqual(debrisMax); // content stays on the plateau
    expect(CH1_2D_TRAVEL_BAND.gather).toBeLessThanOrEqual(plateauEdge + 1);
    expect(CH1_2D_TRAVEL_BAND.recovery).toBeLessThanOrEqual(plateauEdge + 1);

    // The +travel cube-face edge is at world radius 50; the origin sits at
    // travel-offset |origin·travel| from it. The band must stay well short of it.
    const originAlong = Math.abs(plane.origin.dot(plane.travelAxis));
    const faceEdgeDistance = 50 - originAlong; // metres from origin to the +face edge
    expect(CH1_2D_TRAVEL_BAND.gather).toBeLessThan(faceEdgeDistance - 4);
    expect(CH1_2D_TRAVEL_BAND.recovery).toBeLessThan(faceEdgeDistance - 4);
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

  it('lands every NAV triangulation beacon on validated dry ground', () => {
    // The top-down autopilot steers straight at each fix; a beacon dropped in or
    // just behind water would strand the pilot at the shoreline. The dry-landing
    // guarantee must nudge each fix onto a support cell that is neither flooded
    // nor hazardous, on the owned top face.
    const size = 50;
    const radiusCells = Math.floor(size / VOXEL_SCALE);
    const generator = getWorldGen(size, STORY_SEED).generator;
    const supportAt = (x: number, z: number) => {
      for (let y = radiusCells; y >= 0; y--) {
        if (generator.shouldVoxelExist(x, y, z)) return y;
      }
      return null;
    };

    const poses = getNavWaypointPoses(size, STORY_SEED);
    expect(poses).toHaveLength(NAV_WAYPOINT_COUNT);
    poses.forEach((pose, index) => {
      const x = Math.round(pose.position.x / VOXEL_SCALE);
      const z = Math.round(pose.position.z / VOXEL_SCALE);
      const supportY = supportAt(x, z);
      expect(supportY, `NAV beacon ${index} has no top-face support`).not.toBeNull();
      expect(
        generator.isWaterVoxel(x, supportY!, z),
        `NAV beacon ${index} support flooded`
      ).toBe(false);
      expect(
        generator.isWaterVoxel(x, supportY! + 1, z),
        `NAV beacon ${index} stands in water`
      ).toBe(false);
      expect(generator.generateBlockForPosition(x, supportY!, z)).not.toBe('lava');
    });
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
