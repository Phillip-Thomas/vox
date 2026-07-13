import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { DeathRenderEffect, getDeathRender } from './DeathRenderEffect.ts';

describe('DeathRenderEffect', () => {
  it('defaults to a no-op and registers the module handle', () => {
    const effect = new DeathRenderEffect();
    expect(effect.uniforms.get('uProgress')!.value).toBe(0);
    expect(getDeathRender()).toBe(effect);
    effect.dispose();
  });

  it('clamps progress and skips hot-path writes while parked', () => {
    const effect = new DeathRenderEffect();
    effect.setFrame(-0.5, 99, 'lava', 1);
    expect(effect.uniforms.get('uProgress')!.value).toBe(0);
    expect(effect.uniforms.get('uTime')!.value).toBe(0); // untouched while parked
    effect.setFrame(2, 12, 'cold', 0);
    expect(effect.uniforms.get('uProgress')!.value).toBe(1);
    expect(effect.uniforms.get('uTime')!.value).toBe(12);
    effect.dispose();
  });

  it('inflects the tint per cause (each cause reads differently)', () => {
    const effect = new DeathRenderEffect();
    const seen = new Set<string>();
    for (const cause of ['cold', 'drowning', 'lava', 'unknown'] as const) {
      effect.setFrame(1, 0, cause, 0);
      seen.add((effect.uniforms.get('uCauseTint')!.value as Color).getHexString());
    }
    expect(seen.size).toBe(4);
    effect.dispose();
  });

  it('ships a structurally sound fragment (paired braces, effect signature)', () => {
    const effect = new DeathRenderEffect();
    const source = effect.getFragmentShader()!;
    expect(source).toContain('void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor)');
    const opens = (source.match(/\{/g) ?? []).length;
    const closes = (source.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
    effect.dispose();
  });
});
