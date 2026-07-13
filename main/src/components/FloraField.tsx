import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects, lifeFieldsHidden } from '../game/systems/realityRenderSystem';
import { isStoryWorldSeed } from '../story/world/storyWorld.ts';
import { storyLifeDormant } from '../story/storyState.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import { getMoonDirection, getSunDirection } from './SkyController';
import {
  CANONICAL_FLORA_DENSITY,
  FLORA_KINDS,
  FLORA_INTERACTION_VISIBILITY_DISTANCE,
  applyFloraWindProfileToMaterial,
  buildFloraInstances,
  buildFloraProfile,
  countFloraVoxels,
  createFloraGeometry,
  createFloraMaterial,
  updateFloraMaterial,
  type FloraKind
} from '../utils/floraField';
import type { FloraProfile } from '../utils/floraField';
import {
  getFloraHarvestVersion,
  isFloraHarvested,
  resetFloraHarvest
} from '../game/systems/floraHarvest';
import { restoreFloraForWorld } from '../game/systems/persistence';
import type { WorldIdentity } from '../game/worldIdentity.ts';

interface FloraFieldProps {
  terrainSeed: number;
  persistenceWorld?: WorldIdentity;
  playerPosition?: THREE.Vector3;
  progressiveMount?: boolean;
}

const HEADROOM = 24;

export interface FloraPickTarget {
  kind: FloraKind;
  mesh: THREE.InstancedMesh;
  slotVoxel: Array<[number, number, number]>;
}

/** Per-kind render meshes and their current instance-to-canonical-node mapping. */
export const floraFieldHandle: { pickTargets: FloraPickTarget[] } = { pickTargets: [] };

function publishFloraPickTarget(target: FloraPickTarget): void {
  // The demo exposes only flora with an immediate survival use. Other species
  // remain visual until their later recipes are honestly available.
  if (target.kind !== 'shrub') return;
  const index = floraFieldHandle.pickTargets.findIndex(entry => entry.kind === target.kind);
  if (index >= 0) floraFieldHandle.pickTargets[index] = target;
  else floraFieldHandle.pickTargets.push(target);
}

function unpublishFloraPickTarget(kind: FloraKind, mesh: THREE.InstancedMesh): void {
  const index = floraFieldHandle.pickTargets.findIndex(
    entry => entry.kind === kind && entry.mesh === mesh
  );
  if (index >= 0) floraFieldHandle.pickTargets.splice(index, 1);
}

/**
 * Procedural mid-story flora: small flowers, fans, shrubs, dry seedheads, and
 * cacti. This sits between grass and trees and consumes the same planet biome,
 * wind profile, graphics-quality gates, and reality-stage uniforms.
 */
export default function FloraField({
  terrainSeed,
  persistenceWorld,
  playerPosition,
  progressiveMount = false
}: FloraFieldProps) {
  const density = getGraphicsQuality().floraDensity;
  const profile = useMemo(() => buildFloraProfile(terrainSeed), [terrainSeed]);
  const [visibleKindCount, setVisibleKindCount] = useState(
    progressiveMount ? 1 : FLORA_KINDS.length
  );
  useEffect(() => {
    if (!progressiveMount || visibleKindCount >= FLORA_KINDS.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      setVisibleKindCount(count => Math.min(FLORA_KINDS.length, count + 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [progressiveMount, visibleKindCount]);

  // Harvest markers are world-relative. Restore before the field becomes an
  // economy surface; multiplayer uses the cached authoritative snapshot here.
  useEffect(() => {
    resetFloraHarvest();
    restoreFloraForWorld(persistenceWorld ?? terrainSeed);
  }, [persistenceWorld, terrainSeed]);

  return (
    <>
      {FLORA_KINDS.slice(0, visibleKindCount).map(kind => (
        <FloraLayer
          key={kind}
          kind={kind}
          density={density}
          terrainSeed={terrainSeed}
          playerPosition={playerPosition}
          profile={profile}
        />
      ))}
    </>
  );
}

function FloraLayer({
  kind,
  density,
  terrainSeed,
  playerPosition,
  profile
}: {
  kind: FloraKind;
  density: number;
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
  profile: FloraProfile;
}) {
  const geometry = useMemo(() => createFloraGeometry(kind, profile), [kind, profile]);
  const material = useMemo(() => createFloraMaterial(kind, profile), [kind, profile]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const publishedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const slotVoxels = useRef<Array<[number, number, number]>>([]);
  const windAppliedRef = useRef(false);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [capacity, setCapacity] = useState(0);

  const neededCapacity = () => measureWarpMetric(
    `flora:${kind}_count_capacity`,
    () => countFloraVoxels(kind, CANONICAL_FLORA_DENSITY, terrainSeed, profile),
    needed => ({ needed })
  );

  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const quality = getGraphicsQuality();
    const result = measureWarpMetric(
      `flora:${kind}_rebuild`,
      () => buildFloraInstances(
        kind,
        mesh,
        density,
        Math.max(quality.floraMaxDistance, FLORA_INTERACTION_VISIBILITY_DISTANCE),
        playerPosition ?? null,
        terrainSeed,
        profile,
        {
          interactionVisibilityDistance: FLORA_INTERACTION_VISIBILITY_DISTANCE,
          isHarvested: isFloraHarvested,
          slotVoxel: slotVoxels.current
        }
      ),
      result => ({ count: result.count, voxelCount: result.voxelCount, capacity: mesh.instanceMatrix.count })
    );
    publishedMeshRef.current = mesh;
    publishFloraPickTarget({ kind, mesh, slotVoxel: slotVoxels.current });
    return result;
  };

  useEffect(() => {
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, terrainSeed, profile]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getFloraHarvestVersion()}`;
    if (playerPosition) lastBucketPos.current.copy(playerPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity, profile]);

  useEffect(() => {
    windAppliedRef.current = false;
  }, [profile, material]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
      const publishedMesh = publishedMeshRef.current;
      if (publishedMesh) unpublishFloraPickTarget(kind, publishedMesh);
      slotVoxels.current.length = 0;
    };
  }, [geometry, kind, material]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!material) return;

    if (!windAppliedRef.current && material.userData.shader) {
      applyFloraWindProfileToMaterial(profile.wind, material);
      windAppliedRef.current = true;
    }
    // Early-story stages hide flora in the shader — skip draw + uniform work.
    // Story world: flora belongs to a LATER awakening (A4 "Breath") — dormant
    // from story start until that awakening grants it. Milestone-driven, NOT
    // stage-driven: the A3 ramp's effect overrides must never flash a glimpse.
    // Non-story sandbox saves and other worlds are untouched.
    const dormant = storyLifeDormant() && isStoryWorldSeed(terrainSeed);
    const hidden = (lifeFieldsHidden() || dormant) && windAppliedRef.current;
    if (mesh && mesh.visible === hidden) mesh.visible = !hidden;
    if (!hidden) {
      updateFloraMaterial(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects(), getSunDirection(), getMoonDirection());
    }

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getFloraHarvestVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) {
        growCapacity(needed);
      } else if (mesh) {
        signatureRef.current = sig;
        rebuild();
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (mesh && playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 100) {
      lastBucketPos.current.copy(playerPosition);
      rebuild();
    }
  });

  if (!geometry || !material || capacity <= 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
