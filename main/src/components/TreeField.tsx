import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality, getQualityProfile } from '../config/graphicsSettings';
import { getVoxelRealityEffects, lifeFieldsHidden } from '../game/systems/realityRenderSystem';
import { isLifeRevealActive } from '../game/lifeReveal.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { measureWarpMetric } from '../utils/warpMetrics';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from '../utils/surfaceControls';
import { generateTree, type TreeArchetype } from '../utils/treeGen';
import {
  buildTreeProfile,
  paramsFromProfile,
  treeVariantSeed,
  TREE_VARIANT_COUNT
} from '../utils/treeProfile';
import { getTreeHarvestVersion, isTreeHarvested, resetTreeHarvest } from '../game/systems/treeHarvest';
import { restoreTreesForWorld } from '../game/systems/persistence';
import type { WorldIdentity } from '../game/worldIdentity.ts';
import {
  createBarkMaterial,
  createLeafMaterial,
  createBlossomMaterial,
  createImpostorMaterial,
  applyTreeProfileToMaterials,
  updateTreeMaterials
} from '../utils/treeMaterials';
import { getSunDirection, getMoonDirection } from './SkyController';
import { buildPlanetArtDirection, type PlanetArtDirection } from '../utils/planetArtDirection';
import {
  resolveTreeVariantCount,
  shouldPlaceTreeAtVoxel,
  treeVariantIndexForVoxel,
  writeTreeInstanceVariation,
  type TreeInstanceVariation
} from '../utils/treePopulation';
import { commitRaycastInstanceTransforms } from '../utils/instancedMeshPicking.ts';
import type { PlanetProfile } from '../game/PlanetProfile.ts';

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
  planetProfile?: PlanetProfile;
  persistenceWorld?: WorldIdentity;
  /** Player/camera world position for far-distance culling (optional). */
  playerPosition?: THREE.Vector3;
}

/**
 * Module handle for tree harvesting: each NEAR variant trunk/leaf mesh carries
 * its own slot-to-voxel map, because instance ids restart at zero per mesh.
 */
export interface TreePickTarget {
  mesh: THREE.InstancedMesh;
  slotVoxel: Array<[number, number, number]>;
}

export const treeFieldHandle: {
  /** All near trunk/leaf meshes, each with its own instanceId mapping. */
  pickTargets: TreePickTarget[];
  /** Legacy first-variant aliases retained for debug tooling. */
  trunk: THREE.InstancedMesh | null;
  leaf: THREE.InstancedMesh | null;
  slotVoxel: Array<[number, number, number]>;
} = { pickTargets: [], trunk: null, leaf: null, slotVoxel: [] };

function clearTreeFieldHandle(): void {
  treeFieldHandle.pickTargets.length = 0;
  treeFieldHandle.trunk = null;
  treeFieldHandle.leaf = null;
  treeFieldHandle.slotVoxel = [];
}

// Reused scratch (avoid per-instance allocation).
const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _tilt = new THREE.Matrix4();
const _scaleM = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _scratch = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _instanceVariation: TreeInstanceVariation = {
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  leanRadians: 0,
  leanAzimuth: 0
};

/** Count ecology-eligible voxels whose hash selects them for a tree. */
function countTreeVoxels(
  treeDensity: number,
  terrainSeed: number,
  artDirection: PlanetArtDirection
): number {
  if (treeDensity <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    const [x, y, z] = voxel.position;
    if (
      shouldPlaceTreeAtVoxel(voxel, x, y, z, treeDensity, terrainSeed, artDirection) &&
      !isTreeHarvested(x, y, z)
    ) n++;
  }
  return n;
}

/**
 * Procedural trees. One per-planet species DNA (profile from terrainSeed) yields
 * a small quality-gated phenotype library, instanced across a deterministic,
 * ecology-eligible subset of surface voxels.
 *
 * Each phenotype owns trunk + leaf + optional blossom meshes for NEAR trees and
 * a 2-quad silhouette impostor for FAR trees. All share one material family and
 * each world tree belongs to exactly one variant. Orientation maps local
 *   +Y -> normalize(worldPos) (the planet's outward normal) so trees stand
 *   correctly on all 6 cube faces; wind animates in object space.
 *
 * Capacity is GROWABLE React state (like GrassField) because voxels are added
 * AFTER mount. We NEVER put a declarative count prop on the meshes (that resets
 * on re-render); count is owned imperatively in the fill + self-healed in
 * useFrame across all meshes.
 */
