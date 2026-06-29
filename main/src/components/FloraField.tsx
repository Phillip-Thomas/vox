import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import { getMoonDirection, getSunDirection } from './SkyController';
import {
  FLORA_KINDS,
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

interface FloraFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

const HEADROOM = 24;

/**
 * Procedural mid-story flora: small flowers, fans, shrubs, dry seedheads, and
 * cacti. This sits between grass and trees and consumes the same planet biome,
 * wind profile, graphics-quality gates, and reality-stage uniforms.
 */
export default function FloraField({ terrainSeed, playerPosition }: FloraFieldProps) {
  const density = getGraphicsQuality().floraDensity;
  const profile = useMemo(() => buildFloraProfile(terrainSeed), [terrainSeed]);

  if (density <= 0) return null;

  return (
    <>
      {FLORA_KINDS.map(kind => (
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
  const geometry = useMemo(() => (density > 0 ? createFloraGeometry(kind, profile) : null), [density, kind, profile]);
  const material = useMemo(() => (density > 0 ? createFloraMaterial(kind, profile) : null), [density, kind, profile]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const windAppliedRef = useRef(false);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [capacity, setCapacity] = useState(0);

  const neededCapacity = () => measureWarpMetric(
    `flora:${kind}_count_capacity`,
    () => countFloraVoxels(kind, density, terrainSeed, profile),
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
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    measureWarpMetric(
      `flora:${kind}_rebuild`,
      () => buildFloraInstances(
        kind,
        mesh,
        density,
        quality.floraMaxDistance,
        playerPosition ?? null,
        terrainSeed,
        profile
      ),
      result => ({ count: result.count, voxelCount: result.voxelCount, capacity: mesh.instanceMatrix.count })
    );
  };

  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, terrainSeed, profile]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity, profile]);

  useEffect(() => {
    windAppliedRef.current = false;
  }, [profile, material]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;

    if (!windAppliedRef.current && material.userData.shader) {
      applyFloraWindProfileToMaterial(profile.wind, material);
      windAppliedRef.current = true;
    }
    updateFloraMaterial(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects(), getSunDirection(), getMoonDirection());

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
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

  if (density <= 0 || !geometry || !material || capacity <= 0) return null;

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
