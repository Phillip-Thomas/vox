import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateTree } from './treeGen';
import {
  buildTreeProfile,
  paramsFromProfile,
  treeVariantSeed,
  TREE_VARIANT_COUNT
} from './treeProfile';
import { coordinateToSeed } from './worldCoordinates';

function expectFiniteGeometry(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  expect(position.count).toBeGreaterThan(0);
  let finite = true;
  for (const attribute of Object.values(geometry.attributes)) {
    expect(attribute.count).toBe(position.count);
    for (const value of attribute.array) finite = finite && Number.isFinite(value);
  }
  expect(finite).toBe(true);
  const index = geometry.getIndex();
  expect(index).not.toBeNull();
  let validIndex = true;
  for (const value of index!.array) {
    validIndex = validIndex && value >= 0 && value < position.count;
  }
  expect(validIndex).toBe(true);
}

function geometryHash(geometry: THREE.BufferGeometry): number {
  let hash = 2166136261 >>> 0;
  for (const name of Object.keys(geometry.attributes).sort()) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
    for (const char of name) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    hash ^= attribute.itemSize;
    hash = Math.imul(hash, 16777619) >>> 0;
    for (const value of attribute.array) {
      hash ^= Math.round(Number(value) * 100_000);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  for (const value of geometry.getIndex()!.array) {
    hash ^= Number(value);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function ringRadius(
  position: THREE.BufferAttribute,
  start: number,
  count: number
): number {
  const center = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    center.x += position.getX(start + i);
    center.y += position.getY(start + i);
    center.z += position.getZ(start + i);
  }
  center.multiplyScalar(1 / count);
  let radius = 0;
  for (let i = 0; i < count; i++) {
    radius += Math.hypot(
      position.getX(start + i) - center.x,
      position.getY(start + i) - center.y,
      position.getZ(start + i) - center.z
    );
  }
  return radius / count;
}

describe('profiled tree quality matrix', () => {
  it('keeps every sampled phenotype finite, bounded, tapered, and above ground', () => {
    for (let sample = 0; sample < 48; sample++) {
      const seed = coordinateToSeed(sample * 17 - 203, sample * sample * 7 + 11);
      const profile = buildTreeProfile(seed);
      for (let variant = 0; variant < TREE_VARIANT_COUNT; variant++) {
        const params = paramsFromProfile(profile, variant);
        const tree = generateTree(treeVariantSeed(seed, variant), params);

        expectFiniteGeometry(tree.trunkGeometry);
        expectFiniteGeometry(tree.leafGeometry);
        expectFiniteGeometry(tree.impostorGeometry);
        expect(tree.trunkGeometry.getAttribute('position').count).toBeLessThanOrEqual(3_200);
        expect(
          tree.leafGeometry.getAttribute('position').count,
          `sample ${sample} variant ${variant} ${profile.silhouette} leaf budget`
        ).toBeLessThanOrEqual(
          Math.ceil(params.maxLeafCards * 4 * 1.08)
        );

        tree.trunkGeometry.computeBoundingBox();
        tree.leafGeometry.computeBoundingBox();
        const trunk = tree.trunkGeometry.boundingBox!;
        const leaf = tree.leafGeometry.boundingBox!;
        expect(trunk.min.y).toBeGreaterThan(-1.25);
        expect(trunk.max.y).toBeGreaterThan(params.height * 0.34);
        expect(trunk.max.y).toBeLessThan(params.height * 1.45);
        expect(leaf.min.y).toBeGreaterThan(-1.75);
        expect(leaf.max.y).toBeGreaterThan(params.height * 0.28);
        expect(leaf.max.x - leaf.min.x).toBeLessThan(params.crownRadius * 5 + 1);
        expect(leaf.max.z - leaf.min.z).toBeLessThan(params.crownRadius * 5 + 1);

        if (profile.silhouette !== 'frond') {
          const radialX = Math.min(Math.max(0.01, leaf.max.x), Math.max(0.01, -leaf.min.x)) /
            Math.max(Math.abs(leaf.max.x), Math.abs(leaf.min.x), 0.01);
          const radialZ = Math.min(Math.max(0.01, leaf.max.z), Math.max(0.01, -leaf.min.z)) /
            Math.max(Math.abs(leaf.max.z), Math.abs(leaf.min.z), 0.01);
          expect(radialX, `sample ${sample} variant ${variant} ${profile.silhouette} x balance`).toBeGreaterThan(0.025);
          expect(radialZ, `sample ${sample} variant ${variant} ${profile.silhouette} z balance`).toBeGreaterThan(0.025);
        }

        const position = tree.trunkGeometry.getAttribute('position') as THREE.BufferAttribute;
        const ringSize = params.radialSegments + 1;
        const rootRadius = ringRadius(position, 0, ringSize);
        let outerRadius = 0;
        let outerRings = 0;
        const stiff = tree.trunkGeometry.getAttribute('aStiff') as THREE.BufferAttribute;
        for (let start = 0; start + ringSize <= position.count; start += ringSize) {
          if (stiff.getX(start) < 0.72) continue;
          outerRadius += ringRadius(position, start, ringSize);
          outerRings++;
        }
        expect(outerRings).toBeGreaterThan(0);
        expect(rootRadius).toBeGreaterThan((outerRadius / outerRings) * 1.35);
      }
    }
  });

  it('hashes full buffers deterministically while keeping variants distinct', () => {
    for (const seed of [coordinateToSeed(0, 45), coordinateToSeed(-92, -79), 20260711]) {
      const profile = buildTreeProfile(seed);
      const hashes = new Set<number>();
      for (let variant = 0; variant < TREE_VARIANT_COUNT; variant++) {
        const params = paramsFromProfile(profile, variant);
        const geometrySeed = treeVariantSeed(seed, variant);
        const first = generateTree(geometrySeed, params);
        const second = generateTree(geometrySeed, params);
        const firstHash = geometryHash(first.trunkGeometry) ^ geometryHash(first.leafGeometry);
        const secondHash = geometryHash(second.trunkGeometry) ^ geometryHash(second.leafGeometry);
        expect(firstHash).toBe(secondHash);
        hashes.add(firstHash);
      }
      expect(hashes.size).toBe(TREE_VARIANT_COUNT);
    }
  });
});
