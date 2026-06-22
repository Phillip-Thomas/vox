import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { smoothUpForPosition } from './gravityField';

const R = 50;
const up = (x: number, y: number, z: number) =>
  smoothUpForPosition(new THREE.Vector3(x, y, z), { radius: R });

describe('continuous gravity field', () => {
  it('is dead-flat at face centres (up ≈ face axis)', () => {
    expect(up(0, 52, 0).dot(new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.999);
    expect(up(52, 0, 0).dot(new THREE.Vector3(1, 0, 0))).toBeGreaterThan(0.999);
    expect(up(0, 0, -52).dot(new THREE.Vector3(0, 0, -1))).toBeGreaterThan(0.999);
  });

  it('stays nearly flat across most of a face (blend hugs the edge)', () => {
    // 80% out toward the +X edge on the top face: still mostly +Y.
    const u = up(40, 52, 0);
    expect(u.dot(new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.95);
  });

  it('blends ~45° at an edge (top/right)', () => {
    const u = up(50, 50, 0);
    const diag = new THREE.Vector3(1, 1, 0).normalize();
    expect(u.dot(diag)).toBeGreaterThan(0.999); // halfway between +Y and +X
  });

  it('is continuous: tiny position changes give tiny up changes (no seam)', () => {
    let prev = up(20, 50, 0).clone();
    let maxStep = 0;
    for (let x = 20.5; x <= 50; x += 0.5) {
      const cur = up(x, 50, 0);
      maxStep = Math.max(maxStep, prev.distanceTo(cur));
      prev = cur.clone();
    }
    // No discontinuity: each 0.5-unit step rotates up only slightly. A discrete
    // face flip would jump ~0.7-1.4 here; the smooth field stays well under.
    expect(maxStep).toBeLessThan(0.15);
  });

  it('always points outward (gravity always pulls inward) — cannot fall off', () => {
    for (let i = 0; i < 3000; i++) {
      const a = (i * 2654435761) >>> 0;
      const px = ((a & 0xff) / 255) * 2 - 1;
      const py = (((a >>> 8) & 0xff) / 255) * 2 - 1;
      const pz = (((a >>> 16) & 0xff) / 255) * 2 - 1;
      const p = new THREE.Vector3(px, py, pz);
      if (p.lengthSq() < 1e-3) continue;
      p.multiplyScalar(20 + (((a >>> 24) & 0xff) / 255) * 60);
      const u = smoothUpForPosition(p, { radius: R });
      // up has a positive component along the outward radial -> gravity inward.
      expect(u.dot(p.clone().normalize())).toBeGreaterThan(0);
    }
  });

  it('handles the degenerate origin without NaN', () => {
    const u = up(0, 0, 0);
    expect(Number.isFinite(u.x + u.y + u.z)).toBe(true);
    expect(u.lengthSq()).toBeGreaterThan(0.9);
  });
});
