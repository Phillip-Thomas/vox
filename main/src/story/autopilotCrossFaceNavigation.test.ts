import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TIDEGARDEN_SEED } from '../game/PlanetProfile.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { planAgentSurfaceRoute } from '../utils/agentSurfaceNavigation.ts';
import { findValidSpawnSite } from '../utils/spawnValidation.ts';
import { getPondPose } from './world/storyWorld.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import {
  crossFaceApproachCandidates,
  planCrossFaceSurfaceLeg
} from './autopilotSteering.ts';
import {
  planReachableCrossFaceRoute,
  shouldExtendCrossFaceContinuation,
  shouldReplanDryWaterContact,
  shouldReplanUnreachableRoute,
  validateCrossFaceDestinationEntry,
  validateCrossFaceJetpackDestinationEntry
} from './autopilotCrossFaceNavigation.ts';

describe('reachable cross-face route selection', () => {
  it('replans a cached rejection only after displacement or physical support acquisition', () => {
    const plannedFrom = new THREE.Vector3(33.31, -5.75, -60.68);
    const unsupported = { feetInWater: false, physicallySupported: false };
    expect(shouldReplanUnreachableRoute({
      routeMode: 'unreachable',
      plannedFrom,
      player: plannedFrom.clone(),
      plannedContact: unsupported,
      currentContact: unsupported
    })).toBe(false);
    expect(shouldReplanUnreachableRoute({
      routeMode: 'unreachable',
      plannedFrom,
      player: plannedFrom.clone().add(new THREE.Vector3(0, 0, 1.99)),
      plannedContact: unsupported,
      currentContact: unsupported
    })).toBe(false);
    expect(shouldReplanUnreachableRoute({
      routeMode: 'unreachable',
      plannedFrom,
      player: new THREE.Vector3(33.29, -5.73, -48.79),
      plannedContact: unsupported,
      currentContact: { feetInWater: true, physicallySupported: true }
    })).toBe(true);
    expect(shouldReplanUnreachableRoute({
      routeMode: 'walk',
      plannedFrom,
      player: new THREE.Vector3(33.29, -5.73, -48.79),
      plannedContact: unsupported,
      currentContact: { feetInWater: true, physicallySupported: true }
    })).toBe(false);
    expect(shouldReplanUnreachableRoute({
      routeMode: 'unreachable',
      plannedFrom,
      player: plannedFrom.clone(),
      plannedContact: unsupported,
      currentContact: { feetInWater: true, physicallySupported: true }
    })).toBe(true);
    expect(shouldReplanUnreachableRoute({
      routeMode: 'unreachable',
      plannedFrom,
      player: plannedFrom.clone(),
      plannedContact: { feetInWater: true, physicallySupported: true },
      currentContact: unsupported
    })).toBe(false);
  });

  it('rejects flooded left-to-top edge bands and selects the first proven dry seam', () => {
    const planetSize = 50;
    const player = new THREE.Vector3(-50.79, 12.5, 0);
    const goal = new THREE.Vector3(2.5, 48.7, 12.7);
    const generator = getWorldGen(planetSize, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID).generator;
    const terrain = {
      isSolidVoxel: (x: number, y: number, z: number) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z) === 'lava'
    };
    const leg = planCrossFaceSurfaceLeg({
      player,
      goal,
      currentFace: 'left',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: planetSize,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg).not.toBeNull();
    const approaches = crossFaceApproachCandidates({
      leg: leg!, goal, edgeEntryRadius: 48.2, cornerInset: 2
    });
    const validateApproach = (approach: THREE.Vector3, hazardousTerrain = terrain) => {
      const departureRoute = planAgentSurfaceRoute(terrain, planetSize, player, approach, {
        face: 'left', differentFaceFallback: 'unreachable', allowJetpackCrossing: true,
        maxJetpackWaterCells: 3, maxJetpackWaterDepthCells: 2,
        jetpackDetourExtraCells: 4, jetpackDetourRatio: 1.5, maxVisitedCells: 4096
      });
      return {
        departureRoute,
        validation: validateCrossFaceDestinationEntry({
          terrain: hazardousTerrain,
          planetSize,
          goal,
          crossFaceLeg: leg!,
          approach,
          departureRoute
        })
      };
    };

    const nominal = approaches.find(approach => Math.abs(approach.z - 5.29) < 0.1)!;
    const goalAligned = approaches.find(approach => Math.abs(approach.z - 12.7) < 0.1)!;
    const flooded = approaches.find(approach => Math.abs(approach.z - 20.7) < 0.1)!;
    const dry = approaches.find(approach => Math.abs(approach.z - 28.7) < 0.1)!;
    expect(validateApproach(nominal).validation.reason).toBe('departure-approach-gap');
    expect(validateApproach(goalAligned).validation.reason).toBe('departure-approach-gap');
    const floodedValidation = validateApproach(flooded).validation;
    expect(floodedValidation.reason).toBe('destination-edge-water');
    expect(floodedValidation.blockedAt?.toArray()).toEqual([-48, 48, 20]);

    const dryCandidate = validateApproach(dry);
    expect(dryCandidate.departureRoute.resolvedGoal?.toArray()).toEqual([-50.85, 46, 28]);
    expect(dryCandidate.validation.accepted).toBe(true);
    expect(dryCandidate.validation.destinationEntry?.toArray()).toEqual([-48, 52.85, 28]);
    expect(dryCandidate.validation.destinationRoute?.mode).toBe('walk');
    expect(dryCandidate.validation.destinationRoute?.waterCrossing).toBeNull();
    expect(dryCandidate.validation.continuationMode).toBe('dry');

    const hazardousTerrain = {
      ...terrain,
      isHazardousVoxel: (x: number, y: number, z: number) =>
        (x === -24 && y === 25 && z === 14)
        || terrain.isHazardousVoxel(x, y, z)
    };
    const hazardousValidation = validateApproach(dry, hazardousTerrain).validation;
    expect(hazardousValidation.reason).toBe('destination-edge-hazard');
    expect(hazardousValidation.blockedAt?.toArray()).toEqual([-48, 50, 28]);

    const planned = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player,
      goal,
      face: 'left',
      crossFaceLeg: leg,
      jetpackAvailable: true
    });
    expect(planned.attemptedApproaches).toBe(6);
    expect(planned.crossFaceLeg?.approach.z).toBeCloseTo(28.7);
    expect(planned.route.mode).toBe('walk');
    expect(planned.route.resolvedGoal?.toArray()).toEqual([-50.85, 46, 28]);
    expect(planned.destinationEntry?.toArray()).toEqual([-48, 52.85, 28]);
    expect(planned.destinationRoute?.mode).toBe('walk');
    expect(planned.destinationRoute?.waterCrossing).toBeNull();
    expect(planned.safeContinuationDistance).toBeCloseTo(2.85);
    expect(planned.destinationContinuationMode).toBe('dry');
  }, 15_000);
  it('does not relabel the reported back-face partial crossing as a dry seam', () => {
    const planetSize = 50;
    const player = new THREE.Vector3(-20, 7.5, -50.79);
    const goal = getPondPose(planetSize, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)?.shore;
    expect(goal).toBeDefined();
    const generator = getWorldGen(
      planetSize,
      TIDEGARDEN_SEED,
      TIDEGARDEN_WORLD_ID
    ).generator;
    const terrain = {
      isSolidVoxel: (x: number, y: number, z: number) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z) === 'lava'
    };
    const leg = planCrossFaceSurfaceLeg({
      player,
      goal: goal!,
      currentFace: 'back',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: planetSize,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg).not.toBeNull();

    const approaches = crossFaceApproachCandidates({
      leg: leg!, goal: goal!, edgeEntryRadius: 48.2, cornerInset: 2
    });
    const formerlySelected = approaches.find(approach => Math.abs(approach.x - 18) < 0.1)!;
    const formerlySelectedRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      player,
      formerlySelected,
      {
        face: 'back',
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: true,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        jetpackDetourExtraCells: 4,
        jetpackDetourRatio: 1.5,
        maxVisitedCells: 4096
      }
    );
    expect(validateCrossFaceDestinationEntry({
      terrain,
      planetSize,
      goal: goal!,
      crossFaceLeg: leg!,
      approach: formerlySelected,
      departureRoute: formerlySelectedRoute
    }).reason).toBe('departure-approach-gap');

    const planned = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player,
      goal: goal!,
      face: 'back',
      crossFaceLeg: leg,
      jetpackAvailable: true
    });
    expect(planned.attemptedApproaches).toBe(1);
    expect(planned.route.mode).toBe('jetpack');
    expect(planned.route.waypoints.length).toBeGreaterThan(1);
    expect(planned.route.reason).toBe('partial-water-crossing-egress');
    expect(planned.destinationEntry?.toArray()).toEqual([2, 50.85, -38]);
    expect(planned.destinationRoute?.mode).toBe('jetpack');
    expect(planned.destinationRoute?.reason).toBe('wet-start-egress');
    expect(planned.safeContinuationDistance).toBeCloseTo(12.85);
    expect(planned.destinationContinuationMode).toBe('jetpack');

    const runtimePlayer = new THREE.Vector3(12.13, 39.08, -60.09);
    const runtimeLeg = planCrossFaceSurfaceLeg({
      player: runtimePlayer,
      goal: goal!,
      currentFace: 'back',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: planetSize,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    const runtimePlan = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player: runtimePlayer,
      goal: goal!,
      face: 'back',
      crossFaceLeg: runtimeLeg,
      jetpackAvailable: true
    });
    expect(runtimePlan.route.mode).toBe('jetpack');
    expect(runtimePlan.route.reason).toBe('wet-start-egress');
    expect(runtimePlan.route.resolvedGoal?.toArray()).toEqual([14, 40, -50.85]);
    expect(runtimePlan.destinationEntry?.toArray()).toEqual([14, 50.85, -34]);
    expect(runtimePlan.destinationRoute?.mode).toBe('jetpack');
    expect(runtimePlan.destinationRoute?.reason).toBe('wet-start-egress');
    expect(runtimePlan.safeContinuationDistance).toBeCloseTo(16.85);
    expect(runtimePlan.destinationContinuationMode).toBe('jetpack');

    const observedTopEntry = new THREE.Vector3(12.63, 51.87, -49.87);
    const observedTopRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      observedTopEntry,
      goal!,
      {
        face: 'top',
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: true,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        maxVisitedCells: 4096
      }
    );
    expect(observedTopRoute.reason).toBe('start-column-not-traversable');
    expect(runtimePlan.destinationEntry!.z - observedTopEntry.z).toBeCloseTo(15.87);

    const hazardousCorridor = {
      ...terrain,
      isHazardousVoxel: (x: number, y: number, z: number) =>
        (x === 7 && z === -20)
        || terrain.isHazardousVoxel(x, y, z)
    };
    const hazardousWetValidation = validateCrossFaceJetpackDestinationEntry({
      terrain: hazardousCorridor,
      planetSize,
      goal: goal!,
      crossFaceLeg: runtimeLeg!,
      approach: runtimePlan.crossFaceLeg!.approach,
      departureRoute: runtimePlan.route
    });
    expect(hazardousWetValidation.reason).toBe('destination-edge-hazard');
    expect(hazardousWetValidation.blockedAt?.toArray()).toEqual([14, 38, -40]);

    const edgeRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      new THREE.Vector3(18, 52.85, -50.85),
      goal!,
      { face: 'top', differentFaceFallback: 'unreachable', maxVisitedCells: 4096 }
    );
    expect(edgeRoute.reason).toBe('start-column-not-traversable');
    expect(shouldExtendCrossFaceContinuation(edgeRoute)).toBe(true);

    const interiorRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      new THREE.Vector3(18, 52.85, -28.85),
      goal!,
      { face: 'top', differentFaceFallback: 'unreachable', maxVisitedCells: 4096 }
    );
    expect(interiorRoute.mode).not.toBe('unreachable');
    expect(shouldExtendCrossFaceContinuation(interiorRoute)).toBe(false);

    // The relationship can accept while the handoff is still two shallow
    // water cells from dry top-face support. Its next semantic goal changes to
    // the habitat site; the top-face planner reports no-safe-route here rather
    // than start-column-not-traversable. That is still a transient handoff
    // state, and the same bounded physical +Z continuation reaches dry support.
    const wetHandoffPlayer = new THREE.Vector3(20.83, 47.5, -18.28);
    const habitatSite = findValidSpawnSite(generator, planetSize, wetHandoffPlayer, {
      kind: 'player',
      maxSearchRadius: 18
    });
    expect(habitatSite).not.toBeNull();
    const wetHandoffRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      wetHandoffPlayer,
      habitatSite!.position,
      {
        face: 'top',
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: true,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        maxVisitedCells: 4096
      }
    );
    expect(wetHandoffRoute.reason).toBe('no-safe-route');
    expect(shouldExtendCrossFaceContinuation(wetHandoffRoute)).toBe(true);
    const dryHandoffRoute = planAgentSurfaceRoute(
      terrain,
      planetSize,
      new THREE.Vector3(20.83, 47.5, -15),
      habitatSite!.position,
      {
        face: 'top',
        differentFaceFallback: 'unreachable',
        allowJetpackCrossing: true,
        maxJetpackWaterCells: 3,
        maxJetpackWaterDepthCells: 2,
        maxVisitedCells: 4096
      }
    );
    expect(dryHandoffRoute.mode).not.toBe('unreachable');
    expect(shouldExtendCrossFaceContinuation(dryHandoffRoute)).toBe(false);

    const landingRoute = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player: new THREE.Vector3(25.49, 50.18, -10.66),
      goal: goal!,
      face: 'top',
      crossFaceLeg: null,
      jetpackAvailable: true
    }).route;
    expect(landingRoute.mode).toBe('jetpack');
    expect(landingRoute.waterCrossing?.firstWaterWaypointIndex).toBe(0);
    expect(landingRoute.waterCrossing?.lastWaterWaypointIndex).toBe(0);
    expect(landingRoute.waterCrossing?.exitWorld.toArray()).toEqual([24, 50.85, -10]);

  }, 15_000);

  it('prefers the reported right-face dry seam over an earlier water crossing', () => {
    const planetSize = 50;
    const player = new THREE.Vector3(50.79, -2.95, -18);
    const goal = getPondPose(planetSize, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)?.shore;
    expect(goal).toBeDefined();
    const generator = getWorldGen(
      planetSize,
      TIDEGARDEN_SEED,
      TIDEGARDEN_WORLD_ID
    ).generator;
    const terrain = {
      isSolidVoxel: (x: number, y: number, z: number) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z) === 'lava'
    };
    const leg = planCrossFaceSurfaceLeg({
      player,
      goal: goal!,
      currentFace: 'right',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: planetSize,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg).not.toBeNull();

    const planned = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player,
      goal: goal!,
      face: 'right',
      crossFaceLeg: leg,
      jetpackAvailable: true
    });
    expect(planned.attemptedApproaches).toBe(11);
    expect(planned.route.mode).toBe('walk');
    expect(planned.route.waterCrossing).toBeNull();
    expect(planned.crossFaceLeg?.approach.toArray()).toEqual([50.79, 48.2, 30]);
    expect(planned.route.resolvedGoal?.toArray()).toEqual([50.85, 46, 30]);
    expect(planned.destinationEntry?.toArray()).toEqual([46, 50.85, 30]);
    expect(planned.destinationRoute?.mode).toBe('walk');
    expect(planned.destinationRoute?.waterCrossing).toBeNull();
    expect(planned.safeContinuationDistance).toBeCloseTo(4.85);
    expect(planned.destinationContinuationMode).toBe('dry');
  }, 15_000);

  it('recovers the reported Tidegarden back-face water landing toward a physical dry bank', () => {
    const planetSize = 50;
    const player = new THREE.Vector3(33.29, -5.73, -48.79);
    const goal = getPondPose(planetSize, TIDEGARDEN_SEED, TIDEGARDEN_WORLD_ID)?.shore;
    expect(goal).toBeDefined();
    const generator = getWorldGen(
      planetSize,
      TIDEGARDEN_SEED,
      TIDEGARDEN_WORLD_ID
    ).generator;
    const terrain = {
      isSolidVoxel: (x: number, y: number, z: number) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x: number, y: number, z: number) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x: number, y: number, z: number) =>
        generator.generateBlockForPosition(x, y, z) === 'lava'
    };
    const leg = planCrossFaceSurfaceLeg({
      player,
      goal: goal!,
      currentFace: 'back',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: planetSize,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg).not.toBeNull();

    const planned = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player,
      goal: goal!,
      face: 'back',
      crossFaceLeg: leg,
      jetpackAvailable: true
    });
    expect(planned.route.reason).toBe('wet-start-egress');
    expect(planned.route.mode).toBe('jetpack');
    expect(planned.route.waterCrossing?.firstWaterWaypointIndex).toBe(0);
    expect(planned.route.resolvedGoal).not.toBeNull();
    expect(planned.crossFaceLeg).toBeNull();
    expect(planned.destinationEntry).toBeNull();
  }, 15_000);
});

