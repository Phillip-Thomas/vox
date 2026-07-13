import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLavaImmersion,
  isCameraInLava,
  isFeetInLava,
  resetLavaImmersion,
  setLocalLavaImmersion
} from './playerLavaImmersion.ts';

beforeEach(() => resetLavaImmersion());

describe('player lava immersion state', () => {
  it('starts clear of the melt', () => {
    expect(getLavaImmersion()).toBe(0);
    expect(isFeetInLava()).toBe(false);
    expect(isCameraInLava()).toBe(false);
  });

  it('publishes the physics-step signals for the HUD heat pass', () => {
    setLocalLavaImmersion(0.7, true, false);
    expect(getLavaImmersion()).toBe(0.7);
    expect(isFeetInLava()).toBe(true);
    expect(isCameraInLava()).toBe(false);
  });

  it('keeps the molten-wash channel on the CAMERA, separate from the body signals', () => {
    // Burning body, dry external camera (survey chart / side rig): no wash.
    setLocalLavaImmersion(1, true, false);
    expect(isCameraInLava()).toBe(false);
    // First-person eye under the melt: wash on.
    setLocalLavaImmersion(1, true, true);
    expect(isCameraInLava()).toBe(true);
  });

  it('normalizes the immersion factor (clamped 0..1, NaN-safe)', () => {
    setLocalLavaImmersion(3, true, true);
    expect(getLavaImmersion()).toBe(1);
    setLocalLavaImmersion(-1, false, false);
    expect(getLavaImmersion()).toBe(0);
    setLocalLavaImmersion(NaN, false, false);
    expect(getLavaImmersion()).toBe(0);
  });

  it('resets fully (on-foot controller unmount: board ship / leave world)', () => {
    setLocalLavaImmersion(1, true, true);
    resetLavaImmersion();
    expect(getLavaImmersion()).toBe(0);
    expect(isFeetInLava()).toBe(false);
    expect(isCameraInLava()).toBe(false);
  });
});
