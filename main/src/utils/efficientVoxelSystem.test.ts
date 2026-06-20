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
});
