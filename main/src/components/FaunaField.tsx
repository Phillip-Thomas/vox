import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects, lifeFieldsHidden } from '../game/systems/realityRenderSystem';
import { isStoryWorldSeed } from '../story/world/storyWorld.ts';
import { storyLifeDormant } from '../story/storyState.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { getWorldGen } from '../utils/worldGenCache';
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
import type { PlanetProfile } from '../game/PlanetProfile.ts';

interface FaunaFieldProps {
  terrainSeed: number;
  worldId?: string;
  planetProfile?: PlanetProfile;
  playerPosition?: THREE.Vector3;
  /** When provided, ground fauna avoid terrain submerged below the waterline. */
  planetSize?: number;
  progressiveMount?: boolean;
}

const HEADROOM = 12;

/**
 * Sparse procedural fauna. Ground critters and aerial insects are deterministic
 * per voxel/seed, share the planet biome and wind profile, and self-gate through
 * graphics quality and voxel-reality uniforms.
 */
export default function FaunaField({
  terrainSeed,
  worldId,
  planetProfile,
  playerPosition,
  planetSize,
  progressiveMount = false
}: FaunaFieldProps) {
  const density = getGraphicsQuality().faunaDensity;
  const water = useMemo(
    () => (planetSize ? getWorldGen(planetSize, terrainSeed, worldId).generator : undefined),
    [planetSize, terrainSeed, worldId]
  );
  const profile = useMemo(
    () => buildFaunaProfile(terrainSeed, water, planetProfile),
    [planetProfile, terrainSeed, water]
  );
  const [visibleKindCount, setVisibleKindCount] = useState(
    progressiveMount ? 1 : FAUNA_KINDS.length
  );
  useEffect(() => {
    if (!progressiveMount || visibleKindCount >= FAUNA_KINDS.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      setVisibleKindCount(count => Math.min(FAUNA_KINDS.length, count + 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [progressiveMount, visibleKindCount]);

  if (density <= 0) return null;

  return (
    <>
      {FAUNA_KINDS.slice(0, visibleKindCount).map(kind => (
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
  // Player velocity (finite differences) feeds the startle/flee reaction.
  const prevPlayerPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const playerVelocity = useRef(new THREE.Vector3());
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
    // Early-story stages hide fauna in the shader — skip the draw, the per-frame
    // uniforms AND the herd simulation (the biggest CPU line in these fields).
    // Story world: fauna belongs to a LATER awakening (A4 "Breath") — dormant
    // from story start until that awakening grants it. Milestone-driven, NOT
    // stage-driven: the A3 ramp's effect overrides must never flash a glimpse.
    // Non-story sandbox saves and other worlds are untouched.
    const dormant = storyLifeDormant() && isStoryWorldSeed(terrainSeed);
    const hidden = (lifeFieldsHidden() || dormant) && windAppliedRef.current;
    if (mesh && mesh.visible === hidden) mesh.visible = !hidden;
    if (!hidden) {
      updateFaunaMaterial(material, clock.elapsedTime, getGraphicsQuality(), getVoxelRealityEffects(), getSunDirection(), getMoonDirection());
      if (playerPosition) {
        if (Number.isFinite(prevPlayerPos.current.x) && delta > 1e-4) {
          playerVelocity.current
            .copy(playerPosition)
            .sub(prevPlayerPos.current)
            .divideScalar(delta);
          // Teleports/respawns produce absurd speeds; treat them as stationary.
          if (playerVelocity.current.lengthSq() > 900) playerVelocity.current.set(0, 0, 0);
        }
        prevPlayerPos.current.copy(playerPosition);
      }
      if (mesh && agentsRef.current.length > 0) {
        updateFaunaAgents(
          mesh,
          agentsRef.current,
          clock.elapsedTime,
          delta,
          terrainSeed,
          profile,
          playerPosition ?? null,
          playerPosition ? playerVelocity.current : null
        );
      }
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
