import { describe, expect, it } from 'vitest';
import {
  LOCAL_SYSTEM_FLIGHT_CAMERA_FAR,
  MAX_LOCAL_SYSTEM_BODY_SEPARATION,
  REMOTE_SYSTEM_BASE_DISTANCE,
  REMOTE_SYSTEM_MAX_HALO_DEGREES,
  angularDiameterRadians,
  maxRemoteSystemAngularDiameter,
  maxRemoteSystemCoreAngularDiameter,
  minLocalPlanetAngularDiameter,
  remoteSystemProxyTriangleBudget
} from './celestialRenderScale.ts';
import { buildStarSystemManifest } from './starSystem.ts';

describe('celestial render scale', () => {
  it('covers every deterministic local-system pair with depth to spare', () => {
    for (let x = -40; x <= 40; x++) {
      for (let y = -40; y <= 40; y++) {
        const planets = buildStarSystemManifest({ x, y }, { bodyCountOverride: 3 }).planets;
        for (let a = 0; a < planets.length; a++) {
          for (let b = a + 1; b < planets.length; b++) {
            const pa = planets[a].systemPosition;
            const pb = planets[b].systemPosition;
            expect(Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]))
              .toBeLessThan(MAX_LOCAL_SYSTEM_BODY_SEPARATION);
          }
        }
      }
    }
    expect(LOCAL_SYSTEM_FLIGHT_CAMERA_FAR).toBeGreaterThan(REMOTE_SYSTEM_BASE_DISTANCE);
  });

  it('keeps the sun-core silhouette at least three times smaller than a local planet', () => {
    expect(minLocalPlanetAngularDiameter() / maxRemoteSystemCoreAngularDiameter()).toBeGreaterThan(3);
    expect(maxRemoteSystemCoreAngularDiameter() * 180 / Math.PI).toBeLessThan(0.5);
  });

  it('caps the translucent halo envelope at its documented angular budget', () => {
    expect(maxRemoteSystemAngularDiameter() * 180 / Math.PI)
      .toBeLessThan(REMOTE_SYSTEM_MAX_HALO_DEGREES);
  });

  it('projects finite angular diameters defensively', () => {
    expect(angularDiameterRadians(50, 2_000)).toBeGreaterThan(0);
    expect(angularDiameterRadians(50, 0)).toBe(0);
    expect(angularDiameterRadians(Number.NaN, 2_000)).toBe(0);
  });

  it('keeps the complete unresolved-system tier below 25k triangles', () => {
    expect(remoteSystemProxyTriangleBudget()).toBeLessThan(25_000);
  });
});
