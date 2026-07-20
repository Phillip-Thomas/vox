import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TIDEGARDEN_CORE_GLOW_TECHNIQUE,
  TIDEGARDEN_DYNAMIC_HERO_LIGHT_COUNT,
  TIDEGARDEN_SCANNER_RESIDENCY,
  TIDEGARDEN_SITE_RING_ROTATION_X,
  tidegardenInteriorGlowOpacity,
  tidegardenCoreVisualPhase
} from './tidegardenSettlementVisualPolicy.ts';

describe('Tidegarden hero-transition render policy', () => {
  it('prewarms the Core and only reveals resident resources on installation', () => {
    expect(tidegardenCoreVisualPhase(false)).toBe('prewarm');
    expect(tidegardenCoreVisualPhase(true)).toBe('revealed');
    expect(TIDEGARDEN_CORE_GLOW_TECHNIQUE).toBe('prewarmed-additive-unlit');
    expect(TIDEGARDEN_DYNAMIC_HERO_LIGHT_COUNT).toBe(0);
    expect(TIDEGARDEN_SCANNER_RESIDENCY).toBe('resident-through-observation');
  });

  it('faces the site ring outward and eases the correctly centered interior glow', () => {
    expect(TIDEGARDEN_SITE_RING_ROTATION_X).toBe(-Math.PI / 2);
    expect(tidegardenInteriorGlowOpacity({
      active: true,
      certified: true,
      distanceFromGlowCenter: 3.4,
      pulse: 1
    })).toBe(0);
    expect(tidegardenInteriorGlowOpacity({
      active: true,
      certified: true,
      distanceFromGlowCenter: 3,
      pulse: 1
    })).toBeCloseTo(0.04);
    expect(tidegardenInteriorGlowOpacity({
      active: false,
      certified: true,
      distanceFromGlowCenter: 0,
      pulse: 1
    })).toBe(0);
  });

  it('forbids dynamic light cardinality and requires additive unlit glow', () => {
    const source = readFileSync(new URL('./TidegardenSettlementWorld.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/<(?:point|spot|directional|hemisphere|rectArea)Light\b/);
    expect(source).not.toMatch(/new THREE\.(?:PointLight|SpotLight|DirectionalLight|HemisphereLight|RectAreaLight)\b/);
    expect(source).toContain('blending={THREE.AdditiveBlending}');
    expect(source).toContain('toneMapped={false}');
    expect(source).toContain('frustumCulled={false}');
    expect(source).toMatch(/<HabitatCoreVisual[\s\S]*active=\{Boolean\(corePosition\)\}/);
    expect(source).not.toContain('if (observed) return null');
  });
});
