import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { localSunElevation, daylightFromElevation, goldenFromElevation, localDaylight } from './dayNight';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

describe('local day/night model (chase-the-light)', () => {
  it('elevation tracks sun vs local up, not world-Y', () => {
    // On the +X face (up = +X), a sun pointing +X is local NOON regardless of its world-Y.
    expect(localSunElevation(v(1, 0, 0), v(1, 0, 0))).toBeCloseTo(1, 5);   // overhead
    expect(localSunElevation(v(-1, 0, 0), v(1, 0, 0))).toBeCloseTo(-1, 5); // underfoot
    expect(localSunElevation(v(0, 1, 0), v(1, 0, 0))).toBeCloseTo(0, 5);   // on the terminator
  });

  it('daylight: bright when sun is up locally, dark when down', () => {
    expect(daylightFromElevation(1)).toBeCloseTo(1, 5);
    expect(daylightFromElevation(-1)).toBeCloseTo(0, 5);
    expect(daylightFromElevation(0.5)).toBeGreaterThan(0.99);
    expect(daylightFromElevation(-0.3)).toBeCloseTo(0, 5);
  });

  it('a sun-facing hemisphere is day, the far side is night (the terminator)', () => {
    const sun = v(1, 0, 0);
    expect(localDaylight(sun, v(1, 0, 0))).toBeGreaterThan(0.99);  // sub-solar = day
    expect(localDaylight(sun, v(-1, 0, 0))).toBeCloseTo(0, 5);     // anti-solar = night
    // crossing the terminator (up perpendicular to sun) is twilight, between 0 and 1.
    const dusk = localDaylight(sun, v(0, 1, 0));
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
  });

  it('golden peaks near the horizon, ~0 at noon and night', () => {
    expect(goldenFromElevation(1)).toBeCloseTo(0, 5);    // noon: no warmth
    expect(goldenFromElevation(-1)).toBeCloseTo(0, 5);   // night: none
    expect(goldenFromElevation(0.08)).toBeGreaterThan(0.5); // low sun = golden
  });

  it('never stuck: some local up is always fully lit and some fully dark', () => {
    for (let i = 0; i < 200; i++) {
      const a = (i * 2654435761) >>> 0;
      const sun = v(((a & 255) / 128) - 1, (((a >> 8) & 255) / 128) - 1, (((a >> 16) & 255) / 128) - 1);
      if (sun.lengthSq() < 1e-4) continue;
      // up == sun  -> day ; up == -sun -> night. Always reachable by moving.
      expect(localDaylight(sun, sun.clone())).toBeGreaterThan(0.99);
      expect(localDaylight(sun, sun.clone().negate())).toBeCloseTo(0, 5);
    }
  });
});
