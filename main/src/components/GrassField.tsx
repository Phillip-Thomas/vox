import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  applyGrassInstanceBuffer,
  applyGrassProfileToMaterial,
  bladesPerVoxel,
  buildGrassInstances,
  countGrassVoxels,
  createBladeGeometry,
  createGrassMaterial,
  getPrewarmedGrassInstanceBuffer,
  updateGrassMaterial
} from '../utils/grassField';
import { buildGrassProfile } from '../utils/grassProfile';
import { getSunDirection } from './SkyController';

interface GrassFieldProps {
  terrainSeed: number;
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
export default function GrassField({ terrainSeed, playerPosition }: GrassFieldProps) {
  // Density is fixed at mount; a profile switch is rare and would remount.
  const density = getGraphicsQuality().grassDensity;

  const geometry = useMemo(() => (density > 0 ? createBladeGeometry() : null), [density]);
  const material = useMemo(() => (density > 0 ? createGrassMaterial() : null), [density]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-planet grass biome (colour family cohered with the tree profile, plus
  // height/width/dryness/wind). Rebuilt only when the planet seed changes.
  const profile = useMemo(() => buildGrassProfile(terrainSeed), [terrainSeed]);
  const profileAppliedRef = useRef(false);
  const useInitialPrewarmRef = useRef(true);

  // Headroom (extra blade slots) so small grass-count fluctuations from terrain
  // edits don't force a buffer reallocation every time.
  const HEADROOM = 256;

  // GPU buffer capacity, as growing state. Starts at 0 because no grass voxels
  // exist yet at first render (see mount-order note). `growCapacity` enlarges it
  // once voxels appear or terrain grows; React recreates the mesh on change.
  const [capacity, setCapacity] = useState(0);

  /** Blade slots needed right now for all exposed grass voxels. */
  const neededCapacity = () => measureWarpMetric(
    'grass:count_capacity',
    () => bladesPerVoxel(density, profile.densityMul) * countGrassVoxels(),
    needed => ({ needed })
  );

  /** Grow `capacity` (never shrink) to fit `needed`, with margin + headroom. */
  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  const signatureRef = useRef<string>('');

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    measureWarpMetric(
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
  };

  // Initial sizing: by the time React commits this effect the planet's voxels
  // usually exist; if not, the per-frame poll below will grow capacity shortly.
  useEffect(() => {
    if (density <= 0) return;
    growCapacity(neededCapacity());
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

    // Drive wind + sun (gated to freeze when animatedShaders is off).
    updateGrassMaterial(material, performance.now() / 1000, getGraphicsQuality(), getSunDirection());

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) {
        // Buffer too small (e.g. first voxels appeared): grow it. The
        // capacity-keyed effect rebuilds once React recreates the mesh.
        growCapacity(needed);
      } else if (mesh) {
        // Fits in the current buffer: rebuild in place, no realloc.
        signatureRef.current = sig;
        rebuild();
      }
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
