import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildCompanionBodyModels,
  companionApparentRelativePosition,
  companionBodyMotionProfile,
  companionBodySpinPhase,
  companionCelestialPlacement,
  companionCloudDriftPhase,
  companionExactShellBlend,
  companionExactShellDrawCount,
  companionExactShellTriangleCount,
  companionExactTerrainFaceCount,
  companionPresentationMotionWeight,
  companionSystemMotionProfile,
  companionVisualBudget,
  COMPANION_APPARENT_DRIFT_RATE_RAD_PER_SEC,
  COMPANION_MOTION_FADE_END,
  COMPANION_MOTION_FADE_START,
  COMPANION_ORBIT_MAX_PERIOD_SECONDS,
  COMPANION_ORBIT_MIN_PERIOD_SECONDS,
  SKY_STARFIELD_DRIFT_RAD_PER_SEC,
  COMPANION_SPIN_MAX_PERIOD_SECONDS,
  COMPANION_SPIN_MIN_PERIOD_SECONDS,
  createCompanionSurfaceGeometry,
  EXACT_TERRAIN_BATCH_SIZE,
  EXACT_WATER_BATCH_SIZE,
  SURFACE_SKY_EXIT_FRACTION,
  SURFACE_SKY_PREFERRED_DISTANCE
} from './systemCompanionBodiesModel.ts';
import {
  TIDEGARDEN_SEED,
  TIDEGARDEN_WORLD_ID,
  resolvePlanetProfile
} from '../game/PlanetProfile.ts';

