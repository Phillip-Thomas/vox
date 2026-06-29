import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import { getMoonDirection, getSunDirection } from './SkyController';
import {
  FAUNA_KINDS,
  applyFaunaWindProfileToMaterial,
  buildFaunaInstances,
  buildFaunaProfile,
  countFaunaVoxels,
  createFaunaGeometry,
  createFaunaMaterial,
  prepareFaunaInstanceAttributes,
  updateFaunaAgents,
  updateFaunaMaterial,
  type FaunaAgent,
  type FaunaKind,
  type FaunaProfile
} from '../utils/faunaField';

interface FaunaFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

const HEADROOM = 12;

/**
 * Sparse procedural fauna. Ground critters and aerial insects are deterministic
 * per voxel/seed, share the planet biome and wind profile, and self-gate through
 * graphics quality and voxel-reality uniforms.
 */
export default function FaunaField({ terrainSeed, playerPosition }: FaunaFieldProps) {
  const density = getGraphicsQuality().faunaDensity;
  const profile = useMemo(() => buildFaunaProfile(terrainSeed), [terrainSeed]);

  if (density <= 0) return null;

  return (
    <>
      {FAUNA_KINDS.map(kind => (
        <FaunaLayer
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

function FaunaLayer({
  kind,
  density,
  terrainSeed,
  playerPosition,
  profile
}: {
  kind: FaunaKind;
  density: number;
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
  profile: FaunaProfile;
}) {
  const geometry = useMemo(() => (density > 0 ? createFaunaGeometry(kind, profile) : null), [density, kind, profile]);
  const material = useMemo(() => (density > 0 ? createFaunaMaterial(kind, profile) : null), [density, kind, profile]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const agentsRef = useRef<FaunaAgent[]>([]);
  const windAppliedRef = useRef(false);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const latestTimeRef = useRef(0);
  const [capacity, setCapacity] = useState(0);

  const neededCapacity = () => measureWarpMetric(
    `fauna:${kind}_count_capacity`,
    () => countFaunaVoxels(kind, density, terrainSeed, profile),
    needed => ({ needed })
  );

  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  const rebuild = (time = latestTimeRef.current) => {
    const mesh = meshRef.current;
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    const existingAgents = agentsRef.current;
    const result = measureWarpMetric(
      `fauna:${kind}_rebuild`,
      () => buildFaunaInstances(
        kind,
        mesh,
        density,
        quality.faunaMaxDistance,
        playerPosition ?? null,
        terrainSeed,
        profile,
        { existingAgents, time }
      ),
      result => ({ count: result.count, voxelCount: result.voxelCount, capacity: mesh.instanceMatrix.count })
    );
    agentsRef.current = result.agents;
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

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;
    latestTimeRef.current = clock.elapsedTime;

    if (!windAppliedRef.current && material.userData.shader) {
      applyFaunaWindProfileToMaterial(profile.wind, material);
      windAppliedRef.current = true;
    }
    updateFaunaMaterial(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects(), getSunDirection(), getMoonDirection());
    if (mesh && agentsRef.current.length > 0) {
      updateFaunaAgents(mesh, agentsRef.current, clock.elapsedTime, delta, terrainSeed, profile);
    }

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) {
        growCapacity(needed);
      } else if (mesh) {
        signatureRef.current = sig;
        rebuild(clock.elapsedTime);
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (mesh && playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 144) {
      lastBucketPos.current.copy(playerPosition);
      rebuild(clock.elapsedTime);
    }
  });

  if (density <= 0 || !geometry || !material || capacity <= 0) return null;
  prepareFaunaInstanceAttributes(geometry, capacity);

  return (
    <instancedMesh
      ref={meshRef}
      name={`fauna-${kind}`}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
