import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { measureWarpMetric } from '../utils/warpMetrics';
import { deterministicTangentForUp } from '../utils/surfaceControls';
import { generateTree } from '../utils/treeGen';
import { buildTreeProfile, paramsFromProfile } from '../utils/treeProfile';
import { seededVoxelUnit } from '../utils/seededHash';
import { isDecoratableGrassVoxel } from '../utils/grassField';
import {
  createBarkMaterial,
  createLeafMaterial,
  createBlossomMaterial,
  createImpostorMaterial,
  applyTreeProfileToMaterials,
  updateTreeMaterials
} from '../utils/treeMaterials';
import { getSunDirection, getMoonDirection } from './SkyController';

// Extra instance slots so small grass-count fluctuations don't force a realloc.
const HEADROOM = 32;
// Surface offset: lift the trunk base to the voxel's outer face (cell spans ±1).
const SURFACE_OFFSET = 0.95;
// Near trees (full geometry) inside this fraction of treeMaxDistance; beyond it
// (up to treeMaxDistance) trees use the cheap cross-billboard impostor.
const IMPOSTOR_FRAC = 0.5;

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
 * Procedural trees. ONE per-planet species (profile from terrainSeed) generated
 * at load, INSTANCED across a deterministic ~treeDensity subset of grass voxels —
 * mirroring grass (procedural + instanced + local-up + profile-gated).
 *
 * Up to FOUR InstancedMeshes share the SAME per-instance matrices:
 *   trunk + leaf + blossom (only if the planet blooms) for NEAR trees, and a
 *   2-quad cross-billboard impostor for FAR trees (LOD). Orientation maps local
 *   +Y -> normalize(worldPos) (the planet's outward normal) so trees stand
 *   correctly on all 6 cube faces; wind animates in object space.
 *
 * Capacity is GROWABLE React state (like GrassField) because voxels are added
 * AFTER mount. We NEVER put a declarative count prop on the meshes (that resets
 * on re-render); count is owned imperatively in the fill + self-healed in
 * useFrame across all meshes.
 */
export default function TreeField({ terrainSeed, playerPosition }: TreeFieldProps) {
  const density = getGraphicsQuality().treeDensity;

  // Per-planet species: profile from terrainSeed ONLY.
  const profile = useMemo(
    () => measureWarpMetric('tree:profile', () => buildTreeProfile(terrainSeed)),
    [terrainSeed]
  );
  const hasBlossom = profile.bloomAmount > 0;

  // Geometry built ONCE per world (terrainSeed + density). FIXES the old
  // hardcoded generateTree(1337).
  const archetype = useMemo(
    () => measureWarpMetric(
      'tree:archetype_generate',
      () => (density > 0 ? generateTree(terrainSeed, paramsFromProfile(profile)) : null),
      result => result
        ? {
            trunkVerts: result.trunkGeometry.attributes.position.count,
            leafVerts: result.leafGeometry.attributes.position.count,
            blossomVerts: result.blossomGeometry?.attributes.position.count ?? 0,
            impostorVerts: result.impostorGeometry.attributes.position.count
          }
        : { skipped: true }
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainSeed, density]
  );

  const barkMaterial = useMemo(() => (density > 0 ? createBarkMaterial() : null), [density]);
  const leafMaterial = useMemo(() => (density > 0 ? createLeafMaterial() : null), [density]);
  const blossomMaterial = useMemo(
    () => (density > 0 && hasBlossom ? createBlossomMaterial() : null),
    [density, hasBlossom]
  );
  const impostorMaterial = useMemo(
    () => (density > 0 ? createImpostorMaterial() : null),
    [density]
  );

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const impostorRef = useRef<THREE.InstancedMesh>(null);

  const [capacity, setCapacity] = useState(0);
  const signatureRef = useRef<string>('');
  const profileAppliedRef = useRef(false);
  // Player position at the last LOD re-bucket; we re-run the (alloc-free) rebuild
  // once the player has moved enough so near/full vs far/impostor and the
  // max-distance cull actually FOLLOW the camera instead of freezing at spawn.
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const neededCapacity = () => measureWarpMetric(
    'tree:count_capacity',
    () => countTreeVoxels(density, terrainSeed),
    needed => ({ needed })
  );

  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  // Fill all meshes. NEAR trees -> trunk+leaf+blossom slots; FAR -> impostor slot.
  const rebuild = () => {
    const trunk = trunkRef.current;
    const leaf = leafRef.current;
    const impostor = impostorRef.current;
    if (!trunk || !leaf || !impostor || density <= 0) return;
    const blossom = blossomRef.current; // may be null when planet doesn't bloom

    measureWarpMetric(
      'tree:rebuild_instances',
      () => {
    const quality = getGraphicsQuality();
    const maxDist = quality.treeMaxDistance;
    const maxDistSq = maxDist * maxDist;
    const impostorDist = maxDist * IMPOSTOR_FRAC;
    const impostorDistSq = impostorDist * impostorDist;
    const cap = trunk.instanceMatrix.count;

    let nearSlot = 0;
    let farSlot = 0;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      if (nearSlot >= cap && farSlot >= cap) break;
      if (!isDecoratableGrassVoxel(voxel)) continue;
      const [x, y, z] = voxel.position;
      if (seededVoxelUnit(x, y, z, 7, terrainSeed) >= density) continue;

      voxelCoordToWorld(x, y, z, _world);

      let distSq = -1;
      if (playerPosition) distSq = _world.distanceToSquared(playerPosition);
      // cull beyond max distance entirely.
      if (maxDist > 0 && distSq >= 0 && distSq > maxDistSq) continue;
      const near = maxDist <= 0 || distSq < 0 || distSq <= impostorDistSq;
      if (near && nearSlot >= cap) continue;
      if (!near && farSlot >= cap) continue;

      // Local up = outward normal (correct on all 6 cube faces).
      if (_world.lengthSq() < 1e-6) _up.set(0, 1, 0);
      else _up.copy(_world).normalize();
      deterministicTangentForUp(_up, _tangent);
      _bitangent.crossVectors(_up, _tangent).normalize();

      // Orientation basis: local +Y -> up (same approach as grass).
      _basis.makeBasis(_tangent, _up, _bitangent);

      const yaw = seededVoxelUnit(x, y, z, 11, terrainSeed) * Math.PI * 2;
      _yaw.makeRotationY(yaw);
      const s = 0.8 + seededVoxelUnit(x, y, z, 23, terrainSeed) * 0.5; // 0.8 .. 1.3
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

      // NOTE: no per-instance setColorAt. The per-PLANET leaf/flower colours come
      // from the material uniforms (applyTreeProfileToMaterials), and per-instance
      // variation is the in-shader `vTint` (hashed from instance world pos). A
      // hardcoded green instanceColor here would multiply over <color_fragment>
      // and contaminate every alien-hued / flowering planet — so we don't set it.

      if (near) {
        trunk.setMatrixAt(nearSlot, _m);
        leaf.setMatrixAt(nearSlot, _m);
        if (blossom) {
          blossom.setMatrixAt(nearSlot, _m);
        }
        nearSlot++;
      } else {
        impostor.setMatrixAt(farSlot, _m);
        farSlot++;
      }
    }

    trunk.count = nearSlot;
    leaf.count = nearSlot;
    impostor.count = farSlot;
    trunk.instanceMatrix.needsUpdate = true;
    leaf.instanceMatrix.needsUpdate = true;
    impostor.instanceMatrix.needsUpdate = true;
    if (blossom) {
      blossom.count = nearSlot;
      blossom.instanceMatrix.needsUpdate = true;
    }
        return { near: nearSlot, far: farSlot, capacity: cap };
      },
      result => result
    );
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

  // Push per-planet colours into the materials once they exist.
  useEffect(() => {
    profileAppliedRef.current = false;
  }, [profile, barkMaterial, leafMaterial, blossomMaterial, impostorMaterial]);

  useEffect(() => {
    return () => {
      archetype?.trunkGeometry.dispose();
      archetype?.leafGeometry.dispose();
      archetype?.blossomGeometry.dispose();
      archetype?.impostorGeometry.dispose();
      barkMaterial?.dispose();
      leafMaterial?.dispose();
      blossomMaterial?.dispose();
      impostorMaterial?.dispose();
    };
  }, [
    archetype,
    barkMaterial,
    leafMaterial,
    blossomMaterial,
    impostorMaterial
  ]);

  useFrame(() => {
    if (!barkMaterial || !leafMaterial || !impostorMaterial || density <= 0) return;

    // Apply per-planet colours once the shaders have compiled (uniforms exist).
    if (!profileAppliedRef.current) {
      const ready = (leafMaterial.userData.shader as unknown) !== undefined;
      if (ready) {
        applyTreeProfileToMaterials(
          profile,
          barkMaterial,
          leafMaterial,
          blossomMaterial,
          impostorMaterial
        );
        profileAppliedRef.current = true;
      }
    }

    updateTreeMaterials(
      barkMaterial,
      leafMaterial,
      blossomMaterial,
      impostorMaterial,
      performance.now() / 1000,
      getSunDirection(),
      getMoonDirection(),
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
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 100) {
      // Player moved >10u since the last bucket — re-run the LOD/cull pass so the
      // near/impostor split and max-distance cull track the camera.
      lastBucketPos.current.copy(playerPosition);
      rebuild();
    }
  });

  if (
    density <= 0 ||
    !archetype ||
    !barkMaterial ||
    !leafMaterial ||
    !impostorMaterial ||
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
      {hasBlossom && blossomMaterial && (
        <instancedMesh
          ref={blossomRef}
          args={[archetype.blossomGeometry, blossomMaterial, capacity]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
        />
      )}
      <instancedMesh
        ref={impostorRef}
        args={[archetype.impostorGeometry, impostorMaterial, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </>
  );
}
