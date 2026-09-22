import { createRequire } from 'node:module';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { RapierContext } from '@react-three/rapier';
import { canStepUp } from './playerStepProbe';
import { COLLIDER_HALF_EXTENT, PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS } from './cubeGravityConstants';

const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve('@react-three/rapier'));
const RAPIER = rendererRequire('@dimforge/rapier3d-compat') as RapierContext['rapier'];
const worlds: RapierContext['world'][] = [];
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });

// Actual frozen return-walk pose, gravity and blocking voxel from the GPU run.
const position = new THREE.Vector3(-47.711997985839844, 51.67729568481445, 23.510114669799805);
const up = new THREE.Vector3(-0.17208591247359684, 0.9850819451758598, 0.000004083361160678184);
const forward = new THREE.Vector3(0.9537880007975401, 0.1666180749405899, 0.2500537275021583);

function scene(blocks: number[][]) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); worlds.push(world);
  for (const [x, y, z] of blocks) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT).setTranslation(x, y, z));
  }
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const player = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...position.toArray()).setRotation(rotation));
  world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS), player);
  world.step();
  return { world, player };
}

describe('player step probe', () => {
  it('detects the shallow lip that caught the capsule on the earned return route', () => {
    const { world, player } = scene([[-46, 50, 24]]);
    expect(canStepUp(world, RAPIER, player, position, up, forward)).toBe(true);
  });

  it('does not climb a taller wall at that same lip', () => {
    const { world, player } = scene([[-46, 50, 24], [-46, 52, 24]]);
    expect(canStepUp(world, RAPIER, player, position, up, forward)).toBe(false);
  });

  it('does not manufacture a step in clear air or without movement', () => {
    const { world, player } = scene([]);
    expect(canStepUp(world, RAPIER, player, position, up, forward)).toBe(false);
    expect(canStepUp(world, RAPIER, player, position, up, new THREE.Vector3())).toBe(false);
  });
});
