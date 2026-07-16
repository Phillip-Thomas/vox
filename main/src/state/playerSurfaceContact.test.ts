import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLocalPlayerSurfaceContact,
  resetLocalPlayerSurfaceContact,
  setLocalPlayerSurfaceContact
} from './playerSurfaceContact.ts';

beforeEach(() => resetLocalPlayerSurfaceContact());

describe('local player surface contact', () => {
  it('keeps raw feet-in-water distinct from real physical support', () => {
    setLocalPlayerSurfaceContact(true, false);

    expect(getLocalPlayerSurfaceContact()).toEqual({
      feetInWater: true,
      physicallySupported: false
    });
  });

  it('returns snapshots that cannot mutate the publisher-owned state', () => {
    setLocalPlayerSurfaceContact(false, true);
    const snapshot = getLocalPlayerSurfaceContact() as {
      feetInWater: boolean;
      physicallySupported: boolean;
    };
    snapshot.feetInWater = true;
    snapshot.physicallySupported = false;

    expect(getLocalPlayerSurfaceContact()).toEqual({
      feetInWater: false,
      physicallySupported: true
    });
  });

  it('clears both contact channels when the controller leaves the world', () => {
    setLocalPlayerSurfaceContact(true, true);
    resetLocalPlayerSurfaceContact();

    expect(getLocalPlayerSurfaceContact()).toEqual({
      feetInWater: false,
      physicallySupported: false
    });
  });
});
