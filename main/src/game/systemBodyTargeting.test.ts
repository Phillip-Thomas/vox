import { describe, expect, it } from 'vitest';
import {
  NOMINAL_PLANET_FACE_RADIUS,
  PLANET_SURFACE_BOUND_RADIUS,
  createPlanetIdentity,
  type PlanetDescriptor,
  type PlanetSlot,
  type Vec3Tuple
} from './starSystem.ts';
import { resolveSystemBodyTarget } from './systemBodyTargeting.ts';

const ACTIVE_ID = '0,0';

describe('same-system body targeting', () => {
  it('locks the visible sibling and reports geometric target data', () => {
    const sibling = body(1, [0, 0, -2_500]);
    const target = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), sibling]
    });

    expect(target?.worldId).toBe('0,0:p1');
    expect(target?.address).toEqual({ system: { x: 0, y: 0 }, slot: 1 });
    expect(target?.distance).toBeCloseTo(2_500, 10);
    expect(target?.angularRadius).toBeCloseTo(Math.asin(PLANET_SURFACE_BOUND_RADIUS / 2_500), 10);
    expect(target?.alignment).toBeCloseTo(1, 12);
  });

  it('uses the active-body bound to hide a sibling below the horizon', () => {
    const input = {
      cameraSystemPosition: [0, 51, 0] as Vec3Tuple,
      forward: [0, -1, 0] as Vec3Tuple,
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), body(1, [0, -2_500, 0])]
    };

    expect(resolveSystemBodyTarget(input)?.worldId).toBe('0,0:p1');
    expect(resolveSystemBodyTarget({
      ...input,
      activeBodyOcclusionBound: {
        systemPosition: [0, 0, 0],
        radius: NOMINAL_PLANET_FACE_RADIUS
      }
    })).toBeNull();
  });

  it('lets a closer sibling analytically occult a farther aligned sibling', () => {
    const far = body(2, [0, 0, -4_000]);
    const withoutBlocker = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), far]
    });
    const withBlocker = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), body(1, [18, 0, -2_000]), far]
    });

    expect(withoutBlocker?.worldId).toBe('0,0:p2');
    expect(withBlocker?.worldId).toBe('0,0:p1');
  });

  it('rejects off-axis and behind-camera bodies', () => {
    const target = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [
        body(0, [0, 0, 0]),
        body(1, [700, 0, -2_000]),
        body(2, [0, 0, 2_000])
      ]
    });

    expect(target).toBeNull();
  });

  it('prefers a silhouette hit before a merely nearby aligned center', () => {
    const silhouetteHit = body(1, [180, 0, -2_000], 200);
    const alignedMiss = body(2, [70, 0, -2_000], 20);
    const target = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), alignedMiss, silhouetteHit]
    });

    expect(target?.worldId).toBe('0,0:p1');
  });

  it('breaks exact geometric ties by canonical world ID', () => {
    const p1 = body(1, [100, 0, -2_000]);
    const p2 = body(2, [-100, 0, -2_000]);
    const expected = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), p2, p1]
    });
    const reversed = resolveSystemBodyTarget({
      cameraSystemPosition: [0, 0, 0],
      forward: [0, 0, -1],
      activePlanetId: ACTIVE_ID,
      bodies: [body(0, [0, 0, 0]), p1, p2]
    });

    expect(expected?.worldId).toBe('0,0:p1');
    expect(reversed?.worldId).toBe(expected?.worldId);
  });
});

function body(slot: PlanetSlot, systemPosition: Vec3Tuple, surfaceBoundRadius = PLANET_SURFACE_BOUND_RADIUS): PlanetDescriptor {
  return {
    ...createPlanetIdentity({ system: { x: 0, y: 0 }, slot }),
    systemPosition,
    terrainQuaternion: [0, 0, 0, 1],
    nominalFaceRadius: NOMINAL_PLANET_FACE_RADIUS,
    surfaceBoundRadius
  };
}
