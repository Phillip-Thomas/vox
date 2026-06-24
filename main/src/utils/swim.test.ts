import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { composeSwimVelocity, SWIM_SPEED, SWIM_MAX_RISE } from './surfaceControls';

const UP = new THREE.Vector3(0, 1, 0);
const NONE = { forward: false, backward: false, left: false, right: false, ascend: false, descend: false };
const DT = 1 / 60;

// Run the swim integrator forward N steps from rest with a fixed look + input.
function simulate(look: THREE.Vector3, input: typeof NONE, steps: number): THREE.Vector3 {
  let v = new THREE.Vector3();
  for (let i = 0; i < steps; i++) v = composeSwimVelocity(v, look, UP, input, DT);
  return v;
}

describe('composeSwimVelocity (underwater 6-DOF)', () => {
  it('idle drifts gently UP (positive buoyancy), capped at the terminal rise', () => {
    const v = simulate(new THREE.Vector3(0, 0, -1), NONE, 600);
    expect(v.dot(UP)).toBeGreaterThan(0);                 // floats toward the surface
    expect(v.dot(UP)).toBeLessThanOrEqual(SWIM_MAX_RISE + 1e-3); // gentle, not a pop
  });

  it('swims toward the FULL camera look direction (incl. pitch), not just the tangent', () => {
    const look = new THREE.Vector3(0, 0.7, -0.7).normalize(); // looking up-and-forward
    const v = simulate(look, { ...NONE, forward: true }, 600);
    expect(v.length()).toBeGreaterThan(SWIM_SPEED * 0.8);  // approaches swim speed
    expect(v.clone().normalize().dot(look)).toBeGreaterThan(0.95); // aligned with the look ray
  });

  it('descend drives the velocity downward (against buoyancy)', () => {
    const v = simulate(new THREE.Vector3(0, 0, -1), { ...NONE, descend: true }, 200);
    expect(v.dot(UP)).toBeLessThan(0);
  });

  it('is heavy/inertial — a single step does not snap to full speed', () => {
    const v1 = composeSwimVelocity(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), UP, { ...NONE, forward: true }, DT);
    expect(v1.length()).toBeGreaterThan(0);
    expect(v1.length()).toBeLessThan(SWIM_SPEED * 0.5);
  });

  it('active upward swim is NOT capped by the passive terminal rise', () => {
    const v = simulate(new THREE.Vector3(0, 1, 0), { ...NONE, ascend: true }, 600);
    expect(v.dot(UP)).toBeGreaterThan(SWIM_MAX_RISE); // pressing up beats the idle cap
  });
});
