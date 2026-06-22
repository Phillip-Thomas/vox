import * as THREE from 'three';

// --- Continuous cube-planet gravity field (PROTOTYPE) ------------------------
//
// An alternative to the discrete 6-face state machine: a SINGLE smooth "up"
// field with no seams, so there are no faces to pick, no transitions, no
// resolver — and falling off / getting stuck while digging become impossible by
// construction (up always points roughly outward, gravity roughly inward).
//
// up(p) = normalize( Σ wᵢ · sign(pᵢ) · axisᵢ ),  wᵢ = softmax(sharpness · |pᵢ| / R)
//
// At a face CENTRE one weight dominates → up ≈ the face axis (DEAD FLAT, same as
// today). Approaching an EDGE two weights equalize → up rotates smoothly toward
// the neighbour (45° at the edge). At a CORNER three blend. `sharpness` controls
// how tightly the blend hugs the edges: higher = flatter faces + crisper edges.
// Gated behind ?gravity=smooth so the discrete system stays the default.

export interface GravityFieldParams {
  /** Higher = flatter faces, blend confined nearer the edges (~18-26 is sane). */
  sharpness: number;
  /** Planet radius (world units) used to normalize component magnitudes. */
  radius: number;
}

export const DEFAULT_GRAVITY_FIELD: GravityFieldParams = {
  sharpness: 22,
  radius: 50
};

const _up = new THREE.Vector3();

/**
 * Smooth outward "up" at a world position. Pure (writes into `target`). Falls
 * back to +Y only at the exact origin (degenerate).
 */
export function smoothUpForPosition(
  position: THREE.Vector3,
  params: Partial<GravityFieldParams> = {},
  target = new THREE.Vector3()
): THREE.Vector3 {
  const sharpness = params.sharpness ?? DEFAULT_GRAVITY_FIELD.sharpness;
  const radius = params.radius ?? DEFAULT_GRAVITY_FIELD.radius;

  const ax = Math.abs(position.x);
  const ay = Math.abs(position.y);
  const az = Math.abs(position.z);
  const cube = Math.max(ax, ay, az);
  if (cube < 1e-6) return target.set(0, 1, 0);

  // softmax over |component|/R, shifted by the max for numerical stability.
  const k = sharpness / radius;
  const m = cube;
  const wx = Math.exp(k * (ax - m));
  const wy = Math.exp(k * (ay - m));
  const wz = Math.exp(k * (az - m));
  const sum = wx + wy + wz;

  target.set(
    (wx / sum) * Math.sign(position.x || 1),
    (wy / sum) * Math.sign(position.y || 1),
    (wz / sum) * Math.sign(position.z || 1)
  );
  if (target.lengthSq() < 1e-9) return target.set(0, 1, 0);
  return target.normalize();
}

/** Convenience: inward gravity vector for a position (− up · g). */
export function smoothGravityForPosition(
  position: THREE.Vector3,
  gravityStrength: number,
  params: Partial<GravityFieldParams> = {},
  target = new THREE.Vector3()
): THREE.Vector3 {
  smoothUpForPosition(position, params, _up);
  return target.copy(_up).multiplyScalar(-gravityStrength);
}
