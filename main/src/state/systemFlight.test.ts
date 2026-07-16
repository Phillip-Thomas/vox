import { beforeEach, describe, expect, it } from 'vitest';
import {
  acquireSystemPoseWriter,
  cancelSystemTarget,
  commitInterstellarTarget,
  commitSystemBodyTarget,
  commitSystemPlanetHandoff,
  getSystemFlightSnapshot,
  planetLocalPoseToSystemPose,
  projectSystemPosition,
  rebaseSystemRenderOrigin,
  releaseSystemPoseWriter,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests,
  setActiveSystemPlanet,
  subscribeSystemFlight,
  subscribeSystemPlanetHandoffCommits,
  systemPoseToPlanetLocalPose,
  updateSystemShipPose,
  updateSystemShipPoseFromPlanetLocal,
  type SystemShipPose,
  type SystemVectorTuple
} from './systemFlight.ts';

const EPSILON = 1e-10;

beforeEach(() => {
  resetSystemFlightStoreForTests();
});

describe('system-flight reference frames', () => {
  it('round-trips planet-local and system poses without changing velocity or quaternion', () => {
    const center: SystemVectorTuple = [2_543.125, -318.75, 49.5];
    const local: SystemShipPose = {
      position: [61.125, -4.75, 12.5],
      velocity: [31.25, -2.5, 0.125],
      quaternion: [0.125, -0.25, 0.375, 0.875]
    };

    const system = planetLocalPoseToSystemPose(local, center);
    const roundTrip = systemPoseToPlanetLocalPose(system, center);

    expectTupleClose(roundTrip.position, local.position);
    expectTupleClose(roundTrip.velocity, local.velocity);
    expectTupleClose(roundTrip.quaternion, local.quaternion);
    expect(system.velocity).toEqual(local.velocity);
    expect(system.quaternion).toEqual(local.quaternion);
  });

  it('changes only render origin during a rebase and preserves view-relative offsets', () => {
    const pose: SystemShipPose = {
      position: [2_100.5, -20, 80],
      velocity: [120, 0, -4],
      quaternion: [0, 0.2, 0, 0.98]
    };
    resetSystemFlightForInterstellarArrival({
      system: { x: 4, y: -2 },
      pose,
      renderOrigin: [0, 0, 0]
    });
    const before = getSystemFlightSnapshot();
    const target: SystemVectorTuple = [3_500, 150, -240];
    const beforeRelative = subtract(
      projectSystemPosition(target, before.renderOrigin),
      projectSystemPosition(before.pose.position, before.renderOrigin)
    );

    rebaseSystemRenderOrigin([3_100, 100, -200]);
    const after = getSystemFlightSnapshot();
    const afterRelative = subtract(
      projectSystemPosition(target, after.renderOrigin),
      projectSystemPosition(after.pose.position, after.renderOrigin)
    );

    expect(after.pose).toBe(before.pose);
    expect(after.activationEpoch).toBe(before.activationEpoch);
    expect(after.pose.position).toEqual(pose.position);
    expectTupleClose(afterRelative, beforeRelative);
  });
});

