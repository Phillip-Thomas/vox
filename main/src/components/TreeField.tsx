import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { deterministicTangentForUp } from '../utils/surfaceControls';
import { generateTree } from '../utils/treeGen';
import { seededVoxelUnit } from '../utils/seededHash';
import { isDecoratableGrassVoxel } from '../utils/grassField';
import {
  createBarkMaterial,
  createLeafMaterial,
  updateTreeMaterials
} from '../utils/treeMaterials';
import { getSunDirection } from './SkyController';

// Extra instance slots so small grass-count fluctuations don't force a realloc.
const HEADROOM = 32;
// Surface offset: lift the trunk base to the voxel's outer face (cell spans ±1).
const SURFACE_OFFSET = 0.95;

interface TreeFieldProps {
  planetSize: number;
  terrainSeed: number;
  /** Player/camera world position for far-distance culling (optional). */
  playerPosition?: THREE.Vector3;
}

// Reused scratch (avoid per-instance allocation).
const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _scaleM = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _scratch = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _color = new THREE.Color();

/** Count grass voxels whose hash selects them for a tree (cheap signature). */
function countTreeVoxels(treeDensity: number, terrainSeed: number): number {
  if (treeDensity <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (seededVoxelUnit(x, y, z, 7, terrainSeed) < treeDensity) n++;
  }
  return n;
}

/**
 * Procedural trees. ONE space-colonization archetype generated at load, INSTANCED
 * across a deterministic ~treeDensity subset of grass voxels — mirroring how grass
 * works (procedural + instanced + local-up + profile-gated).
 *
 * Two InstancedMeshes (trunk + leaves) share the SAME per-instance matrices, so a
 * tree is two draw calls total. Orientation maps local +Y -> normalize(worldPos)
 * (the planet's local outward normal) so trees stand correctly on all 6 cube
 * faces; wind animates in object space.
 *
 * Capacity is GROWABLE React state (like GrassField) because voxels are added
 * AFTER mount. We NEVER put a declarative count={0} prop on the meshes (that
 * resets on re-render); count is owned imperatively in the fill + self-healed in
 * useFrame.
 */
export default function TreeField({ terrainSeed, playerPosition }: TreeFieldProps) {
  const density = getGraphicsQuality().treeDensity;

  const archetype = useMemo(() => (density > 0 ? generateTree(1337) : null), [density]);
  const barkMaterial = useMemo(() => (density > 0 ? createBarkMaterial() : null), [density]);
  const leafMaterial = useMemo(() => (density > 0 ? createLeafMaterial() : null), [density]);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);

  const [capacity, setCapacity] = useState(0);
  const signatureRef = useRef<string>('');

  const neededCapacity = () => countTreeVoxels(density, terrainSeed);

  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  // Fill BOTH meshes with the identical per-instance matrix set.
  const rebuild = () => {
    const trunk = trunkRef.current;
    const leaf = leafRef.current;
    if (!trunk || !leaf || density <= 0) return;

    const quality = getGraphicsQuality();
    const maxDist = quality.treeMaxDistance;
    const maxDistSq = maxDist * maxDist;
    const cap = trunk.instanceMatrix.count;

    let slot = 0;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      if (slot >= cap) break;
      if (!isDecoratableGrassVoxel(voxel)) continue;
      const [x, y, z] = voxel.position;
      if (seededVoxelUnit(x, y, z, 7, terrainSeed) >= density) continue;

      voxelCoordToWorld(x, y, z, _world);
      if (maxDist > 0 && playerPosition) {
        if (_world.distanceToSquared(playerPosition) > maxDistSq) continue;
      }

      // Local up = outward normal (correct on all 6 cube faces).
      if (_world.lengthSq() < 1e-6) _up.set(0, 1, 0);
      else _up.copy(_world).normalize();
      deterministicTangentForUp(_up, _tangent);
      _bitangent.crossVectors(_up, _tangent).normalize();

      // Orientation basis: local +Y -> up (same approach as grass).
      _basis.makeBasis(_tangent, _up, _bitangent);

      const yaw = seededVoxelUnit(x, y, z, 11, terrainSeed) * Math.PI * 2;
      _yaw.makeRotationY(yaw);
      const s = 0.7 + seededVoxelUnit(x, y, z, 23, terrainSeed) * 0.7; // 0.7 .. 1.4
      _scaleM.makeScale(s, s, s);

      _translate.makeTranslation(
        _world.x + _up.x * SURFACE_OFFSET,
        _world.y + _up.y * SURFACE_OFFSET,
        _world.z + _up.z * SURFACE_OFFSET
      );

      // m = translate * basis * yaw * scale
      _m.copy(_translate);
      _m.multiply(_basis);
      _m.multiply(_scratch.copy(_yaw).multiply(_scaleM));

      trunk.setMatrixAt(slot, _m);
      leaf.setMatrixAt(slot, _m);

      // Per-tree tint (also read by the leaf shader's instWorld hash, but a real
      // instanceColor gives bark/leaf subtle variation through Three's pipeline).
      const tint = seededVoxelUnit(x, y, z, 31, terrainSeed);
      _color.setHSL(0.28 + (tint - 0.5) * 0.06, 0.5, 0.45 + tint * 0.12);
      trunk.setColorAt(slot, _color);
      leaf.setColorAt(slot, _color);

      slot++;
    }

    trunk.count = slot;
    leaf.count = slot;
    trunk.instanceMatrix.needsUpdate = true;
    leaf.instanceMatrix.needsUpdate = true;
    if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
    if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
  };

  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  useEffect(() => {
    return () => {
      archetype?.trunkGeometry.dispose();
      archetype?.leafGeometry.dispose();
      barkMaterial?.dispose();
      leafMaterial?.dispose();
    };
  }, [archetype, barkMaterial, leafMaterial]);

  useFrame(() => {
    if (!barkMaterial || !leafMaterial || density <= 0) return;

    updateTreeMaterials(
      barkMaterial,
      leafMaterial,
      performance.now() / 1000,
      getSunDirection(),
      getGraphicsQuality()
    );

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) {
        growCapacity(needed);
      } else {
        signatureRef.current = sig;
        rebuild();
      }
    }
  });

  if (
    density <= 0 ||
    !archetype ||
    !barkMaterial ||
    !leafMaterial ||
    capacity <= 0
  ) {
    return null;
  }

  return (
    <>
      <instancedMesh
        ref={trunkRef}
        args={[archetype.trunkGeometry, barkMaterial, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      <instancedMesh
        ref={leafRef}
        args={[archetype.leafGeometry, leafMaterial, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </>
  );
}
