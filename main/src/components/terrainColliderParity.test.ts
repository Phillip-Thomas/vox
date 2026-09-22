import { createRequire } from 'node:module';
import type { RapierContext } from '@react-three/rapier';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { COLLIDER_HALF_EXTENT, PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS, VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';

// Resolve the exact Rapier package used by the installed R3F renderer, including
// its nested version, rather than accidentally testing a second top-level copy.
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve('@react-three/rapier'));
const RAPIER = rendererRequire('@dimforge/rapier3d-compat') as RapierContext['rapier'];
type World = InstanceType<typeof RAPIER.World>;
type Collider = InstanceType<typeof RAPIER.Collider>;
const worlds: World[] = [];
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { for (const world of worlds.splice(0)) world.free(); });
const cells = Array.from({ length: 49 }, (_, index) => ({ x: index % 7 - 3, y: 25, z: Math.floor(index / 7) - 3 }));

function terrain(shared: boolean) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); worlds.push(world);
  const commonBody = shared ? world.createRigidBody(RAPIER.RigidBodyDesc.fixed()) : null;
  const colliders = new Map<string, Collider>();
  for (const { x, y, z } of cells) {
    const position = { x: x * VOXEL_SCALE, y: y * VOXEL_SCALE, z: z * VOXEL_SCALE };
    const body = commonBody ?? world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
    const shape = RAPIER.ColliderDesc.cuboid(COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT, COLLIDER_HALF_EXTENT);
    if (shared) shape.setTranslation(position.x, position.y, position.z);
    colliders.set(`${x},${z}`, world.createCollider(shape, body));
  }
  world.step();
  return { world, colliders };
}

function cast(world: World, x: number, z: number) {
  const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x, y: 60, z }, { x: 0, y: -1, z: 0 }), 20, true);
  return hit ? { time: hit.timeOfImpact, normal: { ...hit.normal }, position: { ...hit.collider.translation() } } : null;
}

describe('shared fixed terrain body', () => {
  it('preserves every support cast and collider/contact property with fewer bodies', () => {
    const before = terrain(false), after = terrain(true);
    expect(before.world.bodies.len()).toBe(cells.length);
    expect(after.world.bodies.len()).toBe(1);
    expect(after.world.colliders.len()).toBe(before.world.colliders.len());
    for (const cell of cells) {
      const key = `${cell.x},${cell.z}`;
      const old = before.colliders.get(key)!, current = after.colliders.get(key)!;
      expect(current.translation()).toEqual(old.translation());
      expect(current.rotation()).toEqual(old.rotation());
      expect(current.halfExtents()).toEqual(old.halfExtents());
      expect(current.friction()).toBe(old.friction());
      expect(current.restitution()).toBe(old.restitution());
      expect(current.isSensor()).toBe(old.isSensor());
      expect(current.collisionGroups()).toBe(old.collisionGroups());
      expect(current.solverGroups()).toBe(old.solverGroups());
      expect(current.frictionCombineRule()).toBe(old.frictionCombineRule());
      expect(current.restitutionCombineRule()).toBe(old.restitutionCombineRule());
      expect(current.contactSkin()).toBe(old.contactSkin());
      expect(current.activeHooks()).toBe(old.activeHooks());
      expect(current.activeEvents()).toBe(old.activeEvents());
      expect(current.activeCollisionTypes()).toBe(old.activeCollisionTypes());
      expect(current.contactForceEventThreshold()).toBe(old.contactForceEventThreshold());
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) {
        expect(cast(after.world, cell.x * VOXEL_SCALE + dx, cell.z * VOXEL_SCALE + dz))
          .toEqual(cast(before.world, cell.x * VOXEL_SCALE + dx, cell.z * VOXEL_SCALE + dz));
      }
    }
  });

  it('keeps capsule settling and self-excluded ground queries identical', () => {
    const settle = (shared: boolean) => {
      const { world } = terrain(shared);
      const player = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 57, 0).lockRotations());
      world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS), player);
      for (let i = 0; i < 240; i++) world.step();
      const position = player.translation();
      const ground = world.castRay(new RAPIER.Ray(position, { x: 0, y: -1, z: 0 }), 4, true, undefined, undefined, undefined, player);
      return { position, velocity: player.linvel(), groundDistance: ground?.timeOfImpact };
    };
    const before = settle(false), after = settle(true);
    expect(after).toEqual(before);
    expect(after.position.y).toBeGreaterThan(52);
    expect(after.groundDistance).toBeDefined();
    expect(Math.abs(after.velocity.y)).toBeLessThan(0.001);
  });

  it('disables/removes only the mined cell and immediately preserves adjacent support', () => {
    const { world, colliders } = terrain(true);
    const removed = colliders.get('0,0')!;
    removed.setEnabled(false);
    world.step();
    expect(cast(world, 0, 0)).toBeNull();
    expect(cast(world, VOXEL_SCALE, 0)).not.toBeNull();
    expect(colliders.get('1,0')!.isEnabled()).toBe(true);
    world.removeCollider(removed, true);
    world.step();
    expect(world.colliders.len()).toBe(cells.length - 1);
    expect(cast(world, 0, 0)).toBeNull();
    for (const cell of cells.filter(cell => cell.x || cell.z)) expect(cast(world, cell.x * VOXEL_SCALE, cell.z * VOXEL_SCALE)).not.toBeNull();
  });
});