describe('shoreline dry-leg water-contact replan', () => {
  const THRESHOLD = 8;

  it('forces a replan once a nominally dry walk grinds the shoreline past the threshold', () => {
    expect(shouldReplanDryWaterContact({
      routeMode: 'walk',
      hasWaterCrossing: false,
      contactFrames: THRESHOLD,
      thresholdFrames: THRESHOLD
    })).toBe(true);
    // A single direct step in water counts the same once sustained.
    expect(shouldReplanDryWaterContact({
      routeMode: 'direct',
      hasWaterCrossing: false,
      contactFrames: THRESHOLD + 4,
      thresholdFrames: THRESHOLD
    })).toBe(true);
  });

  it('holds while contact is still incidental, below the sustained threshold', () => {
    expect(shouldReplanDryWaterContact({
      routeMode: 'walk',
      hasWaterCrossing: false,
      contactFrames: THRESHOLD - 1,
      thresholdFrames: THRESHOLD
    })).toBe(false);
  });

  it('never fights a route that already owns its water crossing or is unreachable', () => {
    // A planned jetpack crossing manages its own fuel-budget replans.
    expect(shouldReplanDryWaterContact({
      routeMode: 'jetpack',
      hasWaterCrossing: true,
      contactFrames: THRESHOLD * 4,
      thresholdFrames: THRESHOLD
    })).toBe(false);
    // A dry-mode leg that nonetheless carries a crossing descriptor is excluded.
    expect(shouldReplanDryWaterContact({
      routeMode: 'walk',
      hasWaterCrossing: true,
      contactFrames: THRESHOLD * 4,
      thresholdFrames: THRESHOLD
    })).toBe(false);
    expect(shouldReplanDryWaterContact({
      routeMode: 'unreachable',
      hasWaterCrossing: false,
      contactFrames: THRESHOLD * 4,
      thresholdFrames: THRESHOLD
    })).toBe(false);
  });

  it('is inert when the threshold is disabled', () => {
    expect(shouldReplanDryWaterContact({
      routeMode: 'walk',
      hasWaterCrossing: false,
      contactFrames: 999,
      thresholdFrames: 0
    })).toBe(false);
  });
});

