import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  dayFactorFromDaylight,
  nightFactorFromDaylight,
  updateSpaceSky
} from './spaceSky';

describe('nightFactorFromDaylight', () => {
  it('is 1 in full dark and 0 in full daylight', () => {
    expect(nightFactorFromDaylight(0)).toBeCloseTo(1, 6);
    expect(nightFactorFromDaylight(1)).toBeCloseTo(0, 6);
  });

  it('monotonically increases as daylight decreases', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map(nightFactorFromDaylight);
    for (let i = 1; i < samples.length; i++) {
      // daylight increasing -> night decreasing
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9);
    }
  });

  it('stays within [0,1] and clamps out-of-range input', () => {
    for (const d of [-1, -0.2, 0.3, 1.4, 5]) {
      const n = nightFactorFromDaylight(d);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

describe('dayFactorFromDaylight', () => {
  it('is 0 in full dark and 1 in full daylight (mirror of night)', () => {
    expect(dayFactorFromDaylight(0)).toBeCloseTo(0, 6);
    expect(dayFactorFromDaylight(1)).toBeCloseTo(1, 6);
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
  it('renders behind the scene with fog and depth-write disabled', () => {
    const mat = createSpaceSkyMaterial();
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.depthWrite).toBe(false);
    expect(mat.fog).toBe(false);
    expect(SPACE_DOME_RENDER_ORDER).toBeLessThan(0);
    expect(SPACE_DOME_RADIUS).toBeGreaterThan(100);
    expect(SPACE_DOME_RADIUS).toBeLessThan(250); // inside the far plane
  });

  it('exposes the day-cycle uniforms', () => {
    const mat = createSpaceSkyMaterial();
    expect(mat.uniforms.uTime.value).toBe(0);
    expect(mat.uniforms.uNight.value).toBe(1);
    expect(mat.uniforms.uDay.value).toBe(0);
    expect(mat.uniforms.uSunDir.value).toBeInstanceOf(THREE.Vector3);
    expect(mat.uniforms.uMoonDir.value).toBeInstanceOf(THREE.Vector3);
  });
});

describe('updateSpaceSky', () => {
  it('writes time, night factor and a normalized sun direction', () => {
    const mat = createSpaceSkyMaterial();
    const sun = new THREE.Vector3(0, 10, 0); // un-normalized on purpose
    const moon = new THREE.Vector3(0, -10, 0);
    const night = updateSpaceSky(mat, 12.5, 0, sun, moon);

    expect(mat.uniforms.uTime.value).toBe(12.5);
    expect(night).toBeCloseTo(1, 6);
    expect(mat.uniforms.uNight.value).toBeCloseTo(1, 6);
    expect(mat.uniforms.uSunDir.value.length()).toBeCloseTo(1, 6);
    expect(mat.uniforms.uSunDir.value.y).toBeCloseTo(1, 6);
    expect(mat.uniforms.uMoonDir.value.length()).toBeCloseTo(1, 6);
    expect(mat.uniforms.uMoonDir.value.y).toBeCloseTo(-1, 6);
  });

  it('drives night toward 0 at midday', () => {
    const mat = createSpaceSkyMaterial();
    const night = updateSpaceSky(mat, 0, 1, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    expect(night).toBeCloseTo(0, 6);
    expect(mat.uniforms.uNight.value).toBeCloseTo(0, 6);
    // The faint daytime celestial layer is driven by uDay, full at midday.
    expect(mat.uniforms.uDay.value).toBeCloseTo(1, 6);
  });

  it('does not mutate the passed-in sun vector', () => {
    const mat = createSpaceSkyMaterial();
    const sun = new THREE.Vector3(0, 10, 0);
    const moon = new THREE.Vector3(0, -10, 0);
    updateSpaceSky(mat, 0, 0.5, sun, moon);
    expect(sun.y).toBe(10); // caller's vector untouched
    expect(moon.y).toBe(-10);
  });
});
