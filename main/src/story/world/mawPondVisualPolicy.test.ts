import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAW_POND_GLOW_TECHNIQUE,
  resolveMawPondVisualPhase
} from './mawPondVisualPolicy.ts';

describe('Maw pond hero-transition render policy', () => {
  it('prewarms before the Ch5 direction handback and reveals only after direction resolves', () => {
    expect(resolveMawPondVisualPhase(true, 'a4-exhale', false)).toBe('prewarm');
    expect(resolveMawPondVisualPhase(true, 'ch5-maw', false)).toBe('prewarm');
    expect(resolveMawPondVisualPhase(true, 'ch5-maw', true)).toBe('revealed');
    expect(resolveMawPondVisualPhase(true, 'ch6-dive', true)).toBe('revealed');
    expect(resolveMawPondVisualPhase(false, 'ch5-maw', true)).toBe('absent');
    expect(resolveMawPondVisualPhase(true, 'ch7-reconstruct', true)).toBe('absent');
    expect(MAW_POND_GLOW_TECHNIQUE).toBe('prewarmed-additive-unlit');
  });

  it('forbids light-cardinality and lit-material changes in the F-triggered response', () => {
    const source = readFileSync(new URL('./MawPondResonance.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/<(?:point|spot|directional|hemisphere|rectArea)Light\b/);
    expect(source).not.toMatch(/new THREE\.(?:PointLight|SpotLight|DirectionalLight|HemisphereLight|RectAreaLight)\b/);
    expect(source).not.toContain('<meshStandardMaterial');
    expect(source).toContain('blending={THREE.AdditiveBlending}');
    expect(source).toContain('toneMapped={false}');
    expect(source).toContain('frustumCulled={false}');
  });
});