describe('system companion body model', () => {
  it('returns no sibling for authored one-body systems and at most two otherwise', () => {
    expect(buildCompanionBodyModels({
      coordinate: { x: 4, y: -2 },
      forceSingleBody: true
    })).toEqual([]);

    const companions = buildCompanionBodyModels({
      coordinate: { x: 4, y: -2 },
      bodyCountOverride: 3
    });
    expect(companions).toHaveLength(2);
    expect(companions.every(body => body.descriptor.address.slot !== 0)).toBe(true);
    expect(companions.every(body => body.descriptor.terrainQuaternion.join(',') === '0,0,0,1')).toBe(true);
  });

  it('resolves physical positions relative to any active planet', () => {
    const fromPrimary = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 0,
      bodyCountOverride: 3
    });
    const fromCompanion = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 1,
      bodyCountOverride: 3
    });

    expect(fromPrimary).toHaveLength(2);
    expect(fromCompanion).toHaveLength(2);
    const primarySeenFromP1 = fromCompanion.find(body => body.descriptor.address.slot === 0);
    expect(primarySeenFromP1?.relativePosition).toEqual(
      fromPrimary[0].relativePosition.map(value => -value)
    );
  });

  it('derives deterministic bounded orbit, obliquity, spin, and cloud profiles', () => {
    const first = companionSystemMotionProfile(412_771, [2_400, 120, -500]);
    const repeat = companionSystemMotionProfile(412_771, [2_400, 120, -500]);
    const other = companionSystemMotionProfile(412_772, [2_400, 120, -500]);
    const body = companionBodyMotionProfile(991_337);

    expect(repeat).toEqual(first);
    expect(other).not.toEqual(first);
    expect(first.periodSeconds).toBeGreaterThanOrEqual(COMPANION_ORBIT_MIN_PERIOD_SECONDS);
    expect(first.periodSeconds).toBeLessThanOrEqual(COMPANION_ORBIT_MAX_PERIOD_SECONDS);
    // Amplitude is derived from the period so the peak longitude rate is pinned
    // to the sky-cohesive target: amplitude * 2π / period === target for any seed.
    expect(first.longitudeAmplitudeRadians * TAU / first.periodSeconds).toBeCloseTo(
      COMPANION_APPARENT_DRIFT_RATE_RAD_PER_SEC,
      10
    );
    expect(THREE.MathUtils.radToDeg(first.longitudeAmplitudeRadians)).toBeGreaterThanOrEqual(10);
    expect(THREE.MathUtils.radToDeg(first.longitudeAmplitudeRadians)).toBeLessThanOrEqual(18);
    expect(Math.hypot(...first.orbitAxis)).toBeCloseTo(1, 10);
    expect(Math.hypot(...first.latitudeAxis)).toBeCloseTo(1, 10);
    expect(dot(first.orbitAxis, first.latitudeAxis)).toBeCloseTo(0, 10);

    expect(body.spinPeriodSeconds).toBeGreaterThanOrEqual(COMPANION_SPIN_MIN_PERIOD_SECONDS);
    expect(body.spinPeriodSeconds).toBeLessThanOrEqual(COMPANION_SPIN_MAX_PERIOD_SECONDS);
    expect(Math.hypot(...body.spinAxis)).toBeCloseTo(1, 10);
    expect(body.spinAxis[1]).toBeGreaterThan(Math.cos(THREE.MathUtils.degToRad(22.01)));
    expect(body.cloudDriftRatio).toBeGreaterThanOrEqual(0.1);
    expect(body.cloudDriftRatio).toBeLessThanOrEqual(0.24);
  });

  it('moves every sibling through one coherent bounded sky ellipse', () => {
    const companions = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 0,
      bodyCountOverride: 3
    });
    const [first, second] = companions;
    const elapsedSeconds = 173.25;
    const movedFirst = companionApparentRelativePosition(
      first.relativePosition,
      first.systemMotion,
      elapsedSeconds,
      0
    );
    const movedSecond = companionApparentRelativePosition(
      second.relativePosition,
      second.systemMotion,
      elapsedSeconds,
      0
    );
    const canonicalPairDistance = tupleDistance(first.relativePosition, second.relativePosition);

    expect(movedFirst.length()).toBeCloseTo(tupleLength(first.relativePosition), 8);
    expect(movedSecond.length()).toBeCloseTo(tupleLength(second.relativePosition), 8);
    expect(movedFirst.distanceTo(movedSecond)).toBeCloseTo(canonicalPairDistance, 8);
    expect(angleBetween(first.relativePosition, movedFirst.toArray())).toBeLessThanOrEqual(
      first.systemMotion.longitudeAmplitudeRadians + first.systemMotion.latitudeAmplitudeRadians + 1e-9
    );
    expect(movedFirst.toArray()).not.toEqual(first.relativePosition);
  });

  it('drifts siblings at an apparent angular rate cohesive with the star-field drift', () => {
    // The surface sky must read as one system: the sibling bodies' apparent
    // motion should share the pace of the star field, which the sky dome wheels
    // at SKY_STARFIELD_DRIFT_RAD_PER_SEC (rotate(dir, uTime*0.01), uTime in real
    // seconds). Measure the true apparent angular rate — the rate of change of
    // the body's on-sky direction seen from the observer — by finite difference.
    for (const seed of [774_411, 412_772, 990_001]) {
      const relative: [number, number, number] = [2_200, -90, 430];
      const system = companionSystemMotionProfile(seed, relative);
      const dt = 0.5;
      const prev = new THREE.Vector3();
      const next = new THREE.Vector3();
      let peakRate = 0;
      for (let t = 0; t <= system.periodSeconds; t += dt) {
        companionApparentRelativePosition(relative, system, t, 0, false, prev).normalize();
        companionApparentRelativePosition(relative, system, t + dt, 0, false, next).normalize();
        peakRate = Math.max(peakRate, prev.angleTo(next) / dt);
      }
      // Same order as the sky, deliberately within ~0.5x–1x of it.
      expect(peakRate).toBeGreaterThan(0.5 * SKY_STARFIELD_DRIFT_RAD_PER_SEC);
      expect(peakRate).toBeLessThanOrEqual(SKY_STARFIELD_DRIFT_RAD_PER_SEC + 1e-4);
    }
  });

  it('keeps reciprocal active-planet views exact under the shared motion', () => {
    const fromPrimary = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 0,
      bodyCountOverride: 3
    });
    const fromP1 = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 1,
      bodyCountOverride: 3
    });
    const primaryToP1 = fromPrimary.find(body => body.descriptor.address.slot === 1)!;
    const p1ToPrimary = fromP1.find(body => body.descriptor.address.slot === 0)!;
    const movedForward = companionApparentRelativePosition(
      primaryToP1.relativePosition,
      primaryToP1.systemMotion,
      311,
      0
    );
    const movedReverse = companionApparentRelativePosition(
      p1ToPrimary.relativePosition,
      p1ToPrimary.systemMotion,
      311,
      0
    );

    expect(movedReverse.x).toBeCloseTo(-movedForward.x, 10);
    expect(movedReverse.y).toBeCloseTo(-movedForward.y, 10);
    expect(movedReverse.z).toBeCloseTo(-movedForward.z, 10);
  });

  it('fades orbital center drift to exact canonical state before space targeting', () => {
    const relative: [number, number, number] = [2_200, -90, 430];
    const system = companionSystemMotionProfile(774_411, relative);

    expect(companionPresentationMotionWeight(COMPANION_MOTION_FADE_START)).toBe(1);
    expect(companionPresentationMotionWeight(COMPANION_MOTION_FADE_END)).toBe(0);
    expect(companionPresentationMotionWeight(1)).toBe(0);
    for (const inboundBlend of [0, 0.2, 0.5, COMPANION_MOTION_FADE_END, 1]) {
      expect(companionPresentationMotionWeight(inboundBlend, true)).toBe(0);
      expect(
        companionApparentRelativePosition(relative, system, 987.6, inboundBlend, true).toArray()
      ).toEqual(relative);
    }
    expect(
      companionApparentRelativePosition(relative, system, 987.6, COMPANION_MOTION_FADE_END).toArray()
    ).toEqual(relative);
    expect(companionApparentRelativePosition(relative, system, 987.6, 1).toArray()).toEqual(relative);
  });

  it('wraps long-running orbit, spin, and cloud phases without a visual seam', () => {
    const relative: [number, number, number] = [2_400, 120, -500];
    const system = companionSystemMotionProfile(882_731, relative);
    const body = companionBodyMotionProfile(491_287);
    const epsilon = 1e-4;
    // Continuity across the wrap is rate-independent: a step that straddles the
    // period boundary must move the body by the same amount as an identical step
    // just before it. (An absolute threshold would falsely fail now that the
    // drift is faster — the body simply covers more ground per unit time.)
    const orbitSeamStep = companionApparentRelativePosition(
      relative,
      system,
      system.periodSeconds - epsilon,
      0
    ).distanceTo(
      companionApparentRelativePosition(relative, system, system.periodSeconds + epsilon, 0)
    );
    const orbitSmoothStep = companionApparentRelativePosition(
      relative,
      system,
      system.periodSeconds - 3 * epsilon,
      0
    ).distanceTo(
      companionApparentRelativePosition(relative, system, system.periodSeconds - epsilon, 0)
    );
    const spinBefore = companionBodySpinPhase(body, body.spinPeriodSeconds - epsilon);
    const spinAfter = companionBodySpinPhase(body, body.spinPeriodSeconds + epsilon);
    const cloudPeriod = body.spinPeriodSeconds / body.cloudDriftRatio;
    const cloudBefore = companionCloudDriftPhase(body, cloudPeriod - epsilon);
    const cloudAfter = companionCloudDriftPhase(body, cloudPeriod + epsilon);

    expect(orbitSeamStep).toBeCloseTo(orbitSmoothStep, 6);
    expect(Math.cos(spinBefore)).toBeCloseTo(Math.cos(spinAfter), 5);
    expect(Math.sin(spinBefore)).toBeCloseTo(Math.sin(spinAfter), 5);
    expect(Math.cos(cloudBefore)).toBeCloseTo(Math.cos(cloudAfter), 5);
    expect(Math.sin(cloudBefore)).toBeCloseTo(Math.sin(cloudAfter), 5);
  });

  it('reduces tessellation and secondary shells monotonically by quality', () => {
    const ultra = companionVisualBudget('ULTRA');
    const high = companionVisualBudget('HIGH');
    const medium = companionVisualBudget('MEDIUM');
    const low = companionVisualBudget('LOW');
    const potato = companionVisualBudget('POTATO');

    expect([
      ultra.surfaceSubdivisions,
      high.surfaceSubdivisions,
      medium.surfaceSubdivisions,
      low.surfaceSubdivisions,
      potato.surfaceSubdivisions
    ]).toEqual([32, 28, 20, 14, 8]);
    expect(ultra.separateCloudShell).toBe(true);
    expect(high.separateCloudShell).toBe(true);
    expect(medium.separateCloudShell).toBe(true);
    expect(ultra.exactTerrainShell).toBe(true);
    expect(high.exactTerrainShell).toBe(true);
    expect(medium.exactTerrainShell).toBe(false);
    expect(potato.ringSegments).toBeLessThan(low.ringSegments);
  });

  it('promotes the exact terrain shell smoothly before activation distance', () => {
    expect(companionExactShellBlend(1_200)).toBe(0);
    expect(companionExactShellBlend(1_050)).toBe(0);
    expect(companionExactShellBlend(735)).toBeCloseTo(0.5, 5);
    expect(companionExactShellBlend(420)).toBe(1);
    expect(companionExactShellBlend(180)).toBe(1);
  });

  it('counts only exposed terrain quads and stays within the HIGH shell budget', () => {
    const instanceData = new Float32Array([
      0, 0b11_1110,
      0, 0b11_1100,
      0, 0
    ]);
    expect(EXACT_TERRAIN_BATCH_SIZE).toBe(5_000);
    expect(EXACT_WATER_BATCH_SIZE).toBe(4_096);
    expect(companionExactTerrainFaceCount(instanceData, 3)).toBe(9);
    expect(companionExactShellDrawCount(100_000, 9_569)).toBe(4);
    expect(companionExactShellTriangleCount(100_000, 9_569)).toBeLessThan(220_000);
  });

  it('places bodies exactly like the legacy sky-dome surrogate at blend 0', () => {
    const base = {
      physicalDistance: 2_400,
      skyExitDistance: 120,
      unitSurfaceBoundRadius: Math.sqrt(3),
      nominalFaceRadius: 50,
      horizonExtinction: 0.6
    };
    const placement = companionCelestialPlacement({ ...base, spaceBlend: 0 });
    const expectedDistance = Math.min(
      SURFACE_SKY_PREFERRED_DISTANCE,
      base.skyExitDistance * SURFACE_SKY_EXIT_FRACTION
    );
    expect(placement.centerDistance).toBeCloseTo(expectedDistance, 6);
    expect(placement.scale).toBeCloseTo(
      expectedDistance * base.nominalFaceRadius / base.physicalDistance,
      6
    );
    expect(placement.visibility).toBeCloseTo(base.horizonExtinction, 6);
  });

  it('converges to the exact physical placement at blend 1', () => {
    const placement = companionCelestialPlacement({
      physicalDistance: 3_600,
      skyExitDistance: 8,
      spaceBlend: 1,
      nominalFaceRadius: 50,
      horizonExtinction: 0
    });
    expect(placement.centerDistance).toBe(3_600);
    expect(placement.scale).toBe(50);
    expect(placement.visibility).toBe(1);
  });

  it('slides depth monotonically and exactly preserves angular size mid-blend', () => {
    const base = {
      physicalDistance: 2_200,
      skyExitDistance: 58,
      unitSurfaceBoundRadius: Math.sqrt(3),
      nominalFaceRadius: 50,
      horizonExtinction: 1
    };
    const trueAngular = base.nominalFaceRadius
      * base.unitSurfaceBoundRadius
      / base.physicalDistance;
    let previousDistance = 0;
    for (let step = 0; step <= 10; step++) {
      const placement = companionCelestialPlacement({ ...base, spaceBlend: step / 10 });
      expect(placement.centerDistance).toBeGreaterThanOrEqual(previousDistance);
      previousDistance = placement.centerDistance;
      // Depth changes, the silhouette does not.
      const apparentAngular =
        placement.scale * base.unitSurfaceBoundRadius / placement.centerDistance;
      expect(apparentAngular).toBeCloseTo(trueAngular, 10);
    }
  });

  it('never collapses the surrogate to the camera when the sky exit closes', () => {
    const placement = companionCelestialPlacement({
      physicalDistance: 2_200,
      skyExitDistance: 0,
      spaceBlend: 0.4,
      nominalFaceRadius: 50,
      horizonExtinction: 1
    });
    expect(placement.centerDistance).toBeGreaterThan(1);
  });

  it('builds finite colored dominant-face geometry rather than a sphere', () => {
    const geometry = createCompanionSurfaceGeometry(1609750163, 8);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex();
    let minRadius = Infinity;
    let maxRadius = 0;

    for (let vertex = 0; vertex < position.count; vertex++) {
      const x = position.getX(vertex);
      const y = position.getY(vertex);
      const z = position.getZ(vertex);
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      const radius = Math.hypot(x, y, z);
      minRadius = Math.min(minRadius, radius);
      maxRadius = Math.max(maxRadius, radius);
    }

    expect(position.count).toBe(6 * 9 * 9);
    expect(color.count).toBe(position.count);
    expect(index?.count).toBe(6 * 8 * 8 * 6);
    expect(maxRadius / minRadius).toBeGreaterThan(1.45);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(1.6);
    geometry.dispose();
  });

  it('builds Tidegarden companion geometry from its canonical profile, not its volcanic seed', () => {
    const profile = resolvePlanetProfile({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED
    }).profile;
    const canonical = createCompanionSurfaceGeometry(TIDEGARDEN_SEED, 8, profile);
    const generic = createCompanionSurfaceGeometry(TIDEGARDEN_SEED, 8);
    const canonicalColors = canonical.getAttribute('color');
    const genericColors = generic.getAttribute('color');

    expect(profile.archetype).toBe('verdant');
    expect([
      canonicalColors.getX(0),
      canonicalColors.getY(0),
      canonicalColors.getZ(0)
    ]).not.toEqual([
      genericColors.getX(0),
      genericColors.getY(0),
      genericColors.getZ(0)
    ]);

    canonical.dispose();
    generic.dispose();
  });
});

const TAU = Math.PI * 2;

function dot(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function tupleLength(value: readonly number[]): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function tupleDistance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function angleBetween(a: readonly number[], b: readonly number[]): number {
  return Math.acos(THREE.MathUtils.clamp(dot(a, b) / (tupleLength(a) * tupleLength(b)), -1, 1));
}
