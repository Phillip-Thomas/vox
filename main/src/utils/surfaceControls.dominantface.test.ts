import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dominantFaceForPosition, FACE_NORMALS, getSurfaceState, quaternionForUp } from './surfaceControls';
import type { CubeFace } from '../types/cube';

describe('dominantFaceForPosition', () => {
  const R = 50;
  const cases: Array<[THREE.Vector3, CubeFace]> = [
    [new THREE.Vector3(0, R, 0), 'top'],
    [new THREE.Vector3(0, -R, 0), 'bottom'],
    [new THREE.Vector3(R, 0, 0), 'right'],
    [new THREE.Vector3(-R, 0, 0), 'left'],
    [new THREE.Vector3(0, 0, R), 'front'],
    [new THREE.Vector3(0, 0, -R), 'back']
  ];

  it('returns the correct face for a point centered on each of the 6 faces', () => {
    for (const [pos, face] of cases) {
      expect(dominantFaceForPosition(pos)).toBe(face);
    }
  });

  it('picks the dominant axis for off-center points (still on the right face)', () => {
    // On the +Y (top) face but offset in x/z — y is still dominant.
    expect(dominantFaceForPosition(new THREE.Vector3(20, R, -15))).toBe('top');
    // On the -X (left) face but offset — x dominant and negative.
    expect(dominantFaceForPosition(new THREE.Vector3(-R, 12, 8))).toBe('left');
  });

  it('the derived surface gravity points inward (opposite the face normal)', () => {
    for (const [pos, face] of cases) {
      const s = getSurfaceState(dominantFaceForPosition(pos));
      // gravity should oppose the face normal (point toward planet center).
      expect(s.gravity.clone().normalize().dot(FACE_NORMALS[face])).toBeCloseTo(-1, 5);
    }
  });
});

describe('quaternionForUp', () => {
  const faces: CubeFace[] = ['top', 'bottom', 'right', 'left', 'front', 'back'];
  it('rotates the canonical +Y up onto each face normal', () => {
    for (const face of faces) {
      const up = FACE_NORMALS[face];
      const q = quaternionForUp(up);
      const rotated = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      // local +Y, rotated by the spawn quaternion, must land on the face up.
      expect(rotated.dot(up)).toBeCloseTo(1, 5);
    }
  });
});
