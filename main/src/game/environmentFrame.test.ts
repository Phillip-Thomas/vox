import { describe, expect, it } from 'vitest';
import {
  atmosphereInfluenceAtDistance,
  directionalStarFrame,
  resolveEnvironmentFrame,
  type AtmosphereSurfaceBands
} from './environmentFrame.ts';
import {
  buildStarSystemManifest,
  type PlanetDescriptor,
  type StarSystemManifest,
  type Vec3Tuple
} from './starSystem.ts';

const ATMOSPHERE: AtmosphereSurfaceBands = {
  innerSurfaceDistance: 20,
  outerSurfaceDistance: 100
};

describe('environment frame', () => {
  it('uses a pure space environment instead of a stale current world in mid-system space', () => {
    const manifest = buildStarSystemManifest({ x: 4, y: -2 }, { bodyCountOverride: 2 });
    const primary = manifest.planets[0];
    const frame = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [100_000, 40_000, -60_000],
      previousDominantPlanetId: primary.worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0.25
    });

    expect(frame.dominantPlanetId).not.toBeNull();
    expect(frame.gravityOwnerPlanetId).toBe(frame.dominantPlanetId);
    expect(frame.activeEnvironmentPlanetId).toBeNull();
    expect(frame.activeEnvironmentPlanetSeed).toBeNull();
    expect(frame.renderEnvironment).toEqual({
      kind: 'space',
      planetId: null,
      seed: null,
      atmosphereInfluence: 0,
      spaceInfluence: 1
    });
  });

  it('retains one gravity owner through the midpoint hysteresis band', () => {
    const manifest = linearTwoBodyManifest();
    const [left, right] = manifest.planets;

    const retained = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [1_010, 0, 0],
      previousDominantPlanetId: left.worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0,
      dominanceHysteresisDistance: 25
    });
    expect(retained.dominantPlanetId).toBe(left.worldId);
    expect(retained.gravityOwnerPlanetId).toBe(left.worldId);

    const switched = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [1_020, 0, 0],
      previousDominantPlanetId: left.worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0,
      dominanceHysteresisDistance: 25
    });
    expect(switched.dominantPlanetId).toBe(right.worldId);
    expect(switched.gravityOwnerPlanetId).toBe(right.worldId);
  });

  it('smoothly and continuously resolves the inner and outer atmosphere bands', () => {
    expect(atmosphereInfluenceAtDistance(20, ATMOSPHERE)).toBe(1);
    expect(atmosphereInfluenceAtDistance(60, ATMOSPHERE)).toBeCloseTo(0.5, 12);
    expect(atmosphereInfluenceAtDistance(100, ATMOSPHERE)).toBe(0);

    const epsilon = 0.001;
    expect(atmosphereInfluenceAtDistance(20 + epsilon, ATMOSPHERE)).toBeCloseTo(1, 8);
    expect(atmosphereInfluenceAtDistance(100 - epsilon, ATMOSPHERE)).toBeCloseTo(0, 8);

    const samples = [20, 30, 40, 50, 60, 70, 80, 90, 100]
      .map(distance => atmosphereInfluenceAtDistance(distance, ATMOSPHERE));
    for (let index = 1; index < samples.length; index++) {
      expect(samples[index]).toBeLessThanOrEqual(samples[index - 1]);
      expect(samples[index]).toBeGreaterThanOrEqual(0);
      expect(samples[index]).toBeLessThanOrEqual(1);
    }
  });

  it('publishes one stable shared star direction and normalized day phase', () => {
    const manifest = linearTwoBodyManifest();
    const nearLeft = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [0, 0, 0],
      previousDominantPlanetId: manifest.planets[0].worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 1.25
    });
    const nearRight = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [2_000, 0, 0],
      previousDominantPlanetId: manifest.planets[1].worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0.25
    });

    expect(nearLeft.star).toEqual(nearRight.star);
    expect(nearLeft.star).toEqual(directionalStarFrame(manifest, 0.25));
    expect(nearLeft.star.dayPhase).toBe(0.25);
    expect(Math.hypot(...nearLeft.star.direction)).toBeCloseTo(1, 12);
  });

  it('preserves the legacy primary identity on a one-body surface', () => {
    const manifest = buildStarSystemManifest({ x: -3, y: 7 }, { forceSingleBody: true });
    const primary = manifest.planets[0];
    const frame = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: primary.systemPosition,
      previousDominantPlanetId: null,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0.75
    });

    expect(frame.dominantPlanetId).toBe(primary.worldId);
    expect(frame.dominantPlanetSeed).toBe(primary.seed);
    expect(frame.gravityOwnerPlanetId).toBe(primary.worldId);
    expect(frame.activeEnvironmentPlanetId).toBe(primary.worldId);
    expect(frame.activeEnvironmentPlanetSeed).toBe(primary.seed);
    expect(frame.renderEnvironment).toMatchObject({
      kind: 'planet',
      planetId: primary.worldId,
      seed: primary.seed,
      atmosphereInfluence: 1,
      spaceInfluence: 0
    });
  });

  it('falls back to space cleanly for a manifest with no bodies', () => {
    const source = buildStarSystemManifest({ x: 0, y: 0 }, { forceSingleBody: true });
    const manifest: StarSystemManifest = { ...source, planets: [] };
    const frame = resolveEnvironmentFrame({
      manifest,
      shipSystemPosition: [0, 0, 0],
      previousDominantPlanetId: source.planets[0].worldId,
      atmosphere: ATMOSPHERE,
      systemDayPhase: 0
    });

    expect(frame.dominantPlanetId).toBeNull();
    expect(frame.gravityOwnerPlanetId).toBeNull();
    expect(frame.activeEnvironmentPlanetId).toBeNull();
    expect(frame.renderEnvironment.kind).toBe('space');
  });
});

function linearTwoBodyManifest(): StarSystemManifest {
  const manifest = buildStarSystemManifest({ x: 12, y: 4 }, { bodyCountOverride: 2 });
  return {
    ...manifest,
    planets: [
      movePlanet(manifest.planets[0], [0, 0, 0]),
      movePlanet(manifest.planets[1], [2_000, 0, 0])
    ]
  };
}

function movePlanet(planet: PlanetDescriptor, systemPosition: Vec3Tuple): PlanetDescriptor {
  return { ...planet, systemPosition, surfaceBoundRadius: 50 };
}
