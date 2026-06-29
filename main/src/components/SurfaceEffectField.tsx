import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { buildWindProfile } from '../utils/windProfile';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  applyDirtLifeWindProfileToMaterial,
  applySandDustWindProfileToMaterial,
  buildDirtLifeInstances,
  buildSandDustInstances,
  countDirtLifeVoxels,
  countSandDustVoxels,
  createDirtLifeGeometry,
  createDirtLifeMaterial,
  createSandDustGeometry,
  createSandDustMaterial,
  updateDirtLifeMaterial,
  updateSandDustMaterial
} from '../utils/surfaceEffects';
import type { SurfaceEffectBuildResult } from '../utils/surfaceEffects';
import type { WindProfile } from '../utils/windProfile';

interface SurfaceEffectFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

const HEADROOM = 64;

interface SurfaceEffectSpec {
  id: string;
  createGeometry: () => THREE.BufferGeometry;
  createMaterial: () => THREE.Material;
  count: (density: number, terrainSeed: number) => number;
  build: (
    mesh: THREE.InstancedMesh,
    density: number,
    maxDistance: number,
    playerWorld: THREE.Vector3 | null,
    terrainSeed: number,
    windProfile: WindProfile
  ) => SurfaceEffectBuildResult;
  applyWind: (profile: WindProfile, material: THREE.Material) => void;
  update: (
    material: THREE.Material,
    time: number,
    quality: ReturnType<typeof getGraphicsQuality>,
    reality: ReturnType<typeof getVoxelRealityEffects>
  ) => void;
}

const SURFACE_EFFECTS: SurfaceEffectSpec[] = [
  {
    id: 'sand_dust',
    createGeometry: createSandDustGeometry,
    createMaterial: createSandDustMaterial,
    count: countSandDustVoxels,
    build: buildSandDustInstances,
    applyWind: applySandDustWindProfileToMaterial,
    update: updateSandDustMaterial
  },
  {
    id: 'dirt_life',
    createGeometry: createDirtLifeGeometry,
    createMaterial: createDirtLifeMaterial,
    count: countDirtLifeVoxels,
    build: buildDirtLifeInstances,
    applyWind: applyDirtLifeWindProfileToMaterial,
    update: updateDirtLifeMaterial
  }
];

/**
 * Material-driven spawned surface phenomena. This is intentionally separate from
 * `voxelMaterial`: shader detail changes the block skin, while this field places
 * actual animated geometry above eligible blocks.
 */
export default function SurfaceEffectField({ terrainSeed, playerPosition }: SurfaceEffectFieldProps) {
  const density = getGraphicsQuality().voxelEffectDensity;
  const windProfile = useMemo(() => buildWindProfile(terrainSeed), [terrainSeed]);

  if (density <= 0) return null;

  return (
    <>
      {SURFACE_EFFECTS.map(spec => (
        <SurfaceEffectLayer
          key={spec.id}
          spec={spec}
          density={density}
          terrainSeed={terrainSeed}
          playerPosition={playerPosition}
          windProfile={windProfile}
        />
      ))}
    </>
  );
}

function SurfaceEffectLayer({
  spec,
  density,
  terrainSeed,
  playerPosition,
  windProfile
}: {
  spec: SurfaceEffectSpec;
  density: number;
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
  windProfile: WindProfile;
}) {
  const geometry = useMemo(() => (density > 0 ? spec.createGeometry() : null), [density, spec]);
  const material = useMemo(() => (density > 0 ? spec.createMaterial() : null), [density, spec]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const profileAppliedRef = useRef(false);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [capacity, setCapacity] = useState(0);

  const neededCapacity = () => measureWarpMetric(
    `surface_effects:${spec.id}_count_capacity`,
    () => spec.count(density, terrainSeed),
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
      `surface_effects:${spec.id}_rebuild`,
      () => spec.build(
        mesh,
        density,
        quality.voxelEffectMaxDistance,
        playerPosition ?? null,
        terrainSeed,
        windProfile
      ),
      result => ({ count: result.count, voxelCount: result.voxelCount, capacity: mesh.instanceMatrix.count })
    );
  };

  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, terrainSeed]);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity, windProfile]);

  useEffect(() => {
    profileAppliedRef.current = false;
  }, [windProfile, material]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;

    if (!profileAppliedRef.current && material.userData.shader) {
      spec.applyWind(windProfile, material);
      profileAppliedRef.current = true;
    }
    spec.update(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects());

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
