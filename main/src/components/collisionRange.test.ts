import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { createCollisionRangeScratch, withinCollisionRange } from './collisionRange.ts';

// The predicate as it was written inside EfficientPlanet before extraction —
// allocating — kept here as the reference the allocation-free version must match.
function reference(
  x: number, y: number, z: number,
  position: THREE.Vector3 | null, surfaceUp: THREE.Vector3, range: number, minDistance: number
): boolean {
  if (!position) return true;
  const voxelWorld = voxelCoordToWorld(x, y, z);
  const offset = voxelWorld.sub(position);
  const distanceSq = offset.lengthSq();
  if (distanceSq > range * range) return false;
  const distance = Math.sqrt(distanceSq);
  if (distance >= minDistance) return true;
  const gravityDirection = surfaceUp.clone().multiplyScalar(-1);
  const supportDistance = offset.dot(gravityDirection);
  return supportDistance > 0.4 && supportDistance < 5;
}

describe('withinCollisionRange', () => {
  it('matches the original allocating predicate over a dense lattice of cases', () => {
    const scratch = createCollisionRangeScratch();
    const ups = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)];
    const players = [new THREE.Vector3(3.2, 51.7, -2.1), new THREE.Vector3(-20, 4, 30), null];
    let checked = 0;
    for (const up of ups) for (const player of players) {
      for (let x = -14; x <= 14; x += 2) for (let y = 18; y <= 30; y += 1) for (let z = -14; z <= 14; z += 3) {
        expect(withinCollisionRange(x, y, z, player, up, 24, 6, scratch))
          .toBe(reference(x, y, z, player, up, 24, 6));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('is allocation-free: the scratch vectors are the only ones it writes', () => {
    const scratch = createCollisionRangeScratch();
    const before = { offset: scratch.offset, gravity: scratch.gravity };
    withinCollisionRange(1, 25, 1, new THREE.Vector3(2, 52, 2), new THREE.Vector3(0, 1, 0), 24, 6, scratch);
    expect(scratch.offset).toBe(before.offset);
    expect(scratch.gravity).toBe(before.gravity);
  });

  it('accepts everything while the player position is unknown', () => {
    expect(withinCollisionRange(999, 999, 999, null, new THREE.Vector3(0, 1, 0), 24, 6, createCollisionRangeScratch())).toBe(true);
  });
});
