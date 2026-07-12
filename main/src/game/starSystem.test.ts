import { describe, expect, it } from 'vitest';
import identityFixtures from '../../../fixtures/star-system-identity.json';
import { coordinateToSeed, createCurrentWorld } from '../utils/worldCoordinates.ts';
import {
  MAX_COMPANION_DISTANCE_FROM_PRIMARY,
  MIN_PLANET_CENTER_SEPARATION,
  NOMINAL_PLANET_FACE_RADIUS,
  PLANET_IDENTITY_VERSION,
  PLANET_SURFACE_BOUND_RADIUS,
  SECONDARY_PLANET_SEED_NAMESPACE,
  SYSTEM_LAYOUT_SEED_NAMESPACE,
  SYSTEM_LAYOUT_VERSION,
  buildStarSystemManifest,
  canonicalPlanetWorldId,
  createPlanetIdentity,
  parsePlanetWorldId,
  planetSeedForAddress,
  planetWorldId,
  samePlanetAddress,
  samePlanetWorldId,
  sameSystemCoordinate,
  starProfileForSystem,
  systemPlanetCount,
  type PlanetDescriptor,
  type Vec3Tuple
} from './starSystem.ts';

describe('star-system identity', () => {
  it('preserves the legacy primary planet identity exactly', () => {
    const system = { x: -12, y: 7 };
    const legacy = createCurrentWorld(system);
    const primary = createPlanetIdentity({ system, slot: 0 });

    expect(primary.worldId).toBe(legacy.worldId);
    expect(primary.seed).toBe(legacy.seed);
    expect(primary.seed).toBe(coordinateToSeed(system.x, system.y));
    expect(primary.coordinate).toEqual(legacy.coordinate);
  });

  it('uses canonical suffixed IDs and a frozen secondary seed namespace', () => {
    const system = { x: -12, y: 7 };
    const p1 = createPlanetIdentity({ system, slot: 1 });
    const p2 = createPlanetIdentity({ system, slot: 2 });

    expect(SECONDARY_PLANET_SEED_NAMESPACE).toBe('paravox:planet:v1');
    expect(SYSTEM_LAYOUT_SEED_NAMESPACE).toBe('paravox:system-layout:v1');
    expect(p1.worldId).toBe('-12,7:p1');
    expect(p2.worldId).toBe('-12,7:p2');
    expect(p1.seed).toBe(planetSeedForAddress({ system, slot: 1 }));
    expect(p1.seed).not.toBe(coordinateToSeed(system.x, system.y));
    expect(p2.seed).not.toBe(p1.seed);
    expect(p1.planetIdentityVersion).toBe(PLANET_IDENTITY_VERSION);
  });

  it('locks client/server secondary seed fixtures', () => {
    for (const fixture of identityFixtures) {
      const address = {
        system: fixture.system,
        slot: fixture.slot as 0 | 1 | 2
      };
      const identity = createPlanetIdentity(address);
      expect(identity.worldId).toBe(fixture.worldId);
      expect(identity.seed).toBe(fixture.seed);
    }
  });

  it('parses only canonical planet world IDs', () => {
    expect(parsePlanetWorldId('4,-2')).toEqual({ system: { x: 4, y: -2 }, slot: 0 });
    expect(parsePlanetWorldId('4,-2:p1')).toEqual({ system: { x: 4, y: -2 }, slot: 1 });
    expect(parsePlanetWorldId('4,-2:p2')).toEqual({ system: { x: 4, y: -2 }, slot: 2 });
    expect(parsePlanetWorldId(' 004,-002:p1 ')).toEqual({ system: { x: 4, y: -2 }, slot: 1 });
    expect(parsePlanetWorldId('4,-2:p0')).toBeNull();
    expect(parsePlanetWorldId('4,-2:p3')).toBeNull();
    expect(parsePlanetWorldId('1000001,0:p1')).toBeNull();
    expect(canonicalPlanetWorldId(' 004,-002:p1 ')).toBe('4,-2:p1');
  });

  it('separates system equality from planet equality', () => {
    const primary = { system: { x: 3.8, y: -5.2 }, slot: 0 as const };
    const companion = { system: { x: 3, y: -5 }, slot: 1 as const };

    expect(sameSystemCoordinate(primary.system, companion.system)).toBe(true);
    expect(samePlanetAddress(primary, companion)).toBe(false);
    expect(samePlanetAddress(companion, { system: { x: 3, y: -5 }, slot: 1 })).toBe(true);
    expect(samePlanetWorldId(planetWorldId(primary), createPlanetIdentity(primary))).toBe(true);
    expect(samePlanetWorldId(createPlanetIdentity(primary), createPlanetIdentity(companion))).toBe(false);
  });
});

