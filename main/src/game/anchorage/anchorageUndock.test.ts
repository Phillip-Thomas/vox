import { describe, expect, it } from 'vitest';
import { anchorageBody, systemToStationLocal } from './anchorageBody.ts';
import { parseUndockFlag, requestedUndockAddress, undockedShipPose } from './anchorageUndock.ts';

const ADDRESS = { system: { x: -19, y: -17 }, index: 0 };

describe('the undock flag', () => {
  it('accepts the coordinate form the handoff writes', () => {
    expect(parseUndockFlag('-19,-17,0')).toEqual(ADDRESS);
    expect(parseUndockFlag(' 4 , -7 , 2 ')).toEqual({ system: { x: 4, y: -7 }, index: 2 });
  });

  it('also accepts a world id, because that is what the rest of the game passes', () => {
    expect(parseUndockFlag('-19,-17:a0')).toEqual(ADDRESS);
  });

  it('rejects rubbish rather than guessing', () => {
    for (const raw of [null, '', 'nonsense', '1,2', '1,2,3,4', 'a,b,c', '-19,-17:p1']) {
      expect(parseUndockFlag(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it('clamps a negative index rather than producing a station that cannot exist', () => {
    expect(parseUndockFlag('0,0,-5')?.index).toBe(0);
  });

  it('reads the flag out of a query string', () => {
    expect(requestedUndockAddress('?fly=1&undock=-19,-17,0')).toEqual(ADDRESS);
    expect(requestedUndockAddress('?fly=1')).toBeNull();
  });
});

describe('where the ship reappears', () => {
  const body = anchorageBody(ADDRESS);
  const pose = undockedShipPose(ADDRESS);

  it('is exactly the berth it was clamped to', () => {
    // The whole reason nothing has to be persisted across the navigation: this is
    // derived from the address, so it cannot drift from where the ship docked.
    expect(pose.position[0]).toBeCloseTo(body.berth[0], 6);
    expect(pose.position[1]).toBeCloseTo(body.berth[1], 6);
    expect(pose.position[2]).toBeCloseTo(body.berth[2], 6);
  });

  it('is on the dock mouth axis, not the station centreline', () => {
    const local = systemToStationLocal(body, [
      pose.position[0],
      pose.position[1],
      pose.position[2]
    ]);
    for (const axis of [0, 1, 2] as const) {
      expect(local[axis]).toBeCloseTo(body.berthLocal[axis], 4);
    }
  });

  it('comes to rest rather than drifting into the hull it just left', () => {
    expect(pose.velocity).toEqual([0, 0, 0]);
  });

  it('faces back down the corridor at the station', () => {
    // A ship that pushes back from a dock is looking at the dock. Turning away is
    // the player's first act, not something that happened to them.
    const [x, y, z, w] = pose.quaternion;
    // Rotate -Z by the quaternion and check it lands on the approach axis.
    const v: [number, number, number] = [0, 0, -1];
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    const forward = [
      v[0] + w * tx + (y * tz - z * ty),
      v[1] + w * ty + (z * tx - x * tz),
      v[2] + w * tz + (x * ty - y * tx)
    ];
    for (const axis of [0, 1, 2] as const) {
      expect(forward[axis]).toBeCloseTo(body.approachAxis[axis], 5);
    }
  });

  it('produces a unit quaternion', () => {
    expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 9);
  });

  it('round-trips: dock from the berth, undock back to it', () => {
    // The claim the whole loop rests on. Where you park is where you find the ship.
    const again = undockedShipPose(ADDRESS);
    expect(again.position).toEqual(pose.position);
    expect(again.quaternion).toEqual(pose.quaternion);
  });
});
