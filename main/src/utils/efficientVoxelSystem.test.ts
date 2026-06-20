import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EfficientVoxelSystem } from './efficientVoxelSystem';

describe('EfficientVoxelSystem', () => {
  it('resets all lifecycle state and increments world id', () => {
    const system = new EfficientVoxelSystem(10);
    system.setOriginalTerrain([{ x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') }]);
    system.addVoxel(0, 0, 0, 'stone', new THREE.Color('gray'));
    system.removeVoxel(0, 0, 0);

    const before = system.getSnapshot();
    system.reset();
    const after = system.getSnapshot();

    expect(after.worldId).toBe(before.worldId + 1);
    expect(after.exposedVoxels).toBe(0);
    expect(after.originalTerrain).toBe(0);
    expect(after.deletedTerrain).toBe(0);
    expect(after.activeSlots).toBe(0);
  });

  it('does not expose buried neighbors unless bordering air or deleted terrain', () => {
    const system = new EfficientVoxelSystem(50);
    const terrain = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          terrain.push({ x, y, z, material: 'stone', color: new THREE.Color('gray') });
        }
      }
    }

    system.setOriginalTerrain(terrain);
    expect(system.shouldBeExposed(0, 0, 0)).toBe(false);
    system.addVoxel(1, 0, 0, 'stone', new THREE.Color('gray'));
    system.removeVoxel(1, 0, 0);
    expect(system.shouldBeExposed(0, 0, 0)).toBe(true);
  });

  it('uses explicit collision callbacks and cancels removed voxels through the active world id', () => {
    const system = new EfficientVoxelSystem(10);
    const request = vi.fn();
    const remove = vi.fn();
    system.setCollisionCallbacks({ request, remove });
    system.setOriginalTerrain([{ x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') }]);

    system.addVoxel(0, 0, 0, 'stone', new THREE.Color('gray'));
    expect(request).toHaveBeenCalledWith(0, 0, 0, system.getWorldId());

    system.removeVoxel(0, 0, 0);
    expect(remove).toHaveBeenCalledWith(0, 0, 0, system.getWorldId());
  });

  it('tracks edit version across successful voxel adds and removes', () => {
    const system = new EfficientVoxelSystem(10);
    const initialVersion = system.getEditVersion();

    system.addVoxel(0, 0, 0, 'stone', new THREE.Color('gray'));
    expect(system.getEditVersion()).toBe(initialVersion + 1);

    system.removeVoxel(0, 0, 0);
    expect(system.getEditVersion()).toBe(initialVersion + 2);

    system.removeVoxel(0, 0, 0);
    expect(system.getEditVersion()).toBe(initialVersion + 2);
  });

  it('marks newly exposed terrain as unable to host surface resources', () => {
    const system = new EfficientVoxelSystem(10);
    const color = new THREE.Color('gray');
    system.setOriginalTerrain([
      { x: 0, y: 0, z: 0, material: 'grass', color },
      { x: 1, y: 0, z: 0, material: 'grass', color }
    ]);

    system.addVoxel(1, 0, 0, 'grass', color);
    expect(system.supportsSurfaceResources(1, 0, 0)).toBe(true);

    system.removeVoxel(1, 0, 0);
    expect(system.exposeNeighbors(1, 0, 0)).toBe(1);
    expect(system.hasVoxel(0, 0, 0)).toBe(true);
    expect(system.supportsSurfaceResources(0, 0, 0)).toBe(false);
  });

  it('compacts slots and keeps slot-to-coordinate lookup authoritative after deletion', () => {
    const system = new EfficientVoxelSystem(10);
    const color = new THREE.Color('gray');

    system.addVoxel(0, 0, 0, 'stone', color);
    system.addVoxel(1, 0, 0, 'stone', color);
    system.addVoxel(2, 0, 0, 'stone', color);

    expect(system.getCoordForSlot(0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(system.getCoordForSlot(2)).toEqual({ x: 2, y: 0, z: 0 });

    system.removeVoxel(0, 0, 0);

    expect(system.getCoordForSlot(0)).toEqual({ x: 2, y: 0, z: 0 });
    expect(system.getCoordForSlot(1)).toEqual({ x: 1, y: 0, z: 0 });
    expect(system.getCoordForSlot(2)).toBeNull();
    expect(system.getStats().activeSlots).toBe(2);
  });

  it('invalidates cached instanced mesh bounds when voxels are added after an empty bounds pass', () => {
    const system = new EfficientVoxelSystem(10);
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.98, 1.98, 1.98),
      new THREE.MeshBasicMaterial(),
      10
    );
    const color = new THREE.Color('gray');

    mesh.count = 0;
    system.setMesh(mesh);

    mesh.computeBoundingSphere();
    expect(mesh.boundingSphere).not.toBeNull();

    system.addVoxel(0, 0, 5, 'stone', color);
    expect(mesh.boundingSphere).toBeNull();

    mesh.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 20),
      new THREE.Vector3(0, 0, -1),
      0,
      30
    );
    const hit = raycaster
      .intersectObject(mesh, false)
      .find(intersection => intersection.instanceId !== undefined);

    expect(hit?.instanceId).toBe(0);
    expect(system.getCoordForSlot(hit?.instanceId ?? -1)).toEqual({ x: 0, y: 0, z: 5 });
  });
});
