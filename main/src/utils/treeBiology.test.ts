import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  cantileverSagAngle,
  estimateTreeLight,
  growthVigor,
  pipeModelRadius,
  type Vec3Like
} from './treeBiology';

const TIP = new THREE.Vector3(0, 2, 0);
const UP = new THREE.Vector3(0, 1, 0);

function lightFor(occupied: readonly Vec3Like[], out = new THREE.Vector3()): number {
  return estimateTreeLight(TIP, UP, occupied, out);
}

describe('estimateTreeLight', () => {
  it('returns full bounded exposure and a normalized direction in open sky', () => {
    const direction = new THREE.Vector3();
    const light = lightFor([], direction);

    expect(light).toBe(1);
    expect(direction.length()).toBeCloseTo(1, 8);
    expect(direction.y).toBeGreaterThan(0.99);
  });

  it('darkens monotonically as nearby overhead occupancy grows', () => {
    const blockers = [
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0.45, 2.7, 0),
      new THREE.Vector3(-0.4, 2.75, 0.2)
    ];
    const open = lightFor([]);
    const one = lightFor(blockers.slice(0, 1));
    const two = lightFor(blockers.slice(0, 2));
    const three = lightFor(blockers);

    expect(one).toBeLessThan(open);
    expect(two).toBeLessThan(one);
    expect(three).toBeLessThan(two);
    for (const value of [open, one, two, three]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('steers away from a blocker while retaining an upward component', () => {
    const direction = new THREE.Vector3();
    lightFor([new THREE.Vector3(0.6, 2.35, 0)], direction);

    expect(direction.x).toBeLessThan(0);
    expect(direction.y).toBeGreaterThan(0);
    expect(direction.length()).toBeCloseTo(1, 8);
  });

  it('treats material below a tip as much less obstructive than material above it', () => {
    const above = lightFor([new THREE.Vector3(0, 2.6, 0)]);
    const below = lightFor([new THREE.Vector3(0, 1.4, 0)]);
    expect(below).toBeGreaterThan(above);
  });

  it('never increases exposure when occupancy is added in another direction', () => {
    const occupied = [
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0.4, 1.5, 0),
      new THREE.Vector3(-0.6, 2, 0.2)
    ];
    const values = [0, 1, 2, 3].map(count => lightFor(occupied.slice(0, count)));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  it('ignores self occupancy and remains finite with malformed coordinates', () => {
    const direction = new THREE.Vector3();
    const light = estimateTreeLight(
      TIP,
      { x: Number.NaN, y: Number.POSITIVE_INFINITY, z: 0 },
      [TIP, { x: Number.NaN, y: 1, z: 0 }, { x: 1e20, y: 1e20, z: 1e20 }],
      direction
    );

    expect(Number.isFinite(light)).toBe(true);
    expect(light).toBeGreaterThanOrEqual(0);
    expect(light).toBeLessThanOrEqual(1);
    expect(direction.length()).toBeCloseTo(1, 8);
  });
});

describe('growthVigor', () => {
  it('increases monotonically with light', () => {
    const values = [0, 0.2, 0.4, 0.6, 0.8, 1].map(light =>
      growthVigor(light, 0.45, 1.5)
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('lets shade-tolerant species retain more vigor in dim light', () => {
    expect(growthVigor(0.2, 0.9, 0)).toBeGreaterThan(growthVigor(0.2, 0.1, 0));
  });

  it('uses bright-growth priority to favor bright tips over shaded tips', () => {
    expect(growthVigor(0.85, 0.3, 4)).toBeGreaterThan(growthVigor(0.85, 0.3, 0));
    expect(growthVigor(0.2, 0.3, 4)).toBeLessThan(growthVigor(0.2, 0.3, 0));
  });

  it('stays finite and bounded for extreme inputs', () => {
    for (const value of [
      growthVigor(Number.NaN, Number.NaN, Number.NaN),
      growthVigor(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      growthVigor(-10, -10, -10)
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(2);
    }
  });
});

describe('pipeModelRadius', () => {
  it('conserves supported cross-sectional area with the default exponent', () => {
    expect(pipeModelRadius(0, 0.1)).toBe(0);
    expect(pipeModelRadius(1, 0.1)).toBeCloseTo(0.1, 8);
    expect(pipeModelRadius(4, 0.1)).toBeCloseTo(0.2, 8);
    expect(pipeModelRadius(9, 0.1)).toBeCloseTo(0.3, 8);
  });

  it('is monotonic in the number of living tips and respects its radius ceiling', () => {
    const values = [0, 1, 4, 16, 64].map(tips =>
      pipeModelRadius(tips, 0.1, { maxRadius: 0.5 })
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      expect(values[i]).toBeLessThanOrEqual(0.5);
    }
  });

  it('returns finite safe values for malformed inputs', () => {
    for (const value of [
      pipeModelRadius(Number.NaN, Number.NaN),
      pipeModelRadius(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
      pipeModelRadius(-20, -1)
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(2);
    }
  });
});

describe('cantileverSagAngle', () => {
  const base = { mass: 0.08, lever: 1.2, radius: 0.05, stiffness: 0.5 };

  it('grows with downstream mass and lever arm', () => {
    const initial = cantileverSagAngle(base.mass, base.lever, base.radius, base.stiffness);
    const heavier = cantileverSagAngle(base.mass * 2, base.lever, base.radius, base.stiffness);
    const longer = cantileverSagAngle(base.mass, base.lever * 2, base.radius, base.stiffness);
    expect(heavier).toBeGreaterThan(initial);
    expect(longer).toBeGreaterThan(initial);
  });

  it('falls sharply as radius or stiffness increases', () => {
    const initial = cantileverSagAngle(base.mass, base.lever, base.radius, base.stiffness);
    const thicker = cantileverSagAngle(base.mass, base.lever, base.radius * 2, base.stiffness);
    const stiffer = cantileverSagAngle(base.mass, base.lever, base.radius, base.stiffness * 2);
    expect(thicker).toBeLessThan(initial);
    expect(stiffer).toBeLessThan(initial);
    expect(thicker).toBeLessThan(initial / 10);
  });

  it('clamps extreme deflection and remains finite for degenerate inputs', () => {
    const maxSagRadians = 0.4;
    expect(
      cantileverSagAngle(1e9, 1e9, 0, 0, { maxSagRadians })
    ).toBeCloseTo(maxSagRadians, 8);

    for (const value of [
      cantileverSagAngle(Number.NaN, Number.NaN, Number.NaN, Number.NaN),
      cantileverSagAngle(-1, -1, -1, -1)
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0.65);
    }
  });
});
