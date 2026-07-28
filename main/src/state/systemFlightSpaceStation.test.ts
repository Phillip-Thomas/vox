import { beforeEach, describe, expect, it } from 'vitest';
import { spaceStationWorldId } from '../game/spaceStation/spaceStationAddress.ts';
import { planetWorldId } from '../game/starSystem.ts';
import {
  cancelSystemTarget,
  commitSpaceStationTarget,
  commitInterstellarTarget,
  commitSystemBodyTarget,
  getSystemFlightSnapshot,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests
} from './systemFlight.ts';

/**
 * SpaceStation targets in the shipped flight store.
 *
 * The point of these is less that the new kind works and more that adding it did
 * not quietly change what a planet target means. Every existing reader in the
 * codebase asks `kind === 'system_body'`; if a station could ever answer yes to
 * that, terrain preparation would start being asked to generate a space station.
 */

const SYSTEM = { x: 4, y: -7 };

beforeEach(() => {
  resetSystemFlightStoreForTests();
  resetSystemFlightForInterstellarArrival({
    system: SYSTEM,
    pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
  });
});

describe('spaceStation targets', () => {
  it('commits and publishes an spaceStation world id', () => {
    const epoch = commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    const { target, activationEpoch } = getSystemFlightSnapshot();
    expect(activationEpoch).toBe(epoch);
    expect(target?.kind).toBe('space_station');
    expect(target && 'worldId' in target ? target.worldId : null).toBe(
      spaceStationWorldId({ system: SYSTEM, index: 0 })
    );
  });

  it('is never mistaken for a planet target', () => {
    commitSpaceStationTarget({ system: SYSTEM, index: 1 });
    const { target } = getSystemFlightSnapshot();
    // The exact test every consumer in the codebase performs.
    expect(target?.kind === 'system_body').toBe(false);
    // And the two grammars stay disjoint, so no planet parser can accept one.
    const spaceStationId = spaceStationWorldId({ system: SYSTEM, index: 1 });
    expect(spaceStationId).not.toBe(planetWorldId({ system: SYSTEM, slot: 1 }));
    expect(spaceStationId).toMatch(/:a1$/);
  });

  it('advances the activation epoch like any other target', () => {
    const before = getSystemFlightSnapshot().activationEpoch;
    const epoch = commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    expect(epoch).toBe(before + 1);
  });

  it('refuses an spaceStation belonging to another system', () => {
    expect(() => commitSpaceStationTarget({ system: { x: 99, y: 99 }, index: 0 })).toThrow(
      /current star system/
    );
    expect(getSystemFlightSnapshot().target).toBeNull();
  });

  it('normalises the address it stores', () => {
    commitSpaceStationTarget({ system: SYSTEM, index: -3 });
    const { target } = getSystemFlightSnapshot();
    expect(target?.kind === 'space_station' ? target.address.index : null).toBe(0);
  });

  it('leaves the resident planet alone', () => {
    // Flying to a station changes nothing about which world is loaded. An
    // spaceStation that evicted the active planet would strand live terrain.
    const planetEpoch = commitSystemBodyTarget({ system: SYSTEM, slot: 0 });
    expect(planetEpoch).toBeGreaterThan(0);
    const residentBefore = getSystemFlightSnapshot().activePlanetId;
    commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    expect(getSystemFlightSnapshot().activePlanetId).toBe(residentBefore);
  });

  it('is replaced by a planet target and by cancellation, like any other', () => {
    commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    commitSystemBodyTarget({ system: SYSTEM, slot: 0 });
    expect(getSystemFlightSnapshot().target?.kind).toBe('system_body');

    commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    cancelSystemTarget();
    expect(getSystemFlightSnapshot().target).toBeNull();
  });

  it('is replaced by an interstellar target without corrupting its shape', () => {
    commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    commitInterstellarTarget({ x: 41, y: 41 });
    const { target } = getSystemFlightSnapshot();
    expect(target?.kind).toBe('star_system');
    // The old freeze path assumed anything not a planet carried a coordinate;
    // this is the assertion that would have caught that.
    expect(target && 'coordinate' in target ? target.coordinate : null).toEqual({ x: 41, y: 41 });
  });

  it('freezes the address it publishes', () => {
    commitSpaceStationTarget({ system: SYSTEM, index: 0 });
    const { target } = getSystemFlightSnapshot();
    if (target?.kind !== 'space_station') throw new Error('expected an spaceStation target');
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.address)).toBe(true);
    expect(Object.isFrozen(target.address.system)).toBe(true);
  });
});