export default function TreeField({ planetSize, terrainSeed, planetProfile, persistenceWorld, playerPosition }: TreeFieldProps) {
  const density = getGraphicsQuality().treeDensity;
  const variantCount = resolveTreeVariantCount(getQualityProfile(), TREE_VARIANT_COUNT);

  // Per-planet species: canonical worlds share the scene's resolved identity;
  // seed-only tooling retains the procedural fallback.
  const profile = useMemo(
    () => measureWarpMetric('tree:profile', () => buildTreeProfile(terrainSeed, planetProfile)),
    [planetProfile, terrainSeed]
  );
  const artDirection = useMemo(
    () => buildPlanetArtDirection(terrainSeed, planetProfile),
    [planetProfile, terrainSeed]
  );
  const hasBlossom = profile.bloomAmount > 0;

  // A small cached phenotype library shares one species/material family. Trees
  // partition between variants, so visible triangle count stays comparable to a
  // single archetype while silhouettes stop repeating exactly across a forest.
  const archetypes = useMemo<TreeArchetype[]>(
    () => measureWarpMetric(
      'tree:archetype_library_generate',
      () => density > 0
        ? Array.from({ length: variantCount }, (_, variant) =>
            generateTree(
              treeVariantSeed(terrainSeed, variant),
              paramsFromProfile(profile, variant)
            )
          )
        : [],
      result => ({
        variants: result.length,
        trunkVerts: result.reduce((sum, tree) => sum + tree.trunkGeometry.attributes.position.count, 0),
        leafVerts: result.reduce((sum, tree) => sum + tree.leafGeometry.attributes.position.count, 0),
        blossomVerts: result.reduce((sum, tree) => sum + tree.blossomGeometry.attributes.position.count, 0),
        impostorVerts: result.reduce((sum, tree) => sum + tree.impostorGeometry.attributes.position.count, 0)
      })
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainSeed, density, variantCount]
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

  const trunkRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const leafRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const blossomRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const impostorRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const slotVoxelsByVariant = useRef<Array<Array<[number, number, number]>>>([]);

  const [capacity, setCapacity] = useState(0);
  const signatureRef = useRef<string>('');
  const profileAppliedRef = useRef(false);
  // Player position at the last LOD re-bucket; we re-run the (alloc-free) rebuild
  // once the player has moved enough so near/full vs far/impostor and the
  // max-distance cull actually FOLLOW the camera instead of freezing at spawn.
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const neededCapacity = () => measureWarpMetric(
    'tree:count_capacity',
    () => countTreeVoxels(density, terrainSeed, artDirection),
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
    const trunks = trunkRefs.current.slice(0, variantCount);
    const leaves = leafRefs.current.slice(0, variantCount);
    const blossoms = blossomRefs.current.slice(0, variantCount);
    const impostors = impostorRefs.current.slice(0, variantCount);
    if (
      density <= 0 || variantCount <= 0 ||
      trunks.length !== variantCount || leaves.length !== variantCount ||
      impostors.length !== variantCount || (hasBlossom && blossoms.length !== variantCount) ||
      trunks.some(mesh => !mesh) || leaves.some(mesh => !mesh) ||
      impostors.some(mesh => !mesh) || (hasBlossom && blossoms.some(mesh => !mesh))
    ) return;
    const nearSlots = new Array(variantCount).fill(0);
    const farSlots = new Array(variantCount).fill(0);
    slotVoxelsByVariant.current = Array.from({ length: variantCount }, () => []);

    measureWarpMetric(
      'tree:rebuild_instances',
      () => {
    const quality = getGraphicsQuality();
    const maxDist = quality.treeMaxDistance;
    const maxDistSq = maxDist * maxDist;
    // Full-geometry (near) trees must reach at least the longest line across a
    // cube face (~face diagonal ≈ planetSize*1.5) so trees don't pop to flat
    // impostors within a single face. Floor the impostor cutover at that, clamped
    // to maxDist (so impostors still exist beyond it; LOW just renders all-near).
    const nearFloor = Math.min(maxDist, planetSize * 1.5);
    const impostorDist = Math.max(maxDist * IMPOSTOR_FRAC, nearFloor);
    const impostorDistSq = impostorDist * impostorDist;
    const cap = trunks[0]!.instanceMatrix.count;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      const [x, y, z] = voxel.position;
      if (!shouldPlaceTreeAtVoxel(voxel, x, y, z, density, terrainSeed, artDirection)) continue;
      if (isTreeHarvested(x, y, z)) continue; // felled — don't re-place it
      const variant = treeVariantIndexForVoxel(x, y, z, terrainSeed, variantCount);
      if (variant < 0) continue;

      voxelCoordToWorld(x, y, z, _world);

      let distSq = -1;
      if (playerPosition) distSq = _world.distanceToSquared(playerPosition);
      // cull beyond max distance entirely.
      if (maxDist > 0 && distSq >= 0 && distSq > maxDistSq) continue;
      const near = maxDist <= 0 || distSq < 0 || distSq <= impostorDistSq;
      const slot = near ? nearSlots[variant] : farSlots[variant];
      if (slot >= cap) continue;

      // Local up = the CUBE FACE NORMAL of the face this voxel sits on (dominant
      // axis), matching how the PLAYER stands (FACE_NORMALS[dominantFace]) and the
      // water surface. NOT radial normalize(worldPos): that tilts away from the
      // flat face off-centre, so a patch of trees all leaned the same way (toward
      // gravity) instead of standing perpendicular to the ground.
      _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
      deterministicTangentForUp(_up, _tangent);
      _bitangent.crossVectors(_up, _tangent).normalize();

      // Orientation basis: local +Y -> up (same approach as grass).
      _basis.makeBasis(_tangent, _up, _bitangent);

      writeTreeInstanceVariation(x, y, z, terrainSeed, _instanceVariation);
      _yaw.makeRotationY(_instanceVariation.leanAzimuth + variant * 2.39996);
      _tilt.makeRotationX(_instanceVariation.leanRadians);
      _scaleM.makeScale(
        _instanceVariation.scaleX,
        _instanceVariation.scaleY,
        _instanceVariation.scaleZ
      );

      _translate.makeTranslation(
        _world.x + _up.x * SURFACE_OFFSET,
        _world.y + _up.y * SURFACE_OFFSET,
        _world.z + _up.z * SURFACE_OFFSET
      );

      // m = translate * basis * yaw * tilt * scale
      // (tilt tips the trunk slightly; yaw spins that lean to a random heading.)
      _m.copy(_translate);
      _m.multiply(_basis);
      _m.multiply(_scratch.copy(_yaw).multiply(_tilt).multiply(_scaleM));

      // NOTE: no per-instance setColorAt. The per-PLANET leaf/flower colours come
      // from the material uniforms (applyTreeProfileToMaterials), and per-instance
      // variation is the in-shader `vTint` (hashed from instance world pos). A
      // hardcoded green instanceColor here would multiply over <color_fragment>
      // and contaminate every alien-hued / flowering planet — so we don't set it.

      if (near) {
        trunks[variant]!.setMatrixAt(slot, _m);
        leaves[variant]!.setMatrixAt(slot, _m);
        if (hasBlossom) {
          blossoms[variant]!.setMatrixAt(slot, _m);
        }
        slotVoxelsByVariant.current[variant][slot] = [x, y, z];
        nearSlots[variant]++;
      } else {
        impostors[variant]!.setMatrixAt(slot, _m);
        farSlots[variant]++;
      }
    }

    treeFieldHandle.pickTargets.length = 0;
    for (let variant = 0; variant < variantCount; variant++) {
      const trunk = trunks[variant]!;
      const leaf = leaves[variant]!;
      const blossom = blossoms[variant];
      const impostor = impostors[variant]!;
      commitRaycastInstanceTransforms(trunk, nearSlots[variant]);
      commitRaycastInstanceTransforms(leaf, nearSlots[variant]);
      impostor.count = farSlots[variant];
      impostor.instanceMatrix.needsUpdate = true;
      if (blossom) {
        blossom.count = nearSlots[variant];
        blossom.instanceMatrix.needsUpdate = true;
      }
      const slots = slotVoxelsByVariant.current[variant];
      slots.length = nearSlots[variant];
      treeFieldHandle.pickTargets.push(
        { mesh: trunk, slotVoxel: slots },
        { mesh: leaf, slotVoxel: slots }
      );
    }
    treeFieldHandle.trunk = trunks[0] ?? null;
    treeFieldHandle.leaf = leaves[0] ?? null;
    treeFieldHandle.slotVoxel = slotVoxelsByVariant.current[0] ?? [];
        return {
          near: nearSlots.reduce((sum, count) => sum + count, 0),
          far: farSlots.reduce((sum, count) => sum + count, 0),
          variants: variantCount,
          capacity: cap
        };
      },
      result => result
    );
  };

  useEffect(() => {
    if (density <= 0 || variantCount <= 0) {
      clearTreeFieldHandle();
      signatureRef.current = '';
      return;
    }
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artDirection, density, terrainSeed, variantCount]);

  // Harvested-tree state is keyed by world-relative voxel coord, so it must reset
  // when the world changes (else a felled coord wrongly hides a tree on the new
  // planet). Clear the pick handle on unmount so a stale mesh is never raycast.
  useEffect(() => {
    resetTreeHarvest();
    restoreTreesForWorld(persistenceWorld ?? terrainSeed); // load this world's already-felled trees
    return clearTreeFieldHandle;
  }, [persistenceWorld, terrainSeed]);

  useEffect(() => {
    if (
      capacity <= 0 || density <= 0 || variantCount <= 0 ||
      archetypes.length !== variantCount
    ) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getTreeHarvestVersion()}`;
    if (playerPosition) lastBucketPos.current.copy(playerPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetypes, capacity, density, terrainSeed, variantCount]);

  // Push per-planet colours into the materials once they exist.
  useEffect(() => {
    profileAppliedRef.current = false;
  }, [profile, barkMaterial, leafMaterial, blossomMaterial, impostorMaterial]);

  useEffect(() => {
    return () => {
      for (const archetype of archetypes) {
        archetype.trunkGeometry.dispose();
        archetype.leafGeometry.dispose();
        archetype.blossomGeometry.dispose();
        archetype.impostorGeometry.dispose();
      }
    };
  }, [archetypes]);

  useEffect(() => {
    return () => {
      barkMaterial?.dispose();
      leafMaterial?.dispose();
      blossomMaterial?.dispose();
      impostorMaterial?.dispose();
    };
  }, [
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

    // Early-story reality stages hide trees in the shader anyway — skip draws
    // and per-frame uniforms entirely (rebuild maintenance below still runs).
    // Visible until shaders compile so the A3 reveal pays no compile hitch.
    // During the A3 bloom wave the fields must DRAW (the shader holds every
    // instance at zero scale until the front reaches it) — culling here would
    // turn the reveal into a pop.
    const hidden = lifeFieldsHidden() && !isLifeRevealActive() && profileAppliedRef.current;
    for (const mesh of [
      ...trunkRefs.current,
      ...leafRefs.current,
      ...blossomRefs.current,
      ...impostorRefs.current
    ]) {
      if (mesh && mesh.visible === hidden) mesh.visible = !hidden;
    }
    if (!hidden) {
      updateTreeMaterials(
        barkMaterial,
        leafMaterial,
        blossomMaterial,
        impostorMaterial,
        performance.now() / 1000,
        getSunDirection(),
        getMoonDirection(),
        getGraphicsQuality(),
        getVoxelRealityEffects()
      );
    }

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getTreeHarvestVersion()}`;
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
    archetypes.length === 0 ||
    !barkMaterial ||
    !leafMaterial ||
    !impostorMaterial ||
    capacity <= 0
  ) {
    return null;
  }

  return (
    <>
      {archetypes.map((archetype, variant) => (
        <instancedMesh
          key={`tree-trunk-${variant}`}
          ref={mesh => { trunkRefs.current[variant] = mesh; }}
          args={[archetype.trunkGeometry, barkMaterial, capacity]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
      {archetypes.map((archetype, variant) => (
        <instancedMesh
          key={`tree-leaf-${variant}`}
          ref={mesh => { leafRefs.current[variant] = mesh; }}
          args={[archetype.leafGeometry, leafMaterial, capacity]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
      {hasBlossom && blossomMaterial && archetypes.map((archetype, variant) => (
        <instancedMesh
          key={`tree-blossom-${variant}`}
          ref={mesh => { blossomRefs.current[variant] = mesh; }}
          args={[archetype.blossomGeometry, blossomMaterial, capacity]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
      {archetypes.map((archetype, variant) => (
        <instancedMesh
          key={`tree-impostor-${variant}`}
          ref={mesh => { impostorRefs.current[variant] = mesh; }}
          args={[archetype.impostorGeometry, impostorMaterial, capacity]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </>
  );
}
