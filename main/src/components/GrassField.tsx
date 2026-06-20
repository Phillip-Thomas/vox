import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import {
  bladesPerVoxel,
  buildGrassInstances,
  countGrassVoxels,
  createBladeGeometry,
  createGrassMaterial,
  updateGrassMaterial
} from '../utils/grassField';

// How often (in frames) we re-check whether the grass set changed and rebuild.
const REBUILD_POLL_FRAMES = 30;

interface GrassFieldProps {
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
export default function GrassField({ playerPosition }: GrassFieldProps) {
  // Density is fixed at mount; a profile switch is rare and would remount.
  const density = getGraphicsQuality().grassDensity;

  const geometry = useMemo(() => (density > 0 ? createBladeGeometry() : null), [density]);
  const material = useMemo(() => (density > 0 ? createGrassMaterial() : null), [density]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Headroom (extra blade slots) so small grass-count fluctuations from terrain
  // edits don't force a buffer reallocation every time.
  const HEADROOM = 256;

  // GPU buffer capacity, as growing state. Starts at 0 because no grass voxels
  // exist yet at first render (see mount-order note). `growCapacity` enlarges it
  // once voxels appear or terrain grows; React recreates the mesh on change.
  const [capacity, setCapacity] = useState(0);

  /** Blade slots needed right now for all exposed grass voxels. */
  const neededCapacity = () => bladesPerVoxel(density) * countGrassVoxels();

  /** Grow `capacity` (never shrink) to fit `needed`, with margin + headroom. */
  const growCapacity = (needed: number) => {
    setCapacity(prev => {
      if (needed <= prev) return prev;
      return Math.ceil(needed * 1.25) + HEADROOM;
    });
  };

  const signatureRef = useRef<string>('');
  const frameRef = useRef(0);

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh || density <= 0) return;
    const quality = getGraphicsQuality();
    buildGrassInstances(mesh, density, quality.grassMaxDistance, playerPosition ?? null);
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
    signatureRef.current = `${voxelSystem.getWorldId()}:${countGrassVoxels()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!material || density <= 0) return;

    // Drive wind (gated to freeze when animatedShaders is off).
    updateGrassMaterial(material, performance.now() / 1000, getGraphicsQuality());

    // Throttled change detection (terrain edits / reload / empty->populated).
    frameRef.current++;
    if (frameRef.current % REBUILD_POLL_FRAMES === 0) {
      const sig = `${voxelSystem.getWorldId()}:${countGrassVoxels()}`;
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