describe('system-flight ownership and targeting', () => {
  it('allows exactly one pose writer and rejects released or stale leases', () => {
    const first = acquireSystemPoseWriter('ship-controller-a');
    expect(first).not.toBeNull();
    expect(acquireSystemPoseWriter('ship-controller-b')).toBeNull();

    const firstPose = poseAt([10, 20, 30]);
    expect(updateSystemShipPose(first!, firstPose)).toBe(true);
    expect(getSystemFlightSnapshot().pose.position).toEqual(firstPose.position);
    expect(releaseSystemPoseWriter(first!)).toBe(true);

    const second = acquireSystemPoseWriter('ship-controller-b');
    expect(second).not.toBeNull();
    expect(updateSystemShipPose(first!, poseAt([999, 999, 999]))).toBe(false);
    expect(getSystemFlightSnapshot().pose.position).toEqual(firstPose.position);
    expect(updateSystemShipPose(second!, poseAt([40, 50, 60]))).toBe(true);
    expect(getSystemFlightSnapshot().pose.position).toEqual([40, 50, 60]);
  });

  it('publishes a planet-local pose directly into canonical system space', () => {
    const writer = acquireSystemPoseWriter('ship');
    expect(writer).not.toBeNull();
    expect(updateSystemShipPoseFromPlanetLocal(
      writer!,
      poseAt([2, 3, 4]),
      [2_000, -100, 50]
    )).toBe(true);
    expect(getSystemFlightSnapshot().pose.position).toEqual([2_002, -97, 54]);
  });

  it('keeps per-frame pose writes off the React boundary notification path', () => {
    let notifications = 0;
    const unsubscribe = subscribeSystemFlight(() => notifications++);
    const writer = acquireSystemPoseWriter('frame-loop');

    expect(updateSystemShipPose(writer!, poseAt([1, 2, 3]))).toBe(true);
    expect(updateSystemShipPose(writer!, poseAt([2, 3, 4]))).toBe(true);
    expect(notifications).toBe(0);

    rebaseSystemRenderOrigin([10, 0, 0]);
    expect(notifications).toBe(1);
    unsubscribe();
  });

  it('advances activation epochs on commit, cancel, and active-body changes', () => {
    resetSystemFlightForInterstellarArrival({
      system: { x: 7, y: -3 },
      activePlanetId: '7,-3',
      pose: poseAt([0, 0, 0])
    });
    const baseEpoch = getSystemFlightSnapshot().activationEpoch;

    const targetEpoch = commitSystemBodyTarget({ system: { x: 7, y: -3 }, slot: 1 });
    expect(targetEpoch).toBe(baseEpoch + 1);
    expect(getSystemFlightSnapshot().target).toMatchObject({
      kind: 'system_body',
      worldId: '7,-3:p1'
    });

    const cancelEpoch = cancelSystemTarget();
    expect(cancelEpoch).toBe(targetEpoch + 1);
    expect(getSystemFlightSnapshot().target).toBeNull();

    const demoteEpoch = setActiveSystemPlanet(null);
    expect(demoteEpoch).toBe(cancelEpoch + 1);
    expect(getSystemFlightSnapshot().activePlanetId).toBeNull();
    expect(getSystemFlightSnapshot().lastActivePlanetId).toBe('7,-3');

    expect(() => commitSystemBodyTarget({ system: { x: 8, y: -3 }, slot: 1 }))
      .toThrow('System-body target must belong to the current star system.');
    expect(() => setActiveSystemPlanet('8,-3:p1'))
      .toThrow('Active planet must belong to the current star system.');
  });

  it('commits the local body, render origin, location, and target as one boundary', () => {
    resetSystemFlightForInterstellarArrival({
      system: { x: 7, y: -3 },
      activePlanetId: '7,-3',
      pose: poseAt([2_100, 20, -4])
    });
    const targetEpoch = commitSystemBodyTarget({ system: { x: 7, y: -3 }, slot: 1 });
    const poseBefore = getSystemFlightSnapshot().pose;
    let notifications = 0;
    const receipts: Array<{
      systemId: string;
      worldId: string;
      previousActivationEpoch: number;
      activationEpoch: number;
    }> = [];
    const unsubscribe = subscribeSystemFlight(() => notifications++);
    const unsubscribeHandoffs = subscribeSystemPlanetHandoffCommits(receipt => {
      receipts.push(receipt);
    });

    const committedEpoch = commitSystemPlanetHandoff({
      worldId: '7,-3:p1',
      renderOrigin: [2_200, 40, -10],
      expectedActivationEpoch: targetEpoch
    });
    const committed = getSystemFlightSnapshot();
    unsubscribe();
    unsubscribeHandoffs();

    expect(committedEpoch).toBe(targetEpoch + 1);
    expect(notifications).toBe(1);
    expect(committed).toMatchObject({
      locationMode: 'atmosphere',
      activePlanetId: '7,-3:p1',
      lastActivePlanetId: '7,-3:p1',
      target: null,
      renderOrigin: [2_200, 40, -10]
    });
    expect(committed.pose).toBe(poseBefore);
    expect(receipts).toEqual([{
      systemId: '7,-3',
      worldId: '7,-3:p1',
      previousActivationEpoch: targetEpoch,
      activationEpoch: committedEpoch
    }]);
    expect(Object.isFrozen(receipts[0])).toBe(true);
  });

  it('represents interstellar targets separately from same-system bodies', () => {
    const epoch = commitInterstellarTarget({ x: 12.8, y: -9.3 });
    expect(getSystemFlightSnapshot().activationEpoch).toBe(epoch);
    expect(getSystemFlightSnapshot().target).toEqual({
      kind: 'star_system',
      coordinate: { x: 12, y: -9 },
      systemId: '12,-9'
    });
  });
});

describe('interstellar reset', () => {
  it('is the boundary discontinuity and invalidates the previous system writer', () => {
    const oldWriter = acquireSystemPoseWriter('old-system-ship');
    expect(oldWriter).not.toBeNull();
    expect(updateSystemShipPose(oldWriter!, poseAt([120, 0, 0]))).toBe(true);
    const previousEpoch = getSystemFlightSnapshot().activationEpoch;
    const arrivalPose = poseAt([9_250.25, -100.5, 44]);

    const epoch = resetSystemFlightForInterstellarArrival({
      system: { x: -20, y: 13 },
      layoutVersion: 4,
      locationMode: 'local_space',
      activePlanetId: '-20,13:p2',
      pose: arrivalPose,
      renderOrigin: [8_900, -80, 0]
    });
    const arrived = getSystemFlightSnapshot();

    expect(epoch).toBe(previousEpoch + 1);
    expect(arrived).toMatchObject({
      systemId: '-20,13',
      layoutVersion: 4,
      locationMode: 'local_space',
      activePlanetId: '-20,13:p2',
      lastActivePlanetId: '-20,13:p2',
      target: null,
      activationEpoch: epoch
    });
    expect(arrived.pose).toEqual(arrivalPose);
    expect(updateSystemShipPose(oldWriter!, poseAt([0, 0, 0]))).toBe(false);
    expect(acquireSystemPoseWriter('new-system-ship')).not.toBeNull();
  });

  it('stores immutable copies of externally supplied pose tuples', () => {
    const position: [number, number, number] = [1, 2, 3];
    const pose: SystemShipPose = {
      position,
      velocity: [4, 5, 6],
      quaternion: [0, 0, 0, 1]
    };
    resetSystemFlightForInterstellarArrival({ system: { x: 1, y: 1 }, pose });
    position[0] = 999;

    const stored = getSystemFlightSnapshot();
    expect(stored.pose.position).toEqual([1, 2, 3]);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.pose)).toBe(true);
    expect(Object.isFrozen(stored.pose.position)).toBe(true);
  });
});

function poseAt(position: SystemVectorTuple): SystemShipPose {
  return {
    position,
    velocity: [1, 2, 3],
    quaternion: [0, 0, 0, 1]
  };
}

function subtract(a: SystemVectorTuple, b: SystemVectorTuple): SystemVectorTuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function expectTupleClose(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(EPSILON);
  });
}
