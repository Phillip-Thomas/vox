import { describe, expect, it } from 'vitest';
import {
  COCKPIT_INSTRUMENT_X_SCALE_FLOOR,
  COCKPIT_SHELL_X_SCALE_FLOOR,
  getShipCockpitViewportLayout
} from './shipCockpitLayout.ts';

describe('ship cockpit viewport layout', () => {
  it('keeps the portrait shell out of the forward aperture instead of crushing the rig', () => {
    const portrait = getShipCockpitViewportLayout(390, 844);
    const formerWholeRigScale = (390 / 844) / 1.42;

    expect(formerWholeRigScale).toBeCloseTo(0.325, 3);
    expect(portrait.shellScaleX).toBe(COCKPIT_SHELL_X_SCALE_FLOOR);
    expect(portrait.shellScaleX).toBeGreaterThan(formerWholeRigScale * 2);
    expect(portrait.shellScaleX).toBeGreaterThan(portrait.instrumentScaleX);
  });

  it('retains a readable central instrument scale in portrait relative to landscape', () => {
    const portrait = getShipCockpitViewportLayout(390, 844);
    const landscape = getShipCockpitViewportLayout(1440, 900);

    expect(portrait.instrumentScaleX).toBe(COCKPIT_INSTRUMENT_X_SCALE_FLOOR);
    expect(portrait.instrumentScaleX / landscape.instrumentScaleX).toBeGreaterThanOrEqual(0.7);
    expect(landscape.shellScaleX).toBe(1);
    expect(landscape.instrumentScaleX).toBe(1);
  });

  it('eases both layers back to their authored width before wide landscape', () => {
    const tabletLandscape = getShipCockpitViewportLayout(1024, 768);
    const wide = getShipCockpitViewportLayout(1920, 1080);

    expect(tabletLandscape.shellScaleX).toBeGreaterThan(COCKPIT_SHELL_X_SCALE_FLOOR);
    expect(tabletLandscape.instrumentScaleX).toBe(tabletLandscape.shellScaleX);
    expect(tabletLandscape.shellScaleX).toBeLessThan(1);
    expect(wide.shellScaleX).toBe(1);
    expect(wide.instrumentScaleX).toBe(1);
  });

  it('returns bounded finite layout values for a transient zero-sized canvas', () => {
    const layout = getShipCockpitViewportLayout(0, 0);

    expect(layout.aspect).toBe(1);
    expect(layout.shellScaleX).toBeGreaterThanOrEqual(COCKPIT_SHELL_X_SCALE_FLOOR);
    expect(layout.instrumentScaleX).toBeGreaterThanOrEqual(COCKPIT_INSTRUMENT_X_SCALE_FLOOR);
  });
});
