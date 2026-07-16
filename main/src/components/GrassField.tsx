import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { getVoxelRealityEffects, lifeFieldsHidden } from '../game/systems/realityRenderSystem';
import { isLifeRevealActive } from '../game/lifeReveal.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  applyGrassInstanceBuffer,
  applyGrassProfileToMaterial,
  buildGrassInstances,
  countGrassInstancesForWindow,
  createBladeGeometry,
  createGrassMaterial,
  getPrewarmedGrassInstanceBuffer,
  updateGrassMaterial
} from '../utils/grassField';
import { buildGrassProfile } from '../utils/grassProfile';
import { getSunDirection } from './SkyController';
import type { PlanetProfile } from '../game/PlanetProfile.ts';

interface GrassFieldProps {
  terrainSeed: number;
  planetProfile?: PlanetProfile;
  /** Player world position, used for far-distance culling (optional). */
  playerPosition?: THREE.Vector3;
}

/**
 * Procedural grass (Phase 3). A single InstancedMesh of wind-animated blades,
 * one draw call, oriented to the planet's LOCAL surface normal so grass looks
 * correct on all 6 cube faces. Blade count scales with quality.grassDensity
 * (ULTRA 6 / HIGH 4 / MEDIUM 2 / LOW 1 / POTATO 0 -> nothing rendered).
 *
 * The instance buffer is rebuilt whenever a cheap signature (worldId + grass
 * voxel count) changes — caught by polling every REBUILD_POLL_FRAMES frames.
 * This stays correct across terrain reloads (reset() bumps worldId) without
 * per-frame JS per blade.
 *
 * Mount-order note: the planet's voxels are added in EfficientPlanet's mount
 * effect, which runs AFTER this component first renders. So at first render
 * there are ZERO grass voxels. `capacity` is therefore REACT STATE that GROWS:
 * the poll (and an initial effect) computes how many blades are needed and, if
 * that exceeds the current GPU buffer, bumps `capacity`. React then recreates
 * the <instancedMesh> with a bigger buffer, and a capacity-keyed effect fills it.
 */
