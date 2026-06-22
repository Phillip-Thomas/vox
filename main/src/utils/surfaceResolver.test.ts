import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolveSurfaceFrame, DEFAULT_RESOLVER_PARAMS } from './surfaceResolver';
import { FACE_NORMALS } from './surfaceControls';
import type { CubeFace } from '../types/cube';

const R = 50; // planetSize (world units)
const FACES: CubeFace[] = ['top', 'bottom', 'right', 'left', 'front', 'back'];

function resolve(pos: [number, number, number], vel: [number, number, number], face: CubeFace) {
  return resolveSurfaceFrame({
    position: new THREE.Vector3(...pos),
    velocity: new THREE.Vector3(...vel),
    currentFace: face,
    planetRadius: R
  });
}

describe('surface resolver — normal play', () => {
  it('holds when already on the correct face', () => {
    const r = resolve([0, 52, 0], [0, -1, 0], 'top');
    expect(r.mode).toBe('hold');
    expect(r.changed).toBe(false);
    expect(r.face).toBe('top');
  });

  it('is sticky at an edge near-tie (no dither)', () => {
    // x barely exceeds y -> within the sticky margin (0.04*50 = 2) -> hold.
    const r = resolve([52, 51, 0], [0, 0, 0], 'top');
    expect(r.mode).toBe('hold');
    expect(r.face).toBe('top');
  });

  it('is stable at a 3-face corner (holds current)', () => {
    const r = resolve([50, 50, 50], [0, 0, 0], 'top');
    expect(r.mode).toBe('hold');
    expect(r.face).toBe('top');
  });
});

describe('surface resolver — tunnelling', () => {
  it('freezes face identity deep inside (down a shaft)', () => {
    // cube-radius 18 < 0.5*50=25 -> interior freeze, even though x dominates.
    const r = resolve([18, 4, 2], [0, -5, 0], 'top');
    expect(r.mode).toBe('hold');
    expect(r.face).toBe('top'); // gravity stays down the original shaft
  });

  it('snaps to the true face on emergence on a DIFFERENT face', () => {
    // Climbed out on +X but the face is still stale 'top'.
    const r = resolve([52, 5, 3], [6, 0, 0], 'top');
    expect(r.mode).toBe('snap');
    expect(r.face).toBe('right');
    expect(r.changed).toBe(true);
    expect(r.reprojectVelocity).toBe(true);
  });

  it('snaps across to the OPPOSITE face (tunnel straight through)', () => {
    const r = resolve([2, -52, 1], [0, -8, 0], 'top');
    expect(r.mode).toBe('snap');
    expect(r.face).toBe('bottom');
  });
});

describe('surface resolver — wrong current face correction', () => {
  it('corrects a clearly wrong face in the band', () => {
    // On the +X shell but face wrongly says 'left'.
    const r = resolve([53, 6, 4], [0, 0, 0], 'left');
    expect(r.mode).toBe('snap');
    expect(r.face).toBe('right');
  });
});

describe('surface resolver — escape guard', () => {
  it('cancels outward velocity beyond the cancel shell', () => {
    // cube-radius 80 > 1.5*50=75. Moving outward along +x.
    const r = resolve([80, 4, 4], [12, 0, 0], 'right');
    expect(r.mode).toBe('escape');
    // outward (radial) component removed -> no longer flying outward.
    const outward = new THREE.Vector3(80, 4, 4).normalize();
    expect(r.velocityCorrection!.dot(outward)).toBeLessThanOrEqual(1e-4);
  });

  it('does not trigger escape for in-bounds jetpack altitude', () => {
    const r = resolve([0, 66, 0], [0, 5, 0], 'top'); // 66 < 75
    expect(r.mode).not.toBe('escape');
  });

  it('hard-clamps position beyond the emergency shell', () => {
    const r = resolve([130, 5, 5], [20, 0, 0], 'right');
    expect(r.mode).toBe('escape');
    expect(r.positionClamp).toBeDefined();
    const clamped = Math.max(
      Math.abs(r.positionClamp!.x), Math.abs(r.positionClamp!.y), Math.abs(r.positionClamp!.z)
    );
    expect(clamped).toBeLessThanOrEqual(R * (1 + DEFAULT_RESOLVER_PARAMS.emergencyFrac) + 1e-3);
  });
});

describe('surface resolver — invariants', () => {
  it('purity: does not mutate inputs', () => {
    const pos = new THREE.Vector3(52, 5, 3);
    const vel = new THREE.Vector3(6, 0, 0);
    resolveSurfaceFrame({ position: pos, velocity: vel, currentFace: 'top', planetRadius: R });
    expect(pos.toArray()).toEqual([52, 5, 3]);
    expect(vel.toArray()).toEqual([6, 0, 0]);
  });

  it('determinism: same input -> same resolution', () => {
    const a = resolve([52, 5, 3], [6, 0, 0], 'top');
    const b = resolve([52, 5, 3], [6, 0, 0], 'top');
    expect(a.mode).toBe(b.mode);
    expect(a.face).toBe(b.face);
  });

  it('NEVER resolves to a face the player is on the wrong side of (anti-fall-off)', () => {
    // For any in-band position and ANY (even wrong) current face, the resolved
    // face must have a POSITIVE score — i.e. gravity (-up) pulls inward, never
    // tangential/outward. This is the property that makes falling off impossible.
    let checked = 0;
    for (let i = 0; i < 4000; i++) {
      // pseudo-random but seedless: derive from i.
      const a = (i * 2654435761) >>> 0;
      const nx = ((a & 0xff) / 255) * 2 - 1;
      const ny = (((a >>> 8) & 0xff) / 255) * 2 - 1;
      const nz = (((a >>> 16) & 0xff) / 255) * 2 - 1;
      const v = new THREE.Vector3(nx, ny, nz);
      if (v.lengthSq() < 1e-3) continue;
      v.normalize();
      const radius = 27 + (((a >>> 24) & 0xff) / 255) * (74 - 27);
      const pos = v.multiplyScalar(radius);
      // Only assert in the actual SURFACE BAND (cube-radius, not euclidean):
      // interior-freeze positions intentionally hold whatever face they had.
      const cr = Math.max(Math.abs(pos.x), Math.abs(pos.y), Math.abs(pos.z));
      if (cr < R * 0.5 || cr > R * 1.5) continue;
      const face = FACES[i % FACES.length];
      const r = resolveSurfaceFrame({
        position: pos,
        velocity: new THREE.Vector3(0, 0, 0),
        currentFace: face,
        planetRadius: R
      });
      // resolved face always has the player on its OUTWARD side.
      expect(FACE_NORMALS[r.face].dot(pos)).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });
});