describe('remote-scan helpers', () => {
  it('starProfileForSystem matches the manifest star without building planets', () => {
    for (const coordinate of [{ x: 0, y: 0 }, { x: -19, y: -17 }, { x: 313, y: -278 }]) {
      expect(starProfileForSystem(coordinate)).toEqual(buildStarSystemManifest(coordinate).star);
    }
  });

  it('systemPlanetCount matches the default manifest population', () => {
    for (let x = -12; x <= 12; x += 3) {
      for (let y = -12; y <= 12; y += 3) {
        expect(systemPlanetCount({ x, y }))
          .toBe(buildStarSystemManifest({ x, y }).planets.length);
      }
    }
  });
});

describe('deterministic star-system manifests', () => {
  it('is deterministic, normalized, and supports authored single-body systems', () => {
    const a = buildStarSystemManifest({ x: 8.9, y: -4.2 });
    const b = buildStarSystemManifest({ x: 8, y: -4 });
    const story = buildStarSystemManifest({ x: 8, y: -4 }, { forceSingleBody: true });
    const fixture = buildStarSystemManifest({ x: 8, y: -4 }, { bodyCountOverride: 3 });
    const forcedStory = buildStarSystemManifest(
      { x: 8, y: -4 },
      { forceSingleBody: true, bodyCountOverride: 3 }
    );

    expect(a).toEqual(b);
    expect(a.layoutVersion).toBe(SYSTEM_LAYOUT_VERSION);
    expect(a.planetIdentityVersion).toBe(PLANET_IDENTITY_VERSION);
    expect(story.planets).toHaveLength(1);
    expect(story.planets[0]).toEqual(a.planets[0]);
    expect(fixture.planets).toHaveLength(3);
    expect(forcedStory.planets).toHaveLength(1);
  });

  it('holds population, separation, bounds, and orientation invariants over 10k systems', () => {
    const counts = [0, 0, 0, 0];

    for (let index = 0; index < 10_000; index++) {
      const coordinate = { x: index % 100 - 50, y: Math.floor(index / 100) - 50 };
      const manifest = buildStarSystemManifest(coordinate);
      counts[manifest.planets.length]++;

      expect(manifest.planets.length).toBeGreaterThanOrEqual(1);
      expect(manifest.planets.length).toBeLessThanOrEqual(3);
      expect(manifest.planets[0].systemPosition).toEqual([0, 0, 0]);

      for (const planet of manifest.planets) {
        expect(planet.terrainQuaternion).toEqual([0, 0, 0, 1]);
        expect(planet.nominalFaceRadius).toBe(NOMINAL_PLANET_FACE_RADIUS);
        expect(planet.surfaceBoundRadius).toBe(PLANET_SURFACE_BOUND_RADIUS);
        expect(planet.surfaceBoundRadius).toBeGreaterThanOrEqual(
          Math.sqrt(3) * (planet.nominalFaceRadius + 1)
        );
        const fromPrimary = distance(planet.systemPosition, manifest.planets[0].systemPosition);
        expect(fromPrimary).toBeLessThanOrEqual(MAX_COMPANION_DISTANCE_FROM_PRIMARY);
        if (planet.address.slot > 0) {
          expect(fromPrimary).toBeGreaterThanOrEqual(MIN_PLANET_CENTER_SEPARATION);
        }
      }

      for (let i = 0; i < manifest.planets.length; i++) {
        for (let j = i + 1; j < manifest.planets.length; j++) {
          expect(distanceBetween(manifest.planets[i], manifest.planets[j]))
            .toBeGreaterThanOrEqual(MIN_PLANET_CENTER_SEPARATION);
        }
      }
    }

    expect(counts[1] / 10_000).toBeGreaterThan(0.57);
    expect(counts[1] / 10_000).toBeLessThan(0.63);
    expect(counts[2] / 10_000).toBeGreaterThan(0.27);
    expect(counts[2] / 10_000).toBeLessThan(0.33);
    expect(counts[3] / 10_000).toBeGreaterThan(0.08);
    expect(counts[3] / 10_000).toBeLessThan(0.12);
  });
});

function distanceBetween(a: PlanetDescriptor, b: PlanetDescriptor): number {
  return distance(a.systemPosition, b.systemPosition);
}

function distance(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