export default function GrassField({ terrainSeed, planetProfile, playerPosition }: GrassFieldProps) {
  // Density is fixed at mount; a profile switch is rare and would remount.
  const density = getGraphicsQuality().grassDensity;

  const geometry = useMemo(() => (density > 0 ? createBladeGeometry() : null), [density]);
  const material = useMemo(() => (density > 0 ? createGrassMaterial() : null), [density]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-planet grass biome (colour family cohered with the tree profile, plus
  // height/width/dryness/wind). Rebuilt only when the planet seed changes.
  const profile = useMemo(
    () => buildGrassProfile(terrainSeed, planetProfile),
    [planetProfile, terrainSeed]
  );
  const profileAppliedRef = useRef(false);
  const useInitialPrewarmRef = useRef(true);
  // Player position at the last cull re-center; we re-run the (alloc-free) rebuild
  // once the player has moved enough so the distance cull FOLLOWS the camera and
  // grass streams in continuously (mirrors TreeField), not only on a terrain edit.
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  // A 10u-expanded count window is a geometric upper bound for everything that
  // can enter the active render window before its next re-center (triangle
  // inequality). Small fixed headroom absorbs a couple of live terrain edits.
  const RECENTER_DISTANCE = 10;
  const HEADROOM = 256;

  // GPU buffer capacity, as growing state. Starts at 0 because no grass voxels
  // exist yet at first render (see mount-order note). `growCapacity` enlarges it
  // once voxels appear or terrain grows; React recreates the mesh on change.
  const [capacity, setCapacity] = useState(0);

  /** Blade slots needed for the current covered, distance-windowed neighborhood. */
  const neededCapacity = () => measureWarpMetric(
    'grass:count_capacity',
    () => {
      const renderDistance = getGraphicsQuality().grassMaxDistance;
      return countGrassInstancesForWindow(
        density,
        renderDistance > 0 ? renderDistance + RECENTER_DISTANCE : 0,
        playerPosition ?? null,
        terrainSeed,
        profile.densityMul,
        profile.coverage
      );
    },
    result => ({ needed: result.count, grassVoxels: result.voxelCount })
  );

  /** Grow `capacity` (never shrink) to fit the conservative window + headroom. */
  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return needed + HEADROOM;
    });
  };

  const signatureRef = useRef<string>('');

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    const result = measureWarpMetric(
      'grass:rebuild_instances',
      () => {
        const prewarmed = useInitialPrewarmRef.current
          ? getPrewarmedGrassInstanceBuffer(
            terrainSeed,
            density,
            quality.grassMaxDistance,
            playerPosition ?? null,
            profile
          )
          : null;
        const result = prewarmed
          ? applyGrassInstanceBuffer(mesh, prewarmed)
          : buildGrassInstances(
            mesh,
            density,
            quality.grassMaxDistance,
            playerPosition ?? null,
            terrainSeed,
            profile.heightMul,
            profile.widthMul,
            profile.densityMul,
            profile.coverage
          );
        useInitialPrewarmRef.current = false;
        return { ...result, prewarmed: Boolean(prewarmed) };
      },
      result => ({ count: result.count, capacity: mesh.instanceMatrix.count, prewarmed: result.prewarmed })
    );
    // A large teleport can mutate the mailbox between the sizing render and
    // this fill. The builder clamps safely; detect that defensive clamp and
    // immediately reserve the new window instead of leaving a sparse field.
    if (result.count >= mesh.instanceMatrix.count) {
      const needed = neededCapacity().count;
      if (needed > mesh.instanceMatrix.count) growCapacity(needed);
    }
    if (playerPosition) lastBucketPos.current.copy(playerPosition);
  };

  // Initial sizing: by the time React commits this effect the planet's voxels
  // usually exist; if not, the per-frame poll below will grow capacity shortly.
  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity().count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  // Whenever the GPU buffer is (re)sized, fill it and snapshot the signature so
  // the poll only rebuilds on real change afterwards.
  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  // Re-apply the per-planet colours when the planet (or material) changes.
  useEffect(() => {
    profileAppliedRef.current = false;
    useInitialPrewarmRef.current = true;
  }, [profile, material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;

    // Push per-planet colours once the shader has compiled (uniforms exist).
    if (!profileAppliedRef.current && material.userData.shader) {
      applyGrassProfileToMaterial(profile, material);
      profileAppliedRef.current = true;
    }

    // Early-story reality stages hide grass in the shader anyway — skip the
    // draw + per-frame uniform work entirely. Kept renderable until the shader
    // has compiled so the reveal (A3+) pays no compile hitch. Rebuild
    // maintenance below still runs so the buffer is current when it returns.
    // During the A3 bloom wave the fields must DRAW (the shader holds every
    // instance at zero scale until the front reaches it) — culling here would
    // turn the reveal into a pop.
    const hidden = lifeFieldsHidden() && !isLifeRevealActive() && profileAppliedRef.current;
    if (mesh && mesh.visible === hidden) mesh.visible = !hidden;
    if (!hidden) {
      // Drive wind + sun (gated to freeze when animatedShaders is off).
      updateGrassMaterial(
        material,
        performance.now() / 1000,
        getGraphicsQuality(),
        getVoxelRealityEffects(),
        getSunDirection()
      );
    }

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity().count;
      if (needed > capacity) {
        // Buffer too small (e.g. first voxels appeared): grow it. The
        // capacity-keyed effect rebuilds once React recreates the mesh.
        growCapacity(needed);
      } else if (mesh) {
        // Fits in the current buffer: rebuild in place, no realloc.
        signatureRef.current = sig;
        rebuild();
        if (playerPosition) lastBucketPos.current.copy(playerPosition);
      }
    } else if (
      mesh
      && playerPosition
      && lastBucketPos.current.distanceToSquared(playerPosition) > RECENTER_DISTANCE ** 2
    ) {
      // Player moved >10u since the last re-center — re-run the distance cull so
      // grass appears in newly-entered areas without needing a terrain edit.
      const needed = neededCapacity().count;
      if (needed > capacity) growCapacity(needed);
      else rebuild();
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
