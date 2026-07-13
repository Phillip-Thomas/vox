import { describe, expect, it } from 'vitest';
import { FlightMotionEffect } from './FlightMotionEffect.ts';

describe('FlightMotionEffect', () => {
  it('clamps its hot-path uniforms and defaults to a no-op', () => {
    const effect = new FlightMotionEffect();
    expect(effect.uniforms.get('uMotion')!.value).toBe(0);
    effect.setFrame(4, -2);
    expect(effect.uniforms.get('uMotion')!.value).toBe(1);
    expect(effect.uniforms.get('uBoost')!.value).toBe(0);
    effect.dispose();
  });
});
