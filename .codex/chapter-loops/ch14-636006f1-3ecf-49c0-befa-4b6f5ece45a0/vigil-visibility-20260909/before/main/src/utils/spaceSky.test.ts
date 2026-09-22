import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CONSTELLATION_TUNING,
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  dayFactorFromDaylight,
  updateSpaceSky
} from './spaceSky';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem';

describe('dayFactorFromDaylight', () => {
  it('is 0 in full dark and 1 in full daylight', () => {
    expect(dayFactorFromDaylight(0)).toBeCloseTo(0, 6);
    expect(dayFactorFromDaylight(1)).toBeCloseTo(1, 6);
  });

  it('monotonically increases as daylight increases', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map(dayFactorFromDaylight);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-9);
    }
  });

  it('stays within [0,1] and clamps out-of-range input', () => {
    for (const d of [-1, -0.2, 0.3, 1.4, 5]) {
      const v = dayFactorFromDaylight(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('createSpaceSkyMaterial', () => {
  it('is a depthless camera backdrop: back side, fog off, drawn first', () => {
    const mat = createSpaceSkyMaterial();
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.transparent).toBe(false);
    expect(mat.depthWrite).toBe(false);
    expect(mat.depthTest).toBe(false);
    expect(mat.fog).toBe(false);
    expect(SPACE_DOME_RENDER_ORDER).toBeLessThan(0);
    expect(SPACE_DOME_RADIUS).toBeGreaterThan(100);
    expect(SPACE_DOME_RADIUS).toBeLessThan(250); // inside the far plane
  });

  it('exposes the unified day-cycle uniforms', () => {
    const mat = createSpaceSkyMaterial();
    expect(mat.uniforms.uTime.value).toBe(0);
    expect(mat.uniforms.uDay.value).toBe(0);
    expect(mat.uniforms.uGolden.value).toBe(0);
    expect(mat.uniforms.uSunDir.value).toBeInstanceOf(THREE.Vector3);
    expect(mat.uniforms.uMoonDir.value).toBeInstanceOf(THREE.Vector3);
    expect(mat.uniforms.uRealityChroma.value).toBe(1);
    expect(mat.uniforms.uRealityDetail.value).toBe(1);
    expect(mat.uniforms.uRealityAtmosphere.value).toBe(1);
  });
});

describe('CONSTELLATION_TUNING', () => {
  it('keeps node points crisp: core Gaussian tighter than the halo lobe', () => {
    expect(CONSTELLATION_TUNING.nodeCoreSize).toBeGreaterThan(CONSTELLATION_TUNING.nodeHaloSize);
    // core sigma = 1/sqrt(size) in radians; must stay under ~0.6 deg (no blobs)
    const coreSigmaDeg = (1 / Math.sqrt(CONSTELLATION_TUNING.nodeCoreSize)) * (180 / Math.PI);
    expect(coreSigmaDeg).toBeLessThan(0.6);
    expect(CONSTELLATION_TUNING.nodeHaloGain).toBeGreaterThan(0);
    expect(CONSTELLATION_TUNING.nodeHaloGain).toBeLessThan(1); // halo stays subordinate
  });

  it('gives lines a flat core inside a wider feather, at legible gain', () => {
    expect(CONSTELLATION_TUNING.lineCore).toBeGreaterThan(0);
    expect(CONSTELLATION_TUNING.lineCore).toBeLessThan(CONSTELLATION_TUNING.lineWidth);
    expect(CONSTELLATION_TUNING.lineGain).toBeGreaterThan(0.2); // pronounced …
    expect(CONSTELLATION_TUNING.lineGain).toBeLessThan(1.0);    // … but under star peaks (not HUD)
  });

  it('orders the reveal: nodes kindle first, lines complete before reveal=1', () => {
    const t = CONSTELLATION_TUNING;
    expect(t.lineRevealStart).toBeGreaterThan(0);
    expect(t.lineRevealStart).toBeLessThan(t.starRevealEnd);   // stars wake before lines draw
    expect(t.lineRevealEnd).toBeGreaterThan(t.lineRevealStart);
    expect(t.lineRevealEnd).toBeLessThan(1);                   // legible before full reveal
  });

  it('keeps a sky-wide figure count in the authored 6..16 band', () => {
    const cells = 6 * CONSTELLATION_TUNING.grid ** 2;
    const figures = cells * CONSTELLATION_TUNING.figureOdds;
    expect(figures).toBeGreaterThanOrEqual(6);
    expect(figures).toBeLessThanOrEqual(16);
  });

  it('interpolates every constant into the shader as a GLSL float literal', () => {
    const frag = createSpaceSkyMaterial().fragmentShader;
    expect(frag).not.toContain('undefined');
    expect(frag).not.toContain('NaN');
    for (const [name, value] of Object.entries(CONSTELLATION_TUNING)) {
      const literal = String(value).includes('.') ? String(value) : `${value}.0`;
      expect(frag, `missing ${name}=${literal}`).toContain(literal);
    }
    // the seam-free cube-face lattice is in place (no volumetric floor lookup)
    expect(frag).toContain('CONST_GRID');
    expect(frag).not.toContain('CONST_CELLS');
  });
});

describe('updateSpaceSky', () => {
  it('writes time, day factor, golden, and a normalized sun direction', () => {
    const mat = createSpaceSkyMaterial();
    const sun = new THREE.Vector3(0, 10, 0); // un-normalized on purpose
    const moon = new THREE.Vector3(0, -10, 0);
    const day = updateSpaceSky(mat, 12.5, 0, 0, sun, moon);

    expect(mat.uniforms.uTime.value).toBe(12.5);
    expect(day).toBeCloseTo(0, 6); // daylight 0 -> day factor 0 (night)
    expect(mat.uniforms.uDay.value).toBeCloseTo(0, 6);
    expect(mat.uniforms.uSunDir.value.length()).toBeCloseTo(1, 6);
    expect(mat.uniforms.uSunDir.value.y).toBeCloseTo(1, 6);
    expect(mat.uniforms.uMoonDir.value.length()).toBeCloseTo(1, 6);
    expect(mat.uniforms.uMoonDir.value.y).toBeCloseTo(-1, 6);
  });

  it('drives day toward 1 at midday and forwards golden', () => {
    const mat = createSpaceSkyMaterial();
    const day = updateSpaceSky(mat, 0, 1, 0.4, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    expect(day).toBeCloseTo(1, 6);
    expect(mat.uniforms.uDay.value).toBeCloseTo(1, 6);
    expect(mat.uniforms.uGolden.value).toBeCloseTo(0.4, 6);
  });

  it('does not mutate the passed-in sun vector', () => {
    const mat = createSpaceSkyMaterial();
    const sun = new THREE.Vector3(0, 10, 0);
    const moon = new THREE.Vector3(0, -10, 0);
    updateSpaceSky(mat, 0, 0.5, 0, sun, moon);
    expect(sun.y).toBe(10); // caller's vector untouched
    expect(moon.y).toBe(-10);
  });

  it('applies reality effects to chroma, detail, atmosphere, and cloud quality', () => {
    const mat = createSpaceSkyMaterial();
    updateSpaceSky(
      mat,
      0,
      1,
      0,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 1, 0),
      1,
      VOXEL_REALITY_PRESETS.bare
    );
    expect(mat.uniforms.uRealityChroma.value).toBe(0);
    expect(mat.uniforms.uRealityDetail.value).toBe(0);
    expect(mat.uniforms.uRealityAtmosphere.value).toBe(0);
    expect(mat.uniforms.uCloudQuality.value).toBe(0);

    updateSpaceSky(
      mat,
      0,
      1,
      0,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 1, 0),
      1,
      VOXEL_REALITY_PRESETS.material
    );
    expect(mat.uniforms.uRealityChroma.value).toBe(1);
    expect(mat.uniforms.uRealityDetail.value).toBeCloseTo(0.58, 6);
    expect(mat.uniforms.uCloudQuality.value).toBeCloseTo(0.28, 6);
  });
});
