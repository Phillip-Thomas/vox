import { describe, expect, it } from 'vitest';
import { UnderwaterEffect } from './UnderwaterEffect.ts';

describe('UnderwaterEffect', () => {
  it('disables and restores only refraction wobble through the frame policy', () => {
    const effect = new UnderwaterEffect({ wobble: 0.6 });

    expect(effect.uniforms.get('uWobble')!.value).toBe(0.6);
    effect.setFrame(1, 2, -100, -100, 0, 0.5, 0);
    expect(effect.uniforms.get('uWobble')!.value).toBe(0);
    expect(effect.uniforms.get('uVignette')!.value).toBe(0.5);

    effect.setFrame(1, 3, -100, -100, 0, 0, 1);
    expect(effect.uniforms.get('uWobble')!.value).toBe(0.6);
    effect.dispose();
  });
});