describe('cross-face start-column relocation', () => {
  // Synthetic top-face plateau: solid fill to y=25 (cells), shallow water above
  // the support for every column at x-cell >= 5. A body standing over a wet
  // column has a non-traversable start; the dry plateau is a couple of cells
  // inward. planetSize 50 => radiusCells 25, VOXEL_SCALE 2 => world = cell * 2.
  const planetSize = 50;
  const SURFACE_CELL_Y = 25;
  const shoreTerrain = {
    isSolidVoxel: (x: number, y: number, z: number) =>
      y <= SURFACE_CELL_Y && Math.abs(x) <= 25 && Math.abs(z) <= 25,
    isWaterVoxel: (x: number, _y: number, _z: number) => _y > SURFACE_CELL_Y && x >= 5,
    isHazardousVoxel: () => false
  };
  const floodedTerrain = {
    ...shoreTerrain,
    isWaterVoxel: (_x: number, y: number, _z: number) => y > SURFACE_CELL_Y
  };
  // World: cell 6 => x 12 (wet start), dry plateau at cell <= 4 => x <= 8.
  const player = new THREE.Vector3(12, 50, 0);
  const goal = new THREE.Vector3(4, 50, 0);

  it('steps a non-traversable start onto the nearest dry column and plans on', () => {
    // Baseline: the raw planner cannot leave the wet start tile.
    const raw = planAgentSurfaceRoute(shoreTerrain, planetSize, player, goal, {
      face: 'top', differentFaceFallback: 'unreachable', maxVisitedCells: 4096
    });
    expect(raw.reason).toBe('start-column-not-traversable');

    const planned = planReachableCrossFaceRoute({
      terrain: shoreTerrain,
      planetSize,
      player,
      goal,
      face: 'top',
      crossFaceLeg: null,
      jetpackAvailable: false
    });
    expect(planned.route.mode).not.toBe('unreachable');
    expect(planned.route.waypoints.length).toBeGreaterThan(0);
    // The live (wet) position is prepended so the follower walks the short dry
    // gap onto the substitute start before the journey proper.
    expect(planned.route.waypoints[0]!.x).toBeCloseTo(player.x);
    expect(planned.route.waypoints[0]!.z).toBeCloseTo(player.z);
    // The second waypoint is already back on the dry plateau (x-cell < 5 => x < 10).
    expect(planned.route.waypoints[1]!.x).toBeLessThan(10);
  });

  it('returns unreachable when the whole neighbourhood is blocked (no infinite search)', () => {
    const planned = planReachableCrossFaceRoute({
      terrain: floodedTerrain,
      planetSize,
      player,
      goal,
      face: 'top',
      crossFaceLeg: null,
      jetpackAvailable: false
    });
    expect(planned.route.mode).toBe('unreachable');
    expect(planned.route.reason).toBe('start-column-not-traversable');
    expect(planned.route.waypoints.length).toBe(0);
  });
});
