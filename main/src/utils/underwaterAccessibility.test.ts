import { describe, expect, it } from 'vitest';
import {
  REDUCED_FLASH_OXYGEN_VIGNETTE,
  WATERLINE_WIPE_SECONDS,
  nextWaterlineWipe,
  resolveLowOxygenVignette,
  resolveUnderwaterAccessibilityPolicy
} from './underwaterAccessibility.ts';

describe('underwater accessibility policy', () => {
  it('preserves the shipped motion and transient treatments by default', () => {
    const policy = resolveUnderwaterAccessibilityPolicy({
      reducedMotion: false,
      reducedFlash: false
    });

    expect(policy).toMatchObject({
      cameraSwayScale: 1,
      refractionWobbleScale: 1,
      animateWaterlineWipe: true,
      animateLowOxygenVignette: true
    });
    expect(nextWaterlineWipe(0, true, 0.035, policy)).toBeCloseTo(0.9);
    expect(resolveLowOxygenVignette(24, Math.PI / 14, policy)).toBeCloseTo(1);
  });

  it('removes camera/refraction motion and replaces transient flashes with steady evidence', () => {
    const policy = resolveUnderwaterAccessibilityPolicy({
      reducedMotion: true,
      reducedFlash: false
    });

    expect(policy).toMatchObject({
      cameraSwayScale: 0,
      refractionWobbleScale: 0,
      animateWaterlineWipe: false,
      animateLowOxygenVignette: false
    });
    expect(nextWaterlineWipe(1, false, WATERLINE_WIPE_SECONDS / 2, policy)).toBe(0);
    expect(resolveLowOxygenVignette(10, 100, policy)).toBe(REDUCED_FLASH_OXYGEN_VIGNETTE);
  });

  it('honors reduced flash without removing continuous underwater motion', () => {
    const policy = resolveUnderwaterAccessibilityPolicy({
      reducedMotion: false,
      reducedFlash: true
    });

    expect(policy.cameraSwayScale).toBe(1);
    expect(policy.refractionWobbleScale).toBe(1);
    expect(policy.animateWaterlineWipe).toBe(false);
    expect(resolveLowOxygenVignette(24.9, 0, policy)).toBe(REDUCED_FLASH_OXYGEN_VIGNETTE);
    expect(resolveLowOxygenVignette(25, 0, policy)).toBe(0);
  });
});
