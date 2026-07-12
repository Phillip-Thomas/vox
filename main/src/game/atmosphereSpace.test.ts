import { describe, expect, it } from 'vitest';
import {
  ATMOS_ENTER_ALTITUDE,
  ATMOS_LEAVE_ALTITUDE,
  ATMOSPHERE_SPACE_BLEND_END_ALTITUDE,
  ATMOSPHERE_SPACE_BLEND_START_ALTITUDE,
  atmosphereSpaceBlend,
  planetLocalCameraRadius
} from './atmosphereSpace.ts';

const SURFACE_RADIUS = 50;

describe('atmosphereSpaceBlend', () => {
  it('is 0 through the whole surface/low-atmosphere band', () => {
    expect(atmosphereSpaceBlend(SURFACE_RADIUS, SURFACE_RADIUS)).toBe(0);
    expect(atmosphereSpaceBlend(SURFACE_RADIUS + 60, SURFACE_RADIUS)).toBe(0);
    expect(atmosphereSpaceBlend(
      SURFACE_RADIUS + ATMOSPHERE_SPACE_BLEND_START_ALTITUDE,
      SURFACE_RADIUS
    )).toBe(0);
  });

  it('is 1 from the end of the band through deep space', () => {
    expect(atmosphereSpaceBlend(
      SURFACE_RADIUS + ATMOSPHERE_SPACE_BLEND_END_ALTITUDE,
      SURFACE_RADIUS
    )).toBe(1);
    expect(atmosphereSpaceBlend(SURFACE_RADIUS + 4_000, SURFACE_RADIUS)).toBe(1);
  });

  it('rises smoothly and monotonically across the band', () => {
    let previous = 0;
    for (let altitude = ATMOSPHERE_SPACE_BLEND_START_ALTITUDE;
      altitude <= ATMOSPHERE_SPACE_BLEND_END_ALTITUDE;
      altitude += 1) {
      const blend = atmosphereSpaceBlend(SURFACE_RADIUS + altitude, SURFACE_RADIUS);
      expect(blend).toBeGreaterThanOrEqual(previous);
      previous = blend;
    }
    const mid = (ATMOSPHERE_SPACE_BLEND_START_ALTITUDE + ATMOSPHERE_SPACE_BLEND_END_ALTITUDE) / 2;
    expect(atmosphereSpaceBlend(SURFACE_RADIUS + mid, SURFACE_RADIUS)).toBeCloseTo(0.5, 5);
  });

  it('brackets the phase-machine thresholds so warps start on settled endpoints', () => {
    // An 'enter' warp can only begin at blend 0…
    expect(ATMOSPHERE_SPACE_BLEND_START_ALTITUDE).toBeGreaterThanOrEqual(ATMOS_ENTER_ALTITUDE);
    // …and a climbing ship converges to blend 1 shortly after the 'leave' warp
    // begins, while still close enough to read as an atmosphere boundary.
    expect(ATMOSPHERE_SPACE_BLEND_END_ALTITUDE).toBeGreaterThan(ATMOS_LEAVE_ALTITUDE);
    expect(ATMOSPHERE_SPACE_BLEND_END_ALTITUDE - ATMOS_LEAVE_ALTITUDE).toBeLessThan(20);
  });

  it('treats non-finite input as fully inside the atmosphere', () => {
    expect(atmosphereSpaceBlend(Number.NaN, SURFACE_RADIUS)).toBe(0);
    expect(atmosphereSpaceBlend(Number.POSITIVE_INFINITY, SURFACE_RADIUS)).toBe(0);
  });

  it('measures altitude in the active planet frame across render-origin rebases', () => {
    const planetCenter = [3_200, -40, 900] as const;
    const before = planetLocalCameraRadius(
      { x: 0, y: 0, z: 175 },
      planetCenter,
      planetCenter
    );
    const after = planetLocalCameraRadius(
      { x: -6_800, y: -40, z: 1_075 },
      [10_000, 0, 0],
      planetCenter
    );

    expect(before).toBe(175);
    expect(after).toBe(175);
    expect(atmosphereSpaceBlend(before, SURFACE_RADIUS)).toBe(
      atmosphereSpaceBlend(after, SURFACE_RADIUS)
    );
  });
});
