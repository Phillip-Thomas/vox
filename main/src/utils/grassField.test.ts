import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials';
import { voxelSystem } from './efficientVoxelSystem';
import { voxelCoordToWorld } from './cubeGravityConstants';
import {
  BLADES_PER_CLUMP,
  applyGrassInstanceBuffer,
  bladesPerVoxel,
  buildGrassInstanceBuffer,
  buildGrassInstances,
  computeBladeMatrix,
  countGrassVoxels,
  createBladeGeometry
} from './grassField';

const green = new THREE.Color(0x7cb342);

afterEach(() => {
  voxelSystem.reset();
});

describe('grass blade geometry', () => {
  it('roots the blade at y=0 and grows upward', () => {
    const geo = createBladeGeometry();
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(minY).toBeCloseTo(0, 5);
    expect(maxY).toBeGreaterThan(0.5);
  });

  it('uses a hairlike strand width instead of broad cartoon leaves', () => {
    const geo = createBladeGeometry();
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
    }
    expect(maxX - minX).toBeLessThanOrEqual(0.08);
  });
});

describe('computeBladeMatrix', () => {
  it('is deterministic for the same voxel + blade index', () => {
    const a = computeBladeMatrix(3, 25, -4, 2, new THREE.Matrix4());
    const b = computeBladeMatrix(3, 25, -4, 2, new THREE.Matrix4());
    for (let i = 0; i < 16; i++) {
      expect(a.elements[i]).toBeCloseTo(b.elements[i], 6);
    }
  });

  it('varies placement by world seed', () => {
    const a = computeBladeMatrix(3, 25, -4, 2, new THREE.Matrix4(), 111);
    const b = computeBladeMatrix(3, 25, -4, 2, new THREE.Matrix4(), 222);
    expect(a.elements.some((value, index) => Math.abs(value - b.elements[index]) > 0.001)).toBe(true);
  });

  it('orients local +Y toward the planet outward normal', () => {
    // A voxel on +X face: world up should point roughly +X.
    const x = 25;
    const y = 0;
    const z = 0;
    const m = computeBladeMatrix(x, y, z, 0, new THREE.Matrix4());

    // Local +Y axis = second basis column of the rotation part.
    const localUp = new THREE.Vector3(m.elements[4], m.elements[5], m.elements[6]).normalize();
    const expectedUp = voxelCoordToWorld(x, y, z, new THREE.Vector3()).normalize();
    expect(localUp.dot(expectedUp)).toBeGreaterThan(0.95);
  });

  it('places the blade root near the voxel outer surface', () => {
    const x = 0;
    const y = 25;
    const z = 0;
    const m = computeBladeMatrix(x, y, z, 0, new THREE.Matrix4());
    const translation = new THREE.Vector3().setFromMatrixPosition(m);
    const center = voxelCoordToWorld(x, y, z, new THREE.Vector3());
    // Root sits roughly one voxel-half (~1 world unit) outward from center,
    // plus tangent jitter (<~0.65).
    const dist = translation.distanceTo(center);
    expect(dist).toBeGreaterThan(0.3);
    expect(dist).toBeLessThan(2.0);
  });
});

describe('bladesPerVoxel', () => {
  it('scales density by the clump size and zeroes out for POTATO', () => {
    expect(bladesPerVoxel(0)).toBe(0);
    expect(bladesPerVoxel(1)).toBe(BLADES_PER_CLUMP);
    expect(bladesPerVoxel(4)).toBe(4 * BLADES_PER_CLUMP);
  });

  it('protects the denser hairlike strand budget', () => {
    expect(BLADES_PER_CLUMP).toBeGreaterThanOrEqual(20);
    expect(bladesPerVoxel(4)).toBeGreaterThanOrEqual(96);
  });
});

describe('buildGrassInstances', () => {
  it('places bladesPerVoxel(density) blades per grass voxel and ignores non-grass', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, green);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.GRASS, green);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.STONE, green);

    expect(countGrassVoxels()).toBe(2);

    const density = 4;
    const perVoxel = bladesPerVoxel(density);
    const mesh = new THREE.InstancedMesh(
      createBladeGeometry(),
      new THREE.MeshStandardMaterial(),
      countGrassVoxels() * perVoxel
    );

    const result = buildGrassInstances(mesh, density);
    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(2 * perVoxel);
    expect(mesh.count).toBe(2 * perVoxel);
  });

  it('ignores newly exposed grass voxels that should not host resources', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, green);
    voxelSystem.addVoxel(
      1,
      25,
      0,
      MaterialType.GRASS,
      green,
      undefined,
      { supportsSurfaceResources: false }
    );

    expect(countGrassVoxels()).toBe(1);

    const density = 4;
    const perVoxel = bladesPerVoxel(density);
    const mesh = new THREE.InstancedMesh(
      createBladeGeometry(),
      new THREE.MeshStandardMaterial(),
      2 * perVoxel
    );

    const result = buildGrassInstances(mesh, density);
    expect(result.voxelCount).toBe(1);
    expect(result.count).toBe(perVoxel);
  });

  it('respects far-distance culling', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, green); // near
    voxelSystem.addVoxel(100, 0, 0, MaterialType.GRASS, green); // far

    const density = 2;
    const perVoxel = bladesPerVoxel(density);
    const mesh = new THREE.InstancedMesh(
      createBladeGeometry(),
      new THREE.MeshStandardMaterial(),
      2 * perVoxel
    );

    // Player at the near voxel; far voxel (~200 world units away) culled at 60.
    const player = voxelCoordToWorld(0, 25, 0, new THREE.Vector3());
    const result = buildGrassInstances(mesh, density, 60, player);
    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(perVoxel); // only the near voxel placed
  });

  it('clamps to mesh capacity', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, green);
    const mesh = new THREE.InstancedMesh(
      createBladeGeometry(),
      new THREE.MeshStandardMaterial(),
      3
    );
    const result = buildGrassInstances(mesh, 6); // wants 18, capacity 3
    expect(result.count).toBe(3);
  });

  it('precomputed grass instance buffers match the live builder matrices', () => {
    const terrain = [
      { x: 0, y: 25, z: 0, material: MaterialType.GRASS, color: green },
      { x: 1, y: 25, z: 0, material: MaterialType.GRASS, color: green },
      { x: 2, y: 25, z: 0, material: MaterialType.STONE, color: green }
    ];
    for (const voxel of terrain) {
      voxelSystem.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
    }

    const density = 2;
    const capacity = 2 * bladesPerVoxel(density);
    const geometry = createBladeGeometry();
    const liveMesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(), capacity);
    const cachedMesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(), capacity);

    const live = buildGrassInstances(liveMesh, density, 0, null, 777, 1.2, 0.9, 1, 1);
    const buffer = buildGrassInstanceBuffer(terrain, {
      density,
      maxDistance: 0,
      playerWorld: null,
      worldSeed: 777,
      heightMul: 1.2,
      widthMul: 0.9,
      densityMul: 1,
      coverage: 1
    });
    const cached = applyGrassInstanceBuffer(cachedMesh, buffer);

    expect(cached).toEqual(live);
    expect(Array.from(cachedMesh.instanceMatrix.array.slice(0, cached.count * 16)))
      .toEqual(Array.from(liveMesh.instanceMatrix.array.slice(0, live.count * 16)));
  });
});
