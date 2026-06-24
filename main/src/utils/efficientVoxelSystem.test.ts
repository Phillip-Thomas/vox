import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EfficientVoxelSystem, type InitialTerrainMeshData, type TerrainVoxel } from './efficientVoxelSystem';

function createTestMesh(capacity: number) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.98, 1.98, 1.98),
    new THREE.MeshBasicMaterial({ vertexColors: true }),
    capacity
  );
  mesh.count = 0;
  return mesh;
}

function sliceAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, count: number) {
  return Array.from(attribute.array.slice(0, count * attribute.itemSize));
}

function captureInitialTerrainMeshData(mesh: THREE.InstancedMesh, count: number): InitialTerrainMeshData {
  return {
    count,
    matrices: new Float32Array(mesh.instanceMatrix.array.slice(0, count * 16)),
    colors: new Float32Array(mesh.instanceColor!.array.slice(0, count * 3)),
    instanceData: new Float32Array(
      (mesh.geometry.getAttribute('aInstanceData') as THREE.BufferAttribute).array.slice(0, count * 2)
    )
  };
}

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

  // The persistence lynchpin: replaying a saved dig (applyTerrainDiff) must reproduce
  // the EXACT shell that live mining (removeVoxel + exposeNeighbors per coord) produces
  // — same exposed coords AND same supportsSurfaceResources flags — and be order-free.
  describe('applyTerrainDiff (terrain-edit replay)', () => {
    const DIRS: Array<[number, number, number]> = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    function block(r: number): TerrainVoxel[] {
      const t: TerrainVoxel[] = [];
      for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) {
        t.push({ x, y, z, material: 'stone', color: new THREE.Color('gray') });
      }
      return t;
    }
    function surface(all: TerrainVoxel[]): TerrainVoxel[] {
      const set = new Set(all.map(v => `${v.x},${v.y},${v.z}`));
      return all.filter(v => DIRS.some(d => !set.has(`${v.x + d[0]},${v.y + d[1]},${v.z + d[2]}`)));
    }
    function sys(all: TerrainVoxel[]): EfficientVoxelSystem {
      const s = new EfficientVoxelSystem(2000);
      s.setMesh(createTestMesh(2000));
      s.populateInitialTerrain(all, surface(all), {});
      return s;
    }
    function shell(s: EfficientVoxelSystem): string {
      return [...s.getAllVoxels().entries()]
        .map(([k, v]) => `${k}:${v.supportsSurfaceResources ? 1 : 0}`)
        .sort()
        .join('|');
    }

    it('reproduces a single dig exactly (coords + surface-resource flags)', () => {
      const all = block(1);
      const live = sys(all);
      live.removeVoxel(0, 1, 0); live.exposeNeighbors(0, 1, 0);
      const replay = sys(all);
      replay.applyTerrainDiff([[0, 1, 0]]);
      expect(shell(replay)).toBe(shell(live));
    });

    it('reproduces a 2-deep tunnel and is ORDER-INDEPENDENT', () => {
      const all = block(1);
      const live = sys(all);
      live.removeVoxel(0, 1, 0); live.exposeNeighbors(0, 1, 0); // dig top
      live.removeVoxel(0, 0, 0); live.exposeNeighbors(0, 0, 0); // dig newly-revealed center
      const target = shell(live);

      const fwd = sys(all); fwd.applyTerrainDiff([[0, 1, 0], [0, 0, 0]]);
      const rev = sys(all); rev.applyTerrainDiff([[0, 0, 0], [0, 1, 0]]); // reversed order
      expect(shell(fwd)).toBe(target);
      expect(shell(rev)).toBe(target); // deep coord not yet exposed at populate — still works
    });

    it('records the diff and bumps editVersion so foliage rebuilds', () => {
      const all = block(1);
      const s = sys(all);
      const before = s.getEditVersion();
      s.applyTerrainDiff([[0, 1, 0]]);
      expect(s.getDeletedVoxels()).toContainEqual([0, 1, 0]);
      expect(s.getEditVersion()).toBeGreaterThan(before);
    });
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
    const mesh = createTestMesh(10);
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

  it('bulk initial terrain population matches one-by-one voxel adds', () => {
    const terrain: TerrainVoxel[] = [
      { x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color(0x858c90) },
      { x: 1, y: 0, z: 0, material: 'grass', color: new THREE.Color(0x7cb342) },
      { x: 0, y: 1, z: 0, material: 'gold', color: new THREE.Color(0xffd700) },
      { x: 0, y: 0, z: 1, material: 'dirt', color: new THREE.Color(0x8b4513) }
    ];
    const initialVoxels = terrain.slice();

    const sequential = new EfficientVoxelSystem(10);
    const sequentialMesh = createTestMesh(10);
    const sequentialRequest = vi.fn();
    sequential.setMesh(sequentialMesh);
    sequential.setCollisionCallbacks({ request: sequentialRequest, remove: vi.fn() });
    sequential.setOriginalTerrain(terrain);
    for (const voxel of initialVoxels) {
      sequential.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
    }

    const bulk = new EfficientVoxelSystem(10);
    const bulkMesh = createTestMesh(10);
    const bulkRequest = vi.fn();
    bulk.setMesh(bulkMesh);
    bulk.setCollisionCallbacks({ request: bulkRequest, remove: vi.fn() });
    const added = bulk.populateInitialTerrain(terrain, initialVoxels);

    expect(added).toBe(initialVoxels.length);
    expect(bulk.getSnapshot()).toEqual(sequential.getSnapshot());
    expect(bulk.getStats()).toEqual(sequential.getStats());
    expect(bulkRequest.mock.calls).toEqual(sequentialRequest.mock.calls);

    for (let slot = 0; slot < initialVoxels.length; slot++) {
      expect(bulk.getCoordForSlot(slot)).toEqual(sequential.getCoordForSlot(slot));
    }

    for (const voxel of initialVoxels) {
      const sequentialVoxel = sequential.getVoxel(voxel.x, voxel.y, voxel.z);
      const bulkVoxel = bulk.getVoxel(voxel.x, voxel.y, voxel.z);
      expect(bulkVoxel?.position).toEqual(sequentialVoxel?.position);
      expect(bulkVoxel?.material).toBe(sequentialVoxel?.material);
      expect(bulkVoxel?.color.getHex()).toBe(sequentialVoxel?.color.getHex());
      expect(bulkVoxel?.supportsSurfaceResources).toBe(true);
    }

    expect(sequentialMesh.count).toBe(initialVoxels.length);
    expect(bulkMesh.count).toBe(sequentialMesh.count);
    expect(sliceAttribute(bulkMesh.instanceMatrix, initialVoxels.length))
      .toEqual(sliceAttribute(sequentialMesh.instanceMatrix, initialVoxels.length));
    expect(sliceAttribute(bulkMesh.instanceColor!, initialVoxels.length))
      .toEqual(sliceAttribute(sequentialMesh.instanceColor!, initialVoxels.length));
    expect(sliceAttribute(
      bulkMesh.geometry.getAttribute('aInstanceData') as THREE.BufferAttribute,
      initialVoxels.length
    )).toEqual(sliceAttribute(
      sequentialMesh.geometry.getAttribute('aInstanceData') as THREE.BufferAttribute,
      initialVoxels.length
    ));
  });

  it('bulk initial terrain can defer collision requests for single-pass caller queuing', () => {
    const system = new EfficientVoxelSystem(2);
    const mesh = createTestMesh(2);
    const request = vi.fn();
    const terrain: TerrainVoxel[] = [
      { x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') },
      { x: 1, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') },
      { x: 2, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') }
    ];

    system.setMesh(mesh);
    system.setCollisionCallbacks({ request, remove: vi.fn() });

    expect(system.populateInitialTerrain(terrain, terrain, { requestCollisions: false })).toBe(2);
    expect(request).not.toHaveBeenCalled();
    expect(system.getSnapshot().activeSlots).toBe(2);
    expect(system.getEditVersion()).toBe(2);
  });

  it('bulk initial terrain can install precomputed mesh buffers exactly', () => {
    const terrain: TerrainVoxel[] = [
      { x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color(0x858c90) },
      { x: 1, y: 0, z: 0, material: 'grass', color: new THREE.Color(0x7cb342) },
      { x: 0, y: 1, z: 0, material: 'gold', color: new THREE.Color(0xffd700) },
      { x: 0, y: 0, z: 1, material: 'dirt', color: new THREE.Color(0x8b4513) }
    ];

    const sequential = new EfficientVoxelSystem(10);
    const sequentialMesh = createTestMesh(10);
    sequential.setMesh(sequentialMesh);
    sequential.setOriginalTerrain(terrain);
    for (const voxel of terrain) {
      sequential.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
    }

    const meshData = captureInitialTerrainMeshData(sequentialMesh, terrain.length);
    const bulk = new EfficientVoxelSystem(10);
    const bulkMesh = createTestMesh(10);
    bulk.setMesh(bulkMesh);
    const added = bulk.populateInitialTerrain(terrain, terrain, {
      initialTerrainMeshData: meshData,
      originalTerrainByCoord: EfficientVoxelSystem.buildOriginalTerrainMap(terrain),
      requestCollisions: false
    });

    expect(added).toBe(terrain.length);
    expect(sliceAttribute(bulkMesh.instanceMatrix, terrain.length))
      .toEqual(sliceAttribute(sequentialMesh.instanceMatrix, terrain.length));
    expect(sliceAttribute(bulkMesh.instanceColor!, terrain.length))
      .toEqual(sliceAttribute(sequentialMesh.instanceColor!, terrain.length));
    expect(sliceAttribute(
      bulkMesh.geometry.getAttribute('aInstanceData') as THREE.BufferAttribute,
      terrain.length
    )).toEqual(sliceAttribute(
      sequentialMesh.geometry.getAttribute('aInstanceData') as THREE.BufferAttribute,
      terrain.length
    ));
  });

  it('does not mutate a supplied shared original-terrain map on reset', () => {
    const system = new EfficientVoxelSystem(4);
    const terrain: TerrainVoxel[] = [
      { x: 0, y: 0, z: 0, material: 'stone', color: new THREE.Color('gray') },
      { x: 1, y: 0, z: 0, material: 'grass', color: new THREE.Color('green') }
    ];
    const sharedTerrain = EfficientVoxelSystem.buildOriginalTerrainMap(terrain);

    system.populateInitialTerrain(terrain, terrain, {
      originalTerrainByCoord: sharedTerrain,
      requestCollisions: false
    });

    expect(system.wasOriginalTerrain(1, 0, 0)).toBe(true);
    system.reset();

    expect(sharedTerrain.size).toBe(terrain.length);
    expect(sharedTerrain.get('1,0,0')?.material).toBe('grass');
    expect(sharedTerrain.get('1,0,0')?.color.getHex()).toBe(new THREE.Color('green').getHex());
  });
});
