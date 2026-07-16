import { afterEach, describe, expect, it } from 'vitest';
import {
  commitSystemBodyTarget,
  commitSystemPlanetHandoff,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests
} from '../state/systemFlight.ts';
import {
  enterAtmosphere,
  enterShip,
  leaveAtmosphere,
  resetTravel
} from '../state/spaceFlight.ts';
import {
  emitEmergentStoryEvent,
  resetEmergentStoryEvents
} from './emergentStoryEvents.ts';
import { installVehicleSceneAvBoundaryBridge } from './VehicleSceneAvDriver.tsx';
import {
  activateSignedSceneSemanticEvent,
  enterSignedSceneAvBeat,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
import {
  INITIAL_LANDFALL_AV_STATE,
  VEHICLE_SCENE_AV_EVENTS,
  activateLaunchIgnitionFromCreatedSequence,
  activateVehicleSceneAvEvent,
  advanceLandfallAvState,
  hasLaunchPhysicallyDeparted,
  isTidegardenApproachAuthorityReady
} from './vehicleSceneAvAnchors.ts';

afterEach(() => {
  resetSignedSceneAvRuntime('sandbox');
  resetEmergentStoryEvents();
  resetTravel();
  resetSystemFlightStoreForTests();
});

describe('signed vehicle AV physical evidence', () => {
  it('holds ignition for a real launch sequence and authenticates first outward motion', () => {
    activateLaunchIgnitionFromCreatedSequence(null);
    expect(getSignedSceneAvDebugSnapshot().active).toBe(false);

    activateLaunchIgnitionFromCreatedSequence('ch8-launch');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-launch',
      anchorId: 'anc.launch.ignition'
    });

    const from = { x: 0, y: 50, z: 0 };
    const to = { x: 0, y: 84, z: 0 };
    expect(hasLaunchPhysicallyDeparted(from, from, to)).toBe(false);
    expect(hasLaunchPhysicallyDeparted(from, { x: 0, y: 49, z: 0 }, to)).toBe(false);
    expect(hasLaunchPhysicallyDeparted(from, { x: 0, y: 50.02, z: 0 }, to)).toBe(true);

    expect(activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.launchLiftoff)).toBe(true);
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.launch.liftoff');
  });

  it('fires atmosphere exit from the canonical descent-to-deep-space publication', () => {
    resetSystemFlightForInterstellarArrival({
      system: { x: -1, y: -1 },
      locationMode: 'atmosphere',
      activePlanetId: '-1,-1',
      pose: {
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      }
    });
    resetTravel();
    enterShip();
    enterAtmosphere();
    activateLaunchIgnitionFromCreatedSequence('ch8-launch');
    activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.launchLiftoff);
    const uninstall = installVehicleSceneAvBoundaryBridge();
    leaveAtmosphere();
    uninstall();
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.launch.atmosphere-exit',
      activationSource: 'semantic-event'
    });
  });

  it('fires local handoff only after commitSystemPlanetHandoff accepts', () => {
    resetSystemFlightForInterstellarArrival({
      system: { x: -1, y: -1 },
      locationMode: 'local_space',
      activePlanetId: '-1,-1',
      pose: {
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      }
    });
    const targetEpoch = commitSystemBodyTarget({ system: { x: -1, y: -1 }, slot: 1 });
    enterSignedSceneAvBeat('ch8-crossing');
    emitEmergentStoryEvent({
      id: 'test:tidegarden-target',
      type: 'system_body_targeted',
      worldId: '-1,-1:p1',
      payload: {
        worldId: '-1,-1:p1',
        seed: 1600321158,
        profileId: 'story:tidegarden',
        profileVersion: 1,
        profileHash: 'pf1-eeef3b78',
        archetype: 'verdant'
      }
    });
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.crossing.sibling-targeted');

    const uninstall = installVehicleSceneAvBoundaryBridge();
    expect(() => commitSystemPlanetHandoff({
      worldId: '-1,-1:p1',
      renderOrigin: [2200, 0, 0],
      expectedActivationEpoch: targetEpoch - 1
    })).toThrow('activation epoch is stale');
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.crossing.sibling-targeted');

    commitSystemPlanetHandoff({
      worldId: '-1,-1:p1',
      renderOrigin: [2200, 0, 0],
      expectedActivationEpoch: targetEpoch
    });
    uninstall();
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.crossing.local-handoff',
      activationSource: 'semantic-event'
    });
  });

  it('does not establish approach until owner, epoch, world, flight and paint agree', () => {
    const proof = {
      targetWorldId: '-1,-1:p1',
      currentWorldId: '-1,-1:p1',
      activePlanetId: '-1,-1:p1',
      committedEpoch: 12,
      activationEpoch: 12,
      sceneReady: true,
      locationMode: 'atmosphere' as const,
      controlMode: 'flight' as const,
      phase: 'descent' as const
    };
    expect(isTidegardenApproachAuthorityReady(proof)).toBe(true);
    expect(isTidegardenApproachAuthorityReady({ ...proof, sceneReady: false })).toBe(false);
    expect(isTidegardenApproachAuthorityReady({ ...proof, activationEpoch: 13 })).toBe(false);
    expect(isTidegardenApproachAuthorityReady({ ...proof, currentWorldId: '-1,-1' })).toBe(false);
    expect(isTidegardenApproachAuthorityReady({ ...proof, activePlanetId: '-1,-1' })).toBe(false);
  });

  it('orders validated egress before first grounded footfall and FPS handback', () => {
    const premature = advanceLandfallAvState(INITIAL_LANDFALL_AV_STATE, {
      kind: 'grounded',
      worldId: '-1,-1:p1',
      activePlanetId: '-1,-1:p1',
      controlMode: 'fps',
      grounded: true
    });
    expect(premature.events).toEqual([]);

    const exited = advanceLandfallAvState(premature.state, {
      kind: 'egress',
      worldId: '-1,-1:p1',
      activePlanetId: '-1,-1:p1',
      previousControlMode: 'flight',
      controlMode: 'fps',
      egressResolved: true
    });
    expect(exited.events).toEqual([VEHICLE_SCENE_AV_EVENTS.landfallEgress]);

    const footfall = advanceLandfallAvState(exited.state, {
      kind: 'grounded',
      worldId: '-1,-1:p1',
      activePlanetId: '-1,-1:p1',
      controlMode: 'fps',
      grounded: true
    });
    expect(footfall.events).toEqual([
      VEHICLE_SCENE_AV_EVENTS.landfallFirstFootfall,
      VEHICLE_SCENE_AV_EVENTS.landfallHandback
    ]);
    expect(advanceLandfallAvState(footfall.state, {
      kind: 'grounded',
      worldId: '-1,-1:p1',
      activePlanetId: '-1,-1:p1',
      controlMode: 'fps',
      grounded: true
    }).events).toEqual([]);

    enterSignedSceneAvBeat('ch8-landfall');
    expect(activateSignedSceneSemanticEvent('planet_arrived')).toBe(true);
    for (const event of [
      ...exited.events,
      ...footfall.events
    ]) activateVehicleSceneAvEvent(event);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.landfall.handback',
      activatedAnchorIds: expect.arrayContaining([
        'anc.landfall.egress',
        'anc.landfall.first-footfall',
        'anc.landfall.handback'
      ])
    });
  });
});
