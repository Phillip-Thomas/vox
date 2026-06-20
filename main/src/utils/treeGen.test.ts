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

  it('respects the modest size budget (root at origin, sane height)', () => {
    const { trunkGeometry, leafGeometry } = generateTree(42);
    trunkGeometry.computeBoundingBox();
    const box = trunkGeometry.boundingBox!;
    // base near y=0, top within a few units of the configured height
    expect(box.min.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.max.y).toBeLessThan(DEFAULT_TREE_PARAMS.height + 3);
    expect(box.max.y).toBeGreaterThan(1.0);
    // leaves sit up in the crown, not below ground
    leafGeometry.computeBoundingBox();
    expect(leafGeometry.boundingBox!.max.y).toBeGreaterThan(1.0);
  });
});
