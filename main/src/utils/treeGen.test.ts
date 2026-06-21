import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateTree, DEFAULT_TREE_PARAMS } from './treeGen';

function posArray(geo: THREE.BufferGeometry): Float32Array {
  return (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
}

describe('treeGen', () => {
  it('produces non-empty trunk and leaf geometry', () => {
    const { trunkGeometry, leafGeometry } = generateTree(12345);
    expect(trunkGeometry.attributes.position.count).toBeGreaterThan(0);
    expect(leafGeometry.attributes.position.count).toBeGreaterThan(0);
    expect(trunkGeometry.getIndex()).not.toBeNull();
    expect(leafGeometry.getIndex()).not.toBeNull();
  });

  it('carries the wind attributes', () => {
    const { trunkGeometry, leafGeometry } = generateTree(777);
    expect(trunkGeometry.getAttribute('aStiff')).toBeTruthy();
    expect(leafGeometry.getAttribute('aStiff')).toBeTruthy();
    expect(leafGeometry.getAttribute('aPhase')).toBeTruthy();
  });

  it('aStiff spans from near-0 (root) to near-1 (tips) on the trunk', () => {
    const { trunkGeometry } = generateTree(2024);
    const stiff = (trunkGeometry.getAttribute('aStiff') as THREE.BufferAttribute)
      .array as Float32Array;
    let min = Infinity;
    let max = -Infinity;
    for (const s of stiff) {
      if (s < min) min = s;
      if (s > max) max = s;
    }
    expect(min).toBeLessThan(0.1); // root barely flexes
    expect(max).toBeGreaterThan(0.6); // tips flex a lot
    // all within [0,1]
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1.0001);
  });

  it('is deterministic: same seed -> identical counts and first positions', () => {
    const a = generateTree(98765);
    const b = generateTree(98765);
    expect(a.trunkGeometry.attributes.position.count).toBe(
      b.trunkGeometry.attributes.position.count
    );
    expect(a.leafGeometry.attributes.position.count).toBe(
      b.leafGeometry.attributes.position.count
    );
    const pa = posArray(a.trunkGeometry);
    const pb = posArray(b.trunkGeometry);
    for (let i = 0; i < Math.min(60, pa.length); i++) {
      expect(pa[i]).toBeCloseTo(pb[i], 6);
    }
    const la = posArray(a.leafGeometry);
    const lb = posArray(b.leafGeometry);
    for (let i = 0; i < Math.min(60, la.length); i++) {
      expect(la[i]).toBeCloseTo(lb[i], 6);
    }
  });

  it('different seeds give different trees', () => {
    const a = generateTree(1);
    const b = generateTree(2);
    const pa = posArray(a.trunkGeometry);
    const pb = posArray(b.trunkGeometry);
    // Either different vert counts or different positions.
    const diffCount = pa.length !== pb.length;
    let diffPos = false;
    if (!diffCount) {
      for (let i = 0; i < pa.length; i++) {
        if (Math.abs(pa[i] - pb[i]) > 1e-4) {
          diffPos = true;
          break;
        }
      }
    }
    expect(diffCount || diffPos).toBe(true);
  });

  it('respects the height budget across many seeds (no apical-leader oversizing)', () => {
    const h = DEFAULT_TREE_PARAMS.height;
    for (let seed = 0; seed <= 60; seed++) {
      const { trunkGeometry, leafGeometry } = generateTree(seed);
      trunkGeometry.computeBoundingBox();
      const box = trunkGeometry.boundingBox!;
      // The recursive apical leader must be budgeted so the trunk tops out near
      // the configured height — NOT several times it (the old bug hit ~3-4x).
      expect(box.max.y, `seed ${seed} trunk too tall`).toBeLessThan(h * 1.35);
      expect(box.max.y, `seed ${seed} trunk too short`).toBeGreaterThan(h * 0.45);
      // Base sits ~at origin; only a small dip from lean/base radius is allowed.
      expect(box.min.y, `seed ${seed} base dips too far`).toBeGreaterThan(-1.2);
      // Crown leaves live up in the canopy, never below ground.
      leafGeometry.computeBoundingBox();
      expect(leafGeometry.boundingBox!.max.y).toBeGreaterThan(1.0);
      expect(leafGeometry.boundingBox!.min.y).toBeGreaterThan(-1.5);
    }
  });
});
