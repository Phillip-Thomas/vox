import { describe, expect, it } from 'vitest';
import { resolveShipExteriorVisualState } from './SpaceshipPlaceholder.tsx';

describe('ship exterior restoration visuals', () => {
  it('never renders the intact powered ship beneath early wreck stages', () => {
    expect(resolveShipExteriorVisualState('wrecked')).toEqual({
      hullVisible: false,
      canopyVisible: false,
      thrustersVisible: false,
      beaconVisible: false
    });
    expect(resolveShipExteriorVisualState('frame_restored')).toEqual({
      hullVisible: false,
      canopyVisible: false,
      thrustersVisible: false,
      beaconVisible: false
    });
  });

  it('reveals boundary, pulse, and navigation light monotonically', () => {
    expect(resolveShipExteriorVisualState('hull_sealed')).toEqual({
      hullVisible: true,
      canopyVisible: true,
      thrustersVisible: false,
      beaconVisible: false
    });
    expect(resolveShipExteriorVisualState('lift_online')).toEqual({
      hullVisible: true,
      canopyVisible: true,
      thrustersVisible: true,
      beaconVisible: false
    });
    expect(resolveShipExteriorVisualState('flight_ready')).toEqual({
      hullVisible: true,
      canopyVisible: true,
      thrustersVisible: true,
      beaconVisible: true
    });
  });

  it('keeps ordinary sandbox ships complete when no story stage is supplied', () => {
    expect(resolveShipExteriorVisualState()).toEqual({
      hullVisible: true,
      canopyVisible: true,
      thrustersVisible: true,
      beaconVisible: true
    });
  });
});
