import { beforeEach, describe, expect, it } from 'vitest';
import { createPlanetIdentity } from '../game/starSystem.ts';
import {
  getShipRestorationSnapshot,
  resetShipRestoration,
  setShipRestorationLocation
} from '../game/systems/shipRestoration.ts';
import { createCurrentWorld } from '../utils/worldCoordinates.ts';
import { getSpaceFlightSnapshot, resetTravel } from './spaceFlight.ts';
import {
  getSystemFlightSnapshot,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests
} from './systemFlight.ts';
import {
  persistedParkedShipPose,
  persistShipFlightLocation,
  restorableShipWorldId,
  restoreShipFlightForWorld,
  shipFlightWorldContext
} from './shipFlightContinuity.ts';

const TIDEGARDEN = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 1 });
const WORLD = {
  worldId: TIDEGARDEN.worldId,
  coordinate: { ...TIDEGARDEN.coordinate },
  seed: TIDEGARDEN.seed
};

describe('ship flight continuity', () => {
  beforeEach(() => {
    resetShipRestoration();
    resetSystemFlightStoreForTests();
    resetTravel();
  });

  it('hydrates an identity-matching atmospheric system pose into real descent flight', () => {
    const context = shipFlightWorldContext(WORLD);
    expect(context).not.toBeNull();
    if (!context) throw new Error('Expected Tidegarden flight context.');
    const systemPose = {
      position: [context.systemPosition[0] + 4, context.systemPosition[1] + 121, context.systemPosition[2] - 9] as [number, number, number],
      quaternion: [0.1, 0.2, 0.3, 0.9] as [number, number, number, number],
      velocity: [3, -7, 11] as [number, number, number]
    };
    setShipRestorationLocation({
      currentSystemId: context.systemId,
      currentWorldId: context.worldId,
      parkedPose: null,
      systemPose,
      locationMode: 'atmosphere'
    });

    expect(restoreShipFlightForWorld(context)).toEqual({
      restored: true,
      locationMode: 'atmosphere'
    });
    expect(getSystemFlightSnapshot()).toMatchObject({
      systemId: context.systemId,
      activePlanetId: context.worldId,
      locationMode: 'atmosphere',
      pose: systemPose,
      renderOrigin: context.systemPosition
    });
    expect(getSpaceFlightSnapshot()).toMatchObject({
      phase: 'descent',
      controlMode: 'flight'
    });
  });

  it('reconstructs a surface system pose from the persisted local parked pose and heading', () => {
    const context = shipFlightWorldContext(WORLD);
    if (!context) throw new Error('Expected Tidegarden flight context.');
    const parkedPose = {
      position: [8, 52.5, -13] as [number, number, number],
      quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as [number, number, number, number]
    };
    setShipRestorationLocation({
      currentSystemId: context.systemId,
      currentWorldId: context.worldId,
      parkedPose,
      systemPose: null,
      locationMode: 'surface'
    });

    expect(restoreShipFlightForWorld(context).restored).toBe(true);
    expect(getSystemFlightSnapshot().pose).toMatchObject({
      position: [
        context.systemPosition[0] + parkedPose.position[0],
        context.systemPosition[1] + parkedPose.position[1],
        context.systemPosition[2] + parkedPose.position[2]
      ],
      quaternion: parkedPose.quaternion,
      velocity: [0, 0, 0]
    });
    expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'surface', controlMode: 'fps' });
    expect(persistedParkedShipPose(context)).toEqual(parkedPose);
  });

  it('rejects a pose from another world and captures live transitions without carrying its pad forward', () => {
    const context = shipFlightWorldContext(WORLD);
    if (!context) throw new Error('Expected Tidegarden flight context.');
    setShipRestorationLocation({
      currentSystemId: '4,9',
      currentWorldId: '4,9',
      parkedPose: { position: [1, 52.5, 1], quaternion: [0, 0, 0, 1] },
      systemPose: { position: [2, 3, 4], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] },
      locationMode: 'local_space'
    });
    expect(restoreShipFlightForWorld(context).restored).toBe(false);

    const livePose = {
      position: [context.systemPosition[0] + 40, context.systemPosition[1] + 90, context.systemPosition[2]],
      velocity: [5, -2, 1],
      quaternion: [0, 0, 0, 1]
    } as const;
    resetSystemFlightForInterstellarArrival({
      system: context.system,
      layoutVersion: context.layoutVersion,
      activePlanetId: context.worldId,
      locationMode: 'atmosphere',
      pose: livePose,
      renderOrigin: context.systemPosition
    });
    expect(persistShipFlightLocation({
      ...context,
      locationMode: 'atmosphere'
    })).toBe(true);
    expect(getShipRestorationSnapshot()).toMatchObject({
      currentSystemId: context.systemId,
      currentWorldId: context.worldId,
      locationMode: 'atmosphere',
      parkedPose: null,
      systemPose: livePose
    });
    expect(restorableShipWorldId(getShipRestorationSnapshot())).toBe(context.worldId);
  });

  it('does not accept a malformed or pose-less world pointer as a boot location', () => {
    expect(restorableShipWorldId({
      currentSystemId: '-1,-1',
      currentWorldId: '-1,-1:p1',
      locationMode: 'atmosphere'
    })).toBeNull();
    expect(restorableShipWorldId({
      currentSystemId: '-1,-1',
      currentWorldId: '7,4:p1',
      locationMode: 'surface',
      parkedPose: { position: [0, 52.5, 0], quaternion: [0, 0, 0, 1] }
    })).toBeNull();
    expect(shipFlightWorldContext(createCurrentWorld({ x: 2, y: 3 }))).not.toBeNull();
  });
});
