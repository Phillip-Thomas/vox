import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyJumpImpulse,
  integrateLocalGravity,
  GRAVITY_STRENGTH,
  DEFAULT_JUMP_SPEED,
  JETPACK_MAX_FUEL,
  JETPACK_REFILL_RATE,
  JETPACK_THRUST
} from './surfaceControls';

// One voxel is VOXEL_SCALE = 2 world units; a single jump must clear it.
const VOXEL = 2;

describe('jump tuning', () => {
  it('closed-form apex clears one voxel with margin', () => {
    const apex = (DEFAULT_JUMP_SPEED * DEFAULT_JUMP_SPEED) / (2 * GRAVITY_STRENGTH);
    expect(apex).toBeGreaterThanOrEqual(VOXEL);
  });

  it('simulated jump (impulse + gravity integration) reaches >= one voxel', () => {
    const up = new THREE.Vector3(0, 1, 0);
    const gravity = up.clone().multiplyScalar(-GRAVITY_STRENGTH);
    let vel = applyJumpImpulse(new THREE.Vector3(0, 0, 0), up, DEFAULT_JUMP_SPEED);
    let height = 0;
    const dt = 1 / 120;
    // integrate upward until velocity along up goes negative (apex)
    for (let i = 0; i < 1000 && vel.dot(up) > 0; i++) {
      vel = integrateLocalGravity(vel, gravity, up, dt, false);
      height += vel.dot(up) * dt;
    }
    expect(height).toBeGreaterThanOrEqual(VOXEL);
  });

  it('jetpack constants are sane (limited fuel + refill)', () => {
    expect(JETPACK_MAX_FUEL).toBeGreaterThan(0);
    expect(JETPACK_REFILL_RATE).toBeGreaterThan(0);
    expect(JETPACK_THRUST).toBeGreaterThan(GRAVITY_STRENGTH); // can actually lift
  });
});
